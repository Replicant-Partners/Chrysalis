/**
 * A2A Client Core
 * 
 * Main client class composed from modular components.
 * 
 * @module a2a-client/a2a/client
 */

import { EventEmitter } from 'events';
import {
  AgentCard,
  AgentCapabilities,
  AgentSkill,
  Task,
  TaskState,
  TaskSendParams,
  TaskSendResult,
  TaskSendSubscribeParams,
  TaskGetParams,
  TaskGetResult,
  TaskCancelParams,
  TaskCancelResult,
  TaskResubscribeParams,
  PushNotificationConfig,
  PushNotificationGetParams,
  PushNotificationGetResult,
  PushNotificationSetParams,
  PushNotificationSetResult,
  StreamEvent,
  A2AClientConfig,
  ClientEventType,
  ClientEvent,
  A2AMethod,
  Session,
  A2A_ERROR_CODES,
  Message,
  MessageRole,
  ContentPart,
  TaskInput
} from '../types';
import { ValidatedStreamEvent } from '../schemas';
import { A2AError } from './error';
import { SessionManager } from './session';
import { RpcClient } from './rpc';
import { fetchAgentCard, validateAgentCard } from './discovery';
import * as messages from './messages';

export class A2AClient extends EventEmitter {
  private config: A2AClientConfig;
  private agentCard?: AgentCard;
  private connected: boolean = false;
  private sessionManager: SessionManager;
  private rpcClient: RpcClient;
  
  constructor(config: A2AClientConfig) {
    super();
    this.config = {
      timeout: 30000,
      retryEnabled: true,
      maxRetries: 3,
      retryDelay: 1000,
      debug: false,
      ...config
    };
    
    this.sessionManager = new SessionManager({
      onSessionsCleaned: (expired, remaining) => {
        this.emitEvent('sessions-cleaned', { expired, remaining });
      },
      onLog: (level, message) => this.log(level, message)
    });
    
    this.rpcClient = new RpcClient(
      {
        timeout: this.config.timeout,
        retryEnabled: this.config.retryEnabled,
        maxRetries: this.config.maxRetries,
        retryDelay: this.config.retryDelay,
        headers: this.config.headers,
        auth: this.config.auth
      },
      {
        onLog: (level, message) => this.log(level, message),
        onStreamValidationError: (error, rawData) => {
          this.emitEvent('stream-validation-error', { error, rawData });
        },
        onStreamParseError: (error, rawData) => {
          this.emitEvent('stream-parse-error', { error, rawData });
        }
      }
    );
  }
  
  async connect(): Promise<AgentCard> {
    if (this.connected && this.agentCard) {
      return this.agentCard;
    }
    
    try {
      if (typeof this.config.agentCard === 'string') {
        this.agentCard = await fetchAgentCard(
          this.config.agentCard,
          (url, options) => this.fetchWithRetry(url, options)
        );
      } else {
        this.agentCard = this.config.agentCard;
      }
      
      validateAgentCard(this.agentCard);
      
      this.connected = true;
      this.emitEvent('connected', { agentCard: this.agentCard });
      this.log('info', `Connected to agent: ${this.agentCard.name}`);
      
      return this.agentCard;
    } catch (error) {
      this.emitEvent('error', { error });
      throw A2AError.from(error, A2A_ERROR_CODES.INTERNAL_ERROR);
    }
  }
  
  disconnect(): void {
    this.sessionManager.destroy();
    this.connected = false;
    this.agentCard = undefined;
    this.emitEvent('disconnected', {});
  }
  
  isConnected(): boolean {
    return this.connected && !!this.agentCard;
  }
  
  getAgentCard(): AgentCard | undefined {
    return this.agentCard;
  }
  
  getCapabilities(): AgentCapabilities | undefined {
    return this.agentCard?.capabilities;
  }
  
  getSkills(): AgentSkill[] {
    return this.agentCard?.skills || [];
  }
  
  getStats(): {
    sessionsCreated: number;
    sessionsEvicted: number;
    streamEventsReceived: number;
    streamEventsInvalid: number;
  } {
    return {
      ...this.sessionManager.getStats(),
      ...this.rpcClient.getStats()
    };
  }
  
  async sendTask(params: TaskSendParams): Promise<Task> {
    this.ensureConnected();
    
    const result = await this.rpc<TaskSendResult>('tasks/send', params);
    
    if (result.task.sessionId) {
      this.sessionManager.trackSession(result.task.sessionId, result.task.id);
    }
    
    this.emitEvent('task-created', { task: result.task });
    return result.task;
  }
  
  async *sendTaskStream(params: TaskSendParams): AsyncGenerator<StreamEvent, Task, undefined> {
    this.ensureConnected();
    
    this.ensureCapabilityEnabled(
      this.agentCard?.capabilities?.streaming,
      A2A_ERROR_CODES.UNSUPPORTED_OPERATION,
      'Agent does not support streaming'
    );
    
    const streamParams: TaskSendSubscribeParams = {
      ...params,
      stream: true
    };
    
    const response = await this.streamRpc('tasks/sendSubscribe', streamParams);
    
    this.emitEvent('stream-start', { params: streamParams });
    
    const finalTask = yield* this.streamEventsWithFinal(
      response,
      event => this.emitEvent('stream-event', { event })
    );
    
    this.emitEvent('stream-end', { task: finalTask });
    
    return finalTask;
  }
  
  async getTask(taskId: string, includeHistory?: boolean): Promise<Task> {
    this.ensureConnected();
    
    const params: TaskGetParams = {
      id: taskId,
      includeHistory
    };
    
    const result = await this.rpc<TaskGetResult>('tasks/get', params);
    return result.task;
  }
  
  async cancelTask(taskId: string, reason?: string): Promise<Task> {
    this.ensureConnected();
    
    const params: TaskCancelParams = {
      id: taskId,
      reason
    };
    
    const result = await this.rpc<TaskCancelResult>('tasks/cancel', params);
    this.emitEvent('task-updated', { task: result.task });
    return result.task;
  }
  
  async *resubscribeTask(taskId: string): AsyncGenerator<StreamEvent, Task, undefined> {
    this.ensureConnected();
    
    const params: TaskResubscribeParams = {
      id: taskId
    };
    
    const response = await this.streamRpc('tasks/resubscribe', params);
    
    const finalTask = yield* this.streamEventsWithFinal(response);
    
    return finalTask;
  }
  
  async waitForCompletion(
    taskId: string,
    pollInterval: number = 1000,
    timeout?: number
  ): Promise<Task> {
    const startTime = Date.now();
    const maxTime = timeout || this.config.timeout || 30000;
    
    while (true) {
      const task = await this.getTask(taskId);
      
      if (this.isTerminalState(task.status.state)) {
        if (task.status.state === 'completed') {
          this.emitEvent('task-completed', { task });
        } else if (task.status.state === 'failed') {
          this.emitEvent('task-failed', { task });
        }
        return task;
      }
      
      if (Date.now() - startTime > maxTime) {
        throw new A2AError(A2A_ERROR_CODES.INTERNAL_ERROR, 'Task completion timeout');
      }
      
      await this.sleep(pollInterval);
    }
  }
  
  async getPushNotificationConfig(taskId: string): Promise<PushNotificationConfig | null> {
    this.ensureConnected();
    
    this.ensureCapabilityEnabled(
      this.agentCard?.capabilities?.pushNotifications,
      A2A_ERROR_CODES.PUSH_NOTIFICATION_NOT_SUPPORTED,
      'Agent does not support push notifications'
    );
    
    const params: PushNotificationGetParams = { id: taskId };
    const result = await this.rpc<PushNotificationGetResult>('tasks/pushNotification/get', params);
    return result.config;
  }
  
  async setPushNotificationConfig(
    taskId: string,
    config: PushNotificationConfig
  ): Promise<PushNotificationConfig> {
    this.ensureConnected();
    
    this.ensureCapabilityEnabled(
      this.agentCard?.capabilities?.pushNotifications,
      A2A_ERROR_CODES.PUSH_NOTIFICATION_NOT_SUPPORTED,
      'Agent does not support push notifications'
    );
    
    const params: PushNotificationSetParams = {
      id: taskId,
      config
    };
    
    const result = await this.rpc<PushNotificationSetResult>('tasks/pushNotification/set', params);
    return result.config;
  }
  
  getSession(sessionId: string): Session | undefined {
    return this.sessionManager.getSession(sessionId);
  }
  
  getSessions(): Session[] {
    return this.sessionManager.getSessions();
  }
  
  clearSessions(): void {
    this.sessionManager.clearSessions();
  }
  
  getSessionCount(): number {
    return this.sessionManager.getSessionCount();
  }
  
  static createTextMessage(text: string, role: MessageRole = 'user'): Message {
    return messages.createTextMessage(text, role);
  }
  
  static createFileMessage(
    file: { name?: string; mimeType?: string; uri?: string; bytes?: string },
    role: MessageRole = 'user'
  ): Message {
    return messages.createFileMessage(file, role);
  }
  
  static createDataMessage(
    data: Record<string, unknown>,
    role: MessageRole = 'user'
  ): Message {
    return messages.createDataMessage(data, role);
  }
  
  static createTextInput(text: string, skillId?: string): TaskInput {
    return messages.createTextInput(text, skillId);
  }
  
  static extractText(parts: ContentPart[]): string {
    return messages.extractText(parts);
  }
  
  static extractData(parts: ContentPart[]): Record<string, unknown>[] {
    return messages.extractData(parts);
  }
  
  private async rpc<T>(method: A2AMethod, params?: unknown): Promise<T> {
    return this.rpcClient.rpc<T>(this.agentCard!.url, method, params);
  }
  
  private async streamRpc(method: A2AMethod, params?: unknown): Promise<ReadableStream<Uint8Array>> {
    return this.rpcClient.streamRpc(this.agentCard!.url, method, params);
  }
  
  private async *streamEventsWithFinal(
    stream: ReadableStream<Uint8Array>,
    onEvent?: (event: ValidatedStreamEvent) => void
  ): AsyncGenerator<StreamEvent, Task, undefined> {
    let finalTask: Task | undefined;

    for await (const event of this.rpcClient.parseStreamEvents(stream)) {
      onEvent?.(event);
      yield event as StreamEvent;
      if (event.type === 'done') {
        finalTask = event.task as Task;
      }
    }

    if (!finalTask) {
      throw new A2AError(A2A_ERROR_CODES.INTERNAL_ERROR, 'Stream ended without final task');
    }

    return finalTask;
  }
  
  private async fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
    let lastError: Error | undefined;
    const maxRetries = this.config.retryEnabled ? (this.config.maxRetries || 3) : 1;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.status >= 400 && response.status < 500) {
          return response;
        }
        
        if (response.status >= 500) {
          lastError = new Error(`Server error: ${response.status}`);
          await this.sleep(this.config.retryDelay || 1000);
          continue;
        }
        
        return response;
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries - 1) {
          await this.sleep(this.config.retryDelay || 1000);
        }
      }
    }
    
    throw A2AError.from(lastError, A2A_ERROR_CODES.INTERNAL_ERROR);
  }
  
  private ensureConnected(): void {
    if (!this.connected || !this.agentCard) {
      throw new A2AError(A2A_ERROR_CODES.INTERNAL_ERROR, 'Client not connected');
    }
  }

  private ensureCapabilityEnabled(
    capability: boolean | undefined,
    code: number,
    message: string
  ): void {
    if (!capability) {
      throw new A2AError(code, message);
    }
  }
  
  private isTerminalState(state: TaskState): boolean {
    return ['completed', 'failed', 'canceled'].includes(state);
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private log(level: 'info' | 'error' | 'debug', message: string): void {
    if (this.config.debug || level === 'error') {
      const prefix = `[A2AClient] [${level.toUpperCase()}]`;
      if (level === 'error') {
        console.error(`${prefix} ${message}`);
      } else {
        console.log(`${prefix} ${message}`);
      }
    }
    
    this.emit('log', { level, message });
  }
  
  private emitEvent(type: ClientEventType, data: unknown): void {
    const event: ClientEvent = {
      type,
      timestamp: new Date().toISOString(),
      data
    };
    
    this.emit('event', event);
    this.emit(type, data);
  }
}

export function createA2AClient(config: A2AClientConfig): A2AClient {
  return new A2AClient(config);
}

export async function connectToAgent(
  url: string,
  auth?: A2AClientConfig['auth']
): Promise<A2AClient> {
  const client = new A2AClient({ agentCard: url, auth });
  await client.connect();
  return client;
}

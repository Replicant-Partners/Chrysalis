/**
 * A2A (Agent-to-Agent) Client Implementation
 * 
 * Client for communicating with A2A-compliant agents.
 * Supports task submission, streaming, and push notifications.
 * 
 * @module a2a-client/a2a-client
 * @version 1.0.0
 * @see https://google.github.io/A2A/
 */

import { EventEmitter } from 'events';
import {
  // JSON-RPC types
  JsonRpcId,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError,
  A2A_ERROR_CODES,
  
  // Agent Card types
  AgentCard,
  AgentCapabilities,
  AgentSkill,
  
  // Content types
  ContentPart,
  TextPart,
  FilePart,
  DataPart,
  Message,
  MessageRole,
  
  // Task types
  Task,
  TaskState,
  TaskInput,
  TaskOutput,
  TaskStatus,
  Artifact,
  
  // Push notification types
  PushNotificationConfig,
  
  // Method params
  TaskSendParams,
  TaskSendResult,
  TaskSendSubscribeParams,
  TaskGetParams,
  TaskGetResult,
  TaskCancelParams,
  TaskCancelResult,
  PushNotificationGetParams,
  PushNotificationGetResult,
  PushNotificationSetParams,
  PushNotificationSetResult,
  TaskResubscribeParams,
  
  // Streaming types
  StreamEvent,
  TaskStatusEvent,
  TaskArtifactEvent,
  TaskOutputEvent,
  ErrorEvent,
  DoneEvent,
  
  // Config types
  A2AClientConfig,
  A2AAuthConfig,
  AuthScheme,
  
  // Event types
  ClientEventType,
  ClientEvent,
  
  // Utility types
  A2AMethod,
  Session
} from './types';

// ============================================================================
// A2A Client Class
// ============================================================================

/**
 * A2A Client for agent-to-agent communication.
 * 
 * @example
 * ```typescript
 * const client = new A2AClient({
 *   agentCard: 'https://agent.example.com/.well-known/agent.json',
 *   auth: { scheme: 'Bearer', token: 'your-token' }
 * });
 * 
 * await client.connect();
 * 
 * // Send a task
 * const task = await client.sendTask({
 *   input: {
 *     message: {
 *       role: 'user',
 *       parts: [{ type: 'text', text: 'Hello, agent!' }]
 *     }
 *   }
 * });
 * 
 * // Wait for completion
 * const completed = await client.waitForCompletion(task.id);
 * ```
 */
export class A2AClient extends EventEmitter {
  private config: A2AClientConfig;
  private agentCard?: AgentCard;
  private connected: boolean = false;
  private sessions: Map<string, Session> = new Map();
  private pendingRequests: Map<JsonRpcId, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }> = new Map();
  private requestId: number = 0;
  
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
  }
  
  // ============================================================================
  // Connection Management
  // ============================================================================
  
  /**
   * Connect to the A2A agent.
   * Fetches and validates the agent card.
   */
  async connect(): Promise<AgentCard> {
    if (this.connected && this.agentCard) {
      return this.agentCard;
    }
    
    try {
      // Resolve agent card
      if (typeof this.config.agentCard === 'string') {
        this.agentCard = await this.fetchAgentCard(this.config.agentCard);
      } else {
        this.agentCard = this.config.agentCard;
      }
      
      // Validate agent card
      this.validateAgentCard(this.agentCard);
      
      this.connected = true;
      this.emitEvent('connected', { agentCard: this.agentCard });
      this.log('info', `Connected to agent: ${this.agentCard.name}`);
      
      return this.agentCard;
    } catch (error) {
      this.emitEvent('error', { error });
      throw error;
    }
  }
  
  /**
   * Disconnect from the A2A agent.
   */
  disconnect(): void {
    this.connected = false;
    this.agentCard = undefined;
    this.sessions.clear();
    this.emitEvent('disconnected', {});
  }
  
  /**
   * Check if client is connected.
   */
  isConnected(): boolean {
    return this.connected && !!this.agentCard;
  }
  
  /**
   * Get the current agent card.
   */
  getAgentCard(): AgentCard | undefined {
    return this.agentCard;
  }
  
  /**
   * Get agent capabilities.
   */
  getCapabilities(): AgentCapabilities | undefined {
    return this.agentCard?.capabilities;
  }
  
  /**
   * Get agent skills.
   */
  getSkills(): AgentSkill[] {
    return this.agentCard?.skills || [];
  }
  
  // ============================================================================
  // Task Operations
  // ============================================================================
  
  /**
   * Send a task to the agent.
   */
  async sendTask(params: TaskSendParams): Promise<Task> {
    this.ensureConnected();
    
    const result = await this.rpc<TaskSendResult>('tasks/send', params);
    
    // Track session
    if (result.task.sessionId) {
      this.trackSession(result.task.sessionId, result.task.id);
    }
    
    this.emitEvent('task-created', { task: result.task });
    return result.task;
  }
  
  /**
   * Send a task with streaming response.
   */
  async *sendTaskStream(params: TaskSendParams): AsyncGenerator<StreamEvent, Task, undefined> {
    this.ensureConnected();
    
    if (!this.agentCard?.capabilities?.streaming) {
      throw new A2AError(
        A2A_ERROR_CODES.UNSUPPORTED_OPERATION,
        'Agent does not support streaming'
      );
    }
    
    const streamParams: TaskSendSubscribeParams = {
      ...params,
      stream: true
    };
    
    const response = await this.streamRpc('tasks/sendSubscribe', streamParams);
    
    this.emitEvent('stream-start', { params: streamParams });
    
    let finalTask: Task | undefined;
    
    for await (const event of this.parseStreamEvents(response)) {
      this.emitEvent('stream-event', { event });
      yield event;
      
      if (event.type === 'done') {
        finalTask = event.task;
      }
    }
    
    this.emitEvent('stream-end', { task: finalTask });
    
    if (!finalTask) {
      throw new A2AError(A2A_ERROR_CODES.INTERNAL_ERROR, 'Stream ended without final task');
    }
    
    return finalTask;
  }
  
  /**
   * Get task status.
   */
  async getTask(taskId: string, includeHistory?: boolean): Promise<Task> {
    this.ensureConnected();
    
    const params: TaskGetParams = {
      id: taskId,
      includeHistory
    };
    
    const result = await this.rpc<TaskGetResult>('tasks/get', params);
    return result.task;
  }
  
  /**
   * Cancel a task.
   */
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
  
  /**
   * Resubscribe to a streaming task.
   */
  async *resubscribeTask(taskId: string): AsyncGenerator<StreamEvent, Task, undefined> {
    this.ensureConnected();
    
    const params: TaskResubscribeParams = {
      id: taskId
    };
    
    const response = await this.streamRpc('tasks/resubscribe', params);
    
    let finalTask: Task | undefined;
    
    for await (const event of this.parseStreamEvents(response)) {
      yield event;
      
      if (event.type === 'done') {
        finalTask = event.task;
      }
    }
    
    if (!finalTask) {
      throw new A2AError(A2A_ERROR_CODES.INTERNAL_ERROR, 'Stream ended without final task');
    }
    
    return finalTask;
  }
  
  /**
   * Wait for task completion.
   */
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
  
  // ============================================================================
  // Push Notification Operations
  // ============================================================================
  
  /**
   * Get push notification configuration for a task.
   */
  async getPushNotificationConfig(taskId: string): Promise<PushNotificationConfig | null> {
    this.ensureConnected();
    
    if (!this.agentCard?.capabilities?.pushNotifications) {
      throw new A2AError(
        A2A_ERROR_CODES.PUSH_NOTIFICATION_NOT_SUPPORTED,
        'Agent does not support push notifications'
      );
    }
    
    const params: PushNotificationGetParams = { id: taskId };
    const result = await this.rpc<PushNotificationGetResult>('tasks/pushNotification/get', params);
    return result.config;
  }
  
  /**
   * Set push notification configuration for a task.
   */
  async setPushNotificationConfig(
    taskId: string,
    config: PushNotificationConfig
  ): Promise<PushNotificationConfig> {
    this.ensureConnected();
    
    if (!this.agentCard?.capabilities?.pushNotifications) {
      throw new A2AError(
        A2A_ERROR_CODES.PUSH_NOTIFICATION_NOT_SUPPORTED,
        'Agent does not support push notifications'
      );
    }
    
    const params: PushNotificationSetParams = {
      id: taskId,
      config
    };
    
    const result = await this.rpc<PushNotificationSetResult>('tasks/pushNotification/set', params);
    return result.config;
  }
  
  // ============================================================================
  // Session Management
  // ============================================================================
  
  /**
   * Get session by ID.
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }
  
  /**
   * Get all sessions.
   */
  getSessions(): Session[] {
    return Array.from(this.sessions.values());
  }
  
  /**
   * Clear session tracking.
   */
  clearSessions(): void {
    this.sessions.clear();
  }
  
  // ============================================================================
  // Helper Methods
  // ============================================================================
  
  /**
   * Create a text message.
   */
  static createTextMessage(text: string, role: MessageRole = 'user'): Message {
    return {
      role,
      parts: [{ type: 'text', text }]
    };
  }
  
  /**
   * Create a file message.
   */
  static createFileMessage(
    file: { name?: string; mimeType?: string; uri?: string; bytes?: string },
    role: MessageRole = 'user'
  ): Message {
    return {
      role,
      parts: [{ type: 'file', file }]
    };
  }
  
  /**
   * Create a data message.
   */
  static createDataMessage(
    data: Record<string, unknown>,
    role: MessageRole = 'user'
  ): Message {
    return {
      role,
      parts: [{ type: 'data', data }]
    };
  }
  
  /**
   * Create task input from text.
   */
  static createTextInput(text: string, skillId?: string): TaskInput {
    return {
      message: A2AClient.createTextMessage(text),
      skillId
    };
  }
  
  /**
   * Extract text from message parts.
   */
  static extractText(parts: ContentPart[]): string {
    return parts
      .filter((p): p is TextPart => p.type === 'text')
      .map(p => p.text)
      .join('\n');
  }
  
  /**
   * Extract data from message parts.
   */
  static extractData(parts: ContentPart[]): Record<string, unknown>[] {
    return parts
      .filter((p): p is DataPart => p.type === 'data')
      .map(p => p.data);
  }
  
  // ============================================================================
  // Private Methods - HTTP/RPC
  // ============================================================================
  
  /**
   * Make RPC call.
   */
  private async rpc<T>(method: A2AMethod, params?: unknown): Promise<T> {
    const request = this.createRequest(method, params);
    const response = await this.httpRequest<JsonRpcResponse<T>>(request);
    
    if (response.error) {
      throw new A2AError(response.error.code, response.error.message, response.error.data);
    }
    
    return response.result as T;
  }
  
  /**
   * Make streaming RPC call.
   */
  private async streamRpc(method: A2AMethod, params?: unknown): Promise<ReadableStream<Uint8Array>> {
    const request = this.createRequest(method, params);
    
    const response = await this.fetchWithRetry(this.agentCard!.url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(request)
    });
    
    if (!response.ok) {
      throw new A2AError(
        A2A_ERROR_CODES.INTERNAL_ERROR,
        `HTTP error: ${response.status} ${response.statusText}`
      );
    }
    
    if (!response.body) {
      throw new A2AError(A2A_ERROR_CODES.INTERNAL_ERROR, 'No response body for streaming');
    }
    
    return response.body;
  }
  
  /**
   * Parse stream events from response body.
   */
  private async *parseStreamEvents(stream: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        
        // Parse newline-delimited JSON
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const event = JSON.parse(line) as StreamEvent;
              yield event;
            } catch (e) {
              this.log('error', `Failed to parse stream event: ${line}`);
            }
          }
        }
      }
      
      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer) as StreamEvent;
          yield event;
        } catch (e) {
          this.log('error', `Failed to parse final stream event: ${buffer}`);
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
  
  /**
   * Create JSON-RPC request.
   */
  private createRequest(method: string, params?: unknown): JsonRpcRequest {
    return {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method,
      params
    };
  }
  
  /**
   * Make HTTP request with retry.
   */
  private async httpRequest<T>(request: JsonRpcRequest): Promise<T> {
    const response = await this.fetchWithRetry(this.agentCard!.url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(request)
    });
    
    if (!response.ok) {
      throw new A2AError(
        A2A_ERROR_CODES.INTERNAL_ERROR,
        `HTTP error: ${response.status} ${response.statusText}`
      );
    }
    
    return response.json() as Promise<T>;
  }
  
  /**
   * Fetch with retry logic.
   */
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
        
        // Don't retry on client errors
        if (response.status >= 400 && response.status < 500) {
          return response;
        }
        
        // Retry on server errors
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
    
    throw lastError || new Error('Request failed after retries');
  }
  
  /**
   * Build HTTP headers.
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      ...this.config.headers
    };
    
    // Add auth header
    if (this.config.auth) {
      const authHeader = this.buildAuthHeader(this.config.auth);
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }
    }
    
    return headers;
  }
  
  /**
   * Build authorization header.
   */
  private buildAuthHeader(auth: A2AAuthConfig): string | undefined {
    switch (auth.scheme) {
      case 'Bearer':
        return auth.token ? `Bearer ${auth.token}` : undefined;
      
      case 'Basic':
        if (auth.username && auth.password) {
          const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
          return `Basic ${credentials}`;
        }
        return undefined;
      
      case 'APIKey':
        return auth.apiKey;
      
      case 'Custom':
        return auth.customValue;
      
      default:
        return undefined;
    }
  }
  
  // ============================================================================
  // Private Methods - Agent Card
  // ============================================================================
  
  /**
   * Fetch agent card from URL.
   */
  private async fetchAgentCard(url: string): Promise<AgentCard> {
    // If URL doesn't end with agent.json, try well-known location
    const cardUrl = url.endsWith('.json') 
      ? url 
      : `${url.replace(/\/$/, '')}/.well-known/agent.json`;
    
    const response = await this.fetchWithRetry(cardUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new A2AError(
        A2A_ERROR_CODES.INVALID_AGENT_CARD,
        `Failed to fetch agent card: ${response.status}`
      );
    }
    
    return response.json() as Promise<AgentCard>;
  }
  
  /**
   * Validate agent card.
   */
  private validateAgentCard(card: AgentCard): void {
    if (!card.name) {
      throw new A2AError(A2A_ERROR_CODES.INVALID_AGENT_CARD, 'Agent card missing name');
    }
    
    if (!card.url) {
      throw new A2AError(A2A_ERROR_CODES.INVALID_AGENT_CARD, 'Agent card missing url');
    }
    
    // Validate URL format
    try {
      new URL(card.url);
    } catch {
      throw new A2AError(A2A_ERROR_CODES.INVALID_AGENT_CARD, 'Agent card has invalid url');
    }
  }
  
  // ============================================================================
  // Private Methods - Utility
  // ============================================================================
  
  /**
   * Ensure client is connected.
   */
  private ensureConnected(): void {
    if (!this.connected || !this.agentCard) {
      throw new A2AError(A2A_ERROR_CODES.INTERNAL_ERROR, 'Client not connected');
    }
  }
  
  /**
   * Track session.
   */
  private trackSession(sessionId: string, taskId: string): void {
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      session = {
        id: sessionId,
        taskIds: [],
        createdAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString()
      };
      this.sessions.set(sessionId, session);
    }
    
    if (!session.taskIds.includes(taskId)) {
      session.taskIds.push(taskId);
    }
    
    session.lastActivityAt = new Date().toISOString();
  }
  
  /**
   * Check if task state is terminal.
   */
  private isTerminalState(state: TaskState): boolean {
    return ['completed', 'failed', 'canceled'].includes(state);
  }
  
  /**
   * Sleep for specified duration.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Log message.
   */
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
  
  /**
   * Emit client event.
   */
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

// ============================================================================
// A2A Error Class
// ============================================================================

/**
 * A2A-specific error class.
 */
export class A2AError extends Error {
  code: number;
  data?: unknown;
  
  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = 'A2AError';
    this.code = code;
    this.data = data;
  }
  
  toJsonRpcError(): JsonRpcError {
    return {
      code: this.code,
      message: this.message,
      data: this.data
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new A2A client.
 */
export function createA2AClient(config: A2AClientConfig): A2AClient {
  return new A2AClient(config);
}

/**
 * Create a client from agent card URL.
 */
export async function connectToAgent(
  url: string,
  auth?: A2AAuthConfig
): Promise<A2AClient> {
  const client = new A2AClient({ agentCard: url, auth });
  await client.connect();
  return client;
}

// ============================================================================
// Exports
// ============================================================================

export default A2AClient;

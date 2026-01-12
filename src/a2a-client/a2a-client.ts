/**
 * A2A (Agent-to-Agent) Client Implementation
 * 
 * Client for communicating with A2A-compliant agents.
 * Supports task submission, streaming, and push notifications.
 * 
 * @module a2a-client/a2a-client
 * @version 1.1.0
 * @see https://google.github.io/A2A/
 * 
 * Phase 1 Improvements (2026-01-11):
 * - Browser compatibility: Replaced Buffer.from() with cross-platform encoding
 * - Runtime validation: Added Zod schema validation for stream events
 * - Memory management: Added session cleanup with TTL and max limits
 * - Error handling: Added cause chain support to A2AError
 */

import { EventEmitter } from 'events';
import { encodeBasicAuth } from '../shared/encoding';
import {
  parseStreamEvent,
  ValidatedStreamEvent
} from './schemas';
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
// Session Management Constants
// ============================================================================

/** Maximum number of sessions to track */
const MAX_SESSIONS = 1000;

/** Session time-to-live in milliseconds (24 hours) */
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/** Session cleanup interval in milliseconds (1 hour) */
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

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
  
  /** Timer for periodic session cleanup */
  private cleanupTimer?: ReturnType<typeof setInterval>;
  
  /** Statistics for monitoring */
  private stats = {
    sessionsCreated: 0,
    sessionsEvicted: 0,
    streamEventsReceived: 0,
    streamEventsInvalid: 0
  };
  
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
    
    // Start session cleanup timer
    this.startSessionCleanup();
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
      throw A2AError.from(error, A2A_ERROR_CODES.INTERNAL_ERROR);
    }
  }
  
  /**
   * Disconnect from the A2A agent.
   */
  disconnect(): void {
    // Stop cleanup timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    
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
  
  /**
   * Get client statistics.
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
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
   * Now includes runtime validation of stream events.
   */
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
    
    const finalTask = yield* this.streamEventsWithFinal(response);
    
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
    
    this.ensureCapabilityEnabled(
      this.agentCard?.capabilities?.pushNotifications,
      A2A_ERROR_CODES.PUSH_NOTIFICATION_NOT_SUPPORTED,
      'Agent does not support push notifications'
    );
    
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
  
  /**
   * Get current session count.
   */
  getSessionCount(): number {
    return this.sessions.size;
  }
  
  // ============================================================================
  // Session Cleanup (Phase 1 Fix: Memory Management)
  // ============================================================================
  
  /**
   * Start periodic session cleanup.
   * Runs every hour to remove expired sessions and enforce max limit.
   */
  private startSessionCleanup(): void {
    this.cleanupTimer = setInterval(
      () => this.cleanupSessions(),
      CLEANUP_INTERVAL_MS
    );
    
    // Don't prevent process exit in Node.js
    if (typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
      this.cleanupTimer.unref();
    }
  }
  
  /**
   * Clean up expired sessions and enforce max session limit.
   * Uses LRU eviction when over the limit.
   */
  private cleanupSessions(): void {
    const now = Date.now();
    const expiredIds = [...this.sessions.entries()]
      .filter(([, session]) => now - new Date(session.lastActivityAt).getTime() > SESSION_TTL_MS)
      .map(([id]) => id);
    
    this.evictSessions(expiredIds);
    
    // Enforce max sessions using LRU eviction
    if (this.sessions.size > MAX_SESSIONS) {
      const sorted = [...this.sessions.entries()]
        .sort((a, b) =>
          new Date(a[1].lastActivityAt).getTime() -
          new Date(b[1].lastActivityAt).getTime()
        );
      
      const overflow = this.sessions.size - MAX_SESSIONS;
      const lruIds = sorted.slice(0, overflow).map(([id]) => id);
      this.evictSessions(lruIds);
    }
    
    if (expiredIds.length > 0) {
      this.log('debug', `Cleaned up ${expiredIds.length} expired sessions`);
      this.emitEvent('sessions-cleaned', { 
        expired: expiredIds.length, 
        remaining: this.sessions.size 
      });
    }
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
    const response = await this.httpRequest<JsonRpcResponse<T>>(this.createRequest(method, params));
    
    if (response.error) {
      throw new A2AError(response.error.code, response.error.message, response.error.data);
    }
    
    return response.result as T;
  }
  
  /**
   * Make streaming RPC call.
   */
  private async streamRpc(method: A2AMethod, params?: unknown): Promise<ReadableStream<Uint8Array>> {
    const response = await this.postRequest(this.createRequest(method, params));
    
    if (!response.body) {
      throw new A2AError(A2A_ERROR_CODES.INTERNAL_ERROR, 'No response body for streaming');
    }
    
    return response.body;
  }
  
  /**
   * Parse stream events from response body.
   * Now includes Zod schema validation for security.
   */
  private async *parseStreamEvents(stream: ReadableStream<Uint8Array>): AsyncGenerator<ValidatedStreamEvent> {
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
            const event = this.parseAndValidateEvent(line);
            if (event) {
              yield event;
            }
          }
        }
      }
      
      // Process remaining buffer
      if (buffer.trim()) {
        const event = this.parseAndValidateEvent(buffer);
        if (event) {
          yield event;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async *streamEventsWithFinal(
    stream: ReadableStream<Uint8Array>,
    onEvent?: (event: ValidatedStreamEvent) => void
  ): AsyncGenerator<StreamEvent, Task, undefined> {
    let finalTask: Task | undefined;

    for await (const event of this.parseStreamEvents(stream)) {
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
  
  /**
   * Parse and validate a single stream event.
   * Returns null if validation fails (with error emitted).
   */
  private parseAndValidateEvent(line: string): ValidatedStreamEvent | null {
    this.stats.streamEventsReceived++;
    
    try {
      const parsed = JSON.parse(line);
      const result = parseStreamEvent(parsed);
      
      if (result.success && result.data) {
        return result.data;
      }
      
      // Validation failed - emit error event
      this.stats.streamEventsInvalid++;
      this.log('error', `Invalid stream event schema: ${result.error?.message}`);
      this.emitEvent('stream-validation-error', {
        error: result.error,
        rawData: line
      });
      
      return null;
    } catch (e) {
      // JSON parse failed
      this.stats.streamEventsInvalid++;
      this.log('error', `Failed to parse stream event JSON: ${line}`);
      this.emitEvent('stream-parse-error', {
        error: e,
        rawData: line
      });
      
      return null;
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
    const response = await this.postRequest(request);
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
    
    throw A2AError.from(lastError, A2A_ERROR_CODES.INTERNAL_ERROR);
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
   * Uses cross-platform Base64 encoding for browser compatibility.
   */
  private buildAuthHeader(auth: A2AAuthConfig): string | undefined {
    switch (auth.scheme) {
      case 'Bearer':
        return auth.token ? `Bearer ${auth.token}` : undefined;
      
      case 'Basic':
        if (auth.username && auth.password) {
          // Use cross-platform encoding (Phase 1 Fix)
          const credentials = encodeBasicAuth(auth.username, auth.password);
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

  private ensureCapabilityEnabled(
    capability: boolean | undefined,
    code: number,
    message: string
  ): void {
    if (!capability) {
      throw new A2AError(code, message);
    }
  }
  
  /**
   * Track session.
   */
  private trackSession(sessionId: string, taskId: string): void {
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      const now = this.nowIso();
      session = {
        id: sessionId,
        taskIds: [],
        createdAt: now,
        lastActivityAt: now
      };
      this.sessions.set(sessionId, session);
      this.stats.sessionsCreated++;
    }
    
    if (!session.taskIds.includes(taskId)) {
      session.taskIds.push(taskId);
    }
    
    session.lastActivityAt = this.nowIso();
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
  
  private evictSessions(ids: string[]): void {
    for (const id of ids) {
      if (this.sessions.delete(id)) {
        this.stats.sessionsEvicted++;
      }
    }
  }

  private nowIso(): string {
    return new Date().toISOString();
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
// A2A Error Class (Phase 1 Fix: Error Cause Chain)
// ============================================================================

/**
 * A2A-specific error class with cause chain support.
 * 
 * Supports ES2022 error cause for better debugging:
 * ```typescript
 * try {
 *   await client.sendTask(params);
 * } catch (error) {
 *   if (error instanceof A2AError) {
 *     console.log('Cause:', error.cause); // Original error
 *   }
 * }
 * ```
 */
export class A2AError extends Error {
  readonly code: number;
  readonly data?: unknown;
  
  constructor(
    code: number,
    message: string,
    data?: unknown,
    options?: { cause?: Error }
  ) {
    // TypeScript target might be older than ES2022, so we handle cause manually if needed
    // but for now we'll just pass message to super() to fix the TS2554 error
    // assuming the environment might not support the options argument in Error constructor
    super(message);
    this.name = 'A2AError';
    this.code = code;
    this.data = data;
    
    // Manually set cause if provided and supported
    if (options?.cause) {
      (this as any).cause = options.cause;
    }
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, A2AError.prototype);
  }
  
  /**
   * Convert to JSON-RPC error format.
   */
  toJsonRpcError(): JsonRpcError {
    return {
      code: this.code,
      message: this.message,
      data: this.data
    };
  }
  
  /**
   * Create A2AError from unknown error.
   * Preserves the original error as the cause.
   * 
   * @param error - The original error
   * @param code - Optional error code (defaults to INTERNAL_ERROR)
   * @returns A2AError instance
   */
  static from(error: unknown, code?: number): A2AError {
    // Already an A2AError - return as-is
    if (error instanceof A2AError) {
      return error;
    }
    
    // Standard Error - wrap with cause
    if (error instanceof Error) {
      return new A2AError(
        code ?? A2A_ERROR_CODES.INTERNAL_ERROR,
        error.message,
        undefined,
        { cause: error }
      );
    }
    
    // Unknown type - convert to string
    return new A2AError(
      code ?? A2A_ERROR_CODES.INTERNAL_ERROR,
      String(error)
    );
  }
  
  /**
   * Check if an error is an A2AError.
   */
  static isA2AError(error: unknown): error is A2AError {
    return error instanceof A2AError;
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

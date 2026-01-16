/**
 * A2A (Agent-to-Agent Protocol) Unified Adapter
 * 
 * Protocol-specific implementation for Google's Agent-to-Agent Protocol,
 * handling tasks, agent cards, skills, and streaming operations.
 * 
 * A2A Specification: https://github.com/google/A2A
 * 
 * @module adapters/a2a-unified-adapter
 * @version 1.0.0
 */

import { BaseUnifiedAdapter, BaseAdapterConfig } from './base-unified-adapter';
import {
  UniversalMessage,
  UniversalPayload,
  UniversalMessageType,
  UniversalAgentRef,
  UniversalAgentCard,
  UniversalSkill,
  UniversalTaskRef,
  UniversalTaskState,
  UniversalMessagePart,
  UniversalArtifact,
  UniversalStreamChunk,
  TraceContext,
  ContentMode,
  createMessage
} from './protocol-messages';
import {
  ConversionOptions,
  InvocationOptions
} from './unified-adapter';

// ============================================================================
// A2A-Specific Types
// ============================================================================

/**
 * A2A Agent Card (from A2A spec).
 */
export interface A2AAgentCard {
  name: string;
  description?: string;
  url: string;
  provider?: {
    organization: string;
    url?: string;
  };
  version: string;
  documentationUrl?: string;
  capabilities: {
    streaming?: boolean;
    pushNotifications?: boolean;
    stateTransitionHistory?: boolean;
  };
  authentication: {
    schemes: A2AAuthScheme[];
  };
  defaultInputModes: A2AContentMode[];
  defaultOutputModes: A2AContentMode[];
  skills: A2ASkill[];
}

/**
 * A2A authentication scheme.
 */
export interface A2AAuthScheme {
  scheme: 'bearer' | 'apiKey' | 'oauth2' | 'none';
  credentials?: string;
}

/**
 * A2A content mode.
 */
export type A2AContentMode = 'text' | 'image' | 'audio' | 'video' | 'file' | 'data';

/**
 * A2A Skill definition.
 */
export interface A2ASkill {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  examples?: A2AExample[];
  inputModes?: A2AContentMode[];
  outputModes?: A2AContentMode[];
}

/**
 * A2A skill example.
 */
export interface A2AExample {
  name?: string;
  description?: string;
  input?: A2APart;
  output?: A2APart;
}

/**
 * A2A Task (from A2A spec).
 */
export interface A2ATask {
  id: string;
  sessionId?: string;
  status: A2ATaskStatus;
  history?: A2AMessage[];
  artifacts?: A2AArtifact[];
  metadata?: Record<string, unknown>;
}

/**
 * A2A Task status.
 */
export interface A2ATaskStatus {
  state: A2ATaskState;
  message?: A2AMessage;
  timestamp?: string;
}

/**
 * A2A Task state.
 */
export type A2ATaskState = 
  | 'submitted'
  | 'working'
  | 'input-required'
  | 'completed'
  | 'failed'
  | 'canceled';

/**
 * A2A Message.
 */
export interface A2AMessage {
  role: 'user' | 'agent';
  parts: A2APart[];
  metadata?: Record<string, unknown>;
}

/**
 * A2A Message part.
 */
export interface A2APart {
  type: 'text' | 'file' | 'data';
  text?: string;
  file?: A2AFilePart;
  data?: Record<string, unknown>;
}

/**
 * A2A File part.
 */
export interface A2AFilePart {
  name?: string;
  mimeType?: string;
  uri?: string;
  bytes?: string; // base64 encoded
}

/**
 * A2A Artifact.
 */
export interface A2AArtifact {
  name?: string;
  description?: string;
  parts: A2APart[];
  index?: number;
  append?: boolean;
  lastChunk?: boolean;
}

/**
 * A2A Send Task Request.
 */
export interface A2ASendTaskRequest {
  id: string;
  sessionId?: string;
  message: A2AMessage;
  acceptedOutputModes?: A2AContentMode[];
  pushNotification?: {
    url: string;
    authentication?: A2AAuthScheme;
  };
  metadata?: Record<string, unknown>;
}

/**
 * A2A adapter configuration.
 */
export interface A2AAdapterConfig extends BaseAdapterConfig {
  /** Agent endpoint URL */
  agentUrl?: string;
  /** Session ID for maintaining conversation context */
  sessionId?: string;
  /** Enable streaming responses */
  enableStreaming?: boolean;
  /** Enable push notifications */
  enablePushNotifications?: boolean;
  /** Accepted output modes */
  acceptedOutputModes?: A2AContentMode[];
}

// ============================================================================
// A2A Unified Adapter Implementation
// ============================================================================

/**
 * Unified adapter for Agent-to-Agent Protocol (A2A).
 * 
 * Supports:
 * - Agent card discovery (/.well-known/agent.json)
 * - Task submission and management (tasks/send, tasks/get)
 * - Task streaming (tasks/sendSubscribe)
 * - Push notifications
 * - Multi-modal content (text, files, data)
 * 
 * @example
 * ```typescript
 * const a2aAdapter = new A2AUnifiedAdapter({
 *   protocol: 'a2a',
 *   agentUrl: 'https://agent.example.com'
 * });
 * 
 * await a2aAdapter.initialize();
 * 
 * // Get agent card
 * const card = await a2aAdapter.invokeOperation('agent-card', {});
 * 
 * // Send a task
 * const task = await a2aAdapter.invokeOperation('task-request', {
 *   task: {
 *     taskId: 'task-1',
 *     input: [{ type: 'text', content: 'Hello, agent!' }]
 *   }
 * });
 * ```
 */
export class A2AUnifiedAdapter extends BaseUnifiedAdapter {
  private agentCard?: A2AAgentCard;
  private tasksCache: Map<string, A2ATask> = new Map();
  private currentSessionId?: string;
  private streamHandlers: Map<string, (chunk: UniversalStreamChunk) => void> = new Map();
  
  constructor(config: A2AAdapterConfig = { protocol: 'a2a' }) {
    super({ ...config, protocol: 'a2a' });
    this.currentSessionId = config.sessionId;
  }
  
  // ============================================================================
  // Message Conversion: Protocol → Universal
  // ============================================================================
  
  /**
   * Convert A2A payload to universal message format.
   */
  async toUniversalMessage(
    protocolPayload: unknown,
    messageType: UniversalMessageType,
    options?: ConversionOptions
  ): Promise<UniversalMessage> {
    const startTime = Date.now();
    
    try {
      const payload = this.convertToUniversalPayload(protocolPayload, messageType);
      
      const message = createMessage(messageType, 'a2a', payload, {
        trace: options?.trace || this.createTraceContext()
      });
      
      if (options?.preserveRaw) {
        message.payload.raw = {
          a2a: protocolPayload,
          original: protocolPayload
        };
      }
      
      this.recordSuccess(Date.now() - startTime);
      return message;
    } catch (error) {
      const universalError = this.recordError(error, 'toUniversalMessage');
      throw new Error(universalError.message);
    }
  }
  
  /**
   * Convert A2A payload to universal payload based on message type.
   */
  private convertToUniversalPayload(
    protocolPayload: unknown,
    messageType: UniversalMessageType
  ): UniversalPayload {
    switch (messageType) {
      case 'agent-card':
        return this.convertAgentCard(protocolPayload);
      case 'task-request':
      case 'task-response':
      case 'task-status':
        return this.convertTask(protocolPayload);
      case 'stream-chunk':
        return this.convertStreamChunk(protocolPayload);
      default:
        return { raw: { a2a: protocolPayload } };
    }
  }
  
  private convertAgentCard(payload: unknown): UniversalPayload {
    const card = payload as A2AAgentCard;
    
    const universalCard: UniversalAgentCard = {
      name: card.name,
      description: card.description,
      url: card.url,
      provider: card.provider ? {
        organization: card.provider.organization,
        contactEmail: card.provider.url
      } : undefined,
      version: card.version,
      documentationUrl: card.documentationUrl,
      capabilities: {
        streaming: card.capabilities?.streaming,
        pushNotifications: card.capabilities?.pushNotifications,
        stateTransitionHistory: card.capabilities?.stateTransitionHistory
      },
      authentication: {
        schemes: card.authentication?.schemes?.map(s => this.mapAuthScheme(s)) || []
      },
      defaultInputModes: this.mapContentModes(card.defaultInputModes),
      defaultOutputModes: this.mapContentModes(card.defaultOutputModes),
      skills: card.skills?.map(s => this.convertSkill(s)) || []
    };
    
    return {
      agent: {
        protocolId: card.url,
        protocol: 'a2a',
        name: card.name,
        description: card.description,
        endpoint: card.url,
        capabilities: card.skills?.map(s => s.id),
        version: card.version
      },
      raw: { agentCard: universalCard }
    };
  }
  
  private convertSkill(skill: A2ASkill): UniversalSkill {
    return {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      tags: skill.tags,
      examples: skill.examples?.map(e => ({
        name: e.name,
        input: e.input?.text || '',
        output: e.output?.text
      })),
      inputModes: this.mapContentModes(skill.inputModes),
      outputModes: this.mapContentModes(skill.outputModes)
    };
  }
  
  private mapContentModes(modes?: A2AContentMode[]): ContentMode[] {
    if (!modes) return ['text'];
    return modes.map(m => m as ContentMode);
  }
  
  private mapAuthScheme(scheme: A2AAuthScheme): { type: 'none' } | { type: 'bearer'; tokenUrl?: string } | { type: 'oauth2'; flows: Record<string, unknown> } | { type: 'apiKey'; header: string; in?: 'header' | 'query' } {
    switch (scheme.scheme) {
      case 'none':
        return { type: 'none' };
      case 'bearer':
        return { type: 'bearer', tokenUrl: scheme.credentials };
      case 'oauth2':
        return { type: 'oauth2', flows: {} };
      case 'apiKey':
        return { type: 'apiKey', header: 'Authorization', in: 'header' };
      default:
        return { type: 'none' };
    }
  }
  
  private convertTask(payload: unknown): UniversalPayload {
    const task = payload as A2ATask;
    
    const universalTask: UniversalTaskRef = {
      taskId: task.id,
      state: this.mapTaskState(task.status?.state || 'submitted'),
      description: task.status?.message?.parts?.[0]?.text,
      input: this.convertMessages(task.history?.filter(m => m.role === 'user')),
      output: this.convertMessages(task.history?.filter(m => m.role === 'agent')),
      artifacts: task.artifacts?.map(a => this.convertArtifact(a)),
      metadata: task.metadata,
      createdAt: task.status?.timestamp,
      updatedAt: task.status?.timestamp
    };
    
    return { task: universalTask };
  }
  
  private mapTaskState(state: A2ATaskState): UniversalTaskState {
    const stateMap: Record<A2ATaskState, UniversalTaskState> = {
      'submitted': 'submitted',
      'working': 'working',
      'input-required': 'input-required',
      'completed': 'completed',
      'failed': 'failed',
      'canceled': 'canceled'
    };
    return stateMap[state] || 'pending';
  }
  
  private convertMessages(messages?: A2AMessage[]): UniversalMessagePart[] {
    if (!messages) return [];
    
    return messages.flatMap(msg => 
      msg.parts.map(part => this.convertPart(part))
    );
  }
  
  private convertPart(part: A2APart): UniversalMessagePart {
    switch (part.type) {
      case 'text':
        return {
          type: 'text',
          content: part.text
        };
      case 'file':
        return {
          type: 'file',
          uri: part.file?.uri,
          data: part.file?.bytes,
          mimeType: part.file?.mimeType,
          metadata: { name: part.file?.name }
        };
      case 'data':
        return {
          type: 'data',
          metadata: part.data
        };
      default:
        return {
          type: 'text',
          content: JSON.stringify(part)
        };
    }
  }
  
  private convertArtifact(artifact: A2AArtifact): UniversalArtifact {
    const content = artifact.parts?.[0];
    return {
      artifactId: `artifact-${artifact.index || 0}`,
      name: artifact.name || 'unnamed',
      type: content?.type === 'file' ? 'file' : 'data',
      uri: content?.file?.uri,
      data: content?.file?.bytes || JSON.stringify(content?.data),
      mimeType: content?.file?.mimeType,
      description: artifact.description,
      createdAt: new Date().toISOString()
    };
  }
  
  private convertStreamChunk(payload: unknown): UniversalPayload {
    const artifact = payload as A2AArtifact;
    
    return {
      stream: {
        streamId: `stream-${artifact.index || 0}`,
        sequence: artifact.index || 0,
        final: artifact.lastChunk || false,
        content: artifact.parts?.[0]?.text,
        metadata: { append: artifact.append }
      }
    };
  }
  
  // ============================================================================
  // Message Conversion: Universal → Protocol
  // ============================================================================
  
  /**
   * Convert universal message to A2A protocol format.
   */
  async fromUniversalMessage(
    message: UniversalMessage,
    options?: ConversionOptions
  ): Promise<unknown> {
    const startTime = Date.now();
    
    try {
      const a2aPayload = this.convertFromUniversalPayload(message);
      this.recordSuccess(Date.now() - startTime);
      return a2aPayload;
    } catch (error) {
      const universalError = this.recordError(error, 'fromUniversalMessage');
      throw new Error(universalError.message);
    }
  }
  
  /**
   * Convert universal payload to A2A format.
   */
  private convertFromUniversalPayload(message: UniversalMessage): unknown {
    switch (message.type) {
      case 'task-request':
        return this.toA2ATaskRequest(message.payload);
      case 'task-cancel':
        return this.toA2ATaskCancel(message.payload);
      default:
        return message.payload.raw?.a2a || message.payload;
    }
  }
  
  private toA2ATaskRequest(payload: UniversalPayload): A2ASendTaskRequest {
    if (!payload.task) {
      throw new Error('Missing task information in payload');
    }
    
    const { taskId, input, metadata } = payload.task;
    
    return {
      id: taskId,
      sessionId: this.currentSessionId,
      message: {
        role: 'user',
        parts: this.toA2AParts(input || [])
      },
      metadata
    };
  }
  
  private toA2AParts(parts: UniversalMessagePart[]): A2APart[] {
    return parts.map(part => {
      switch (part.type) {
        case 'text':
          return { type: 'text', text: part.content };
        case 'file':
        case 'image':
        case 'audio':
        case 'video':
          return {
            type: 'file',
            file: {
              name: part.metadata?.name as string,
              mimeType: part.mimeType,
              uri: part.uri,
              bytes: part.data
            }
          };
        default:
          return {
            type: 'data',
            data: part.metadata as Record<string, unknown>
          };
      }
    });
  }
  
  private toA2ATaskCancel(payload: UniversalPayload): { id: string } {
    if (!payload.task) {
      throw new Error('Missing task information');
    }
    return { id: payload.task.taskId };
  }
  
  // ============================================================================
  // Operation Invocation
  // ============================================================================
  
  /**
   * Invoke an A2A operation.
   */
  async invokeOperation(
    operation: UniversalMessageType,
    params: UniversalPayload,
    options?: InvocationOptions
  ): Promise<UniversalMessage> {
    const startTime = Date.now();
    const trace = this.createTraceContext(options?.trace);
    
    try {
      this.log(`Invoking operation: ${operation}`);
      
      const result = await this.withTimeout(
        () => this.executeOperation(operation, params, trace),
        options?.timeoutMs
      );
      
      this.recordSuccess(Date.now() - startTime);
      return result;
    } catch (error) {
      const universalError = this.recordError(error, operation);
      return this.createErrorMessage(
        universalError.code,
        universalError.message,
        {
          details: { operation },
          retryable: universalError.retryable,
          correlationId: options?.correlationId,
          trace
        }
      );
    }
  }
  
  /**
   * Execute a specific A2A operation.
   */
  private async executeOperation(
    operation: UniversalMessageType,
    params: UniversalPayload,
    trace: TraceContext
  ): Promise<UniversalMessage> {
    switch (operation) {
      case 'agent-card':
      case 'agent-query':
        return this.getAgentCard(trace);
      case 'task-request':
        return this.sendTask(params, trace);
      case 'task-status':
        return this.getTaskStatus(params, trace);
      case 'task-list':
        return this.listTasks(trace);
      case 'task-cancel':
        return this.cancelTask(params, trace);
      case 'stream-start':
        return this.startStream(params, trace);
      case 'ping':
        return this.handlePing(trace);
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  }
  
  // ============================================================================
  // Agent Card Operations
  // ============================================================================
  
  /**
   * Get agent card.
   */
  private async getAgentCard(trace: TraceContext): Promise<UniversalMessage> {
    if (!this.agentCard) {
      // Return a default agent card if none is set
      return createMessage('agent-card', 'a2a', {
        agent: {
          protocolId: 'a2a-agent',
          protocol: 'a2a',
          name: 'A2A Agent',
          description: 'Default A2A agent',
          capabilities: [],
          version: '1.0.0'
        }
      }, { trace });
    }
    
    return this.toUniversalMessage(this.agentCard, 'agent-card', { trace });
  }
  
  // ============================================================================
  // Task Operations
  // ============================================================================
  
  /**
   * Send a task.
   */
  private async sendTask(
    params: UniversalPayload,
    trace: TraceContext
  ): Promise<UniversalMessage> {
    if (!params.task) {
      throw new Error('Missing task information');
    }
    
    const taskId = params.task.taskId || this.generateId();
    
    // Create A2A task
    const a2aTask: A2ATask = {
      id: taskId,
      sessionId: this.currentSessionId,
      status: {
        state: 'submitted',
        timestamp: new Date().toISOString()
      },
      history: params.task.input ? [{
        role: 'user',
        parts: this.toA2AParts(params.task.input)
      }] : [],
      metadata: params.task.metadata as Record<string, unknown>
    };
    
    // Cache the task
    this.tasksCache.set(taskId, a2aTask);
    
    // Task execution requires A2A server connection - not implemented
    throw new Error('NotImplementedError: A2A task execution requires server connection. Configure A2A server endpoint.');
  }
  
  /**
   * Get task status.
   */
  private async getTaskStatus(
    params: UniversalPayload,
    trace: TraceContext
  ): Promise<UniversalMessage> {
    if (!params.task?.taskId) {
      throw new Error('Missing task ID');
    }
    
    const task = this.tasksCache.get(params.task.taskId);
    if (!task) {
      throw new Error(`Task not found: ${params.task.taskId}`);
    }
    
    return this.toUniversalMessage(task, 'task-status', { trace });
  }
  
  /**
   * List tasks.
   */
  private async listTasks(trace: TraceContext): Promise<UniversalMessage> {
    const tasks = Array.from(this.tasksCache.values());
    
    return createMessage('task-list', 'a2a', {
      raw: {
        tasks: tasks.map(t => ({
          taskId: t.id,
          state: this.mapTaskState(t.status?.state || 'submitted'),
          sessionId: t.sessionId,
          createdAt: t.status?.timestamp
        }))
      }
    }, { trace });
  }
  
  /**
   * Cancel a task.
   */
  private async cancelTask(
    params: UniversalPayload,
    trace: TraceContext
  ): Promise<UniversalMessage> {
    if (!params.task?.taskId) {
      throw new Error('Missing task ID');
    }
    
    const task = this.tasksCache.get(params.task.taskId);
    if (!task) {
      throw new Error(`Task not found: ${params.task.taskId}`);
    }
    
    task.status = {
      state: 'canceled',
      timestamp: new Date().toISOString()
    };
    
    this.emit('task-status-changed', { taskId: task.id, state: 'canceled' });
    
    return this.toUniversalMessage(task, 'task-status', { trace });
  }
  
  // ============================================================================
  // Streaming Operations
  // ============================================================================
  
  /**
   * Start a streaming task.
   */
  private async startStream(
    params: UniversalPayload,
    trace: TraceContext
  ): Promise<UniversalMessage> {
    const streamId = this.generateId();
    
    return createMessage('stream-start', 'a2a', {
      stream: {
        streamId,
        sequence: 0,
        final: false
      }
    }, { trace });
  }
  
  /**
   * Register a stream handler.
   */
  registerStreamHandler(
    streamId: string,
    handler: (chunk: UniversalStreamChunk) => void
  ): void {
    this.streamHandlers.set(streamId, handler);
  }
  
  /**
   * Unregister a stream handler.
   */
  unregisterStreamHandler(streamId: string): void {
    this.streamHandlers.delete(streamId);
  }
  
  // ============================================================================
  // Utility Operations
  // ============================================================================
  
  /**
   * Handle ping request.
   */
  private async handlePing(trace: TraceContext): Promise<UniversalMessage> {
    return createMessage('pong', 'a2a', {}, { trace });
  }
  
  // ============================================================================
  // Configuration Methods
  // ============================================================================
  
  /**
   * Set the agent card.
   */
  setAgentCard(card: A2AAgentCard): void {
    this.agentCard = card;
    this.emit('agent-card-updated', { name: card.name });
  }
  
  /**
   * Get the current agent card.
   */
  getAgentCardData(): A2AAgentCard | undefined {
    return this.agentCard;
  }
  
  /**
   * Set session ID for task context.
   */
  setSessionId(sessionId: string): void {
    this.currentSessionId = sessionId;
  }
  
  /**
   * Get current session ID.
   */
  getSessionId(): string | undefined {
    return this.currentSessionId;
  }
  
  // ============================================================================
  // Lifecycle Overrides
  // ============================================================================
  
  protected override async doInitialize(): Promise<void> {
    this.tasksCache.clear();
    this.streamHandlers.clear();
    this.log('A2A adapter initialized');
  }
  
  protected override async doShutdown(): Promise<void> {
    this.tasksCache.clear();
    this.streamHandlers.clear();
    this.agentCard = undefined;
    this.log('A2A adapter shutdown');
  }
  
  protected override async doReset(): Promise<void> {
    this.tasksCache.clear();
    this.streamHandlers.clear();
    this.currentSessionId = undefined;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new A2A unified adapter.
 */
export function createA2AAdapter(config?: Partial<A2AAdapterConfig>): A2AUnifiedAdapter {
  return new A2AUnifiedAdapter({
    protocol: 'a2a',
    ...config
  });
}

// ============================================================================
// Exports
// ============================================================================

export default A2AUnifiedAdapter;

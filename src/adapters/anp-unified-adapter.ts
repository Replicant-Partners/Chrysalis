/**
 * ANP (Agent Network Protocol) Unified Adapter
 * 
 * Protocol-specific implementation for Agent Network Protocol,
 * handling decentralized agent discovery, messaging, and collaboration.
 * 
 * ANP Specification: https://agent-network-protocol.com
 * 
 * @module adapters/anp-unified-adapter
 * @version 1.0.0
 */

import { BaseUnifiedAdapter, BaseAdapterConfig } from './base-unified-adapter';
import {
  UniversalMessage,
  UniversalPayload,
  UniversalMessageType,
  UniversalAgentRef,
  UniversalMessagePart,
  UniversalTaskRef,
  UniversalTaskState,
  TraceContext,
  createMessage
} from './protocol-messages';
import {
  ConversionOptions,
  InvocationOptions
} from './unified-adapter';

// ============================================================================
// ANP-Specific Types
// ============================================================================

/**
 * ANP Agent Identity (DID-based).
 */
export interface ANPAgentIdentity {
  did: string;
  publicKey: string;
  endpoints: ANPEndpoint[];
  capabilities: ANPCapability[];
  metadata?: Record<string, unknown>;
  created: string;
  updated: string;
}

/**
 * ANP Endpoint definition.
 */
export interface ANPEndpoint {
  id: string;
  type: 'http' | 'websocket' | 'libp2p' | 'dht';
  url: string;
  priority?: number;
  status?: 'active' | 'inactive' | 'unknown';
}

/**
 * ANP Capability definition.
 */
export interface ANPCapability {
  id: string;
  name: string;
  version: string;
  description?: string;
  schema?: Record<string, unknown>;
  inputTypes?: string[];
  outputTypes?: string[];
}

/**
 * ANP Message (envelope format).
 */
export interface ANPMessage {
  id: string;
  type: ANPMessageType;
  from: string; // DID
  to: string; // DID
  timestamp: string;
  signature?: string;
  payload: ANPPayload;
  metadata?: Record<string, unknown>;
}

/**
 * ANP Message types.
 */
export type ANPMessageType =
  | 'discovery'
  | 'capability-query'
  | 'capability-response'
  | 'task-request'
  | 'task-response'
  | 'task-progress'
  | 'collaboration-invite'
  | 'collaboration-accept'
  | 'collaboration-reject'
  | 'ping'
  | 'pong'
  | 'error';

/**
 * ANP Payload variants.
 */
export interface ANPPayload {
  discovery?: ANPDiscoveryPayload;
  capability?: ANPCapabilityPayload;
  task?: ANPTaskPayload;
  collaboration?: ANPCollaborationPayload;
  error?: ANPErrorPayload;
  data?: unknown;
}

/**
 * ANP Discovery payload.
 */
export interface ANPDiscoveryPayload {
  query?: {
    capabilities?: string[];
    tags?: string[];
    proximity?: number;
    trustLevel?: number;
  };
  results?: ANPAgentIdentity[];
}

/**
 * ANP Capability payload.
 */
export interface ANPCapabilityPayload {
  query?: string[];
  capabilities?: ANPCapability[];
}

/**
 * ANP Task payload.
 */
export interface ANPTaskPayload {
  taskId: string;
  action: 'submit' | 'status' | 'result' | 'cancel';
  input?: ANPContent[];
  output?: ANPContent[];
  status?: ANPTaskStatus;
  progress?: number; // 0-100
  error?: ANPErrorPayload;
}

/**
 * ANP Content (multi-modal).
 */
export interface ANPContent {
  type: 'text' | 'json' | 'binary' | 'reference';
  mimeType?: string;
  data?: string | Record<string, unknown>;
  ref?: string; // IPFS CID or other content address
  encoding?: 'utf8' | 'base64' | 'hex';
}

/**
 * ANP Task status.
 */
export type ANPTaskStatus =
  | 'pending'
  | 'accepted'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * ANP Collaboration payload.
 */
export interface ANPCollaborationPayload {
  collaborationId: string;
  type: 'invite' | 'accept' | 'reject' | 'leave' | 'update';
  topic?: string;
  participants?: string[]; // DIDs
  terms?: Record<string, unknown>;
  status?: 'pending' | 'active' | 'completed' | 'cancelled';
}

/**
 * ANP Error payload.
 */
export interface ANPErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retryable?: boolean;
}

/**
 * ANP Trust record.
 */
export interface ANPTrustRecord {
  agentDid: string;
  trustScore: number; // 0-1
  interactions: number;
  lastInteraction: string;
  feedback?: ANPFeedback[];
}

/**
 * ANP Feedback entry.
 */
export interface ANPFeedback {
  fromDid: string;
  rating: number; // 1-5
  comment?: string;
  timestamp: string;
  verified: boolean;
}

/**
 * ANP adapter configuration.
 */
export interface ANPAdapterConfig extends BaseAdapterConfig {
  /** Agent DID */
  agentDid?: string;
  /** Agent private key for signing */
  privateKey?: string;
  /** DHT bootstrap nodes */
  bootstrapNodes?: string[];
  /** Enable P2P discovery */
  enableP2PDiscovery?: boolean;
  /** Trust threshold for interactions */
  trustThreshold?: number;
}

// ============================================================================
// ANP Unified Adapter Implementation
// ============================================================================

/**
 * Unified adapter for Agent Network Protocol (ANP).
 * 
 * Supports:
 * - Decentralized identity (DID-based)
 * - P2P agent discovery
 * - Capability-based routing
 * - Multi-modal content
 * - Trust and reputation
 * - Collaboration management
 */
export class ANPUnifiedAdapter extends BaseUnifiedAdapter {
  private identity?: ANPAgentIdentity;
  private knownAgents: Map<string, ANPAgentIdentity> = new Map();
  private tasks: Map<string, ANPTaskPayload> = new Map();
  private collaborations: Map<string, ANPCollaborationPayload> = new Map();
  private trustRecords: Map<string, ANPTrustRecord> = new Map();
  
  constructor(config: ANPAdapterConfig = { protocol: 'anp' }) {
    super({ ...config, protocol: 'anp' });
    
    if (config.agentDid) {
      this.identity = {
        did: config.agentDid,
        publicKey: '',
        endpoints: [],
        capabilities: [],
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      };
    }
  }
  
  // ============================================================================
  // Message Conversion: Protocol → Universal
  // ============================================================================
  
  async toUniversalMessage(
    protocolPayload: unknown,
    messageType: UniversalMessageType,
    options?: ConversionOptions
  ): Promise<UniversalMessage> {
    const startTime = Date.now();
    
    try {
      const payload = this.convertToUniversalPayload(protocolPayload, messageType);
      
      const message = createMessage(messageType, 'anp', payload, {
        trace: options?.trace || this.createTraceContext()
      });
      
      if (options?.preserveRaw) {
        message.payload.raw = {
          anp: protocolPayload,
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
  
  private convertToUniversalPayload(
    protocolPayload: unknown,
    messageType: UniversalMessageType
  ): UniversalPayload {
    const anpMessage = protocolPayload as ANPMessage;
    
    switch (messageType) {
      case 'agent-query':
        return this.convertDiscovery(anpMessage?.payload?.discovery);
      case 'task-request':
      case 'task-response':
      case 'task-status':
        return this.convertTask(anpMessage?.payload?.task);
      case 'error':
        return this.convertError(anpMessage?.payload?.error);
      default:
        return { raw: { anp: protocolPayload } };
    }
  }
  
  private convertDiscovery(discovery?: ANPDiscoveryPayload): UniversalPayload {
    if (!discovery) {
      return { discovery: { capabilities: [], tags: [] } };
    }
    
    if (discovery.results) {
      return {
        raw: {
          agents: discovery.results.map(agent => ({
            protocolId: agent.did,
            protocol: 'anp',
            name: agent.did,
            capabilities: agent.capabilities.map(c => c.id),
            endpoints: agent.endpoints.map(e => e.url)
          }))
        }
      };
    }
    
    return {
      discovery: {
        capabilities: discovery.query?.capabilities || [],
        tags: discovery.query?.tags || []
      }
    };
  }
  
  private convertTask(task?: ANPTaskPayload): UniversalPayload {
    if (!task) {
      return { task: { taskId: '', state: 'pending' } };
    }
    
    const universalTask: UniversalTaskRef = {
      taskId: task.taskId,
      state: this.mapTaskState(task.status || 'pending'),
      input: task.input?.map(c => this.convertContent(c)),
      output: task.output?.map(c => this.convertContent(c)),
      metadata: { progress: task.progress }
    };
    
    return { task: universalTask };
  }
  
  private mapTaskState(status: ANPTaskStatus): UniversalTaskState {
    const stateMap: Record<ANPTaskStatus, UniversalTaskState> = {
      'pending': 'pending',
      'accepted': 'submitted',
      'running': 'working',
      'paused': 'working',
      'completed': 'completed',
      'failed': 'failed',
      'cancelled': 'canceled'
    };
    return stateMap[status] || 'pending';
  }
  
  private convertContent(content: ANPContent): UniversalMessagePart {
    switch (content.type) {
      case 'text':
        return {
          type: 'text',
          content: typeof content.data === 'string' ? content.data : JSON.stringify(content.data)
        };
      case 'json':
        return {
          type: 'data',
          metadata: content.data as Record<string, unknown>
        };
      case 'binary':
        return {
          type: 'file',
          data: typeof content.data === 'string' ? content.data : undefined,
          mimeType: content.mimeType,
          uri: content.ref
        };
      case 'reference':
        return {
          type: 'file',
          uri: content.ref,
          mimeType: content.mimeType
        };
      default:
        return {
          type: 'text',
          content: JSON.stringify(content)
        };
    }
  }
  
  private convertError(error?: ANPErrorPayload): UniversalPayload {
    if (!error) {
      return { error: { code: 'unknown', message: 'Unknown error', retryable: false } };
    }
    
    return {
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        retryable: error.retryable ?? false
      }
    };
  }
  
  // ============================================================================
  // Message Conversion: Universal → Protocol
  // ============================================================================
  
  async fromUniversalMessage(
    message: UniversalMessage,
    options?: ConversionOptions
  ): Promise<unknown> {
    const startTime = Date.now();
    
    try {
      const anpPayload = this.convertFromUniversalPayload(message);
      this.recordSuccess(Date.now() - startTime);
      return anpPayload;
    } catch (error) {
      const universalError = this.recordError(error, 'fromUniversalMessage');
      throw new Error(universalError.message);
    }
  }
  
  private convertFromUniversalPayload(message: UniversalMessage): ANPMessage {
    const baseMessage: ANPMessage = {
      id: this.generateId(),
      type: this.mapUniversalToANPType(message.type),
      from: this.identity?.did || 'unknown',
      to: message.payload.agent?.protocolId || 'unknown',
      timestamp: new Date().toISOString(),
      payload: {}
    };
    
    switch (message.type) {
      case 'agent-query':
        baseMessage.payload.discovery = this.toANPDiscovery(message.payload);
        break;
      case 'task-request':
        baseMessage.payload.task = this.toANPTask(message.payload);
        break;
      case 'error':
        baseMessage.payload.error = this.toANPError(message.payload);
        break;
      default:
        baseMessage.payload.data = message.payload.raw?.anp || message.payload;
    }
    
    return baseMessage;
  }
  
  private mapUniversalToANPType(type: UniversalMessageType): ANPMessageType {
    const typeMap: Partial<Record<UniversalMessageType, ANPMessageType>> = {
      'agent-query': 'discovery',
      'task-request': 'task-request',
      'task-response': 'task-response',
      'task-status': 'task-progress',
      'task-cancel': 'task-request',
      'ping': 'ping',
      'pong': 'pong',
      'error': 'error'
    };
    return typeMap[type] || 'discovery';
  }
  
  private toANPDiscovery(payload: UniversalPayload): ANPDiscoveryPayload {
    return {
      query: {
        capabilities: payload.discovery?.capabilities,
        tags: payload.discovery?.tags
      }
    };
  }
  
  private toANPTask(payload: UniversalPayload): ANPTaskPayload {
    if (!payload.task) {
      throw new Error('Missing task information');
    }
    
    return {
      taskId: payload.task.taskId,
      action: 'submit',
      input: payload.task.input?.map(p => this.toANPContent(p)),
      status: 'pending'
    };
  }
  
  private toANPContent(part: UniversalMessagePart): ANPContent {
    switch (part.type) {
      case 'text':
        return { type: 'text', data: part.content };
      case 'file':
      case 'image':
      case 'audio':
      case 'video':
        return {
          type: part.uri ? 'reference' : 'binary',
          ref: part.uri,
          data: part.data,
          mimeType: part.mimeType
        };
      default:
        return {
          type: 'json',
          data: part.metadata as Record<string, unknown>
        };
    }
  }
  
  private toANPError(payload: UniversalPayload): ANPErrorPayload {
    return {
      code: payload.error?.code || 'unknown',
      message: payload.error?.message || 'Unknown error',
      details: payload.error?.details as Record<string, unknown>,
      retryable: payload.error?.retryable
    };
  }
  
  // ============================================================================
  // Operation Invocation
  // ============================================================================
  
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
  
  private async executeOperation(
    operation: UniversalMessageType,
    params: UniversalPayload,
    trace: TraceContext
  ): Promise<UniversalMessage> {
    switch (operation) {
      case 'agent-query':
        return this.discoverAgents(params, trace);
      case 'agent-card':
        return this.getAgentIdentity(trace);
      case 'task-request':
        return this.submitTask(params, trace);
      case 'task-status':
        return this.getTaskStatus(params, trace);
      case 'task-cancel':
        return this.cancelTask(params, trace);
      case 'task-list':
        return this.listTasks(trace);
      case 'ping':
        return this.handlePing(trace);
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  }
  
  // ============================================================================
  // Discovery Operations
  // ============================================================================
  
  private async discoverAgents(
    params: UniversalPayload,
    trace: TraceContext
  ): Promise<UniversalMessage> {
    const query = params.discovery;
    
    // Filter known agents by capabilities
    let agents = Array.from(this.knownAgents.values());
    
    if (query?.capabilities && query.capabilities.length > 0) {
      agents = agents.filter(agent =>
        agent.capabilities.some(c =>
          query.capabilities?.includes(c.id)
        )
      );
    }
    
    if (query?.tags && query.tags.length > 0) {
      agents = agents.filter(agent =>
        agent.capabilities.some(c =>
          c.description && query.tags?.some(tag =>
            c.description?.toLowerCase().includes(tag.toLowerCase())
          )
        )
      );
    }
    
    return createMessage('agent-query', 'anp', {
      raw: {
        agents: agents.map(agent => ({
          protocolId: agent.did,
          protocol: 'anp',
          name: agent.did,
          capabilities: agent.capabilities.map(c => c.id),
          endpoints: agent.endpoints.map(e => e.url)
        }))
      }
    }, { trace });
  }
  
  private async getAgentIdentity(trace: TraceContext): Promise<UniversalMessage> {
    if (!this.identity) {
      return createMessage('agent-card', 'anp', {
        agent: {
          protocolId: 'anp-agent',
          protocol: 'anp',
          name: 'ANP Agent',
          capabilities: [],
          version: '1.0.0'
        }
      }, { trace });
    }
    
    return createMessage('agent-card', 'anp', {
      agent: {
        protocolId: this.identity.did,
        protocol: 'anp',
        name: this.identity.did,
        capabilities: this.identity.capabilities.map(c => c.id),
        version: '1.0.0'
      }
    }, { trace });
  }
  
  // ============================================================================
  // Task Operations
  // ============================================================================
  
  private async submitTask(
    params: UniversalPayload,
    trace: TraceContext
  ): Promise<UniversalMessage> {
    if (!params.task) {
      throw new Error('Missing task information');
    }
    
    const taskId = params.task.taskId || this.generateId();
    
    const anpTask: ANPTaskPayload = {
      taskId,
      action: 'submit',
      input: params.task.input?.map(p => this.toANPContent(p)),
      status: 'pending'
    };
    
    this.tasks.set(taskId, anpTask);
    
    // Task execution requires ANP server connection - not implemented
    throw new Error('NotImplementedError: ANP task execution requires server connection. Configure ANP server endpoint.');
  }
  private async getTaskStatus(
    params: UniversalPayload,
    trace: TraceContext
  ): Promise<UniversalMessage> {
    if (!params.task?.taskId) {
      throw new Error('Missing task ID');
    }
    
    const task = this.tasks.get(params.task.taskId);
    if (!task) {
      throw new Error(`Task not found: ${params.task.taskId}`);
    }
    
    return this.toUniversalMessage(
      { id: this.generateId(), type: 'task-progress', from: '', to: '', timestamp: '', payload: { task } },
      'task-status',
      { trace }
    );
  }
  
  private async cancelTask(
    params: UniversalPayload,
    trace: TraceContext
  ): Promise<UniversalMessage> {
    if (!params.task?.taskId) {
      throw new Error('Missing task ID');
    }
    
    const task = this.tasks.get(params.task.taskId);
    if (!task) {
      throw new Error(`Task not found: ${params.task.taskId}`);
    }
    
    task.status = 'cancelled';
    
    this.emit('task-status-changed', { taskId: task.taskId, status: 'cancelled' });
    
    return this.toUniversalMessage(
      { id: this.generateId(), type: 'task-progress', from: '', to: '', timestamp: '', payload: { task } },
      'task-status',
      { trace }
    );
  }
  
  private async listTasks(trace: TraceContext): Promise<UniversalMessage> {
    const tasks = Array.from(this.tasks.values());
    
    return createMessage('task-list', 'anp', {
      raw: {
        tasks: tasks.map(t => ({
          taskId: t.taskId,
          state: this.mapTaskState(t.status || 'pending'),
          progress: t.progress
        }))
      }
    }, { trace });
  }
  
  // ============================================================================
  // Utility Operations
  // ============================================================================
  
  private async handlePing(trace: TraceContext): Promise<UniversalMessage> {
    return createMessage('pong', 'anp', {}, { trace });
  }
  
  // ============================================================================
  // Configuration Methods
  // ============================================================================
  
  setIdentity(identity: ANPAgentIdentity): void {
    this.identity = identity;
    this.emit('identity-updated', { did: identity.did });
  }
  
  getIdentity(): ANPAgentIdentity | undefined {
    return this.identity;
  }
  
  registerAgent(agent: ANPAgentIdentity): void {
    this.knownAgents.set(agent.did, agent);
    this.emit('agent-registered', { did: agent.did });
  }
  
  getKnownAgents(): ANPAgentIdentity[] {
    return Array.from(this.knownAgents.values());
  }
  
  getTrustRecord(did: string): ANPTrustRecord | undefined {
    return this.trustRecords.get(did);
  }
  
  updateTrustRecord(record: ANPTrustRecord): void {
    this.trustRecords.set(record.agentDid, record);
  }
  
  // ============================================================================
  // Lifecycle Overrides
  // ============================================================================
  
  protected override async doInitialize(): Promise<void> {
    this.knownAgents.clear();
    this.tasks.clear();
    this.collaborations.clear();
    this.trustRecords.clear();
    this.log('ANP adapter initialized');
  }
  
  protected override async doShutdown(): Promise<void> {
    this.knownAgents.clear();
    this.tasks.clear();
    this.collaborations.clear();
    this.trustRecords.clear();
    this.identity = undefined;
    this.log('ANP adapter shutdown');
  }
  
  protected override async doReset(): Promise<void> {
    this.knownAgents.clear();
    this.tasks.clear();
    this.collaborations.clear();
    this.trustRecords.clear();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createANPAdapter(config?: Partial<ANPAdapterConfig>): ANPUnifiedAdapter {
  return new ANPUnifiedAdapter({
    protocol: 'anp',
    ...config
  });
}

export default ANPUnifiedAdapter;

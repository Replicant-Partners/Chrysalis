/**
 * TypeScript client for Go Bridge Manager Service
 *
 * Provides type-safe access to the inter-agent communication bridge.
 */

// ============================================================================
// Types
// ============================================================================

export type AgentType =
  | 'ada'
  | 'lea'
  | 'phil'
  | 'david'
  | 'serena'
  | 'generic';

export type Protocol =
  | 'a2a'       // Agent-to-Agent
  | 'acp'       // Agent Communication Protocol
  | 'mcp'       // Model Context Protocol
  | 'http'      // HTTP/REST
  | 'ws'        // WebSocket
  | 'internal'; // Internal pub/sub

export interface HealthStatus {
  healthy: boolean;
  latency_ms: number;
  error_rate: number;
  last_check: string;
  fail_count: number;
}

export interface AgentInfo {
  id: string;
  type: AgentType;
  protocol: Protocol;
  endpoint: string;
  capabilities: string[];
  metadata?: Record<string, string>;
  registered_at?: string;
  last_seen?: string;
  health?: HealthStatus;
}

export interface BridgeMessage {
  id: string;
  source: string;
  target: string;
  protocol: Protocol;
  content_type: string;
  payload: any;
  timestamp?: string;
  ttl?: number;
  priority?: number;
  reply_to?: string;
  metadata?: Record<string, string>;
}

export interface BridgeStats {
  agents: number;
  adapters: number;
  metrics: {
    messages_queued: number;
    messages_delivered: number;
    messages_failed: number;
    messages_dropped: number;
    agents_registered: number;
    agents_unregistered: number;
  };
  running: boolean;
}

// ============================================================================
// Client
// ============================================================================

export class BridgeClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string = 'http://localhost:8090', timeout: number = 10000) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeout = timeout;
  }

  private async fetch<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // -------------------------------------------------------------------------
  // Agent Management
  // -------------------------------------------------------------------------

  /**
   * Register an agent with the bridge.
   */
  async registerAgent(agent: Omit<AgentInfo, 'registered_at' | 'last_seen' | 'health'>): Promise<AgentInfo> {
    return this.fetch('/api/v1/agents', {
      method: 'POST',
      body: JSON.stringify(agent),
    });
  }

  /**
   * Unregister an agent from the bridge.
   */
  async unregisterAgent(agentId: string): Promise<void> {
    await this.fetch(`/api/v1/agents/${encodeURIComponent(agentId)}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get agent info by ID.
   */
  async getAgent(agentId: string): Promise<AgentInfo> {
    return this.fetch(`/api/v1/agents/${encodeURIComponent(agentId)}`);
  }

  /**
   * List all registered agents.
   */
  async listAgents(): Promise<AgentInfo[]> {
    return this.fetch('/api/v1/agents');
  }

  /**
   * Find agents by type.
   */
  async findAgentsByType(agentType: AgentType): Promise<AgentInfo[]> {
    return this.fetch(`/api/v1/agents?type=${encodeURIComponent(agentType)}`);
  }

  /**
   * Find agents by capability.
   */
  async findAgentsByCapability(capability: string): Promise<AgentInfo[]> {
    return this.fetch(`/api/v1/agents?capability=${encodeURIComponent(capability)}`);
  }

  // -------------------------------------------------------------------------
  // Messaging
  // -------------------------------------------------------------------------

  /**
   * Send a message to an agent.
   */
  async send(message: Omit<BridgeMessage, 'timestamp'>): Promise<{ queued: boolean }> {
    return this.fetch('/api/v1/messages', {
      method: 'POST',
      body: JSON.stringify(message),
    });
  }

  /**
   * Send a message and wait for delivery.
   */
  async sendDirect(message: Omit<BridgeMessage, 'timestamp'>): Promise<{ delivered: boolean }> {
    return this.fetch('/api/v1/messages/direct', {
      method: 'POST',
      body: JSON.stringify(message),
    });
  }

  /**
   * Broadcast a message to multiple agents.
   */
  async broadcast(
    message: Omit<BridgeMessage, 'target' | 'timestamp'>,
    targets: string[]
  ): Promise<{ queued: number }> {
    return this.fetch('/api/v1/messages/broadcast', {
      method: 'POST',
      body: JSON.stringify({ message, targets }),
    });
  }

  /**
   * Broadcast a message to all agents of a type.
   */
  async broadcastToType(
    message: Omit<BridgeMessage, 'target' | 'timestamp'>,
    agentType: AgentType
  ): Promise<{ queued: number }> {
    return this.fetch('/api/v1/messages/broadcast-type', {
      method: 'POST',
      body: JSON.stringify({ message, agent_type: agentType }),
    });
  }

  // -------------------------------------------------------------------------
  // Stats & Health
  // -------------------------------------------------------------------------

  /**
   * Get bridge statistics.
   */
  async stats(): Promise<BridgeStats> {
    return this.fetch('/api/v1/stats');
  }

  /**
   * Check bridge health.
   */
  async health(): Promise<{ status: string }> {
    return this.fetch('/health');
  }
}

// ============================================================================
// Message Builder
// ============================================================================

export class MessageBuilder {
  private message: Partial<BridgeMessage> = {};

  constructor(source: string) {
    this.message.source = source;
    this.message.id = crypto.randomUUID?.() || `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  to(target: string): this {
    this.message.target = target;
    return this;
  }

  protocol(protocol: Protocol): this {
    this.message.protocol = protocol;
    return this;
  }

  contentType(contentType: string): this {
    this.message.content_type = contentType;
    return this;
  }

  payload(payload: any): this {
    this.message.payload = payload;
    return this;
  }

  json(data: any): this {
    this.message.content_type = 'application/json';
    this.message.payload = data;
    return this;
  }

  text(text: string): this {
    this.message.content_type = 'text/plain';
    this.message.payload = text;
    return this;
  }

  ttl(ttl: number): this {
    this.message.ttl = ttl;
    return this;
  }

  priority(priority: number): this {
    this.message.priority = priority;
    return this;
  }

  replyTo(replyTo: string): this {
    this.message.reply_to = replyTo;
    return this;
  }

  metadata(key: string, value: string): this {
    this.message.metadata = this.message.metadata || {};
    this.message.metadata[key] = value;
    return this;
  }

  build(): BridgeMessage {
    if (!this.message.source) throw new Error('Source is required');
    if (!this.message.target) throw new Error('Target is required');
    if (!this.message.protocol) this.message.protocol = 'internal';
    if (!this.message.content_type) this.message.content_type = 'application/json';
    if (!this.message.payload) this.message.payload = {};

    return this.message as BridgeMessage;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a new message builder.
 */
export function message(source: string): MessageBuilder {
  return new MessageBuilder(source);
}

/**
 * Create an A2A (Agent-to-Agent) protocol message.
 */
export function a2aMessage(
  source: string,
  target: string,
  method: string,
  params?: any
): BridgeMessage {
  return message(source)
    .to(target)
    .protocol('a2a')
    .json({
      jsonrpc: '2.0',
      method,
      id: crypto.randomUUID?.() || `${Date.now()}`,
      params,
    })
    .build();
}

/**
 * Create an ACP (Agent Communication Protocol) message.
 */
export function acpMessage(
  source: string,
  target: string,
  type: string,
  content: any
): BridgeMessage {
  return message(source)
    .to(target)
    .protocol('acp')
    .json({
      type,
      from: source,
      to: target,
      content,
    })
    .build();
}

export default BridgeClient;

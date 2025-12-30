/**
 * Experience Transport Layer
 * 
 * Polyglot transport support for experience sync:
 * - HTTPS (explicitly TLS; no plain HTTP)
 * - WebSocket
 * - MCP client
 * 
 * The coordinating copy of the agent selects the transport
 * and derivative instances inherit the choice.
 */

import type { ExperienceBatch, ExperienceEvent, ExperienceTransportConfig, ExperienceTransportType } from '../core/UniversalAgentV2';

export type TransportPayload =
  | { kind: 'events'; instanceId: string; events: ExperienceEvent[] }
  | { kind: 'batch'; instanceId: string; batch: ExperienceBatch }
  | { kind: 'check_in'; instanceId: string; state: any };

export interface TransportDeliveryHook {
  (payload: TransportPayload): Promise<void>;
}

export interface TransportResult {
  delivered: boolean;
  deliveredLocally: boolean;
}

export interface ExperienceTransport {
  readonly type: ExperienceTransportType;
  sendEvents(instanceId: string, events: ExperienceEvent[]): Promise<TransportResult>;
  sendBatch(instanceId: string, batch: ExperienceBatch): Promise<TransportResult>;
  sendCheckIn(instanceId: string, state: any): Promise<TransportResult>;
}

/**
 * HTTPS transport (TLS enforced)
 */
class HttpsExperienceTransport implements ExperienceTransport {
  readonly type: ExperienceTransportType = 'https';
  private readonly endpoint: string;
  private readonly headers: Record<string, string>;
  private readonly deliveryHook?: TransportDeliveryHook;
  
  constructor(
    endpoint: string,
    headers?: Record<string, string>,
    authToken?: string,
    deliveryHook?: TransportDeliveryHook
  ) {
    if (!endpoint.startsWith('https://')) {
      throw new Error('HTTPS transport requires an https:// endpoint (no plain HTTP).');
    }
    this.endpoint = endpoint;
    this.headers = {
      'content-type': 'application/json',
      ...headers
    };
    if (authToken) {
      this.headers.authorization = `Bearer ${authToken}`;
    }
    this.deliveryHook = deliveryHook;
  }
  
  async sendEvents(instanceId: string, events: ExperienceEvent[]): Promise<TransportResult> {
    const payload = { instanceId, events };
    
    if (this.deliveryHook) {
      await this.deliveryHook({ kind: 'events', instanceId, events });
      return { delivered: true, deliveredLocally: true };
    }
    
    const fetchFn = (globalThis as any).fetch;
    if (!fetchFn) {
      throw new Error('Fetch is not available in this runtime; provide a deliveryHook or polyfill.');
    }
    
    await fetchFn(this.endpoint, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload)
    });
    
    return { delivered: true, deliveredLocally: false };
  }
  
  async sendBatch(instanceId: string, batch: ExperienceBatch): Promise<TransportResult> {
    if (this.deliveryHook) {
      await this.deliveryHook({ kind: 'batch', instanceId, batch });
      return { delivered: true, deliveredLocally: true };
    }
    
    const fetchFn = (globalThis as any).fetch;
    if (!fetchFn) {
      throw new Error('Fetch is not available in this runtime; provide a deliveryHook or polyfill.');
    }
    
    await fetchFn(this.endpoint, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(batch)
    });
    
    return { delivered: true, deliveredLocally: false };
  }
  
  async sendCheckIn(instanceId: string, state: any): Promise<TransportResult> {
    if (this.deliveryHook) {
      await this.deliveryHook({ kind: 'check_in', instanceId, state });
      return { delivered: true, deliveredLocally: true };
    }
    
    const fetchFn = (globalThis as any).fetch;
    if (!fetchFn) {
      throw new Error('Fetch is not available in this runtime; provide a deliveryHook or polyfill.');
    }
    
    await fetchFn(this.endpoint, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(state)
    });
    
    return { delivered: true, deliveredLocally: false };
  }
}

/**
 * WebSocket transport (client injected to avoid heavy deps)
 */
export interface WebSocketLike {
  send(data: string): void | Promise<void>;
  readyState?: number;
  OPEN?: number;
}

type WebSocketFactory = () => Promise<WebSocketLike>;

class WebSocketExperienceTransport implements ExperienceTransport {
  readonly type: ExperienceTransportType = 'websocket';
  private client: WebSocketLike | null = null;
  private readonly factory: WebSocketFactory;
  private readonly deliveryHook?: TransportDeliveryHook;
  
  constructor(factory: WebSocketFactory, deliveryHook?: TransportDeliveryHook) {
    this.factory = factory;
    this.deliveryHook = deliveryHook;
  }
  
  private async ensureClient(): Promise<WebSocketLike> {
    if (!this.client) {
      this.client = await this.factory();
    }
    return this.client;
  }
  
  private async send(data: any): Promise<void> {
    if (this.deliveryHook) {
      // Local delivery (coordinating copy) takes precedence
      await this.deliveryHook(data);
      return;
    }
    
    const client = await this.ensureClient();
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    await client.send(payload);
  }
  
  async sendEvents(instanceId: string, events: ExperienceEvent[]): Promise<TransportResult> {
    await this.send({ kind: 'events', instanceId, events });
    return { delivered: true, deliveredLocally: !!this.deliveryHook };
  }
  
  async sendBatch(instanceId: string, batch: ExperienceBatch): Promise<TransportResult> {
    await this.send({ kind: 'batch', instanceId, batch });
    return { delivered: true, deliveredLocally: !!this.deliveryHook };
  }
  
  async sendCheckIn(instanceId: string, state: any): Promise<TransportResult> {
    await this.send({ kind: 'check_in', instanceId, state });
    return { delivered: true, deliveredLocally: !!this.deliveryHook };
  }
}

/**
 * MCP client transport (tool-call based)
 */
export interface MCPClient {
  callTool(toolName: string, payload: any): Promise<any>;
}

class MCPExperienceTransport implements ExperienceTransport {
  readonly type: ExperienceTransportType = 'mcp';
  private readonly client: MCPClient;
  private readonly toolName: string;
  private readonly deliveryHook?: TransportDeliveryHook;
  
  constructor(client: MCPClient, toolName: string, deliveryHook?: TransportDeliveryHook) {
    this.client = client;
    this.toolName = toolName;
    this.deliveryHook = deliveryHook;
  }
  
  private async call(payload: TransportPayload): Promise<void> {
    if (this.deliveryHook) {
      await this.deliveryHook(payload);
      return;
    }
    await this.client.callTool(this.toolName, payload);
  }
  
  async sendEvents(instanceId: string, events: ExperienceEvent[]): Promise<TransportResult> {
    await this.call({ kind: 'events', instanceId, events });
    return { delivered: true, deliveredLocally: !!this.deliveryHook };
  }
  
  async sendBatch(instanceId: string, batch: ExperienceBatch): Promise<TransportResult> {
    await this.call({ kind: 'batch', instanceId, batch });
    return { delivered: true, deliveredLocally: !!this.deliveryHook };
  }
  
  async sendCheckIn(instanceId: string, state: any): Promise<TransportResult> {
    await this.call({ kind: 'check_in', instanceId, state });
    return { delivered: true, deliveredLocally: !!this.deliveryHook };
  }
}

/**
 * Factory
 */
export function createExperienceTransport(
  instanceId: string,
  config: ExperienceTransportConfig,
  deliveryHook?: TransportDeliveryHook
): ExperienceTransport {
  switch (config.type) {
    case 'https': {
      const endpoint = config.https?.endpoint;
      if (!endpoint) {
        throw new Error(`Instance ${instanceId}: HTTPS transport requires an endpoint`);
      }
      return new HttpsExperienceTransport(
        endpoint,
        config.https?.headers,
        config.https?.auth_token,
        deliveryHook
      );
    }
    case 'websocket': {
      if (!config.websocket?.url) {
        throw new Error(`Instance ${instanceId}: WebSocket transport requires a url`);
      }
      const factory: WebSocketFactory = async () => {
        // Rely on caller-provided or global WebSocket implementation
        const WsImpl = (globalThis as any).WebSocket;
        if (WsImpl) {
          return new WsImpl(config.websocket!.url, config.websocket!.protocols);
        }
        throw new Error('WebSocket implementation not available; provide a factory in config.websocket');
      };
      return new WebSocketExperienceTransport(factory, deliveryHook);
    }
    case 'mcp': {
      const client = config.mcp?.server as unknown as MCPClient;
      if (!client || typeof (client as MCPClient).callTool !== 'function') {
        throw new Error(`Instance ${instanceId}: MCP transport requires a client with callTool`);
      }
      const toolName = config.mcp?.tool_name || 'experience.sync';
      return new MCPExperienceTransport(client as MCPClient, toolName, deliveryHook);
    }
    default:
      throw new Error(`Unsupported transport type ${(config as any).type}`);
  }
}

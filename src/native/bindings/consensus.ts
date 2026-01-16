/**
 * TypeScript bindings for Chrysalis Go Consensus Module
 *
 * Provides distributed consensus and gossip protocol functionality
 * via HTTP/WebSocket communication with the Go service.
 */

import { VectorClock, VectorClockData } from './crdt';

// ============================================================================
// Types
// ============================================================================

export type MessageType = 'push' | 'pull' | 'ack' | 'digest';
export type SyncProtocol = 'streaming' | 'lumped' | 'check_in';
export type MergeStrategy = 'lww' | 'vc' | 'consensus' | 'crdt';

export interface GossipMessage {
  id: string;
  type: MessageType;
  senderId: string;
  vectorClock: VectorClockData;
  payload?: unknown;
  timestamp: string;
  ttl: number;
}

export interface Peer {
  id: string;
  address: string;
  lastSeen: string;
  latency: number;
  failCount: number;
  healthy: boolean;
}

export interface Vote {
  nodeId: string;
  value: unknown;
  vectorClock: VectorClockData;
  signature?: string;
  timestamp: string;
}

export interface ConsensusResult {
  achieved: boolean;
  value?: unknown;
  voteCount: number;
  totalNodes: number;
  round: number;
  duration?: number;
}

export interface SyncEvent {
  id: string;
  type: string;
  agentId: string;
  instanceId: string;
  payload: unknown;
  vectorClock: VectorClockData;
  timestamp: string;
  priority: number;
}

export interface SyncConfig {
  protocol: SyncProtocol;
  mergeStrategy: MergeStrategy;
  batchSize: number;
  batchTimeout: number;
  checkInInterval: number;
  priorityThreshold: number;
}

// ============================================================================
// Gossip Client
// ============================================================================

export class GossipClient {
  private baseUrl: string;
  private ws: WebSocket | null = null;
  private messageHandlers: Map<string, (msg: GossipMessage) => void> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(baseUrl: string = 'http://localhost:8080') {
    this.baseUrl = baseUrl;
  }

  /**
   * Connect to the gossip WebSocket endpoint.
   */
  async connect(): Promise<void> {
    const wsUrl = this.baseUrl.replace(/^http/, 'ws') + '/gossip';

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onerror = (error) => {
        reject(error);
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as GossipMessage;
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse gossip message:', error);
        }
      };

      this.ws.onclose = () => {
        this.attemptReconnect();
      };
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.connect().catch(console.error);
    }, delay);
  }

  /**
   * Disconnect from the gossip service.
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Send a message via the gossip protocol.
   */
  send(message: Omit<GossipMessage, 'id' | 'timestamp'>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const fullMessage: GossipMessage = {
      ...message,
      id: this.generateMessageId(),
      timestamp: new Date().toISOString(),
    };

    this.ws.send(JSON.stringify(fullMessage));
  }

  /**
   * Broadcast a payload to the gossip network.
   */
  broadcast(payload: unknown, ttl: number = 5): void {
    this.send({
      type: 'push',
      senderId: '', // Set by server
      vectorClock: {},
      payload,
      ttl,
    });
  }

  /**
   * Request state from peers.
   */
  pull(): void {
    this.send({
      type: 'pull',
      senderId: '',
      vectorClock: {},
      ttl: 1,
    });
  }

  /**
   * Register a handler for incoming messages.
   */
  onMessage(type: MessageType | '*', handler: (msg: GossipMessage) => void): void {
    this.messageHandlers.set(type, handler);
  }

  private handleMessage(message: GossipMessage): void {
    // Call specific handler
    const specificHandler = this.messageHandlers.get(message.type);
    if (specificHandler) {
      specificHandler(message);
    }

    // Call wildcard handler
    const wildcardHandler = this.messageHandlers.get('*');
    if (wildcardHandler) {
      wildcardHandler(message);
    }
  }

  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get the list of known peers.
   */
  async getPeers(): Promise<Peer[]> {
    const response = await fetch(`${this.baseUrl}/peers`);
    if (!response.ok) {
      throw new Error(`Failed to get peers: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Add a peer to the gossip network.
   */
  async addPeer(id: string, address: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/peers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, address }),
    });
    if (!response.ok) {
      throw new Error(`Failed to add peer: ${response.statusText}`);
    }
  }

  /**
   * Remove a peer from the gossip network.
   */
  async removePeer(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/peers/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`Failed to remove peer: ${response.statusText}`);
    }
  }
}

// ============================================================================
// Byzantine Consensus Client
// ============================================================================

export class ByzantineConsensusClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:8080') {
    this.baseUrl = baseUrl;
  }

  /**
   * Propose a value for consensus.
   */
  async propose(value: unknown): Promise<ConsensusResult> {
    const response = await fetch(`${this.baseUrl}/consensus/propose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });

    if (!response.ok) {
      throw new Error(`Failed to propose: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Cast a vote for a consensus round.
   */
  async vote(round: number, value: unknown): Promise<void> {
    const response = await fetch(`${this.baseUrl}/consensus/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ round, value }),
    });

    if (!response.ok) {
      throw new Error(`Failed to vote: ${response.statusText}`);
    }
  }

  /**
   * Check the result of a consensus round.
   */
  async checkResult(round: number): Promise<ConsensusResult> {
    const response = await fetch(`${this.baseUrl}/consensus/result/${round}`);

    if (!response.ok) {
      throw new Error(`Failed to check result: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Wait for consensus on a round.
   */
  async waitForConsensus(
    round: number,
    timeout: number = 30000
  ): Promise<ConsensusResult> {
    const response = await fetch(
      `${this.baseUrl}/consensus/wait/${round}?timeout=${timeout}`
    );

    if (!response.ok) {
      throw new Error(`Failed to wait for consensus: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get votes for a round.
   */
  async getVotes(round: number): Promise<Vote[]> {
    const response = await fetch(`${this.baseUrl}/consensus/votes/${round}`);

    if (!response.ok) {
      throw new Error(`Failed to get votes: ${response.statusText}`);
    }

    return response.json();
  }
}

// ============================================================================
// Sync Coordinator Client
// ============================================================================

export class SyncCoordinatorClient {
  private baseUrl: string;
  private gossip: GossipClient;
  private localClock: VectorClock;
  private instanceId: string;
  private agentId: string;
  private eventSubscribers: Array<(event: SyncEvent) => void> = [];

  constructor(
    baseUrl: string,
    agentId: string,
    instanceId: string
  ) {
    this.baseUrl = baseUrl;
    this.agentId = agentId;
    this.instanceId = instanceId;
    this.gossip = new GossipClient(baseUrl);
    this.localClock = VectorClock.singleton(instanceId);
  }

  /**
   * Start the sync coordinator.
   */
  async start(): Promise<void> {
    await this.gossip.connect();

    // Handle incoming sync events
    this.gossip.onMessage('push', (msg) => {
      if (msg.payload) {
        const event = msg.payload as SyncEvent;
        this.handleSyncEvent(event);
      }
    });
  }

  /**
   * Stop the sync coordinator.
   */
  stop(): void {
    this.gossip.disconnect();
  }

  /**
   * Publish a sync event.
   */
  async publishEvent(
    type: string,
    payload: unknown,
    priority: number = 5
  ): Promise<void> {
    // Update local clock
    this.localClock = this.localClock.increment(this.instanceId);

    const event: SyncEvent = {
      id: this.generateEventId(),
      type,
      agentId: this.agentId,
      instanceId: this.instanceId,
      payload,
      vectorClock: this.localClock.toJSON(),
      timestamp: new Date().toISOString(),
      priority,
    };

    // Send via HTTP for reliability
    const response = await fetch(`${this.baseUrl}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      throw new Error(`Failed to publish event: ${response.statusText}`);
    }
  }

  /**
   * Subscribe to sync events.
   */
  onEvent(handler: (event: SyncEvent) => void): () => void {
    this.eventSubscribers.push(handler);
    return () => {
      const index = this.eventSubscribers.indexOf(handler);
      if (index !== -1) {
        this.eventSubscribers.splice(index, 1);
      }
    };
  }

  private handleSyncEvent(event: SyncEvent): void {
    // Update local clock
    const remoteClock = new VectorClock(event.vectorClock);
    this.localClock = this.localClock.merge(remoteClock);
    this.localClock = this.localClock.increment(this.instanceId);

    // Notify subscribers
    for (const handler of this.eventSubscribers) {
      try {
        handler(event);
      } catch (error) {
        console.error('Event handler error:', error);
      }
    }
  }

  /**
   * Get the current vector clock.
   */
  getVectorClock(): VectorClock {
    return this.localClock;
  }

  /**
   * Get current state from the coordinator.
   */
  async getState(): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseUrl}/state`);
    if (!response.ok) {
      throw new Error(`Failed to get state: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Check health of the coordinator.
   */
  async healthCheck(): Promise<{ status: string }> {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }
    return response.json();
  }

  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// Median Aggregator (for Byzantine-resistant aggregation)
// ============================================================================

export class MedianAggregator {
  private values: number[] = [];

  add(value: number): void {
    this.values.push(value);
  }

  median(): number | null {
    if (this.values.length === 0) return null;

    const sorted = [...this.values].sort((a, b) => a - b);
    const n = sorted.length;

    if (n % 2 === 0) {
      return (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    }
    return sorted[Math.floor(n / 2)];
  }

  trimmedMean(trimPercent: number = 0.25): number | null {
    if (this.values.length === 0) return null;

    const sorted = [...this.values].sort((a, b) => a - b);
    const n = sorted.length;

    let trimCount = Math.floor((n * trimPercent) / 2);
    if (trimCount * 2 >= n) trimCount = 0;

    const trimmed = sorted.slice(trimCount, n - trimCount);
    if (trimmed.length === 0) return null;

    return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  }

  count(): number {
    return this.values.length;
  }

  reset(): void {
    this.values = [];
  }
}

// ============================================================================
// Factory
// ============================================================================

export interface ConsensusConfig {
  baseUrl: string;
  agentId: string;
  instanceId: string;
}

export function createConsensusClient(config: ConsensusConfig): {
  gossip: GossipClient;
  consensus: ByzantineConsensusClient;
  sync: SyncCoordinatorClient;
} {
  return {
    gossip: new GossipClient(config.baseUrl),
    consensus: new ByzantineConsensusClient(config.baseUrl),
    sync: new SyncCoordinatorClient(
      config.baseUrl,
      config.agentId,
      config.instanceId
    ),
  };
}

export default {
  GossipClient,
  ByzantineConsensusClient,
  SyncCoordinatorClient,
  MedianAggregator,
  createConsensusClient,
};
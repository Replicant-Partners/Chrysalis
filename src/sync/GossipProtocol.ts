
/**
 * Gossip Protocol - Epidemic Information Spread
 * 
 * Provides O(log N) memory propagation across agent instances using
 * epidemic-style gossip with push-pull semantics.
 * 
 * Features:
 * - Random peer selection with configurable fanout
 * - Push-pull gossip for efficient bidirectional sync
 * - Anti-entropy repair for eventual consistency
 * - Cryptographic randomness for peer selection
 * - Integration with CRDT merge operations
 * 
 * @module sync/GossipProtocol
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { NotImplementedError } from './adapters/CrdtSyncAdapter';
import { randomBytes } from 'crypto';
import type { ExperienceEvent, ExperienceBatch } from '../core/UniformSemanticAgentV2';
import { logger } from '../observability';

// ============================================================================
// Types
// ============================================================================

/**
 * Gossip protocol configuration.
 */
export interface GossipConfig {
  /** Number of peers to gossip to per round (default: 3) */
  fanout: number;
  /** Gossip interval in milliseconds (default: 500) */
  intervalMs: number;
  /** Maximum retries for failed gossip (default: 3) */
  maxRetries: number;
  /** Enable anti-entropy repair (default: true) */
  antiEntropyEnabled: boolean;
  /** Anti-entropy interval in milliseconds (default: 5000) */
  antiEntropyIntervalMs: number;
  /** Maximum message age before expiry (default: 60000ms) */
  messageExpiryMs: number;
  /** Enable cryptographic peer selection (default: true) */
  cryptographicSelection: boolean;
}

/**
 * Default gossip configuration.
 */
export const DEFAULT_GOSSIP_CONFIG: GossipConfig = {
  fanout: 3,
  intervalMs: 500,
  maxRetries: 3,
  antiEntropyEnabled: true,
  antiEntropyIntervalMs: 5000,
  messageExpiryMs: 60000,
  cryptographicSelection: true,
};

/**
 * Gossip peer representing another agent instance.
 */
export interface GossipPeer {
  /** Unique peer identifier */
  peerId: string;
  /** Instance ID of the peer */
  instanceId: string;
  /** Network endpoint for communication */
  endpoint: string;
  /** Last seen timestamp */
  lastSeen: number;
  /** Whether peer is currently active */
  active: boolean;
  /** Peer health score (0-1) */
  healthScore: number;
  /** Number of failed communications */
  failureCount: number;
  /** Peer metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Gossip message envelope.
 */
export interface GossipMessage {
  /** Unique message ID */
  messageId: string;
  /** Message type */
  type: GossipMessageType;
  /** Sender instance ID */
  senderId: string;
  /** Message timestamp */
  timestamp: number;
  /** Gossip round number */
  round: number;
  /** Time-to-live (hops remaining) */
  ttl: number;
  /** Message payload */
  payload: GossipPayload;
  /** Seen by instances (for deduplication) */
  seenBy: Set<string>;
  /** Message signature (optional) */
  signature?: string;
}

/**
 * Gossip message types.
 */
export type GossipMessageType = 
  | 'push'           // Push new data to peers
  | 'pull'           // Request data from peers
  | 'push-pull'      // Combined push and pull
  | 'anti-entropy'   // Repair missing data
  | 'heartbeat'      // Peer liveness check
  | 'membership';    // Membership update

/**
 * Gossip payload types.
 */
export type GossipPayload = 
  | PushPayload
  | PullPayload
  | PushPullPayload
  | AntiEntropyPayload
  | HeartbeatPayload
  | MembershipPayload;

export interface PushPayload {
  kind: 'push';
  events: ExperienceEvent[];
  memoryIds: string[];
}

export interface PullPayload {
  kind: 'pull';
  requestedIds: string[];
  knownIds: string[];
}

export interface PushPullPayload {
  kind: 'push-pull';
  events: ExperienceEvent[];
  memoryIds: string[];
  requestedIds: string[];
  knownIds: string[];
}

export interface AntiEntropyPayload {
  kind: 'anti-entropy';
  merkleRoot: string;
  missingIds: string[];
}

export interface HeartbeatPayload {
  kind: 'heartbeat';
  status: 'alive' | 'leaving';
  load: number;
}

export interface MembershipPayload {
  kind: 'membership';
  action: 'join' | 'leave' | 'update';
  peer: GossipPeer;
}

/**
 * Gossip statistics.
 */
export interface GossipStats {
  /** Current gossip round */
  currentRound: number;
  /** Total messages sent */
  messagesSent: number;
  /** Total messages received */
  messagesReceived: number;
  /** Total messages dropped (duplicates) */
  messagesDropped: number;
  /** Active peer count */
  activePeers: number;
  /** Total peer count */
  totalPeers: number;
  /** Average propagation time (ms) */
  avgPropagationMs: number;
  /** Anti-entropy repairs performed */
  antiEntropyRepairs: number;
}

/**
 * Gossip event types.
 */
export type GossipEventType =
  | 'message:received'
  | 'message:sent'
  | 'peer:joined'
  | 'peer:left'
  | 'peer:failed'
  | 'round:complete'
  | 'anti-entropy:complete';

// ============================================================================
// Gossip Protocol Implementation
// ============================================================================

/**
 * Gossip Protocol for epidemic information spread.
 * 
 * Implements O(log N) propagation using push-pull gossip with
 * anti-entropy repair for eventual consistency.
 */
export class GossipProtocol extends EventEmitter {
  private config: GossipConfig;
  private instanceId: string;
  private peers: Map<string, GossipPeer> = new Map();
  private seenMessages: Map<string, number> = new Map(); // messageId -> timestamp
  private currentRound: number = 0;
  private stats: GossipStats;
  private gossipInterval?: NodeJS.Timeout;
  private antiEntropyInterval?: NodeJS.Timeout;
  private running: boolean = false;
  private log = logger('gossip-protocol');

  // Callbacks for integration
  private sendCallback?: (peer: GossipPeer, message: GossipMessage) => Promise<boolean>;
  private receiveCallback?: (message: GossipMessage) => Promise<void>;
  private getLocalDataCallback?: () => Promise<{ events: ExperienceEvent[]; memoryIds: string[] }>;

  constructor(instanceId: string, config: Partial<GossipConfig> = {}) {
    super();
    this.instanceId = instanceId;
    this.config = { ...DEFAULT_GOSSIP_CONFIG, ...config };
    this.stats = this.initStats();
    this.log.info('GossipProtocol initialized', { instanceId, fanout: this.config.fanout });
  }

  private initStats(): GossipStats {
    return {
      currentRound: 0,
      messagesSent: 0,
      messagesReceived: 0,
      messagesDropped: 0,
      activePeers: 0,
      totalPeers: 0,
      avgPropagationMs: 0,
      antiEntropyRepairs: 0,
    };
  }

  // ==========================================================================
  // Peer Management
  // ==========================================================================

  /**
   * Add a gossip peer.
   */
  addPeer(peer: GossipPeer): void {
    this.peers.set(peer.peerId, peer);
    this.stats.totalPeers = this.peers.size;
    this.stats.activePeers = this.getActivePeers().length;
    this.emit('peer:joined', peer);
    this.log.debug('Peer added', { peerId: peer.peerId, endpoint: peer.endpoint });
  }

  /**
   * Remove a gossip peer.
   */
  removePeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      this.peers.delete(peerId);
      this.stats.totalPeers = this.peers.size;
      this.stats.activePeers = this.getActivePeers().length;
      this.emit('peer:left', peer);
      this.log.debug('Peer removed', { peerId });
    }
  }

  /**
   * Update peer status.
   */
  updatePeer(peerId: string, updates: Partial<GossipPeer>): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      Object.assign(peer, updates);
      this.stats.activePeers = this.getActivePeers().length;
    }
  }

  /**
   * Get all active peers.
   */
  getActivePeers(): GossipPeer[] {
    return Array.from(this.peers.values()).filter(p => p.active);
  }

  /**
   * Mark peer as seen (update lastSeen).
   */
  markPeerSeen(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.lastSeen = Date.now();
      peer.active = true;
    }
  }

  /**
   * Mark peer as failed.
   */
  markPeerFailed(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.failureCount++;
      peer.healthScore = Math.max(0, peer.healthScore - 0.1);
      if (peer.failureCount >= this.config.maxRetries) {
        peer.active = false;
        this.emit('peer:failed', peer);
      }
    }
  }

  // ==========================================================================
  // Peer Selection
  // ==========================================================================

  /**
   * Select random peers for gossip.
   * 
   * Uses cryptographic randomness when enabled for unpredictable selection.
   */
  selectRandomPeers(count?: number): GossipPeer[] {
    const n = count ?? this.config.fanout;
    const activePeers = this.getActivePeers();

    if (activePeers.length <= n) {
      return activePeers;
    }

    if (this.config.cryptographicSelection) {
      return this.cryptographicSelect(activePeers, n);
    }

    return this.shuffleSelect(activePeers, n);
  }

  /**
   * Cryptographic peer selection using secure random bytes.
   */
  private cryptographicSelect(peers: GossipPeer[], count: number): GossipPeer[] {
    const selected: GossipPeer[] = [];
    const available = [...peers];

    for (let i = 0; i < count && available.length > 0; i++) {
      const randomIndex = this.secureRandomIndex(available.length);
      selected.push(available[randomIndex]);
      available.splice(randomIndex, 1);
    }

    return selected;
  }

  /**
   * Generate secure random index.
   */
  private secureRandomIndex(max: number): number {
    const bytes = randomBytes(4);
    const value = bytes.readUInt32BE(0);
    return value % max;
  }

  /**
   * Fisher-Yates shuffle selection.
   */
  private shuffleSelect(peers: GossipPeer[], count: number): GossipPeer[] {
    const shuffled = [...peers];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, count);
  }

  // ==========================================================================
  // Gossip Operations
  // ==========================================================================

  /**
   * Start the gossip protocol.
   */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // Start gossip loop
    this.gossipInterval = setInterval(
      () => this.gossipRound(),
      this.config.intervalMs
    );

    // Start anti-entropy loop
    if (this.config.antiEntropyEnabled) {
      this.antiEntropyInterval = setInterval(
        () => this.antiEntropyRound(),
        this.config.antiEntropyIntervalMs
      );
    }

    this.log.info('Gossip protocol started');
  }

  /**
   * Stop the gossip protocol.
   */
  async stop(): Promise<void> {
    this.running = false;

    if (this.gossipInterval) {
      clearInterval(this.gossipInterval);
      this.gossipInterval = undefined;
    }

    if (this.antiEntropyInterval) {
      clearInterval(this.antiEntropyInterval);
      this.antiEntropyInterval = undefined;
    }

    this.log.info('Gossip protocol stopped');
  }

  /**
   * Execute a single gossip round.
   */
  private async gossipRound(): Promise<void> {
    this.currentRound++;
    this.stats.currentRound = this.currentRound;

    const targets = this.selectRandomPeers();
    if (targets.length === 0) {
      return;
    }

    // Get local data to gossip
    const localData = this.getLocalDataCallback
      ? await this.getLocalDataCallback()
      : { events: [], memoryIds: [] };

    // Create push-pull message
    const message = this.createMessage('push-pull', {
      kind: 'push-pull',
      events: localData.events,
      memoryIds: localData.memoryIds,
      requestedIds: [],
      knownIds: localData.memoryIds,
    });

    // Send to selected peers
    const results = await Promise.all(
      targets.map(peer => this.sendMessage(peer, message))
    );

    const successCount = results.filter(r => r).length;
    this.log.debug('Gossip round complete', {
      round: this.currentRound,
      targets: targets.length,
      success: successCount,
    });

    this.emit('round:complete', {
      round: this.currentRound,
      targets: targets.length,
      success: successCount,
    });

    // Clean up old seen messages
    this.cleanupSeenMessages();
  }

  /**
   * Execute anti-entropy repair round.
   */
  private async antiEntropyRound(): Promise<void> {
    const targets = this.selectRandomPeers(1); // Single peer for anti-entropy
    if (targets.length === 0) return;

    const peer = targets[0];
    const localData = this.getLocalDataCallback
      ? await this.getLocalDataCallback()
      : { events: [], memoryIds: [] };

    const message = this.createMessage('anti-entropy', {
      kind: 'anti-entropy',
      merkleRoot: this.computeMerkleRoot(localData.memoryIds),
      missingIds: [],
    });

    await this.sendMessage(peer, message);
    this.stats.antiEntropyRepairs++;

    this.emit('anti-entropy:complete', { peer: peer.peerId });
  }

  /**
   * Push events to random peers.
   */
  async pushGossip(events: ExperienceEvent[]): Promise<Map<string, boolean>> {
    const targets = this.selectRandomPeers();
    const results = new Map<string, boolean>();

    const message = this.createMessage('push', {
      kind: 'push',
      events,
      memoryIds: events.map(e => e.event_id),
    });

    for (const peer of targets) {
      const success = await this.sendMessage(peer, message);
      results.set(peer.peerId, success);
    }

    return results;
  }

  /**
   * Pull missing data from random peers.
   */
  async pullGossip(knownIds: string[]): Promise<Map<string, ExperienceEvent[]>> {
    const targets = this.selectRandomPeers();
    const results = new Map<string, ExperienceEvent[]>();

    const message = this.createMessage('pull', {
      kind: 'pull',
      requestedIds: [],
      knownIds,
    });

    for (const peer of targets) {
      await this.sendMessage(peer, message);
      // Results would come back via receiveMessage
      results.set(peer.peerId, []);
    }

    return results;
  }

  /**
   * Combined push-pull gossip (most efficient).
   */
  async pushPullGossip(
    events: ExperienceEvent[],
    knownIds: string[]
  ): Promise<{ push: Map<string, boolean>; pull: Map<string, ExperienceEvent[]> }> {
    const targets = this.selectRandomPeers();
    const pushResults = new Map<string, boolean>();
    const pullResults = new Map<string, ExperienceEvent[]>();

    const message = this.createMessage('push-pull', {
      kind: 'push-pull',
      events,
      memoryIds: events.map(e => e.event_id),
      requestedIds: [],
      knownIds,
    });

    for (const peer of targets) {
      const success = await this.sendMessage(peer, message);
      pushResults.set(peer.peerId, success);
      pullResults.set(peer.peerId, []);
    }

    return { push: pushResults, pull: pullResults };
  }

  // ==========================================================================
  // Message Handling
  // ==========================================================================

  /**
   * Create a gossip message.
   */
  private createMessage(type: GossipMessageType, payload: GossipPayload): GossipMessage {
    return {
      messageId: uuidv4(),
      type,
      senderId: this.instanceId,
      timestamp: Date.now(),
      round: this.currentRound,
      ttl: Math.ceil(Math.log2(this.peers.size + 1)) + 2, // O(log N) + buffer
      payload,
      seenBy: new Set([this.instanceId]),
    };
  }

  /**
   * Send a message to a peer.
   */
  private async sendMessage(peer: GossipPeer, message: GossipMessage): Promise<boolean> {
    try {
      if (this.sendCallback) {
        const success = await this.sendCallback(peer, message);
        if (success) {
          this.stats.messagesSent++;
          this.markPeerSeen(peer.peerId);
          this.emit('message:sent', { peer: peer.peerId, message });
        } else {
          this.markPeerFailed(peer.peerId);
        }
        return success;
      }
      throw new NotImplementedError('GossipProtocol.sendMessage: no sendCallback configured');
    } catch (error) {
      this.markPeerFailed(peer.peerId);
      this.log.error('Failed to send message', error as Error, { peerId: peer.peerId });
      return false;
    }
  }

  /**
   * Receive and process a gossip message.
   */
  async receiveMessage(message: GossipMessage): Promise<void> {
    // Check for duplicate
    if (this.seenMessages.has(message.messageId)) {
      this.stats.messagesDropped++;
      return;
    }

    // Check TTL
    if (message.ttl <= 0) {
      this.stats.messagesDropped++;
      return;
    }

    // Check expiry
    if (Date.now() - message.timestamp > this.config.messageExpiryMs) {
      this.stats.messagesDropped++;
      return;
    }

    // Mark as seen
    this.seenMessages.set(message.messageId, Date.now());
    message.seenBy.add(this.instanceId);
    this.stats.messagesReceived++;

    // Process message
    if (this.receiveCallback) {
      await this.receiveCallback(message);
    }

    this.emit('message:received', message);

    // Forward to other peers (epidemic spread)
    if (message.ttl > 1) {
      await this.forwardMessage(message);
    }
  }

  /**
   * Forward a message to other peers.
   */
  private async forwardMessage(message: GossipMessage): Promise<void> {
    const targets = this.selectRandomPeers()
      .filter(p => !message.seenBy.has(p.instanceId));

    if (targets.length === 0) return;

    const forwardedMessage: GossipMessage = {
      ...message,
      ttl: message.ttl - 1,
      seenBy: new Set(message.seenBy),
    };

    for (const peer of targets) {
      await this.sendMessage(peer, forwardedMessage);
    }
  }

  /**
   * Clean up old seen messages.
   */
  private cleanupSeenMessages(): void {
    const now = Date.now();
    const expiry = this.config.messageExpiryMs;

    for (const [messageId, timestamp] of this.seenMessages) {
      if (now - timestamp > expiry) {
        this.seenMessages.delete(messageId);
      }
    }
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /**
   * Compute simple Merkle root for anti-entropy.
   */
  private computeMerkleRoot(ids: string[]): string {
    if (ids.length === 0) return '';
    const sorted = [...ids].sort();
    // Simple hash - in production use proper Merkle tree
    return sorted.join(':').slice(0, 64);
  }

  /**
   * Calculate rounds needed to reach N instances.
   * O(log_fanout N)
   */
  roundsToReach(instanceCount: number): number {
    if (instanceCount <= 1) return 0;
    return Math.ceil(Math.log(instanceCount) / Math.log(this.config.fanout));
  }

  /**
   * Estimate propagation time to all instances.
   */
  estimatePropagationTime(instanceCount: number): number {
    const rounds = this.roundsToReach(instanceCount);
    return rounds * this.config.intervalMs;
  }

  /**
   * Get current statistics.
   */
  getStats(): GossipStats {
    return { ...this.stats };
  }

  // ==========================================================================
  // Callback Registration
  // ==========================================================================

  /**
   * Set callback for sending messages.
   */
  onSend(callback: (peer: GossipPeer, message: GossipMessage) => Promise<boolean>): void {
    this.sendCallback = callback;
  }

  /**
   * Set callback for receiving messages.
   */
  onReceive(callback: (message: GossipMessage) => Promise<void>): void {
    this.receiveCallback = callback;
  }

  /**
   * Set callback for getting local data.
   */
  onGetLocalData(callback: () => Promise<{ events: ExperienceEvent[]; memoryIds: string[] }>): void {
    this.getLocalDataCallback = callback;
  }
}

// ============================================================================
// Gossip Network Manager
// ============================================================================

/**
 * Manages a network of gossip protocol instances.
 */
export class GossipNetworkManager extends EventEmitter {
  private protocols: Map<string, GossipProtocol> = new Map();
  private log = logger('gossip-network');

  /**
   * Create a new gossip protocol for an instance.
   */
  createProtocol(instanceId: string, config?: Partial<GossipConfig>): GossipProtocol {
    const protocol = new GossipProtocol(instanceId, config);
    this.protocols.set(instanceId, protocol);

    // Wire up events
    protocol.on('peer:joined', (peer) => this.emit('peer:joined', { instanceId, peer }));
    protocol.on('peer:left', (peer) => this.emit('peer:left', { instanceId, peer }));
    protocol.on('message:received', (msg) => this.emit('message:received', { instanceId, msg }));

    this.log.info('Protocol created', { instanceId });
    return protocol;
  }

  /**
   * Get protocol for an instance.
   */
  getProtocol(instanceId: string): GossipProtocol | undefined {
    return this.protocols.get(instanceId);
  }

  /**
   * Remove protocol for an instance.
   */
  async removeProtocol(instanceId: string): Promise<void> {
    const protocol = this.protocols.get(instanceId);
    if (protocol) {
      await protocol.stop();
      this.protocols.delete(instanceId);
      this.log.info('Protocol removed', { instanceId });
    }
  }

  /**
   * Connect two instances as peers.
   */
  connectPeers(instanceId1: string, instanceId2: string, endpoint1: string, endpoint2: string): void {
    const protocol1 = this.protocols.get(instanceId1);
    const protocol2 = this.protocols.get(instanceId2);

    if (protocol1 && protocol2) {
      protocol1.addPeer({
        peerId: uuidv4(),
        instanceId: instanceId2,
        endpoint: endpoint2,
        lastSeen: Date.now(),
        active: true,
        healthScore: 1.0,
        failureCount: 0,
      });

      protocol2.addPeer({
        peerId: uuidv4(),
        instanceId: instanceId1,
        endpoint: endpoint1,
        lastSeen: Date.now(),
        active: true,
        healthScore: 1.0,
        failureCount: 0,
      });

      this.log.debug('Peers connected', { instanceId1, instanceId2 });
    }
  }

  /**
   * Start all protocols.
   */
  async startAll(): Promise<void> {
    for (const protocol of this.protocols.values()) {
      await protocol.start();
    }
  }

  /**
   * Stop all protocols.
   */
  async stopAll(): Promise<void> {
    for (const protocol of this.protocols.values()) {
      await protocol.stop();
    }
  }

  /**
   * Get network statistics.
   */
  getNetworkStats(): Map<string, GossipStats> {
    const stats = new Map<string, GossipStats>();
    for (const [instanceId, protocol] of this.protocols) {
      stats.set(instanceId, protocol.getStats());
    }
    return stats;
  }
}

// ============================================================================
// Exports
// ============================================================================

export {
  GossipProtocol as default,
};

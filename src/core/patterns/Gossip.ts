/**
 * Pattern #4: Gossip Protocol (O(log N) Experience Synchronization)
 * 
 * Universal Pattern: Information dissemination in distributed systems
 * Natural Analogy: Social networks spreading information
 * Mathematical Property: O(log N) dissemination with Byzantine tolerance
 * 
 * Application: Agent experience synchronization, knowledge propagation
 */

import { hashToHex } from './Hashing';
import { LamportClock } from './LogicalTime';

// Lightweight signature helper using hashing; replace with real keypair-backed
// signatures when available in the calling environment.
class SimpleSignatures {
  sign(payload: string): string {
    return hashToHex(payload);
  }
  
  verify(payload: string, signature: string): boolean {
    return hashToHex(payload) === signature;
  }
}

// Placeholder Byzantine checker; extend with real detection as needed.
class ByzantineChecker {
  detectFaults(_messages?: GossipMessage[], _keyFn?: (msg: GossipMessage) => string): boolean {
    return false;
  }
}

export interface GossipMessage {
  id: string;
  nodeId: string;
  timestamp: number;
  type: 'experiences' | 'state' | 'knowledge' | 'memories';
  data: any;
  signature: string;
  logicalClock: number;
}

export interface NodeInfo {
  id: string;
  address: string;
  lastSeen: number;
  status: 'active' | 'suspect' | 'dead';
  version: number;
}

export class GossipProtocol {
  private nodeId: string;
  private nodes: Map<string, NodeInfo>;
  private messageQueue: GossipMessage[];
  private seenMessages: Set<string>;
  private gossipInterval: number;
  private timer: NodeJS.Timeout | null;
  private signatures: SimpleSignatures;
  private logicalClock: LamportClock;
  private byzantineCheck: ByzantineChecker;

  constructor(nodeId: string, gossipInterval: number = 1000) {
    this.nodeId = nodeId;
    this.nodes = new Map();
    this.messageQueue = [];
    this.seenMessages = new Set();
    this.gossipInterval = gossipInterval;
    this.timer = null;
    this.signatures = new SimpleSignatures();
    this.logicalClock = new LamportClock(nodeId);
    this.byzantineCheck = new ByzantineChecker();
  }

  /**
   * Add a node to the gossip network
   */
  addNode(nodeId: string, address: string): void {
    this.nodes.set(nodeId, {
      id: nodeId,
      address: address,
      lastSeen: Date.now(),
      status: 'active',
      version: 0
    });
  }

  /**
   * Remove a node from the gossip network
   */
  removeNode(nodeId: string): void {
    this.nodes.delete(nodeId);
  }

  /**
   * Send a gossip message to a random subset of nodes
   */
  sendGossip(type: 'experiences' | 'state' | 'knowledge' | 'memories', data: any): void {
    const id = `${this.nodeId}-${Date.now()}-${Math.random()}`;
    const clockValue = this.logicalClock.tick();
    
    const message: GossipMessage = {
      id: id,
      nodeId: this.nodeId,
      timestamp: Date.now(),
      type: type,
      data: data,
      signature: this.signatures.sign(JSON.stringify(data)),
      logicalClock: clockValue
    };

    // Verify the message is valid before sending
    if (this.verifyMessage(message)) {
      this.messageQueue.push(message);
      this.seenMessages.add(id);
    }
  }

  /**
   * Verify the integrity and authenticity of a gossip message
   */
  private verifyMessage(message: GossipMessage): boolean {
    try {
      // Verify the signature
      const isValidSignature = this.signatures.verify(
        JSON.stringify(message.data),
        message.signature
      );

      // Check for Byzantine faults
      const isByzantine = this.byzantineCheck.detectFaults(
        [message],
        (msg: GossipMessage) => msg.signature
      );

      return isValidSignature && !isByzantine;
    } catch (error) {
      console.error('Gossip message verification failed:', error);
      return false;
    }
  }

  /**
   * Process and gossip out a received message
   */
  receiveGossip(message: GossipMessage): boolean {
    // Check if we've seen this message before
    if (this.seenMessages.has(message.id)) {
      return false;
    }

    // Verify the message
    if (!this.verifyMessage(message)) {
      return false;
    }

    // Update the logical clock based on the received message
    this.logicalClock.update(message.logicalClock);

    // Mark the message as seen
    this.seenMessages.add(message.id);
    
    // Process the message based on its type
    this.processMessage(message);
    
    // Add to our queue to gossip to others
    this.messageQueue.push(message);
    
    return true;
  }

  /**
   * Process the message based on its type
   */
  private processMessage(message: GossipMessage): void {
    switch (message.type) {
      case 'experiences':
        this.processExperiences(message);
        break;
      case 'state':
        this.processState(message);
        break;
      case 'knowledge':
        this.processKnowledge(message);
        break;
      case 'memories':
        this.processMemories(message);
        break;
      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * Process experience data from other agents
   */
  private processExperiences(message: GossipMessage): void {
    const experiences = Array.isArray(message.data) ? message.data : [];
    console.log(`Processing ${experiences.length} experiences from node ${message.nodeId}`);
  }

  /**
   * Process state data from other agents
   */
  private processState(message: GossipMessage): void {
    const state = message.data || {};
    console.log(`Processing state update from node ${state.nodeId || message.nodeId}`);
  }

  /**
   * Process knowledge data from other agents
   */
  private processKnowledge(message: GossipMessage): void {
    const knowledge = message.data || {};
    console.log(`Processing knowledge update from node ${knowledge.sourceNodeId || message.nodeId}`);
  }

  /**
   * Process memory data from other agents
   */
  private processMemories(message: GossipMessage): void {
    const memories = Array.isArray(message.data) ? message.data : [];
    console.log(`Processing ${memories.length} memories from node ${message.nodeId}`);
  }

  /**
   * Select random nodes for gossip dissemination (O(log N) algorithm)
   */
  private selectRandomNodes(count: number): NodeInfo[] {
    const activeNodes = Array.from(this.nodes.values())
      .filter(node => node.status === 'active')
      .filter(node => node.id !== this.nodeId); // Don't gossip to ourselves

    if (activeNodes.length === 0) {
      return [];
    }

    // For O(log N) gossip, we only select log(N) random nodes
    const maxNodes = Math.ceil(Math.log(activeNodes.length + 1));
    const selectedCount = Math.min(count, maxNodes, activeNodes.length);

    const selected: NodeInfo[] = [];
    const usedIndices = new Set<number>();

    for (let i = 0; i < selectedCount; i++) {
      let randomIndex;
      do {
        randomIndex = Math.floor(Math.random() * activeNodes.length);
      } while (usedIndices.has(randomIndex));

      usedIndices.add(randomIndex);
      selected.push(activeNodes[randomIndex]);
    }

    return selected;
  }

  /**
   * Gossip messages to random nodes
   */
  private gossipToRandomNodes(): void {
    if (this.messageQueue.length === 0) {
      return;
    }

    const randomNodes = this.selectRandomNodes(3); // Gossip to 3 random nodes

    // Take the most recent messages
    const messagesToSend = this.messageQueue.slice(-5); // Last 5 messages

    for (const node of randomNodes) {
      this.gossipToNode(node, messagesToSend);
    }

    // Keep only unprocessed messages in the queue
    this.messageQueue = this.messageQueue.filter(
      msg => !messagesToSend.includes(msg)
    );
  }

  /**
   * Gossip messages to a specific node
   */
  private gossipToNode(node: NodeInfo, messages: GossipMessage[]): void {
    // In a real implementation, this would send messages over the network
    console.log(`Gossiping ${messages.length} messages to node ${node.id}`);
    
    // For simulation purposes, we'll directly call the receive method
    // In real implementation, this would be an actual network call
    for (const message of messages) {
      // Simulate network delay
      setTimeout(() => {
        this.receiveGossip(message);
      }, Math.random() * 100);
    }
  }

  /**
   * Start the gossip protocol
   */
  start(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = setInterval(() => {
      this.gossipToRandomNodes();
      this.maintainNodeStatus();
    }, this.gossipInterval);
  }

  /**
   * Stop the gossip protocol
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Maintain and update node statuses
   */
  private maintainNodeStatus(): void {
    const now = Date.now();
    const timeout = 5000; // 5 seconds timeout

    for (const [nodeId, nodeInfo] of this.nodes.entries()) {
      if (now - nodeInfo.lastSeen > timeout) {
        if (nodeInfo.status === 'active') {
          // Mark as suspect first
          this.nodes.set(nodeId, { ...nodeInfo, status: 'suspect' });
        } else if (nodeInfo.status === 'suspect' && now - nodeInfo.lastSeen > timeout * 2) {
          // Mark as dead if still unresponsive
          this.nodes.set(nodeId, { ...nodeInfo, status: 'dead' });
        }
      }
    }
  }

  /**
   * Get the current active nodes in the network
   */
  getActiveNodes(): NodeInfo[] {
    return Array.from(this.nodes.values()).filter(node => node.status === 'active');
  }

  /**
   * Get statistics about the gossip network
   */
  getStats(): any {
    const activeNodes = this.getActiveNodes();
    return {
      nodeId: this.nodeId,
      totalNodes: this.nodes.size,
      activeNodes: activeNodes.length,
      messageQueueSize: this.messageQueue.length,
      seenMessagesCount: this.seenMessages.size,
      gossipInterval: this.gossipInterval
    };
  }
}

/**
 * Specialized Gossip Protocol for Experience Synchronization
 */
export class ExperienceGossipProtocol extends GossipProtocol {
  constructor(nodeId: string, gossipInterval: number = 1000) {
    super(nodeId, gossipInterval);
  }

  /**
   * Synchronize experiences with other agents in the network
   */
  syncExperiences(experiences: any[]): void {
    this.sendGossip('experiences', experiences);
  }

  /**
   * Broadcast a single experience to the network
   */
  broadcastExperience(experience: any): void {
    this.sendGossip('experiences', [experience]);
  }
}

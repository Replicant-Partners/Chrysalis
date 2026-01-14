/**
 * Change Propagation System
 *
 * Manages cross-adapter change propagation with support for multiple channels
 * (broadcast, targeted, event-driven), message queuing with TTL, priority-based
 * processing, and subscription management.
 *
 * @module ai-maintenance/cross-cutting/change-propagation-system
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { AgentFramework } from '../../adapters/protocol-types';
import {
  PropagationChannel,
  PropagationMessage,
  ModificationProposal,
  PatternType,
  ProposalType,
} from './types';
import { AdapterStatus } from '../../adapters/unified-adapter';

// ============================================================================
// Internal Interfaces
// ============================================================================

/**
 * Channel handler interface.
 */
interface ChannelHandler {
  channel: PropagationChannel;
  send: (message: PropagationMessage) => Promise<void>;
}

/**
 * Propagation subscription.
 */
interface PropagationSubscription {
  id: string;
  protocol: AgentFramework;
  handler: (message: PropagationMessage) => Promise<void>;
  filter?: (message: PropagationMessage) => boolean;
  priority: number;
}

/**
 * Subscription options.
 */
interface SubscriptionOptions {
  filter: (message: PropagationMessage) => boolean;
  priority: number;
}

/**
 * Propagation options.
 */
interface PropagationOptions {
  channel: PropagationChannel;
  source: AgentFramework | 'system';
  targets: AgentFramework[] | 'all';
  priority: number;
  ttl: number;
  requiresAck: boolean;
}

/**
 * Propagation configuration.
 */
interface PropagationConfig {
  enabled: boolean;
  defaultChannel: PropagationChannel;
  maxQueueSize: number;
  processingIntervalMs: number;
  retryAttempts: number;
  ackTimeoutMs: number;
}

/**
 * Pattern detection result.
 */
interface PatternDetection {
  id: string;
  timestamp: string;
  protocol: AgentFramework;
  patternType: PatternType;
  description: string;
  confidence: number;
  evidence: Record<string, unknown>;
  suggestedAction: string;
}

// ============================================================================
// Change Propagation System
// ============================================================================

/**
 * Manages change propagation across adapters.
 */
export class ChangePropagationSystem {
  private channels: Map<PropagationChannel, ChannelHandler> = new Map();
  private subscribers: Map<AgentFramework, PropagationSubscription[]> = new Map();
  private messageQueue: PropagationMessage[] = [];
  private emitter: EventEmitter = new EventEmitter();
  private config: PropagationConfig;
  private processingInterval?: NodeJS.Timeout;

  constructor(config: Partial<PropagationConfig> = {}) {
    this.config = {
      enabled: true,
      defaultChannel: 'broadcast',
      maxQueueSize: 1000,
      processingIntervalMs: 100,
      retryAttempts: 3,
      ackTimeoutMs: 5000,
      ...config,
    };

    this.initializeChannels();
    this.startProcessing();
  }

  /**
   * Initialize propagation channels.
   */
  private initializeChannels(): void {
    // Broadcast channel - sends to all adapters
    this.channels.set('broadcast', {
      channel: 'broadcast',
      send: async (message) => {
        const subscribers = this.getAllSubscribers();
        for (const sub of subscribers) {
          await sub.handler(message);
        }
      },
    });

    // Targeted channel - sends to specific adapters
    this.channels.set('targeted', {
      channel: 'targeted',
      send: async (message) => {
        if (message.targets === 'all') {
          return this.channels.get('broadcast')!.send(message);
        }
        for (const target of message.targets) {
          const subs = this.subscribers.get(target) || [];
          for (const sub of subs) {
            await sub.handler(message);
          }
        }
      },
    });

    // Event-driven channel - uses event emitter
    this.channels.set('event-driven', {
      channel: 'event-driven',
      send: async (message) => {
        this.emitter.emit(message.changeType, message);
      },
    });
  }

  /**
   * Start message processing loop.
   */
  private startProcessing(): void {
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, this.config.processingIntervalMs);
  }

  /**
   * Stop message processing.
   */
  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
  }

  /**
   * Process queued messages.
   */
  private async processQueue(): Promise<void> {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (!message) break;

      // Check TTL
      const age = Date.now() - new Date(message.timestamp).getTime();
      if (age > message.ttl) {
        this.emitter.emit('message-expired', message);
        continue;
      }

      try {
        const handler = this.channels.get(message.channel);
        if (handler) {
          await handler.send(message);
          this.emitter.emit('message-sent', message);
        }
      } catch (error) {
        this.emitter.emit('message-failed', { message, error });
      }
    }
  }

  /**
   * Subscribe to changes for a protocol.
   */
  subscribe(
    protocol: AgentFramework,
    handler: (message: PropagationMessage) => Promise<void>,
    options: Partial<SubscriptionOptions> = {}
  ): string {
    const subscriptionId = `sub-${protocol}-${Date.now()}`;
    const subscription: PropagationSubscription = {
      id: subscriptionId,
      protocol,
      handler,
      filter: options.filter,
      priority: options.priority ?? 0,
    };

    const existing = this.subscribers.get(protocol) || [];
    existing.push(subscription);
    this.subscribers.set(protocol, existing);

    return subscriptionId;
  }

  /**
   * Unsubscribe from changes.
   */
  unsubscribe(subscriptionId: string): boolean {
    for (const [, subs] of Array.from(this.subscribers.entries())) {
      const index = subs.findIndex((s) => s.id === subscriptionId);
      if (index >= 0) {
        subs.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  /**
   * Propagate a change.
   */
  propagate(
    changeType: string,
    payload: Record<string, unknown>,
    options: Partial<PropagationOptions> = {}
  ): string {
    const message: PropagationMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timestamp: new Date().toISOString(),
      channel: options.channel ?? this.config.defaultChannel,
      source: options.source ?? 'system',
      targets: options.targets ?? 'all',
      changeType,
      payload,
      priority: options.priority ?? 0,
      ttl: options.ttl ?? 60000,
      requiresAck: options.requiresAck ?? false,
    };

    this.messageQueue.push(message);
    this.messageQueue.sort((a, b) => b.priority - a.priority);

    // Trim queue if too large
    while (this.messageQueue.length > this.config.maxQueueSize) {
      this.messageQueue.pop();
    }

    this.emitter.emit('message-queued', message);
    return message.id;
  }

  /**
   * Propagate adaptation change.
   */
  propagateAdaptation(
    source: AgentFramework,
    adaptation: ModificationProposal
  ): string {
    return this.propagate(
      'adaptation',
      {
        proposalId: adaptation.id,
        protocol: adaptation.protocol,
        type: adaptation.type,
        description: adaptation.description,
        confidence: adaptation.confidence,
      },
      {
        source,
        channel: 'broadcast',
        priority: 1,
      }
    );
  }

  /**
   * Propagate pattern detection.
   */
  propagatePatternDetection(detection: PatternDetection): string {
    return this.propagate(
      'pattern-detected',
      {
        detectionId: detection.id,
        protocol: detection.protocol,
        patternType: detection.patternType,
        confidence: detection.confidence,
      },
      {
        source: detection.protocol,
        channel: 'broadcast',
        priority: 0.8,
      }
    );
  }

  /**
   * Propagate health change.
   */
  propagateHealthChange(
    protocol: AgentFramework,
    oldStatus: AdapterStatus,
    newStatus: AdapterStatus
  ): string {
    return this.propagate(
      'health-change',
      {
        protocol,
        oldStatus,
        newStatus,
        timestamp: new Date().toISOString(),
      },
      {
        source: protocol,
        channel: 'broadcast',
        priority: newStatus === 'error' ? 1 : 0.5,
      }
    );
  }

  /**
   * Get all subscribers.
   */
  private getAllSubscribers(): PropagationSubscription[] {
    const all: PropagationSubscription[] = [];
    for (const subs of Array.from(this.subscribers.values())) {
      all.push(...subs);
    }
    return all;
  }

  /**
   * Subscribe to events.
   */
  on(event: string, handler: (data: unknown) => void): void {
    this.emitter.on(event, handler);
  }
}

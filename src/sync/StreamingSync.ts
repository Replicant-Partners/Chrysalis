/**
 * Streaming Sync - Real-time experience synchronization
 * 
 * Continuously streams high-priority experiences from instances
 * to source agent with minimal latency.
 */

import type { ExperienceEvent } from '../core/UniversalAgentV2';
import * as crypto from 'crypto';

/**
 * Streaming sync configuration
 */
export interface StreamingSyncConfig {
  enabled: boolean;
  interval_ms: number;
  batch_size: number;
  priority_threshold: number;
}

/**
 * Event queue
 */
interface EventQueue {
  events: ExperienceEvent[];
  lastFlush: number;
}

/**
 * Streaming Sync Implementation
 */
export class StreamingSync {
  private queues: Map<string, EventQueue> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private configs: Map<string, StreamingSyncConfig> = new Map();
  private flushHandlers: Map<string, (events: ExperienceEvent[]) => Promise<void>> = new Map();
  
  /**
   * Initialize streaming sync for instance
   */
  async initialize(
    instanceId: string,
    config: StreamingSyncConfig,
    onFlush?: (events: ExperienceEvent[]) => Promise<void>
  ): Promise<void> {
    console.log(`  → Initializing streaming sync (${config.interval_ms}ms interval)`);
    
    this.configs.set(instanceId, config);
    if (onFlush) {
      this.flushHandlers.set(instanceId, onFlush);
    }
    
    this.queues.set(instanceId, {
      events: [],
      lastFlush: Date.now()
    });
    
    // Start periodic flush timer
    const timer = setInterval(
      () => this.flushQueue(instanceId),
      config.interval_ms
    );
    
    this.timers.set(instanceId, timer);
  }
  
  /**
   * Stream single event
   */
  async streamEvent(
    instanceId: string,
    event: ExperienceEvent
  ): Promise<void> {
    const config = this.configs.get(instanceId);
    if (!config) {
      throw new Error(`Streaming not initialized for instance ${instanceId}`);
    }
    
    // Check priority threshold
    if (event.priority < config.priority_threshold) {
      // Event priority too low for streaming
      return;
    }
    
    const queue = this.queues.get(instanceId);
    if (!queue) return;
    
    // Add to queue
    queue.events.push(event);
    
    // Flush if batch size reached
    if (queue.events.length >= config.batch_size) {
      await this.flushQueue(instanceId);
    }
  }
  
  /**
   * Flush event queue
   */
  private async flushQueue(instanceId: string): Promise<void> {
    const queue = this.queues.get(instanceId);
    if (!queue || queue.events.length === 0) return;
    
    const events = queue.events.splice(0);  // Clear queue
    const handler = this.flushHandlers.get(instanceId);
    if (handler) {
      await handler(events);
    } else {
      console.log(`Streaming ${events.length} events from ${instanceId}...`);
      for (const event of events) {
        console.log(`  → Event ${event.event_type} (priority: ${event.priority})`);
      }
    }
    
    queue.lastFlush = Date.now();
  }
  
  /**
   * Stop streaming sync
   */
  async stop(instanceId: string): Promise<void> {
    // Flush remaining events
    await this.flushQueue(instanceId);
    
    // Clear timer
    const timer = this.timers.get(instanceId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(instanceId);
    }
    
    // Clean up
    this.queues.delete(instanceId);
    this.configs.delete(instanceId);
    this.flushHandlers.delete(instanceId);
  }
  
  /**
   * Get queue status
   */
  getQueueSize(instanceId: string): number {
    return this.queues.get(instanceId)?.events.length || 0;
  }
}

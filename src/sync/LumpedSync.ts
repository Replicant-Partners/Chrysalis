/**
 * Lumped Sync - Batched experience synchronization
 * 
 * Periodically syncs accumulated experiences in batches
 * for cost-effective learning aggregation.
 */

import type { ExperienceBatch } from '../core/UniversalAgentV2';

/**
 * Lumped sync configuration
 */
export interface LumpedSyncConfig {
  enabled: boolean;
  batch_interval: string;
  max_batch_size: number;
  compression: boolean;
}

/**
 * Lumped Sync Implementation
 */
export class LumpedSync {
  private configs: Map<string, LumpedSyncConfig> = new Map();
  private scheduledTimers: Map<string, NodeJS.Timeout> = new Map();
  
  /**
   * Initialize lumped sync for instance
   */
  async initialize(
    instanceId: string,
    config: LumpedSyncConfig
  ): Promise<void> {
    console.log(`  → Initializing lumped sync (${config.batch_interval} interval)`);
    
    this.configs.set(instanceId, config);
    
    // Schedule periodic sync
    const interval = this.parseDuration(config.batch_interval);
    const timer = setInterval(
      () => this.triggerSync(instanceId),
      interval
    );
    
    this.scheduledTimers.set(instanceId, timer);
  }
  
  /**
   * Process experience batch
   */
  async processBatch(
    instanceId: string,
    batch: ExperienceBatch
  ): Promise<{ processed: boolean; event_count: number }> {
    console.log(`Processing lumped batch from ${instanceId}...`);
    console.log(`  Memories: ${batch.events.memories.length}`);
    console.log(`  Skills: ${batch.events.skills.length}`);
    console.log(`  Knowledge: ${batch.events.knowledge.length}`);
    console.log(`  Interactions: ${batch.events.interactions.length}`);
    
    const config = this.configs.get(instanceId);
    
    // Decompress if needed
    if (config?.compression) {
      // Would decompress batch here
    }
    
    // Batch processed successfully
    return {
      processed: true,
      event_count: batch.event_count
    };
  }
  
  /**
   * Trigger sync request to instance
   */
  private async triggerSync(instanceId: string): Promise<void> {
    console.log(`Triggering lumped sync for instance ${instanceId}...`);
    
    // This would send a request to the instance to send its batch
    // For now, just log
  }
  
  /**
   * Stop lumped sync
   */
  async stop(instanceId: string): Promise<void> {
    const timer = this.scheduledTimers.get(instanceId);
    if (timer) {
      clearInterval(timer);
      this.scheduledTimers.delete(instanceId);
    }
    
    this.configs.delete(instanceId);
  }
  
  // Helper methods
  
  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)(ms|s|m|h|d)$/);
    if (!match) return 3600000; // Default 1 hour
    
    const [, value, unit] = match;
    const num = parseInt(value, 10);
    
    switch (unit) {
      case 'ms': return num;
      case 's': return num * 1000;
      case 'm': return num * 60 * 1000;
      case 'h': return num * 60 * 60 * 1000;
      case 'd': return num * 24 * 60 * 60 * 1000;
      default: return 3600000;
    }
  }
}

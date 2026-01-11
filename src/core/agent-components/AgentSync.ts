/**
 * Agent Sync Component
 * 
 * Manages experience synchronization configuration.
 * 
 * Single Responsibility: Sync configuration and merge strategy
 */

import { ExperienceSyncConfig, SyncProtocol, ExperienceTransportConfig } from '../UniformSemanticAgentV2';

/**
 * Agent Sync Manager
 */
export class AgentSync {
  private data: ExperienceSyncConfig;

  constructor(data?: Partial<ExperienceSyncConfig>) {
    this.data = {
      enabled: data?.enabled ?? true,
      default_protocol: data?.default_protocol || 'streaming',
      transport: data?.transport,
      streaming: data?.streaming || {
        enabled: true,
        interval_ms: 1000,
        batch_size: 10,
        priority_threshold: 0.5,
      },
      lumped: data?.lumped || {
        enabled: false,
        batch_interval: '1h',
        max_batch_size: 100,
        compression: true,
      },
      check_in: data?.check_in || {
        enabled: false,
        schedule: '0 * * * *',
        include_full_state: false,
      },
      merge_strategy: data?.merge_strategy || {
        conflict_resolution: 'latest_wins',
        memory_deduplication: true,
        skill_aggregation: 'max',
        knowledge_verification_threshold: 0.7,
      },
    };
  }

  /**
   * Enable/disable sync
   */
  setEnabled(enabled: boolean): void {
    this.data.enabled = enabled;
  }

  /**
   * Set default protocol
   */
  setDefaultProtocol(protocol: SyncProtocol): void {
    this.data.default_protocol = protocol;
  }

  /**
   * Configure streaming sync
   */
  configureStreaming(config: Partial<NonNullable<ExperienceSyncConfig['streaming']>>): void {
    this.data.streaming = { ...this.data.streaming!, ...config };
  }

  /**
   * Configure lumped sync
   */
  configureLumped(config: Partial<NonNullable<ExperienceSyncConfig['lumped']>>): void {
    this.data.lumped = { ...this.data.lumped!, ...config };
  }

  /**
   * Configure check-in sync
   */
  configureCheckIn(config: Partial<NonNullable<ExperienceSyncConfig['check_in']>>): void {
    this.data.check_in = { ...this.data.check_in!, ...config };
  }

  /**
   * Set merge strategy
   */
  setMergeStrategy(strategy: Partial<ExperienceSyncConfig['merge_strategy']>): void {
    this.data.merge_strategy = { ...this.data.merge_strategy, ...strategy };
  }

  /**
   * Set transport configuration
   */
  setTransport(transport: ExperienceTransportConfig): void {
    this.data.transport = transport;
  }

  /**
   * Get active protocol configuration
   */
  getActiveProtocolConfig(): {
    protocol: SyncProtocol;
    config: NonNullable<ExperienceSyncConfig['streaming']> | 
            NonNullable<ExperienceSyncConfig['lumped']> | 
            NonNullable<ExperienceSyncConfig['check_in']>;
  } | null {
    if (!this.data.enabled) return null;

    switch (this.data.default_protocol) {
      case 'streaming':
        return this.data.streaming?.enabled 
          ? { protocol: 'streaming', config: this.data.streaming }
          : null;
      case 'lumped':
        return this.data.lumped?.enabled
          ? { protocol: 'lumped', config: this.data.lumped }
          : null;
      case 'check_in':
        return this.data.check_in?.enabled
          ? { protocol: 'check_in', config: this.data.check_in }
          : null;
    }
  }

  /**
   * Check if sync is healthy
   */
  isHealthy(): boolean {
    if (!this.data.enabled) return true;
    return this.getActiveProtocolConfig() !== null;
  }

  // Getters
  get enabled(): boolean { return this.data.enabled; }
  get defaultProtocol(): SyncProtocol { return this.data.default_protocol; }
  get transport(): ExperienceTransportConfig | undefined { return this.data.transport; }
  get streaming(): ExperienceSyncConfig['streaming'] { return this.data.streaming; }
  get lumped(): ExperienceSyncConfig['lumped'] { return this.data.lumped; }
  get checkIn(): ExperienceSyncConfig['check_in'] { return this.data.check_in; }
  get mergeStrategy(): ExperienceSyncConfig['merge_strategy'] { return this.data.merge_strategy; }

  toData(): ExperienceSyncConfig {
    return { ...this.data };
  }
}

export function validateSync(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Sync config must be an object'] };
  }
  const sync = data as Record<string, unknown>;
  if (typeof sync.enabled !== 'boolean') errors.push('Sync must have enabled boolean');
  if (!sync.default_protocol) errors.push('Sync must have default_protocol');
  if (!sync.merge_strategy) errors.push('Sync must have merge_strategy');
  return { valid: errors.length === 0, errors };
}

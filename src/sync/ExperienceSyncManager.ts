/**
 * Experience Sync Manager - Coordinate experience synchronization
 *
 * Manages streaming, lumped, and check-in sync protocols for
 * continuous learning from deployed instances.
 */

import type {
  SemanticAgent,
  ExperienceEvent,
  ExperienceBatch,
  SyncResult,
  SyncProtocol,
  ExperienceSyncConfig,
  ExperienceTransportConfig,
  ExperienceTransportType
} from './core/SemanticAgent';
import { StreamingSync } from './StreamingSync';
import { LumpedSync } from './LumpedSync';
import { CheckInSync } from './CheckInSync';
import { MemoryMerger } from '../experience/MemoryMerger';
import { SkillAccumulator } from '../experience/SkillAccumulator';
import { KnowledgeIntegrator } from '../experience/KnowledgeIntegrator';
import { createExperienceTransport, ExperienceTransport, TransportPayload } from './ExperienceTransport';
import { logger } from '../observability';
import { vectorIndexFromEnv } from '../memory/VectorIndexFactory';
import { createMetricsSinkFromEnv } from '../observability/Metrics';
import { defaultMemorySanitizer } from '../experience/MemorySanitizer';
import {
  parseTimeString,
  DEFAULT_SYNC_INTERVAL_MS,
  MS_PER_SECOND,
  MS_PER_MINUTE,
  MS_PER_HOUR,
  MS_PER_DAY
} from '../shared/constants/timing';
import { getLogger, CentralizedLogger } from '../observability/CentralizedLogger';

/**
 * Sync status
 */
export interface SyncStatus {
  instance_id: string;
  protocol: SyncProtocol;
  transport_type: ExperienceTransportType;
  transport_endpoint?: string;
  last_sync: string;
  next_sync: string;
  backlog_size: number;
  is_syncing: boolean;
  error: string | null;
}

/**
 * Merge result
 */
export interface MergeResult {
  merged_at: string;
  memories_added: number;
  memories_updated: number;
  memories_deduplicated: number;

  skills_added: number;
  skills_updated: number;
  skills_removed: number;

  knowledge_added: number;
  knowledge_verified: number;

  conflicts: {
    total: number;
    resolved: number;
    queued: number;
  };
}

/**
 * Experience Sync Manager
 */
export class ExperienceSyncManager {
  private streamingSync: StreamingSync;
  private lumpedSync: LumpedSync;
  private checkInSync: CheckInSync;

  private memoryMerger: MemoryMerger;
  private skillAccumulator: SkillAccumulator;
  private knowledgeIntegrator: KnowledgeIntegrator;

  private syncStatus: Map<string, SyncStatus> = new Map();
  private transports: Map<string, ExperienceTransport> = new Map();
  private sourceAgents: Map<string, SemanticAgent> = new Map();
  private syncConfigs: Map<string, ExperienceSyncConfig> = new Map();
  private readonly log = logger('ExperienceSyncManager');
  private readonly centralizedLogger: CentralizedLogger;

  private initialized = false;

  constructor(opts?: Record<string, never>) {
    this.streamingSync = new StreamingSync();
    this.lumpedSync = new LumpedSync();
    this.checkInSync = new CheckInSync();

    this.centralizedLogger = getLogger('ExperienceSyncManager');

    const indexEnv = vectorIndexFromEnv();
    this.memoryMerger = new MemoryMerger({
      vector_index_type: indexEnv.kind,
      vector_index_options: indexEnv.options,
      metrics_sink: createMetricsSinkFromEnv(),
      sanitize: (content, source) => defaultMemorySanitizer(content, source)
    });
    this.skillAccumulator = new SkillAccumulator();
    this.knowledgeIntegrator = new KnowledgeIntegrator();
  }

  /**
   * Initialize the sync manager and its dependencies.
   * Must be called before processing any sync operations if using
   * embedding-based similarity or vector indexing.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.memoryMerger.initialize();
    this.initialized = true;
  }

  /**
   * Initialize sync for instance
   */
  async initializeSync(
    instanceId: string,
    protocol: SyncProtocol,
    config: ExperienceSyncConfig,
    sourceAgent?: SemanticAgent,
    syncEndpoint?: string,
    overrideTransport?: ExperienceTransportConfig
  ): Promise<void> {
    this.logger.info(`Initializing sync`, { protocol, instanceId });

    if (sourceAgent) {
      this.sourceAgents.set(instanceId, sourceAgent);
    }

    // Store config for later use (e.g., calculating next sync)
    this.syncConfigs.set(instanceId, config);

    const transportConfig = this.resolveTransportConfig(
      config,
      syncEndpoint,
      overrideTransport
    );

    const transport = createExperienceTransport(
      instanceId,
      transportConfig,
      async (payload: TransportPayload) => this.handleTransportDelivery(payload)
    );

    this.transports.set(instanceId, transport);

    const status: SyncStatus = {
      instance_id: instanceId,
      protocol,
      transport_type: transportConfig.type,
      transport_endpoint: this.getTransportEndpoint(transportConfig),
      last_sync: new Date().toISOString(),
      next_sync: this.calculateNextSync(protocol, config),
      backlog_size: 0,
      is_syncing: false,
      error: null
    };

    this.syncStatus.set(instanceId, status);

    await this.emitEvent({
      kind: 'sync.init',
      timestamp: new Date().toISOString(),
      sourceInstance: instanceId,
      decision: protocol,
      details: { transport: transportConfig.type }
    });

    // Initialize protocol-specific sync
    switch (protocol) {
      case 'streaming':
        if (config.streaming?.enabled) {
          await this.streamingSync.initialize(
            instanceId,
            config.streaming,
            async (events) => this.sendStreamingEvents(instanceId, events)
          );
        }
        break;

      case 'lumped':
        if (config.lumped?.enabled) {
          await this.lumpedSync.initialize(instanceId, config.lumped);
        }
        break;

      case 'check_in':
        if (config.check_in?.enabled) {
          await this.checkInSync.initialize(instanceId, config.check_in);
        }
        break;
    }

    this.logger.info(`Sync initialized successfully`, { instanceId });
  }

  /**
   * Stream single event (real-time)
   */
  async streamEvent(
    instanceId: string,
    event: ExperienceEvent
  ): Promise<void> {
    const status = this.syncStatus.get(instanceId);
    if (!status || status.protocol !== 'streaming') {
      throw new Error(`Instance ${instanceId} not configured for streaming`);
    }

    await this.streamingSync.streamEvent(instanceId, event);

    status.backlog_size++;
    await this.emitEvent({
      kind: 'sync.event',
      timestamp: new Date().toISOString(),
      sourceInstance: instanceId,
      decision: 'stream',
      details: { event_type: event.event_type }
    });
  }

  /**
   * Send batch (lumped sync)
   */
  async sendBatch(
    instanceId: string,
    batch: ExperienceBatch
  ): Promise<{ batch_id: string; processed: boolean }> {
    const status = this.syncStatus.get(instanceId);
    if (!status || status.protocol !== 'lumped') {
      throw new Error(`Instance ${instanceId} not configured for lumped sync`);
    }

    this.logger.info(`Processing batch`, {
      instanceId,
      eventCount: batch.event_count,
      timeRangeStart: batch.timestamp_start,
      timeRangeEnd: batch.timestamp_end
    });

    const result = await this.lumpedSync.processBatch(instanceId, batch);
    const transport = this.transports.get(instanceId);
    if (transport) {
      await transport.sendBatch(instanceId, batch);
    }

    status.last_sync = new Date().toISOString();
    status.backlog_size = 0;
    const storedConfig = this.syncConfigs.get(instanceId);
    status.next_sync = this.calculateNextSync(status.protocol, storedConfig ?? {} as ExperienceSyncConfig);

    await this.emitEvent({
      kind: 'sync.batch',
      timestamp: new Date().toISOString(),
      sourceInstance: instanceId,
      decision: 'lumped',
      details: { events: batch.event_count }
    });

    return {
      batch_id: batch.batch_id,
      processed: true
    };
  }

  /**
   * Handle check-in
   */
  async checkIn(
    instanceId: string,
    state: any
  ): Promise<MergeResult> {
    const status = this.syncStatus.get(instanceId);
    if (!status || status.protocol !== 'check_in') {
      throw new Error(`Instance ${instanceId} not configured for check-in sync`);
    }

    const transport = this.transports.get(instanceId);
    if (transport) {
      await transport.sendCheckIn(instanceId, state);
    }

    this.logger.info(`Processing check-in`, { instanceId });

    const result = await this.checkInSync.processCheckIn(instanceId, state);

    status.last_sync = new Date().toISOString();
    status.backlog_size = 0;
    const checkInConfig = this.syncConfigs.get(instanceId);
    status.next_sync = this.calculateNextSync(status.protocol, checkInConfig ?? {} as ExperienceSyncConfig);

    await this.emitEvent({
      kind: 'sync.check_in',
      timestamp: new Date().toISOString(),
      sourceInstance: instanceId,
      decision: 'check_in'
    });

    return result;
  }

  /**
   * Process sync event and merge into source agent
   */
  async receiveSyncEvent(
    instanceId: string,
    sourceAgent: SemanticAgent,
    event: ExperienceEvent
  ): Promise<void> {
    switch (event.event_type) {
      case 'memory':
        await this.memoryMerger.addMemory(sourceAgent, event.data, instanceId);
        break;

      case 'skill':
        await this.skillAccumulator.updateSkill(sourceAgent, event.data, instanceId);
        break;

      case 'knowledge':
        await this.knowledgeIntegrator.addKnowledge(
          sourceAgent,
          event.data as import('../experience/KnowledgeIntegrator').KnowledgeInput,
          instanceId
        );
        break;

      case 'characteristic':
        await this.updateCharacteristic(sourceAgent, event.data, instanceId);
        break;
    }
  }

  /**
   * Merge experiences from batch
   */
  async mergeExperienceBatch(
    sourceAgent: SemanticAgent,
    batch: ExperienceBatch
  ): Promise<MergeResult> {
    this.logger.info(`Merging experience batch`, { instanceId: batch.instance_id });

    const result: MergeResult = {
      merged_at: new Date().toISOString(),
      memories_added: 0,
      memories_updated: 0,
      memories_deduplicated: 0,
      skills_added: 0,
      skills_updated: 0,
      skills_removed: 0,
      knowledge_added: 0,
      knowledge_verified: 0,
      conflicts: {
        total: 0,
        resolved: 0,
        queued: 0
      }
    };

    // Merge memories
    if (batch.events.memories.length > 0) {
      const memoryResult = await this.memoryMerger.mergeBatch(
        sourceAgent,
        batch.events.memories,
        batch.instance_id
      );
      result.memories_added = memoryResult.added;
      result.memories_updated = memoryResult.updated;
      result.memories_deduplicated = memoryResult.deduplicated;
      await this.emitEvent({
        kind: 'merge.memories',
        timestamp: new Date().toISOString(),
        sourceInstance: batch.instance_id,
        decision: 'merge',
        details: {
          added: memoryResult.added,
          deduped: memoryResult.deduplicated
        }
      });
    }

    // Accumulate skills
    if (batch.events.skills.length > 0) {
      const skillResult = await this.skillAccumulator.accumulateSkills(
        sourceAgent,
        batch.events.skills,
        batch.instance_id
      );
      result.skills_added = skillResult.added;
      result.skills_updated = skillResult.updated;
      await this.emitEvent({
        kind: 'merge.skills',
        timestamp: new Date().toISOString(),
        sourceInstance: batch.instance_id,
        decision: 'merge',
        details: {
          added: skillResult.added,
          updated: skillResult.updated
        }
      });
    }

    // Integrate knowledge
    if (batch.events.knowledge.length > 0) {
      const knowledgeResult = await this.knowledgeIntegrator.integrate(
        sourceAgent,
        batch.events.knowledge,
        batch.instance_id
      );
      result.knowledge_added = knowledgeResult.added;
      result.knowledge_verified = knowledgeResult.verified;
      await this.emitEvent({
        kind: 'merge.knowledge',
        timestamp: new Date().toISOString(),
        sourceInstance: batch.instance_id,
        decision: 'merge',
        details: {
          added: knowledgeResult.added,
          verified: knowledgeResult.verified
        }
      });
    }

    // Update metadata
    if (!sourceAgent.metadata.evolution) {
      sourceAgent.metadata.evolution = {
        total_deployments: 0,
        total_syncs: 0,
        total_skills_learned: 0,
        total_knowledge_acquired: 0,
        total_conversations: 0,
        last_evolution: new Date().toISOString(),
        evolution_rate: 0
      };
    }

    sourceAgent.metadata.evolution.total_syncs++;
    sourceAgent.metadata.evolution.total_skills_learned += result.skills_added;
    sourceAgent.metadata.evolution.total_knowledge_acquired += result.knowledge_added;
    sourceAgent.metadata.evolution.last_evolution = new Date().toISOString();

    this.logger.info(`Merge complete`, {
      memoriesAdded: result.memories_added,
      skillsAdded: result.skills_added,
      knowledgeAdded: result.knowledge_added
    });

    return result;
  }

  /**
   * Get sync status
   */
  getSyncStatus(instanceId: string): SyncStatus | null {
    return this.syncStatus.get(instanceId) || null;
  }

  /**
   * Get sync backlog size
   */
  getSyncBacklog(instanceId: string): number {
    return this.syncStatus.get(instanceId)?.backlog_size || 0;
  }

  // Helper methods
  private async sendStreamingEvents(
    instanceId: string,
    events: ExperienceEvent[]
  ): Promise<void> {
    const transport = this.transports.get(instanceId);
    if (!transport) {
      this.logger.warn(`No transport configured, dropping streaming events`, { instanceId });
      return;
    }
    await transport.sendEvents(instanceId, events);
  }

  private async handleTransportDelivery(payload: TransportPayload): Promise<void> {
    const sourceAgent = this.sourceAgents.get(payload.instanceId);
    if (!sourceAgent) {
      return;
    }

    switch (payload.kind) {
      case 'events':
        for (const event of payload.events) {
          await this.receiveSyncEvent(payload.instanceId, sourceAgent, event);
        }
        break;
      case 'batch':
        await this.mergeExperienceBatch(sourceAgent, payload.batch);
        break;
      case 'check_in':
        await this.checkInSync.processCheckIn(payload.instanceId, payload.state);
        break;
    }
  }

  private resolveTransportConfig(
    config: ExperienceSyncConfig,
    syncEndpoint?: string,
    overrideTransport?: ExperienceTransportConfig
  ): ExperienceTransportConfig {
    if (overrideTransport) return overrideTransport;

    if (config.transport) {
      // Ensure https endpoint uses sync endpoint if provided
      if (config.transport.type === 'https' && syncEndpoint) {
        return {
          ...config.transport,
          https: {
            endpoint: config.transport.https?.endpoint || syncEndpoint,
            auth_token: config.transport.https?.auth_token,
            headers: config.transport.https?.headers,
            verify_tls: config.transport.https?.verify_tls
          }
        };
      }
      return config.transport;
    }

    // Default: HTTPS using provided sync endpoint
    return {
      type: 'https',
      https: {
        endpoint: syncEndpoint || 'https://localhost:8443/sync'
      }
    };
  }

  private getTransportEndpoint(config: ExperienceTransportConfig): string | undefined {
    switch (config.type) {
      case 'https':
        return config.https?.endpoint;
      case 'websocket':
        return config.websocket?.url;
      case 'mcp':
        return config.mcp?.server;
      default:
        return undefined;
    }
  }

  private calculateNextSync(protocol: SyncProtocol, config: ExperienceSyncConfig): string {
    switch (protocol) {
      case 'streaming':
        // Streaming is continuous, next sync is immediate
        return new Date(Date.now() + (config.streaming?.interval_ms || 500)).toISOString();

      case 'lumped':
        // Parse interval (e.g., "1h" → 3600000ms)
        const interval = parseTimeString(config.lumped?.batch_interval || '1h', MS_PER_HOUR);
        return new Date(Date.now() + interval).toISOString();

      case 'check_in':
        // Parse cron schedule to next occurrence
        // Simplified: assume hourly for now
        return new Date(Date.now() + MS_PER_HOUR).toISOString();

      default:
        return new Date(Date.now() + DEFAULT_SYNC_INTERVAL_MS).toISOString();
    }
  }

  private async emitEvent(event: { kind: string; timestamp: string; [key: string]: unknown }): Promise<void> {
    this.log.debug('event', { event });
  }

  private async updateCharacteristic(
    agent: SemanticAgent,
    data: any,
    instanceId: string
  ): Promise<void> {
    throw new Error(
      'NotImplementedError: updateCharacteristic is not implemented. ' +
      'Personality trait updates require actual agent mutation logic.'
    );
  }
}

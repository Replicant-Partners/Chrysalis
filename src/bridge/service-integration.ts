/**
 * Bridge Service Integration
 * 
 * Integrates the Universal Agent Bridge with Chrysalis services:
 * - Discovery: Adapter registry and capability discovery
 * - Events: Bridge events for translation operations
 * - Persistence: Store canonical agents in the ledger/registry
 * 
 * @module bridge/service-integration
 */

import { EventEmitter } from 'events';
import { BridgeOrchestrator, TranslationResult, TranslationRequest } from './orchestrator';
import { NativeAgent, CanonicalAgent, AgentFramework, BaseAdapter } from '../adapters/base-adapter';

// ============================================================================
// Event Types for Bridge Operations
// ============================================================================

/**
 * Bridge event primitives (aligned with Chrysalis event system)
 */
export type BridgePrimitive = 
  | 'translation'
  | 'adapter'
  | 'agent'
  | 'canonical';

/**
 * Bridge event types
 */
export type BridgeEventType =
  | 'AgentTranslated'
  | 'AgentIngested'
  | 'AgentStored'
  | 'AdapterRegistered'
  | 'AdapterDeregistered'
  | 'TranslationFailed'
  | 'ValidationFailed'
  | 'CanonicalUpdated';

/**
 * Bridge event payload base
 */
export interface BridgeEventPayload {
  timestamp: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Agent translated event payload
 */
export interface AgentTranslatedPayload extends BridgeEventPayload {
  sourceFramework: AgentFramework;
  targetFramework: AgentFramework;
  agentUri: string;
  fidelityScore: number;
  warnings: number;
}

/**
 * Agent ingested event payload
 */
export interface AgentIngestedPayload extends BridgeEventPayload {
  sourceFramework: AgentFramework;
  agentUri: string;
  agentId: string;
  name: string;
  fidelityScore: number;
}

/**
 * Agent stored event payload
 */
export interface AgentStoredPayload extends BridgeEventPayload {
  agentUri: string;
  agentId: string;
  versionId: string;
  graphUri: string;
}

/**
 * Adapter registered event payload
 */
export interface AdapterRegisteredPayload extends BridgeEventPayload {
  framework: AgentFramework;
  adapterName: string;
  version: string;
}

/**
 * Translation failed event payload
 */
export interface TranslationFailedPayload extends BridgeEventPayload {
  sourceFramework: AgentFramework;
  targetFramework?: AgentFramework;
  error: string;
  errorCode: string;
}

/**
 * Bridge event (aligned with AgentEvent structure)
 */
export interface BridgeEvent<TPayload extends BridgeEventPayload = BridgeEventPayload> {
  eventId: string;
  type: BridgeEventType;
  primitive: BridgePrimitive;
  createdAt: string;
  payload: TPayload;
}

// ============================================================================
// Discovery Service
// ============================================================================

/**
 * Adapter discovery information
 */
export interface AdapterDiscoveryInfo {
  framework: AgentFramework;
  name: string;
  version: string;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  lastHealthCheck: string;
  registeredAt: string;
}

/**
 * Discovery query options
 */
export interface DiscoveryQuery {
  framework?: AgentFramework;
  healthStatus?: 'healthy' | 'degraded' | 'unhealthy';
}

/**
 * Adapter Discovery Service
 * 
 * Manages adapter registration, discovery, and health monitoring.
 */
export class AdapterDiscoveryService {
  private readonly adapters = new Map<AgentFramework, AdapterDiscoveryInfo>();
  private readonly healthCheckInterval: number;
  private healthCheckTimer?: ReturnType<typeof setInterval>;
  
  constructor(
    private readonly orchestrator: BridgeOrchestrator,
    options: { healthCheckInterval?: number } = {}
  ) {
    this.healthCheckInterval = options.healthCheckInterval ?? 60000; // 1 minute default
  }

  /**
   * Start the discovery service
   */
  start(): void {
    this.refreshAdapters();
    this.healthCheckTimer = setInterval(() => this.performHealthChecks(), this.healthCheckInterval);
  }

  /**
   * Stop the discovery service
   */
  stop(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  /**
   * Refresh adapter registry from orchestrator
   */
  refreshAdapters(): void {
    const frameworks = this.orchestrator.getRegisteredFrameworks();
    const now = new Date().toISOString();
    
    for (const framework of frameworks) {
      const adapter = this.orchestrator.getAdapter(framework);
      
      if (adapter) {
        this.adapters.set(framework, {
          framework,
          name: adapter.constructor.name,
          version: '1.0.0',
          healthStatus: 'healthy',
          lastHealthCheck: now,
          registeredAt: this.adapters.get(framework)?.registeredAt ?? now,
        });
      }
    }
  }

  /**
   * Perform health checks on all adapters
   */
  private performHealthChecks(): void {
    const now = new Date().toISOString();
    
    for (const [framework, info] of this.adapters) {
      // For now, consider adapters healthy if they're still registered
      const isRegistered = this.orchestrator.hasAdapter(framework);
      
      this.adapters.set(framework, {
        ...info,
        healthStatus: isRegistered ? 'healthy' : 'unhealthy',
        lastHealthCheck: now,
      });
    }
  }

  /**
   * Discover adapters matching query
   */
  discover(query?: DiscoveryQuery): AdapterDiscoveryInfo[] {
    const results: AdapterDiscoveryInfo[] = [];
    
    for (const info of this.adapters.values()) {
      // Filter by framework
      if (query?.framework && info.framework !== query.framework) {
        continue;
      }
      
      // Filter by health status
      if (query?.healthStatus && info.healthStatus !== query.healthStatus) {
        continue;
      }
      
      results.push(info);
    }
    
    return results;
  }

  /**
   * Get adapter info by framework
   */
  getAdapter(framework: AgentFramework): AdapterDiscoveryInfo | undefined {
    return this.adapters.get(framework);
  }

  /**
   * List all registered adapters
   */
  listAdapters(): AdapterDiscoveryInfo[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Get adapter count
   */
  getAdapterCount(): number {
    return this.adapters.size;
  }
}

// ============================================================================
// Event Bus Service
// ============================================================================

/**
 * Event subscription callback
 */
export type EventCallback<T extends BridgeEventPayload = BridgeEventPayload> = 
  (event: BridgeEvent<T>) => void | Promise<void>;

/**
 * Event subscription handle
 */
export interface EventSubscription {
  id: string;
  eventType: BridgeEventType | '*';
  callback: EventCallback;
  createdAt: string;
}

/**
 * Bridge Event Bus Service
 * 
 * Publishes and subscribes to bridge events.
 * Integrates with Chrysalis event system patterns.
 */
export class BridgeEventBus extends EventEmitter {
  private readonly subscriptions = new Map<string, EventSubscription>();
  private eventCounter = 0;
  private readonly eventHistory: BridgeEvent[] = [];
  private readonly maxHistorySize: number;

  constructor(options: { maxHistorySize?: number } = {}) {
    super();
    this.maxHistorySize = options.maxHistorySize ?? 1000;
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `bridge_evt_${Date.now()}_${++this.eventCounter}`;
  }

  /**
   * Generate subscription ID
   */
  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * Publish a bridge event
   */
  publish<T extends BridgeEventPayload>(
    type: BridgeEventType,
    primitive: BridgePrimitive,
    payload: T
  ): BridgeEvent<T> {
    const event: BridgeEvent<T> = {
      eventId: this.generateEventId(),
      type,
      primitive,
      createdAt: new Date().toISOString(),
      payload: {
        ...payload,
        timestamp: payload.timestamp ?? new Date().toISOString(),
      },
    };

    // Store in history
    this.eventHistory.push(event as BridgeEvent);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Emit to subscribers
    this.emit(type, event);
    this.emit('*', event);

    return event;
  }

  /**
   * Subscribe to events
   */
  subscribe<T extends BridgeEventPayload>(
    eventType: BridgeEventType | '*',
    callback: EventCallback<T>
  ): string {
    const subscriptionId = this.generateSubscriptionId();
    
    const subscription: EventSubscription = {
      id: subscriptionId,
      eventType,
      callback: callback as EventCallback,
      createdAt: new Date().toISOString(),
    };

    this.subscriptions.set(subscriptionId, subscription);
    this.on(eventType, callback);

    return subscriptionId;
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    this.off(subscription.eventType, subscription.callback);
    this.subscriptions.delete(subscriptionId);
    return true;
  }

  /**
   * Get event history
   */
  getHistory(options?: {
    type?: BridgeEventType;
    primitive?: BridgePrimitive;
    limit?: number;
    since?: string;
  }): BridgeEvent[] {
    let events = [...this.eventHistory];

    if (options?.type) {
      events = events.filter(e => e.type === options.type);
    }

    if (options?.primitive) {
      events = events.filter(e => e.primitive === options.primitive);
    }

    if (options?.since) {
      const sinceDate = new Date(options.since);
      events = events.filter(e => new Date(e.createdAt) >= sinceDate);
    }

    if (options?.limit) {
      events = events.slice(-options.limit);
    }

    return events;
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory.length = 0;
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * List active subscriptions
   */
  listSubscriptions(): EventSubscription[] {
    return Array.from(this.subscriptions.values());
  }
}

// ============================================================================
// Persistence Service
// ============================================================================

/**
 * Stored agent record
 */
export interface StoredAgent {
  uri: string;
  agentId: string;
  name: string;
  framework: AgentFramework;
  versionId: string;
  graphUri: string;
  fidelityScore: number;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * Agent query options
 */
export interface AgentQuery {
  framework?: AgentFramework;
  name?: string;
  minFidelity?: number;
  limit?: number;
  offset?: number;
}

/**
 * Agent version record
 */
export interface AgentVersion {
  versionId: string;
  agentUri: string;
  graphUri: string;
  validFrom: string;
  validTo?: string;
  fidelityScore: number;
  changeType: 'create' | 'update' | 'translation';
  changeMetadata?: Record<string, unknown>;
}

/**
 * Translation record for persistence
 */
export interface TranslationRecord {
  id: string;
  sourceFramework: AgentFramework;
  targetFramework: AgentFramework;
  fidelityScore: number;
  timestamp: string;
  canonicalUri: string;
  sourceUri: string;
  targetUri: string;
  warnings: string[];
  durationMs: number;
}

/**
 * Bridge Persistence Service
 * 
 * Stores and retrieves canonical agents and translation history.
 * Maintains version history for temporal queries.
 */
export class BridgePersistenceService {
  private readonly agents = new Map<string, StoredAgent>();
  private readonly versions = new Map<string, AgentVersion[]>();
  private readonly translations = new Map<string, TranslationRecord>();
  private versionCounter = 0;
  private translationCounter = 0;

  constructor(
    private readonly orchestrator: BridgeOrchestrator,
    private readonly eventBus?: BridgeEventBus
  ) {}

  /**
   * Generate version ID
   */
  private generateVersionId(): string {
    return `v_${Date.now()}_${++this.versionCounter}`;
  }

  /**
   * Generate translation ID
   */
  private generateTranslationId(): string {
    return `trans_${Date.now()}_${++this.translationCounter}`;
  }

  /**
   * Store a canonical agent
   */
  storeAgent(
    canonicalUri: string,
    agent: { id: string; name: string },
    options?: {
      framework?: AgentFramework;
      fidelityScore?: number;
      metadata?: Record<string, unknown>;
    }
  ): StoredAgent {
    const now = new Date().toISOString();
    const versionId = this.generateVersionId();
    const graphUri = `urn:chrysalis:graph:${agent.id}:${versionId}`;
    
    const existing = this.agents.get(canonicalUri);
    
    const storedAgent: StoredAgent = {
      uri: canonicalUri,
      agentId: agent.id,
      name: agent.name,
      framework: options?.framework ?? 'usa',
      versionId,
      graphUri,
      fidelityScore: options?.fidelityScore ?? 1.0,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      metadata: options?.metadata,
    };

    // Store agent
    this.agents.set(canonicalUri, storedAgent);

    // Store version record
    const agentVersions = this.versions.get(canonicalUri) ?? [];
    
    // Close previous version
    if (agentVersions.length > 0) {
      const lastVersion = agentVersions[agentVersions.length - 1];
      lastVersion.validTo = now;
    }

    // Add new version
    const version: AgentVersion = {
      versionId,
      agentUri: canonicalUri,
      graphUri,
      validFrom: now,
      fidelityScore: storedAgent.fidelityScore,
      changeType: existing ? 'update' : 'create',
      changeMetadata: options?.metadata,
    };
    agentVersions.push(version);
    this.versions.set(canonicalUri, agentVersions);

    // Emit event
    if (this.eventBus) {
      this.eventBus.publish<AgentStoredPayload>(
        'AgentStored',
        'agent',
        {
          timestamp: now,
          agentUri: canonicalUri,
          agentId: agent.id,
          versionId,
          graphUri,
        }
      );
    }

    return storedAgent;
  }

  /**
   * Get agent by URI
   */
  getAgent(uri: string): StoredAgent | undefined {
    return this.agents.get(uri);
  }

  /**
   * Get agent at specific point in time
   */
  getAgentAtTime(uri: string, timestamp: string): AgentVersion | undefined {
    const versions = this.versions.get(uri);
    if (!versions) {
      return undefined;
    }

    const targetTime = new Date(timestamp);
    
    for (const version of versions) {
      const validFrom = new Date(version.validFrom);
      const validTo = version.validTo ? new Date(version.validTo) : new Date();
      
      if (targetTime >= validFrom && targetTime <= validTo) {
        return version;
      }
    }

    return undefined;
  }

  /**
   * Query agents
   */
  queryAgents(query?: AgentQuery): StoredAgent[] {
    let results = Array.from(this.agents.values());

    if (query?.framework) {
      results = results.filter(a => a.framework === query.framework);
    }

    if (query?.name) {
      const nameLower = query.name.toLowerCase();
      results = results.filter(a => a.name.toLowerCase().includes(nameLower));
    }

    if (query?.minFidelity !== undefined) {
      results = results.filter(a => a.fidelityScore >= query.minFidelity!);
    }

    // Apply pagination
    const offset = query?.offset ?? 0;
    const limit = query?.limit ?? 100;
    results = results.slice(offset, offset + limit);

    return results;
  }

  /**
   * Get agent version history
   */
  getVersionHistory(uri: string): AgentVersion[] {
    return this.versions.get(uri) ?? [];
  }

  /**
   * Store translation record from a TranslationResult
   */
  storeTranslationResult(result: TranslationResult, sourceUri: string, targetUri: string): TranslationRecord {
    const record: TranslationRecord = {
      id: this.generateTranslationId(),
      sourceFramework: result.sourceFramework,
      targetFramework: result.targetFramework,
      fidelityScore: result.fidelityScore,
      timestamp: new Date().toISOString(),
      canonicalUri: result.canonical?.uri ?? '',
      sourceUri,
      targetUri,
      warnings: result.warnings ?? [],
      durationMs: result.durationMs,
    };
    
    this.translations.set(record.id, record);
    return record;
  }

  /**
   * Store translation record directly
   */
  storeTranslation(record: TranslationRecord): void {
    this.translations.set(record.id, record);
  }

  /**
   * Get translation by ID
   */
  getTranslation(id: string): TranslationRecord | undefined {
    return this.translations.get(id);
  }

  /**
   * Query translations
   */
  queryTranslations(options?: {
    sourceFramework?: AgentFramework;
    targetFramework?: AgentFramework;
    minFidelity?: number;
    limit?: number;
  }): TranslationRecord[] {
    let results = Array.from(this.translations.values());

    if (options?.sourceFramework) {
      results = results.filter(t => t.sourceFramework === options.sourceFramework);
    }

    if (options?.targetFramework) {
      results = results.filter(t => t.targetFramework === options.targetFramework);
    }

    if (options?.minFidelity !== undefined) {
      results = results.filter(t => t.fidelityScore >= options.minFidelity!);
    }

    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Delete agent
   */
  deleteAgent(uri: string): boolean {
    const existed = this.agents.has(uri);
    this.agents.delete(uri);
    this.versions.delete(uri);
    return existed;
  }

  /**
   * Get storage statistics
   */
  getStats(): {
    totalAgents: number;
    totalVersions: number;
    totalTranslations: number;
    byFramework: Record<AgentFramework, number>;
    avgFidelity: number;
  } {
    const byFramework: Record<string, number> = {};
    let totalFidelity = 0;
    let totalVersions = 0;

    for (const agent of this.agents.values()) {
      byFramework[agent.framework] = (byFramework[agent.framework] ?? 0) + 1;
      totalFidelity += agent.fidelityScore;
    }

    for (const versions of this.versions.values()) {
      totalVersions += versions.length;
    }

    return {
      totalAgents: this.agents.size,
      totalVersions,
      totalTranslations: this.translations.size,
      byFramework: byFramework as Record<AgentFramework, number>,
      avgFidelity: this.agents.size > 0 ? totalFidelity / this.agents.size : 0,
    };
  }

  /**
   * Clear all data (useful for testing)
   */
  clear(): void {
    this.agents.clear();
    this.versions.clear();
    this.translations.clear();
    this.versionCounter = 0;
    this.translationCounter = 0;
  }
}

// ============================================================================
// Integrated Bridge Service
// ============================================================================

/**
 * Bridge service configuration
 */
export interface BridgeServiceConfig {
  healthCheckInterval?: number;
  maxEventHistory?: number;
  enableEventLogging?: boolean;
}

/**
 * Bridge service statistics
 */
export interface BridgeServiceStats {
  discovery: {
    adapterCount: number;
    healthyAdapters: number;
    frameworks: AgentFramework[];
  };
  events: {
    totalEvents: number;
    subscriptionCount: number;
    recentEvents: number;
  };
  persistence: {
    totalAgents: number;
    totalVersions: number;
    totalTranslations: number;
    avgFidelity: number;
  };
}

/**
 * Ingest result
 */
export interface IngestResult {
  canonical: CanonicalAgent;
  canonicalUri: string;
  fidelityScore: number;
}

/**
 * Integrated Bridge Service
 * 
 * Combines discovery, events, and persistence into a unified service
 * that wraps the BridgeOrchestrator with full Chrysalis integration.
 */
export class IntegratedBridgeService {
  public readonly orchestrator: BridgeOrchestrator;
  public readonly discovery: AdapterDiscoveryService;
  public readonly events: BridgeEventBus;
  public readonly persistence: BridgePersistenceService;

  private readonly config: Required<BridgeServiceConfig>;

  constructor(
    orchestrator: BridgeOrchestrator,
    config: BridgeServiceConfig = {}
  ) {
    this.orchestrator = orchestrator;
    this.config = {
      healthCheckInterval: config.healthCheckInterval ?? 60000,
      maxEventHistory: config.maxEventHistory ?? 1000,
      enableEventLogging: config.enableEventLogging ?? true,
    };

    // Initialize services
    this.events = new BridgeEventBus({ maxHistorySize: this.config.maxEventHistory });
    this.discovery = new AdapterDiscoveryService(orchestrator, {
      healthCheckInterval: this.config.healthCheckInterval,
    });
    this.persistence = new BridgePersistenceService(orchestrator, this.events);

    // Setup event logging
    if (this.config.enableEventLogging) {
      this.setupEventLogging();
    }
  }

  /**
   * Setup automatic event logging
   */
  private setupEventLogging(): void {
    this.events.subscribe<BridgeEventPayload>('*', (_event) => {
      // Log could be integrated with Chrysalis LedgerService
      // For now, just track in memory
    });
  }

  /**
   * Start all services
   */
  start(): void {
    this.discovery.start();
  }

  /**
   * Stop all services
   */
  stop(): void {
    this.discovery.stop();
  }

  /**
   * Ingest an agent from native format
   */
  async ingestAgent(
    native: NativeAgent,
    options?: { correlationId?: string; metadata?: Record<string, unknown> }
  ): Promise<{
    canonical: CanonicalAgent;
    stored: StoredAgent;
    event: BridgeEvent<AgentIngestedPayload>;
  }> {
    const timestamp = new Date().toISOString();
    
    // Translate to canonical
    const canonical = await this.orchestrator.toCanonical(native);
    if (!canonical) {
      throw new Error(`Failed to convert agent to canonical form`);
    }

    // Extract agent info
    const agentId = this.extractAgentId(canonical);
    const canonicalUri = canonical.uri;
    
    // Store in persistence
    const stored = this.persistence.storeAgent(
      canonicalUri,
      { id: agentId, name: agentId },
      {
        framework: native.framework,
        fidelityScore: canonical.metadata.fidelityScore,
        metadata: options?.metadata,
      }
    );

    // Emit event
    const event = this.events.publish<AgentIngestedPayload>(
      'AgentIngested',
      'agent',
      {
        timestamp,
        sourceFramework: native.framework,
        agentUri: canonicalUri,
        agentId,
        name: agentId,
        fidelityScore: canonical.metadata.fidelityScore,
        correlationId: options?.correlationId,
      }
    );

    return { canonical, stored, event };
  }

  /**
   * Translate an agent between formats
   */
  async translateAgent(
    native: NativeAgent,
    targetFramework: AgentFramework,
    options?: { correlationId?: string; metadata?: Record<string, unknown> }
  ): Promise<{
    result: TranslationResult;
    stored: StoredAgent;
    event: BridgeEvent<AgentTranslatedPayload>;
  }> {
    const timestamp = new Date().toISOString();

    // Translate
    const result = await this.orchestrator.translate({
      agent: native,
      targetFramework,
    });

    if (!result.success || !result.canonical) {
      throw new Error(result.errors?.join(', ') ?? 'Translation failed');
    }

    // Extract agent info
    const agentId = this.extractAgentId(result.canonical);
    const canonicalUri = result.canonical.uri;

    // Store canonical representation
    const stored = this.persistence.storeAgent(
      canonicalUri,
      { id: agentId, name: agentId },
      {
        framework: native.framework,
        fidelityScore: result.fidelityScore,
        metadata: options?.metadata,
      }
    );

    // Store translation record
    const translationRecord = this.persistence.storeTranslationResult(
      result,
      `urn:source:${native.framework}:${agentId}`,
      `urn:target:${targetFramework}:${agentId}`
    );

    // Emit event
    const event = this.events.publish<AgentTranslatedPayload>(
      'AgentTranslated',
      'translation',
      {
        timestamp,
        sourceFramework: native.framework,
        targetFramework,
        agentUri: canonicalUri,
        fidelityScore: result.fidelityScore,
        warnings: result.warnings?.length ?? 0,
        correlationId: options?.correlationId,
      }
    );

    return { result, stored, event };
  }

  /**
   * Extract agent ID from canonical
   */
  private extractAgentId(canonical: CanonicalAgent): string {
    const uri = canonical.uri;
    const parts = uri.split('/');
    return decodeURIComponent(parts[parts.length - 1]);
  }

  /**
   * Get service statistics
   */
  getStats(): BridgeServiceStats {
    const persistenceStats = this.persistence.getStats();
    const adapters = this.discovery.listAdapters();
    const recentEvents = this.events.getHistory({
      since: new Date(Date.now() - 3600000).toISOString(), // Last hour
    });

    return {
      discovery: {
        adapterCount: adapters.length,
        healthyAdapters: adapters.filter(a => a.healthStatus === 'healthy').length,
        frameworks: adapters.map(a => a.framework),
      },
      events: {
        totalEvents: this.events.getHistory().length,
        subscriptionCount: this.events.getSubscriptionCount(),
        recentEvents: recentEvents.length,
      },
      persistence: {
        totalAgents: persistenceStats.totalAgents,
        totalVersions: persistenceStats.totalVersions,
        totalTranslations: persistenceStats.totalTranslations,
        avgFidelity: persistenceStats.avgFidelity,
      },
    };
  }

  /**
   * Health check
   */
  healthCheck(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      orchestrator: boolean;
      discovery: boolean;
      events: boolean;
      persistence: boolean;
    };
  } {
    const adapters = this.discovery.listAdapters();
    const healthyCount = adapters.filter(a => a.healthStatus === 'healthy').length;
    
    const details = {
      orchestrator: this.orchestrator.getRegisteredFrameworks().length > 0,
      discovery: adapters.length > 0,
      events: true, // Events are always available
      persistence: true, // In-memory persistence is always available
    };

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (Object.values(details).every(v => v) && healthyCount === adapters.length) {
      status = 'healthy';
    } else if (details.orchestrator && healthyCount > 0) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return { status, details };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a fully integrated bridge service with all adapters
 */
export function createIntegratedBridgeService(
  config?: BridgeServiceConfig
): IntegratedBridgeService {
  const orchestrator = new BridgeOrchestrator();
  return new IntegratedBridgeService(orchestrator, config);
}

/**
 * Create bridge service with custom orchestrator
 */
export function createBridgeServiceWithOrchestrator(
  orchestrator: BridgeOrchestrator,
  config?: BridgeServiceConfig
): IntegratedBridgeService {
  return new IntegratedBridgeService(orchestrator, config);
}

// ============================================================================
// Exports
// ============================================================================

export {
  BridgeOrchestrator,
  TranslationResult,
  TranslationRequest,
} from './orchestrator';

export {
  NativeAgent,
  CanonicalAgent,
  AgentFramework,
  BaseAdapter,
} from '../adapters/base-adapter';

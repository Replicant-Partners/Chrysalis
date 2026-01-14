/**
 * Chrysalis Universal Agent Bridge - Bridge Orchestrator
 *
 * Central orchestration layer that coordinates translations between agent
 * frameworks, manages the adapter registry, caches translations, and provides
 * the high-level API for cross-framework agent interoperability.
 *
 * @module bridge/orchestrator/bridge-orchestrator
 */

import { EventEmitter } from 'events';
import {
  BaseAdapter,
  AdapterRegistry,
  adapterRegistry,
  NativeAgent,
  CanonicalAgent,
  AgentFramework,
  ValidationResult,
  RoundTripResult
} from '../../adapters/base-adapter';
import {
  TemporalRDFStore,
  temporalStore,
  AgentSnapshot,
  AgentSummary,
  DiscoveryCriteria,
  TemporalQueryOptions,
  serializeNTriples
} from '../../rdf/temporal-store';
import {
  TranslationRequest,
  TranslationResult,
  BatchTranslationRequest,
  BatchTranslationResult,
  OrchestratorConfig,
  RequiredOrchestratorConfig,
  BridgeHealth,
  CompatibilityEntry
} from './types';
import { validateTranslationRequest, validateBatchTranslationRequest } from './validation';
import { CacheManager } from './cache';
import { CompatibilityManager } from './compatibility';

/**
 * Central orchestrator for the Chrysalis Universal Agent Bridge.
 *
 * Responsibilities:
 * - Coordinate translations between frameworks via canonical RDF
 * - Manage adapter lifecycle and registration
 * - Cache translations for performance
 * - Persist agent snapshots to temporal store
 * - Provide discovery and listing APIs
 * - Track compatibility metrics
 */
export class BridgeOrchestrator extends EventEmitter {
  private config: RequiredOrchestratorConfig;
  private store: TemporalRDFStore;
  private registry: AdapterRegistry;
  private cacheManager: CacheManager;
  private compatibilityManager: CompatibilityManager;
  private startTime: Date;
  private lastActivity: Date | null = null;

  constructor(config: OrchestratorConfig = {}) {
    super();

    this.config = {
      enableCache: config.enableCache ?? true,
      cacheTTLMs: config.cacheTTLMs ?? 3600000,
      maxCacheEntries: config.maxCacheEntries ?? 1000,
      autoPersist: config.autoPersist ?? false,
      minFidelityScore: config.minFidelityScore ?? 0.7,
      enableValidation: config.enableValidation ?? true,
      store: config.store ?? temporalStore,
      registry: config.registry ?? adapterRegistry
    };

    this.store = this.config.store;
    this.registry = this.config.registry;
    this.cacheManager = new CacheManager(
      { cacheTTLMs: this.config.cacheTTLMs, maxCacheEntries: this.config.maxCacheEntries },
      this
    );
    this.compatibilityManager = new CompatibilityManager();
    this.startTime = new Date();

    if (this.config.enableCache) {
      setInterval(() => this.cacheManager.cleanupCache(), 60000);
    }
  }

  // ==========================================================================
  // Adapter Management
  // ==========================================================================

  registerAdapter(adapter: BaseAdapter): void {
    this.registry.register(adapter);
    this.emit('adapterRegistered', adapter.framework);
  }

  unregisterAdapter(framework: AgentFramework): boolean {
    const result = this.registry.unregister(framework);
    if (result) {
      this.emit('adapterUnregistered', framework);
    }
    return result;
  }

  getRegisteredFrameworks(): AgentFramework[] {
    return this.registry.getFrameworks();
  }

  hasAdapter(framework: AgentFramework): boolean {
    return this.registry.has(framework);
  }

  getAdapter(framework: AgentFramework): BaseAdapter | undefined {
    return this.registry.get(framework);
  }

  // ==========================================================================
  // Translation Operations
  // ==========================================================================

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const startTime = Date.now();
    this.lastActivity = new Date();

    const requestValidation = validateTranslationRequest(request);
    if (!requestValidation.valid) {
      const errors = requestValidation.errors.map(e => `${e.code}: ${e.message} (${e.path})`);
      this.emit('validationError', { type: 'translationRequest', errors: requestValidation.errors });
      return {
        success: false,
        fidelityScore: 0,
        sourceFramework: 'usa' as AgentFramework,
        targetFramework: (request as { targetFramework?: string }).targetFramework as AgentFramework || 'usa' as AgentFramework,
        durationMs: Date.now() - startTime,
        errors
      };
    }

    if (requestValidation.warnings.length > 0) {
      this.emit('validationWarning', { type: 'translationRequest', warnings: requestValidation.warnings });
    }

    const { agent, targetFramework, persist, useCache, validate } = request;
    const sourceFramework = agent.framework;

    const sourceAdapter = this.registry.get(sourceFramework);
    if (!sourceAdapter) {
      return this.createErrorResult(
        sourceFramework,
        targetFramework,
        startTime,
        [`No adapter registered for source framework: ${sourceFramework}`]
      );
    }

    const targetAdapter = this.registry.get(targetFramework);
    if (!targetAdapter) {
      return this.createErrorResult(
        sourceFramework,
        targetFramework,
        startTime,
        [`No adapter registered for target framework: ${targetFramework}`]
      );
    }

    const cacheKey = this.cacheManager.generateCacheKey(agent);
    if (useCache !== false && this.config.enableCache) {
      const cached = this.cacheManager.get(cacheKey);
      if (cached && this.cacheManager.isCacheValid(cached)) {
        const cachedTranslation = cached.translations.get(targetFramework);
        if (cachedTranslation) {
          cached.hits++;
          this.emit('cacheHit', { cacheKey, targetFramework });
          return {
            success: true,
            result: cachedTranslation,
            canonical: cached.canonical,
            fidelityScore: cached.canonical.metadata.fidelityScore,
            sourceFramework,
            targetFramework,
            durationMs: Date.now() - startTime,
            fromCache: true
          };
        }
      }
    }

    if (validate !== false && this.config.enableValidation) {
      const validation = sourceAdapter.validateNative(agent);
      if (!validation.valid) {
        return this.createErrorResult(
          sourceFramework,
          targetFramework,
          startTime,
          validation.errors.map(e => `${e.code}: ${e.message}`)
        );
      }
    }

    try {
      const canonical = await sourceAdapter.toCanonical(agent);

      if (canonical.metadata.fidelityScore < this.config.minFidelityScore) {
        this.emit('lowFidelity', {
          framework: sourceFramework,
          fidelityScore: canonical.metadata.fidelityScore
        });
      }

      const result = await targetAdapter.fromCanonical(canonical);

      if (validate !== false && this.config.enableValidation) {
        const resultValidation = targetAdapter.validateNative(result);
        if (!resultValidation.valid) {
          this.emit('translationWarning', {
            type: 'invalidResult',
            errors: resultValidation.errors
          });
        }
      }

      if (this.config.enableCache) {
        this.cacheManager.updateCache(cacheKey, canonical, targetFramework, result);
      }

      let snapshotUri: string | undefined;
      if (persist || this.config.autoPersist) {
        const snapshot = await this.store.createSnapshot(
          this.extractAgentId(canonical),
          canonical.quads,
          {
            sourceFormat: sourceFramework,
            fidelityScore: canonical.metadata.fidelityScore
          }
        );
        snapshotUri = snapshot.graphUri;
      }

      this.compatibilityManager.updateCompatibility(sourceFramework, targetFramework, canonical.metadata.fidelityScore);

      const translationResult: TranslationResult = {
        success: true,
        result,
        canonical,
        fidelityScore: canonical.metadata.fidelityScore,
        sourceFramework,
        targetFramework,
        durationMs: Date.now() - startTime,
        warnings: canonical.metadata.warnings.map(w => w.message),
        snapshotUri
      };

      this.emit('translationComplete', translationResult);
      return translationResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emit('translationError', { sourceFramework, targetFramework, error: errorMessage });
      return this.createErrorResult(
        sourceFramework,
        targetFramework,
        startTime,
        [errorMessage]
      );
    }
  }

  async toCanonical(agent: NativeAgent): Promise<CanonicalAgent | null> {
    const adapter = this.registry.get(agent.framework);
    if (!adapter) {
      this.emit('translationError', {
        sourceFramework: agent.framework,
        targetFramework: 'canonical',
        error: `No adapter registered for framework: ${agent.framework}`
      });
      return null;
    }

    try {
      return await adapter.toCanonical(agent);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emit('translationError', {
        sourceFramework: agent.framework,
        targetFramework: 'canonical',
        error: `toCanonical failed: ${errorMessage}`
      });
      return null;
    }
  }

  async fromCanonical(canonical: CanonicalAgent, targetFramework: AgentFramework): Promise<NativeAgent | null> {
    const adapter = this.registry.get(targetFramework);
    if (!adapter) {
      this.emit('translationError', {
        sourceFramework: 'canonical',
        targetFramework,
        error: `No adapter registered for framework: ${targetFramework}`
      });
      return null;
    }

    try {
      return await adapter.fromCanonical(canonical);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emit('translationError', {
        sourceFramework: 'canonical',
        targetFramework,
        error: `fromCanonical failed: ${errorMessage}`
      });
      return null;
    }
  }

  async batchTranslate(request: BatchTranslationRequest): Promise<BatchTranslationResult> {
    const startTime = Date.now();

    const requestValidation = validateBatchTranslationRequest(request);
    if (!requestValidation.valid) {
      const errors = requestValidation.errors.map(e => `${e.code}: ${e.message} (${e.path})`);
      this.emit('validationError', { type: 'batchTranslationRequest', errors: requestValidation.errors });
      return {
        total: 0,
        succeeded: 0,
        failed: 0,
        results: [{
          success: false,
          fidelityScore: 0,
          sourceFramework: 'usa' as AgentFramework,
          targetFramework: (request as { targetFramework?: string }).targetFramework as AgentFramework || 'usa' as AgentFramework,
          durationMs: Date.now() - startTime,
          errors
        }],
        durationMs: Date.now() - startTime
      };
    }

    if (requestValidation.warnings.length > 0) {
      this.emit('validationWarning', { type: 'batchTranslationRequest', warnings: requestValidation.warnings });
    }

    const results: TranslationResult[] = [];
    let succeeded = 0;
    let failed = 0;

    const translateOne = async (agent: NativeAgent): Promise<TranslationResult> => {
      return this.translate({
        agent,
        targetFramework: request.targetFramework,
        persist: request.persist
      });
    };

    if (request.parallel) {
      const promises = request.agents.map(agent =>
        translateOne(agent).catch(error => ({
          success: false,
          fidelityScore: 0,
          sourceFramework: agent.framework,
          targetFramework: request.targetFramework,
          durationMs: 0,
          errors: [error instanceof Error ? error.message : String(error)]
        } as TranslationResult))
      );

      const parallelResults = await Promise.all(promises);
      results.push(...parallelResults);
    } else {
      for (const agent of request.agents) {
        try {
          const result = await translateOne(agent);
          results.push(result);

          if (!result.success && !request.continueOnError) {
            break;
          }
        } catch (error) {
          const errorResult: TranslationResult = {
            success: false,
            fidelityScore: 0,
            sourceFramework: agent.framework,
            targetFramework: request.targetFramework,
            durationMs: 0,
            errors: [error instanceof Error ? error.message : String(error)]
          };
          results.push(errorResult);

          if (!request.continueOnError) {
            break;
          }
        }
      }
    }

    for (const result of results) {
      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    return {
      total: request.agents.length,
      succeeded,
      failed,
      results,
      durationMs: Date.now() - startTime
    };
  }

  async roundTripTest(agent: NativeAgent): Promise<RoundTripResult> {
    const adapter = this.registry.get(agent.framework);
    if (!adapter) {
      throw new Error(`No adapter for framework: ${agent.framework}`);
    }

    return adapter.roundTrip(agent);
  }

  // ==========================================================================
  // Persistence Operations
  // ==========================================================================

  async storeAgent(agent: NativeAgent): Promise<AgentSnapshot> {
    const canonical = await this.toCanonical(agent);
    if (!canonical) {
      throw new Error(`Failed to convert agent to canonical form`);
    }

    return this.store.createSnapshot(
      this.extractAgentId(canonical),
      canonical.quads,
      {
        sourceFormat: agent.framework,
        fidelityScore: canonical.metadata.fidelityScore
      }
    );
  }

  async getAgent(
    agentId: string,
    targetFramework?: AgentFramework,
    options?: TemporalQueryOptions
  ): Promise<NativeAgent | CanonicalAgent | null> {
    const snapshot = await this.store.getSnapshot(agentId, options);
    if (!snapshot) return null;

    const canonical = this.store.snapshotToCanonical(snapshot, agentId) as CanonicalAgent;

    if (!targetFramework) {
      return canonical;
    }

    return this.fromCanonical(canonical, targetFramework);
  }

  async getAgentHistory(agentId: string): Promise<AgentSnapshot[]> {
    return this.store.getAgentHistory(agentId);
  }

  async deleteAgent(agentId: string): Promise<boolean> {
    return this.store.deleteAgent(agentId);
  }

  // ==========================================================================
  // Discovery Operations
  // ==========================================================================

  async discoverAgents(criteria: DiscoveryCriteria): Promise<AgentSummary[]> {
    return this.store.discoverAgents(criteria);
  }

  async listAgents(options?: { limit?: number; offset?: number }): Promise<AgentSummary[]> {
    return this.store.listAgents(options);
  }

  async findByCapability(capabilities: string[]): Promise<AgentSummary[]> {
    return this.store.discoverAgents({ hasCapability: capabilities });
  }

  async findByProtocol(protocols: string[]): Promise<AgentSummary[]> {
    return this.store.discoverAgents({ supportsProtocol: protocols });
  }

  // ==========================================================================
  // Validation Operations
  // ==========================================================================

  validateNative(agent: NativeAgent): ValidationResult {
    const adapter = this.registry.get(agent.framework);
    if (!adapter) {
      return {
        valid: false,
        errors: [{ code: 'NO_ADAPTER', message: `No adapter for ${agent.framework}`, path: '' }],
        warnings: []
      };
    }

    return adapter.validateNative(agent);
  }

  validateCanonical(canonical: CanonicalAgent): ValidationResult {
    const adapter = this.registry.get(canonical.sourceFramework);
    if (!adapter) {
      return {
        valid: false,
        errors: [{ code: 'NO_ADAPTER', message: `No adapter for ${canonical.sourceFramework}`, path: '' }],
        warnings: []
      };
    }

    return adapter.validateCanonical(canonical);
  }

  // ==========================================================================
  // Compatibility & Metrics
  // ==========================================================================

  getCompatibilityMatrix(): CompatibilityEntry[] {
    return this.compatibilityManager.getCompatibilityMatrix();
  }

  getCompatibility(source: AgentFramework, target: AgentFramework): CompatibilityEntry | null {
    return this.compatibilityManager.getCompatibility(source, target);
  }

  async getHealth(): Promise<BridgeHealth> {
    const adapters = this.registry.getAll();
    const storeStats = await this.store.getStats();

    return {
      status: adapters.length > 0 ? 'healthy' : 'unhealthy',
      adaptersRegistered: adapters.length,
      adaptersHealthy: adapters.length,
      cacheSize: this.cacheManager.size,
      storeStats,
      uptime: Date.now() - this.startTime.getTime(),
      lastActivity: this.lastActivity
    };
  }

  getCacheStats(): { size: number; hits: number; entries: string[] } {
    return this.cacheManager.getStats();
  }

  // ==========================================================================
  // Administrative Operations
  // ==========================================================================

  clearCache(): void {
    this.cacheManager.clear();
    this.emit('cacheCleared');
  }

  async clearAll(): Promise<void> {
    this.cacheManager.clear();
    this.compatibilityManager.clear();
    await this.store.clear();
    this.emit('dataCleared');
  }

  async compact(): Promise<void> {
    await this.store.compact();
  }

  async exportAgent(
    agentId: string,
    targetFramework: AgentFramework,
    format: 'json' | 'yaml' | 'ntriples' = 'json'
  ): Promise<string> {
    const agent = await this.getAgent(agentId, targetFramework);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    if (format === 'ntriples' && 'quads' in agent) {
      return serializeNTriples((agent as CanonicalAgent).quads);
    }

    if ('data' in agent) {
      return JSON.stringify((agent as NativeAgent).data, null, 2);
    }

    return JSON.stringify(agent, null, 2);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private createErrorResult(
    sourceFramework: AgentFramework,
    targetFramework: AgentFramework,
    startTime: number,
    errors: string[]
  ): TranslationResult {
    return {
      success: false,
      fidelityScore: 0,
      sourceFramework,
      targetFramework,
      durationMs: Date.now() - startTime,
      errors
    };
  }

  private extractAgentId(canonical: CanonicalAgent): string {
    const uri = canonical.uri;
    const parts = uri.split('/');
    return decodeURIComponent(parts[parts.length - 1]);
  }
}

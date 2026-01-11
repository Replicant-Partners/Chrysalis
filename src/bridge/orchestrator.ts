/**
 * Chrysalis Universal Agent Bridge - Bridge Orchestrator
 * 
 * Central orchestration layer that coordinates translations between agent
 * frameworks, manages the adapter registry, caches translations, and provides
 * the high-level API for cross-framework agent interoperability.
 * 
 * @module bridge/orchestrator
 * @version 1.0.0
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
} from '../adapters/base-adapter';
import {
  TemporalRDFStore,
  temporalStore,
  AgentSnapshot,
  AgentSummary,
  DiscoveryCriteria,
  TemporalQueryOptions,
  StoreStats,
  Quad
} from '../rdf/temporal-store';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Translation request
 */
export interface TranslationRequest {
  /** Native agent to translate */
  agent: NativeAgent;
  /** Target framework */
  targetFramework: AgentFramework;
  /** Optional: persist to temporal store */
  persist?: boolean;
  /** Optional: use cached result if available */
  useCache?: boolean;
  /** Optional: validate before and after translation */
  validate?: boolean;
}

/**
 * Translation result
 */
export interface TranslationResult {
  /** Whether translation succeeded */
  success: boolean;
  /** Translated agent in target format */
  result?: NativeAgent;
  /** Canonical intermediate representation */
  canonical?: CanonicalAgent;
  /** Fidelity score (0.0 - 1.0) */
  fidelityScore: number;
  /** Source framework */
  sourceFramework: AgentFramework;
  /** Target framework */
  targetFramework: AgentFramework;
  /** Translation duration in milliseconds */
  durationMs: number;
  /** Errors if translation failed */
  errors?: string[];
  /** Warnings from translation */
  warnings?: string[];
  /** Cache hit */
  fromCache?: boolean;
  /** Stored snapshot URI (if persisted) */
  snapshotUri?: string;
}

/**
 * Batch translation request
 */
export interface BatchTranslationRequest {
  /** Agents to translate */
  agents: NativeAgent[];
  /** Target framework for all */
  targetFramework: AgentFramework;
  /** Continue on error */
  continueOnError?: boolean;
  /** Parallel execution */
  parallel?: boolean;
  /** Persist results */
  persist?: boolean;
}

/**
 * Batch translation result
 */
export interface BatchTranslationResult {
  /** Total agents processed */
  total: number;
  /** Successful translations */
  succeeded: number;
  /** Failed translations */
  failed: number;
  /** Individual results */
  results: TranslationResult[];
  /** Total duration */
  durationMs: number;
}

/**
 * Cache entry
 */
interface CacheEntry {
  canonical: CanonicalAgent;
  translations: Map<AgentFramework, NativeAgent>;
  timestamp: Date;
  hits: number;
}

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  /** Enable caching */
  enableCache?: boolean;
  /** Cache TTL in milliseconds */
  cacheTTLMs?: number;
  /** Maximum cache entries */
  maxCacheEntries?: number;
  /** Auto-persist translations */
  autoPersist?: boolean;
  /** Minimum fidelity score for success */
  minFidelityScore?: number;
  /** Enable validation */
  enableValidation?: boolean;
  /** Custom temporal store instance */
  store?: TemporalRDFStore;
  /** Custom adapter registry */
  registry?: AdapterRegistry;
}

/**
 * Bridge health status
 */
export interface BridgeHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  adaptersRegistered: number;
  adaptersHealthy: number;
  cacheSize: number;
  storeStats: StoreStats;
  uptime: number;
  lastActivity: Date | null;
}

/**
 * Framework compatibility matrix entry
 */
export interface CompatibilityEntry {
  sourceFramework: AgentFramework;
  targetFramework: AgentFramework;
  avgFidelityScore: number;
  sampleSize: number;
  lastTested: Date;
}

/**
 * Request validation error detail
 */
export interface RequestValidationError {
  /** Error code for programmatic handling */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Path to the problematic field */
  path: string;
  /** Expected value/type description */
  expected?: string;
  /** Actual value/type received */
  actual?: string;
}

/**
 * Request validation result
 */
export interface RequestValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors */
  errors: RequestValidationError[];
  /** Validation warnings */
  warnings: RequestValidationError[];
}

// ============================================================================
// Input Validation Guards (P2 from CODE_QUALITY_REVIEW)
// ============================================================================

/**
 * Validate translation request structure
 */
function validateTranslationRequest(request: unknown): RequestValidationResult {
  const errors: RequestValidationError[] = [];
  const warnings: RequestValidationError[] = [];

  // Check request is an object
  if (!request || typeof request !== 'object') {
    errors.push({
      code: 'INVALID_REQUEST',
      message: 'Request must be an object',
      path: '',
      expected: 'object',
      actual: typeof request
    });
    return { valid: false, errors, warnings };
  }

  const req = request as Record<string, unknown>;

  // Check agent exists
  if (!req.agent) {
    errors.push({
      code: 'MISSING_AGENT',
      message: 'Agent is required',
      path: 'agent'
    });
  } else if (typeof req.agent !== 'object' || req.agent === null) {
    errors.push({
      code: 'INVALID_AGENT',
      message: 'Agent must be an object',
      path: 'agent',
      expected: 'object',
      actual: typeof req.agent
    });
  } else {
    const agent = req.agent as Record<string, unknown>;

    // Check agent.framework
    if (!agent.framework) {
      errors.push({
        code: 'MISSING_FRAMEWORK',
        message: 'Agent framework is required',
        path: 'agent.framework'
      });
    } else if (typeof agent.framework !== 'string') {
      errors.push({
        code: 'INVALID_FRAMEWORK',
        message: 'Agent framework must be a string',
        path: 'agent.framework',
        expected: 'string',
        actual: typeof agent.framework
      });
    }

    // Check agent.data
    if (agent.data === undefined) {
      errors.push({
        code: 'MISSING_DATA',
        message: 'Agent data is required',
        path: 'agent.data'
      });
    } else if (typeof agent.data !== 'object' || agent.data === null) {
      errors.push({
        code: 'INVALID_DATA',
        message: 'Agent data must be an object',
        path: 'agent.data',
        expected: 'object',
        actual: agent.data === null ? 'null' : typeof agent.data
      });
    } else if (Object.keys(agent.data as object).length === 0) {
      warnings.push({
        code: 'EMPTY_DATA',
        message: 'Agent data is empty',
        path: 'agent.data'
      });
    }
  }

  // Check targetFramework
  if (!req.targetFramework) {
    errors.push({
      code: 'MISSING_TARGET',
      message: 'Target framework is required',
      path: 'targetFramework'
    });
  } else if (typeof req.targetFramework !== 'string') {
    errors.push({
      code: 'INVALID_TARGET',
      message: 'Target framework must be a string',
      path: 'targetFramework',
      expected: 'string',
      actual: typeof req.targetFramework
    });
  }

  // Validate optional boolean fields
  const booleanFields = ['persist', 'useCache', 'validate'];
  for (const field of booleanFields) {
    if (req[field] !== undefined && typeof req[field] !== 'boolean') {
      warnings.push({
        code: 'INVALID_OPTION',
        message: `${field} should be a boolean`,
        path: field,
        expected: 'boolean',
        actual: typeof req[field]
      });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate batch translation request structure
 */
function validateBatchTranslationRequest(request: unknown): RequestValidationResult {
  const errors: RequestValidationError[] = [];
  const warnings: RequestValidationError[] = [];

  // Check request is an object
  if (!request || typeof request !== 'object') {
    errors.push({
      code: 'INVALID_REQUEST',
      message: 'Request must be an object',
      path: '',
      expected: 'object',
      actual: typeof request
    });
    return { valid: false, errors, warnings };
  }

  const req = request as Record<string, unknown>;

  // Check agents array
  if (!req.agents) {
    errors.push({
      code: 'MISSING_AGENTS',
      message: 'Agents array is required',
      path: 'agents'
    });
  } else if (!Array.isArray(req.agents)) {
    errors.push({
      code: 'INVALID_AGENTS',
      message: 'Agents must be an array',
      path: 'agents',
      expected: 'array',
      actual: typeof req.agents
    });
  } else if (req.agents.length === 0) {
    warnings.push({
      code: 'EMPTY_AGENTS',
      message: 'Agents array is empty',
      path: 'agents'
    });
  } else {
    // Validate each agent in the array
    for (let i = 0; i < req.agents.length; i++) {
      const agent = req.agents[i];
      if (!agent || typeof agent !== 'object') {
        errors.push({
          code: 'INVALID_AGENT_ITEM',
          message: `Agent at index ${i} must be an object`,
          path: `agents[${i}]`,
          expected: 'object',
          actual: typeof agent
        });
        continue;
      }

      const agentObj = agent as Record<string, unknown>;
      if (!agentObj.framework) {
        errors.push({
          code: 'MISSING_AGENT_FRAMEWORK',
          message: `Agent at index ${i} is missing framework`,
          path: `agents[${i}].framework`
        });
      }
      if (agentObj.data === undefined || agentObj.data === null) {
        errors.push({
          code: 'MISSING_AGENT_DATA',
          message: `Agent at index ${i} is missing data`,
          path: `agents[${i}].data`
        });
      }
    }
  }

  // Check targetFramework
  if (!req.targetFramework) {
    errors.push({
      code: 'MISSING_TARGET',
      message: 'Target framework is required',
      path: 'targetFramework'
    });
  } else if (typeof req.targetFramework !== 'string') {
    errors.push({
      code: 'INVALID_TARGET',
      message: 'Target framework must be a string',
      path: 'targetFramework',
      expected: 'string',
      actual: typeof req.targetFramework
    });
  }

  // Validate optional boolean fields
  const booleanFields = ['continueOnError', 'parallel', 'persist'];
  for (const field of booleanFields) {
    if (req[field] !== undefined && typeof req[field] !== 'boolean') {
      warnings.push({
        code: 'INVALID_OPTION',
        message: `${field} should be a boolean`,
        path: field,
        expected: 'boolean',
        actual: typeof req[field]
      });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Check if a framework string is a valid AgentFramework
 */
function isValidFramework(framework: string): framework is AgentFramework {
  const validFrameworks: AgentFramework[] = [
    'usa', 'lmos', 'mcp', 'langchain', 'openai', 'autogpt', 'semantic-kernel'
  ];
  return validFrameworks.includes(framework as AgentFramework);
}

// ============================================================================
// Bridge Orchestrator Implementation
// ============================================================================

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
  private config: Required<OrchestratorConfig>;
  private store: TemporalRDFStore;
  private registry: AdapterRegistry;
  private cache: Map<string, CacheEntry> = new Map();
  private compatibilityMatrix: Map<string, CompatibilityEntry> = new Map();
  private startTime: Date;
  private lastActivity: Date | null = null;

  constructor(config: OrchestratorConfig = {}) {
    super();
    
    this.config = {
      enableCache: config.enableCache ?? true,
      cacheTTLMs: config.cacheTTLMs ?? 3600000, // 1 hour
      maxCacheEntries: config.maxCacheEntries ?? 1000,
      autoPersist: config.autoPersist ?? false,
      minFidelityScore: config.minFidelityScore ?? 0.7,
      enableValidation: config.enableValidation ?? true,
      store: config.store ?? temporalStore,
      registry: config.registry ?? adapterRegistry
    };

    this.store = this.config.store;
    this.registry = this.config.registry;
    this.startTime = new Date();

    // Set up periodic cache cleanup
    if (this.config.enableCache) {
      setInterval(() => this.cleanupCache(), 60000); // Every minute
    }
  }

  // ==========================================================================
  // Adapter Management
  // ==========================================================================

  /**
   * Register an adapter for a framework
   */
  registerAdapter(adapter: BaseAdapter): void {
    this.registry.register(adapter);
    this.emit('adapterRegistered', adapter.framework);
  }

  /**
   * Unregister an adapter
   */
  unregisterAdapter(framework: AgentFramework): boolean {
    const result = this.registry.unregister(framework);
    if (result) {
      this.emit('adapterUnregistered', framework);
    }
    return result;
  }

  /**
   * Get registered frameworks
   */
  getRegisteredFrameworks(): AgentFramework[] {
    return this.registry.getFrameworks();
  }

  /**
   * Check if adapter exists for framework
   */
  hasAdapter(framework: AgentFramework): boolean {
    return this.registry.has(framework);
  }

  /**
   * Get adapter for framework
   */
  getAdapter(framework: AgentFramework): BaseAdapter | undefined {
    return this.registry.get(framework);
  }

  // ==========================================================================
  // Translation Operations
  // ==========================================================================

  /**
   * Translate an agent from one framework to another
   */
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const startTime = Date.now();
    this.lastActivity = new Date();

    // P2: Input validation guard - validate request structure before processing
    const requestValidation = validateTranslationRequest(request);
    if (!requestValidation.valid) {
      const errors = requestValidation.errors.map(e => `${e.code}: ${e.message} (${e.path})`);
      this.emit('validationError', { type: 'translationRequest', errors: requestValidation.errors });
      return {
        success: false,
        fidelityScore: 0,
        sourceFramework: 'usa' as AgentFramework, // Default for error case
        targetFramework: (request as { targetFramework?: string }).targetFramework as AgentFramework || 'usa' as AgentFramework,
        durationMs: Date.now() - startTime,
        errors
      };
    }

    // Emit warnings if any (non-blocking)
    if (requestValidation.warnings.length > 0) {
      this.emit('validationWarning', { type: 'translationRequest', warnings: requestValidation.warnings });
    }

    const { agent, targetFramework, persist, useCache, validate } = request;
    const sourceFramework = agent.framework;

    // Validate source adapter exists
    const sourceAdapter = this.registry.get(sourceFramework);
    if (!sourceAdapter) {
      return this.createErrorResult(
        sourceFramework,
        targetFramework,
        startTime,
        [`No adapter registered for source framework: ${sourceFramework}`]
      );
    }

    // Validate target adapter exists
    const targetAdapter = this.registry.get(targetFramework);
    if (!targetAdapter) {
      return this.createErrorResult(
        sourceFramework,
        targetFramework,
        startTime,
        [`No adapter registered for target framework: ${targetFramework}`]
      );
    }

    // Check cache
    const cacheKey = this.generateCacheKey(agent);
    if (useCache !== false && this.config.enableCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && this.isCacheValid(cached)) {
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

    // Validate source agent
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
      // Step 1: Source → Canonical
      const canonical = await sourceAdapter.toCanonical(agent);

      // Check fidelity threshold
      if (canonical.metadata.fidelityScore < this.config.minFidelityScore) {
        this.emit('lowFidelity', {
          framework: sourceFramework,
          fidelityScore: canonical.metadata.fidelityScore
        });
      }

      // Step 2: Canonical → Target
      const result = await targetAdapter.fromCanonical(canonical);

      // Validate result
      if (validate !== false && this.config.enableValidation) {
        const resultValidation = targetAdapter.validateNative(result);
        if (!resultValidation.valid) {
          this.emit('translationWarning', {
            type: 'invalidResult',
            errors: resultValidation.errors
          });
        }
      }

      // Update cache
      if (this.config.enableCache) {
        this.updateCache(cacheKey, canonical, targetFramework, result);
      }

      // Persist if requested
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

      // Update compatibility matrix
      this.updateCompatibility(sourceFramework, targetFramework, canonical.metadata.fidelityScore);

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

  /**
   * Translate agent to canonical form only
   */
  async toCanonical(agent: NativeAgent): Promise<CanonicalAgent | null> {
    const adapter = this.registry.get(agent.framework);
    if (!adapter) return null;

    try {
      return await adapter.toCanonical(agent);
    } catch {
      return null;
    }
  }

  /**
   * Translate canonical form to specific framework
   */
  async fromCanonical(canonical: CanonicalAgent, targetFramework: AgentFramework): Promise<NativeAgent | null> {
    const adapter = this.registry.get(targetFramework);
    if (!adapter) return null;

    try {
      return await adapter.fromCanonical(canonical);
    } catch {
      return null;
    }
  }

  /**
   * Perform batch translation
   */
  async batchTranslate(request: BatchTranslationRequest): Promise<BatchTranslationResult> {
    const startTime = Date.now();

    // P2: Input validation guard - validate batch request structure before processing
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

    // Emit warnings if any (non-blocking)
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
      // Parallel execution
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
      // Sequential execution
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

    // Count results
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

  /**
   * Perform round-trip test for an agent
   */
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

  /**
   * Store an agent snapshot
   */
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

  /**
   * Retrieve an agent by ID
   */
  async getAgent(
    agentId: string,
    targetFramework?: AgentFramework,
    options?: TemporalQueryOptions
  ): Promise<NativeAgent | CanonicalAgent | null> {
    const snapshot = await this.store.getSnapshot(agentId, options);
    if (!snapshot) return null;

    // Build canonical from stored quads
    const canonical: CanonicalAgent = {
      uri: `https://chrysalis.dev/agent/${agentId}`,
      quads: snapshot.quads,
      sourceFramework: (snapshot.sourceFormat as AgentFramework) || 'usa',
      extensions: [],
      metadata: {
        fidelityScore: snapshot.fidelityScore || 1.0,
        mappedFields: [],
        unmappedFields: [],
        lostFields: [],
        warnings: [],
        timestamp: snapshot.validFrom,
        durationMs: 0,
        adapterVersion: '1.0.0'
      }
    };

    if (!targetFramework) {
      return canonical;
    }

    return this.fromCanonical(canonical, targetFramework);
  }

  /**
   * Get agent history
   */
  async getAgentHistory(agentId: string): Promise<AgentSnapshot[]> {
    return this.store.getAgentHistory(agentId);
  }

  /**
   * Delete an agent
   */
  async deleteAgent(agentId: string): Promise<boolean> {
    return this.store.deleteAgent(agentId);
  }

  // ==========================================================================
  // Discovery Operations
  // ==========================================================================

  /**
   * Discover agents matching criteria
   */
  async discoverAgents(criteria: DiscoveryCriteria): Promise<AgentSummary[]> {
    return this.store.discoverAgents(criteria);
  }

  /**
   * List all agents
   */
  async listAgents(options?: { limit?: number; offset?: number }): Promise<AgentSummary[]> {
    return this.store.listAgents(options);
  }

  /**
   * Search agents by capability
   */
  async findByCapability(capabilities: string[]): Promise<AgentSummary[]> {
    return this.store.discoverAgents({ hasCapability: capabilities });
  }

  /**
   * Search agents by protocol
   */
  async findByProtocol(protocols: string[]): Promise<AgentSummary[]> {
    return this.store.discoverAgents({ supportsProtocol: protocols });
  }

  // ==========================================================================
  // Validation Operations
  // ==========================================================================

  /**
   * Validate an agent in its native format
   */
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

  /**
   * Validate a canonical agent
   */
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

  /**
   * Get compatibility matrix
   */
  getCompatibilityMatrix(): CompatibilityEntry[] {
    return Array.from(this.compatibilityMatrix.values());
  }

  /**
   * Get compatibility score between two frameworks
   */
  getCompatibility(source: AgentFramework, target: AgentFramework): CompatibilityEntry | null {
    const key = `${source}->${target}`;
    return this.compatibilityMatrix.get(key) || null;
  }

  /**
   * Get bridge health status
   */
  async getHealth(): Promise<BridgeHealth> {
    const adapters = this.registry.getAll();
    const storeStats = await this.store.getStats();

    return {
      status: adapters.length > 0 ? 'healthy' : 'unhealthy',
      adaptersRegistered: adapters.length,
      adaptersHealthy: adapters.length, // Could add health checks per adapter
      cacheSize: this.cache.size,
      storeStats,
      uptime: Date.now() - this.startTime.getTime(),
      lastActivity: this.lastActivity
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hits: number; entries: string[] } {
    let totalHits = 0;
    const entries: string[] = [];

    for (const [key, entry] of this.cache) {
      totalHits += entry.hits;
      entries.push(key);
    }

    return {
      size: this.cache.size,
      hits: totalHits,
      entries
    };
  }

  // ==========================================================================
  // Administrative Operations
  // ==========================================================================

  /**
   * Clear the translation cache
   */
  clearCache(): void {
    this.cache.clear();
    this.emit('cacheCleared');
  }

  /**
   * Clear all stored data
   */
  async clearAll(): Promise<void> {
    this.cache.clear();
    this.compatibilityMatrix.clear();
    await this.store.clear();
    this.emit('dataCleared');
  }

  /**
   * Compact the store
   */
  async compact(): Promise<void> {
    await this.store.compact();
  }

  /**
   * Export agent to specific format
   */
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
      // Export canonical as N-Triples
      const { serializeNTriples } = await import('../rdf/temporal-store');
      return serializeNTriples((agent as CanonicalAgent).quads);
    }

    // Export native format as JSON
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

  private generateCacheKey(agent: NativeAgent): string {
    // Generate a cache key from agent content
    const content = JSON.stringify(agent.data);
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `${agent.framework}:${Math.abs(hash).toString(16)}`;
  }

  private isCacheValid(entry: CacheEntry): boolean {
    const age = Date.now() - entry.timestamp.getTime();
    return age < this.config.cacheTTLMs;
  }

  private updateCache(
    key: string,
    canonical: CanonicalAgent,
    targetFramework: AgentFramework,
    result: NativeAgent
  ): void {
    let entry = this.cache.get(key);
    
    if (!entry) {
      // Enforce cache size limit
      if (this.cache.size >= this.config.maxCacheEntries) {
        // Remove oldest entry
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey) {
          this.cache.delete(oldestKey);
        }
      }

      entry = {
        canonical,
        translations: new Map(),
        timestamp: new Date(),
        hits: 0
      };
      this.cache.set(key, entry);
    }

    entry.translations.set(targetFramework, result);
    entry.timestamp = new Date();
  }

  private cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp.getTime() > this.config.cacheTTLMs) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    if (keysToDelete.length > 0) {
      this.emit('cacheCleanup', { removed: keysToDelete.length });
    }
  }

  private updateCompatibility(
    source: AgentFramework,
    target: AgentFramework,
    fidelityScore: number
  ): void {
    const key = `${source}->${target}`;
    const existing = this.compatibilityMatrix.get(key);

    if (existing) {
      // Update running average
      const newTotal = existing.avgFidelityScore * existing.sampleSize + fidelityScore;
      existing.sampleSize++;
      existing.avgFidelityScore = newTotal / existing.sampleSize;
      existing.lastTested = new Date();
    } else {
      this.compatibilityMatrix.set(key, {
        sourceFramework: source,
        targetFramework: target,
        avgFidelityScore: fidelityScore,
        sampleSize: 1,
        lastTested: new Date()
      });
    }
  }

  private extractAgentId(canonical: CanonicalAgent): string {
    // Extract from URI
    const uri = canonical.uri;
    const parts = uri.split('/');
    return decodeURIComponent(parts[parts.length - 1]);
  }
}

// ============================================================================
// Factory & Default Instance
// ============================================================================

/**
 * Create a new bridge orchestrator
 */
export function createBridgeOrchestrator(config?: OrchestratorConfig): BridgeOrchestrator {
  return new BridgeOrchestrator(config);
}

/**
 * Default bridge orchestrator instance
 */
export const bridge = new BridgeOrchestrator();

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick translate between frameworks
 */
export async function translate(
  agent: NativeAgent,
  targetFramework: AgentFramework
): Promise<TranslationResult> {
  return bridge.translate({ agent, targetFramework });
}

/**
 * Quick store agent
 */
export async function storeAgent(agent: NativeAgent): Promise<AgentSnapshot> {
  return bridge.storeAgent(agent);
}

/**
 * Quick retrieve agent
 */
export async function getAgent(
  agentId: string,
  targetFramework?: AgentFramework
): Promise<NativeAgent | CanonicalAgent | null> {
  return bridge.getAgent(agentId, targetFramework);
}

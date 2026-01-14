/**
 * Chrysalis Universal Agent Bridge - Orchestrator Types
 *
 * Type definitions for the Bridge Orchestrator.
 *
 * @module bridge/orchestrator/types
 */

import { AgentFramework, CanonicalAgent, NativeAgent } from '../../adapters/base-adapter';
import { StoreStats, TemporalRDFStore } from '../../rdf/temporal-store';
import { AdapterRegistry } from '../../adapters/base-adapter';

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
 * Required orchestrator configuration (all fields defined)
 */
export type RequiredOrchestratorConfig = Required<OrchestratorConfig>;

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

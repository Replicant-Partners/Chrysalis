/**
 * Adaptation Hook Types
 *
 * Core type definitions for adaptation hooks, contexts, and results.
 *
 * @module adapters/adaptation/types
 */

import { AgentFramework } from '../protocol-types';
import { UniversalMessage, UniversalError, TraceContext } from '../protocol-messages';
import { VersionCompatibility } from '../protocol-registry';
import { ProtocolFeature, CapabilityLevel } from '../protocol-capabilities';

/**
 * Types of adaptation hooks that can be registered.
 */
export type AdaptationHookType =
  | 'pre-conversion'        // Before message conversion
  | 'post-conversion'       // After message conversion
  | 'pre-invocation'        // Before operation invocation
  | 'post-invocation'       // After operation invocation
  | 'on-error'              // When an error occurs
  | 'on-version-mismatch'   // When version compatibility fails
  | 'on-capability-change'  // When capabilities change
  | 'on-health-change'      // When adapter health changes
  | 'on-pattern-detected'   // When an evolutionary pattern is detected
  | 'pre-shutdown'          // Before adapter shutdown
  | 'post-initialize';      // After adapter initialization

/**
 * Hook execution priority levels.
 */
export type HookPriority = 'critical' | 'high' | 'normal' | 'low' | 'background';

/**
 * Hook execution result.
 */
export interface HookResult {
  /** Whether to continue to next hook */
  continueChain: boolean;
  /** Modified context (if any) */
  modifiedContext?: HookContext;
  /** Error if hook failed */
  error?: Error;
  /** Execution time in milliseconds */
  executionTimeMs: number;
  /** Additional metadata from hook */
  metadata?: Record<string, unknown>;
}

/**
 * Context passed to adaptation hooks.
 */
export interface HookContext {
  /** Protocol being processed */
  protocol: AgentFramework;
  /** Hook type */
  hookType: AdaptationHookType;
  /** Timestamp when hook was triggered */
  timestamp: string;
  /** Tracing context */
  trace?: TraceContext;

  // Conversion-related context
  /** Input message (for conversion hooks) */
  inputMessage?: UniversalMessage | unknown;
  /** Output message (for post-conversion hooks) */
  outputMessage?: UniversalMessage | unknown;
  /** Conversion direction */
  direction?: 'to-universal' | 'from-universal';

  // Error-related context
  /** Error that occurred */
  error?: UniversalError | Error;
  /** Number of retries attempted */
  retryCount?: number;

  // Version-related context
  /** Requested version */
  requestedVersion?: string;
  /** Available versions */
  availableVersions?: string[];
  /** Compatibility result */
  compatibility?: VersionCompatibility;

  // Pattern-related context
  /** Detected pattern ID */
  patternId?: string;
  /** Pattern confidence score */
  patternConfidence?: number;
  /** Pattern evidence */
  patternEvidence?: string[];

  // Health-related context
  /** Previous health score */
  previousHealthScore?: number;
  /** Current health score */
  currentHealthScore?: number;

  // Capability-related context
  /** Changed capability */
  capability?: ProtocolFeature;
  /** Previous capability level */
  previousLevel?: CapabilityLevel;
  /** New capability level */
  newLevel?: CapabilityLevel;

  /** Additional context data */
  additional?: Record<string, unknown>;
}

/**
 * Adaptation hook function signature.
 */
export type AdaptationHookFn = (context: HookContext) => Promise<HookResult> | HookResult;

/**
 * Registered hook definition.
 */
export interface RegisteredHook {
  /** Unique hook ID */
  hookId: string;
  /** Hook type */
  hookType: AdaptationHookType;
  /** Hook function */
  fn: AdaptationHookFn;
  /** Priority */
  priority: HookPriority;
  /** Protocols this hook applies to (undefined = all) */
  protocols?: AgentFramework[];
  /** Is hook enabled */
  enabled: boolean;
  /** Hook description */
  description?: string;
  /** Error handling strategy */
  onError: 'ignore' | 'warn' | 'fail';
  /** Timeout in milliseconds */
  timeoutMs: number;
  /** Tags for categorization */
  tags?: string[];
}

/**
 * Result of executing a chain of hooks.
 */
export interface HookChainResult {
  success: boolean;
  executedHooks: Array<{ hookId: string; result: HookResult }>;
  finalContext: HookContext;
  totalTimeMs: number;
  error?: Error;
}

/**
 * Hook execution statistics.
 */
export interface ExecutionStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  totalExecutionTimeMs: number;
  hookTypeStats: Map<
    AdaptationHookType,
    {
      executions: number;
      totalTimeMs: number;
      errors: number;
    }
  >;
}

/**
 * Priority weights for ordering hooks.
 */
export const PRIORITY_WEIGHTS: Record<HookPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
  background: 4,
};

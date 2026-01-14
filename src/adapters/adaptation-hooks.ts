/**
 * Adaptation Hooks and Version Negotiation Layer
 *
 * Provides anticipatory design patterns for adapter self-modification:
 * - Adaptation hooks at key intervention points
 * - Version negotiation for multi-version protocol support
 * - Extensibility points for AI-led maintenance integration
 * - Pattern detection sensors for autonomous monitoring
 *
 * This is a facade module that re-exports from the decomposed adaptation modules.
 *
 * @module adapters/adaptation-hooks
 * @version 1.0.0
 * @see {@link ../ai-maintenance/adaptation-pipeline.ts}
 */

// Re-export all types
export {
  AdaptationHookType,
  HookPriority,
  HookResult,
  HookContext,
  AdaptationHookFn,
  RegisteredHook,
  HookChainResult,
  ExecutionStats,
  PRIORITY_WEIGHTS,
} from './adaptation/types';

// Re-export Hook Executor
export { AdaptationHookExecutor } from './adaptation/hook-executor';

// Re-export Version Negotiator
export {
  NegotiationStrategy,
  NegotiationRequest,
  NegotiationResult,
  NegotiationHistoryEntry,
  VersionNegotiator,
} from './adaptation/version-negotiator';

// Re-export Extensibility Manager
export {
  ExtensionType,
  ExtensionHandler,
  ExtensionInput,
  ExtensionOutput,
  ExtensionPoint,
  ExtensibilityManager,
} from './adaptation/extensibility-manager';

// Re-export Pattern Sensor Manager
export {
  PatternSensor,
  PatternDetectionFn,
  SensorContext,
  SensorMetrics,
  SensorHistoryEntry,
  SensorReading,
  PatternSensorManager,
} from './adaptation/pattern-sensor-manager';

// Re-export factory functions
export {
  createHookFactories,
  createPreConversionHook,
  createPostConversionHook,
  createErrorHook,
  createVersionMismatchHook,
  createPatternDetectedHook,
} from './adaptation';

// Re-export singleton instances
export {
  hookExecutor,
  versionNegotiator,
  extensibilityManager,
  patternSensorManager,
} from './adaptation';

// Default export for backward compatibility
import {
  hookExecutor,
  versionNegotiator,
  extensibilityManager,
  patternSensorManager,
  createPreConversionHook,
  createPostConversionHook,
  createErrorHook,
  createVersionMismatchHook,
  createPatternDetectedHook,
} from './adaptation';

export default {
  hookExecutor,
  versionNegotiator,
  extensibilityManager,
  patternSensorManager,
  createPreConversionHook,
  createPostConversionHook,
  createErrorHook,
  createVersionMismatchHook,
  createPatternDetectedHook,
};

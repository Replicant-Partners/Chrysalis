/**
 * Adaptation Module
 *
 * Barrel exports for adaptation hooks, version negotiation, extensibility, and pattern sensors.
 *
 * @module adapters/adaptation
 */

// Types
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
} from './types';

// Hook Executor
export { AdaptationHookExecutor } from './hook-executor';

// Version Negotiator
export {
  NegotiationStrategy,
  NegotiationRequest,
  NegotiationResult,
  NegotiationHistoryEntry,
  VersionNegotiator,
} from './version-negotiator';

// Extensibility Manager
export {
  ExtensionType,
  ExtensionHandler,
  ExtensionInput,
  ExtensionOutput,
  ExtensionPoint,
  ExtensibilityManager,
} from './extensibility-manager';

// Pattern Sensor Manager
export {
  PatternSensor,
  PatternDetectionFn,
  SensorContext,
  SensorMetrics,
  SensorHistoryEntry,
  SensorReading,
  PatternSensorManager,
} from './pattern-sensor-manager';

// Factory function creator
export { createHookFactories } from './factory';

// Singleton instances
import { AdaptationHookExecutor } from './hook-executor';
import { VersionNegotiator } from './version-negotiator';
import { ExtensibilityManager } from './extensibility-manager';
import { PatternSensorManager } from './pattern-sensor-manager';
import { createHookFactories } from './factory';

/**
 * Global adaptation hook executor instance.
 */
export const hookExecutor = new AdaptationHookExecutor();

/**
 * Global version negotiator instance.
 */
export const versionNegotiator = new VersionNegotiator();

/**
 * Global extensibility manager instance.
 */
export const extensibilityManager = new ExtensibilityManager();

/**
 * Global pattern sensor manager instance.
 */
export const patternSensorManager = new PatternSensorManager();

// Create factory functions bound to the global executor
const factories = createHookFactories(hookExecutor);

/**
 * Create a pre-conversion hook.
 */
export const createPreConversionHook = factories.createPreConversionHook;

/**
 * Create a post-conversion hook.
 */
export const createPostConversionHook = factories.createPostConversionHook;

/**
 * Create an error handling hook.
 */
export const createErrorHook = factories.createErrorHook;

/**
 * Create a version mismatch hook.
 */
export const createVersionMismatchHook = factories.createVersionMismatchHook;

/**
 * Create a pattern detection hook.
 */
export const createPatternDetectedHook = factories.createPatternDetectedHook;

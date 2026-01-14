/**
 * Adaptation Hook Factory Functions
 *
 * Convenience functions for creating common hook types.
 *
 * @module adapters/adaptation/factory
 */

import { HookContext, HookResult, RegisteredHook } from './types';
import { AdaptationHookExecutor } from './hook-executor';

/**
 * Create factory functions bound to a specific executor.
 */
export function createHookFactories(executor: AdaptationHookExecutor) {
  return {
    /**
     * Create a pre-conversion hook.
     */
    createPreConversionHook(
      fn: (context: HookContext) => Promise<HookResult>,
      options?: Partial<RegisteredHook>
    ): string {
      return executor.registerHook('pre-conversion', fn, options);
    },

    /**
     * Create a post-conversion hook.
     */
    createPostConversionHook(
      fn: (context: HookContext) => Promise<HookResult>,
      options?: Partial<RegisteredHook>
    ): string {
      return executor.registerHook('post-conversion', fn, options);
    },

    /**
     * Create an error handling hook.
     */
    createErrorHook(
      fn: (context: HookContext) => Promise<HookResult>,
      options?: Partial<RegisteredHook>
    ): string {
      return executor.registerHook('on-error', fn, options);
    },

    /**
     * Create a version mismatch hook.
     */
    createVersionMismatchHook(
      fn: (context: HookContext) => Promise<HookResult>,
      options?: Partial<RegisteredHook>
    ): string {
      return executor.registerHook('on-version-mismatch', fn, options);
    },

    /**
     * Create a pattern detection hook.
     */
    createPatternDetectedHook(
      fn: (context: HookContext) => Promise<HookResult>,
      options?: Partial<RegisteredHook>
    ): string {
      return executor.registerHook('on-pattern-detected', fn, options);
    },
  };
}

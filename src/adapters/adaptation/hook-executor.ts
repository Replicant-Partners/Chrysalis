/**
 * Adaptation Hook Executor
 *
 * Executes adaptation hooks for a given hook type.
 *
 * @module adapters/adaptation/hook-executor
 */

import { EventEmitter } from 'events';
import {
  AdaptationHookType,
  AdaptationHookFn,
  HookContext,
  HookResult,
  HookChainResult,
  RegisteredHook,
  ExecutionStats,
  HookPriority,
  PRIORITY_WEIGHTS,
} from './types';

/**
 * Executes adaptation hooks for a given hook type.
 */
export class AdaptationHookExecutor extends EventEmitter {
  private hooks: Map<string, RegisteredHook> = new Map();
  private hooksByType: Map<AdaptationHookType, Set<string>> = new Map();
  private executionStats: ExecutionStats;
  private hookIdCounter = 0;

  constructor() {
    super();
    this.executionStats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalExecutionTimeMs: 0,
      hookTypeStats: new Map(),
    };
  }

  /**
   * Register an adaptation hook.
   */
  registerHook(
    hookType: AdaptationHookType,
    fn: AdaptationHookFn,
    options: Partial<Omit<RegisteredHook, 'hookId' | 'hookType' | 'fn'>> = {}
  ): string {
    const hookId = `hook-${hookType}-${++this.hookIdCounter}`;

    const hook: RegisteredHook = {
      hookId,
      hookType,
      fn,
      priority: options.priority ?? 'normal',
      protocols: options.protocols,
      enabled: options.enabled ?? true,
      description: options.description,
      onError: options.onError ?? 'warn',
      timeoutMs: options.timeoutMs ?? 5000,
      tags: options.tags,
    };

    this.hooks.set(hookId, hook);

    // Index by type
    if (!this.hooksByType.has(hookType)) {
      this.hooksByType.set(hookType, new Set());
    }
    this.hooksByType.get(hookType)!.add(hookId);

    this.emit('hook:registered', hook);
    return hookId;
  }

  /**
   * Unregister a hook.
   */
  unregisterHook(hookId: string): boolean {
    const hook = this.hooks.get(hookId);
    if (!hook) return false;

    this.hooks.delete(hookId);
    this.hooksByType.get(hook.hookType)?.delete(hookId);

    this.emit('hook:unregistered', hook);
    return true;
  }

  /**
   * Enable or disable a hook.
   */
  setHookEnabled(hookId: string, enabled: boolean): boolean {
    const hook = this.hooks.get(hookId);
    if (!hook) return false;

    hook.enabled = enabled;
    this.emit('hook:toggled', hook, enabled);
    return true;
  }

  /**
   * Execute all hooks for a given type.
   */
  async executeHooks(
    hookType: AdaptationHookType,
    context: HookContext
  ): Promise<HookChainResult> {
    const hookIds = this.hooksByType.get(hookType);
    if (!hookIds || hookIds.size === 0) {
      return {
        success: true,
        executedHooks: [],
        finalContext: context,
        totalTimeMs: 0,
      };
    }

    // Get applicable hooks, sorted by priority
    const applicableHooks = Array.from(hookIds)
      .map((id) => this.hooks.get(id)!)
      .filter((hook) => this.isHookApplicable(hook, context))
      .sort((a, b) => PRIORITY_WEIGHTS[a.priority] - PRIORITY_WEIGHTS[b.priority]);

    const result: HookChainResult = {
      success: true,
      executedHooks: [],
      finalContext: context,
      totalTimeMs: 0,
    };

    let currentContext = { ...context };
    const startTime = Date.now();

    for (const hook of applicableHooks) {
      const hookResult = await this.executeHook(hook, currentContext);
      result.executedHooks.push({
        hookId: hook.hookId,
        result: hookResult,
      });

      // Update stats
      this.updateStats(hook.hookType, hookResult);

      if (hookResult.error) {
        this.emit('hook:error', hook, hookResult.error);

        if (hook.onError === 'fail') {
          result.success = false;
          result.error = hookResult.error;
          break;
        }
      }

      // Update context if modified
      if (hookResult.modifiedContext) {
        currentContext = hookResult.modifiedContext;
      }

      // Check if chain should continue
      if (!hookResult.continueChain) {
        break;
      }
    }

    result.totalTimeMs = Date.now() - startTime;
    result.finalContext = currentContext;

    this.emit('hooks:executed', hookType, result);
    return result;
  }

  /**
   * Execute a single hook with timeout.
   */
  private async executeHook(hook: RegisteredHook, context: HookContext): Promise<HookResult> {
    const startTime = Date.now();

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<HookResult>((_, reject) => {
        setTimeout(() => reject(new Error(`Hook ${hook.hookId} timed out`)), hook.timeoutMs);
      });

      // Execute hook with timeout
      const result = await Promise.race([Promise.resolve(hook.fn(context)), timeoutPromise]);

      this.executionStats.successfulExecutions++;
      return {
        ...result,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      this.executionStats.failedExecutions++;
      return {
        continueChain: hook.onError !== 'fail',
        error: error instanceof Error ? error : new Error(String(error)),
        executionTimeMs: Date.now() - startTime,
      };
    } finally {
      this.executionStats.totalExecutions++;
    }
  }

  /**
   * Check if a hook applies to the given context.
   */
  private isHookApplicable(hook: RegisteredHook, context: HookContext): boolean {
    if (!hook.enabled) return false;
    if (!hook.protocols || hook.protocols.length === 0) return true;
    return hook.protocols.includes(context.protocol);
  }

  /**
   * Update execution statistics.
   */
  private updateStats(hookType: AdaptationHookType, result: HookResult): void {
    this.executionStats.totalExecutionTimeMs += result.executionTimeMs;

    if (!this.executionStats.hookTypeStats.has(hookType)) {
      this.executionStats.hookTypeStats.set(hookType, {
        executions: 0,
        totalTimeMs: 0,
        errors: 0,
      });
    }

    const typeStats = this.executionStats.hookTypeStats.get(hookType)!;
    typeStats.executions++;
    typeStats.totalTimeMs += result.executionTimeMs;
    if (result.error) typeStats.errors++;
  }

  /**
   * Get registered hooks of a specific type.
   */
  getHooks(hookType?: AdaptationHookType): RegisteredHook[] {
    if (hookType) {
      const hookIds = this.hooksByType.get(hookType);
      if (!hookIds) return [];
      return Array.from(hookIds).map((id) => this.hooks.get(id)!);
    }
    return Array.from(this.hooks.values());
  }

  /**
   * Get execution statistics.
   */
  getStats(): ExecutionStats {
    return { ...this.executionStats };
  }

  /**
   * Reset execution statistics.
   */
  resetStats(): void {
    this.executionStats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalExecutionTimeMs: 0,
      hookTypeStats: new Map(),
    };
  }
}

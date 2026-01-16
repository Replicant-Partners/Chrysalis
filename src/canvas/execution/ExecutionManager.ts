/**
 * Execution Manager
 *
 * Manages canvas execution lifecycle:
 * - State transitions (active ↔ background ↔ suspended ↔ hibernated)
 * - Resource budget enforcement
 * - Task scheduling and throttling
 * - State preservation and restoration
 */

import { EventEmitter } from 'events';
import type { CanvasId, CanvasKind, CanvasState } from '../core/types';
import {
  ExecutionState,
  ExecutionTransition,
  TransitionReason,
  ResourceBudget,
  CanvasResourceConfig,
  ManagedTask,
  TaskContext,
  PreservedState,
  PreservationOptions,
  ResourceMetrics,
  ExecutionEvent,
  ExecutionEventType,
  DEFAULT_RESOURCE_BUDGETS,
  DEFAULT_CANVAS_RESOURCE_CONFIGS,
} from './types';

// =============================================================================
// Canvas Execution Context
// =============================================================================

interface CanvasExecutionContext {
  canvasId: CanvasId;
  canvasKind: CanvasKind;
  state: ExecutionState;
  stateEnteredAt: number;
  config: CanvasResourceConfig;
  budget: ResourceBudget;

  // Resource tracking
  memoryUsageMB: number;
  cpuMsUsedThisSecond: number;
  networkRequestsThisMinute: number;
  lastCpuReset: number;
  lastNetworkReset: number;

  // Tasks
  tasks: Map<string, ManagedTask>;

  // Timers
  backgroundTimer?: NodeJS.Timeout;
  hibernateTimer?: NodeJS.Timeout;

  // Preserved state
  preservedState?: PreservedState;
}

// =============================================================================
// Execution Manager
// =============================================================================

export class ExecutionManager {
  private contexts: Map<CanvasId, CanvasExecutionContext> = new Map();
  private emitter = new EventEmitter();
  private taskIdCounter = 0;

  // Resource monitoring interval
  private monitorInterval?: NodeJS.Timeout;
  private readonly MONITOR_INTERVAL_MS = 1000;

  constructor() {
    this.startMonitoring();
  }

  // ===========================================================================
  // Canvas Registration
  // ===========================================================================

  /**
   * Register a canvas for execution management.
   */
  register(
    canvasId: CanvasId,
    canvasKind: CanvasKind,
    config?: Partial<CanvasResourceConfig>
  ): void {
    if (this.contexts.has(canvasId)) {
      throw new Error(`Canvas ${canvasId} is already registered`);
    }

    const defaultConfig = DEFAULT_CANVAS_RESOURCE_CONFIGS[canvasKind];
    const fullConfig: CanvasResourceConfig = { ...defaultConfig, ...config };

    const context: CanvasExecutionContext = {
      canvasId,
      canvasKind,
      state: 'active',
      stateEnteredAt: Date.now(),
      config: fullConfig,
      budget: this.getBudgetForState('active', fullConfig),
      memoryUsageMB: 0,
      cpuMsUsedThisSecond: 0,
      networkRequestsThisMinute: 0,
      lastCpuReset: Date.now(),
      lastNetworkReset: Date.now(),
      tasks: new Map(),
    };

    this.contexts.set(canvasId, context);
    this.emit('state:changed', canvasId, {
      from: undefined,
      to: 'active',
      reason: 'user_restore'
    });
  }

  /**
   * Unregister a canvas.
   */
  unregister(canvasId: CanvasId): void {
    const context = this.contexts.get(canvasId);
    if (!context) return;

    // Cancel all tasks
    context.tasks.forEach(task => {
      this.cancelTask(canvasId, task.id);
    });

    // Clear timers
    if (context.backgroundTimer) clearTimeout(context.backgroundTimer);
    if (context.hibernateTimer) clearTimeout(context.hibernateTimer);

    this.contexts.delete(canvasId);
  }

  // ===========================================================================
  // State Transitions
  // ===========================================================================

  /**
   * Get current execution state of a canvas.
   */
  getState(canvasId: CanvasId): ExecutionState | undefined {
    return this.contexts.get(canvasId)?.state;
  }

  /**
   * Transition canvas to background state.
   */
  async toBackground(canvasId: CanvasId, reason: TransitionReason = 'user_switch'): Promise<void> {
    const context = this.contexts.get(canvasId);
    if (!context) return;

    if (context.state === 'background') return;
    if (!context.config.allowBackground) {
      // Canvas doesn't support background, go directly to suspended
      await this.toSuspended(canvasId, reason);
      return;
    }

    const from = context.state;
    context.state = 'background';
    context.stateEnteredAt = Date.now();
    context.budget = this.getBudgetForState('background', context.config);

    // Pause non-essential tasks
    context.tasks.forEach(task => {
      if (task.pausable && task.priority < 5) {
        this.pauseTask(canvasId, task.id);
      }
    });

    // Start background timeout if configured
    if (context.config.backgroundTimeoutMs > 0) {
      context.backgroundTimer = setTimeout(() => {
        this.toSuspended(canvasId, 'idle_timeout');
      }, context.config.backgroundTimeoutMs);
    }

    this.emitTransition(canvasId, from, 'background', reason);
  }

  /**
   * Transition canvas to suspended state.
   */
  async toSuspended(
    canvasId: CanvasId,
    reason: TransitionReason = 'manual_suspend',
    canvasState?: CanvasState
  ): Promise<void> {
    const context = this.contexts.get(canvasId);
    if (!context) return;

    if (context.state === 'suspended') return;

    const from = context.state;

    // Pause all pausable tasks
    context.tasks.forEach(task => {
      if (task.pausable && task.state === 'running') {
        this.pauseTask(canvasId, task.id);
      }
    });

    // Preserve state if provided
    if (canvasState) {
      context.preservedState = this.createPreservedState(context, canvasState);
      this.emit('state:preserved', canvasId, { preservedState: context.preservedState });
    }

    // Clear background timer
    if (context.backgroundTimer) {
      clearTimeout(context.backgroundTimer);
      context.backgroundTimer = undefined;
    }

    context.state = 'suspended';
    context.stateEnteredAt = Date.now();
    context.budget = this.getBudgetForState('suspended', context.config);

    // Start hibernate timeout if configured
    if (context.config.hibernateTimeoutMs > 0) {
      context.hibernateTimer = setTimeout(() => {
        this.toHibernated(canvasId, 'idle_timeout');
      }, context.config.hibernateTimeoutMs);
    }

    this.emitTransition(canvasId, from, 'suspended', reason);
  }

  /**
   * Transition canvas to hibernated state.
   */
  async toHibernated(
    canvasId: CanvasId,
    reason: TransitionReason = 'manual_suspend'
  ): Promise<void> {
    const context = this.contexts.get(canvasId);
    if (!context) return;

    if (context.state === 'hibernated') return;

    const from = context.state;

    // Cancel non-persistable tasks
    context.tasks.forEach(task => {
      if (!task.persistable) {
        this.cancelTask(canvasId, task.id);
      }
    });

    // Clear timers
    if (context.backgroundTimer) clearTimeout(context.backgroundTimer);
    if (context.hibernateTimer) clearTimeout(context.hibernateTimer);

    context.state = 'hibernated';
    context.stateEnteredAt = Date.now();
    context.budget = this.getBudgetForState('hibernated', context.config);

    // In a real implementation, we'd persist the state to disk here

    this.emitTransition(canvasId, from, 'hibernated', reason);
  }

  /**
   * Restore canvas to active state.
   */
  async toActive(canvasId: CanvasId, reason: TransitionReason = 'user_restore'): Promise<PreservedState | undefined> {
    const context = this.contexts.get(canvasId);
    if (!context) return undefined;

    if (context.state === 'active') return undefined;

    const from = context.state;
    const preservedState = context.preservedState;

    // Clear timers
    if (context.backgroundTimer) clearTimeout(context.backgroundTimer);
    if (context.hibernateTimer) clearTimeout(context.hibernateTimer);

    // Resume paused tasks
    context.tasks.forEach(task => {
      if (task.state === 'paused') {
        this.resumeTask(canvasId, task.id);
      }
    });

    context.state = 'active';
    context.stateEnteredAt = Date.now();
    context.budget = this.getBudgetForState('active', context.config);
    context.preservedState = undefined;

    this.emitTransition(canvasId, from, 'active', reason);

    if (preservedState) {
      this.emit('state:restored', canvasId, { preservedState });
    }

    return preservedState;
  }

  // ===========================================================================
  // Task Management
  // ===========================================================================

  /**
   * Start a managed task on a canvas.
   */
  startTask(
    canvasId: CanvasId,
    name: string,
    options: Partial<Pick<ManagedTask, 'pausable' | 'persistable' | 'priority'>> = {}
  ): ManagedTask | null {
    const context = this.contexts.get(canvasId);
    if (!context) return null;

    // Check task limit
    const runningTasks = Array.from(context.tasks.values()).filter(t => t.state === 'running');
    if (context.budget.maxConcurrentTasks > 0 &&
        runningTasks.length >= context.budget.maxConcurrentTasks) {
      this.emit('budget:exceeded', canvasId, { resource: 'tasks', limit: context.budget.maxConcurrentTasks });
      return null;
    }

    const task: ManagedTask = {
      id: `task_${++this.taskIdCounter}`,
      canvasId,
      name,
      state: 'running',
      startedAt: Date.now(),
      pausable: options.pausable ?? true,
      persistable: options.persistable ?? false,
      priority: options.priority ?? 5,
      progress: -1,
    };

    context.tasks.set(task.id, task);
    this.emit('task:started', canvasId, { task });

    return task;
  }

  /**
   * Complete a task.
   */
  completeTask(canvasId: CanvasId, taskId: string): void {
    const context = this.contexts.get(canvasId);
    const task = context?.tasks.get(taskId);
    if (!task) return;

    task.state = 'completed';
    task.completedAt = Date.now();
    task.progress = 100;

    this.emit('task:completed', canvasId, { task });
  }

  /**
   * Fail a task.
   */
  failTask(canvasId: CanvasId, taskId: string, error: string): void {
    const context = this.contexts.get(canvasId);
    const task = context?.tasks.get(taskId);
    if (!task) return;

    task.state = 'failed';
    task.completedAt = Date.now();
    task.error = error;

    this.emit('task:failed', canvasId, { task, error });
  }

  /**
   * Pause a task.
   */
  pauseTask(canvasId: CanvasId, taskId: string): boolean {
    const context = this.contexts.get(canvasId);
    const task = context?.tasks.get(taskId);
    if (!task || !task.pausable || task.state !== 'running') return false;

    task.state = 'paused';
    task.pausedAt = Date.now();

    this.emit('task:paused', canvasId, { task });
    return true;
  }

  /**
   * Resume a paused task.
   */
  resumeTask(canvasId: CanvasId, taskId: string): boolean {
    const context = this.contexts.get(canvasId);
    const task = context?.tasks.get(taskId);
    if (!task || task.state !== 'paused') return false;

    task.state = 'running';
    task.pausedAt = undefined;

    this.emit('task:resumed', canvasId, { task });
    return true;
  }

  /**
   * Cancel a task.
   */
  cancelTask(canvasId: CanvasId, taskId: string): boolean {
    const context = this.contexts.get(canvasId);
    const task = context?.tasks.get(taskId);
    if (!task) return false;

    task.state = 'cancelled';
    task.completedAt = Date.now();

    this.emit('task:cancelled', canvasId, { task });
    return true;
  }

  /**
   * Update task progress.
   */
  updateTaskProgress(canvasId: CanvasId, taskId: string, progress: number): void {
    const context = this.contexts.get(canvasId);
    const task = context?.tasks.get(taskId);
    if (task) {
      task.progress = Math.max(0, Math.min(100, progress));
    }
  }

  /**
   * Get task context for cooperative scheduling.
   */
  getTaskContext(canvasId: CanvasId, taskId: string): TaskContext | null {
    const context = this.contexts.get(canvasId);
    const task = context?.tasks.get(taskId);
    if (!context || !task) return null;

    return {
      shouldYield: () => {
        // Yield if in background and used up CPU budget
        if (context.state !== 'active' && context.budget.maxCpuMsPerSecond > 0) {
          return context.cpuMsUsedThisSecond >= context.budget.maxCpuMsPerSecond;
        }
        return false;
      },
      reportProgress: (progress: number) => {
        this.updateTaskProgress(canvasId, taskId, progress);
      },
      isCancelled: () => task.state === 'cancelled',
      getRemainingBudget: () => {
        if (context.budget.maxCpuMsPerSecond === 0) return Infinity;
        return Math.max(0, context.budget.maxCpuMsPerSecond - context.cpuMsUsedThisSecond);
      },
    };
  }

  // ===========================================================================
  // Resource Tracking
  // ===========================================================================

  /**
   * Report memory usage for a canvas.
   */
  reportMemoryUsage(canvasId: CanvasId, memoryMB: number): void {
    const context = this.contexts.get(canvasId);
    if (!context) return;

    context.memoryUsageMB = memoryMB;

    if (context.budget.maxMemoryMB > 0 && memoryMB > context.budget.maxMemoryMB) {
      this.emit('budget:exceeded', canvasId, {
        resource: 'memory',
        usage: memoryMB,
        limit: context.budget.maxMemoryMB
      });
    }
  }

  /**
   * Report CPU time used (call this after executing work).
   */
  reportCpuUsage(canvasId: CanvasId, cpuMs: number): void {
    const context = this.contexts.get(canvasId);
    if (!context) return;

    context.cpuMsUsedThisSecond += cpuMs;

    if (context.budget.maxCpuMsPerSecond > 0 &&
        context.cpuMsUsedThisSecond > context.budget.maxCpuMsPerSecond) {
      this.emit('budget:exceeded', canvasId, {
        resource: 'cpu',
        usage: context.cpuMsUsedThisSecond,
        limit: context.budget.maxCpuMsPerSecond
      });
    }
  }

  /**
   * Report a network request.
   */
  reportNetworkRequest(canvasId: CanvasId): boolean {
    const context = this.contexts.get(canvasId);
    if (!context) return false;

    context.networkRequestsThisMinute++;

    if (context.budget.maxNetworkRequestsPerMinute > 0 &&
        context.networkRequestsThisMinute > context.budget.maxNetworkRequestsPerMinute) {
      this.emit('budget:exceeded', canvasId, {
        resource: 'network',
        usage: context.networkRequestsThisMinute,
        limit: context.budget.maxNetworkRequestsPerMinute
      });
      return false; // Request should be blocked
    }

    return true;
  }

  /**
   * Get resource metrics for a canvas.
   */
  getMetrics(canvasId: CanvasId): ResourceMetrics | null {
    const context = this.contexts.get(canvasId);
    if (!context) return null;

    const budget = context.budget;
    return {
      canvasId,
      executionState: context.state,
      memoryUsageMB: context.memoryUsageMB,
      cpuMsUsed: context.cpuMsUsedThisSecond,
      activeTaskCount: Array.from(context.tasks.values()).filter(t => t.state === 'running').length,
      networkRequestCount: context.networkRequestsThisMinute,
      timeInStateMs: Date.now() - context.stateEnteredAt,
      budgetUtilization: {
        memory: budget.maxMemoryMB > 0 ? context.memoryUsageMB / budget.maxMemoryMB : 0,
        cpu: budget.maxCpuMsPerSecond > 0 ? context.cpuMsUsedThisSecond / budget.maxCpuMsPerSecond : 0,
        tasks: budget.maxConcurrentTasks > 0
          ? Array.from(context.tasks.values()).filter(t => t.state === 'running').length / budget.maxConcurrentTasks
          : 0,
        network: budget.maxNetworkRequestsPerMinute > 0
          ? context.networkRequestsThisMinute / budget.maxNetworkRequestsPerMinute
          : 0,
      },
    };
  }

  // ===========================================================================
  // State Preservation
  // ===========================================================================

  private createPreservedState(
    context: CanvasExecutionContext,
    canvasState: CanvasState
  ): PreservedState {
    const pausedTasks = Array.from(context.tasks.values()).filter(
      t => t.state === 'paused' && t.persistable
    );

    return {
      canvasId: context.canvasId,
      canvasKind: context.canvasKind,
      canvasState,
      preservedAt: Date.now(),
      previousExecutionState: context.state,
      pausedTasks,
      widgetStates: new Map(), // Would be populated by widgets
      scrollPosition: { x: canvasState.viewport.x, y: canvasState.viewport.y },
      selection: canvasState.selection,
      checksum: this.computeChecksum(canvasState),
    };
  }

  private computeChecksum(state: CanvasState): string {
    // Simple checksum based on node/edge counts and IDs
    const nodeIds = state.nodes.map(n => n.id).sort().join(',');
    const edgeIds = state.edges.map(e => e.id).sort().join(',');
    return `${state.nodes.length}-${state.edges.length}-${hashCode(nodeIds + edgeIds)}`;
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  private getBudgetForState(state: ExecutionState, config: CanvasResourceConfig): ResourceBudget {
    const baseBudget = DEFAULT_RESOURCE_BUDGETS[state];
    const overrides = config.budgetOverrides?.[state];
    return { ...baseBudget, ...overrides };
  }

  private startMonitoring(): void {
    this.monitorInterval = setInterval(() => {
      const now = Date.now();

      this.contexts.forEach(context => {
        // Reset CPU counter every second
        if (now - context.lastCpuReset >= 1000) {
          context.cpuMsUsedThisSecond = 0;
          context.lastCpuReset = now;
        }

        // Reset network counter every minute
        if (now - context.lastNetworkReset >= 60000) {
          context.networkRequestsThisMinute = 0;
          context.lastNetworkReset = now;
        }
      });
    }, this.MONITOR_INTERVAL_MS);
  }

  /**
   * Stop monitoring and clean up.
   */
  dispose(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
    this.contexts.forEach((_, canvasId) => this.unregister(canvasId));
    this.emitter.removeAllListeners();
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  on(event: ExecutionEventType, handler: (e: ExecutionEvent) => void): void {
    this.emitter.on(event, handler);
  }

  off(event: ExecutionEventType, handler: (e: ExecutionEvent) => void): void {
    this.emitter.off(event, handler);
  }

  private emit<T>(type: ExecutionEventType, canvasId: CanvasId, payload: T): void {
    const event: ExecutionEvent<T> = {
      type,
      canvasId,
      timestamp: Date.now(),
      payload,
    };
    this.emitter.emit(type, event);
  }

  private emitTransition(
    canvasId: CanvasId,
    from: ExecutionState,
    to: ExecutionState,
    reason: TransitionReason
  ): void {
    this.emit('state:changed', canvasId, { from, to, reason });
  }
}

// =============================================================================
// Utility
// =============================================================================

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// =============================================================================
// Singleton
// =============================================================================

let globalManager: ExecutionManager | null = null;

export function getExecutionManager(): ExecutionManager {
  if (!globalManager) {
    globalManager = new ExecutionManager();
  }
  return globalManager;
}

export function resetExecutionManager(): void {
  globalManager?.dispose();
  globalManager = null;
}

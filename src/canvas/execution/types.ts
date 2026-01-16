/**
 * Background Execution Types
 *
 * Defines the execution model for canvases:
 * - Execution states (active, background, suspended)
 * - Resource budgets and limits
 * - Process/task management
 * - State preservation
 */

import type { CanvasId, CanvasKind, CanvasState } from '../core/types';

// =============================================================================
// Execution States
// =============================================================================

/**
 * Canvas execution state.
 */
export type ExecutionState =
  | 'active'      // Visible and fully running
  | 'background'  // Hidden but still executing (e.g., terminal running)
  | 'suspended'   // Paused to save resources, state preserved
  | 'hibernated'; // State saved to disk, resources released

/**
 * Transition between execution states.
 */
export interface ExecutionTransition {
  from: ExecutionState;
  to: ExecutionState;
  canvasId: CanvasId;
  timestamp: number;
  reason: TransitionReason;
}

export type TransitionReason =
  | 'user_switch'      // User switched to another canvas
  | 'user_restore'     // User switched back to this canvas
  | 'resource_limit'   // Hit resource budget, forced to suspend
  | 'idle_timeout'     // No activity for too long
  | 'manual_suspend'   // Explicitly suspended by user/system
  | 'manual_restore'   // Explicitly restored
  | 'shutdown'         // Application shutting down
  | 'error';           // Error forced state change

// =============================================================================
// Resource Budgets
// =============================================================================

/**
 * Resource budget for a canvas in a specific execution state.
 */
export interface ResourceBudget {
  /** Maximum memory in MB (0 = unlimited) */
  maxMemoryMB: number;

  /** Maximum CPU time per second in ms (0 = unlimited, 1000 = full core) */
  maxCpuMsPerSecond: number;

  /** Maximum concurrent async tasks (0 = unlimited) */
  maxConcurrentTasks: number;

  /** Maximum network requests per minute (0 = unlimited) */
  maxNetworkRequestsPerMinute: number;

  /** Can this canvas render? (false for background/suspended) */
  canRender: boolean;

  /** Can this canvas receive user input? */
  canReceiveInput: boolean;

  /** Throttle interval for state updates in ms */
  stateUpdateThrottleMs: number;
}

/**
 * Default resource budgets per execution state.
 */
export const DEFAULT_RESOURCE_BUDGETS: Record<ExecutionState, ResourceBudget> = {
  active: {
    maxMemoryMB: 0,           // Unlimited
    maxCpuMsPerSecond: 0,     // Unlimited
    maxConcurrentTasks: 0,    // Unlimited
    maxNetworkRequestsPerMinute: 0, // Unlimited
    canRender: true,
    canReceiveInput: true,
    stateUpdateThrottleMs: 16, // ~60fps
  },
  background: {
    maxMemoryMB: 256,
    maxCpuMsPerSecond: 100,   // 10% of a core
    maxConcurrentTasks: 5,
    maxNetworkRequestsPerMinute: 60,
    canRender: false,
    canReceiveInput: false,
    stateUpdateThrottleMs: 1000, // 1 update per second
  },
  suspended: {
    maxMemoryMB: 64,
    maxCpuMsPerSecond: 0,     // No CPU
    maxConcurrentTasks: 0,
    maxNetworkRequestsPerMinute: 0,
    canRender: false,
    canReceiveInput: false,
    stateUpdateThrottleMs: 0, // No updates
  },
  hibernated: {
    maxMemoryMB: 0,           // State is on disk
    maxCpuMsPerSecond: 0,
    maxConcurrentTasks: 0,
    maxNetworkRequestsPerMinute: 0,
    canRender: false,
    canReceiveInput: false,
    stateUpdateThrottleMs: 0,
  },
};

/**
 * Canvas-specific resource configuration.
 */
export interface CanvasResourceConfig {
  canvasKind: CanvasKind;

  /** Allow this canvas to run in background? */
  allowBackground: boolean;

  /** Timeout before auto-suspending from background (ms, 0 = never) */
  backgroundTimeoutMs: number;

  /** Timeout before auto-hibernating from suspended (ms, 0 = never) */
  hibernateTimeoutMs: number;

  /** Priority for resource allocation (higher = more resources) */
  priority: number;

  /** Custom budgets per state (optional overrides) */
  budgetOverrides?: Partial<Record<ExecutionState, Partial<ResourceBudget>>>;
}

/**
 * Default resource configs per canvas type.
 */
export const DEFAULT_CANVAS_RESOURCE_CONFIGS: Record<CanvasKind, CanvasResourceConfig> = {
  settings: {
    canvasKind: 'settings',
    allowBackground: false,
    backgroundTimeoutMs: 0,
    hibernateTimeoutMs: 0,
    priority: 1,
  },
  board: {
    canvasKind: 'board',
    allowBackground: true,
    backgroundTimeoutMs: 300000, // 5 minutes
    hibernateTimeoutMs: 600000,  // 10 minutes
    priority: 5,
  },
  scrapbook: {
    canvasKind: 'scrapbook',
    allowBackground: true,
    backgroundTimeoutMs: 300000,
    hibernateTimeoutMs: 600000,
    priority: 3,
  },
  research: {
    canvasKind: 'research',
    allowBackground: true,
    backgroundTimeoutMs: 600000, // 10 minutes (longer for research)
    hibernateTimeoutMs: 1800000, // 30 minutes
    priority: 7,
  },
  'terminal-browser': {
    canvasKind: 'terminal-browser',
    allowBackground: true,
    backgroundTimeoutMs: 0,       // Never auto-suspend terminals
    hibernateTimeoutMs: 0,        // Never auto-hibernate
    priority: 10,                 // Highest priority
    budgetOverrides: {
      background: {
        maxCpuMsPerSecond: 500,   // More CPU for terminal
        maxConcurrentTasks: 20,
        maxNetworkRequestsPerMinute: 0, // Unlimited for browser
      },
    },
  },
};

// =============================================================================
// Task Management
// =============================================================================

/**
 * A managed async task within a canvas.
 */
export interface ManagedTask {
  id: string;
  canvasId: CanvasId;
  name: string;
  state: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  startedAt: number;
  pausedAt?: number;
  completedAt?: number;

  /** Can this task be paused? */
  pausable: boolean;

  /** Can this task survive suspension? */
  persistable: boolean;

  /** Priority (higher = more important) */
  priority: number;

  /** Progress (0-100, -1 = indeterminate) */
  progress: number;

  /** Error if failed */
  error?: string;
}

/**
 * Task execution context provided to tasks.
 */
export interface TaskContext {
  /** Check if task should yield/pause */
  shouldYield: () => boolean;

  /** Report progress */
  reportProgress: (progress: number) => void;

  /** Check if cancelled */
  isCancelled: () => boolean;

  /** Get remaining CPU budget for this tick */
  getRemainingBudget: () => number;
}

// =============================================================================
// State Preservation
// =============================================================================

/**
 * Preserved state for a suspended/hibernated canvas.
 */
export interface PreservedState {
  canvasId: CanvasId;
  canvasKind: CanvasKind;

  /** Full canvas state */
  canvasState: CanvasState;

  /** Preserved at timestamp */
  preservedAt: number;

  /** Previous execution state */
  previousExecutionState: ExecutionState;

  /** Paused tasks that can be resumed */
  pausedTasks: ManagedTask[];

  /** Widget-specific preserved data */
  widgetStates: Map<string, unknown>;

  /** Scroll position to restore */
  scrollPosition: { x: number; y: number };

  /** Selection to restore */
  selection: { nodeIds: string[]; edgeIds: string[] };

  /** Checksum for integrity verification */
  checksum: string;
}

/**
 * Options for state preservation.
 */
export interface PreservationOptions {
  /** Include widget-specific state */
  includeWidgetStates: boolean;

  /** Compress the preserved state */
  compress: boolean;

  /** Store to disk (for hibernation) */
  persistToDisk: boolean;

  /** Encryption key (optional) */
  encryptionKey?: string;
}

// =============================================================================
// Execution Events
// =============================================================================

export type ExecutionEventType =
  | 'state:changed'
  | 'task:started'
  | 'task:completed'
  | 'task:failed'
  | 'task:paused'
  | 'task:resumed'
  | 'task:cancelled'
  | 'budget:exceeded'
  | 'state:preserved'
  | 'state:restored';

export interface ExecutionEvent<T = unknown> {
  type: ExecutionEventType;
  canvasId: CanvasId;
  timestamp: number;
  payload: T;
}

// =============================================================================
// Resource Usage Metrics
// =============================================================================

export interface ResourceMetrics {
  canvasId: CanvasId;
  executionState: ExecutionState;

  /** Current memory usage in MB */
  memoryUsageMB: number;

  /** CPU time used in current second (ms) */
  cpuMsUsed: number;

  /** Active task count */
  activeTaskCount: number;

  /** Network requests in current minute */
  networkRequestCount: number;

  /** Time in current state (ms) */
  timeInStateMs: number;

  /** Budget utilization (0-1 for each resource) */
  budgetUtilization: {
    memory: number;
    cpu: number;
    tasks: number;
    network: number;
  };
}

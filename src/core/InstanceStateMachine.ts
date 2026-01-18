/**
 * Instance State Machine
 * 
 * Enforces valid state transitions for agent instances.
 * Prevents invalid transitions like terminated → running.
 * 
 * @module InstanceStateMachine
 * @version 1.0.0
 * @status Implemented
 * 
 * HIGH-004: Instance state transitions now formally defined and enforced.
 */

import type { InstanceStatus } from './SemanticAgent';

// =============================================================================
// TRANSITION DEFINITIONS
// =============================================================================

/**
 * Valid state transitions map.
 * Each state lists the states it can transition TO.
 * 
 * State Diagram:
 * 
 *     ┌──────────────────────────────────────┐
 *     │                                      │
 *     ▼                                      │
 *   ┌────────┐     ┌──────┐     ┌────────┐  │
 *   │  idle  │◄───►│running│◄───►│syncing │──┘
 *   └───┬────┘     └───┬───┘     └───┬────┘
 *       │              │              │
 *       ▼              ▼              ▼
 *   ┌─────────────────────────────────────┐
 *   │           terminated                │
 *   └─────────────────────────────────────┘
 */
const VALID_TRANSITIONS: Record<InstanceStatus, InstanceStatus[]> = {
  idle: ['running', 'syncing', 'terminated'],
  running: ['idle', 'syncing', 'terminated'],
  syncing: ['idle', 'running', 'terminated'],
  terminated: [] // Terminal state - no transitions allowed
};

/**
 * Transition event types for logging and hooks
 */
export type TransitionEvent = 
  | 'start'        // idle → running
  | 'pause'        // running → idle
  | 'sync_begin'   // running/idle → syncing
  | 'sync_end'     // syncing → running/idle
  | 'terminate'    // any → terminated
  | 'resume';      // idle → running

// =============================================================================
// STATE MACHINE ERROR
// =============================================================================

/**
 * Error thrown when an invalid state transition is attempted
 */
export class InvalidStateTransitionError extends Error {
  constructor(
    public readonly currentState: InstanceStatus,
    public readonly requestedState: InstanceStatus,
    public readonly instanceId?: string
  ) {
    const context = instanceId ? ` for instance ${instanceId}` : '';
    super(
      `Invalid state transition${context}: cannot transition from '${currentState}' to '${requestedState}'. ` +
      `Valid transitions from '${currentState}': [${VALID_TRANSITIONS[currentState].join(', ') || 'none (terminal state)'}]`
    );
    this.name = 'InvalidStateTransitionError';
  }
}

// =============================================================================
// STATE MACHINE
// =============================================================================

/**
 * Callback for state transition events
 */
export type TransitionCallback = (
  previousState: InstanceStatus,
  newState: InstanceStatus,
  event?: TransitionEvent
) => void;

/**
 * Options for state machine configuration
 */
export interface StateMachineOptions {
  /** Instance identifier for error messages */
  instanceId?: string;
  
  /** Initial state (defaults to 'idle') */
  initialState?: InstanceStatus;
  
  /** Callback invoked before transition (can throw to cancel) */
  onBeforeTransition?: TransitionCallback;
  
  /** Callback invoked after successful transition */
  onAfterTransition?: TransitionCallback;
  
  /** Whether to log transitions (defaults to false) */
  logTransitions?: boolean;
}

/**
 * Instance State Machine with enforced transitions
 * 
 * @example
 * ```typescript
 * const machine = new InstanceStateMachine({ instanceId: 'agent-001' });
 * 
 * machine.transition('running');  // OK: idle → running
 * machine.transition('syncing');  // OK: running → syncing
 * machine.transition('running');  // OK: syncing → running
 * machine.transition('terminated'); // OK: running → terminated
 * machine.transition('running');  // ERROR: cannot transition from terminated
 * ```
 */
export class InstanceStateMachine {
  private _state: InstanceStatus;
  private readonly instanceId?: string;
  private readonly onBeforeTransition?: TransitionCallback;
  private readonly onAfterTransition?: TransitionCallback;
  private readonly logTransitions: boolean;
  private readonly history: Array<{
    from: InstanceStatus;
    to: InstanceStatus;
    timestamp: Date;
    event?: TransitionEvent;
  }> = [];

  constructor(options: StateMachineOptions = {}) {
    this._state = options.initialState ?? 'idle';
    this.instanceId = options.instanceId;
    this.onBeforeTransition = options.onBeforeTransition;
    this.onAfterTransition = options.onAfterTransition;
    this.logTransitions = options.logTransitions ?? false;
  }

  /**
   * Current state of the instance
   */
  get state(): InstanceStatus {
    return this._state;
  }

  /**
   * Whether the instance is in a terminal state
   */
  get isTerminated(): boolean {
    return this._state === 'terminated';
  }

  /**
   * Whether the instance can accept work
   */
  get canAcceptWork(): boolean {
    return this._state === 'idle' || this._state === 'running';
  }

  /**
   * Get valid transitions from current state
   */
  get validTransitions(): InstanceStatus[] {
    return [...VALID_TRANSITIONS[this._state]];
  }

  /**
   * Get transition history
   */
  get transitionHistory(): ReadonlyArray<{
    from: InstanceStatus;
    to: InstanceStatus;
    timestamp: Date;
    event?: TransitionEvent;
  }> {
    return this.history;
  }

  /**
   * Check if a transition to the given state is valid
   */
  canTransitionTo(newState: InstanceStatus): boolean {
    return VALID_TRANSITIONS[this._state].includes(newState);
  }

  /**
   * Attempt to transition to a new state
   * 
   * @throws InvalidStateTransitionError if transition is not allowed
   */
  transition(newState: InstanceStatus, event?: TransitionEvent): void {
    if (!this.canTransitionTo(newState)) {
      throw new InvalidStateTransitionError(this._state, newState, this.instanceId);
    }

    const previousState = this._state;

    // Pre-transition hook (can throw to cancel)
    if (this.onBeforeTransition) {
      this.onBeforeTransition(previousState, newState, event);
    }

    // Perform transition
    this._state = newState;

    // Record in history
    this.history.push({
      from: previousState,
      to: newState,
      timestamp: new Date(),
      event
    });

    // Log if enabled
    if (this.logTransitions) {
      const context = this.instanceId ? `[${this.instanceId}] ` : '';
      console.log(`${context}State transition: ${previousState} → ${newState}${event ? ` (${event})` : ''}`);
    }

    // Post-transition hook
    if (this.onAfterTransition) {
      this.onAfterTransition(previousState, newState, event);
    }
  }

  /**
   * Try to transition, returning success status instead of throwing
   */
  tryTransition(newState: InstanceStatus, event?: TransitionEvent): boolean {
    try {
      this.transition(newState, event);
      return true;
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // CONVENIENCE METHODS
  // ==========================================================================

  /**
   * Start the instance (idle → running)
   */
  start(): void {
    this.transition('running', 'start');
  }

  /**
   * Pause the instance (running → idle)
   */
  pause(): void {
    this.transition('idle', 'pause');
  }

  /**
   * Begin synchronization (any active state → syncing)
   */
  beginSync(): void {
    this.transition('syncing', 'sync_begin');
  }

  /**
   * End synchronization (syncing → running or idle)
   * @param resumeActive If true, transitions to 'running', otherwise 'idle'
   */
  endSync(resumeActive: boolean = true): void {
    this.transition(resumeActive ? 'running' : 'idle', 'sync_end');
  }

  /**
   * Terminate the instance (any state → terminated)
   */
  terminate(): void {
    this.transition('terminated', 'terminate');
  }

  /**
   * Resume from idle (idle → running)
   */
  resume(): void {
    this.transition('running', 'resume');
  }

  // ==========================================================================
  // SERIALIZATION
  // ==========================================================================

  /**
   * Serialize state machine to JSON-compatible object
   */
  toJSON(): {
    state: InstanceStatus;
    instanceId?: string;
    history: Array<{
      from: InstanceStatus;
      to: InstanceStatus;
      timestamp: string;
      event?: TransitionEvent;
    }>;
  } {
    return {
      state: this._state,
      instanceId: this.instanceId,
      history: this.history.map(h => ({
        ...h,
        timestamp: h.timestamp.toISOString()
      }))
    };
  }

  /**
   * Create state machine from serialized state
   */
  static fromJSON(
    data: {
      state: InstanceStatus;
      instanceId?: string;
      history?: Array<{
        from: InstanceStatus;
        to: InstanceStatus;
        timestamp: string;
        event?: TransitionEvent;
      }>;
    },
    options?: Omit<StateMachineOptions, 'initialState' | 'instanceId'>
  ): InstanceStateMachine {
    const machine = new InstanceStateMachine({
      ...options,
      initialState: data.state,
      instanceId: data.instanceId
    });

    // Restore history
    if (data.history) {
      for (const h of data.history) {
        machine.history.push({
          ...h,
          timestamp: new Date(h.timestamp)
        });
      }
    }

    return machine;
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Validate a state transition without a state machine instance
 */
export function isValidTransition(
  from: InstanceStatus,
  to: InstanceStatus
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

/**
 * Get all valid transitions for a given state
 */
export function getValidTransitions(state: InstanceStatus): InstanceStatus[] {
  return [...VALID_TRANSITIONS[state]];
}

/**
 * Create a mermaid diagram of the state machine
 */
export function generateStateDiagram(): string {
  return `stateDiagram-v2
    [*] --> idle
    idle --> running: start/resume
    idle --> syncing: beginSync
    idle --> terminated: terminate
    
    running --> idle: pause
    running --> syncing: beginSync
    running --> terminated: terminate
    
    syncing --> idle: endSync(false)
    syncing --> running: endSync(true)
    syncing --> terminated: terminate
    
    terminated --> [*]
`;
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  VALID_TRANSITIONS,
  InstanceStatus
};

export default InstanceStateMachine;

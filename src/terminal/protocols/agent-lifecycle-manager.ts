/**
 * Agent Lifecycle Manager
 * 
 * Manages the wake/sleep lifecycle of agents on the canvas.
 * 
 * Lifecycle states:
 * - dormant: Agent spec stored but not running
 * - waking: Agent is being initialized (loading memories, creating bridge)
 * - awake: Agent is active and can participate in chat
 * - sleeping: Agent is being put to sleep (persisting memories, cleanup)
 * - error: Agent encountered an error during state transition
 * 
 * Wake process:
 * 1. Validate agent spec
 * 2. Load episodic memories from MemU
 * 3. Create and connect agent bridge
 * 4. Register with AgentRegistry
 * 5. Transition to awake state
 * 
 * Sleep process:
 * 1. Persist working memory to MemU
 * 2. Disconnect from chat sessions
 * 3. Unregister from AgentRegistry
 * 4. Cleanup bridge resources
 * 5. Transition to dormant state
 */

import { AgentState, CanvasAgent, AGENT_CANVAS_CONSTANTS } from './agent-canvas';
import { AgentCanvasManager } from './agent-canvas-manager';

// =============================================================================
// Types
// =============================================================================

/**
 * Lifecycle event types
 */
export type LifecycleEventType =
  | 'wake:started'
  | 'wake:memory-loading'
  | 'wake:bridge-creating'
  | 'wake:registering'
  | 'wake:completed'
  | 'wake:failed'
  | 'sleep:started'
  | 'sleep:memory-persisting'
  | 'sleep:unregistering'
  | 'sleep:cleanup'
  | 'sleep:completed'
  | 'sleep:failed'
  | 'error:recovered'
  | 'error:fatal';

/**
 * Lifecycle event data
 */
export interface LifecycleEvent {
  type: LifecycleEventType;
  agentId: string;
  previousState: AgentState;
  currentState: AgentState;
  progress?: number; // 0-100
  message?: string;
  error?: Error;
  timestamp: number;
}

/**
 * Listener for lifecycle events
 */
export type LifecycleEventListener = (event: LifecycleEvent) => void;

/**
 * Wake options for customizing the wake process
 */
export interface WakeOptions {
  /** Skip loading memories from MemU */
  skipMemoryLoad?: boolean;
  /** Skip registering with AgentRegistry */
  skipRegistry?: boolean;
  /** Custom initial context to inject */
  initialContext?: Record<string, unknown>;
  /** Timeout for wake process in ms */
  timeout?: number;
  /** Specific chat session to join */
  joinChatSession?: string;
}

/**
 * Sleep options for customizing the sleep process
 */
export interface SleepOptions {
  /** Skip persisting memories to MemU */
  skipMemoryPersist?: boolean;
  /** Force sleep even if in error state */
  force?: boolean;
  /** Timeout for sleep process in ms */
  timeout?: number;
  /** Reason for sleep (for logging/debugging) */
  reason?: string;
}

/**
 * Memory context loaded during wake
 */
export interface AgentMemoryContext {
  episodicMemories: EpisodicMemory[];
  semanticKnowledge: SemanticEntry[];
  proceduralSkills: ProceduralSkill[];
  coreBeliefs: CoreBelief[];
  lastSessionTimestamp?: number;
}

/**
 * Episodic memory entry
 */
export interface EpisodicMemory {
  id: string;
  content: string;
  timestamp: number;
  importance: number;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

/**
 * Semantic knowledge entry
 */
export interface SemanticEntry {
  id: string;
  concept: string;
  content: string;
  confidence: number;
  source?: string;
}

/**
 * Procedural skill entry
 */
export interface ProceduralSkill {
  id: string;
  name: string;
  steps: string[];
  triggers: string[];
  successRate?: number;
}

/**
 * Core belief entry
 */
export interface CoreBelief {
  id: string;
  category: string;
  content: string;
  conviction: number;
  editable: boolean;
}

/**
 * Active agent runtime state
 */
export interface ActiveAgentRuntime {
  agentId: string;
  bridgeId: string;
  registryId: string;
  memoryContext: AgentMemoryContext;
  activeChatSessions: Set<string>;
  wakeTime: number;
  messageCount: number;
  lastActivity: number;
}

/**
 * Configuration for lifecycle manager
 */
export interface LifecycleManagerConfig {
  /** Default timeout for wake process (ms) */
  defaultWakeTimeout: number;
  /** Default timeout for sleep process (ms) */
  defaultSleepTimeout: number;
  /** Maximum concurrent awake agents */
  maxAwakeAgents: number;
  /** Auto-sleep after inactivity (ms, 0 to disable) */
  autoSleepTimeout: number;
  /** Retry failed wakes */
  retryFailedWakes: boolean;
  /** Maximum retry attempts */
  maxRetryAttempts: number;
}

const DEFAULT_CONFIG: LifecycleManagerConfig = {
  defaultWakeTimeout: 30000,
  defaultSleepTimeout: 15000,
  maxAwakeAgents: 10,
  autoSleepTimeout: 0, // Disabled by default
  retryFailedWakes: true,
  maxRetryAttempts: 3
};

// =============================================================================
// Memory Adapter Interface
// =============================================================================

/**
 * Interface for MemU memory adapter
 */
export interface IMemoryAdapter {
  /**
   * Load memories for an agent
   */
  loadMemories(agentId: string): Promise<AgentMemoryContext>;
  
  /**
   * Persist memories for an agent
   */
  persistMemories(agentId: string, context: AgentMemoryContext): Promise<void>;
  
  /**
   * Add episodic memory during runtime
   */
  addEpisodicMemory(agentId: string, memory: Omit<EpisodicMemory, 'id'>): Promise<EpisodicMemory>;
  
  /**
   * Update semantic knowledge
   */
  updateSemanticKnowledge(agentId: string, entry: SemanticEntry): Promise<void>;
  
  /**
   * Clear all memories (dangerous!)
   */
  clearMemories(agentId: string): Promise<void>;
}

// =============================================================================
// Bridge Factory Interface
// =============================================================================

/**
 * Interface for creating agent bridges
 */
export interface IAgentBridgeFactory {
  /**
   * Create a bridge for an agent
   */
  createBridge(agent: CanvasAgent): Promise<{ bridgeId: string }>;
  
  /**
   * Destroy a bridge
   */
  destroyBridge(bridgeId: string): Promise<void>;
  
  /**
   * Send message through bridge
   */
  sendMessage(bridgeId: string, message: string, context?: Record<string, unknown>): Promise<string>;
}

// =============================================================================
// Registry Interface
// =============================================================================

/**
 * Interface for agent registry
 */
export interface IAgentRegistryAdapter {
  /**
   * Register an awakened agent
   */
  register(agent: CanvasAgent, bridgeId: string): Promise<string>;
  
  /**
   * Unregister an agent
   */
  unregister(registryId: string): Promise<void>;
  
  /**
   * Check if agent is registered
   */
  isRegistered(agentId: string): boolean;
}

// =============================================================================
// Default Implementations (Stubs)
// =============================================================================

/**
 * Default memory adapter (in-memory, non-persistent)
 */
class DefaultMemoryAdapter implements IMemoryAdapter {
  private memories: Map<string, AgentMemoryContext> = new Map();

  async loadMemories(agentId: string): Promise<AgentMemoryContext> {
    const existing = this.memories.get(agentId);
    if (existing) {
      return existing;
    }
    
    // Return empty context
    return {
      episodicMemories: [],
      semanticKnowledge: [],
      proceduralSkills: [],
      coreBeliefs: []
    };
  }

  async persistMemories(agentId: string, context: AgentMemoryContext): Promise<void> {
    this.memories.set(agentId, {
      ...context,
      lastSessionTimestamp: Date.now()
    });
  }

  async addEpisodicMemory(agentId: string, memory: Omit<EpisodicMemory, 'id'>): Promise<EpisodicMemory> {
    const context = await this.loadMemories(agentId);
    const newMemory: EpisodicMemory = {
      ...memory,
      id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    context.episodicMemories.push(newMemory);
    await this.persistMemories(agentId, context);
    return newMemory;
  }

  async updateSemanticKnowledge(agentId: string, entry: SemanticEntry): Promise<void> {
    const context = await this.loadMemories(agentId);
    const existingIndex = context.semanticKnowledge.findIndex(e => e.id === entry.id);
    if (existingIndex >= 0) {
      context.semanticKnowledge[existingIndex] = entry;
    } else {
      context.semanticKnowledge.push(entry);
    }
    await this.persistMemories(agentId, context);
  }

  async clearMemories(agentId: string): Promise<void> {
    this.memories.delete(agentId);
  }
}

/**
 * Default bridge factory (stub implementation)
 */
class DefaultBridgeFactory implements IAgentBridgeFactory {
  private bridges: Map<string, CanvasAgent> = new Map();

  async createBridge(agent: CanvasAgent): Promise<{ bridgeId: string }> {
    const bridgeId = `bridge-${agent.id}-${Date.now()}`;
    this.bridges.set(bridgeId, agent);
    return { bridgeId };
  }

  async destroyBridge(bridgeId: string): Promise<void> {
    this.bridges.delete(bridgeId);
  }

  async sendMessage(bridgeId: string, message: string, context?: Record<string, unknown>): Promise<string> {
    const agent = this.bridges.get(bridgeId);
    if (!agent) {
      throw new Error(`Bridge ${bridgeId} not found`);
    }
    // Stub response
    return `[${agent.name}] Received: ${message}`;
  }
}

/**
 * Default registry adapter (stub implementation)
 */
class DefaultRegistryAdapter implements IAgentRegistryAdapter {
  private registered: Map<string, string> = new Map(); // agentId -> registryId

  async register(agent: CanvasAgent, bridgeId: string): Promise<string> {
    const registryId = `reg-${agent.id}-${Date.now()}`;
    this.registered.set(agent.id, registryId);
    return registryId;
  }

  async unregister(registryId: string): Promise<void> {
    for (const [agentId, regId] of this.registered) {
      if (regId === registryId) {
        this.registered.delete(agentId);
        break;
      }
    }
  }

  isRegistered(agentId: string): boolean {
    return this.registered.has(agentId);
  }
}

// =============================================================================
// Agent Lifecycle Manager Class
// =============================================================================

/**
 * AgentLifecycleManager handles wake/sleep state transitions
 */
export class AgentLifecycleManager {
  private config: LifecycleManagerConfig;
  private canvasManager: AgentCanvasManager;
  private memoryAdapter: IMemoryAdapter;
  private bridgeFactory: IAgentBridgeFactory;
  private registryAdapter: IAgentRegistryAdapter;
  private activeRuntimes: Map<string, ActiveAgentRuntime> = new Map();
  private listeners: Map<string, Set<LifecycleEventListener>> = new Map();
  private wakeQueue: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();
  private sleepQueue: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();
  private autoSleepTimers: Map<string, NodeJS.Timeout> = new Map();
  private retryAttempts: Map<string, number> = new Map();
  
  // CONCURRENCY SAFETY: Locks to prevent race conditions during state transitions
  /** In-progress wake operations - concurrent calls return same promise */
  private wakeLocks: Map<string, Promise<ActiveAgentRuntime>> = new Map();
  /** In-progress sleep operations - concurrent calls return same promise */
  private sleepLocks: Map<string, Promise<void>> = new Map();

  constructor(
    canvasManager: AgentCanvasManager,
    config: Partial<LifecycleManagerConfig> = {},
    adapters?: {
      memory?: IMemoryAdapter;
      bridge?: IAgentBridgeFactory;
      registry?: IAgentRegistryAdapter;
    }
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.canvasManager = canvasManager;
    this.memoryAdapter = adapters?.memory || new DefaultMemoryAdapter();
    this.bridgeFactory = adapters?.bridge || new DefaultBridgeFactory();
    this.registryAdapter = adapters?.registry || new DefaultRegistryAdapter();
  }

  // ===========================================================================
  // Wake Operations
  // ===========================================================================

  /**
   * Wake an agent from dormant state
   * Uses locking to prevent race conditions from concurrent wake calls
   */
  async wake(agentId: string, options: WakeOptions = {}): Promise<ActiveAgentRuntime> {
    // CONCURRENCY SAFETY: Check for in-progress wake operation
    const existingWakeLock = this.wakeLocks.get(agentId);
    if (existingWakeLock) {
      // Return the existing promise - concurrent callers get the same result
      return existingWakeLock;
    }

    // CONCURRENCY SAFETY: Wait for any in-progress sleep to complete first
    const existingSleepLock = this.sleepLocks.get(agentId);
    if (existingSleepLock) {
      await existingSleepLock;
    }

    const agent = this.canvasManager.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found on canvas`);
    }

    // Check if already awake
    if (agent.state === 'awake') {
      const runtime = this.activeRuntimes.get(agentId);
      if (runtime) {
        return runtime;
      }
    }

    // Check if already waking (redundant with lock, but defensive)
    if (agent.state === 'waking') {
      throw new Error(`Agent ${agentId} is already waking`);
    }

    // Check max awake agents
    if (this.activeRuntimes.size >= this.config.maxAwakeAgents) {
      throw new Error(`Maximum awake agents (${this.config.maxAwakeAgents}) reached`);
    }

    // Check if in error state
    if (agent.state === 'error') {
      const retries = this.retryAttempts.get(agentId) || 0;
      if (!this.config.retryFailedWakes || retries >= this.config.maxRetryAttempts) {
        throw new Error(`Agent ${agentId} is in error state and cannot wake`);
      }
      this.retryAttempts.set(agentId, retries + 1);
    }

    const timeout = options.timeout || this.config.defaultWakeTimeout;
    const previousState = agent.state;

    // Transition to waking
    this.canvasManager.updateAgentState(agentId, 'waking');
    this.emit({
      type: 'wake:started',
      agentId,
      previousState,
      currentState: 'waking',
      progress: 0,
      message: 'Starting wake process',
      timestamp: Date.now()
    });

    // CONCURRENCY SAFETY: Create locked wake operation
    const wakePromise = new Promise<ActiveAgentRuntime>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.wakeLocks.delete(agentId);
        this.handleWakeTimeout(agentId);
        reject(new Error(`Wake timeout for agent ${agentId}`));
      }, timeout);

      this.wakeQueue.set(agentId, { resolve, reject, timeout: timeoutHandle });

      // Execute wake process
      this.executeWake(agentId, options, previousState)
        .then(runtime => {
          clearTimeout(timeoutHandle);
          this.wakeQueue.delete(agentId);
          this.retryAttempts.delete(agentId);
          this.wakeLocks.delete(agentId);
          resolve(runtime);
        })
        .catch(error => {
          clearTimeout(timeoutHandle);
          this.wakeQueue.delete(agentId);
          this.wakeLocks.delete(agentId);
          reject(error);
        });
    });

    // Store lock before returning
    this.wakeLocks.set(agentId, wakePromise);
    return wakePromise;
  }

  /**
   * Execute the wake process
   */
  private async executeWake(
    agentId: string,
    options: WakeOptions,
    previousState: AgentState
  ): Promise<ActiveAgentRuntime> {
    const agent = this.canvasManager.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} disappeared during wake`);
    }

    let memoryContext: AgentMemoryContext = {
      episodicMemories: [],
      semanticKnowledge: [],
      proceduralSkills: [],
      coreBeliefs: []
    };

    let bridgeId: string = '';
    let registryId: string = '';

    try {
      // Step 1: Load memories
      if (!options.skipMemoryLoad) {
        this.emit({
          type: 'wake:memory-loading',
          agentId,
          previousState,
          currentState: 'waking',
          progress: 20,
          message: 'Loading memories from MemU',
          timestamp: Date.now()
        });

        memoryContext = await this.memoryAdapter.loadMemories(agentId);
        
        // Also load initial beliefs from spec if no existing memories
        if (memoryContext.coreBeliefs.length === 0) {
          memoryContext.coreBeliefs = this.extractCoreBeliefs(agent);
        }
      }

      // Step 2: Create bridge
      this.emit({
        type: 'wake:bridge-creating',
        agentId,
        previousState,
        currentState: 'waking',
        progress: 50,
        message: 'Creating agent bridge',
        timestamp: Date.now()
      });

      const bridgeResult = await this.bridgeFactory.createBridge(agent);
      bridgeId = bridgeResult.bridgeId;

      // Step 3: Register with registry
      if (!options.skipRegistry) {
        this.emit({
          type: 'wake:registering',
          agentId,
          previousState,
          currentState: 'waking',
          progress: 80,
          message: 'Registering with AgentRegistry',
          timestamp: Date.now()
        });

        registryId = await this.registryAdapter.register(agent, bridgeId);
      }

      // Create runtime
      const runtime: ActiveAgentRuntime = {
        agentId,
        bridgeId,
        registryId,
        memoryContext,
        activeChatSessions: new Set(options.joinChatSession ? [options.joinChatSession] : []),
        wakeTime: Date.now(),
        messageCount: 0,
        lastActivity: Date.now()
      };

      // Store runtime
      this.activeRuntimes.set(agentId, runtime);

      // Update agent state to awake
      this.canvasManager.updateAgentState(agentId, 'awake');

      // Setup auto-sleep if configured
      if (this.config.autoSleepTimeout > 0) {
        this.resetAutoSleepTimer(agentId);
      }

      // Emit completion
      this.emit({
        type: 'wake:completed',
        agentId,
        previousState,
        currentState: 'awake',
        progress: 100,
        message: 'Agent is now awake',
        timestamp: Date.now()
      });

      return runtime;

    } catch (error) {
      // Cleanup on failure
      if (bridgeId) {
        await this.bridgeFactory.destroyBridge(bridgeId).catch(() => {});
      }
      if (registryId) {
        await this.registryAdapter.unregister(registryId).catch(() => {});
      }

      this.canvasManager.updateAgentState(
        agentId, 
        'error', 
        error instanceof Error ? error.message : String(error)
      );

      this.emit({
        type: 'wake:failed',
        agentId,
        previousState,
        currentState: 'error',
        message: 'Wake process failed',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: Date.now()
      });

      throw error;
    }
  }

  /**
   * Handle wake timeout
   */
  private handleWakeTimeout(agentId: string): void {
    this.canvasManager.updateAgentState(agentId, 'error', 'Wake process timed out');
    this.emit({
      type: 'wake:failed',
      agentId,
      previousState: 'waking',
      currentState: 'error',
      message: 'Wake process timed out',
      error: new Error('Wake timeout'),
      timestamp: Date.now()
    });
  }

  // ===========================================================================
  // Sleep Operations
  // ===========================================================================

  /**
   * Put an agent to sleep
   * Uses locking to prevent race conditions from concurrent sleep calls
   */
  async sleep(agentId: string, options: SleepOptions = {}): Promise<void> {
    // CONCURRENCY SAFETY: Check for in-progress sleep operation
    const existingSleepLock = this.sleepLocks.get(agentId);
    if (existingSleepLock) {
      // Return the existing promise - concurrent callers get the same result
      return existingSleepLock;
    }

    // CONCURRENCY SAFETY: Wait for any in-progress wake to complete first
    const existingWakeLock = this.wakeLocks.get(agentId);
    if (existingWakeLock) {
      await existingWakeLock;
    }

    const agent = this.canvasManager.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found on canvas`);
    }

    const runtime = this.activeRuntimes.get(agentId);

    // Check if already dormant
    if (agent.state === 'dormant') {
      return;
    }

    // Check if already sleeping (redundant with lock, but defensive)
    if (agent.state === 'sleeping') {
      throw new Error(`Agent ${agentId} is already sleeping`);
    }

    // Check if in error state
    if (agent.state === 'error' && !options.force) {
      throw new Error(`Agent ${agentId} is in error state. Use force option to sleep.`);
    }

    const timeout = options.timeout || this.config.defaultSleepTimeout;
    const previousState = agent.state;

    // Clear auto-sleep timer
    this.clearAutoSleepTimer(agentId);

    // Transition to sleeping
    this.canvasManager.updateAgentState(agentId, 'sleeping');
    this.emit({
      type: 'sleep:started',
      agentId,
      previousState,
      currentState: 'sleeping',
      progress: 0,
      message: options.reason || 'Starting sleep process',
      timestamp: Date.now()
    });

    // CONCURRENCY SAFETY: Create locked sleep operation
    const sleepPromise = new Promise<void>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.sleepLocks.delete(agentId);
        this.handleSleepTimeout(agentId);
        reject(new Error(`Sleep timeout for agent ${agentId}`));
      }, timeout);

      this.sleepQueue.set(agentId, { resolve, reject, timeout: timeoutHandle });

      // Execute sleep process
      this.executeSleep(agentId, runtime, options, previousState)
        .then(() => {
          clearTimeout(timeoutHandle);
          this.sleepQueue.delete(agentId);
          this.sleepLocks.delete(agentId);
          resolve();
        })
        .catch(error => {
          clearTimeout(timeoutHandle);
          this.sleepQueue.delete(agentId);
          this.sleepLocks.delete(agentId);
          reject(error);
        });
    });

    // Store lock before returning
    this.sleepLocks.set(agentId, sleepPromise);
    return sleepPromise;
  }

  /**
   * Execute the sleep process
   */
  private async executeSleep(
    agentId: string,
    runtime: ActiveAgentRuntime | undefined,
    options: SleepOptions,
    previousState: AgentState
  ): Promise<void> {
    try {
      // Step 1: Persist memories
      if (!options.skipMemoryPersist && runtime) {
        this.emit({
          type: 'sleep:memory-persisting',
          agentId,
          previousState,
          currentState: 'sleeping',
          progress: 30,
          message: 'Persisting memories to MemU',
          timestamp: Date.now()
        });

        await this.memoryAdapter.persistMemories(agentId, runtime.memoryContext);
      }

      // Step 2: Unregister from registry
      if (runtime?.registryId) {
        this.emit({
          type: 'sleep:unregistering',
          agentId,
          previousState,
          currentState: 'sleeping',
          progress: 60,
          message: 'Unregistering from AgentRegistry',
          timestamp: Date.now()
        });

        await this.registryAdapter.unregister(runtime.registryId);
      }

      // Step 3: Destroy bridge
      if (runtime?.bridgeId) {
        this.emit({
          type: 'sleep:cleanup',
          agentId,
          previousState,
          currentState: 'sleeping',
          progress: 80,
          message: 'Cleaning up agent bridge',
          timestamp: Date.now()
        });

        await this.bridgeFactory.destroyBridge(runtime.bridgeId);
      }

      // Remove runtime
      this.activeRuntimes.delete(agentId);

      // Update agent state to dormant
      this.canvasManager.updateAgentState(agentId, 'dormant');

      // Emit completion
      this.emit({
        type: 'sleep:completed',
        agentId,
        previousState,
        currentState: 'dormant',
        progress: 100,
        message: 'Agent is now dormant',
        timestamp: Date.now()
      });

    } catch (error) {
      // Force cleanup on error
      this.activeRuntimes.delete(agentId);
      
      if (options.force) {
        this.canvasManager.updateAgentState(agentId, 'dormant');
        this.emit({
          type: 'sleep:completed',
          agentId,
          previousState,
          currentState: 'dormant',
          progress: 100,
          message: 'Agent forcefully put to sleep',
          timestamp: Date.now()
        });
      } else {
        this.canvasManager.updateAgentState(
          agentId, 
          'error', 
          error instanceof Error ? error.message : String(error)
        );

        this.emit({
          type: 'sleep:failed',
          agentId,
          previousState,
          currentState: 'error',
          message: 'Sleep process failed',
          error: error instanceof Error ? error : new Error(String(error)),
          timestamp: Date.now()
        });

        throw error;
      }
    }
  }

  /**
   * Handle sleep timeout
   */
  private handleSleepTimeout(agentId: string): void {
    // Force cleanup on timeout
    this.activeRuntimes.delete(agentId);
    this.canvasManager.updateAgentState(agentId, 'dormant');
    this.emit({
      type: 'sleep:completed',
      agentId,
      previousState: 'sleeping',
      currentState: 'dormant',
      message: 'Sleep process timed out, forced to dormant',
      timestamp: Date.now()
    });
  }

  // ===========================================================================
  // Runtime Operations
  // ===========================================================================

  /**
   * Get runtime for an agent
   */
  getRuntime(agentId: string): ActiveAgentRuntime | undefined {
    return this.activeRuntimes.get(agentId);
  }

  /**
   * Get all active runtimes
   */
  getAllRuntimes(): ActiveAgentRuntime[] {
    return Array.from(this.activeRuntimes.values());
  }

  /**
   * Get awake agent count
   */
  getAwakeCount(): number {
    return this.activeRuntimes.size;
  }

  /**
   * Check if agent is awake
   */
  isAwake(agentId: string): boolean {
    return this.activeRuntimes.has(agentId);
  }

  /**
   * Send message to awake agent
   */
  async sendMessage(agentId: string, message: string, context?: Record<string, unknown>): Promise<string> {
    const runtime = this.activeRuntimes.get(agentId);
    if (!runtime) {
      throw new Error(`Agent ${agentId} is not awake`);
    }

    // Update activity
    runtime.lastActivity = Date.now();
    runtime.messageCount++;

    // Reset auto-sleep timer
    if (this.config.autoSleepTimeout > 0) {
      this.resetAutoSleepTimer(agentId);
    }

    // Send via bridge
    return this.bridgeFactory.sendMessage(runtime.bridgeId, message, context);
  }

  /**
   * Add episodic memory to awake agent
   */
  async addMemory(agentId: string, content: string, importance: number = 0.5): Promise<void> {
    const runtime = this.activeRuntimes.get(agentId);
    if (!runtime) {
      throw new Error(`Agent ${agentId} is not awake`);
    }

    const memory = await this.memoryAdapter.addEpisodicMemory(agentId, {
      content,
      timestamp: Date.now(),
      importance
    });

    runtime.memoryContext.episodicMemories.push(memory);
  }

  /**
   * Join chat session
   */
  joinChatSession(agentId: string, sessionId: string): void {
    const runtime = this.activeRuntimes.get(agentId);
    if (!runtime) {
      throw new Error(`Agent ${agentId} is not awake`);
    }
    runtime.activeChatSessions.add(sessionId);
  }

  /**
   * Leave chat session
   */
  leaveChatSession(agentId: string, sessionId: string): void {
    const runtime = this.activeRuntimes.get(agentId);
    if (runtime) {
      runtime.activeChatSessions.delete(sessionId);
    }
  }

  // ===========================================================================
  // Auto-Sleep Management
  // ===========================================================================

  /**
   * Reset auto-sleep timer for an agent
   */
  private resetAutoSleepTimer(agentId: string): void {
    this.clearAutoSleepTimer(agentId);
    
    if (this.config.autoSleepTimeout <= 0) {
      return;
    }

    const timer = setTimeout(() => {
      this.sleep(agentId, { reason: 'Auto-sleep due to inactivity' }).catch(error => {
        console.error(`Auto-sleep failed for agent ${agentId}:`, error);
      });
    }, this.config.autoSleepTimeout);

    this.autoSleepTimers.set(agentId, timer);
  }

  /**
   * Clear auto-sleep timer
   */
  private clearAutoSleepTimer(agentId: string): void {
    const timer = this.autoSleepTimers.get(agentId);
    if (timer) {
      clearTimeout(timer);
      this.autoSleepTimers.delete(agentId);
    }
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Extract core beliefs from agent spec
   */
  private extractCoreBeliefs(agent: CanvasAgent): CoreBelief[] {
    const beliefs: CoreBelief[] = [];
    const spec = agent.spec;

    // Extract from identity
    if (spec.identity?.backstory) {
      beliefs.push({
        id: `belief-backstory-${agent.id}`,
        category: 'identity',
        content: spec.identity.backstory,
        conviction: 1.0,
        editable: false
      });
    }

    // Extract from capabilities.memory.core.blocks
    const memoryConfig = spec.capabilities?.memory;
    if (memoryConfig && typeof memoryConfig === 'object') {
      const core = (memoryConfig as any).core;
      if (core?.blocks && Array.isArray(core.blocks)) {
        for (const block of core.blocks) {
          if (block.content) {
            beliefs.push({
              id: `belief-${block.name}-${agent.id}`,
              category: block.name || 'core',
              content: block.content,
              conviction: 1.0,
              editable: block.editable ?? false
            });
          }
        }
      }
    }

    // Extract from _import_metadata if from Replicant
    const importMeta = spec._import_metadata;
    if (importMeta?.source_format === 'replicant') {
      const original = importMeta.original_spec as any;
      if (original?.beliefs) {
        for (const [category, items] of Object.entries(original.beliefs)) {
          if (Array.isArray(items)) {
            for (const item of items) {
              if (typeof item === 'object' && item.content) {
                beliefs.push({
                  id: `belief-${category}-${beliefs.length}`,
                  category,
                  content: item.content,
                  conviction: item.conviction || 0.7,
                  editable: true
                });
              }
            }
          }
        }
      }
    }

    return beliefs;
  }

  /**
   * Wake all agents on canvas
   */
  async wakeAll(options: WakeOptions = {}): Promise<Map<string, ActiveAgentRuntime | Error>> {
    const results = new Map<string, ActiveAgentRuntime | Error>();
    const agents = this.canvasManager.getAllAgents();

    for (const agent of agents) {
      if (agent.state === 'dormant') {
        try {
          const runtime = await this.wake(agent.id, options);
          results.set(agent.id, runtime);
        } catch (error) {
          results.set(agent.id, error instanceof Error ? error : new Error(String(error)));
        }
      }
    }

    return results;
  }

  /**
   * Sleep all awake agents
   */
  async sleepAll(options: SleepOptions = {}): Promise<Map<string, void | Error>> {
    const results = new Map<string, void | Error>();
    const runtimes = Array.from(this.activeRuntimes.values());

    for (const runtime of runtimes) {
      try {
        await this.sleep(runtime.agentId, options);
        results.set(runtime.agentId, undefined);
      } catch (error) {
        results.set(runtime.agentId, error instanceof Error ? error : new Error(String(error)));
      }
    }

    return results;
  }

  // ===========================================================================
  // Event System
  // ===========================================================================

  /**
   * Subscribe to lifecycle events
   */
  on(eventType: LifecycleEventType | '*', listener: LifecycleEventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);

    return () => {
      this.listeners.get(eventType)?.delete(listener);
    };
  }

  /**
   * Emit a lifecycle event
   */
  private emit(event: LifecycleEvent): void {
    this.listeners.get(event.type)?.forEach(listener => {
      try {
        listener(event);
      } catch (e) {
        console.error(`Error in lifecycle event listener:`, e);
      }
    });

    this.listeners.get('*')?.forEach(listener => {
      try {
        listener(event);
      } catch (e) {
        console.error(`Error in lifecycle wildcard listener:`, e);
      }
    });
  }

  // ===========================================================================
  // Adapter Management
  // ===========================================================================

  /**
   * Set memory adapter
   */
  setMemoryAdapter(adapter: IMemoryAdapter): void {
    this.memoryAdapter = adapter;
  }

  /**
   * Set bridge factory
   */
  setBridgeFactory(factory: IAgentBridgeFactory): void {
    this.bridgeFactory = factory;
  }

  /**
   * Set registry adapter
   */
  setRegistryAdapter(adapter: IAgentRegistryAdapter): void {
    this.registryAdapter = adapter;
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Destroy the lifecycle manager
   */
  async destroy(): Promise<void> {
    // Sleep all agents
    await this.sleepAll({ force: true });

    // Clear all timers
    for (const timer of this.autoSleepTimers.values()) {
      clearTimeout(timer);
    }
    this.autoSleepTimers.clear();

    // Clear queues
    for (const { timeout, reject } of this.wakeQueue.values()) {
      clearTimeout(timeout);
      reject(new Error('Lifecycle manager destroyed'));
    }
    this.wakeQueue.clear();

    for (const { timeout, reject } of this.sleepQueue.values()) {
      clearTimeout(timeout);
      reject(new Error('Lifecycle manager destroyed'));
    }
    this.sleepQueue.clear();

    // Clear listeners
    this.listeners.clear();
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an agent lifecycle manager
 */
export function createAgentLifecycleManager(
  canvasManager: AgentCanvasManager,
  config?: Partial<LifecycleManagerConfig>,
  adapters?: {
    memory?: IMemoryAdapter;
    bridge?: IAgentBridgeFactory;
    registry?: IAgentRegistryAdapter;
  }
): AgentLifecycleManager {
  return new AgentLifecycleManager(canvasManager, config, adapters);
}
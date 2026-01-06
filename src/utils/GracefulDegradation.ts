/**
 * Graceful Degradation System
 * 
 * Provides resilient operation handling when services are unavailable:
 * - Queue operations for deferred execution
 * - Notify users of degraded mode
 * - Signal capability availability
 * - Replay queued operations on recovery
 * 
 * @module GracefulDegradation
 * @version 1.0.0
 * @status Implemented
 * 
 * HIGH-005: Graceful degradation now formally implemented.
 * 
 * User Value: Elder users see friendly messages instead of errors,
 * and operations automatically complete when service recovers.
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Service capability identifiers
 */
export type ServiceCapability = 
  | 'embedding'          // Semantic embedding generation
  | 'llm'               // LLM inference
  | 'memory_store'      // Memory persistence
  | 'memory_retrieve'   // Memory retrieval
  | 'sync'              // Distributed sync
  | 'mcp'               // MCP server communication
  | 'knowledge_graph'   // Knowledge graph operations
  | 'hedera';           // Blockchain operations

/**
 * Service availability status
 */
export type ServiceStatus = 
  | 'available'         // Fully operational
  | 'degraded'          // Working with reduced functionality
  | 'unavailable'       // Not operational
  | 'recovering';       // Attempting to recover

/**
 * Deferred operation for queue
 */
export interface DeferredOperation<T = unknown> {
  /** Unique operation ID */
  id: string;
  
  /** Required capability */
  capability: ServiceCapability;
  
  /** Operation to execute when service recovers */
  operation: () => Promise<T>;
  
  /** User-friendly description */
  description: string;
  
  /** When operation was queued */
  queuedAt: Date;
  
  /** Number of retry attempts */
  retryCount: number;
  
  /** Maximum retries allowed */
  maxRetries: number;
  
  /** Priority (higher = more important) */
  priority: number;
  
  /** Callback when operation completes */
  onComplete?: (result: T) => void;
  
  /** Callback when operation fails permanently */
  onFail?: (error: Error) => void;
}

/**
 * Capability status with metadata
 */
export interface CapabilityStatus {
  capability: ServiceCapability;
  status: ServiceStatus;
  lastChecked: Date;
  lastAvailable?: Date;
  errorMessage?: string;
  queuedOperations: number;
}

/**
 * Degradation event for notifications
 */
export interface DegradationEvent {
  type: 'degraded' | 'recovered' | 'unavailable' | 'operation_queued' | 'operation_completed' | 'operation_failed';
  capability: ServiceCapability;
  message: string;
  timestamp: Date;
  userFriendlyMessage: string;
}

/**
 * Listener for degradation events
 */
export type DegradationListener = (event: DegradationEvent) => void;

// =============================================================================
// USER-FRIENDLY MESSAGES
// =============================================================================

/**
 * Elder-friendly messages for degraded services
 */
const USER_FRIENDLY_MESSAGES: Record<ServiceCapability, {
  degraded: string;
  unavailable: string;
  recovered: string;
}> = {
  embedding: {
    degraded: "Memory search may be slower than usual. Your request is being processed.",
    unavailable: "Memory search is temporarily unavailable. We'll save your request and try again shortly.",
    recovered: "Memory search is working again! Processing your saved requests."
  },
  llm: {
    degraded: "AI responses may take longer than usual. Thank you for your patience.",
    unavailable: "AI assistance is temporarily unavailable. We've saved your question and will answer it soon.",
    recovered: "AI assistance is back online! Answering your saved questions now."
  },
  memory_store: {
    degraded: "Saving memories may be slower. Your content is being preserved.",
    unavailable: "Memory saving is temporarily unavailable. Don't worry - we're keeping your content safe locally.",
    recovered: "Memory saving is working again! Your local content is being synchronized."
  },
  memory_retrieve: {
    degraded: "Retrieving memories may be slower than usual.",
    unavailable: "Memory retrieval is temporarily unavailable. Please try again in a moment.",
    recovered: "Memory retrieval is working again!"
  },
  sync: {
    degraded: "Synchronization with other devices is slower than usual.",
    unavailable: "Device synchronization is temporarily paused. Your data is safe and will sync when connection improves.",
    recovered: "Device synchronization has resumed! Your data is being updated."
  },
  mcp: {
    degraded: "Some features may be limited while we restore full functionality.",
    unavailable: "Some features are temporarily unavailable. Core functions still work.",
    recovered: "All features have been restored!"
  },
  knowledge_graph: {
    degraded: "Knowledge connections may not be as comprehensive right now.",
    unavailable: "Knowledge linking is temporarily offline. Your content is still being saved.",
    recovered: "Knowledge linking is back online!"
  },
  hedera: {
    degraded: "Blockchain verification may be delayed.",
    unavailable: "Blockchain services are temporarily unavailable. Local operations continue normally.",
    recovered: "Blockchain services have been restored!"
  }
};

// =============================================================================
// GRACEFUL DEGRADATION MANAGER
// =============================================================================

/**
 * Manages graceful degradation across services
 */
export class GracefulDegradationManager {
  private capabilities: Map<ServiceCapability, CapabilityStatus> = new Map();
  private operationQueue: Map<string, DeferredOperation> = new Map();
  private listeners: Set<DegradationListener> = new Set();
  private recoveryIntervalId?: ReturnType<typeof setInterval>;
  private idCounter = 0;
  
  constructor(
    private options: {
      /** How often to check for recovery (ms) */
      recoveryCheckInterval?: number;
      /** Maximum queue size per capability */
      maxQueueSize?: number;
      /** Default max retries for operations */
      defaultMaxRetries?: number;
    } = {}
  ) {
    // Initialize all capabilities as available
    const allCapabilities: ServiceCapability[] = [
      'embedding', 'llm', 'memory_store', 'memory_retrieve',
      'sync', 'mcp', 'knowledge_graph', 'hedera'
    ];
    
    for (const cap of allCapabilities) {
      this.capabilities.set(cap, {
        capability: cap,
        status: 'available',
        lastChecked: new Date(),
        lastAvailable: new Date(),
        queuedOperations: 0
      });
    }
    
    // Start recovery check loop
    this.startRecoveryLoop();
  }
  
  // ===========================================================================
  // PUBLIC API
  // ===========================================================================
  
  /**
   * Check if a capability is available
   */
  isAvailable(capability: ServiceCapability): boolean {
    const status = this.capabilities.get(capability);
    return status?.status === 'available';
  }
  
  /**
   * Check if a capability is at least partially functional
   */
  isOperational(capability: ServiceCapability): boolean {
    const status = this.capabilities.get(capability);
    return status?.status === 'available' || status?.status === 'degraded';
  }
  
  /**
   * Get current status of a capability
   */
  getStatus(capability: ServiceCapability): CapabilityStatus | undefined {
    return this.capabilities.get(capability);
  }
  
  /**
   * Get all capability statuses
   */
  getAllStatuses(): CapabilityStatus[] {
    return Array.from(this.capabilities.values());
  }
  
  /**
   * Mark a capability as degraded or unavailable
   */
  markDegraded(
    capability: ServiceCapability,
    status: 'degraded' | 'unavailable',
    errorMessage?: string
  ): void {
    const current = this.capabilities.get(capability);
    if (!current) return;
    
    const wasAvailable = current.status === 'available';
    
    current.status = status;
    current.lastChecked = new Date();
    current.errorMessage = errorMessage;
    
    // Only emit event if status actually changed
    if (wasAvailable || current.status !== status) {
      this.emitEvent({
        type: status,
        capability,
        message: `${capability} is now ${status}`,
        timestamp: new Date(),
        userFriendlyMessage: USER_FRIENDLY_MESSAGES[capability][status]
      });
    }
  }
  
  /**
   * Mark a capability as recovered
   */
  markRecovered(capability: ServiceCapability): void {
    const current = this.capabilities.get(capability);
    if (!current) return;
    
    const wasUnavailable = current.status !== 'available';
    
    current.status = 'available';
    current.lastChecked = new Date();
    current.lastAvailable = new Date();
    current.errorMessage = undefined;
    
    if (wasUnavailable) {
      this.emitEvent({
        type: 'recovered',
        capability,
        message: `${capability} has recovered`,
        timestamp: new Date(),
        userFriendlyMessage: USER_FRIENDLY_MESSAGES[capability].recovered
      });
      
      // Process queued operations
      this.processQueuedOperations(capability);
    }
  }
  
  /**
   * Execute an operation with automatic degradation handling
   */
  async executeWithDegradation<T>(
    capability: ServiceCapability,
    operation: () => Promise<T>,
    options: {
      description: string;
      fallback?: () => T | Promise<T>;
      queueIfUnavailable?: boolean;
      priority?: number;
      maxRetries?: number;
      onComplete?: (result: T) => void;
      onFail?: (error: Error) => void;
    }
  ): Promise<T | undefined> {
    // Try operation if service is operational
    if (this.isOperational(capability)) {
      try {
        const result = await operation();
        this.markRecovered(capability);
        return result;
      } catch (error) {
        // Mark as degraded on error
        this.markDegraded(
          capability,
          'degraded',
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }
    
    // Try fallback if available
    if (options.fallback) {
      try {
        return await options.fallback();
      } catch {
        // Fallback failed too
      }
    }
    
    // Queue operation if requested
    if (options.queueIfUnavailable !== false) {
      this.queueOperation({
        capability,
        operation,
        description: options.description,
        priority: options.priority ?? 5,
        maxRetries: options.maxRetries ?? this.options.defaultMaxRetries ?? 3,
        onComplete: options.onComplete,
        onFail: options.onFail
      });
    }
    
    return undefined;
  }
  
  /**
   * Queue an operation for deferred execution
   */
  queueOperation<T>(config: {
    capability: ServiceCapability;
    operation: () => Promise<T>;
    description: string;
    priority?: number;
    maxRetries?: number;
    onComplete?: (result: T) => void;
    onFail?: (error: Error) => void;
  }): string {
    const maxQueueSize = this.options.maxQueueSize ?? 100;
    const capabilityQueue = this.getQueueForCapability(config.capability);
    
    if (capabilityQueue.length >= maxQueueSize) {
      // Remove lowest priority item
      const sorted = capabilityQueue.sort((a, b) => a.priority - b.priority);
      if (sorted.length > 0) {
        this.operationQueue.delete(sorted[0].id);
      }
    }
    
    const id = `op-${++this.idCounter}-${Date.now()}`;
    const op: DeferredOperation = {
      id,
      capability: config.capability,
      operation: config.operation as () => Promise<unknown>,
      description: config.description,
      queuedAt: new Date(),
      retryCount: 0,
      maxRetries: config.maxRetries ?? 3,
      priority: config.priority ?? 5,
      onComplete: config.onComplete as ((result: unknown) => void) | undefined,
      onFail: config.onFail
    };
    
    this.operationQueue.set(id, op);
    
    // Update capability queue count
    const status = this.capabilities.get(config.capability);
    if (status) {
      status.queuedOperations = this.getQueueForCapability(config.capability).length;
    }
    
    this.emitEvent({
      type: 'operation_queued',
      capability: config.capability,
      message: `Operation queued: ${config.description}`,
      timestamp: new Date(),
      userFriendlyMessage: `We've saved your request: "${config.description}". It will complete automatically when the service recovers.`
    });
    
    return id;
  }
  
  /**
   * Get pending operations count
   */
  getPendingOperationsCount(capability?: ServiceCapability): number {
    if (capability) {
      return this.getQueueForCapability(capability).length;
    }
    return this.operationQueue.size;
  }
  
  /**
   * Cancel a queued operation
   */
  cancelOperation(id: string): boolean {
    return this.operationQueue.delete(id);
  }
  
  /**
   * Add event listener
   */
  addListener(listener: DegradationListener): void {
    this.listeners.add(listener);
  }
  
  /**
   * Remove event listener
   */
  removeListener(listener: DegradationListener): void {
    this.listeners.delete(listener);
  }
  
  /**
   * Cleanup and stop recovery loop
   */
  dispose(): void {
    if (this.recoveryIntervalId) {
      clearInterval(this.recoveryIntervalId);
    }
    this.listeners.clear();
    this.operationQueue.clear();
  }
  
  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================
  
  private getQueueForCapability(capability: ServiceCapability): DeferredOperation[] {
    return Array.from(this.operationQueue.values())
      .filter(op => op.capability === capability);
  }
  
  private async processQueuedOperations(capability: ServiceCapability): Promise<void> {
    const queue = this.getQueueForCapability(capability)
      .sort((a, b) => b.priority - a.priority); // Higher priority first
    
    for (const op of queue) {
      try {
        const result = await op.operation();
        
        this.operationQueue.delete(op.id);
        
        this.emitEvent({
          type: 'operation_completed',
          capability,
          message: `Completed: ${op.description}`,
          timestamp: new Date(),
          userFriendlyMessage: `Completed: ${op.description}`
        });
        
        if (op.onComplete) {
          op.onComplete(result);
        }
      } catch (error) {
        op.retryCount++;
        
        if (op.retryCount >= op.maxRetries) {
          // Permanent failure
          this.operationQueue.delete(op.id);
          
          this.emitEvent({
            type: 'operation_failed',
            capability,
            message: `Failed after ${op.retryCount} attempts: ${op.description}`,
            timestamp: new Date(),
            userFriendlyMessage: `We couldn't complete "${op.description}" after several attempts. Please try again later.`
          });
          
          if (op.onFail) {
            op.onFail(error instanceof Error ? error : new Error('Unknown error'));
          }
        }
        // Leave in queue for retry if not at max
      }
    }
    
    // Update queue count
    const status = this.capabilities.get(capability);
    if (status) {
      status.queuedOperations = this.getQueueForCapability(capability).length;
    }
  }
  
  private startRecoveryLoop(): void {
    const interval = this.options.recoveryCheckInterval ?? 30000; // 30 seconds default
    
    this.recoveryIntervalId = setInterval(() => {
      // Check each recovering/unavailable capability
      for (const [capability, status] of this.capabilities) {
        if (status.status === 'recovering' || status.status === 'unavailable') {
          // Mark as recovering to indicate we're trying
          if (status.status === 'unavailable') {
            status.status = 'recovering';
          }
          
          // Attempt to process one operation to test recovery
          const queue = this.getQueueForCapability(capability);
          if (queue.length > 0) {
            this.processQueuedOperations(capability).catch(() => {
              // Still unavailable
              status.status = 'unavailable';
            });
          }
        }
      }
    }, interval);
  }
  
  private emitEvent(event: DegradationEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let defaultManager: GracefulDegradationManager | null = null;

/**
 * Get the default degradation manager instance
 */
export function getGracefulDegradationManager(): GracefulDegradationManager {
  if (!defaultManager) {
    defaultManager = new GracefulDegradationManager();
  }
  return defaultManager;
}

/**
 * Create a custom degradation manager
 */
export function createGracefulDegradationManager(
  options?: ConstructorParameters<typeof GracefulDegradationManager>[0]
): GracefulDegradationManager {
  return new GracefulDegradationManager(options);
}

// =============================================================================
// DECORATOR
// =============================================================================

/**
 * Decorator for methods that should use graceful degradation
 *
 * Note: Returns T | undefined when service is unavailable
 */
export function withDegradation(
  capability: ServiceCapability,
  description: string
) {
  return function <T>(
    _target: object,
    _propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: unknown[]) => Promise<T | undefined>>
  ) {
    const originalMethod = descriptor.value!;
    
    descriptor.value = async function(...args: unknown[]): Promise<T | undefined> {
      const manager = getGracefulDegradationManager();
      
      return manager.executeWithDegradation(
        capability,
        () => originalMethod.apply(this, args) as Promise<T>,
        { description }
      );
    };
    
    return descriptor;
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default GracefulDegradationManager;

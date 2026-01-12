/**
 * Chrysalis Universal Agent Bridge - Resource Lifecycle Management
 * 
 * Provides patterns for managing resource lifecycles including:
 * - Symbol.asyncDispose / Symbol.dispose support
 * - AbortController patterns for cancellation
 * - Resource pools and cleanup
 * - Graceful shutdown handling
 * 
 * @module bridge/lifecycle
 * @version 1.0.0
 */

import { ResourceError, type ErrorContext } from './errors';
import { type AsyncDisposable, type Disposable, type DisposableResource } from './types';

// ============================================================================
// Polyfills for Symbol.dispose/asyncDispose
// ============================================================================

// Ensure dispose symbols exist
if (typeof Symbol.dispose === 'undefined') {
  (Symbol as { dispose: symbol }).dispose = Symbol('Symbol.dispose');
}

if (typeof Symbol.asyncDispose === 'undefined') {
  (Symbol as { asyncDispose: symbol }).asyncDispose = Symbol('Symbol.asyncDispose');
}

// ============================================================================
// Disposable Implementation
// ============================================================================

/**
 * Mixin to add disposal tracking to any class
 */
export interface DisposalTracker {
  readonly disposed: boolean;
  ensureNotDisposed(): void;
}

/**
 * Create a disposal tracker
 */
export function createDisposalTracker(resourceType: string): DisposalTracker & { markDisposed(): void } {
  let disposed = false;
  
  return {
    get disposed() {
      return disposed;
    },
    
    ensureNotDisposed() {
      if (disposed) {
        throw ResourceError.disposed(resourceType, { component: resourceType });
      }
    },
    
    markDisposed() {
      disposed = true;
    },
  };
}

/**
 * Managed resource wrapper
 */
export class ManagedResource<T> implements DisposableResource<T> {
  private _disposed = false;
  private readonly _value: T;
  private readonly _disposer: (value: T) => void | Promise<void>;

  constructor(value: T, disposer: (value: T) => void | Promise<void>) {
    this._value = value;
    this._disposer = disposer;
  }

  get value(): T {
    if (this._disposed) {
      throw ResourceError.disposed('ManagedResource');
    }
    return this._value;
  }

  get disposed(): boolean {
    return this._disposed;
  }

  async [Symbol.asyncDispose](): Promise<void> {
    if (this._disposed) return;
    this._disposed = true;
    await this._disposer(this._value);
  }

  [Symbol.dispose](): void {
    if (this._disposed) return;
    this._disposed = true;
    const result = this._disposer(this._value);
    if (result instanceof Promise) {
      // Fire and forget for sync disposal of async resources
      result.catch(console.error);
    }
  }
}

/**
 * Create a managed resource
 */
export function managed<T>(
  value: T,
  disposer: (value: T) => void | Promise<void>
): ManagedResource<T> {
  return new ManagedResource(value, disposer);
}

// ============================================================================
// Disposable Collection
// ============================================================================

/**
 * Collection of disposables that are disposed together
 */
export class DisposableStack implements AsyncDisposable, Disposable {
  private readonly disposables: Array<{ dispose: () => void | Promise<void> }> = [];
  private _disposed = false;

  get disposed(): boolean {
    return this._disposed;
  }

  /**
   * Add a disposable to the stack
   */
  use<T extends { [Symbol.dispose]?: () => void; [Symbol.asyncDispose]?: () => Promise<void> }>(
    disposable: T
  ): T {
    if (this._disposed) {
      throw ResourceError.disposed('DisposableStack');
    }
    
    this.disposables.push({
      dispose: () => {
        if (Symbol.asyncDispose in disposable) {
          const asyncDispose = disposable[Symbol.asyncDispose];
          if (asyncDispose) {
            return asyncDispose.call(disposable);
          }
        }
        if (Symbol.dispose in disposable) {
          const syncDispose = disposable[Symbol.dispose];
          if (syncDispose) {
            syncDispose.call(disposable);
          }
        }
      },
    });
    
    return disposable;
  }

  /**
   * Add a callback to be called on dispose
   */
  defer(callback: () => void | Promise<void>): void {
    if (this._disposed) {
      throw ResourceError.disposed('DisposableStack');
    }
    this.disposables.push({ dispose: callback });
  }

  /**
   * Adopt a value with a custom disposer
   */
  adopt<T>(value: T, disposer: (value: T) => void | Promise<void>): T {
    this.defer(() => disposer(value));
    return value;
  }

  /**
   * Move disposables out of this stack
   */
  move(): DisposableStack {
    const newStack = new DisposableStack();
    newStack.disposables.push(...this.disposables);
    this.disposables.length = 0;
    return newStack;
  }

  async [Symbol.asyncDispose](): Promise<void> {
    if (this._disposed) return;
    this._disposed = true;
    
    // Dispose in reverse order (LIFO)
    const errors: Error[] = [];
    for (let i = this.disposables.length - 1; i >= 0; i--) {
      try {
        await this.disposables[i].dispose();
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }
    
    this.disposables.length = 0;
    
    if (errors.length > 0) {
      throw new AggregateError(errors, 'Multiple errors during disposal');
    }
  }

  [Symbol.dispose](): void {
    if (this._disposed) return;
    this._disposed = true;
    
    // Dispose in reverse order (LIFO)
    for (let i = this.disposables.length - 1; i >= 0; i--) {
      try {
        const result = this.disposables[i].dispose();
        if (result instanceof Promise) {
          result.catch(console.error);
        }
      } catch (error) {
        console.error('Error during disposal:', error);
      }
    }
    
    this.disposables.length = 0;
  }
}

// ============================================================================
// Abort Controller Extensions
// ============================================================================

/**
 * Options for abort-aware operations
 */
export interface AbortOptions {
  /** Abort signal */
  signal?: AbortSignal;
  /** Timeout in milliseconds */
  timeoutMs?: number;
  /** Error context for abort errors */
  errorContext?: ErrorContext;
}

/**
 * Create an abort controller with timeout
 */
export function createAbortController(timeoutMs?: number): {
  controller: AbortController;
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  
  if (timeoutMs !== undefined && timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      controller.abort(ResourceError.timeout('Operation', timeoutMs));
    }, timeoutMs);
  }
  
  return {
    controller,
    signal: controller.signal,
    cleanup: () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    },
  };
}

/**
 * Link multiple abort signals
 */
export function linkAbortSignals(...signals: (AbortSignal | undefined)[]): AbortSignal {
  const controller = new AbortController();
  
  for (const signal of signals) {
    if (!signal) continue;
    
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    
    signal.addEventListener('abort', () => {
      controller.abort(signal.reason);
    });
  }
  
  return controller.signal;
}

/**
 * Check if a signal is aborted and throw if so
 */
export function throwIfAborted(signal?: AbortSignal, message?: string): void {
  if (signal?.aborted) {
    throw ResourceError.aborted(
      message ?? (signal.reason instanceof Error ? signal.reason.message : String(signal.reason))
    );
  }
}

/**
 * Wait for abort or timeout
 */
export function waitForAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) {
      reject(ResourceError.aborted(signal.reason?.message));
      return;
    }
    
    signal.addEventListener('abort', () => {
      reject(ResourceError.aborted(signal.reason?.message));
    });
  });
}

/**
 * Race a promise against an abort signal
 */
export async function raceAbort<T>(
  promise: Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  if (!signal) return promise;
  
  return Promise.race([
    promise,
    waitForAbort(signal),
  ]);
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

/**
 * Shutdown handler interface
 */
export interface ShutdownHandler {
  /** Handler name for logging */
  name: string;
  /** Priority (lower = earlier) */
  priority?: number;
  /** Handler function */
  handler: () => void | Promise<void>;
}

/**
 * Graceful shutdown manager
 */
export class GracefulShutdown implements AsyncDisposable {
  private handlers: ShutdownHandler[] = [];
  private isShuttingDown = false;
  private shutdownPromise?: Promise<void>;
  private signalHandlers: Array<{ signal: string; handler: () => void }> = [];

  /**
   * Register a shutdown handler
   */
  register(handler: ShutdownHandler): () => void {
    if (this.isShuttingDown) {
      throw ResourceError.disposed('GracefulShutdown');
    }
    
    this.handlers.push(handler);
    this.handlers.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
    
    // Return unregister function
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index !== -1) {
        this.handlers.splice(index, 1);
      }
    };
  }

  /**
   * Listen for process signals
   */
  listenForSignals(signals: string[] = ['SIGTERM', 'SIGINT']): void {
    for (const signal of signals) {
      const handler = () => {
        console.log(`Received ${signal}, initiating graceful shutdown...`);
        this.shutdown().catch(console.error);
      };
      
      process.on(signal, handler);
      this.signalHandlers.push({ signal, handler });
    }
  }

  /**
   * Stop listening for signals
   */
  stopListeningForSignals(): void {
    for (const { signal, handler } of this.signalHandlers) {
      process.off(signal, handler);
    }
    this.signalHandlers = [];
  }

  /**
   * Initiate shutdown
   */
  async shutdown(): Promise<void> {
    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }
    
    this.isShuttingDown = true;
    
    this.shutdownPromise = (async () => {
      const errors: Error[] = [];
      
      for (const { name, handler } of this.handlers) {
        try {
          console.log(`Shutting down: ${name}`);
          await handler();
        } catch (error) {
          console.error(`Error shutting down ${name}:`, error);
          errors.push(error instanceof Error ? error : new Error(String(error)));
        }
      }
      
      this.handlers = [];
      this.stopListeningForSignals();
      
      if (errors.length > 0) {
        throw new AggregateError(errors, 'Errors during shutdown');
      }
    })();
    
    return this.shutdownPromise;
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.shutdown();
  }
}

/**
 * Global shutdown manager
 */
let globalShutdown: GracefulShutdown | null = null;

/**
 * Get or create the global shutdown manager
 */
export function getShutdownManager(): GracefulShutdown {
  if (!globalShutdown) {
    globalShutdown = new GracefulShutdown();
  }
  return globalShutdown;
}

/**
 * Register a shutdown handler globally
 */
export function onShutdown(
  name: string,
  handler: () => void | Promise<void>,
  priority?: number
): () => void {
  return getShutdownManager().register({ name, handler, priority });
}

// ============================================================================
// Resource Pool
// ============================================================================

/**
 * Resource pool options
 */
export interface PoolOptions<T> {
  /** Create a new resource */
  create: () => T | Promise<T>;
  /** Destroy a resource */
  destroy: (resource: T) => void | Promise<void>;
  /** Validate a resource before reuse */
  validate?: (resource: T) => boolean | Promise<boolean>;
  /** Minimum pool size */
  min?: number;
  /** Maximum pool size */
  max?: number;
  /** Idle timeout in ms */
  idleTimeoutMs?: number;
  /** Acquire timeout in ms */
  acquireTimeoutMs?: number;
}

/**
 * Pooled resource wrapper
 */
export interface PooledResource<T> extends AsyncDisposable {
  readonly value: T;
  release(): void;
}

/**
 * Simple resource pool
 */
export class ResourcePool<T> implements AsyncDisposable {
  private readonly options: Required<PoolOptions<T>>;
  private readonly available: Array<{ resource: T; lastUsed: number }> = [];
  private readonly inUse = new Set<T>();
  private disposed = false;
  private cleanupInterval?: ReturnType<typeof setInterval>;

  constructor(options: PoolOptions<T>) {
    this.options = {
      create: options.create,
      destroy: options.destroy,
      validate: options.validate ?? (() => true),
      min: options.min ?? 0,
      max: options.max ?? 10,
      idleTimeoutMs: options.idleTimeoutMs ?? 30000,
      acquireTimeoutMs: options.acquireTimeoutMs ?? 10000,
    };
    
    // Start idle cleanup
    this.startCleanup();
  }

  /**
   * Acquire a resource from the pool
   */
  async acquire(signal?: AbortSignal): Promise<PooledResource<T>> {
    throwIfAborted(signal);
    
    if (this.disposed) {
      throw ResourceError.disposed('ResourcePool');
    }
    
    // Try to get an available resource
    while (this.available.length > 0) {
      const item = this.available.pop()!;
      
      try {
        if (await this.options.validate(item.resource)) {
          this.inUse.add(item.resource);
          return this.wrapResource(item.resource);
        }
      } catch {
        // Resource validation failed, destroy it
      }
      
      await this.options.destroy(item.resource);
    }
    
    // Check if we can create a new one
    if (this.inUse.size >= this.options.max) {
      throw new Error('Pool exhausted');
    }
    
    // Create a new resource
    const resource = await this.options.create();
    this.inUse.add(resource);
    
    return this.wrapResource(resource);
  }

  /**
   * Release a resource back to the pool
   */
  release(resource: T): void {
    if (!this.inUse.has(resource)) return;
    
    this.inUse.delete(resource);
    
    if (this.disposed) {
      // Destroy if pool is disposed
      Promise.resolve(this.options.destroy(resource)).catch(console.error);
      return;
    }
    
    // Return to available pool
    this.available.push({
      resource,
      lastUsed: Date.now(),
    });
  }

  /**
   * Get pool statistics
   */
  get stats() {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      total: this.available.length + this.inUse.size,
      max: this.options.max,
    };
  }

  async [Symbol.asyncDispose](): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    
    // Stop cleanup
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Destroy all resources
    const allResources = [
      ...this.available.map(item => item.resource),
      ...this.inUse,
    ];
    
    await Promise.all(
      allResources.map(r => 
        Promise.resolve(this.options.destroy(r)).catch(console.error)
      )
    );
    
    this.available.length = 0;
    this.inUse.clear();
  }

  private wrapResource(resource: T): PooledResource<T> {
    let released = false;
    const pool = this;
    
    return {
      get value() {
        if (released) throw ResourceError.disposed('PooledResource');
        return resource;
      },
      
      release() {
        if (released) return;
        released = true;
        pool.release(resource);
      },
      
      async [Symbol.asyncDispose]() {
        this.release();
      },
    };
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const minSize = this.options.min;
      
      // Remove idle resources
      while (
        this.available.length > minSize &&
        this.available.length > 0
      ) {
        const oldest = this.available[0];
        if (now - oldest.lastUsed < this.options.idleTimeoutMs) {
          break;
        }
        
        this.available.shift();
        Promise.resolve(this.options.destroy(oldest.resource)).catch(console.error);
      }
    }, Math.min(this.options.idleTimeoutMs / 2, 5000));
  }
}

// ============================================================================
// Using Block Helper
// ============================================================================

/**
 * Run a function with automatic resource disposal
 */
export async function using<T, R>(
  resource: T & AsyncDisposable,
  fn: (resource: T) => R | Promise<R>
): Promise<R> {
  try {
    return await fn(resource);
  } finally {
    await resource[Symbol.asyncDispose]();
  }
}

/**
 * Run a function with multiple resources
 */
export async function usingAll<T extends AsyncDisposable[], R>(
  resources: [...T],
  fn: (...args: T) => R | Promise<R>
): Promise<R> {
  try {
    return await fn(...resources);
  } finally {
    // Dispose in reverse order
    for (let i = resources.length - 1; i >= 0; i--) {
      await resources[i][Symbol.asyncDispose]();
    }
  }
}


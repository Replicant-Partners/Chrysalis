/**
 * Chrysalis Universal Agent Bridge - Dependency Injection Container
 * 
 * Provides a lightweight dependency injection container to manage service
 * lifecycles and resolve circular dependencies between modules.
 * 
 * @module bridge/container
 * @version 1.0.0
 */

import { 
  BridgeError, 
  ErrorCode, 
  DependencyError,
  DisposedError,
  type ErrorContext 
} from './errors';

import {
  type CorrelationId,
  type AsyncDisposable,
  type Disposable,
  generateCorrelationId,
} from './types';
import { createLogger } from '../shared/logger';

// ============================================================================
// Container Types
// ============================================================================

/**
 * Service lifetime options
 */
export type ServiceLifetime = 'singleton' | 'transient' | 'scoped';

/**
 * Service factory function
 */
export type ServiceFactory<T> = (container: Container) => T | Promise<T>;

/**
 * Service registration descriptor
 */
export interface ServiceDescriptor<T = unknown> {
  /** Service identifier */
  id: symbol;
  /** Service lifetime */
  lifetime: ServiceLifetime;
  /** Factory function */
  factory: ServiceFactory<T>;
  /** Dependencies (for circular detection) */
  dependencies?: symbol[];
  /** Whether service is async */
  isAsync?: boolean;
  /** Optional initializer after construction */
  initializer?: (instance: T, container: Container) => void | Promise<void>;
  /** Optional disposal handler */
  disposer?: (instance: T) => void | Promise<void>;
}

/**
 * Service token for type-safe resolution
 */
export interface ServiceToken<T> {
  readonly id: symbol;
  readonly _type?: T; // Phantom type for TypeScript inference
}

/**
 * Create a service token
 */
export function createToken<T>(name: string): ServiceToken<T> {
  return {
    id: Symbol.for(`chrysalis.bridge.${name}`),
  };
}

// ============================================================================
// Built-in Service Tokens
// ============================================================================

/**
 * Well-known service tokens for the bridge
 */
export const ServiceTokens = {
  // Core services
  TemporalStore: createToken<ITemporalStore>('TemporalStore'),
  AdapterRegistry: createToken<IAdapterRegistry>('AdapterRegistry'),
  Orchestrator: createToken<IOrchestrator>('Orchestrator'),
  EventBus: createToken<IEventBus>('EventBus'),
  
  // Supporting services
  Logger: createToken<ILogger>('Logger'),
  ValidationService: createToken<IValidationService>('ValidationService'),
  PersistenceService: createToken<IPersistenceService>('PersistenceService'),
  DiscoveryService: createToken<IDiscoveryService>('DiscoveryService'),
  
  // Configuration
  Config: createToken<BridgeConfig>('Config'),
} as const;

// ============================================================================
// Service Interfaces (for DI contracts)
// ============================================================================

/**
 * Temporal store interface
 */
export interface ITemporalStore {
  addQuads(graphUri: string, quads: readonly unknown[]): Promise<void>;
  getQuads(graphUri: string): unknown[];
  createSnapshot(agentId: string, quads: readonly unknown[], options?: unknown): Promise<unknown>;
  getSnapshot(agentId: string, options?: unknown): Promise<unknown | null>;
}

/**
 * Adapter registry interface
 */
export interface IAdapterRegistry {
  register(adapter: unknown): void;
  get(framework: string): unknown | undefined;
  has(framework: string): boolean;
  list(): string[];
}

/**
 * Orchestrator interface
 */
export interface IOrchestrator {
  translate(request: unknown): Promise<unknown>;
  registerAgent(agent: unknown, options?: unknown): Promise<unknown>;
  getAgent(agentId: string, targetFramework?: string, options?: unknown): Promise<unknown | null>;
}

/**
 * Event bus interface
 */
export interface IEventBus {
  emit(event: unknown): void;
  on(type: string, handler: (event: unknown) => void): () => void;
  off(type: string, handler: (event: unknown) => void): void;
}

/**
 * Logger interface
 */
export interface ILogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
  child(context: Record<string, unknown>): ILogger;
}

/**
 * Validation service interface
 */
export interface IValidationService {
  validate(framework: string, data: unknown): { valid: boolean; errors: unknown[] };
}

/**
 * Persistence service interface
 */
export interface IPersistenceService {
  save(agentId: string, data: unknown): Promise<void>;
  load(agentId: string): Promise<unknown | null>;
  delete(agentId: string): Promise<boolean>;
  list(): Promise<string[]>;
}

/**
 * Discovery service interface
 */
export interface IDiscoveryService {
  discover(query?: unknown): Promise<unknown[]>;
  register(agent: unknown): Promise<void>;
  unregister(agentId: string): Promise<void>;
}

/**
 * Bridge configuration
 */
export interface BridgeConfig {
  maxCacheEntries: number;
  cacheEnabled: boolean;
  validationEnabled: boolean;
  provenanceEnabled: boolean;
  defaultTimeout: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

// ============================================================================
// Container Implementation
// ============================================================================

/**
 * Dependency injection container
 */
export class Container implements AsyncDisposable {
  private descriptors = new Map<symbol, ServiceDescriptor>();
  private singletons = new Map<symbol, unknown>();
  private scopedInstances = new Map<symbol, unknown>();
  private resolutionStack: symbol[] = [];
  private disposed = false;
  private parent?: Container;
  private disposables: Array<() => void | Promise<void>> = [];
  private log = createLogger('container');

  /**
   * Create a new container
   */
  constructor(parent?: Container) {
    this.parent = parent;
  }

  /**
   * Register a service
   */
  register<T>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T>,
    options: Partial<Omit<ServiceDescriptor<T>, 'id' | 'factory'>> = {}
  ): this {
    this.ensureNotDisposed();
    
    const descriptor: ServiceDescriptor<T> = {
      id: token.id,
      lifetime: options.lifetime ?? 'singleton',
      factory,
      dependencies: options.dependencies,
      isAsync: options.isAsync,
      initializer: options.initializer,
      disposer: options.disposer,
    };
    
    this.descriptors.set(token.id, descriptor as ServiceDescriptor);
    return this;
  }

  /**
   * Register a singleton instance directly
   */
  registerInstance<T>(token: ServiceToken<T>, instance: T): this {
    this.ensureNotDisposed();
    this.singletons.set(token.id, instance);
    return this;
  }

  /**
   * Register a factory (transient by default)
   */
  registerFactory<T>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T>
  ): this {
    return this.register(token, factory, { lifetime: 'transient' });
  }

  /**
   * Resolve a service synchronously
   */
  resolve<T>(token: ServiceToken<T>): T {
    this.ensureNotDisposed();
    
    // Check singleton cache first
    if (this.singletons.has(token.id)) {
      return this.singletons.get(token.id) as T;
    }
    
    // Check scoped cache
    if (this.scopedInstances.has(token.id)) {
      return this.scopedInstances.get(token.id) as T;
    }
    
    // Check parent
    if (this.parent && !this.descriptors.has(token.id)) {
      return this.parent.resolve(token);
    }
    
    // Get descriptor
    const descriptor = this.descriptors.get(token.id);
    if (!descriptor) {
      throw new DependencyError(
        Symbol.keyFor(token.id) ?? token.id.toString(),
        { component: 'Container' }
      );
    }
    
    // Check for async
    if (descriptor.isAsync) {
      throw new BridgeError(
        ErrorCode.DEPENDENCY_MISSING,
        `Service ${Symbol.keyFor(token.id)} is async, use resolveAsync() instead`,
        { component: 'Container' }
      );
    }
    
    // Detect circular dependency
    this.detectCircularDependency(token.id);
    
    // Create instance
    this.resolutionStack.push(token.id);
    try {
      const instance = descriptor.factory(this) as T;
      
      // Cache based on lifetime
      this.cacheInstance(descriptor, instance);
      
      // Run initializer
      if (descriptor.initializer) {
        descriptor.initializer(instance, this);
      }
      
      // Track disposable
      if (descriptor.disposer) {
        this.disposables.push(() => descriptor.disposer!(instance));
      }
      
      return instance;
    } finally {
      this.resolutionStack.pop();
    }
  }

  /**
   * Resolve a service asynchronously
   */
  async resolveAsync<T>(token: ServiceToken<T>): Promise<T> {
    this.ensureNotDisposed();
    
    // Check singleton cache first
    if (this.singletons.has(token.id)) {
      return this.singletons.get(token.id) as T;
    }
    
    // Check scoped cache
    if (this.scopedInstances.has(token.id)) {
      return this.scopedInstances.get(token.id) as T;
    }
    
    // Check parent
    if (this.parent && !this.descriptors.has(token.id)) {
      return this.parent.resolveAsync(token);
    }
    
    // Get descriptor
    const descriptor = this.descriptors.get(token.id);
    if (!descriptor) {
      throw new DependencyError(
        Symbol.keyFor(token.id) ?? token.id.toString(),
        { component: 'Container' }
      );
    }
    
    // Detect circular dependency
    this.detectCircularDependency(token.id);
    
    // Create instance
    this.resolutionStack.push(token.id);
    try {
      const instance = await descriptor.factory(this) as T;
      
      // Cache based on lifetime
      this.cacheInstance(descriptor, instance);
      
      // Run initializer
      if (descriptor.initializer) {
        await descriptor.initializer(instance, this);
      }
      
      // Track disposable
      if (descriptor.disposer) {
        this.disposables.push(() => descriptor.disposer!(instance));
      }
      
      return instance;
    } finally {
      this.resolutionStack.pop();
    }
  }

  /**
   * Try to resolve a service, returning undefined if not found
   */
  tryResolve<T>(token: ServiceToken<T>): T | undefined {
    try {
      return this.resolve(token);
    } catch {
      return undefined;
    }
  }

  /**
   * Check if a service is registered
   */
  has(token: ServiceToken<unknown>): boolean {
    return this.descriptors.has(token.id) || 
           this.singletons.has(token.id) ||
           (this.parent?.has(token) ?? false);
  }

  /**
   * Create a child scope
   */
  createScope(): Container {
    this.ensureNotDisposed();
    return new Container(this);
  }

  /**
   * Dispose the container and all singleton instances
   */
  async [Symbol.asyncDispose](): Promise<void> {
    if (this.disposed) return;
    
    this.disposed = true;
    
    // Dispose in reverse order
    for (let i = this.disposables.length - 1; i >= 0; i--) {
      try {
        await this.disposables[i]();
      } catch (error) {
        // Log but continue disposing
        this.log.error('error disposing service', { error: error instanceof Error ? error.message : String(error) });
      }
    }
    
    this.disposables = [];
    this.singletons.clear();
    this.scopedInstances.clear();
    this.descriptors.clear();
  }

  /**
   * Dispose synchronously
   */
  dispose(): void {
    if (this.disposed) return;
    
    this.disposed = true;
    
    // Dispose in reverse order (sync only)
    for (let i = this.disposables.length - 1; i >= 0; i--) {
      try {
        const result = this.disposables[i]();
        if (result instanceof Promise) {
          // Log warning for async disposal in sync context
          this.log.warn('async disposal called in sync context');
        }
      } catch (error) {
        this.log.error('error disposing service', { error: error instanceof Error ? error.message : String(error) });
      }
    }
    
    this.disposables = [];
    this.singletons.clear();
    this.scopedInstances.clear();
    this.descriptors.clear();
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new DisposedError('Container', { component: 'Container' });
    }
  }

  private detectCircularDependency(id: symbol): void {
    if (this.resolutionStack.includes(id)) {
      const cycle = [...this.resolutionStack, id]
        .map(s => Symbol.keyFor(s) ?? s.toString())
        .join(' -> ');
      
      throw new BridgeError(
        ErrorCode.DEPENDENCY_MISSING,
        `Circular dependency detected: ${cycle}`,
        { component: 'Container', metadata: { cycle: this.resolutionStack.map(s => Symbol.keyFor(s)) } }
      );
    }
  }

  private cacheInstance<T>(descriptor: ServiceDescriptor<T>, instance: T): void {
    switch (descriptor.lifetime) {
      case 'singleton':
        this.singletons.set(descriptor.id, instance);
        break;
      case 'scoped':
        this.scopedInstances.set(descriptor.id, instance);
        break;
      // 'transient' instances are not cached
    }
  }
}

// ============================================================================
// Container Builder
// ============================================================================

/**
 * Fluent container builder
 */
export class ContainerBuilder {
  private descriptors: Array<ServiceDescriptor & { token: ServiceToken<unknown> }> = [];
  private instances: Array<{ token: ServiceToken<unknown>; instance: unknown }> = [];

  /**
   * Add a singleton service
   */
  addSingleton<T>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T>,
    options?: Partial<Omit<ServiceDescriptor<T>, 'id' | 'factory' | 'lifetime'>>
  ): this {
    const descriptor: ServiceDescriptor<unknown> & { token: ServiceToken<unknown> } = {
      token: token as ServiceToken<unknown>,
      id: token.id,
      lifetime: 'singleton',
      factory: factory as ServiceFactory<unknown>,
      dependencies: options?.dependencies,
      isAsync: options?.isAsync,
      initializer: options?.initializer as ((instance: unknown, container: Container) => void | Promise<void>) | undefined,
      disposer: options?.disposer as ((instance: unknown) => void | Promise<void>) | undefined,
    };
    this.descriptors.push(descriptor);
    return this;
  }

  /**
   * Add a transient service
   */
  addTransient<T>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T>,
    options?: Partial<Omit<ServiceDescriptor<T>, 'id' | 'factory' | 'lifetime'>>
  ): this {
    const descriptor: ServiceDescriptor<unknown> & { token: ServiceToken<unknown> } = {
      token: token as ServiceToken<unknown>,
      id: token.id,
      lifetime: 'transient',
      factory: factory as ServiceFactory<unknown>,
      dependencies: options?.dependencies,
      isAsync: options?.isAsync,
      initializer: options?.initializer as ((instance: unknown, container: Container) => void | Promise<void>) | undefined,
      disposer: options?.disposer as ((instance: unknown) => void | Promise<void>) | undefined,
    };
    this.descriptors.push(descriptor);
    return this;
  }

  /**
   * Add a scoped service
   */
  addScoped<T>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T>,
    options?: Partial<Omit<ServiceDescriptor<T>, 'id' | 'factory' | 'lifetime'>>
  ): this {
    const descriptor: ServiceDescriptor<unknown> & { token: ServiceToken<unknown> } = {
      token: token as ServiceToken<unknown>,
      id: token.id,
      lifetime: 'scoped',
      factory: factory as ServiceFactory<unknown>,
      dependencies: options?.dependencies,
      isAsync: options?.isAsync,
      initializer: options?.initializer as ((instance: unknown, container: Container) => void | Promise<void>) | undefined,
      disposer: options?.disposer as ((instance: unknown) => void | Promise<void>) | undefined,
    };
    this.descriptors.push(descriptor);
    return this;
  }

  /**
   * Add an instance directly
   */
  addInstance<T>(token: ServiceToken<T>, instance: T): this {
    this.instances.push({ token: token as ServiceToken<unknown>, instance });
    return this;
  }

  /**
   * Build the container
   */
  build(): Container {
    const container = new Container();
    
    // Register instances first
    for (const { token, instance } of this.instances) {
      container.registerInstance(token, instance);
    }
    
    // Register descriptors
    for (const descriptor of this.descriptors) {
      container.register(descriptor.token, descriptor.factory, {
        lifetime: descriptor.lifetime,
        dependencies: descriptor.dependencies,
        isAsync: descriptor.isAsync,
        initializer: descriptor.initializer,
        disposer: descriptor.disposer,
      });
    }
    
    return container;
  }
}

// ============================================================================
// Default Container Setup
// ============================================================================

/**
 * Create a pre-configured container with default services
 */
export function createDefaultContainer(config?: Partial<BridgeConfig>): Container {
  const fullConfig: BridgeConfig = {
    maxCacheEntries: 100,
    cacheEnabled: true,
    validationEnabled: true,
    provenanceEnabled: true,
    defaultTimeout: 30000,
    logLevel: 'info',
    ...config,
  };

  return new ContainerBuilder()
    .addInstance(ServiceTokens.Config, fullConfig)
    .build();
}

// ============================================================================
// Lazy Resolution
// ============================================================================

/**
 * Lazy service wrapper for deferred resolution
 */
export class Lazy<T> {
  private resolved = false;
  private instance?: T;
  private readonly factory: () => T;

  constructor(factory: () => T) {
    this.factory = factory;
  }

  get value(): T {
    if (!this.resolved) {
      this.instance = this.factory();
      this.resolved = true;
    }
    return this.instance!;
  }

  get isResolved(): boolean {
    return this.resolved;
  }
}

/**
 * Create a lazy resolver for a service
 */
export function lazy<T>(container: Container, token: ServiceToken<T>): Lazy<T> {
  return new Lazy(() => container.resolve(token));
}

// ============================================================================
// Module Pattern
// ============================================================================

/**
 * Service module interface
 */
export interface ServiceModule {
  name: string;
  register(builder: ContainerBuilder): void;
}

/**
 * Register multiple modules
 */
export function registerModules(
  builder: ContainerBuilder,
  modules: ServiceModule[]
): ContainerBuilder {
  for (const module of modules) {
    module.register(builder);
  }
  return builder;
}

// ============================================================================
// Export Singleton Container
// ============================================================================

let globalContainer: Container | null = null;

/**
 * Get the global container instance
 */
export function getGlobalContainer(): Container {
  if (!globalContainer) {
    globalContainer = createDefaultContainer();
  }
  return globalContainer;
}

/**
 * Set the global container instance
 */
export function setGlobalContainer(container: Container): void {
  globalContainer = container;
}

/**
 * Reset the global container
 */
export async function resetGlobalContainer(): Promise<void> {
  if (globalContainer) {
    await globalContainer[Symbol.asyncDispose]();
    globalContainer = null;
  }
}

/**
 * Universal Memory Provider
 *
 * Chrysalis's memory-agnostic abstraction layer.
 *
 * Philosophy:
 * - Memory is ESSENTIAL to agent evolution and learning
 * - The "correct" memory model is NOT settled science
 * - Support multiple memory backends/paradigms
 * - Allow users to choose based on their needs
 *
 * Supported Memory Providers:
 * - Chrysalis Native: Episodic/Semantic/Procedural with Byzantine validation
 * - Letta: Memory blocks (persona/human/project) with skill learning
 * - Mem0: User/session memory with temporal awareness
 * - Zep: Conversation memory with entity extraction
 * - Custom: Bring your own memory implementation
 *
 * This is analogous to the Universal Protocol Translation System for agents.
 *
 * @module memory/UniversalMemoryProvider
 */

import { EventEmitter } from 'events';

// =============================================================================
// Core Types
// =============================================================================

/**
 * Memory provider identifiers
 */
export type MemoryProviderType =
  | 'chrysalis'  // Native distributed memory
  | 'letta'      // Letta platform memory blocks
  | 'mem0'       // Mem0.ai memory
  | 'zep'        // Zep conversation memory
  | 'custom';    // Custom implementation

/**
 * Memory operation types (common across providers)
 */
export type MemoryOperation =
  | 'store'
  | 'retrieve'
  | 'search'
  | 'update'
  | 'delete'
  | 'sync';

/**
 * Universal memory entry (normalized across providers)
 */
export interface UniversalMemoryEntry {
  id: string;
  content: string;
  type: 'episodic' | 'semantic' | 'procedural' | 'working' | 'block';
  importance: number;
  timestamp: number;
  source: string;
  metadata?: Record<string, unknown>;
  embedding?: number[];
  providerSpecific?: Record<string, unknown>;
}

/**
 * Search/retrieval result
 */
export interface MemorySearchResult {
  entries: UniversalMemoryEntry[];
  scores: number[];
  provider: MemoryProviderType;
  queryTime: number;
}

/**
 * Memory provider capabilities
 */
export interface MemoryProviderCapabilities {
  supportsEmbeddings: boolean;
  supportsSemanticSearch: boolean;
  supportsDistributed: boolean;
  supportsByzantineValidation: boolean;
  supportsSkillLearning: boolean;
  supportsBlocks: boolean;
  supportsSync: boolean;
  maxStorageSize?: number;
  embeddingDimension?: number;
}

/**
 * Memory provider interface - all providers must implement this
 */
export interface MemoryProvider {
  readonly type: MemoryProviderType;
  readonly capabilities: MemoryProviderCapabilities;

  // Lifecycle
  initialize(): Promise<boolean>;
  dispose(): Promise<void>;
  isInitialized(): boolean;

  // Core operations
  store(entry: Omit<UniversalMemoryEntry, 'id'>): Promise<UniversalMemoryEntry>;
  retrieve(id: string): Promise<UniversalMemoryEntry | null>;
  search(query: string, limit?: number): Promise<MemorySearchResult>;
  update(id: string, updates: Partial<UniversalMemoryEntry>): Promise<boolean>;
  delete(id: string): Promise<boolean>;

  // Bulk operations
  storeBatch(entries: Omit<UniversalMemoryEntry, 'id'>[]): Promise<UniversalMemoryEntry[]>;
  retrieveByType(type: UniversalMemoryEntry['type'], limit?: number): Promise<UniversalMemoryEntry[]>;

  // Provider-specific
  getProviderState(): Record<string, unknown>;
}

// =============================================================================
// Provider Registry
// =============================================================================

/**
 * Registry of available memory providers
 */
class MemoryProviderRegistry extends EventEmitter {
  private providers = new Map<MemoryProviderType, () => MemoryProvider>();
  private instances = new Map<string, MemoryProvider>();

  /**
   * Register a memory provider factory
   */
  register(type: MemoryProviderType, factory: () => MemoryProvider): void {
    this.providers.set(type, factory);
    this.emit('provider:registered', { type });
  }

  /**
   * Check if provider is registered
   */
  isRegistered(type: MemoryProviderType): boolean {
    return this.providers.has(type);
  }

  /**
   * Get available provider types
   */
  getAvailableProviders(): MemoryProviderType[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Create a provider instance
   */
  create(type: MemoryProviderType, instanceId?: string): MemoryProvider {
    const factory = this.providers.get(type);
    if (!factory) {
      throw new Error(`Memory provider not registered: ${type}`);
    }

    const instance = factory();
    if (instanceId) {
      this.instances.set(instanceId, instance);
    }
    return instance;
  }

  /**
   * Get existing instance
   */
  getInstance(instanceId: string): MemoryProvider | undefined {
    return this.instances.get(instanceId);
  }
}

// Global registry singleton
export const memoryProviderRegistry = new MemoryProviderRegistry();

// =============================================================================
// Universal Memory Client
// =============================================================================

/**
 * Configuration for universal memory client
 */
export interface UniversalMemoryConfig {
  primaryProvider: MemoryProviderType;
  fallbackProviders?: MemoryProviderType[];
  syncEnabled: boolean;
  syncInterval: number;
  mergeStrategy: 'primary-wins' | 'latest-wins' | 'byzantine-consensus';
}

const DEFAULT_UNIVERSAL_CONFIG: UniversalMemoryConfig = {
  primaryProvider: 'chrysalis',
  fallbackProviders: [],
  syncEnabled: false,
  syncInterval: 60000,
  mergeStrategy: 'primary-wins',
};

/**
 * Universal Memory Client
 *
 * Provides a unified interface to multiple memory providers.
 * Handles failover, sync, and cross-provider operations.
 */
export class UniversalMemoryClient extends EventEmitter {
  private config: UniversalMemoryConfig;
  private primaryProvider: MemoryProvider | null = null;
  private fallbackProviders: MemoryProvider[] = [];
  private syncTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<UniversalMemoryConfig> = {}) {
    super();
    this.config = { ...DEFAULT_UNIVERSAL_CONFIG, ...config };
  }

  /**
   * Initialize the client with configured providers
   */
  async initialize(): Promise<boolean> {
    // Initialize primary provider
    if (memoryProviderRegistry.isRegistered(this.config.primaryProvider)) {
      this.primaryProvider = memoryProviderRegistry.create(
        this.config.primaryProvider,
        'primary'
      );
      await this.primaryProvider.initialize();
    } else {
      console.warn(`Primary memory provider not available: ${this.config.primaryProvider}`);
      return false;
    }

    // Initialize fallback providers
    for (const fallbackType of this.config.fallbackProviders || []) {
      if (memoryProviderRegistry.isRegistered(fallbackType)) {
        const fallback = memoryProviderRegistry.create(fallbackType);
        await fallback.initialize();
        this.fallbackProviders.push(fallback);
      }
    }

    // Start sync if enabled
    if (this.config.syncEnabled && this.fallbackProviders.length > 0) {
      this.startSync();
    }

    this.emit('initialized', {
      primary: this.config.primaryProvider,
      fallbacks: this.config.fallbackProviders,
    });

    return true;
  }

  /**
   * Store a memory entry
   */
  async store(entry: Omit<UniversalMemoryEntry, 'id'>): Promise<UniversalMemoryEntry> {
    if (!this.primaryProvider) {
      throw new Error('Memory client not initialized');
    }

    const stored = await this.primaryProvider.store(entry);

    // Async replicate to fallbacks
    this.replicateToFallbacks(stored);

    this.emit('memory:stored', { entry: stored });
    return stored;
  }

  /**
   * Retrieve a memory entry by ID
   */
  async retrieve(id: string): Promise<UniversalMemoryEntry | null> {
    if (!this.primaryProvider) {
      throw new Error('Memory client not initialized');
    }

    let result = await this.primaryProvider.retrieve(id);

    // Try fallbacks if not found
    if (!result) {
      for (const fallback of this.fallbackProviders) {
        result = await fallback.retrieve(id);
        if (result) break;
      }
    }

    return result;
  }

  /**
   * Search across providers
   */
  async search(query: string, limit: number = 10): Promise<MemorySearchResult> {
    if (!this.primaryProvider) {
      throw new Error('Memory client not initialized');
    }

    const primaryResult = await this.primaryProvider.search(query, limit);

    // Optionally merge with fallback results
    if (this.fallbackProviders.length > 0 && this.config.mergeStrategy !== 'primary-wins') {
      // Could implement cross-provider search merging here
    }

    return primaryResult;
  }

  /**
   * Update a memory entry
   */
  async update(id: string, updates: Partial<UniversalMemoryEntry>): Promise<boolean> {
    if (!this.primaryProvider) {
      throw new Error('Memory client not initialized');
    }

    const success = await this.primaryProvider.update(id, updates);

    if (success) {
      // Async replicate update to fallbacks
      for (const fallback of this.fallbackProviders) {
        fallback.update(id, updates).catch(() => {});
      }
    }

    return success;
  }

  /**
   * Delete a memory entry
   */
  async delete(id: string): Promise<boolean> {
    if (!this.primaryProvider) {
      throw new Error('Memory client not initialized');
    }

    const success = await this.primaryProvider.delete(id);

    if (success) {
      // Async delete from fallbacks
      for (const fallback of this.fallbackProviders) {
        fallback.delete(id).catch(() => {});
      }
    }

    return success;
  }

  /**
   * Get capabilities of current provider configuration
   */
  getCapabilities(): MemoryProviderCapabilities | null {
    return this.primaryProvider?.capabilities || null;
  }

  /**
   * Get current provider type
   */
  getCurrentProvider(): MemoryProviderType | null {
    return this.primaryProvider?.type || null;
  }

  /**
   * Switch primary provider
   */
  async switchProvider(type: MemoryProviderType): Promise<boolean> {
    if (!memoryProviderRegistry.isRegistered(type)) {
      return false;
    }

    const newProvider = memoryProviderRegistry.create(type);
    await newProvider.initialize();

    // Move current primary to fallback
    if (this.primaryProvider) {
      this.fallbackProviders.unshift(this.primaryProvider);
    }

    this.primaryProvider = newProvider;
    this.config.primaryProvider = type;

    this.emit('provider:switched', { newProvider: type });
    return true;
  }

  /**
   * Dispose and clean up
   */
  async dispose(): Promise<void> {
    this.stopSync();

    if (this.primaryProvider) {
      await this.primaryProvider.dispose();
    }

    for (const fallback of this.fallbackProviders) {
      await fallback.dispose();
    }

    this.primaryProvider = null;
    this.fallbackProviders = [];
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private replicateToFallbacks(entry: UniversalMemoryEntry): void {
    for (const fallback of this.fallbackProviders) {
      fallback.store(entry).catch(err => {
        console.warn(`Failed to replicate to ${fallback.type}: ${err.message}`);
      });
    }
  }

  private startSync(): void {
    if (this.syncTimer) return;

    this.syncTimer = setInterval(() => {
      this.performSync().catch(err => {
        console.warn(`Memory sync failed: ${err.message}`);
      });
    }, this.config.syncInterval);
  }

  private stopSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  private async performSync(): Promise<void> {
    // Implementation would depend on sync strategy
    this.emit('sync:started');
    // ... sync logic ...
    this.emit('sync:completed');
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a universal memory client with default configuration
 */
export function createUniversalMemoryClient(
  config?: Partial<UniversalMemoryConfig>
): UniversalMemoryClient {
  return new UniversalMemoryClient(config);
}

/**
 * Quick setup for a specific provider
 */
export async function setupMemoryProvider(
  type: MemoryProviderType,
  options?: Record<string, unknown>
): Promise<UniversalMemoryClient> {
  const client = new UniversalMemoryClient({ primaryProvider: type });
  await client.initialize();
  return client;
}

// =============================================================================
// (Exports are inline with class/function definitions above)
// =============================================================================

/**
 * Persistent Vector Store
 * 
 * High-level abstraction over vector persistence backends.
 * Provides unified interface for memory persistence operations.
 */

import {
  VectorPersistenceBackend,
  VectorRecord,
  VectorSearchResult,
  VectorSearchOptions,
  BatchResult,
  StorageStats,
  PersistenceConfig,
  createPersistenceBackend,
} from './VectorPersistence';

/**
 * Persistent vector store configuration
 */
export interface PersistentVectorStoreConfig extends PersistenceConfig {
  /** Auto-initialize on construction */
  autoInitialize?: boolean;
}

/**
 * Persistent Vector Store
 * 
 * Manages vector storage with automatic backend selection
 * and lifecycle management.
 */
export class PersistentVectorStore {
  private backend: VectorPersistenceBackend | null = null;
  private config: PersistentVectorStoreConfig;
  private initialized = false;

  constructor(config: PersistentVectorStoreConfig) {
    this.config = config;
  }

  /**
   * Initialize the store
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.backend = await createPersistenceBackend(this.config);
    await this.backend.initialize();
    this.initialized = true;
  }

  /**
   * Close the store
   */
  async close(): Promise<void> {
    if (!this.initialized) return;
    await this.backend.close();
    this.initialized = false;
  }

  /**
   * Check if store is ready
   */
  isReady(): boolean {
    return this.initialized && this.backend.isReady();
  }

  /**
   * Get the backend name
   */
  getBackendName(): string {
    return this.backend?.name ?? 'uninitialized';
  }

  // Delegate operations to backend

  async insert(record: Omit<VectorRecord, 'createdAt' | 'updatedAt'>): Promise<string> {
    this.ensureReady();
    return this.backend.insert(record);
  }

  async insertBatch(records: Array<Omit<VectorRecord, 'createdAt' | 'updatedAt'>>): Promise<BatchResult> {
    this.ensureReady();
    return this.backend.insertBatch(records);
  }

  async update(id: string, updates: Partial<Omit<VectorRecord, 'id' | 'createdAt'>>): Promise<boolean> {
    this.ensureReady();
    return this.backend.update(id, updates);
  }

  async delete(id: string): Promise<boolean> {
    this.ensureReady();
    return this.backend.delete(id);
  }

  async deleteBatch(ids: string[]): Promise<BatchResult> {
    this.ensureReady();
    return this.backend.deleteBatch(ids);
  }

  async get(id: string): Promise<VectorRecord | null> {
    this.ensureReady();
    return this.backend.get(id);
  }

  async getBatch(ids: string[]): Promise<VectorRecord[]> {
    this.ensureReady();
    return this.backend.getBatch(ids);
  }

  async exists(id: string): Promise<boolean> {
    this.ensureReady();
    return this.backend.exists(id);
  }

  async search(vector: number[], options?: VectorSearchOptions): Promise<VectorSearchResult[]> {
    this.ensureReady();
    return this.backend.search(vector, options);
  }

  async searchByMetadata(filter: Record<string, unknown>, options?: VectorSearchOptions): Promise<VectorRecord[]> {
    this.ensureReady();
    return this.backend.searchByMetadata(filter, options);
  }

  async listNamespaces(): Promise<string[]> {
    this.ensureReady();
    return this.backend.listNamespaces();
  }

  async deleteNamespace(namespace: string): Promise<number> {
    this.ensureReady();
    return this.backend.deleteNamespace(namespace);
  }

  async getStats(): Promise<StorageStats> {
    this.ensureReady();
    return this.backend.getStats();
  }

  async optimize(): Promise<void> {
    this.ensureReady();
    return this.backend.optimize();
  }

  async backup(path: string): Promise<void> {
    this.ensureReady();
    return this.backend.backup(path);
  }

  async restore(path: string): Promise<void> {
    this.ensureReady();
    return this.backend.restore(path);
  }

  private ensureReady(): asserts this is { backend: VectorPersistenceBackend } {
    if (!this.initialized || !this.backend) {
      throw new Error('PersistentVectorStore not initialized. Call initialize() first.');
    }
    if (!this.backend.isReady()) {
      throw new Error('PersistentVectorStore backend is not ready.');
    }
  }
}

/**
 * File-based Vector Backend
 * 
 * Simple file-based vector storage using JSON.
 * Suitable for small datasets and development.
 * 
 * Delegates to MemoryBackend with file persistence enabled.
 */

import { MemoryBackend } from './MemoryBackend';
import {
  VectorPersistenceBackend,
  VectorRecord,
  VectorSearchResult,
  VectorSearchOptions,
  BatchResult,
  StorageStats,
  PersistenceConfig,
} from '../VectorPersistence';

/**
 * File-based vector storage backend
 * 
 * Wraps MemoryBackend with file persistence configuration.
 */
export class FileBackend implements VectorPersistenceBackend {
  readonly name = 'file';
  private delegate: MemoryBackend;

  constructor(config: PersistenceConfig) {
    // Ensure path is set for file persistence
    const fileConfig: PersistenceConfig = {
      ...config,
      path: config.path || './data/vectors',
      autoSaveInterval: config.autoSaveInterval ?? 30000, // Auto-save every 30s
    };
    this.delegate = new MemoryBackend(fileConfig);
  }

  async initialize(): Promise<void> {
    return this.delegate.initialize();
  }

  async close(): Promise<void> {
    return this.delegate.close();
  }

  isReady(): boolean {
    return this.delegate.isReady();
  }

  async insert(record: Omit<VectorRecord, 'createdAt' | 'updatedAt'>): Promise<string> {
    return this.delegate.insert(record);
  }

  async insertBatch(records: Array<Omit<VectorRecord, 'createdAt' | 'updatedAt'>>): Promise<BatchResult> {
    return this.delegate.insertBatch(records);
  }

  async update(id: string, updates: Partial<Omit<VectorRecord, 'id' | 'createdAt'>>): Promise<boolean> {
    return this.delegate.update(id, updates);
  }

  async delete(id: string): Promise<boolean> {
    return this.delegate.delete(id);
  }

  async deleteBatch(ids: string[]): Promise<BatchResult> {
    return this.delegate.deleteBatch(ids);
  }

  async get(id: string): Promise<VectorRecord | null> {
    return this.delegate.get(id);
  }

  async getBatch(ids: string[]): Promise<VectorRecord[]> {
    return this.delegate.getBatch(ids);
  }

  async exists(id: string): Promise<boolean> {
    return this.delegate.exists(id);
  }

  async search(vector: number[], options?: VectorSearchOptions): Promise<VectorSearchResult[]> {
    return this.delegate.search(vector, options);
  }

  async searchByMetadata(filter: Record<string, unknown>, options?: VectorSearchOptions): Promise<VectorRecord[]> {
    return this.delegate.searchByMetadata(filter, options);
  }

  async listNamespaces(): Promise<string[]> {
    return this.delegate.listNamespaces();
  }

  async deleteNamespace(namespace: string): Promise<number> {
    return this.delegate.deleteNamespace(namespace);
  }

  async getStats(): Promise<StorageStats> {
    return this.delegate.getStats();
  }

  async optimize(): Promise<void> {
    return this.delegate.optimize();
  }

  async backup(path: string): Promise<void> {
    return this.delegate.backup(path);
  }

  async restore(path: string): Promise<void> {
    return this.delegate.restore(path);
  }
}

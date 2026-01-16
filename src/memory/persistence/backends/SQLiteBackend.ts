/**
 * SQLite Vector Backend (Stub)
 * 
 * SQLite-based vector storage with sqlite-vec extension.
 * Provides local persistence with SQL query capabilities.
 * 
 * @stub Implementation pending - requires better-sqlite3 npm package
 */

import {
  VectorPersistenceBackend,
  VectorRecord,
  VectorSearchResult,
  VectorSearchOptions,
  BatchResult,
  StorageStats,
  PersistenceConfig,
} from '../VectorPersistence';

class NotImplementedError extends Error {
  constructor(method: string, backend: string, hint?: string) {
    const message = hint
      ? `${backend}.${method}() is not implemented - ${hint}`
      : `${backend}.${method}() is not implemented`;
    super(message);
    this.name = 'NotImplementedError';
  }
}

/**
 * SQLite vector storage backend
 * @stub Stub implementation - full implementation requires better-sqlite3 package
 */
export class SQLiteBackend implements VectorPersistenceBackend {
  readonly name = 'sqlite';
  
  private config: PersistenceConfig;

  constructor(config: PersistenceConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    throw new NotImplementedError('initialize', 'SQLiteBackend', 'install better-sqlite3 package');
  }

  async close(): Promise<void> {
    throw new NotImplementedError('close', 'SQLiteBackend', 'install better-sqlite3 package');
  }

  isReady(): boolean {
    return false;
  }

  async insert(_record: Omit<VectorRecord, 'createdAt' | 'updatedAt'>): Promise<string> {
    throw new NotImplementedError('insert', 'SQLiteBackend', 'install better-sqlite3 package');
  }

  async insertBatch(_records: Array<Omit<VectorRecord, 'createdAt' | 'updatedAt'>>): Promise<BatchResult> {
    throw new NotImplementedError('insertBatch', 'SQLiteBackend', 'install better-sqlite3 package');
  }

  async update(_id: string, _updates: Partial<Omit<VectorRecord, 'id' | 'createdAt'>>): Promise<boolean> {
    throw new NotImplementedError('update', 'SQLiteBackend', 'install better-sqlite3 package');
  }

  async delete(_id: string): Promise<boolean> {
    throw new NotImplementedError('delete', 'SQLiteBackend', 'install better-sqlite3 package');
  }

  async deleteBatch(_ids: string[]): Promise<BatchResult> {
    throw new NotImplementedError('deleteBatch', 'SQLiteBackend', 'install better-sqlite3 package');
  }

  async get(_id: string): Promise<VectorRecord | null> {
    throw new NotImplementedError('get', 'SQLiteBackend', 'install better-sqlite3 package');
  }

  async getBatch(_ids: string[]): Promise<VectorRecord[]> {
    throw new NotImplementedError('getBatch', 'SQLiteBackend', 'install better-sqlite3 package');
  }

  async exists(_id: string): Promise<boolean> {
    throw new NotImplementedError('exists', 'SQLiteBackend', 'install better-sqlite3 package');
  }

  async search(_vector: number[], _options?: VectorSearchOptions): Promise<VectorSearchResult[]> {
    throw new NotImplementedError('search', 'SQLiteBackend', 'install better-sqlite3 package');
  }

  async searchByMetadata(_filter: Record<string, unknown>, _options?: VectorSearchOptions): Promise<VectorRecord[]> {
    throw new NotImplementedError('searchByMetadata', 'SQLiteBackend', 'install better-sqlite3 package');
  }

  async listNamespaces(): Promise<string[]> {
    throw new NotImplementedError('listNamespaces', 'SQLiteBackend', 'install better-sqlite3 package');
  }

  async deleteNamespace(_namespace: string): Promise<number> {
    throw new NotImplementedError('deleteNamespace', 'SQLiteBackend', 'install better-sqlite3 package');
  }

  async getStats(): Promise<StorageStats> {
    throw new NotImplementedError('getStats', 'SQLiteBackend', 'install better-sqlite3 package');
  }

  async optimize(): Promise<void> {
    throw new NotImplementedError('optimize', 'SQLiteBackend', 'install better-sqlite3 package');
  }

  async backup(_path: string): Promise<void> {
    throw new NotImplementedError('backup', 'SQLiteBackend', 'install better-sqlite3 package');
  }

  async restore(_path: string): Promise<void> {
    throw new NotImplementedError('restore', 'SQLiteBackend', 'install better-sqlite3 package');
  }
}

/**
 * Vector Persistence Interfaces
 * 
 * Defines the contract for persistent vector storage backends.
 */

/**
 * Vector record with metadata
 */
export interface VectorRecord {
  /** Unique identifier */
  id: string;
  /** Vector embedding */
  vector: number[];
  /** Associated metadata */
  metadata?: Record<string, unknown>;
  /** Content text (optional) */
  content?: string;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
  /** Namespace/collection */
  namespace?: string;
}

/**
 * Search result with score
 */
export interface VectorSearchResult {
  id: string;
  score: number;
  vector?: number[];
  metadata?: Record<string, unknown>;
  content?: string;
}

/**
 * Search options
 */
export interface VectorSearchOptions {
  /** Maximum results to return */
  topK?: number;
  /** Minimum similarity score (0-1) */
  minScore?: number;
  /** Filter by namespace */
  namespace?: string;
  /** Metadata filters */
  filter?: Record<string, unknown>;
  /** Include vectors in results */
  includeVectors?: boolean;
  /** Include metadata in results */
  includeMetadata?: boolean;
}

/**
 * Batch operation result
 */
export interface BatchResult {
  success: number;
  failed: number;
  errors?: Array<{ id: string; error: string }>;
}

/**
 * Storage statistics
 */
export interface StorageStats {
  totalRecords: number;
  totalNamespaces: number;
  dimensionality: number;
  sizeBytes?: number;
  lastModified?: string;
}

/**
 * Backend configuration
 */
export interface PersistenceConfig {
  /** Backend type */
  backend: 'lancedb' | 'sqlite' | 'file' | 'memory';
  /** Storage path (for file-based backends) */
  path?: string;
  /** Collection/table name */
  collection?: string;
  /** Vector dimensionality */
  dimension?: number;
  /** Distance metric */
  metric?: 'cosine' | 'euclidean' | 'dot';
  /** Auto-save interval (ms) for memory backend */
  autoSaveInterval?: number;
  /** Enable compression */
  compression?: boolean;
  /** Connection pool size */
  poolSize?: number;
}

/**
 * Vector persistence backend interface
 */
export interface VectorPersistenceBackend {
  /** Backend name */
  readonly name: string;
  
  /** Initialize the backend */
  initialize(): Promise<void>;
  
  /** Close connections and cleanup */
  close(): Promise<void>;
  
  /** Check if backend is ready */
  isReady(): boolean;
  
  // CRUD Operations
  
  /** Insert a single record */
  insert(record: Omit<VectorRecord, 'createdAt' | 'updatedAt'>): Promise<string>;
  
  /** Insert multiple records */
  insertBatch(records: Array<Omit<VectorRecord, 'createdAt' | 'updatedAt'>>): Promise<BatchResult>;
  
  /** Update a record */
  update(id: string, updates: Partial<Omit<VectorRecord, 'id' | 'createdAt'>>): Promise<boolean>;
  
  /** Delete a record */
  delete(id: string): Promise<boolean>;
  
  /** Delete multiple records */
  deleteBatch(ids: string[]): Promise<BatchResult>;
  
  /** Get a record by ID */
  get(id: string): Promise<VectorRecord | null>;
  
  /** Get multiple records by IDs */
  getBatch(ids: string[]): Promise<VectorRecord[]>;
  
  /** Check if record exists */
  exists(id: string): Promise<boolean>;
  
  // Search Operations
  
  /** Search for similar vectors */
  search(vector: number[], options?: VectorSearchOptions): Promise<VectorSearchResult[]>;
  
  /** Search by metadata */
  searchByMetadata(filter: Record<string, unknown>, options?: VectorSearchOptions): Promise<VectorRecord[]>;
  
  // Namespace Operations
  
  /** List all namespaces */
  listNamespaces(): Promise<string[]>;
  
  /** Delete all records in a namespace */
  deleteNamespace(namespace: string): Promise<number>;
  
  // Maintenance Operations
  
  /** Get storage statistics */
  getStats(): Promise<StorageStats>;
  
  /** Optimize storage (compact, reindex, etc.) */
  optimize(): Promise<void>;
  
  /** Create a backup */
  backup(path: string): Promise<void>;
  
  /** Restore from backup */
  restore(path: string): Promise<void>;
}

/**
 * Create a persistence backend from configuration
 */
export async function createPersistenceBackend(config: PersistenceConfig): Promise<VectorPersistenceBackend> {
  switch (config.backend) {
    case 'lancedb': {
      const { LanceDBBackend } = await import('./backends/LanceDBBackend');
      return new LanceDBBackend(config);
    }
    case 'sqlite': {
      const { SQLiteBackend } = await import('./backends/SQLiteBackend');
      return new SQLiteBackend(config);
    }
    case 'file': {
      const { FileBackend } = await import('./backends/FileBackend');
      return new FileBackend(config);
    }
    case 'memory':
    default: {
      const { MemoryBackend } = await import('./backends/MemoryBackend');
      return new MemoryBackend(config);
    }
  }
}

/**
 * Create backend from environment variables
 */
export function configFromEnv(): PersistenceConfig {
  const backend = (process.env.VECTOR_BACKEND || 'memory') as PersistenceConfig['backend'];
  
  return {
    backend,
    path: process.env.VECTOR_PATH || './data/vectors',
    collection: process.env.VECTOR_COLLECTION || 'memories',
    dimension: process.env.VECTOR_DIMENSION ? parseInt(process.env.VECTOR_DIMENSION, 10) : undefined,
    metric: (process.env.VECTOR_METRIC || 'cosine') as PersistenceConfig['metric'],
    autoSaveInterval: process.env.VECTOR_AUTOSAVE ? parseInt(process.env.VECTOR_AUTOSAVE, 10) : 60000,
    compression: process.env.VECTOR_COMPRESSION === 'true',
    poolSize: process.env.VECTOR_POOL_SIZE ? parseInt(process.env.VECTOR_POOL_SIZE, 10) : 5,
  };
}

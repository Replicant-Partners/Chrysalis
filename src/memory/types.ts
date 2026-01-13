/**
 * Memory System Type Definitions
 * 
 * @module memory/types
 * @see plans/CHRYSALIS_DEVELOPMENT_STREAMLINING_PLAN.md - Item C-2
 */

/**
 * Memory entry representing a single piece of stored information
 */
export interface MemoryEntry {
  id: string;
  content: string;
  memoryType: MemoryType;
  timestamp: Date;
  metadata: Record<string, unknown>;
  embedding?: number[];
}

/**
 * Supported memory types following cognitive architecture
 */
export type MemoryType = 'working' | 'episodic' | 'semantic' | 'core';

/**
 * Result from memory retrieval operations
 */
export interface RetrievalResult {
  entries: MemoryEntry[];
  scores: number[];
  metadata: Record<string, unknown>;
}

/**
 * Configuration for memory subsystems
 */
export interface MemoryConfig {
  // Embeddings
  embeddingModel: string;
  embeddingDimensions: number;
  
  // Storage
  vectorStoreType: 'chroma' | 'lance' | 'faiss';
  storagePath: string;
  
  // Working memory
  workingMemorySize: number;
  
  // Retrieval
  defaultRetrievalLimit: number;
  similarityThreshold: number;
  
  // API
  apiKey?: string;
}

/**
 * Default memory configuration
 */
export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  embeddingModel: 'openai/text-embedding-3-small',
  embeddingDimensions: 1536,
  vectorStoreType: 'chroma',
  storagePath: './memory_data',
  workingMemorySize: 10,
  defaultRetrievalLimit: 5,
  similarityThreshold: 0.7,
};

/**
 * Memory storage protocol/interface
 */
export interface MemoryStore {
  store(entry: MemoryEntry): Promise<void>;
  retrieve(query: string, limit?: number): Promise<RetrievalResult>;
  getById(entryId: string): Promise<MemoryEntry | null>;
  listRecent(limit?: number): Promise<MemoryEntry[]>;
  delete(entryId: string): Promise<boolean>;
  count(): Promise<number>;
}

/**
 * Embedding provider interface
 */
export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  isReady(): boolean;
  initialize(): Promise<void>;
}

/**
 * Memory statistics
 */
export interface MemoryStats {
  workingMemorySize: number;
  coreMemoryBlocks: number;
  episodicCount: number;
  semanticCount: number;
  totalEntries: number;
  config: Partial<MemoryConfig>;
}

/**
 * Core memory block for persistent agent context
 */
export interface CoreMemoryBlock {
  key: string;
  value: string;
  updatedAt: Date;
  createdAt: Date;
}

/**
 * Create a new memory entry
 */
export function createMemoryEntry(
  content: string,
  memoryType: MemoryType,
  metadata?: Record<string, unknown>
): MemoryEntry {
  return {
    id: crypto.randomUUID(),
    content,
    memoryType,
    timestamp: new Date(),
    metadata: metadata ?? {},
  };
}
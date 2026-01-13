/**
 * Episodic Memory - Past Experiences
 * 
 * Long-term memory for specific events and experiences.
 * Uses vector similarity search for retrieval.
 * 
 * Cognitive analogue: Tulving's episodic memory
 * 
 * @module memory/EpisodicMemory
 * @see plans/CHRYSALIS_DEVELOPMENT_STREAMLINING_PLAN.md - Item C-2
 * @see Tulving, E. (1972). Episodic and semantic memory
 */

import {
  MemoryEntry,
  MemoryStore,
  EmbeddingProvider,
  RetrievalResult,
  createMemoryEntry,
} from './types';
import { trace, getMetrics, recordTimed } from '../observability';

/**
 * Episodic Memory Configuration
 */
export interface EpisodicMemoryConfig {
  similarityThreshold: number;
  defaultRetrievalLimit: number;
  sanitizeContent: boolean;
}

const DEFAULT_EPISODIC_CONFIG: EpisodicMemoryConfig = {
  similarityThreshold: 0.7,
  defaultRetrievalLimit: 5,
  sanitizeContent: true,
};

/**
 * Content sanitizer interface
 */
export interface ContentSanitizer {
  sanitize(content: string): { sanitized: string; piiDetected: string[] };
  validateMetadata(metadata: Record<string, unknown>): { 
    sanitized: Record<string, unknown>; 
    piiDetected: string[] 
  };
}

/**
 * Episodic Memory - Experience-based retrieval
 * 
 * Stores specific events and experiences with temporal context.
 * Optimized for "when did X happen?" type queries.
 */
export class EpisodicMemory {
  private store: MemoryStore | null = null;
  private embeddingProvider: EmbeddingProvider | null = null;
  private sanitizer: ContentSanitizer | null = null;
  private config: EpisodicMemoryConfig;
  private initialized = false;

  constructor(config?: Partial<EpisodicMemoryConfig>) {
    this.config = { ...DEFAULT_EPISODIC_CONFIG, ...config };
  }

  /**
   * Initialize with storage and embedding backends
   */
  async initialize(
    store: MemoryStore,
    embeddingProvider: EmbeddingProvider,
    sanitizer?: ContentSanitizer
  ): Promise<void> {
    this.store = store;
    this.embeddingProvider = embeddingProvider;
    this.sanitizer = sanitizer ?? null;

    if (!embeddingProvider.isReady()) {
      await embeddingProvider.initialize();
    }

    this.initialized = true;
  }

  /**
   * Check if initialized
   */
  isReady(): boolean {
    return this.initialized && this.store !== null && this.embeddingProvider !== null;
  }

  /**
   * Add an episodic memory (experience/event)
   */
  async add(content: string, metadata?: Record<string, unknown>): Promise<MemoryEntry> {
    this.ensureInitialized();

    let finalContent = content;
    let finalMetadata = metadata ?? {};
    const piiDetected: string[] = [];

    // Sanitize if enabled
    if (this.config.sanitizeContent && this.sanitizer) {
      const contentResult = this.sanitizer.sanitize(content);
      finalContent = contentResult.sanitized;
      piiDetected.push(...contentResult.piiDetected);

      if (metadata) {
        const metaResult = this.sanitizer.validateMetadata(metadata);
        finalMetadata = metaResult.sanitized;
        piiDetected.push(...metaResult.piiDetected);
      }

      if (piiDetected.length > 0) {
        finalMetadata._piiDetected = [...new Set(piiDetected)];
        finalMetadata._sanitized = true;
      }
    }

    // Create entry
    const entry = createMemoryEntry(finalContent, 'episodic', finalMetadata);

    // Generate embedding
    entry.embedding = await recordTimed(
      getMetrics().memoryRetrievalDuration,
      () => this.embeddingProvider!.embed(finalContent),
      { operation: 'embed', memory_type: 'episodic' }
    );

    // Store
    await this.store!.store(entry);

    getMetrics().memoryOperations.add(1, {
      operation: 'add',
      memory_type: 'episodic',
    });

    return entry;
  }

  /**
   * Search episodic memories by semantic similarity
   */
  async search(query: string, limit?: number): Promise<RetrievalResult> {
    this.ensureInitialized();

    const searchLimit = limit ?? this.config.defaultRetrievalLimit;

    const result = await recordTimed(
      getMetrics().memoryRetrievalDuration,
      () => this.store!.retrieve(query, searchLimit),
      { operation: 'search', memory_type: 'episodic' }
    );

    // Filter by memory type
    const episodicEntries = result.entries.filter(e => e.memoryType === 'episodic');
    const episodicScores = result.scores.filter((_, i) => 
      result.entries[i].memoryType === 'episodic'
    );

    return {
      entries: episodicEntries,
      scores: episodicScores,
      metadata: { ...result.metadata, memoryType: 'episodic' },
    };
  }

  /**
   * Get memory by ID
   */
  async getById(id: string): Promise<MemoryEntry | null> {
    this.ensureInitialized();
    return this.store!.getById(id);
  }

  /**
   * List recent episodic memories
   */
  async listRecent(limit?: number): Promise<MemoryEntry[]> {
    this.ensureInitialized();
    const all = await this.store!.listRecent(limit ?? 10);
    return all.filter(e => e.memoryType === 'episodic');
  }

  /**
   * Delete a memory
   */
  async delete(id: string): Promise<boolean> {
    this.ensureInitialized();
    const deleted = await this.store!.delete(id);
    
    if (deleted) {
      getMetrics().memoryOperations.add(1, {
        operation: 'delete',
        memory_type: 'episodic',
      });
    }
    
    return deleted;
  }

  /**
   * Get count of episodic memories
   */
  async count(): Promise<number> {
    this.ensureInitialized();
    return this.store!.count();
  }

  /**
   * Format for LLM context
   */
  async toContextString(query?: string, limit: number = 3): Promise<string> {
    if (!this.isReady()) {
      return '';
    }

    let entries: MemoryEntry[];
    
    if (query) {
      const result = await this.search(query, limit);
      entries = result.entries;
    } else {
      entries = await this.listRecent(limit);
    }

    if (entries.length === 0) {
      return '';
    }

    const lines = ['=== Past Experiences ==='];
    for (const entry of entries) {
      const timestamp = entry.timestamp.toISOString().split('T')[0];
      lines.push(`- [${timestamp}] ${entry.content}`);
    }
    return lines.join('\n');
  }

  /**
   * Ensure memory is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.store || !this.embeddingProvider) {
      throw new Error(
        'EpisodicMemory not initialized. Call initialize() with store and embedding provider.'
      );
    }
  }
}
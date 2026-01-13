/**
 * Semantic Memory - Knowledge and Facts
 * 
 * Long-term memory for general knowledge, concepts, and facts.
 * Uses vector similarity search for retrieval.
 * 
 * Cognitive analogue: Tulving's semantic memory
 * 
 * @module memory/SemanticMemory
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
import { getMetrics, recordTimed } from '../observability';
import type { ContentSanitizer } from './EpisodicMemory';

/**
 * Semantic Memory Configuration
 */
export interface SemanticMemoryConfig {
  similarityThreshold: number;
  defaultRetrievalLimit: number;
  sanitizeContent: boolean;
}

const DEFAULT_SEMANTIC_CONFIG: SemanticMemoryConfig = {
  similarityThreshold: 0.7,
  defaultRetrievalLimit: 5,
  sanitizeContent: true,
};

/**
 * Semantic Memory - Knowledge-based retrieval
 * 
 * Stores general knowledge, facts, and concepts.
 * Optimized for "what is X?" and "how does Y work?" type queries.
 */
export class SemanticMemory {
  private store: MemoryStore | null = null;
  private embeddingProvider: EmbeddingProvider | null = null;
  private sanitizer: ContentSanitizer | null = null;
  private config: SemanticMemoryConfig;
  private initialized = false;

  constructor(config?: Partial<SemanticMemoryConfig>) {
    this.config = { ...DEFAULT_SEMANTIC_CONFIG, ...config };
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
   * Add semantic memory (fact/knowledge)
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
    const entry = createMemoryEntry(finalContent, 'semantic', finalMetadata);

    // Generate embedding
    entry.embedding = await recordTimed(
      getMetrics().memoryRetrievalDuration,
      () => this.embeddingProvider!.embed(finalContent),
      { operation: 'embed', memory_type: 'semantic' }
    );

    // Store
    await this.store!.store(entry);

    getMetrics().memoryOperations.add(1, {
      operation: 'add',
      memory_type: 'semantic',
    });

    return entry;
  }

  /**
   * Search semantic memories by similarity
   */
  async search(query: string, limit?: number): Promise<RetrievalResult> {
    this.ensureInitialized();

    const searchLimit = limit ?? this.config.defaultRetrievalLimit;

    const result = await recordTimed(
      getMetrics().memoryRetrievalDuration,
      () => this.store!.retrieve(query, searchLimit),
      { operation: 'search', memory_type: 'semantic' }
    );

    // Filter by memory type
    const semanticEntries = result.entries.filter(e => e.memoryType === 'semantic');
    const semanticScores = result.scores.filter((_, i) => 
      result.entries[i].memoryType === 'semantic'
    );

    return {
      entries: semanticEntries,
      scores: semanticScores,
      metadata: { ...result.metadata, memoryType: 'semantic' },
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
   * List recent semantic memories
   */
  async listRecent(limit?: number): Promise<MemoryEntry[]> {
    this.ensureInitialized();
    const all = await this.store!.listRecent(limit ?? 10);
    return all.filter(e => e.memoryType === 'semantic');
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
        memory_type: 'semantic',
      });
    }
    
    return deleted;
  }

  /**
   * Get count
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

    const lines = ['=== Knowledge Base ==='];
    for (const entry of entries) {
      lines.push(`- ${entry.content}`);
    }
    return lines.join('\n');
  }

  /**
   * Ensure memory is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.store || !this.embeddingProvider) {
      throw new Error(
        'SemanticMemory not initialized. Call initialize() with store and embedding provider.'
      );
    }
  }
}
/**
 * Unified Memory System - Facade for Four-Tier Cognitive Memory
 * 
 * Provides unified access to:
 * - Working Memory: Recent context (in-memory buffer)
 * - Episodic Memory: Past experiences (vector store)
 * - Semantic Memory: Knowledge/facts (vector store)
 * - Core Memory: Persistent agent context (structured blocks)
 * 
 * @module memory/Memory
 * @see plans/CHRYSALIS_DEVELOPMENT_STREAMLINING_PLAN.md - Item C-2
 * 
 * Architecture Reference:
 * @see Atkinson, R.C. & Shiffrin, R.M. (1968). Human memory: A proposed system
 * @see Tulving, E. (1972). Episodic and semantic memory
 * @see Baddeley, A.D. (2000). The episodic buffer
 */

import { WorkingMemory, WorkingMemoryConfig } from './WorkingMemory';
import { CoreMemory, CoreMemoryConfig } from './CoreMemory';
import { EpisodicMemory, EpisodicMemoryConfig, ContentSanitizer } from './EpisodicMemory';
import { SemanticMemory, SemanticMemoryConfig } from './SemanticMemory';
import {
  MemoryConfig,
  MemoryStore,
  EmbeddingProvider,
  MemoryStats,
  RetrievalResult,
  DEFAULT_MEMORY_CONFIG,
} from './types';
import { logger } from '../observability';

/**
 * Unified Memory Configuration
 */
export interface UnifiedMemoryConfig {
  working?: Partial<WorkingMemoryConfig>;
  core?: Partial<CoreMemoryConfig>;
  episodic?: Partial<EpisodicMemoryConfig>;
  semantic?: Partial<SemanticMemoryConfig>;
  base?: Partial<MemoryConfig>;
}

/**
 * Unified Memory System
 * 
 * Facade providing access to all four memory tiers through a single interface.
 * Each tier follows single responsibility principle and can be used independently.
 */
export class Memory {
  readonly working: WorkingMemory;
  readonly core: CoreMemory;
  readonly episodic: EpisodicMemory;
  readonly semantic: SemanticMemory;
  
  private config: MemoryConfig;
  private initialized = false;

  constructor(config?: UnifiedMemoryConfig) {
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config?.base };
    
    // Initialize sub-memories
    this.working = new WorkingMemory(config?.working);
    this.core = new CoreMemory(config?.core);
    this.episodic = new EpisodicMemory(config?.episodic);
    this.semantic = new SemanticMemory(config?.semantic);
  }

  /**
   * Initialize vector-backed memories with storage backends
   */
  async initialize(
    store: MemoryStore,
    embeddingProvider: EmbeddingProvider,
    sanitizer?: ContentSanitizer
  ): Promise<void> {
    logger.info('Initializing unified memory system', {
      embeddingModel: this.config.embeddingModel,
      vectorStore: this.config.vectorStoreType,
    });

    await Promise.all([
      this.episodic.initialize(store, embeddingProvider, sanitizer),
      this.semantic.initialize(store, embeddingProvider, sanitizer),
    ]);

    this.initialized = true;
    logger.info('Memory system initialized');
  }

  /**
   * Check if vector memories are ready
   */
  isReady(): boolean {
    return this.initialized && this.episodic.isReady() && this.semantic.isReady();
  }

  // ==========================================================================
  // Convenience Methods (delegating to sub-memories)
  // ==========================================================================

  /**
   * Add to working memory (recent context)
   */
  addWorking(content: string, metadata?: Record<string, unknown>) {
    return this.working.add(content, metadata);
  }

  /**
   * Set core memory block
   */
  setCore(key: string, value: string): boolean {
    return this.core.set(key, value);
  }

  /**
   * Get core memory block
   */
  getCore(key: string): string | null {
    return this.core.get(key);
  }

  /**
   * Add episodic memory (experience)
   */
  async addEpisodic(content: string, metadata?: Record<string, unknown>) {
    return this.episodic.add(content, metadata);
  }

  /**
   * Add semantic memory (knowledge)
   */
  async addSemantic(content: string, metadata?: Record<string, unknown>) {
    return this.semantic.add(content, metadata);
  }

  /**
   * Search across episodic and semantic memories
   */
  async search(
    query: string, 
    memoryTypes?: ('episodic' | 'semantic')[],
    limit: number = 5
  ): Promise<RetrievalResult> {
    const types = memoryTypes ?? ['episodic', 'semantic'];
    const results: RetrievalResult[] = [];

    if (types.includes('episodic') && this.episodic.isReady()) {
      results.push(await this.episodic.search(query, limit));
    }
    
    if (types.includes('semantic') && this.semantic.isReady()) {
      results.push(await this.semantic.search(query, limit));
    }

    // Merge results
    return this.mergeResults(results, limit);
  }

  /**
   * Get full context for LLM
   */
  async getContext(query?: string, includeWorking: boolean = true): Promise<string> {
    const parts: string[] = [];

    // Core memory (always included)
    const coreContext = this.core.toContextString();
    if (coreContext) {
      parts.push(coreContext);
    }

    // Working memory
    if (includeWorking) {
      const workingContext = this.working.toContextString();
      if (workingContext) {
        parts.push(workingContext);
      }
    }

    // Retrieved memories
    if (query && this.isReady()) {
      const episodicContext = await this.episodic.toContextString(query, 3);
      if (episodicContext) {
        parts.push(episodicContext);
      }

      const semanticContext = await this.semantic.toContextString(query, 3);
      if (semanticContext) {
        parts.push(semanticContext);
      }
    }

    return parts.join('\n\n');
  }

  /**
   * Get memory statistics
   */
  async getStats(): Promise<MemoryStats> {
    const episodicCount = this.episodic.isReady() 
      ? await this.episodic.count() 
      : 0;
    const semanticCount = this.semantic.isReady() 
      ? await this.semantic.count() 
      : 0;

    return {
      workingMemorySize: this.working.size(),
      coreMemoryBlocks: this.core.size(),
      episodicCount,
      semanticCount,
      totalEntries: this.working.size() + this.core.size() + episodicCount + semanticCount,
      config: {
        embeddingModel: this.config.embeddingModel,
        vectorStoreType: this.config.vectorStoreType,
      },
    };
  }

  /**
   * Clear all memories
   */
  async clearAll(): Promise<void> {
    this.working.clear();
    this.core.clear();
    // Note: Episodic and semantic would need store.clear() method
    logger.info('Memory system cleared');
  }

  /**
   * Merge retrieval results from multiple sources
   */
  private mergeResults(results: RetrievalResult[], limit: number): RetrievalResult {
    const combined: { entry: any; score: number }[] = [];

    for (const result of results) {
      for (let i = 0; i < result.entries.length; i++) {
        combined.push({
          entry: result.entries[i],
          score: result.scores[i],
        });
      }
    }

    // Sort by score descending
    combined.sort((a, b) => b.score - a.score);

    // Take top N
    const top = combined.slice(0, limit);

    return {
      entries: top.map(t => t.entry),
      scores: top.map(t => t.score),
      metadata: { merged: true, sourceCount: results.length },
    };
  }
}
/**
 * Embedding Service v3.1
 * 
 * Provides semantic similarity via sentence embeddings.
 * Evolution from Jaccard (lexical) to cosine similarity (semantic).
 * Uses @xenova/transformers for on-device embeddings to avoid a Python
 * dependency while keeping parity with modern sentence-transformers
 * (see Xenova transformers.js, MIT licensed).
 * 
 * Status: 📋 Designed (ready for @xenova/transformers integration)
 */

/**
 * Embedding configuration
 */
export interface EmbeddingConfig {
  model: string;  // Default: 'Xenova/all-MiniLM-L6-v2'
  dimensions: number;  // Default: 384
  normalize: boolean;  // Default: true (for cosine similarity)
  pooling: 'mean' | 'max' | 'cls';  // Default: 'mean'
}

/**
 * Embedding result
 */
export interface EmbeddingResult {
  vector: number[];
  dimensions: number;
  model: string;
  normalized: boolean;
}

/**
 * Embedding Service (Base Interface)
 * 
 * Implementations:
 * - TransformerEmbeddingService (@xenova/transformers) - Future
 * - Mock embeddings disabled - transformer required
 */
export abstract class EmbeddingService {
  constructor(protected config: EmbeddingConfig) {}
  
  abstract initialize(): Promise<void>;
  abstract embed(text: string): Promise<number[]>;
  abstract isReady(): boolean;
  
  /**
   * Cosine similarity between embeddings
   */
  cosineSimilarity(emb1: number[], emb2: number[]): number {
    if (emb1.length !== emb2.length) {
      throw new Error(`Embedding dimensions mismatch: ${emb1.length} vs ${emb2.length}`);
    }
    
    // Dot product (assumes normalized vectors)
    let dot = 0;
    for (let i = 0; i < emb1.length; i++) {
      dot += emb1[i] * emb2[i];
    }
    
    return dot;  // Range: -1.0 to 1.0 (normalized vectors)
  }
  
  /**
   * Batch embed multiple texts
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    // Default implementation: Sequential
    // Subclasses can override for parallel batch processing
    return await Promise.all(texts.map(t => this.embed(t)));
  }
}

/**
 * Transformer Embedding Service (Future - requires @xenova/transformers)
 * 
 * Status: 📋 Designed, not implemented (missing dependency)
 */
export class TransformerEmbeddingService extends EmbeddingService {
  private model: any = null;
  private readonly pipelineLoader?: () => Promise<any>;
  private ready = false;
  
  constructor(config?: Partial<EmbeddingConfig>, pipelineLoader?: () => Promise<any>) {
    super({
      model: config?.model ?? 'Xenova/all-MiniLM-L6-v2',
      dimensions: config?.dimensions ?? 384,
      normalize: config?.normalize ?? true,
      pooling: config?.pooling ?? 'mean'
    });
    this.pipelineLoader = pipelineLoader;
  }
  
  async initialize(): Promise<void> {
    if (this.model) {
      this.ready = true;
      return;
    }
    
    const loader = this.pipelineLoader || (async () => {
      const mod = await import('@xenova/transformers');
      return mod.pipeline;
    });
    
    const pipeline = await loader();
    this.model = await pipeline('feature-extraction', this.config.model);
    this.ready = true;
  }
  
  async embed(text: string): Promise<number[]> {
    if (!this.model) {
      throw new Error('Model not initialized. Call initialize() first.');
    }
    
    const output = await this.model(text, {
      pooling: this.config.pooling,
      normalize: this.config.normalize
    });
    
    const vector = this.extractVector(output);
    if (this.config.normalize) {
      return this.normalizeVector(vector);
    }
    return vector;
  }
  
  isReady(): boolean {
    return this.model !== null && this.ready;
  }
  
  private extractVector(output: any): number[] {
    // transformers.js returns { data: TypedArray, dims: [...] }
    if (output?.data) {
      return Array.from(output.data as Iterable<number>);
    }
    if (Array.isArray(output)) {
      return output.flat(Infinity) as number[];
    }
    throw new Error('Unexpected transformer output format');
  }
  
  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (magnitude === 0) return vector;
    return vector.map(v => v / magnitude);
  }
}

/**
 * Factory: Create transformer embedding service
 *
 * @param config - Optional configuration overrides
 * @returns Configured EmbeddingService instance
 *
 * @example
 * const service = createEmbeddingService();
 * await service.initialize();
 *
 * @see IMPLEMENTATION_PLAN.md Phase 0.2
 * @see COMPREHENSIVE_CODE_REVIEW.md CRIT-AI-001
 */
export function createEmbeddingService(
  type: 'transformer' = 'transformer',
  config?: Partial<EmbeddingConfig>
): EmbeddingService {
  switch (type) {
    case 'transformer':
      return new TransformerEmbeddingService(config);
    
    default:
      return new TransformerEmbeddingService(config);
  }
}

/**
 * Create embedding service with strict initialization
 *
 * Throws if transformer fails to initialize.
 */
export async function createEmbeddingServiceWithFallback(
  config?: Partial<EmbeddingConfig>
): Promise<EmbeddingService> {
  const transformer = new TransformerEmbeddingService(config);
  try {
    await transformer.initialize();
    console.info('[EmbeddingService] Initialized with transformer (semantic embeddings enabled)');
    return transformer;
  } catch (error) {
    throw new Error(
      `Transformer embedding service failed to initialize - mock fallback disabled. ` +
      `Install @xenova/transformers for semantic features. Original error: ${error}`
    );
  }
}

/**
 * Similarity calculation utilities
 */
export class SimilarityMetrics {
  /**
   * Jaccard similarity (current v3.0 implementation)
   */
  static jaccard(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    if (union.size === 0) return 0;
    return intersection.size / union.size;
  }
  
  /**
   * Cosine similarity (for embeddings)
   */
  static cosine(emb1: number[], emb2: number[]): number {
    if (emb1.length !== emb2.length) {
      throw new Error('Embedding dimensions must match');
    }
    
    let dot = 0;
    for (let i = 0; i < emb1.length; i++) {
      dot += emb1[i] * emb2[i];
    }
    
    return dot;  // Assumes normalized vectors
  }
  
  /**
   * Euclidean distance (alternative metric)
   */
  static euclidean(emb1: number[], emb2: number[]): number {
    if (emb1.length !== emb2.length) {
      throw new Error('Embedding dimensions must match');
    }
    
    let sum = 0;
    for (let i = 0; i < emb1.length; i++) {
      const diff = emb1[i] - emb2[i];
      sum += diff * diff;
    }
    
    return Math.sqrt(sum);
  }
}

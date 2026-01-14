/**
 * Memory Merger v3.1 - Merge memories from instances into source agent
 * 
 * Implements intelligent memory merging with deduplication,
 * similarity detection, and conflict resolution.
 * 
 * v3.0: Jaccard similarity (lexical overlap)
 * v3.1: Configurable similarity (Jaccard or embedding-based)
 * Future: Vector indexing for O(log N) search
 */

import type { UniformSemanticAgentV2 } from '../core/UniformSemanticAgentV2';
import { VoyeurEventKind, VoyeurSink } from '../observability/VoyeurEvents';
import { logger } from '../observability';
import type { SanitizeResult } from './MemorySanitizer';
import * as crypto from 'crypto';
import { BruteForceVectorIndex, type VectorIndex } from '../memory/VectorIndex';
import { createVectorIndex } from '../memory/VectorIndexFactory';
import { createMetricsSinkFromEnv, type MetricsSink } from '../observability/Metrics';

/**
 * Memory merger configuration
 */
export interface MemoryMergerConfig {
  similarity_method: 'jaccard' | 'embedding';
  similarity_threshold: number;  // Default: 0.9
  embedding_service?: any;  // EmbeddingService (optional)
  use_vector_index: boolean;  // Default: false (v3.2+)
  vector_index?: VectorIndex;  // VectorIndex (optional, v3.2+)
  vector_index_type?: 'hnsw' | 'lance' | 'brute'; // Preferred backend (qdrant deprecated)
  vector_index_options?: Record<string, any>; // Backend options (collection, host, etc.)
  voyeur?: VoyeurSink;  // Optional observer for “voyeur” mode
  slow_mode_ms?: number;  // Optional artificial delay for human-speed playback
  metrics?: (event: { kind: 'vector.upsert' | 'vector.query'; backend: string; latencyMs: number; size?: number }) => void;
  metrics_sink?: MetricsSink;
  sanitize?: (content: string, sourceInstance: string) => { ok: boolean; content: string; reason?: string };
  rate_limit?: { windowMs: number; max: number };
}

/**
 * Memory structure
 */
export interface Memory {
  memory_id: string;
  content: string;
  embedding?: number[];
  confidence: number;
  source_instances: string[];
  created: string;
  accessed_count: number;
  last_accessed: string;
  tags: string[];
  related_memories: string[];
  importance: number;
}

/**
 * Input data for memory creation (relaxed typing for external data).
 * Either `content` or `text` should be provided.
 */
export interface MemoryInput {
  content?: string;
  text?: string;
  embedding?: number[];
  confidence?: number;
  tags?: string[];
  importance?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Memory merge result
 */
export interface MemoryMergeResult {
  added: number;
  updated: number;
  deduplicated: number;
  conflicts: number;
}

interface DuplicateMatch {
  memory: Memory;
  similarity: number;
}

/**
 * Memory Merger v3.1
 */
export class MemoryMerger {
  private memoryIndex: Map<string, Memory> = new Map();
  private config: MemoryMergerConfig;
  private voyeur?: VoyeurSink;
  private slowModeMs: number;
  private vectorIndex?: VectorIndex;
  private metricsSink?: MetricsSink;
  private rateBuckets: Map<string, { count: number; windowStart: number }> = new Map();
  
  constructor(config?: Partial<MemoryMergerConfig>) {
    // Default: v3.0 behavior (Jaccard)
    this.config = {
      similarity_method: config?.similarity_method ?? 'jaccard',
      similarity_threshold: config?.similarity_threshold ?? 0.9,
      embedding_service: config?.embedding_service,
      use_vector_index: config?.use_vector_index ?? false,
      vector_index: config?.vector_index,
      vector_index_type: config?.vector_index_type ?? 'hnsw',
      voyeur: config?.voyeur,
      slow_mode_ms: config?.slow_mode_ms ?? 0,
      metrics: config?.metrics,
      metrics_sink: config?.metrics_sink,
      sanitize: config?.sanitize,
      rate_limit: config?.rate_limit
    };
    this.voyeur = this.config.voyeur;
    this.slowModeMs = this.config.slow_mode_ms ?? 0;
    this.vectorIndex = this.config.vector_index;
    this.metricsSink = this.config.metrics_sink || createMetricsSinkFromEnv() || undefined;
  }
  
  /**
   * Initialize (for embedding-based mode)
   */
  async initialize(): Promise<void> {
    if (this.config.similarity_method === 'embedding') {
      if (!this.config.embedding_service) {
        throw new Error(
          'Embedding service required for embedding-based similarity. ' +
          'Provide embedding_service in config or use similarity_method: "jaccard"'
        );
      }
      
      if (!this.config.embedding_service.isReady()) {
        await this.config.embedding_service.initialize();
      }
    }

    if (this.config.use_vector_index && !this.vectorIndex) {
      this.vectorIndex = await createVectorIndex(
        this.config.vector_index_type,
        this.config.embedding_service?.config?.dimensions,
        this.config.vector_index_options
      );
    }
  }
  
  /**
   * Add single memory
   */
  async addMemory(
    agent: UniformSemanticAgentV2,
    memoryData: MemoryInput,
    sourceInstance: string
  ): Promise<void> {
    if (this.config.rate_limit) {
      const now = Date.now();
      const bucket = this.rateBuckets.get(sourceInstance) || { count: 0, windowStart: now };
      if (now - bucket.windowStart > this.config.rate_limit.windowMs) {
        bucket.count = 0;
        bucket.windowStart = now;
      }
      bucket.count += 1;
      this.rateBuckets.set(sourceInstance, bucket);
      if (bucket.count > this.config.rate_limit.max) {
        await this.emitVoyeur('ingest.blocked', {
          sourceInstance,
          decision: 'rate_limited'
        });
        return;
      }
    }

    const rawContent = memoryData.content || memoryData.text || '';
    const sanitized: SanitizeResult = this.config.sanitize
      ? this.config.sanitize(rawContent, sourceInstance)
      : { ok: true, content: rawContent };
    if (!sanitized.ok) {
      await this.emitVoyeur('ingest.blocked', {
        sourceInstance,
        memoryHash: this.hashContent(rawContent),
        decision: 'blocked',
        reason: sanitized.reason
      });
      return;
    }

    // Check for PII in content if sanitizer didn't block it but flagged it
    if (sanitized.piiDetected && sanitized.piiDetected.length > 0) {
        await this.emitVoyeur('ingest.pii_detected', {
            sourceInstance,
            memoryHash: this.hashContent(rawContent),
            piiTypes: sanitized.piiDetected
        });
    }

    const memory: Memory = {
      memory_id: crypto.randomUUID(),
      content: sanitized.content,
      embedding: memoryData.embedding,
      confidence: memoryData.confidence || 0.8,
      source_instances: [sourceInstance],
      created: new Date().toISOString(),
      accessed_count: 0,
      last_accessed: new Date().toISOString(),
      tags: memoryData.tags || [],
      related_memories: [],
      importance: memoryData.importance || 0.5
    };

    if (this.config.similarity_method === 'embedding' && this.config.embedding_service) {
      memory.embedding = memory.embedding || await this.config.embedding_service.embed(memory.content);
    }
    
    // Initialize episodic memory if not exists
    if (!agent.memory.collections) {
      agent.memory.collections = {};
    }
    if (!agent.memory.collections.episodic) {
      agent.memory.collections.episodic = [];
    }
    
    // Store memory (simplified - would use vector DB in production)
    this.memoryIndex.set(memory.memory_id, memory);

    if (this.config.use_vector_index && this.vectorIndex && memory.embedding) {
      const start = Date.now();
      await this.vectorIndex.upsert(memory.memory_id, memory.embedding);
      this.recordMetric('vector.upsert', Date.now() - start);
    }
    
    logger.debug('Memory added', { 
      memory_id: memory.memory_id, 
      content_preview: memory.content.substring(0, 50),
      source: sourceInstance 
    });
  }
  
  /**
   * Merge batch of memories
   */
  async mergeBatch(
    agent: UniformSemanticAgentV2,
    memories: MemoryInput[],
    sourceInstance: string
  ): Promise<MemoryMergeResult> {
    const result: MemoryMergeResult = {
      added: 0,
      updated: 0,
      deduplicated: 0,
      conflicts: 0
    };
    
    for (const memoryData of memories) {
      const content = memoryData.content || memoryData.text || '';
      await this.emitVoyeur('ingest.start', {
        sourceInstance,
        memoryHash: this.hashContent(content),
        decision: 'pending'
      });
      
      // Check for duplicates
      const duplicate = await this.findDuplicate(memoryData);
      
      if (duplicate) {
        await this.emitVoyeur('match.candidate', {
          sourceInstance,
          memoryHash: this.hashContent(content),
          similarity: duplicate.similarity,
          threshold: this.config.similarity_threshold,
          decision: 'merge'
        });
        // Merge with existing - this updates the memory
        await this.mergeWithExisting(duplicate.memory, memoryData, sourceInstance);
        result.deduplicated++;
        result.updated++;  // Track that we updated an existing memory
        await this.emitVoyeur('merge.applied', {
          sourceInstance,
          memoryHash: this.hashContent(content),
          similarity: duplicate.similarity,
          decision: 'deduplicated'
        });
      } else {
        // Add as new
        await this.addMemory(agent, memoryData, sourceInstance);
        result.added++;
        await this.emitVoyeur('match.none', {
          sourceInstance,
          memoryHash: this.hashContent(content),
          threshold: this.config.similarity_threshold,
          decision: 'added'
        });
      }
    }
    
    return result;
  }
  
  /**
   * Find duplicate memory
   * 
   * v3.0: Linear scan with Jaccard (O(N))
   * v3.1: Linear scan with embeddings (O(N))
   * v3.2: Vector index search (O(log N))
   */
  private async findDuplicate(memoryData: MemoryInput): Promise<DuplicateMatch | null> {
    // Future v3.2: Vector index path
    if (this.config.use_vector_index && this.vectorIndex) {
      // Fast ANN search O(log N)
      const embedding = memoryData.embedding
        || (this.config.embedding_service
          ? await this.config.embedding_service.embed(memoryData.content)
          : undefined);
      if (!embedding) {
        throw new Error('Vector index requested but embedding missing');
      }
      const start = Date.now();
      const similar = await this.vectorIndex.findSimilar(
        embedding,
        1,  // Top 1
        this.config.similarity_threshold
      );
      this.recordMetric('vector.query', Date.now() - start);
      const match = similar[0];
      if (match) {
        const memory = this.memoryIndex.get(match.id);
        if (memory) {
          return { memory, similarity: match.score };
        }
      }
      return null;
    }
    
    // Current: Linear scan O(N)
    const searchContent = memoryData.content || memoryData.text || '';
    for (const [, memory] of this.memoryIndex) {
      const similarity = await this.calculateSimilarity(memory.content, searchContent);
      if (similarity > this.config.similarity_threshold) {
        return { memory, similarity };
      }
    }
    
    return null;
  }
  
  /**
   * Merge with existing memory
   */
  private async mergeWithExisting(
    existing: Memory,
    newData: MemoryInput,
    sourceInstance: string
  ): Promise<void> {
    // Update confidence (weighted average)
    const weight = 0.7;  // Weight new data higher
    existing.confidence = existing.confidence * (1 - weight) + (newData.confidence || 0.8) * weight;
    
    // Update access info
    existing.accessed_count++;
    existing.last_accessed = new Date().toISOString();
    
    // Add source instance if not already present
    if (!existing.source_instances.includes(sourceInstance)) {
      existing.source_instances.push(sourceInstance);
    }
    
    logger.debug('Memory merged with existing', { 
      memory_id: existing.memory_id, 
      content_preview: existing.content.substring(0, 50),
      source: sourceInstance,
      source_count: existing.source_instances.length
    });
  }
  
  /**
   * Calculate similarity between two texts
   * 
   * v3.0: Jaccard (lexical)
   * v3.1: Configurable (Jaccard or embedding)
   */
  private async calculateSimilarity(text1: string, text2: string): Promise<number> {
    if (this.config.similarity_method === 'jaccard') {
      return this.jaccardSimilarity(text1, text2);
    } else {
      return await this.embeddingSimilarity(text1, text2);
    }
  }
  
  /**
   * Jaccard similarity (v3.0 - lexical overlap)
   */
  private jaccardSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    if (union.size === 0) return 0;
    return intersection.size / union.size;
  }
  
  /**
   * Embedding similarity (v3.1 - semantic)
   */
  private async embeddingSimilarity(text1: string, text2: string): Promise<number> {
    if (!this.config.embedding_service) {
      throw new Error('Embedding service not configured');
    }
    
    const [emb1, emb2] = await Promise.all([
      this.config.embedding_service.embed(text1),
      this.config.embedding_service.embed(text2)
    ]);
    
    return this.cosineSimilarity(emb1, emb2);
  }
  
  /**
   * Cosine similarity for embeddings
   */
  private cosineSimilarity(emb1: number[], emb2: number[]): number {
    let dot = 0;
    for (let i = 0; i < emb1.length; i++) {
      dot += emb1[i] * emb2[i];
    }
    return dot;  // Assumes normalized
  }
  
  /**
   * Get configuration summary
   */
  getConfig(): MemoryMergerConfig {
    return { ...this.config };
  }

  private async emitVoyeur(kind: VoyeurEventKind | string, details?: Record<string, any>): Promise<void> {
    if (!this.voyeur) return;
    await this.voyeur.emit({
      kind,
      timestamp: new Date().toISOString(),
      ...details
    });
    if (this.slowModeMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.slowModeMs));
    }
  }

  private hashContent(content: string): string {
    return crypto.createHash('sha384').update(content || '').digest('hex');
  }

  private recordMetric(kind: 'vector.upsert' | 'vector.query', latencyMs: number): void {
    const payload = {
      kind,
      backend: this.config.vector_index_type || 'unknown',
      latencyMs,
      size: this.vectorIndex?.size()
    };
    if (this.config.metrics) {
      this.config.metrics(payload);
    }
    if (this.metricsSink) {
      this.metricsSink.recordVectorOp(payload);
    }
  }
}

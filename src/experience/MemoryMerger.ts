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

import type { UniversalAgentV2 } from '../core/UniversalAgentV2';
import * as crypto from 'crypto';

/**
 * Memory merger configuration
 */
export interface MemoryMergerConfig {
  similarity_method: 'jaccard' | 'embedding';
  similarity_threshold: number;  // Default: 0.9
  embedding_service?: any;  // EmbeddingService (optional)
  use_vector_index: boolean;  // Default: false (v3.2+)
  vector_index?: any;  // VectorIndex (optional, v3.2+)
}

/**
 * Memory structure
 */
export interface Memory {
  memory_id: string;
  content: string;
  embedding?: number[];
  confidence: number;
  source_instance: string;
  created: string;
  accessed_count: number;
  last_accessed: string;
  tags: string[];
  related_memories: string[];
  importance: number;
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

/**
 * Memory Merger v3.1
 */
export class MemoryMerger {
  private memoryIndex: Map<string, Memory> = new Map();
  private config: MemoryMergerConfig;
  
  constructor(config?: Partial<MemoryMergerConfig>) {
    // Default: v3.0 behavior (Jaccard)
    this.config = {
      similarity_method: config?.similarity_method ?? 'jaccard',
      similarity_threshold: config?.similarity_threshold ?? 0.9,
      embedding_service: config?.embedding_service,
      use_vector_index: config?.use_vector_index ?? false,
      vector_index: config?.vector_index
    };
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
    
    if (this.config.use_vector_index && !this.config.vector_index) {
      throw new Error('Vector index required when use_vector_index is true');
    }
  }
  
  /**
   * Add single memory
   */
  async addMemory(
    agent: UniversalAgentV2,
    memoryData: any,
    sourceInstance: string
  ): Promise<void> {
    const memory: Memory = {
      memory_id: crypto.randomUUID(),
      content: memoryData.content || memoryData.text || '',
      embedding: memoryData.embedding,
      confidence: memoryData.confidence || 0.8,
      source_instance: sourceInstance,
      created: new Date().toISOString(),
      accessed_count: 0,
      last_accessed: new Date().toISOString(),
      tags: memoryData.tags || [],
      related_memories: [],
      importance: memoryData.importance || 0.5
    };
    
    // Initialize episodic memory if not exists
    if (!agent.memory.collections) {
      agent.memory.collections = {};
    }
    if (!agent.memory.collections.episodic) {
      agent.memory.collections.episodic = [];
    }
    
    // Store memory (simplified - would use vector DB in production)
    this.memoryIndex.set(memory.memory_id, memory);
    
    console.log(`  → Memory added: "${memory.content.substring(0, 50)}..."`);
  }
  
  /**
   * Merge batch of memories
   */
  async mergeBatch(
    agent: UniversalAgentV2,
    memories: any[],
    sourceInstance: string
  ): Promise<MemoryMergeResult> {
    const result: MemoryMergeResult = {
      added: 0,
      updated: 0,
      deduplicated: 0,
      conflicts: 0
    };
    
    for (const memoryData of memories) {
      // Check for duplicates
      const duplicate = await this.findDuplicate(memoryData);
      
      if (duplicate) {
        // Merge with existing
        await this.mergeWithExisting(duplicate, memoryData, sourceInstance);
        result.deduplicated++;
      } else {
        // Add as new
        await this.addMemory(agent, memoryData, sourceInstance);
        result.added++;
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
  private async findDuplicate(memoryData: any): Promise<Memory | null> {
    // Future v3.2: Vector index path
    if (this.config.use_vector_index && this.config.vector_index) {
      // Fast ANN search O(log N)
      const embedding = await this.config.embedding_service.embed(memoryData.content);
      const similar = await this.config.vector_index.findSimilar(
        embedding,
        1,  // Top 1
        this.config.similarity_threshold
      );
      return similar[0] || null;
    }
    
    // Current: Linear scan O(N)
    for (const [, memory] of this.memoryIndex) {
      const similarity = await this.calculateSimilarity(memory.content, memoryData.content);
      if (similarity > this.config.similarity_threshold) {
        return memory;
      }
    }
    
    return null;
  }
  
  /**
   * Merge with existing memory
   */
  private async mergeWithExisting(
    existing: Memory,
    newData: any,
    sourceInstance: string
  ): Promise<void> {
    // Update confidence (weighted average)
    const weight = 0.7;  // Weight new data higher
    existing.confidence = existing.confidence * (1 - weight) + (newData.confidence || 0.8) * weight;
    
    // Update access info
    existing.accessed_count++;
    existing.last_accessed = new Date().toISOString();
    
    // Add source instance
    if (!existing.source_instance.includes(sourceInstance)) {
      existing.source_instance = `${existing.source_instance},${sourceInstance}`;
    }
    
    console.log(`  → Memory merged: "${existing.content.substring(0, 50)}..."`);
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
}

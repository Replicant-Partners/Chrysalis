/**
 * Agent Memory Component
 * 
 * Manages memory architecture including episodic, semantic, and working memory.
 * 
 * Single Responsibility: Memory storage and retrieval configuration
 */

import { Episode, Concept } from '../UniformSemanticAgentV2';

/**
 * Memory collection configuration
 */
export interface MemoryCollections {
  short_term?: {
    retention: string;
    max_size: number;
  };
  long_term?: {
    storage: 'vector' | 'graph';
    embedding_model: string;
  };
  episodic?: Episode[];
  semantic?: Concept[];
}

/**
 * Memory data structure
 */
export interface AgentMemoryData {
  type: 'vector' | 'graph' | 'hybrid';
  provider: string;
  settings: Record<string, unknown>;
  collections?: MemoryCollections;
}

/**
 * Memory query options
 */
export interface MemoryQueryOptions {
  collection?: 'short_term' | 'long_term' | 'episodic' | 'semantic';
  limit?: number;
  minRelevance?: number;
}

/**
 * Agent Memory Manager
 */
export class AgentMemory {
  private data: AgentMemoryData;

  constructor(data?: Partial<AgentMemoryData>) {
    this.data = {
      type: data?.type || 'vector',
      provider: data?.provider || 'local',
      settings: data?.settings || {},
      collections: data?.collections || {
        short_term: { retention: '1h', max_size: 100 },
        long_term: { storage: 'vector', embedding_model: 'text-embedding-3-small' },
        episodic: [],
        semantic: [],
      },
    };
  }

  /**
   * Add an episode to episodic memory
   */
  addEpisode(episode: Episode): void {
    if (!this.data.collections) {
      this.data.collections = { episodic: [] };
    }
    if (!this.data.collections.episodic) {
      this.data.collections.episodic = [];
    }
    // Ensure episode has an ID
    if (!episode.episode_id) {
      episode.episode_id = crypto.randomUUID();
    }
    this.data.collections.episodic.push(episode);
  }

  /**
   * Get recent episodes
   */
  getRecentEpisodes(limit: number = 10): Episode[] {
    const episodes = this.data.collections?.episodic || [];
    return episodes
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * Add a concept to semantic memory
   */
  addConcept(concept: Concept): void {
    if (!this.data.collections) {
      this.data.collections = { semantic: [] };
    }
    if (!this.data.collections.semantic) {
      this.data.collections.semantic = [];
    }
    
    const existing = this.data.collections.semantic.findIndex(
      c => c.concept_id === concept.concept_id
    );
    
    if (existing !== -1) {
      // Update existing concept
      this.data.collections.semantic[existing] = {
        ...this.data.collections.semantic[existing],
        ...concept,
        usage_count: this.data.collections.semantic[existing].usage_count + 1,
        last_used: new Date().toISOString(),
      };
    } else {
      this.data.collections.semantic.push(concept);
    }
  }

  /**
   * Get concept by ID
   */
  getConcept(conceptId: string): Concept | undefined {
    return this.data.collections?.semantic?.find(c => c.concept_id === conceptId);
  }

  /**
   * Get related concepts
   */
  getRelatedConcepts(conceptId: string): Concept[] {
    const concept = this.getConcept(conceptId);
    if (!concept) return [];

    return concept.related_concepts
      .map(id => this.getConcept(id))
      .filter((c): c is Concept => c !== undefined);
  }

  /**
   * Get memory statistics
   */
  getStatistics(): {
    type: string;
    provider: string;
    episodeCount: number;
    conceptCount: number;
    shortTermSize: number;
  } {
    return {
      type: this.data.type,
      provider: this.data.provider,
      episodeCount: this.data.collections?.episodic?.length || 0,
      conceptCount: this.data.collections?.semantic?.length || 0,
      shortTermSize: this.data.collections?.short_term?.max_size || 0,
    };
  }

  // Getters
  get type(): AgentMemoryData['type'] { return this.data.type; }
  get provider(): string { return this.data.provider; }
  get settings(): Record<string, unknown> { return this.data.settings; }
  get collections(): MemoryCollections | undefined { return this.data.collections; }

  toData(): AgentMemoryData {
    return { ...this.data };
  }

  merge(other: AgentMemory): void {
    // Merge episodes
    other.data.collections?.episodic?.forEach(e => this.addEpisode(e));
    // Merge concepts
    other.data.collections?.semantic?.forEach(c => this.addConcept(c));
  }
}

export function validateMemory(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Memory must be an object'] };
  }
  const memory = data as Record<string, unknown>;
  if (!memory.type) errors.push('Memory must have type');
  if (!memory.provider) errors.push('Memory must have provider');
  return { valid: errors.length === 0, errors };
}

/**
 * Agent Knowledge Component
 * 
 * Manages facts, expertise, and accumulated knowledge.
 * Knowledge grows through experience and verification.
 * 
 * Single Responsibility: Knowledge management and verification
 */

/**
 * Accumulated knowledge item
 */
export interface AccumulatedKnowledge {
  knowledge_id: string;
  content: string;
  confidence: number;
  source_instance: string;
  acquired: string;
  verification_count: number;
  category?: string;
  tags?: string[];
}

/**
 * Knowledge data structure
 */
export interface AgentKnowledgeData {
  facts: string[];
  topics: string[];
  expertise: string[];
  sources?: unknown[];
  lore?: string[];
  accumulated_knowledge?: AccumulatedKnowledge[];
}

/**
 * Knowledge query options
 */
export interface KnowledgeQueryOptions {
  category?: string;
  minConfidence?: number;
  tags?: string[];
  limit?: number;
}

/**
 * Agent Knowledge Manager
 */
export class AgentKnowledge {
  private data: AgentKnowledgeData;

  constructor(data?: Partial<AgentKnowledgeData>) {
    this.data = {
      facts: data?.facts || [],
      topics: data?.topics || [],
      expertise: data?.expertise || [],
      sources: data?.sources,
      lore: data?.lore,
      accumulated_knowledge: data?.accumulated_knowledge || [],
    };
  }

  addFact(fact: string): void {
    if (!this.data.facts.includes(fact)) {
      this.data.facts.push(fact);
    }
  }

  addTopic(topic: string): void {
    if (!this.data.topics.includes(topic)) {
      this.data.topics.push(topic);
    }
  }

  addExpertise(expertise: string): void {
    if (!this.data.expertise.includes(expertise)) {
      this.data.expertise.push(expertise);
    }
  }

  hasExpertise(topic: string): boolean {
    const topicLower = topic.toLowerCase();
    return this.data.expertise.some(e => e.toLowerCase().includes(topicLower)) ||
           this.data.topics.some(t => t.toLowerCase().includes(topicLower));
  }

  addAccumulatedKnowledge(knowledge: Omit<AccumulatedKnowledge, 'knowledge_id' | 'acquired' | 'verification_count'>): AccumulatedKnowledge {
    if (!this.data.accumulated_knowledge) {
      this.data.accumulated_knowledge = [];
    }

    const existing = this.data.accumulated_knowledge.find(k => 
      k.content.toLowerCase() === knowledge.content.toLowerCase()
    );

    if (existing) {
      existing.verification_count++;
      existing.confidence = Math.min(1, existing.confidence + 0.1);
      return existing;
    }

    const newKnowledge: AccumulatedKnowledge = {
      knowledge_id: `know-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      content: knowledge.content,
      confidence: knowledge.confidence,
      source_instance: knowledge.source_instance,
      acquired: new Date().toISOString(),
      verification_count: 1,
      category: knowledge.category,
      tags: knowledge.tags,
    };

    this.data.accumulated_knowledge.push(newKnowledge);
    return newKnowledge;
  }

  queryKnowledge(options: KnowledgeQueryOptions = {}): AccumulatedKnowledge[] {
    let results = this.data.accumulated_knowledge || [];

    if (options.category) {
      results = results.filter(k => k.category === options.category);
    }

    if (options.minConfidence !== undefined) {
      results = results.filter(k => k.confidence >= options.minConfidence!);
    }

    results.sort((a, b) => b.confidence - a.confidence);

    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  get facts(): readonly string[] { return this.data.facts; }
  get topics(): readonly string[] { return this.data.topics; }
  get expertise(): readonly string[] { return this.data.expertise; }
  get accumulatedKnowledge(): readonly AccumulatedKnowledge[] { 
    return this.data.accumulated_knowledge || []; 
  }

  toData(): AgentKnowledgeData {
    return { ...this.data };
  }

  merge(other: AgentKnowledge): void {
    other.data.facts.forEach(f => this.addFact(f));
    other.data.topics.forEach(t => this.addTopic(t));
    other.data.expertise.forEach(e => this.addExpertise(e));
  }
}

export function validateKnowledge(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Knowledge must be an object'] };
  }
  const knowledge = data as Record<string, unknown>;
  if (!Array.isArray(knowledge.facts)) errors.push('Knowledge must have facts array');
  if (!Array.isArray(knowledge.topics)) errors.push('Knowledge must have topics array');
  if (!Array.isArray(knowledge.expertise)) errors.push('Knowledge must have expertise array');
  return { valid: errors.length === 0, errors };
}

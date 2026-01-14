/**
 * AgentMemoryAdapter (lean in-memory tiered memory)
 * Replaces the old MemU adapter naming with a lightweight implementation.
 */

import { createHash } from 'crypto';
import {
  Memory,
  WorkingMemory,
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory,
  MemoryConfig,
  MemoryState,
  MemoryTier,
  MemoryType,
  MemorySource,
  MemoryFingerprint,
  LogicalTime,
  MemoryCausality,
  CRDTMetadata,
  GossipMetadata,
  ByzantineValidation,
  ConvergenceMetadata,
  RetrievalResult,
  MemoryEvent,
  MemoryEventHandler,
  MemoryEventType,
  DEFAULT_MEMORY_CONFIG
} from './types';

interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

class MockEmbeddingProvider implements EmbeddingProvider {
  private dimensions: number;
  constructor(dimensions: number = 768) {
    this.dimensions = dimensions;
  }
  async embed(text: string): Promise<number[]> {
    const hash = createHash('sha256').update(text).digest();
    const embedding: number[] = [];
    for (let i = 0; i < this.dimensions; i++) {
      embedding.push((hash[i % hash.length] / 255) * 2 - 1);
    }
    return embedding;
  }
  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(t => this.embed(t)));
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

export class AgentMemoryAdapter {
  private config: MemoryConfig;
  private state: MemoryState;
  private embeddingProvider: EmbeddingProvider;
  private eventHandlers: Map<MemoryEventType, MemoryEventHandler[]> = new Map();
  private instanceIndex: number = 0;

  constructor(
    agentId: string,
    config?: Partial<MemoryConfig>,
    embeddingProvider?: EmbeddingProvider
  ) {
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
    const instanceId = `${agentId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.state = {
      instanceId,
      agentId,
      workingMemories: [],
      episodicMemories: [],
      semanticMemories: [],
      proceduralMemories: [],
      lamportClock: 0,
      vectorClock: [],
      createdAt: Date.now(),
      lastSync: Date.now(),
      totalMemories: 0
    };
    this.embeddingProvider = embeddingProvider || new MockEmbeddingProvider();
  }

  private incrementClock(): LogicalTime {
    this.state.lamportClock += 1;
    return { lamport: this.state.lamportClock };
  }

  private fingerprint(content: string): MemoryFingerprint {
    const hash = createHash('sha384').update(content).digest('hex');
    return {
      hash: hash,
      fingerprint: hash,
      algorithm: 'sha384',
      contentHash: hash,
      metadataHash: hash
    };
  }

  private emitEvent(event: MemoryEvent) {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach(handler => handler(event));
    }
  }

  on(eventType: MemoryEventType, handler: MemoryEventHandler): () => void {
    const handlers = this.eventHandlers.get(eventType) || [];
    handlers.push(handler);
    this.eventHandlers.set(eventType, handlers);
    return () => {
      const updated = (this.eventHandlers.get(eventType) || []).filter(h => h !== handler);
      this.eventHandlers.set(eventType, updated);
    };
  }

  private generateId(prefix: string): string {
    this.instanceIndex += 1;
    return `${prefix}-${this.instanceIndex}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  // Working memory
  addWorkingMemory(content: string, opts?: any, source: MemorySource = 'user'): WorkingMemory {
    const importance = typeof opts === 'number' ? opts : opts?.importance ?? 0.5;
    const base = this.baseMemory('working', content, importance, source);
    const memory: WorkingMemory = {
      ...base,
      tier: 'working',
      expiresAt: Date.now() + (this.config.workingMemoryTTL ?? 3600000)
    };
    this.state.workingMemories.push(memory);
    this.state.totalMemories += 1;
    this.emitEvent(this.memoryEvent(memory));
    return memory;
  }

  addEpisodicMemory(content: string, opts?: any, source: MemorySource = 'user'): EpisodicMemory {
    const importance = typeof opts === 'number' ? opts : opts?.importance ?? 0.5;
    const base = this.baseMemory('episodic', content, importance, source);
    const memory: EpisodicMemory = {
      ...base,
      tier: 'episodic',
      summary: content.slice(0, 200),
      crdt: this.createCRDTMetadata(),
      gossip: this.createGossipMetadata(),
      validation: this.createByzantineMetadata()
    };
    this.state.episodicMemories.push(memory);
    this.state.totalMemories += 1;
    this.emitEvent(this.memoryEvent(memory));
    return memory;
  }

  addSemanticMemory(content: string, opts?: any, source: MemorySource = 'user'): SemanticMemory {
    const importance = typeof opts === 'number' ? opts : opts?.importance ?? 0.5;
    const base = this.baseMemory('semantic', content, importance, source);
    const memory: SemanticMemory = {
      ...base,
      tier: 'semantic',
      fact: content,
      alternatePhrasings: [],
      evidence: [],
      convergence: this.createConvergenceMetadata(),
      validation: this.createByzantineMetadata(),
      verificationCount: 0,
      confidence: 0.5
    };
    this.state.semanticMemories.push(memory);
    this.state.totalMemories += 1;
    this.emitEvent(this.memoryEvent(memory));
    return memory;
  }

  addProceduralMemory(content: string, opts?: any, source: MemorySource = 'user'): ProceduralMemory {
    const importance = typeof opts === 'number' ? opts : opts?.importance ?? 0.5;
    const base = this.baseMemory('procedural', content, importance, source);
    const memory: ProceduralMemory = {
      ...base,
      tier: 'procedural',
      skillName: content.slice(0, 32),
      description: content,
      steps: [],
      preconditions: [],
      postconditions: [],
      parameters: {},
      examples: [],
      executionStats: { totalRuns: 0, successes: 0, failures: 0, avgDuration: 0 }
    };
    this.state.proceduralMemories.push(memory);
    this.state.totalMemories += 1;
    this.emitEvent(this.memoryEvent(memory));
    return memory;
  }

  async searchSemantic(query: string, limit = 5): Promise<any> {
    const queryEmbedding = await this.embeddingProvider.embed(query);
    const results = this.state.semanticMemories
      .map(mem => ({
        memory: mem,
        score: mem.embedding && mem.embedding.length > 0
          ? cosineSimilarity(mem.embedding, queryEmbedding)
          : 0
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return { memories: results.map(r => r.memory), scores: results.map(r => r.score), metadata: {} };
  }

  async embedMemory(memoryId: string): Promise<void> {
    const memory = this.state.semanticMemories.find(m => (m as any).memoryId === memoryId);
    if (!memory) return;
    (memory as any).embedding = await this.embeddingProvider.embed(memory.content);
  }

  getWorkingMemories(): WorkingMemory[] {
    return [...this.state.workingMemories];
  }

  getEpisodicMemories(): EpisodicMemory[] {
    return [...this.state.episodicMemories];
  }

  getSemanticMemories(): SemanticMemory[] {
    return [...this.state.semanticMemories];
  }

  getStats() {
    return {
      working: this.state.workingMemories.length,
      episodic: this.state.episodicMemories.length,
      semantic: this.state.semanticMemories.length,
      procedural: this.state.proceduralMemories.length,
      lamportClock: this.state.lamportClock,
      vectorClock: this.state.vectorClock,
      createdAt: this.state.createdAt,
      lastSync: this.state.lastSync,
      total: this.state.totalMemories
    };
  }

  private createCRDTMetadata(): CRDTMetadata {
    return {
      crdtType: 'g-set',
      addedBy: [this.state.instanceId],
      firstAdded: Date.now(),
      lastModified: Date.now(),
      version: this.incrementClock()
    };
  }

  private createGossipMetadata(): GossipMetadata {
    return {
      originInstance: this.state.instanceId,
      seenBy: [],
      fanout: 0,
      propagationRound: 0,
      lastGossip: Date.now()
    };
  }

  private createByzantineMetadata(): ByzantineValidation {
    return {
      verifiedBy: [],
      confidenceScores: [],
      trimmedMean: 0,
      median: 0,
      threshold: false,
      requiredVotes: 0
    };
  }

  private createConvergenceMetadata(): ConvergenceMetadata {
    return {
      sources: [],
      iterations: 0,
      converged: false,
      canonicalForm: '',
      similarityThreshold: 0.5
    };
  }

  // Compatibility shims (no-op/empty) to satisfy existing callers
  async searchEpisodic(query: string, limit = 5): Promise<{ memories: EpisodicMemory[]; scores: number[] }> {
    return { memories: this.state.episodicMemories.slice(0, limit), scores: [] };
  }

  async searchSkills(query: string, limit = 5): Promise<{ memories: ProceduralMemory[]; scores: number[] }> {
    return { memories: this.state.proceduralMemories.slice(0, limit), scores: [] };
  }

  async search(query: string, limit = 5): Promise<{ memories: Memory[]; scores: number[] }> {
    const semantic = await this.searchSemantic(query, limit);
    return { memories: semantic.memories, scores: semantic.scores };
  }

  assembleContext(messages: string[]): string {
    return messages.join('\n');
  }

  clearWorkingMemory(): void {
    this.state.workingMemories = [];
  }

  recordSkillExecution(skillId: string): void {
    // Record skill execution for analytics and learning
    const skill = this.getSkill(skillId);
    if (skill) {
      // Increment execution count (part of ProceduralMemory interface)
      skill.executionCount = (skill.executionCount || 0) + 1;
      // Track last access time in metadata
      if (!skill.metadata) {
        skill.metadata = {};
      }
      skill.metadata.lastExecutedAt = new Date().toISOString();
    }
  }

  learnSkill(data: any): ProceduralMemory {
    return this.addProceduralMemory(typeof data === 'string' ? data : JSON.stringify(data));
  }

  getSkill(skillId: string): ProceduralMemory | undefined {
    return this.state.proceduralMemories.find(m => m.memoryId === skillId || m.skillName === skillId);
  }

  private baseMemory(tier: MemoryTier, content: string, importance: number, source: MemorySource): any {
    const now = Date.now();
    const memoryId = this.generateId(tier);
    return {
      memoryId,
      fingerprint: this.fingerprint(content),
      content,
      memoryType: 'conversation' as MemoryType,
      source,
      tier,
      importance,
      instanceId: this.state.instanceId,
      logicalTime: {
        lamportTime: this.incrementClock(),
        vectorTime: [this.state.lamportClock],
        wallTime: now,
        instanceId: this.state.instanceId
      },
      causality: { parentMemories: [], childMemories: [], relatedMemories: [] },
      embedding: [],
      summary: content.slice(0, 200)
    };
  }

  private memoryEvent(memory: Memory): MemoryEvent {
    return {
      type: 'memory:added',
      memoryId: memory.id,
      tier: memory.tier || 'working',
      memory,
      timestamp: Date.now(),
      instanceId: this.state.instanceId
    };
  }
}

// Compatibility export for existing imports (temporary)
export { AgentMemoryAdapter as MemoryAdapter };

/**
 * MemU Adapter
 * 
 * Memory adapter for Chrysalis agents providing tiered memory operations.
 * Implements the MemU memory architecture with four tiers:
 * - Working: Short-term session context
 * - Episodic: Past experiences and events
 * - Semantic: Facts and knowledge
 * - Procedural: Skills and learned procedures
 * 
 * @module memory/MemUAdapter
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

/**
 * Embedding provider interface
 */
interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

/**
 * Simple in-memory embedding provider for development
 * In production, this should be replaced with OpenAI/Ollama embeddings
 */
class MockEmbeddingProvider implements EmbeddingProvider {
  private dimensions: number;
  
  constructor(dimensions: number = 768) {
    this.dimensions = dimensions;
  }
  
  async embed(text: string): Promise<number[]> {
    // Generate deterministic pseudo-embedding based on text hash
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

/**
 * Cosine similarity between two vectors
 */
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

/**
 * MemU Adapter - Agent Memory Interface
 */
export class MemUAdapter {
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
      vectorClock: [0],
      createdAt: Date.now(),
      lastSync: 0,
      totalMemories: 0
    };
    
    this.embeddingProvider = embeddingProvider ?? new MockEmbeddingProvider(this.config.embeddingDimensions);
  }
  
  /**
   * Generate SHA-384 fingerprint for content
   */
  private generateFingerprint(
    content: string,
    memoryType: MemoryType,
    metadata: Record<string, unknown> = {}
  ): MemoryFingerprint {
    const contentHash = createHash('sha384')
      .update(content)
      .digest('hex');
    
    const metadataHash = createHash('sha384')
      .update(JSON.stringify({ memoryType, ...metadata }))
      .digest('hex');
    
    const combinedHash = createHash('sha384')
      .update(contentHash + metadataHash)
      .digest('hex');
    
    return {
      fingerprint: combinedHash,
      algorithm: 'sha384',
      contentHash,
      metadataHash
    };
  }
  
  /**
   * Create logical time for a new memory
   */
  private createLogicalTime(): LogicalTime {
    this.state.lamportClock++;
    
    if (this.instanceIndex >= this.state.vectorClock.length) {
      this.state.vectorClock.push(0);
    }
    this.state.vectorClock[this.instanceIndex]++;
    
    return {
      lamportTime: this.state.lamportClock,
      vectorTime: [...this.state.vectorClock],
      wallTime: Date.now(),
      instanceId: this.state.instanceId
    };
  }
  
  /**
   * Create empty causality
   */
  private createCausality(parentIds: string[] = []): MemoryCausality {
    return {
      parentMemories: parentIds,
      childMemories: [],
      relatedMemories: []
    };
  }
  
  /**
   * Create default CRDT metadata
   */
  private createCRDTMetadata(): CRDTMetadata {
    const now = Date.now();
    return {
      crdtType: 'g-set',
      addedBy: [this.state.instanceId],
      firstAdded: now,
      lastModified: now,
      version: 1
    };
  }
  
  /**
   * Create default gossip metadata
   */
  private createGossipMetadata(): GossipMetadata {
    return {
      originInstance: this.state.instanceId,
      seenBy: [this.state.instanceId],
      fanout: this.config.gossipFanout,
      propagationRound: 0,
      lastGossip: Date.now()
    };
  }
  
  /**
   * Create default Byzantine validation
   */
  private createByzantineValidation(): ByzantineValidation {
    return {
      verifiedBy: [this.state.instanceId],
      confidenceScores: [1.0],
      trimmedMean: 1.0,
      median: 1.0,
      threshold: true,
      requiredVotes: 1
    };
  }
  
  /**
   * Emit a memory event
   */
  private emit(event: MemoryEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (error) {
          console.error(`Memory event handler error: ${error}`);
        }
      }
    }
  }
  
  /**
   * Subscribe to memory events
   */
  on(eventType: MemoryEventType, handler: MemoryEventHandler): () => void {
    const handlers = this.eventHandlers.get(eventType) ?? [];
    handlers.push(handler);
    this.eventHandlers.set(eventType, handlers);
    
    // Return unsubscribe function
    return () => {
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    };
  }
  
  // ===========================================================================
  // Working Memory Operations
  // ===========================================================================
  
  /**
   * Add to working memory
   */
  async addWorkingMemory(
    content: string,
    options: {
      memoryType?: MemoryType;
      source?: MemorySource;
      importance?: number;
      parentIds?: string[];
    } = {}
  ): Promise<WorkingMemory> {
    const {
      memoryType = 'observation',
      source = 'agent',
      importance = 0.5,
      parentIds = []
    } = options;
    
    const fingerprint = this.generateFingerprint(content, memoryType);
    const embedding = await this.embeddingProvider.embed(content);
    
    const memory: WorkingMemory = {
      memoryId: fingerprint.fingerprint,
      fingerprint,
      content,
      memoryType,
      source,
      tier: 'working',
      importance,
      instanceId: this.state.instanceId,
      logicalTime: this.createLogicalTime(),
      causality: this.createCausality(parentIds),
      embedding,
      expiresAt: Date.now() + this.config.workingMemoryTTL
    };
    
    this.state.workingMemories.push(memory);
    this.state.totalMemories++;
    
    // Enforce size limit
    while (this.state.workingMemories.length > this.config.workingMemorySize) {
      this.state.workingMemories.shift();
    }
    
    this.emit({
      type: 'memory:added',
      memory,
      timestamp: Date.now(),
      instanceId: this.state.instanceId
    });
    
    return memory;
  }
  
  /**
   * Get all working memories
   */
  getWorkingMemories(): WorkingMemory[] {
    const now = Date.now();
    // Filter out expired memories
    this.state.workingMemories = this.state.workingMemories.filter(
      m => !m.expiresAt || m.expiresAt > now
    );
    return [...this.state.workingMemories];
  }
  
  /**
   * Clear working memory
   */
  clearWorkingMemory(): void {
    this.state.workingMemories = [];
  }
  
  /**
   * Promote working memory to episodic
   */
  async promoteToEpisodic(memoryId: string): Promise<EpisodicMemory | null> {
    const idx = this.state.workingMemories.findIndex(m => m.memoryId === memoryId);
    if (idx < 0) return null;
    
    const working = this.state.workingMemories[idx];
    
    const episodic: EpisodicMemory = {
      ...working,
      tier: 'episodic',
      summary: working.content.slice(0, 200),
      crdt: this.createCRDTMetadata(),
      gossip: this.createGossipMetadata(),
      validation: this.createByzantineValidation()
    };
    
    // Remove from working
    this.state.workingMemories.splice(idx, 1);
    
    // Add to episodic
    this.state.episodicMemories.push(episodic);
    
    this.emit({
      type: 'memory:promoted',
      memory: episodic,
      previousTier: 'working',
      timestamp: Date.now(),
      instanceId: this.state.instanceId
    });
    
    return episodic;
  }
  
  // ===========================================================================
  // Episodic Memory Operations
  // ===========================================================================
  
  /**
   * Add episodic memory
   */
  async addEpisodicMemory(
    content: string,
    options: {
      summary?: string;
      memoryType?: MemoryType;
      source?: MemorySource;
      importance?: number;
      parentIds?: string[];
    } = {}
  ): Promise<EpisodicMemory> {
    const {
      summary = content.slice(0, 200),
      memoryType = 'observation',
      source = 'agent',
      importance = 0.5,
      parentIds = []
    } = options;
    
    const fingerprint = this.generateFingerprint(content, memoryType);
    const embedding = await this.embeddingProvider.embed(content);
    
    const memory: EpisodicMemory = {
      memoryId: fingerprint.fingerprint,
      fingerprint,
      content,
      summary,
      memoryType,
      source,
      tier: 'episodic',
      importance,
      instanceId: this.state.instanceId,
      logicalTime: this.createLogicalTime(),
      causality: this.createCausality(parentIds),
      embedding,
      crdt: this.createCRDTMetadata(),
      gossip: this.createGossipMetadata(),
      validation: this.createByzantineValidation()
    };
    
    this.state.episodicMemories.push(memory);
    this.state.totalMemories++;
    
    this.emit({
      type: 'memory:added',
      memory,
      timestamp: Date.now(),
      instanceId: this.state.instanceId
    });
    
    return memory;
  }
  
  /**
   * Search episodic memories by similarity
   */
  async searchEpisodic(
    query: string,
    limit: number = 5
  ): Promise<RetrievalResult> {
    const startTime = Date.now();
    const queryEmbedding = await this.embeddingProvider.embed(query);
    
    const scored = this.state.episodicMemories
      .map(memory => ({
        memory,
        score: memory.embedding ? cosineSimilarity(queryEmbedding, memory.embedding) : 0
      }))
      .filter(({ score }) => score >= this.config.similarityThreshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    return {
      memories: scored.map(s => s.memory),
      scores: scored.map(s => s.score),
      metadata: {
        query,
        tier: 'episodic',
        totalSearched: this.state.episodicMemories.length,
        searchTimeMs: Date.now() - startTime
      }
    };
  }
  
  // ===========================================================================
  // Semantic Memory Operations
  // ===========================================================================
  
  /**
   * Add semantic memory (fact/knowledge)
   */
  async addSemanticMemory(
    fact: string,
    options: {
      alternatePhrasings?: string[];
      evidence?: string[];
      confidence?: number;
      parentIds?: string[];
    } = {}
  ): Promise<SemanticMemory> {
    const {
      alternatePhrasings = [],
      evidence = [],
      confidence = 0.8,
      parentIds = []
    } = options;
    
    const fingerprint = this.generateFingerprint(fact, 'knowledge');
    const embedding = await this.embeddingProvider.embed(fact);
    
    const memory: SemanticMemory = {
      memoryId: fingerprint.fingerprint,
      fingerprint,
      content: fact,
      fact,
      alternatePhrasings,
      evidence,
      memoryType: 'knowledge',
      source: 'agent',
      tier: 'semantic',
      importance: confidence,
      instanceId: this.state.instanceId,
      logicalTime: this.createLogicalTime(),
      causality: this.createCausality(parentIds),
      embedding,
      convergence: {
        sources: parentIds,
        iterations: 0,
        converged: false,
        canonicalForm: fact,
        similarityThreshold: 0.9
      },
      validation: this.createByzantineValidation(),
      verificationCount: 1,
      confidence
    };
    
    this.state.semanticMemories.push(memory);
    this.state.totalMemories++;
    
    this.emit({
      type: 'memory:added',
      memory,
      timestamp: Date.now(),
      instanceId: this.state.instanceId
    });
    
    return memory;
  }
  
  /**
   * Search semantic memories
   */
  async searchSemantic(
    query: string,
    limit: number = 5
  ): Promise<RetrievalResult> {
    const startTime = Date.now();
    const queryEmbedding = await this.embeddingProvider.embed(query);
    
    const scored = this.state.semanticMemories
      .map(memory => ({
        memory,
        score: memory.embedding ? cosineSimilarity(queryEmbedding, memory.embedding) : 0
      }))
      .filter(({ score }) => score >= this.config.similarityThreshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    return {
      memories: scored.map(s => s.memory),
      scores: scored.map(s => s.score),
      metadata: {
        query,
        tier: 'semantic',
        totalSearched: this.state.semanticMemories.length,
        searchTimeMs: Date.now() - startTime
      }
    };
  }
  
  // ===========================================================================
  // Procedural Memory Operations (Skills)
  // ===========================================================================
  
  /**
   * Learn a new skill/procedure
   */
  async learnSkill(
    skillName: string,
    options: {
      description: string;
      steps: string[];
      preconditions?: string[];
      postconditions?: string[];
      parameters?: ProceduralMemory['parameters'];
      examples?: ProceduralMemory['examples'];
    }
  ): Promise<ProceduralMemory> {
    const {
      description,
      steps,
      preconditions = [],
      postconditions = [],
      parameters = {},
      examples = []
    } = options;
    
    const content = `Skill: ${skillName}\n${description}\nSteps: ${steps.join('; ')}`;
    const fingerprint = this.generateFingerprint(content, 'skill');
    const embedding = await this.embeddingProvider.embed(content);
    
    const memory: ProceduralMemory = {
      memoryId: fingerprint.fingerprint,
      fingerprint,
      content,
      skillName,
      description,
      steps,
      preconditions,
      postconditions,
      parameters,
      examples,
      memoryType: 'skill',
      source: 'agent',
      tier: 'procedural',
      importance: 0.9,
      instanceId: this.state.instanceId,
      logicalTime: this.createLogicalTime(),
      causality: this.createCausality(),
      embedding,
      successRate: 1.0,
      executionCount: 0,
      validation: this.createByzantineValidation()
    };
    
    this.state.proceduralMemories.push(memory);
    this.state.totalMemories++;
    
    this.emit({
      type: 'skill:learned',
      memory,
      timestamp: Date.now(),
      instanceId: this.state.instanceId
    });
    
    return memory;
  }
  
  /**
   * Get a skill by name
   */
  getSkill(skillName: string): ProceduralMemory | undefined {
    return this.state.proceduralMemories.find(
      m => m.skillName.toLowerCase() === skillName.toLowerCase()
    );
  }
  
  /**
   * Search for relevant skills
   */
  async searchSkills(
    query: string,
    limit: number = 5
  ): Promise<RetrievalResult> {
    const startTime = Date.now();
    const queryEmbedding = await this.embeddingProvider.embed(query);
    
    const scored = this.state.proceduralMemories
      .map(memory => ({
        memory,
        score: memory.embedding ? cosineSimilarity(queryEmbedding, memory.embedding) : 0
      }))
      .filter(({ score }) => score >= this.config.similarityThreshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    return {
      memories: scored.map(s => s.memory),
      scores: scored.map(s => s.score),
      metadata: {
        query,
        tier: 'procedural',
        totalSearched: this.state.proceduralMemories.length,
        searchTimeMs: Date.now() - startTime
      }
    };
  }
  
  /**
   * Record skill execution
   */
  recordSkillExecution(
    skillName: string,
    success: boolean
  ): void {
    const skill = this.getSkill(skillName);
    if (!skill) return;
    
    skill.executionCount++;
    skill.lastExecuted = Date.now();
    
    // Update success rate with exponential moving average
    const alpha = 0.2;
    skill.successRate = alpha * (success ? 1 : 0) + (1 - alpha) * skill.successRate;
    
    this.emit({
      type: 'skill:executed',
      memory: skill,
      timestamp: Date.now(),
      instanceId: this.state.instanceId
    });
  }
  
  // ===========================================================================
  // Unified Search
  // ===========================================================================
  
  /**
   * Search across all memory tiers
   */
  async search(
    query: string,
    options: {
      tiers?: MemoryTier[];
      limit?: number;
    } = {}
  ): Promise<RetrievalResult> {
    const {
      tiers = this.config.enabledTiers,
      limit = this.config.defaultRetrievalLimit
    } = options;
    
    const startTime = Date.now();
    const queryEmbedding = await this.embeddingProvider.embed(query);
    
    const allMemories: Memory[] = [];
    
    if (tiers.includes('working')) {
      allMemories.push(...this.getWorkingMemories());
    }
    if (tiers.includes('episodic')) {
      allMemories.push(...this.state.episodicMemories);
    }
    if (tiers.includes('semantic')) {
      allMemories.push(...this.state.semanticMemories);
    }
    if (tiers.includes('procedural')) {
      allMemories.push(...this.state.proceduralMemories);
    }
    
    const scored = allMemories
      .map(memory => ({
        memory,
        score: memory.embedding ? cosineSimilarity(queryEmbedding, memory.embedding) : 0
      }))
      .filter(({ score }) => score >= this.config.similarityThreshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    return {
      memories: scored.map(s => s.memory),
      scores: scored.map(s => s.score),
      metadata: {
        query,
        totalSearched: allMemories.length,
        searchTimeMs: Date.now() - startTime
      }
    };
  }
  
  // ===========================================================================
  // Context Assembly (for LLM)
  // ===========================================================================
  
  /**
   * Assemble context for LLM prompt
   */
  async assembleContext(
    query: string,
    options: {
      includeWorking?: boolean;
      includeRelevant?: boolean;
      maxTokens?: number;
    } = {}
  ): Promise<string> {
    const {
      includeWorking = true,
      includeRelevant = true,
      maxTokens = 2000
    } = options;
    
    const parts: string[] = [];
    let estimatedTokens = 0;
    const tokensPerChar = 0.25; // Rough estimate
    
    // Working memory (recent context)
    if (includeWorking) {
      const working = this.getWorkingMemories().slice(-5);
      if (working.length > 0) {
        parts.push('=== Recent Context ===');
        for (const m of working) {
          const line = `- [${m.memoryType}] ${m.content}`;
          estimatedTokens += line.length * tokensPerChar;
          if (estimatedTokens > maxTokens) break;
          parts.push(line);
        }
        parts.push('');
      }
    }
    
    // Relevant memories
    if (includeRelevant && query) {
      const results = await this.search(query, {
        tiers: ['episodic', 'semantic', 'procedural'],
        limit: 5
      });
      
      if (results.memories.length > 0) {
        parts.push('=== Relevant Knowledge ===');
        for (const m of results.memories) {
          const tierLabel = m.tier.charAt(0).toUpperCase() + m.tier.slice(1);
          let content = m.content;
          if ('fact' in m) content = m.fact;
          if ('skillName' in m) content = `Skill: ${m.skillName} - ${m.description}`;
          
          const line = `- [${tierLabel}] ${content}`;
          estimatedTokens += line.length * tokensPerChar;
          if (estimatedTokens > maxTokens) break;
          parts.push(line);
        }
        parts.push('');
      }
    }
    
    return parts.join('\n');
  }
  
  // ===========================================================================
  // State Management
  // ===========================================================================
  
  /**
   * Get memory statistics
   */
  getStats(): {
    instanceId: string;
    agentId: string;
    working: number;
    episodic: number;
    semantic: number;
    procedural: number;
    total: number;
    lamportClock: number;
  } {
    return {
      instanceId: this.state.instanceId,
      agentId: this.state.agentId,
      working: this.state.workingMemories.length,
      episodic: this.state.episodicMemories.length,
      semantic: this.state.semanticMemories.length,
      procedural: this.state.proceduralMemories.length,
      total: this.state.totalMemories,
      lamportClock: this.state.lamportClock
    };
  }
  
  /**
   * Get full memory state
   */
  getState(): MemoryState {
    return { ...this.state };
  }
  
  /**
   * Export state to JSON
   */
  toJSON(): string {
    return JSON.stringify(this.state, null, 2);
  }
  
  /**
   * Import state from JSON
   */
  fromJSON(json: string): void {
    const parsed = JSON.parse(json) as MemoryState;
    this.state = parsed;
  }
}
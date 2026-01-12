/**
 * AgentLearningPipeline
 * 
 * Orchestrates the learning process for agents:
 * - Conversation → Episodic → Semantic knowledge extraction
 * - Document processing for semantic knowledge
 * - Pattern detection for procedural skill learning
 * 
 * @module learning/AgentLearningPipeline
 */

import { AgentMemoryAdapter } from '../memory/AgentMemoryAdapter';
import {
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory,
} from '../memory/types';
import { ConversationMemoryManager, ChatMessageInput } from './ConversationMemoryManager';

// =============================================================================
// Types
// =============================================================================

/**
 * Learning event emitted during the learning process
 */
export interface LearningEvent {
  type: 'episodic_created' | 'semantic_extracted' | 'skill_learned' | 'document_processed';
  timestamp: number;
  agentId: string;
  memoryId?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * Learning event handler
 */
export type LearningEventHandler = (event: LearningEvent) => void;

/**
 * Document metadata for learning
 */
export interface DocumentInput {
  fileName: string;
  content: string;
  mimeType?: string;
  extractedFrom?: {
    pageNumbers?: number[];
    sections?: string[];
  };
}

/**
 * Action observation for skill learning
 */
export interface ActionObservation {
  actionType: string;
  actionName: string;
  parameters: Record<string, unknown>;
  result: 'success' | 'failure';
  duration: number;
  timestamp: number;
}

/**
 * Pipeline configuration
 */
export interface LearningPipelineConfig {
  // Fact extraction
  minFactConfidence: number;
  maxFactsPerDocument: number;
  
  // Skill learning
  minPatternOccurrences: number;
  patternWindowSize: number;
  
  // Consolidation
  consolidationInterval: number;
  maxEpisodicBeforeConsolidation: number;
}

/**
 * Default configuration
 */
export const DEFAULT_PIPELINE_CONFIG: LearningPipelineConfig = {
  minFactConfidence: 0.7,
  maxFactsPerDocument: 20,
  minPatternOccurrences: 2,
  patternWindowSize: 10,
  consolidationInterval: 60000, // 1 minute
  maxEpisodicBeforeConsolidation: 50,
};

// =============================================================================
// Main Class
// =============================================================================

/**
 * AgentLearningPipeline - Orchestrates all learning activities
 */
export class AgentLearningPipeline {
  private memory: AgentMemoryAdapter;
  private agentId: string;
  private config: LearningPipelineConfig;
  private conversationManager: ConversationMemoryManager;
  private eventHandlers: LearningEventHandler[] = [];
  private actionBuffer: ActionObservation[] = [];
  private consolidationTimer?: ReturnType<typeof setInterval>;
  
  constructor(
    memory: AgentMemoryAdapter,
    agentId: string,
    config?: Partial<LearningPipelineConfig>
  ) {
    this.memory = memory;
    this.agentId = agentId;
    this.config = { ...DEFAULT_PIPELINE_CONFIG, ...config };
    this.conversationManager = new ConversationMemoryManager(memory, agentId);
  }
  
  // ===========================================================================
  // Event Handling
  // ===========================================================================
  
  /**
   * Subscribe to learning events
   */
  onLearning(handler: LearningEventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      const idx = this.eventHandlers.indexOf(handler);
      if (idx >= 0) this.eventHandlers.splice(idx, 1);
    };
  }
  
  /**
   * Emit a learning event
   */
  private emit(event: Omit<LearningEvent, 'timestamp' | 'agentId'>): void {
    const fullEvent: LearningEvent = {
      ...event,
      timestamp: Date.now(),
      agentId: this.agentId,
    };
    
    for (const handler of this.eventHandlers) {
      try {
        handler(fullEvent);
      } catch (error) {
        console.error('Learning event handler error:', error);
      }
    }
  }
  
  // ===========================================================================
  // Conversation Learning
  // ===========================================================================
  
  /**
   * Process a chat message for learning
   */
  async processMessage(message: ChatMessageInput): Promise<string> {
    const memoryId = await this.conversationManager.persistMessage(message);
    
    // Check if we should trigger episodic consolidation
    const stats = this.conversationManager.getMemoryStats();
    if (stats.workingCount >= this.config.maxEpisodicBeforeConsolidation) {
      await this.consolidateConversation();
    }
    
    return memoryId;
  }
  
  /**
   * Get context for generating a response
   */
  async getResponseContext(userQuery: string): Promise<string> {
    const context = await this.conversationManager.getContextForResponse(userQuery);
    return context.assembledContext;
  }
  
  /**
   * Get recalled memory IDs for a query
   */
  async getRecalledMemories(query: string): Promise<string[]> {
    return this.conversationManager.getRecalledMemoryIds(query);
  }
  
  /**
   * Consolidate conversation to episodic memory
   */
  async consolidateConversation(): Promise<EpisodicMemory[]> {
    const result = await this.conversationManager.consolidateWorkingToEpisodic();
    
    for (const episodic of result) {
      this.emit({
        type: 'episodic_created',
        memoryId: episodic.memoryId,
        content: episodic.summary || episodic.content.slice(0, 100),
      });
    }
    
    return result;
  }
  
  /**
   * End conversation and extract learnings
   */
  async endConversation(): Promise<{
    episodic: EpisodicMemory[];
    semantic: SemanticMemory[];
  }> {
    const result = await this.conversationManager.endSession();
    
    for (const fact of result.extractedFacts) {
      this.emit({
        type: 'semantic_extracted',
        memoryId: fact.memoryId,
        content: fact.fact,
      });
    }
    
    return {
      episodic: result.episodicMemories,
      semantic: result.extractedFacts,
    };
  }
  
  // ===========================================================================
  // Document Learning
  // ===========================================================================
  
  /**
   * Learn from a document
   */
  async learnFromDocument(document: DocumentInput): Promise<SemanticMemory[]> {
    const facts: SemanticMemory[] = [];
    
    // Chunk document content
    const chunks = this.chunkText(document.content, 500, 50);
    
    for (const chunk of chunks) {
      // Extract facts from each chunk
      const extractedFacts = this.extractFacts(chunk);
      
      for (const fact of extractedFacts.slice(0, this.config.maxFactsPerDocument)) {
        const semantic = await this.memory.addSemanticMemory(fact, {
          evidence: [`document:${document.fileName}`],
          confidence: this.config.minFactConfidence,
        });
        
        facts.push(semantic);
        
        this.emit({
          type: 'semantic_extracted',
          memoryId: semantic.memoryId,
          content: fact,
          metadata: { source: document.fileName },
        });
      }
    }
    
    this.emit({
      type: 'document_processed',
      content: `Processed ${document.fileName}`,
      metadata: {
        fileName: document.fileName,
        factsExtracted: facts.length,
      },
    });
    
    return facts;
  }
  
  /**
   * Chunk text into overlapping segments
   */
  private chunkText(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    const words = text.split(/\s+/);
    
    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      if (chunk.length > 50) {
        chunks.push(chunk);
      }
    }
    
    return chunks;
  }
  
  /**
   * Extract facts from text (heuristic-based)
   * In production, this would use an LLM
   */
  private extractFacts(text: string): string[] {
    const facts: string[] = [];
    
    // Split into sentences
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      
      // Filter out non-factual sentences
      if (this.isFact(trimmed)) {
        facts.push(trimmed);
      }
    }
    
    return facts;
  }
  
  /**
   * Determine if a sentence is likely a fact
   */
  private isFact(sentence: string): boolean {
    // Must be reasonable length
    if (sentence.length < 20 || sentence.length > 500) return false;
    
    // Skip questions
    if (sentence.includes('?')) return false;
    
    // Skip imperative/command sentences
    const imperativeStarters = ['please', 'do', 'don\'t', 'let\'s', 'make sure'];
    const lower = sentence.toLowerCase();
    for (const starter of imperativeStarters) {
      if (lower.startsWith(starter)) return false;
    }
    
    // Look for factual patterns
    const factualPatterns = [
      /\b(?:is|are|was|were|has|have|had)\b/i,
      /\b(?:consists of|includes|contains)\b/i,
      /\b(?:defined as|known as|referred to as)\b/i,
      /\b(?:in \d{4}|since \d{4})\b/i,
    ];
    
    for (const pattern of factualPatterns) {
      if (pattern.test(sentence)) return true;
    }
    
    return false;
  }
  
  // ===========================================================================
  // Skill Learning
  // ===========================================================================
  
  /**
   * Observe an action for potential skill learning
   */
  async observeAction(action: ActionObservation): Promise<void> {
    this.actionBuffer.push(action);
    
    // Keep buffer bounded
    if (this.actionBuffer.length > this.config.patternWindowSize * 2) {
      this.actionBuffer = this.actionBuffer.slice(-this.config.patternWindowSize * 2);
    }
    
    // Check for patterns
    if (this.actionBuffer.length >= this.config.patternWindowSize) {
      await this.detectAndLearnPatterns();
    }
  }
  
  /**
   * Detect patterns and create procedural memories
   */
  private async detectAndLearnPatterns(): Promise<ProceduralMemory[]> {
    const learnedSkills: ProceduralMemory[] = [];
    const patterns = this.findRepeatedSequences();
    
    for (const pattern of patterns) {
      if (pattern.occurrences >= this.config.minPatternOccurrences) {
        // Check if we already have this skill
        const existing = this.memory.getSkill(pattern.name);
        if (existing) {
          // Update execution count
          this.memory.recordSkillExecution(pattern.name, true);
          continue;
        }
        
        // Learn new skill
        const skill = await this.memory.learnSkill(pattern.name, {
          description: pattern.description,
          steps: pattern.steps,
          preconditions: pattern.preconditions,
          examples: pattern.examples,
        });
        
        learnedSkills.push(skill);
        
        this.emit({
          type: 'skill_learned',
          memoryId: skill.memoryId,
          content: `Learned skill: ${skill.skillName}`,
          metadata: {
            steps: skill.steps,
            occurrences: pattern.occurrences,
          },
        });
      }
    }
    
    return learnedSkills;
  }
  
  /**
   * Find repeated action sequences
   */
  private findRepeatedSequences(): Array<{
    name: string;
    description: string;
    steps: string[];
    preconditions: string[];
    examples: ProceduralMemory['examples'];
    occurrences: number;
  }> {
    const patterns: Map<string, {
      steps: string[];
      occurrences: number;
      firstSeen: ActionObservation[];
    }> = new Map();
    
    // Look for 2-5 step sequences
    for (let seqLen = 2; seqLen <= 5; seqLen++) {
      for (let i = 0; i <= this.actionBuffer.length - seqLen; i++) {
        const sequence = this.actionBuffer.slice(i, i + seqLen);
        const key = sequence.map(a => a.actionType).join('→');
        
        const existing = patterns.get(key);
        if (existing) {
          existing.occurrences++;
        } else {
          patterns.set(key, {
            steps: sequence.map(a => `${a.actionType}: ${a.actionName}`),
            occurrences: 1,
            firstSeen: sequence,
          });
        }
      }
    }
    
    // Convert to output format
    return Array.from(patterns.entries())
      .filter(([_, p]) => p.occurrences >= this.config.minPatternOccurrences)
      .map(([key, pattern]) => ({
        name: `auto_skill_${key.replace(/→/g, '_').toLowerCase()}`,
        description: `Automatically learned pattern: ${key}`,
        steps: pattern.steps,
        preconditions: [] as string[],
        examples: [{
          input: pattern.firstSeen[0]?.parameters ?? {},
          output: 'success',
          context: 'Auto-detected from action patterns',
        }],
        occurrences: pattern.occurrences,
      }));
  }
  
  // ===========================================================================
  // Lifecycle
  // ===========================================================================
  
  /**
   * Start periodic consolidation
   */
  startPeriodicConsolidation(): void {
    if (this.consolidationTimer) return;
    
    this.consolidationTimer = setInterval(async () => {
      try {
        await this.consolidateConversation();
      } catch (error) {
        console.error('Periodic consolidation error:', error);
      }
    }, this.config.consolidationInterval);
  }
  
  /**
   * Stop periodic consolidation
   */
  stopPeriodicConsolidation(): void {
    if (this.consolidationTimer) {
      clearInterval(this.consolidationTimer);
      this.consolidationTimer = undefined;
    }
  }
  
  /**
   * Get learning statistics
   */
  getStats(): {
    conversationStats: ReturnType<ConversationMemoryManager['getMemoryStats']>;
    memoryStats: ReturnType<MemUAdapter['getStats']>;
    actionBufferSize: number;
  } {
    return {
      conversationStats: this.conversationManager.getMemoryStats(),
      memoryStats: this.memory.getStats(),
      actionBufferSize: this.actionBuffer.length,
    };
  }
  
  /**
   * Get the conversation manager
   */
  getConversationManager(): ConversationMemoryManager {
    return this.conversationManager;
  }
}

export default AgentLearningPipeline;

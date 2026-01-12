/**
 * ConversationMemoryManager
 * 
 * Manages the integration between chat conversations and MemU memory system.
 * Responsibilities:
 * - Persist chat messages to working memory
 * - Promote conversations to episodic memory on session end
 * - Extract facts for semantic memory
 * - Provide memory context for agent responses
 * 
 * @module learning/ConversationMemoryManager
 */

import { AgentMemoryAdapter } from '../memory/AgentMemoryAdapter';
import {
  WorkingMemory,
  EpisodicMemory,
  SemanticMemory,
  MemoryType,
  MemorySource,
} from '../memory/types';

// =============================================================================
// Types
// =============================================================================

/**
 * Chat message structure (simplified from ChrysalisWorkspace types)
 */
export interface ChatMessageInput {
  id: string;
  timestamp: number;
  senderId: string;
  senderName: string;
  senderType: 'user' | 'agent' | 'system';
  content: string;
}

/**
 * Memory context returned for agent responses
 */
export interface ConversationContext {
  workingMemory: string[];
  relevantEpisodic: string[];
  relevantSemantic: string[];
  assembledContext: string;
}

/**
 * Conversation session metadata
 */
export interface ConversationSession {
  sessionId: string;
  agentId: string;
  startedAt: number;
  messageCount: number;
  lastMessageAt: number;
}

/**
 * Configuration for ConversationMemoryManager
 */
export interface ConversationMemoryConfig {
  // Importance thresholds
  userMessageImportance: number;
  agentMessageImportance: number;
  systemMessageImportance: number;
  
  // Context assembly
  maxWorkingContextMessages: number;
  maxRelevantEpisodic: number;
  maxRelevantSemantic: number;
  maxContextTokens: number;
  
  // Consolidation
  autoPromoteAfterMessages: number;
  extractFactsEnabled: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_CONVERSATION_MEMORY_CONFIG: ConversationMemoryConfig = {
  userMessageImportance: 0.7,
  agentMessageImportance: 0.5,
  systemMessageImportance: 0.3,
  maxWorkingContextMessages: 10,
  maxRelevantEpisodic: 3,
  maxRelevantSemantic: 5,
  maxContextTokens: 2000,
  autoPromoteAfterMessages: 20,
  extractFactsEnabled: true,
};

// =============================================================================
// Main Class
// =============================================================================

/**
 * ConversationMemoryManager - Bridges chat and MemU
 */
export class ConversationMemoryManager {
  private memory: AgentMemoryAdapter;
  private config: ConversationMemoryConfig;
  private session: ConversationSession;
  private messageToMemoryMap: Map<string, string> = new Map();
  
  constructor(
    memory: AgentMemoryAdapter,
    agentId: string,
    config?: Partial<ConversationMemoryConfig>
  ) {
    this.memory = memory;
    this.config = { ...DEFAULT_CONVERSATION_MEMORY_CONFIG, ...config };
    
    this.session = {
      sessionId: `conv-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      agentId,
      startedAt: Date.now(),
      messageCount: 0,
      lastMessageAt: Date.now(),
    };
  }
  
  // ===========================================================================
  // Message Persistence
  // ===========================================================================
  
  /**
   * Persist a chat message to working memory
   */
  async persistMessage(message: ChatMessageInput): Promise<string> {
    const importance = this.calculateImportance(message);
    const memoryType = this.getMemoryType(message);
    const source = this.getMemorySource(message);
    
    // Format message for storage
    const content = this.formatMessageForMemory(message);
    
    // Add to working memory
    const workingMemory = await this.memory.addWorkingMemory(content, {
      memoryType,
      source,
      importance,
    });
    
    // Track message → memory mapping
    this.messageToMemoryMap.set(message.id, workingMemory.memoryId);
    
    // Update session stats
    this.session.messageCount++;
    this.session.lastMessageAt = message.timestamp;
    
    // Check if we should auto-promote to episodic
    if (this.session.messageCount % this.config.autoPromoteAfterMessages === 0) {
      await this.consolidateWorkingToEpisodic();
    }
    
    return workingMemory.memoryId;
  }
  
  /**
   * Persist multiple messages (e.g., loading history)
   */
  async persistMessages(messages: ChatMessageInput[]): Promise<string[]> {
    const memoryIds: string[] = [];
    for (const message of messages) {
      const id = await this.persistMessage(message);
      memoryIds.push(id);
    }
    return memoryIds;
  }
  
  // ===========================================================================
  // Context Assembly
  // ===========================================================================
  
  /**
   * Get memory context for generating an agent response
   */
  async getContextForResponse(userQuery: string): Promise<ConversationContext> {
    // Get working memory (recent messages)
    const workingMemories = this.memory.getWorkingMemories();
    const workingContext = workingMemories
      .slice(-this.config.maxWorkingContextMessages)
      .map(m => m.content);
    
    // Search episodic for relevant past conversations
    const episodicResults = await this.memory.searchEpisodic(
      userQuery,
      this.config.maxRelevantEpisodic
    );
    const relevantEpisodic = episodicResults.memories.map(m => m.summary || m.content);
    
    // Search semantic for relevant facts
    const semanticResults = await this.memory.searchSemantic(
      userQuery,
      this.config.maxRelevantSemantic
    );
    const relevantSemantic = semanticResults.memories.map(m => 
      (m as SemanticMemory).fact || m.content
    );
    
    // Assemble full context
    const assembledContext = await this.memory.assembleContext(userQuery, {
      includeWorking: true,
      includeRelevant: true,
      maxTokens: this.config.maxContextTokens,
    });
    
    return {
      workingMemory: workingContext,
      relevantEpisodic,
      relevantSemantic,
      assembledContext,
    };
  }
  
  /**
   * Get memory IDs that were recalled for a response
   */
  async getRecalledMemoryIds(query: string): Promise<string[]> {
    const episodicResults = await this.memory.searchEpisodic(query, 3);
    const semanticResults = await this.memory.searchSemantic(query, 3);
    
    return [
      ...episodicResults.memories.map(m => m.memoryId),
      ...semanticResults.memories.map(m => m.memoryId),
    ];
  }
  
  // ===========================================================================
  // Memory Consolidation
  // ===========================================================================
  
  /**
   * Consolidate working memory to episodic (called periodically or on session end)
   */
  async consolidateWorkingToEpisodic(): Promise<EpisodicMemory[]> {
    const workingMemories = this.memory.getWorkingMemories();
    const promotedMemories: EpisodicMemory[] = [];
    
    // Group messages into conversation chunks
    const chunks = this.chunkMessages(workingMemories);
    
    for (const chunk of chunks) {
      // Create a summary of the chunk
      const summary = this.summarizeChunk(chunk);
      const content = chunk.map(m => m.content).join('\n');
      
      // Add as episodic memory
      const episodic = await this.memory.addEpisodicMemory(content, {
        summary,
        memoryType: 'conversation',
        source: 'agent',
        importance: this.calculateChunkImportance(chunk),
      });
      
      promotedMemories.push(episodic);
    }
    
    // Clear promoted working memories
    this.memory.clearWorkingMemory();
    
    return promotedMemories;
  }
  
  /**
   * End the conversation session
   */
  async endSession(): Promise<{
    episodicMemories: EpisodicMemory[];
    extractedFacts: SemanticMemory[];
  }> {
    // Consolidate remaining working memory
    const episodicMemories = await this.consolidateWorkingToEpisodic();
    
    // Extract facts if enabled
    let extractedFacts: SemanticMemory[] = [];
    if (this.config.extractFactsEnabled && episodicMemories.length > 0) {
      extractedFacts = await this.extractFactsFromEpisodic(episodicMemories);
    }
    
    return { episodicMemories, extractedFacts };
  }
  
  // ===========================================================================
  // Fact Extraction
  // ===========================================================================
  
  /**
   * Extract semantic facts from episodic memories
   * Note: In production, this would use an LLM for extraction
   */
  async extractFactsFromEpisodic(
    episodicMemories: EpisodicMemory[]
  ): Promise<SemanticMemory[]> {
    const extractedFacts: SemanticMemory[] = [];
    
    for (const episodic of episodicMemories) {
      const facts = this.extractFactsFromText(episodic.content);
      
      for (const fact of facts) {
        const semantic = await this.memory.addSemanticMemory(fact, {
          evidence: [episodic.memoryId],
          confidence: 0.7,
        });
        extractedFacts.push(semantic);
      }
    }
    
    return extractedFacts;
  }
  
  /**
   * Simple fact extraction (heuristic-based)
   * In production, replace with LLM-based extraction
   */
  private extractFactsFromText(text: string): string[] {
    const facts: string[] = [];
    
    // Pattern-based extraction for common fact patterns
    const patterns = [
      // "X is Y" patterns
      /(?:The user|I|User|He|She|They)\s+(?:is|am|are)\s+([^.]+)/gi,
      // "X likes/prefers Y" patterns
      /(?:The user|I|User)\s+(?:likes?|prefers?|enjoys?)\s+([^.]+)/gi,
      // "X works at/for Y" patterns
      /(?:The user|I|User)\s+(?:works?\s+(?:at|for)|is employed at)\s+([^.]+)/gi,
      // Named entity mentions (capitalized sequences)
      /(?:My name is|I'm called|Call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
    ];
    
    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[0] && match[0].length > 10 && match[0].length < 200) {
          facts.push(match[0].trim());
        }
      }
    }
    
    return facts;
  }
  
  // ===========================================================================
  // Helper Methods
  // ===========================================================================
  
  private calculateImportance(message: ChatMessageInput): number {
    switch (message.senderType) {
      case 'user':
        return this.config.userMessageImportance;
      case 'agent':
        return this.config.agentMessageImportance;
      case 'system':
        return this.config.systemMessageImportance;
      default:
        return 0.5;
    }
  }
  
  private getMemoryType(message: ChatMessageInput): MemoryType {
    switch (message.senderType) {
      case 'user':
        return 'observation';
      case 'agent':
        return 'response';
      case 'system':
        return 'event';
      default:
        return 'observation';
    }
  }
  
  private getMemorySource(message: ChatMessageInput): MemorySource {
    switch (message.senderType) {
      case 'user':
        return 'user';
      case 'agent':
        return 'agent';
      case 'system':
        return 'system';
      default:
        return 'unknown';
    }
  }
  
  private formatMessageForMemory(message: ChatMessageInput): string {
    const timestamp = new Date(message.timestamp).toISOString();
    return `[${timestamp}] ${message.senderName} (${message.senderType}): ${message.content}`;
  }
  
  private chunkMessages(memories: WorkingMemory[], chunkSize: number = 5): WorkingMemory[][] {
    const chunks: WorkingMemory[][] = [];
    for (let i = 0; i < memories.length; i += chunkSize) {
      chunks.push(memories.slice(i, i + chunkSize));
    }
    return chunks;
  }
  
  private summarizeChunk(chunk: WorkingMemory[]): string {
    // Simple summarization - take first and last message
    if (chunk.length === 0) return '';
    if (chunk.length === 1) return chunk[0].content.slice(0, 200);
    
    const first = chunk[0].content.slice(0, 100);
    const last = chunk[chunk.length - 1].content.slice(0, 100);
    return `${first} ... ${last}`;
  }
  
  private calculateChunkImportance(chunk: WorkingMemory[]): number {
    if (chunk.length === 0) return 0.5;
    const avgImportance = chunk.reduce((sum, m) => sum + m.importance, 0) / chunk.length;
    return avgImportance;
  }
  
  // ===========================================================================
  // Getters
  // ===========================================================================
  
  getSession(): ConversationSession {
    return { ...this.session };
  }
  
  getMemoryStats(): {
    workingCount: number;
    totalMessages: number;
    sessionDuration: number;
  } {
    return {
      workingCount: this.memory.getWorkingMemories().length,
      totalMessages: this.session.messageCount,
      sessionDuration: Date.now() - this.session.startedAt,
    };
  }
  
  getMemoryIdForMessage(messageId: string): string | undefined {
    return this.messageToMemoryMap.get(messageId);
  }
}

export default ConversationMemoryManager;

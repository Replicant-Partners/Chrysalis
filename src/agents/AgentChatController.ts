/**
 * AgentChatController
 * 
 * Connects agents to chat panes with MemU memory integration.
 * Handles:
 * - Message processing with memory context
 * - Memory recall during conversation
 * - Learning from interactions
 * - Memory indicator generation for UI
 * 
 * @module agents/AgentChatController
 */

import { MemUAdapter } from '../memory/MemUAdapter';
import { AgentLearningPipeline, LearningEvent } from '../learning/AgentLearningPipeline';
import { AgentTerminalClient } from '../terminal/AgentTerminalClient';
import {
  ChatMessage,
  MemoryIndicator,
  AgentBinding,
  ChatPanePosition,
} from '../components/ChrysalisWorkspace/types';

// =============================================================================
// Types
// =============================================================================

/**
 * Input message from user
 */
export interface UserMessage {
  content: string;
  timestamp?: number;
}

/**
 * Agent response with memory context
 */
export interface AgentResponse {
  message: ChatMessage;
  recalledMemories: MemoryIndicator[];
  newMemories: MemoryIndicator[];
  processingTimeMs: number;
}

/**
 * Controller configuration
 */
export interface AgentChatControllerConfig {
  // Memory settings
  includeWorkingMemory: boolean;
  includeEpisodicMemory: boolean;
  includeSemanticMemory: boolean;
  includeSkillMemory: boolean;
  
  // Context limits
  maxWorkingContext: number;
  maxEpisodicRecall: number;
  maxSemanticRecall: number;
  maxSkillRecall: number;
  maxContextTokens: number;
  
  // Learning settings
  autoExtractFacts: boolean;
  autoLearnSkills: boolean;
  
  // Response settings
  showMemoryIndicators: boolean;
  typingDelayMs: number;
}

/**
 * Default configuration
 */
export const DEFAULT_AGENT_CHAT_CONFIG: AgentChatControllerConfig = {
  includeWorkingMemory: true,
  includeEpisodicMemory: true,
  includeSemanticMemory: true,
  includeSkillMemory: true,
  maxWorkingContext: 10,
  maxEpisodicRecall: 3,
  maxSemanticRecall: 5,
  maxSkillRecall: 2,
  maxContextTokens: 2000,
  autoExtractFacts: true,
  autoLearnSkills: true,
  showMemoryIndicators: true,
  typingDelayMs: 500,
};

/**
 * Message handler callback
 */
export type MessageHandler = (response: AgentResponse) => void;

/**
 * Status update handler
 */
export type StatusHandler = (status: 'idle' | 'thinking' | 'recalling' | 'responding') => void;

// =============================================================================
// Main Class
// =============================================================================

/**
 * AgentChatController - Bridges agent, chat, and memory
 */
export class AgentChatController {
  private memory: MemUAdapter;
  private learning: AgentLearningPipeline;
  private agent: AgentBinding;
  private panePosition: ChatPanePosition;
  private config: AgentChatControllerConfig;
  
  private terminalClient?: AgentTerminalClient;
  private messageHandlers: MessageHandler[] = [];
  private statusHandlers: StatusHandler[] = [];
  private currentStatus: 'idle' | 'thinking' | 'recalling' | 'responding' = 'idle';
  
  private userId: string;
  private userName: string;
  private messageCount: number = 0;
  
  constructor(
    agent: AgentBinding,
    panePosition: ChatPanePosition,
    memory: MemUAdapter,
    userId: string,
    userName: string,
    terminalClient?: AgentTerminalClient,
    config?: Partial<AgentChatControllerConfig>
  ) {
    this.agent = agent;
    this.panePosition = panePosition;
    this.memory = memory;
    this.userId = userId;
    this.userName = userName;
    this.terminalClient = terminalClient;
    this.config = { ...DEFAULT_AGENT_CHAT_CONFIG, ...config };
    
    // Initialize learning pipeline
    this.learning = new AgentLearningPipeline(memory, agent.agentId);
    
    // Subscribe to learning events
    this.learning.onLearning((event: LearningEvent) => {
      this.handleLearningEvent(event);
    });
  }
  
  // ===========================================================================
  // Event Handling
  // ===========================================================================
  
  /**
   * Subscribe to agent responses
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler);
    return () => {
      const idx = this.messageHandlers.indexOf(handler);
      if (idx >= 0) this.messageHandlers.splice(idx, 1);
    };
  }
  
  /**
   * Subscribe to status updates
   */
  onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.push(handler);
    return () => {
      const idx = this.statusHandlers.indexOf(handler);
      if (idx >= 0) this.statusHandlers.splice(idx, 1);
    };
  }
  
  /**
   * Emit message to handlers
   */
  private emitMessage(response: AgentResponse): void {
    for (const handler of this.messageHandlers) {
      try {
        handler(response);
      } catch (error) {
        console.error('Message handler error:', error);
      }
    }
  }
  
  /**
   * Update status
   */
  private setStatus(status: 'idle' | 'thinking' | 'recalling' | 'responding'): void {
    this.currentStatus = status;
    for (const handler of this.statusHandlers) {
      try {
        handler(status);
      } catch (error) {
        console.error('Status handler error:', error);
      }
    }
  }
  
  /**
   * Handle learning events
   */
  private handleLearningEvent(event: LearningEvent): void {
    // Could emit these to UI for learning feedback
    console.log(`[Learning] ${event.type}: ${event.content}`);
  }
  
  // ===========================================================================
  // Message Processing
  // ===========================================================================
  
  /**
   * Process a user message and generate agent response
   */
  async processUserMessage(userMessage: UserMessage): Promise<AgentResponse> {
    const startTime = Date.now();
    
    try {
      // 1. Create user message record
      const userChatMessage = this.createChatMessage(
        userMessage.content,
        this.userId,
        this.userName,
        'user'
      );
      
      // 2. Persist user message to memory
      this.setStatus('recalling');
      await this.learning.processMessage({
        id: userChatMessage.id,
        timestamp: userChatMessage.timestamp,
        senderId: this.userId,
        senderName: this.userName,
        senderType: 'user',
        content: userMessage.content,
      });
      
      // 3. Recall relevant memories
      const recalledMemories = await this.recallMemories(userMessage.content);
      
      // 4. Build context for response
      this.setStatus('thinking');
      const context = await this.learning.getResponseContext(userMessage.content);
      
      // 5. Generate agent response
      const responseContent = await this.generateResponse(userMessage.content, context);
      
      // 6. Create agent message
      this.setStatus('responding');
      const agentChatMessage = this.createChatMessage(
        responseContent,
        this.agent.agentId,
        this.agent.agentName,
        'agent'
      );
      
      // 7. Persist agent message to memory
      const agentMemoryId = await this.learning.processMessage({
        id: agentChatMessage.id,
        timestamp: agentChatMessage.timestamp,
        senderId: this.agent.agentId,
        senderName: this.agent.agentName,
        senderType: 'agent',
        content: responseContent,
      });
      
      // 8. Build memory indicators for UI
      const indicators = this.buildMemoryIndicators(recalledMemories, agentMemoryId);
      
      // 9. Attach indicators to message
      agentChatMessage.memoryIndicators = indicators.recalled;
      agentChatMessage.metadata = {
        recalledMemories: recalledMemories.map(m => m.memoryId),
        memoryIds: [agentMemoryId],
        processingTimeMs: Date.now() - startTime,
      };
      
      this.messageCount++;
      this.setStatus('idle');
      
      const response: AgentResponse = {
        message: agentChatMessage,
        recalledMemories: indicators.recalled,
        newMemories: indicators.created,
        processingTimeMs: Date.now() - startTime,
      };
      
      this.emitMessage(response);
      return response;
      
    } catch (error) {
      this.setStatus('idle');
      
      // Return error message
      const errorMessage = this.createChatMessage(
        `I encountered an error processing your message. Please try again.`,
        this.agent.agentId,
        this.agent.agentName,
        'agent'
      );
      
      const response: AgentResponse = {
        message: errorMessage,
        recalledMemories: [],
        newMemories: [],
        processingTimeMs: Date.now() - startTime,
      };
      
      this.emitMessage(response);
      return response;
    }
  }
  
  // ===========================================================================
  // Memory Recall
  // ===========================================================================
  
  /**
   * Recall relevant memories for a query
   */
  private async recallMemories(query: string): Promise<Array<{
    memoryId: string;
    type: 'episodic' | 'semantic' | 'skill';
    content: string;
    score: number;
  }>> {
    const recalled: Array<{
      memoryId: string;
      type: 'episodic' | 'semantic' | 'skill';
      content: string;
      score: number;
    }> = [];
    
    // Recall episodic memories
    if (this.config.includeEpisodicMemory) {
      const episodic = await this.memory.searchEpisodic(query, this.config.maxEpisodicRecall);
      for (let i = 0; i < episodic.memories.length; i++) {
        recalled.push({
          memoryId: episodic.memories[i].memoryId,
          type: 'episodic',
          content: episodic.memories[i].summary || episodic.memories[i].content.slice(0, 100),
          score: episodic.scores[i],
        });
      }
    }
    
    // Recall semantic memories
    if (this.config.includeSemanticMemory) {
      const semantic = await this.memory.searchSemantic(query, this.config.maxSemanticRecall);
      for (let i = 0; i < semantic.memories.length; i++) {
        const mem = semantic.memories[i] as any;
        recalled.push({
          memoryId: mem.memoryId,
          type: 'semantic',
          content: mem.fact || mem.content.slice(0, 100),
          score: semantic.scores[i],
        });
      }
    }
    
    // Recall skills
    if (this.config.includeSkillMemory) {
      const skills = await this.memory.searchSkills(query, this.config.maxSkillRecall);
      for (let i = 0; i < skills.memories.length; i++) {
        const skill = skills.memories[i] as any;
        recalled.push({
          memoryId: skill.memoryId,
          type: 'skill',
          content: `${skill.skillName}: ${skill.description}`,
          score: skills.scores[i],
        });
      }
    }
    
    return recalled;
  }
  
  // ===========================================================================
  // Response Generation
  // ===========================================================================
  
  /**
   * Generate agent response
   * Note: In production, this would call the LLM through AgentTerminalClient
   */
  private async generateResponse(userQuery: string, context: string): Promise<string> {
    // If we have a terminal client, use it
    if (this.terminalClient) {
      try {
        const response = await this.terminalClient.chat(userQuery, {
          systemPrompt: this.buildSystemPrompt(context),
          includeMemoryContext: true,
        });
        return response.content;
      } catch (error) {
        console.error('Terminal client error:', error);
        // Fall through to mock response
      }
    }
    
    // Mock response for development
    return this.generateMockResponse(userQuery, context);
  }
  
  /**
   * Build system prompt with memory context
   */
  private buildSystemPrompt(context: string): string {
    return `You are ${this.agent.agentName}, a helpful AI assistant.

Use the following memory context to inform your responses:

${context}

Guidelines:
- Reference relevant memories when appropriate
- Learn from the conversation and remember important details
- Be helpful and conversational
- If you recall something relevant, mention it naturally`;
  }
  
  /**
   * Generate mock response for development/testing
   */
  private generateMockResponse(userQuery: string, context: string): string {
    // Check if there's relevant context to reference
    const hasContext = context.includes('=== Relevant');
    
    const responses = [
      `I understand you're asking about "${userQuery.slice(0, 50)}...". Based on what I know, let me help you with that.`,
      `That's an interesting question. ${hasContext ? 'From our previous conversations, I recall some relevant information. ' : ''}Let me think about this.`,
      `I'd be happy to help with that. ${hasContext ? 'I remember we discussed something related before. ' : ''}Here's what I think...`,
      `Great question! ${hasContext ? 'Drawing on my memory, ' : ''}I can provide some insights on this topic.`,
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }
  
  // ===========================================================================
  // Helper Methods
  // ===========================================================================
  
  /**
   * Create a chat message
   */
  private createChatMessage(
    content: string,
    senderId: string,
    senderName: string,
    senderType: 'user' | 'agent' | 'system'
  ): ChatMessage {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      timestamp: Date.now(),
      senderId,
      senderName,
      senderType,
      content,
    };
  }
  
  /**
   * Build memory indicators for UI display
   */
  private buildMemoryIndicators(
    recalled: Array<{ memoryId: string; type: 'episodic' | 'semantic' | 'skill'; content: string; score: number }>,
    newMemoryId: string
  ): {
    recalled: MemoryIndicator[];
    created: MemoryIndicator[];
  } {
    const recalledIndicators: MemoryIndicator[] = recalled.map(m => ({
      type: m.type,
      memoryId: m.memoryId,
      content: m.content,
      confidence: m.score,
      usedInResponse: true,
    }));
    
    const createdIndicators: MemoryIndicator[] = [{
      type: 'episodic',
      memoryId: newMemoryId,
      content: 'Response stored',
      confidence: 1.0,
      usedInResponse: false,
    }];
    
    return {
      recalled: recalledIndicators,
      created: createdIndicators,
    };
  }
  
  // ===========================================================================
  // Lifecycle
  // ===========================================================================
  
  /**
   * End the conversation and consolidate memories
   */
  async endConversation(): Promise<void> {
    const result = await this.learning.endConversation();
    console.log(`[AgentChatController] Conversation ended. Created ${result.episodic.length} episodic and ${result.semantic.length} semantic memories.`);
  }
  
  /**
   * Get current status
   */
  getStatus(): 'idle' | 'thinking' | 'recalling' | 'responding' {
    return this.currentStatus;
  }
  
  /**
   * Get conversation stats
   */
  getStats(): {
    messageCount: number;
    memoryStats: ReturnType<AgentLearningPipeline['getStats']>;
  } {
    return {
      messageCount: this.messageCount,
      memoryStats: this.learning.getStats(),
    };
  }
  
  /**
   * Get the agent binding
   */
  getAgent(): AgentBinding {
    return this.agent;
  }
  
  /**
   * Get the pane position
   */
  getPanePosition(): ChatPanePosition {
    return this.panePosition;
  }
}

export default AgentChatController;
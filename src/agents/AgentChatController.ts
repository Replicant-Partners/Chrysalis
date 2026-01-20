/**
 * AgentChatController
 *
 * UI adapter that connects chat panes to the system agent backend.
 * Routes messages to the Rust system agents service.
 *
 * NOTE: Core logic is in Rust (src/native/rust-system-agents/)
 * This file is ONLY for UI integration.
 *
 * @module agents/AgentChatController
 */

import { AgentMemoryAdapter, MemoryEntry, createAgentMemoryAdapter } from '../memory/AgentMemoryAdapter';

export interface AgentResponse {
  agentId: string;
  content: string;
  confidence?: number;
  memoryUsed?: MemoryEntry[];
  latencyMs?: number;
  metadata?: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agentId?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface AgentChatControllerConfig {
  agentId: string;
  systemAgentsUrl?: string;
  memoryUrl?: string;
  enableMemory?: boolean;
  enableLearning?: boolean;
}

/**
 * Controller for managing chat interactions with agents
 */
export class AgentChatController {
  private agentId: string;
  private systemAgentsUrl: string;
  private memoryAdapter: AgentMemoryAdapter | null;
  private enableMemory: boolean;
  private enableLearning: boolean;
  private conversationHistory: ChatMessage[] = [];

  constructor(config: AgentChatControllerConfig) {
    this.agentId = config.agentId;
    this.systemAgentsUrl = config.systemAgentsUrl || 'http://localhost:3200';
    this.enableMemory = config.enableMemory ?? true;
    this.enableLearning = config.enableLearning ?? false;

    if (this.enableMemory) {
      this.memoryAdapter = createAgentMemoryAdapter(config.memoryUrl);
    } else {
      this.memoryAdapter = null;
    }
  }

  /**
   * Send a message to the agent and get a response
   */
  async sendMessage(content: string, metadata?: Record<string, unknown>): Promise<AgentResponse> {
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
      metadata,
    };

    this.conversationHistory.push(userMessage);

    // Store user message in memory if enabled
    if (this.memoryAdapter && this.enableMemory) {
      try {
        await this.memoryAdapter.store({
          content,
          agentId: this.agentId,
          role: 'user',
          importance: 0.5,
          metadata,
        });
      } catch (error) {
        console.warn('Failed to store message in memory:', error);
      }
    }

    // Get relevant context from memory
    let memoryContext: MemoryEntry[] = [];
    if (this.memoryAdapter && this.enableMemory) {
      try {
        memoryContext = await this.memoryAdapter.retrieve(content, 5);
      } catch (error) {
        console.warn('Failed to retrieve memory context:', error);
      }
    }

    // Send to system agents service
    const startTime = Date.now();
    const response = await this.callSystemAgents(content, memoryContext);
    const latencyMs = Date.now() - startTime;

    // Create assistant message
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: response.content,
      agentId: response.agentId,
      timestamp: new Date(),
      metadata: response.metadata,
    };

    this.conversationHistory.push(assistantMessage);

    // Store response in memory if enabled
    if (this.memoryAdapter && this.enableMemory) {
      try {
        await this.memoryAdapter.store({
          content: response.content,
          agentId: response.agentId,
          role: 'assistant',
          importance: response.confidence || 0.5,
          metadata: response.metadata,
        });
      } catch (error) {
        console.warn('Failed to store response in memory:', error);
      }
    }

    return {
      ...response,
      memoryUsed: memoryContext,
      latencyMs,
    };
  }

  /**
   * Call the Rust system agents service
   */
  private async callSystemAgents(
    message: string,
    memoryContext: MemoryEntry[]
  ): Promise<AgentResponse> {
    try {
      const response = await fetch(`${this.systemAgentsUrl}/api/v1/system-agents/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          targetAgent: this.agentId,
          context: {
            memory: memoryContext.map((m) => ({
              content: m.content,
              importance: m.importance,
            })),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`System agents error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !data.data) {
        throw new Error(data.error || 'Unknown error');
      }

      // Extract first response
      const agentResponse = data.data.responses?.[0];
      if (!agentResponse) {
        return {
          agentId: this.agentId,
          content: 'No response from agent.',
          confidence: 0,
        };
      }

      return {
        agentId: agentResponse.agent_id || this.agentId,
        content: agentResponse.response,
        confidence: agentResponse.confidence,
        metadata: agentResponse.metadata,
      };
    } catch (error) {
      console.error('System agents call failed:', error);

      // Fallback response
      return {
        agentId: this.agentId,
        content: `I'm having trouble connecting to the agent service. Error: ${error}`,
        confidence: 0,
      };
    }
  }

  /**
   * Get conversation history
   */
  getHistory(): ChatMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Get the agent ID
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * Check if memory is enabled
   */
  isMemoryEnabled(): boolean {
    return this.enableMemory && this.memoryAdapter !== null;
  }
}

export default AgentChatController;

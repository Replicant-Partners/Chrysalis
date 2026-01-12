/**
 * Agent LLM Client
 * 
 * Agent-facing client for LLM access with conversation context management.
 * Each agent gets its own client instance with isolated conversation history
 * and system prompts.
 * 
 * @module AgentLLMClient
 */

import {
  Message,
  MessageRole,
  CompletionRequest,
  CompletionResponse,
  CompletionChunk,
  ToolDefinition,
  ToolCall,
  ConversationContext,
  AgentLLMClient as IAgentLLMClient,
  ProviderId
} from './types';
import { LLMHydrationService } from './LLMHydrationService';

/**
 * Configuration for an agent client
 */
export interface AgentClientConfig {
  agentId: string;
  agentName?: string;
  systemPrompt?: string;
  model?: string;
  preferredProvider?: ProviderId;
  maxContextTokens?: number;
  temperature?: number;
  tools?: ToolDefinition[];
}

/**
 * Agent LLM Client implementation
 * 
 * Provides a simple interface for agents to:
 * - Send messages and get responses
 * - Maintain conversation history
 * - Use tools/functions
 * - Stream responses
 */
export class AgentLLMClient implements IAgentLLMClient {
  readonly agentId: string;
  private service: LLMHydrationService;
  private config: AgentClientConfig;
  private context: ConversationContext;
  private conversationHistory: Message[] = [];
  
  constructor(service: LLMHydrationService, config: AgentClientConfig) {
    this.service = service;
    this.config = {
      maxContextTokens: 8000,
      temperature: 0.7,
      ...config
    };
    this.agentId = config.agentId;
    
    const now = new Date();
    const convId = this.generateConversationId();
    this.context = {
      id: convId,
      agentId: config.agentId,
      conversationId: convId,
      systemPrompt: config.systemPrompt,
      tools: config.tools,
      messages: [],
      maxHistorySize: config.maxContextTokens ?? 8000,
      createdAt: now,
      updatedAt: now,
    };
    
    // Add system prompt to history if provided
    if (config.systemPrompt) {
      this.conversationHistory.push({
        role: 'system',
        content: config.systemPrompt
      });
    }
  }
  
  /**
   * Generate a unique conversation ID
   */
  private generateConversationId(): string {
    return `conv-${this.config.agentId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  
  /**
   * Get the current conversation context
   */
  getContext(): ConversationContext {
    return {
      ...this.context,
      messages: [...this.conversationHistory],
      updatedAt: new Date()
    };
  }
  
  /**
   * Update system prompt
   */
  setSystemPrompt(prompt: string): void {
    this.context.systemPrompt = prompt;
    
    // Update or add system message in history
    const systemIndex = this.conversationHistory.findIndex(m => m.role === 'system');
    const systemMessage: Message = { role: 'system', content: prompt };
    
    if (systemIndex >= 0) {
      this.conversationHistory[systemIndex] = systemMessage;
    } else {
      this.conversationHistory.unshift(systemMessage);
    }
  }
  
  /**
   * Add a message to the conversation
   */
  addMessage(role: MessageRole, content: string): void {
    this.conversationHistory.push({ role, content });
    this.trimContextIfNeeded();
  }
  
  /**
   * Add a tool result to the conversation
   */
  addToolResult(toolCallId: string, result: string): void {
    this.conversationHistory.push({
      role: 'tool',
      content: result,
      toolCallId
    });
  }
  
  /**
   * Trim conversation history if it exceeds max tokens
   */
  private trimContextIfNeeded(): void {
    const maxTokens = this.config.maxContextTokens ?? 8000;
    let estimatedTokens = this.estimateTokenCount();
    
    // Keep system message and at least 2 recent messages
    while (estimatedTokens > maxTokens && this.conversationHistory.length > 3) {
      // Find first non-system message to remove
      const removeIndex = this.conversationHistory.findIndex(m => m.role !== 'system');
      if (removeIndex > 0) {
        this.conversationHistory.splice(removeIndex, 1);
        estimatedTokens = this.estimateTokenCount();
      } else {
        break;
      }
    }
  }
  
  /**
   * Estimate token count of current conversation
   */
  private estimateTokenCount(): number {
    let chars = 0;
    for (const msg of this.conversationHistory) {
      chars += msg.content.length;
    }
    // Rough estimate: ~4 characters per token
    return Math.ceil(chars / 4);
  }
  
  /**
   * Send a message and get a response
   */
  async chat(userMessage: string, options?: Partial<CompletionRequest>): Promise<CompletionResponse> {
    // Add user message
    this.conversationHistory.push({
      role: 'user',
      content: userMessage
    });
    
    // Build request with optional overrides
    const request = {
      ...this.buildRequest(),
      ...options,
    };
    
    try {
      // Get completion
      const response = await this.service.complete(
        request,
        this.config.preferredProvider
      );
      
      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: response.content,
        toolCalls: response.toolCalls
      });
      
      this.trimContextIfNeeded();
      
      return response;
    } catch (error) {
      // Remove the user message on error
      this.conversationHistory.pop();
      throw error;
    }
  }
  
  /**
   * Send a message with full response details
   */
  async complete(userMessage: string, options?: Partial<CompletionRequest>): Promise<CompletionResponse> {
    // Add user message
    this.conversationHistory.push({
      role: 'user',
      content: userMessage
    });
    
    const request = this.buildRequest(options);
    
    try {
      const response = await this.service.complete(
        request,
        this.config.preferredProvider
      );
      
      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: response.content,
        toolCalls: response.toolCalls
      });
      
      this.trimContextIfNeeded();
      
      return response;
    } catch (error) {
      this.conversationHistory.pop();
      throw error;
    }
  }
  
  /**
   * Stream a response
   */
  async *stream(userMessage: string, options?: Partial<CompletionRequest>): AsyncIterable<CompletionChunk> {
    // Add user message
    this.conversationHistory.push({
      role: 'user',
      content: userMessage
    });
    
    const request = this.buildRequest(options);
    let fullContent = '';
    let toolCalls: ToolCall[] | undefined;
    
    try {
      for await (const chunk of this.service.stream(request, this.config.preferredProvider)) {
        fullContent += chunk.content;
        
        if (chunk.toolCallsDelta) {
          toolCalls = chunk.toolCallsDelta as ToolCall[];
        }
        
        yield chunk;
      }
      
      // Add assistant response after streaming completes
      this.conversationHistory.push({
        role: 'assistant',
        content: fullContent,
        toolCalls
      });
      
      this.trimContextIfNeeded();
    } catch (error) {
      this.conversationHistory.pop();
      throw error;
    }
  }
  
  /**
   * Alias to satisfy interface
   */
  async *streamChat(userMessage: string, options?: Partial<CompletionRequest>): AsyncIterable<CompletionChunk> {
    for await (const chunk of this.stream(userMessage, options)) {
      yield chunk;
    }
  }
  
  /**
   * Build a completion request from current context
   */
  private buildRequest(overrides?: Partial<CompletionRequest>): CompletionRequest {
    return {
      messages: [...this.conversationHistory],
      model: overrides?.model ?? this.config.model,
      temperature: overrides?.temperature ?? this.config.temperature,
      maxTokens: overrides?.maxTokens,
      stop: overrides?.stop,
      tools: overrides?.tools ?? this.context.tools,
      toolChoice: overrides?.toolChoice,
      agentId: this.config.agentId,
      metadata: overrides?.metadata
    };
  }
  
  /**
   * Execute a tool call and get the result
   * This should be overridden by the agent implementation
   */
  async executeToolCall(
    toolCall: ToolCall,
    executor: (name: string, args: Record<string, unknown>) => Promise<string>
  ): Promise<string> {
    const args = JSON.parse(toolCall.function.arguments);
    const result = await executor(toolCall.function.name, args);
    
    // Add tool result to history
    this.addToolResult(toolCall.id, result);
    
    return result;
  }
  
  /**
   * Process tool calls and continue the conversation
   */
  async processToolCalls(
    response: CompletionResponse,
    executor: (name: string, args: Record<string, unknown>) => Promise<string>
  ): Promise<CompletionResponse> {
    if (!response.toolCalls || response.toolCalls.length === 0) {
      return response;
    }
    
    // Execute all tool calls
    for (const toolCall of response.toolCalls) {
      await this.executeToolCall(toolCall, executor);
    }
    
    // Continue the conversation
    const request = this.buildRequest();
    const nextResponse = await this.service.complete(
      request,
      this.config.preferredProvider
    );
    
    // Add response to history
    this.conversationHistory.push({
      role: 'assistant',
      content: nextResponse.content,
      toolCalls: nextResponse.toolCalls
    });
    
    // Recursively process if there are more tool calls
    if (nextResponse.toolCalls && nextResponse.toolCalls.length > 0) {
      return this.processToolCalls(nextResponse, executor);
    }
    
    return nextResponse;
  }
  
  /**
   * Clear conversation history (keep system prompt)
   */
  clearHistory(): void {
    const systemMsg = this.conversationHistory.find(m => m.role === 'system');
    this.conversationHistory = systemMsg ? [systemMsg] : [];
    this.context.conversationId = this.generateConversationId();
  }
  
  /**
   * Get conversation history
   */
  getHistory(): Message[] {
    return [...this.conversationHistory];
  }
  
  /**
   * Get last N messages (excluding system)
   */
  getRecentMessages(count: number): Message[] {
    const nonSystem = this.conversationHistory.filter(m => m.role !== 'system');
    return nonSystem.slice(-count);
  }
  
  /**
   * Fork the conversation (create a new client with the same history)
   */
  fork(): AgentLLMClient {
    const forked = new AgentLLMClient(this.service, {
      ...this.config,
      agentId: `${this.config.agentId}-fork-${Date.now()}`
    });
    
    // Copy history (except system prompt which is already set)
    const nonSystem = this.conversationHistory.filter(m => m.role !== 'system');
    forked.conversationHistory.push(...nonSystem);
    
    return forked;
  }
  
  /**
   * Get usage statistics for this client
   */
  getConversationStats(): {
    messageCount: number;
    estimatedTokens: number;
    conversationId: string;
  } {
    return {
      messageCount: this.conversationHistory.length,
      estimatedTokens: this.estimateTokenCount(),
      conversationId: this.context.conversationId || this.context.id
    };
  }
}

/**
 * Factory for creating agent clients
 */
export class AgentClientFactory {
  private service: LLMHydrationService;
  private clients: Map<string, AgentLLMClient> = new Map();
  
  constructor(service: LLMHydrationService) {
    this.service = service;
  }
  
  /**
   * Create or get a client for an agent
   */
  getClient(config: AgentClientConfig): AgentLLMClient {
    const existing = this.clients.get(config.agentId);
    if (existing) {
      return existing;
    }
    
    const client = new AgentLLMClient(this.service, config);
    this.clients.set(config.agentId, client);
    return client;
  }
  
  /**
   * Create a new client (always creates a fresh instance)
   */
  createClient(config: AgentClientConfig): AgentLLMClient {
    const client = new AgentLLMClient(this.service, config);
    this.clients.set(config.agentId, client);
    return client;
  }
  
  /**
   * Remove a client
   */
  removeClient(agentId: string): void {
    this.clients.delete(agentId);
  }
  
  /**
   * Get all registered client IDs
   */
  getClientIds(): string[] {
    return Array.from(this.clients.keys());
  }
  
  /**
   * Clear all clients
   */
  clearAll(): void {
    this.clients.clear();
  }
}

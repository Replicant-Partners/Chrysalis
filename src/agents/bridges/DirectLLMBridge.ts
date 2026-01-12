/**
 * DirectLLMBridge - Agent bridge for direct LLM API access
 * 
 * Connects to LLMs directly via the LLM Hydration Service:
 * - OpenAI (GPT-4, GPT-3.5)
 * - Anthropic (Claude 3, Claude 2)
 * - Ollama (local models)
 * 
 * @module agents/bridges/DirectLLMBridge
 */

import { BaseBridge } from './BaseBridge';
import {
  BridgeConfig,
  AgentInfo,
  AgentMessage,
  AgentResponse,
  AgentContext,
  AgentCapability,
  AgentType,
  AgentTool
} from './types';
import { LLMHydrationService } from '../../services/llm/LLMHydrationService';
import { AgentLLMClient } from '../../services/llm/AgentLLMClient';
import { ProviderId } from '../../services/llm/types';

/**
 * DirectLLM-specific configuration
 */
export interface DirectLLMConfig extends BridgeConfig {
  type: 'direct_llm';
  
  // Provider settings
  provider: ProviderId;
  model?: string;
  
  // LLM parameters
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  
  // System prompt
  systemPrompt?: string;
  
  // Optional external LLM service
  llmService?: LLMHydrationService;
  
  // API configuration (if not using external service)
  apiKey?: string;
  baseUrl?: string;
}

/**
 * Default DirectLLM configuration
 */
const DEFAULT_DIRECT_LLM_CONFIG: Partial<DirectLLMConfig> = {
  temperature: 0.7,
  maxTokens: 4096,
  timeout: 60000
};

/**
 * Provider-specific defaults
 */
const PROVIDER_DEFAULTS: Record<ProviderId, { model: string; maxTokens: number }> = {
  openai: { model: 'gpt-4-turbo-preview', maxTokens: 4096 },
  anthropic: { model: 'claude-3-sonnet-20240229', maxTokens: 4096 },
  ollama: { model: 'llama2', maxTokens: 2048 },
  mock: { model: 'mock-model', maxTokens: 1024 }
};

/**
 * DirectLLMBridge - Connects to LLMs directly
 */
export class DirectLLMBridge extends BaseBridge {
  private llmService?: LLMHydrationService;
  private llmClient?: AgentLLMClient;
  private directLLMConfig: DirectLLMConfig;
  private conversationHistory: AgentMessage[] = [];
  
  constructor(config: DirectLLMConfig) {
    const providerDefaults = PROVIDER_DEFAULTS[config.provider] ?? PROVIDER_DEFAULTS.openai;
    
    super({
      ...DEFAULT_DIRECT_LLM_CONFIG,
      model: providerDefaults.model,
      maxTokens: providerDefaults.maxTokens,
      ...config
    });
    
    this.directLLMConfig = {
      ...DEFAULT_DIRECT_LLM_CONFIG,
      model: providerDefaults.model,
      maxTokens: providerDefaults.maxTokens,
      ...config
    } as DirectLLMConfig;
    
    // Use provided LLM service or we'll create one on connect
    this.llmService = config.llmService;
  }
  
  // ============================================================================
  // Identity
  // ============================================================================
  
  get agentType(): AgentType {
    return 'direct_llm';
  }
  
  get capabilities(): AgentCapability[] {
    return ['chat', 'multi_turn', 'streaming'];
  }
  
  get info(): AgentInfo {
    return {
      id: this.id,
      name: this.config.name,
      type: 'direct_llm',
      description: `Direct LLM agent via ${this.directLLMConfig.provider} (${this.directLLMConfig.model})`,
      capabilities: this.capabilities,
      status: this.status,
      version: '1.0.0',
      metadata: {
        provider: this.directLLMConfig.provider,
        model: this.directLLMConfig.model,
        temperature: this.directLLMConfig.temperature
      }
    };
  }
  
  // ============================================================================
  // Connection
  // ============================================================================
  
  /**
   * Connect to the LLM service
   */
  async connect(): Promise<void> {
    if (this.status === 'connected') {
      return;
    }
    
    this.setStatus('connecting');
    
    try {
      // Create LLM service if not provided
      if (!this.llmService) {
        const model = this.directLLMConfig.model ?? 'claude-3-5-sonnet-20241022';
        this.llmService = new LLMHydrationService({
          defaultProvider: this.directLLMConfig.provider,
          providers: [{
            id: this.directLLMConfig.provider,
            apiKey: this.directLLMConfig.apiKey,
            baseUrl: this.directLLMConfig.baseUrl,
            defaultModel: model,
            models: [model],
            enabled: true,
            priority: 1
          }]
        });
      }
      
      // Create agent client
      this.llmClient = new AgentLLMClient(this.llmService, {
        agentId: this.id,
        agentName: this.config.name,
        systemPrompt: this.directLLMConfig.systemPrompt,
        model: this.directLLMConfig.model,
        temperature: this.directLLMConfig.temperature,
      });
      
      // Verify connection by testing with empty message
      // (The service handles connection internally)
      
      this.setStatus('connected');
      this.emit({
        type: 'connected',
        bridgeId: this.id,
        timestamp: Date.now(),
        payload: {
          provider: this.directLLMConfig.provider,
          model: this.directLLMConfig.model
        }
      });
    } catch (error) {
      this.setStatus('error');
      throw error;
    }
  }
  
  /**
   * Disconnect from the LLM service
   */
  async disconnect(): Promise<void> {
    if (this.status === 'disconnected') {
      return;
    }
    
    this.llmClient = undefined;
    // Don't destroy the llmService as it might be shared
    
    this.setStatus('disconnected');
    this.emit({
      type: 'disconnected',
      bridgeId: this.id,
      timestamp: Date.now(),
      payload: {}
    });
  }
  
  // ============================================================================
  // Messaging
  // ============================================================================
  
  /**
   * Send a message to the LLM
   */
  async send(message: AgentMessage, context?: AgentContext): Promise<AgentResponse> {
    if (!this.llmClient || this.status !== 'connected') {
      return this.createErrorResponse('Not connected to LLM service');
    }
    
    this.emit({
      type: 'message',
      bridgeId: this.id,
      timestamp: Date.now(),
      payload: { message }
    });
    
    try {
      // Format the message with context
      let fullMessage = message.content;
      
      // Add memory context if available
      if (context?.memoryContext) {
        fullMessage = `[Memory Context]\n${context.memoryContext}\n\n[User Message]\n${fullMessage}`;
      }
      
      // Call the LLM
      const responseText = await this.withTimeout(
        this.llmClient.chat(fullMessage),
        this.config.timeout
      );
      
      // Store in conversation history
      this.conversationHistory.push(message);
      const responseMessage: AgentMessage = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        content: responseText,
        role: 'assistant',
        timestamp: Date.now()
      };
      this.conversationHistory.push(responseMessage);
      
      // Create response
      const response = this.createResponse(responseText, 'success', {
        provider: this.directLLMConfig.provider,
        model: this.directLLMConfig.model
      });
      
      this.emit({
        type: 'response',
        bridgeId: this.id,
        timestamp: Date.now(),
        payload: { response }
      });
      
      return response;
    } catch (error) {
      const errorResponse = this.createErrorResponse(
        error instanceof Error ? error : new Error(String(error))
      );
      
      this.emit({
        type: 'error',
        bridgeId: this.id,
        timestamp: Date.now(),
        payload: { error }
      });
      
      return errorResponse;
    }
  }
  
  /**
   * Stream responses from the LLM
   */
  async *stream(
    message: AgentMessage,
    context?: AgentContext
  ): AsyncIterable<AgentResponse> {
    if (!this.llmClient || !this.llmService || this.status !== 'connected') {
      yield this.createErrorResponse('Not connected to LLM service');
      return;
    }
    
    this.emit({
      type: 'message',
      bridgeId: this.id,
      timestamp: Date.now(),
      payload: { message }
    });
    
    try {
      // Format the message with context
      let fullMessage = message.content;
      if (context?.memoryContext) {
        fullMessage = `[Memory Context]\n${context.memoryContext}\n\n[User Message]\n${fullMessage}`;
      }
      
      // Build messages array for streaming
      const messages: Array<{ role: string; content: string }> = [];
      
      if (this.directLLMConfig.systemPrompt) {
        messages.push({ role: 'system', content: this.directLLMConfig.systemPrompt });
      }
      
      // Add conversation history
      for (const msg of this.conversationHistory.slice(-20)) {
        messages.push({ role: msg.role, content: msg.content });
      }
      
      messages.push({ role: 'user', content: fullMessage });
      
      // Stream from the LLM service
      let fullContent = '';
      let chunkIndex = 0;
      
      for await (const chunk of this.llmService.stream({
        messages: messages as any,
        model: this.directLLMConfig.model,
        temperature: this.directLLMConfig.temperature,
        maxTokens: this.directLLMConfig.maxTokens,
        agentId: this.id
      })) {
        fullContent += chunk.content;
        
        this.emit({
          type: 'stream_chunk',
          bridgeId: this.id,
          timestamp: Date.now(),
          payload: { content: chunk.content }
        });
        
        yield {
          id: `${this.id}-chunk-${chunkIndex++}`,
          content: chunk.content,
          timestamp: Date.now(),
          status: 'partial',
          isComplete: false,
          metadata: {
            provider: this.directLLMConfig.provider,
            model: this.directLLMConfig.model
          }
        };
      }
      
      // Store in conversation history
      this.conversationHistory.push(message);
      this.conversationHistory.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        content: fullContent,
        role: 'assistant',
        timestamp: Date.now()
      });
      
      // Final response
      const finalResponse = this.createResponse(fullContent, 'success', {
        provider: this.directLLMConfig.provider,
        model: this.directLLMConfig.model
      });
      
      this.emit({
        type: 'stream_end',
        bridgeId: this.id,
        timestamp: Date.now(),
        payload: { response: finalResponse }
      });
      
      yield finalResponse;
    } catch (error) {
      const errorResponse = this.createErrorResponse(
        error instanceof Error ? error : new Error(String(error))
      );
      
      this.emit({
        type: 'error',
        bridgeId: this.id,
        timestamp: Date.now(),
        payload: { error }
      });
      
      yield errorResponse;
    }
  }
  
  // ============================================================================
  // Conversation Management
  // ============================================================================
  
  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
    if (this.llmClient) {
      this.llmClient.clearHistory();
    }
  }
  
  /**
   * Get conversation history
   */
  getHistory(): AgentMessage[] {
    return [...this.conversationHistory];
  }
  
  /**
   * Set system prompt
   */
  setSystemPrompt(prompt: string): void {
    this.directLLMConfig.systemPrompt = prompt;
    if (this.llmClient) {
      this.llmClient.setSystemPrompt(prompt);
    }
  }
  
  /**
   * Update model parameters
   */
  setParameters(params: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  }): void {
    if (params.temperature !== undefined) {
      this.directLLMConfig.temperature = params.temperature;
    }
    if (params.maxTokens !== undefined) {
      this.directLLMConfig.maxTokens = params.maxTokens;
    }
    if (params.topP !== undefined) {
      this.directLLMConfig.topP = params.topP;
    }
  }
  
  // ============================================================================
  // Lifecycle
  // ============================================================================
  
  async destroy(): Promise<void> {
    await super.destroy();
    this.conversationHistory = [];
    this.llmClient = undefined;
  }
}

/**
 * Create a DirectLLM bridge instance
 */
export function createDirectLLMBridge(config: DirectLLMConfig): DirectLLMBridge {
  return new DirectLLMBridge(config);
}

/**
 * Convenience factory for common LLM providers
 */
export const LLMBridgeFactory = {
  /**
   * Create a Claude bridge
   */
  claude(options: {
    id: string;
    name: string;
    apiKey?: string;
    model?: string;
    systemPrompt?: string;
    llmService?: LLMHydrationService;
  }): DirectLLMBridge {
    return createDirectLLMBridge({
      ...options,
      type: 'direct_llm',
      provider: 'anthropic',
      model: options.model ?? 'claude-3-sonnet-20240229',
      enabled: true
    });
  },
  
  /**
   * Create a GPT bridge
   */
  gpt(options: {
    id: string;
    name: string;
    apiKey?: string;
    model?: string;
    systemPrompt?: string;
    llmService?: LLMHydrationService;
  }): DirectLLMBridge {
    return createDirectLLMBridge({
      ...options,
      type: 'direct_llm',
      provider: 'openai',
      model: options.model ?? 'gpt-4-turbo-preview',
      enabled: true
    });
  },
  
  /**
   * Create an Ollama bridge (local models)
   */
  ollama(options: {
    id: string;
    name: string;
    model?: string;
    baseUrl?: string;
    systemPrompt?: string;
    llmService?: LLMHydrationService;
  }): DirectLLMBridge {
    return createDirectLLMBridge({
      ...options,
      type: 'direct_llm',
      provider: 'ollama',
      model: options.model ?? 'llama2',
      baseUrl: options.baseUrl ?? 'http://localhost:11434',
      enabled: true
    });
  }
};
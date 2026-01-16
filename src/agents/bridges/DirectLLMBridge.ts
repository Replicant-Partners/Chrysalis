/**
 * DirectLLMBridge - Agent bridge for direct LLM API access
 * 
 * Connects to LLMs via the Go LLM Gateway (single source of truth):
 * - OpenAI (GPT-4, GPT-4o)
 * - Anthropic (Claude 3, Claude Sonnet 4)
 * - OpenRouter (100+ models)
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
import { GatewayLLMClient } from '../../services/gateway/GatewayLLMClient';
import { AgentLLMClient } from '../../services/llm/AgentLLMClient';

/**
 * Provider IDs supported by the Go gateway
 */
type GatewayProviderId = 'openai' | 'anthropic' | 'openrouter' | 'ollama';

/**
 * DirectLLM-specific configuration
 */
export interface DirectLLMConfig extends BridgeConfig {
  type: 'direct_llm';

  // Provider settings (handled by Go gateway)
  provider?: GatewayProviderId;
  model?: string;

  // LLM parameters
  temperature?: number;
  maxTokens?: number;

  // System prompt
  systemPrompt?: string;

  // Gateway configuration
  gatewayClient?: GatewayLLMClient;
  gatewayUrl?: string;
  gatewayAuthToken?: string;
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
 * DirectLLMBridge - Connects to LLMs via Go Gateway
 */
export class DirectLLMBridge extends BaseBridge {
  private gateway!: GatewayLLMClient;
  private llmClient?: AgentLLMClient;
  private directLLMConfig: DirectLLMConfig;
  private conversationHistory: AgentMessage[] = [];

  constructor(config: DirectLLMConfig) {
    super({
      ...DEFAULT_DIRECT_LLM_CONFIG,
      ...config
    });

    this.directLLMConfig = {
      ...DEFAULT_DIRECT_LLM_CONFIG,
      ...config
    } as DirectLLMConfig;
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
      description: `Direct LLM agent via Go Gateway (${this.directLLMConfig.model ?? 'default'})`,
      capabilities: this.capabilities,
      status: this.status,
      version: '1.0.0',
      metadata: {
        provider: this.directLLMConfig.provider ?? 'gateway',
        model: this.directLLMConfig.model,
        temperature: this.directLLMConfig.temperature
      }
    };
  }

  // ============================================================================
  // Connection
  // ============================================================================

  /**
   * Connect to the Go LLM Gateway
   */
  async connect(): Promise<void> {
    if (this.status === 'connected') {
      return;
    }

    this.setStatus('connecting');

    try {
      // Use provided gateway client or create one
      this.gateway = this.directLLMConfig.gatewayClient ?? new GatewayLLMClient({
        baseUrl: this.directLLMConfig.gatewayUrl,
        authToken: this.directLLMConfig.gatewayAuthToken,
        model: this.directLLMConfig.model,
      });

      // Create agent client wrapping the gateway
      this.llmClient = new AgentLLMClient(this.gateway, {
        agentId: this.id,
        agentName: this.config.name,
        systemPrompt: this.directLLMConfig.systemPrompt,
        model: this.directLLMConfig.model,
        temperature: this.directLLMConfig.temperature,
      });

      this.setStatus('connected');
      this.emit({
        type: 'connected',
        bridgeId: this.id,
        timestamp: Date.now(),
        payload: {
          provider: this.directLLMConfig.provider ?? 'gateway',
          model: this.directLLMConfig.model
        }
      });
    } catch (error) {
      this.setStatus('error');
      this.emit({
        type: 'error',
        bridgeId: this.id,
        timestamp: Date.now(),
        payload: {
          error: error instanceof Error ? error.message : String(error),
          stage: 'connection'
        }
      });
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
    this.conversationHistory = [];
    this.setStatus('disconnected');

    this.emit({
      type: 'disconnected',
      bridgeId: this.id,
      timestamp: Date.now(),
      payload: { reason: 'user_requested' }
    });
  }

  // ============================================================================
  // Message Handling
  // ============================================================================

  /**
   * Send a message to the LLM
   */
  async send(message: AgentMessage): Promise<AgentResponse> {
    if (!this.llmClient) {
      throw new Error('DirectLLMBridge not connected');
    }

    // Store in history
    this.conversationHistory.push(message);

    try {
      // Get completion via the agent client (which uses the gateway)
      const response = await this.llmClient.chat(message.content);

      const agentResponse: AgentResponse = {
        id: `resp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        content: response.content,
        timestamp: Date.now(),
        status: 'success',
        metadata: {
          bridgeId: this.id,
          requestId: message.id,
          model: response.model,
          provider: response.provider,
          finishReason: response.finishReason
        },
        usage: response.usage
      };

      // Store assistant response in history
      this.conversationHistory.push({
        id: agentResponse.id,
        content: agentResponse.content,
        role: 'assistant',
        timestamp: agentResponse.timestamp
      });

      this.emit({
        type: 'response',
        bridgeId: this.id,
        timestamp: Date.now(),
        payload: agentResponse
      });

      return agentResponse;
    } catch (error) {
      this.emit({
        type: 'error',
        bridgeId: this.id,
        timestamp: Date.now(),
        payload: {
          error: error instanceof Error ? error.message : String(error),
          stage: 'send'
        }
      });
      throw error;
    }
  }

  /**
   * Stream a response from the LLM
   */
  async *stream(message: AgentMessage, _context?: AgentContext): AsyncIterable<AgentResponse> {
    if (!this.llmClient) {
      throw new Error('DirectLLMBridge not connected');
    }

    this.conversationHistory.push(message);

    let fullContent = '';

    try {
      for await (const chunk of this.llmClient.stream(message.content)) {
        fullContent += chunk.content;
        yield {
          id: `chunk-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          content: chunk.content,
          timestamp: Date.now(),
          status: 'partial',
          isComplete: false
        };
      }

      // Final complete response
      const finalId = `resp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      yield {
        id: finalId,
        content: fullContent,
        timestamp: Date.now(),
        status: 'success',
        isComplete: true
      };

      // Store complete response in history
      this.conversationHistory.push({
        id: finalId,
        content: fullContent,
        role: 'assistant',
        timestamp: Date.now()
      });
    } catch (error) {
      this.emit({
        type: 'error',
        bridgeId: this.id,
        timestamp: Date.now(),
        payload: {
          error: error instanceof Error ? error.message : String(error),
          stage: 'stream'
        }
      });
      throw error;
    }
  }

  // ============================================================================
  // Context and History
  // ============================================================================

  /**
   * Get the current conversation context
   */
  getContext(): AgentContext {
    return {
      messages: this.conversationHistory
    };
  }

  /**
   * Update the conversation context
   */
  updateContext(context: Partial<AgentContext>): void {
    if (context.messages) {
      this.conversationHistory = [...context.messages];
    }
  }

  /**
   * Clear conversation history
   */
  async clearHistory(): Promise<void> {
    this.conversationHistory = [];
    if (this.llmClient) {
      this.llmClient.clearHistory();
    }
  }

  // ============================================================================
  // Tools (not supported for basic DirectLLM)
  // ============================================================================

  getTools(): AgentTool[] {
    return [];
  }

  invokeTool(_toolName: string, _args: Record<string, unknown>): unknown {
    throw new Error('Tools not supported by DirectLLMBridge');
  }
}

/**
 * Create a DirectLLM bridge
 */
export function createDirectLLMBridge(config: Omit<DirectLLMConfig, 'type'>): DirectLLMBridge {
  return new DirectLLMBridge({ ...config, type: 'direct_llm' });
}

/**
 * GatewayLLMClient
 *
 * TypeScript client for the Go LLM Gateway.
 * This is a thin UI adapter that connects the React frontend to the
 * Go-based gateway service.
 *
 * NOTE: Core logic is in Go (go-gateway/)
 * This file is ONLY for UI integration.
 *
 * @module services/gateway/GatewayLLMClient
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  stop?: string[];
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finishReason: string;
  }>;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface GatewayHealth {
  status: string;
  provider: string;
  model: string;
  uptime?: number;
}

export interface GatewayLLMClientConfig {
  baseUrl?: string;
  authToken?: string;
  defaultModel?: string;
  timeout?: number;
}

/**
 * Client for communicating with the Go LLM Gateway
 */
export class GatewayLLMClient {
  private baseUrl: string;
  private authToken: string | null;
  private defaultModel: string;
  private timeout: number;

  constructor(config: GatewayLLMClientConfig = {}) {
    this.baseUrl = config.baseUrl || 'http://localhost:8080';
    this.authToken = config.authToken || null;
    this.defaultModel = config.defaultModel || 'thudm/glm-4-9b-chat';
    this.timeout = config.timeout || 30000;
  }

  /**
   * Create headers for API requests
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  /**
   * Make a chat completion request
   */
  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: request.model || this.defaultModel,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 1000,
          stream: request.stream ?? false,
          stop: request.stop,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gateway error ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      return {
        id: data.id,
        model: data.model,
        choices: data.choices.map((choice: { index: number; message: { role: string; content: string }; finish_reason: string }) => ({
          index: choice.index,
          message: {
            role: choice.message.role,
            content: choice.message.content,
          },
          finishReason: choice.finish_reason,
        })),
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timed out after ${this.timeout}ms`);
      }

      throw error;
    }
  }

  /**
   * Simple completion helper
   */
  async complete(prompt: string, options?: Partial<ChatCompletionRequest>): Promise<string> {
    const response = await this.chatCompletion({
      model: options?.model || this.defaultModel,
      messages: [{ role: 'user', content: prompt }],
      ...options,
    });

    return response.choices[0]?.message.content || '';
  }

  /**
   * Check gateway health
   */
  async health(): Promise<GatewayHealth> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return {
          status: 'unhealthy',
          provider: 'unknown',
          model: 'unknown',
        };
      }

      const data = await response.json();
      return {
        status: data.status || 'healthy',
        provider: data.provider || 'unknown',
        model: data.model || this.defaultModel,
        uptime: data.uptime,
      };
    } catch {
      return {
        status: 'unreachable',
        provider: 'unknown',
        model: 'unknown',
      };
    }
  }

  /**
   * Get available models
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return [this.defaultModel];
      }

      const data = await response.json();
      return data.data?.map((m: { id: string }) => m.id) || [this.defaultModel];
    } catch {
      return [this.defaultModel];
    }
  }

  /**
   * Set the default model
   */
  setDefaultModel(model: string): void {
    this.defaultModel = model;
  }

  /**
   * Get current default model
   */
  getDefaultModel(): string {
    return this.defaultModel;
  }
}

/**
 * Create a gateway client with environment configuration
 */
export function createGatewayClient(): GatewayLLMClient {
  return new GatewayLLMClient({
    baseUrl: process.env.GATEWAY_BASE_URL || 'http://localhost:8080',
    authToken: process.env.GATEWAY_AUTH_TOKEN,
    defaultModel: process.env.LLM_DEFAULT_MODEL || 'thudm/glm-4-9b-chat',
  });
}

export default GatewayLLMClient;

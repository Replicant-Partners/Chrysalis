/**
 * Ollama Provider
 * 
 * LLM provider implementation for Ollama local models.
 * Supports running local models like Llama, Mistral, CodeLlama, etc.
 * 
 * @module OllamaProvider
 */

import axios from 'axios';
import { BaseProvider } from './BaseProvider';
import {
  ProviderId,
  ProviderConfig,
  CompletionRequest,
  CompletionResponse,
  CompletionChunk,
  Message
} from '../types';

/**
 * Ollama message format
 */
interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Ollama API response format
 */
interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: 'assistant';
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

/**
 * Ollama model list response
 */
interface OllamaModelsResponse {
  models: Array<{
    name: string;
    modified_at: string;
    size: number;
    digest: string;
  }>;
}

/**
 * Ollama Provider implementation
 */
export class OllamaProvider extends BaseProvider {
  readonly id: ProviderId = 'ollama';
  
  private cachedModels: string[] | null = null;
  private modelsCacheTime: number = 0;
  private readonly modelsCacheTTL = 60000; // 1 minute cache
  
  constructor(config?: Partial<ProviderConfig>) {
    super({
      id: 'ollama',
      apiKey: undefined, // Ollama doesn't require an API key
      baseUrl: config?.baseUrl ?? 'http://localhost:11434',
      defaultModel: config?.defaultModel ?? 'llama3.2',
      models: config?.models ?? [], // Will be populated dynamically
      enabled: config?.enabled ?? true,
      priority: config?.priority ?? 10, // Lower priority than cloud providers
      rateLimit: config?.rateLimit
    });
  }
  
  protected getApiKey(): string | undefined {
    return undefined; // Ollama doesn't require authentication
  }
  
  protected getBaseUrl(): string {
    return this.config.baseUrl ?? 'http://localhost:11434';
  }
  
  /**
   * Check if Ollama is running locally
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.getBaseUrl()}/api/tags`, {
        timeout: 2000
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }
  
  /**
   * Get list of available local models
   */
  async getAvailableModels(): Promise<string[]> {
    const now = Date.now();
    if (this.cachedModels && now - this.modelsCacheTime < this.modelsCacheTTL) {
      return this.cachedModels;
    }
    
    try {
      const response = await axios.get<OllamaModelsResponse>(
        `${this.getBaseUrl()}/api/tags`
      );
      this.cachedModels = response.data.models.map(m => m.name);
      this.modelsCacheTime = now;
      return this.cachedModels;
    } catch {
      return this.cachedModels ?? [];
    }
  }
  
  /**
   * Convert internal message format to Ollama format
   */
  private toOllamaMessages(messages: Message[]): OllamaMessage[] {
    return messages
      .filter(msg => msg.role !== 'tool') // Ollama doesn't support tool messages
      .map(msg => ({
        role: msg.role === 'tool' ? 'user' : msg.role,
        content: msg.content
      }));
  }
  
  /**
   * Estimate token count (Ollama doesn't always report tokens)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
  
  /**
   * Complete a request
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const model = request.model ?? this.config.defaultModel;
    const messages = this.toOllamaMessages(request.messages);
    
    const payload: Record<string, unknown> = {
      model,
      messages,
      stream: false,
      options: {
        temperature: request.temperature ?? 0.7,
        num_predict: request.maxTokens ?? 4096
      }
    };
    
    if (request.stop) {
      payload.options = {
        ...payload.options as Record<string, unknown>,
        stop: request.stop
      };
    }
    
    try {
      const response = await axios.post<OllamaChatResponse>(
        `${this.getBaseUrl()}/api/chat`,
        payload
      );
      
      const data = response.data;
      
      // Calculate token counts
      const promptTokens = data.prompt_eval_count ?? 
        this.estimateTokens(messages.map(m => m.content).join(''));
      const completionTokens = data.eval_count ?? 
        this.estimateTokens(data.message.content);
      
      return {
        content: data.message.content,
        model: data.model,
        finishReason: 'stop',
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens
        },
        estimatedCost: 0, // Local models are free
        provider: this.id,
        id: `ollama-${Date.now()}`
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('Ollama is not running. Start it with: ollama serve');
        }
        const message = error.response?.data?.error ?? error.message;
        throw new Error(`Ollama API error: ${message}`);
      }
      throw error;
    }
  }
  
  /**
   * Stream a completion
   */
  async *stream(request: CompletionRequest): AsyncIterable<CompletionChunk> {
    const model = request.model ?? this.config.defaultModel;
    const messages = this.toOllamaMessages(request.messages);
    
    const payload: Record<string, unknown> = {
      model,
      messages,
      stream: true,
      options: {
        temperature: request.temperature ?? 0.7,
        num_predict: request.maxTokens ?? 4096
      }
    };
    
    if (request.stop) {
      payload.options = {
        ...payload.options as Record<string, unknown>,
        stop: request.stop
      };
    }
    
    try {
      const response = await axios.post(
        `${this.getBaseUrl()}/api/chat`,
        payload,
        { responseType: 'stream' }
      );
      
      let buffer = '';
      let promptTokens = 0;
      let completionTokens = 0;
      
      for await (const chunk of response.data) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const data: OllamaChatResponse = JSON.parse(line);
            
            if (data.prompt_eval_count) {
              promptTokens = data.prompt_eval_count;
            }
            if (data.eval_count) {
              completionTokens = data.eval_count;
            }
            
            if (data.done) {
              yield {
                content: data.message?.content ?? '',
                done: true,
                finishReason: 'stop',
                usage: {
                  promptTokens,
                  completionTokens,
                  totalTokens: promptTokens + completionTokens
                }
              };
            } else {
              yield {
                content: data.message?.content ?? '',
                done: false
              };
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
      
      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const data: OllamaChatResponse = JSON.parse(buffer);
          yield {
            content: data.message?.content ?? '',
            done: data.done,
            finishReason: data.done ? 'stop' : undefined,
            usage: data.done ? {
              promptTokens: data.prompt_eval_count ?? promptTokens,
              completionTokens: data.eval_count ?? completionTokens,
              totalTokens: (data.prompt_eval_count ?? promptTokens) + 
                          (data.eval_count ?? completionTokens)
            } : undefined
          };
        } catch {
          // Ignore parse errors
        }
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('Ollama is not running. Start it with: ollama serve');
        }
        const message = error.response?.data?.error ?? error.message;
        throw new Error(`Ollama streaming error: ${message}`);
      }
      throw error;
    }
  }
  
  /**
   * Pull a model from Ollama library
   */
  async pullModel(modelName: string): Promise<void> {
    try {
      await axios.post(
        `${this.getBaseUrl()}/api/pull`,
        { name: modelName }
      );
      // Invalidate models cache
      this.cachedModels = null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to pull model: ${error.message}`);
      }
      throw error;
    }
  }
}
/**
 * Mock Provider
 * 
 * LLM provider implementation for testing and development.
 * Returns configurable mock responses without making real API calls.
 * 
 * @module MockProvider
 */

import { BaseProvider } from './BaseProvider';
import {
  ProviderId,
  ProviderConfig,
  CompletionRequest,
  CompletionResponse,
  CompletionChunk,
  ToolCall
} from '../types';

/**
 * Configuration for mock responses
 */
export interface MockResponseConfig {
  content?: string;
  toolCalls?: ToolCall[];
  finishReason?: 'stop' | 'length' | 'tool_calls';
  delay?: number; // Simulated delay in ms
  error?: Error;
  tokens?: {
    prompt: number;
    completion: number;
  };
}

/**
 * Mock Provider implementation
 */
export class MockProvider extends BaseProvider {
  readonly id: ProviderId = 'mock';
  
  private defaultResponse: MockResponseConfig = {
    content: 'This is a mock response for testing.',
    finishReason: 'stop',
    delay: 50,
    tokens: {
      prompt: 10,
      completion: 8
    }
  };
  
  private responseQueue: MockResponseConfig[] = [];
  private requestLog: CompletionRequest[] = [];
  
  constructor(config?: Partial<ProviderConfig>) {
    super({
      id: 'mock',
      apiKey: 'mock-api-key',
      baseUrl: 'http://mock.test',
      defaultModel: config?.defaultModel ?? 'mock-model',
      models: config?.models ?? ['mock-model', 'mock-gpt-4', 'mock-claude'],
      enabled: config?.enabled ?? true,
      priority: config?.priority ?? 0,
      rateLimit: config?.rateLimit
    });
  }
  
  protected getApiKey(): string | undefined {
    return 'mock-api-key';
  }
  
  protected getBaseUrl(): string {
    return 'http://mock.test';
  }
  
  /**
   * Always available for testing
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }
  
  /**
   * Set the default mock response
   */
  setDefaultResponse(config: MockResponseConfig): void {
    this.defaultResponse = { ...this.defaultResponse, ...config };
  }
  
  /**
   * Queue a specific response for the next request
   * Responses are consumed in FIFO order
   */
  queueResponse(config: MockResponseConfig): void {
    this.responseQueue.push(config);
  }
  
  /**
   * Clear all queued responses
   */
  clearQueue(): void {
    this.responseQueue = [];
  }
  
  /**
   * Get log of all requests made
   */
  getRequestLog(): CompletionRequest[] {
    return [...this.requestLog];
  }
  
  /**
   * Clear request log
   */
  clearRequestLog(): void {
    this.requestLog = [];
  }
  
  /**
   * Get the next response configuration
   */
  private getNextResponse(): MockResponseConfig {
    return this.responseQueue.shift() ?? this.defaultResponse;
  }
  
  /**
   * Simulate delay
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Complete a request
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    this.requestLog.push({ ...request });
    
    const config = this.getNextResponse();
    
    if (config.delay) {
      await this.delay(config.delay);
    }
    
    if (config.error) {
      throw config.error;
    }
    
    const promptTokens = config.tokens?.prompt ?? 10;
    const completionTokens = config.tokens?.completion ?? 8;
    
    return {
      content: config.content ?? '',
      model: request.model ?? this.config.defaultModel,
      finishReason: config.finishReason ?? 'stop',
      toolCalls: config.toolCalls,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens
      },
      estimatedCost: 0,
      provider: this.id,
      id: `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`
    };
  }
  
  /**
   * Stream a completion
   */
  async *stream(request: CompletionRequest): AsyncIterable<CompletionChunk> {
    this.requestLog.push({ ...request });
    
    const config = this.getNextResponse();
    
    if (config.error) {
      throw config.error;
    }
    
    const content = config.content ?? '';
    const words = content.split(' ');
    const chunkDelay = (config.delay ?? 50) / words.length;
    
    // Stream word by word
    for (let i = 0; i < words.length; i++) {
      await this.delay(chunkDelay);
      
      const isLast = i === words.length - 1;
      const word = words[i] + (isLast ? '' : ' ');
      
      yield {
        content: word,
        done: isLast,
        finishReason: isLast ? (config.finishReason ?? 'stop') : undefined,
        usage: isLast ? {
          promptTokens: config.tokens?.prompt ?? 10,
          completionTokens: config.tokens?.completion ?? 8,
          totalTokens: (config.tokens?.prompt ?? 10) + (config.tokens?.completion ?? 8)
        } : undefined
      };
    }
    
    // If content was empty, still send a done chunk
    if (words.length === 0 || (words.length === 1 && words[0] === '')) {
      yield {
        content: '',
        done: true,
        finishReason: config.finishReason ?? 'stop',
        usage: {
          promptTokens: config.tokens?.prompt ?? 10,
          completionTokens: config.tokens?.completion ?? 8,
          totalTokens: (config.tokens?.prompt ?? 10) + (config.tokens?.completion ?? 8)
        }
      };
    }
    
    // Handle tool calls if present
    if (config.toolCalls && config.toolCalls.length > 0) {
      await this.delay(chunkDelay);
      yield {
        content: '',
        done: true,
        finishReason: 'tool_calls',
        toolCallsDelta: config.toolCalls
      };
    }
  }
  
  /**
   * Create a mock tool call
   */
  static createToolCall(
    name: string,
    args: Record<string, unknown>,
    id?: string
  ): ToolCall {
    return {
      id: id ?? `call_${Math.random().toString(36).slice(2)}`,
      type: 'function',
      function: {
        name,
        arguments: JSON.stringify(args)
      }
    };
  }
}
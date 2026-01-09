/**
 * Base LLM Provider
 * 
 * Abstract base class for LLM provider implementations.
 * 
 * @module BaseProvider
 */

import {
  LLMProvider,
  ProviderId,
  ProviderConfig,
  CompletionRequest,
  CompletionResponse,
  CompletionChunk
} from '../types';

/**
 * Abstract base class for LLM providers
 */
export abstract class BaseProvider implements LLMProvider {
  abstract readonly id: ProviderId;
  
  protected config: ProviderConfig;
  
  constructor(config: ProviderConfig) {
    this.config = config;
  }
  
  /**
   * Check if provider is available
   */
  abstract isAvailable(): Promise<boolean>;
  
  /**
   * Get available models for this provider
   */
  getModels(): string[] {
    return this.config.models;
  }
  
  /**
   * Get default model for this provider
   */
  getDefaultModel(): string {
    return this.config.defaultModel;
  }
  
  /**
   * Complete a request
   */
  abstract complete(request: CompletionRequest): Promise<CompletionResponse>;
  
  /**
   * Stream a completion
   */
  abstract stream(request: CompletionRequest): AsyncIterable<CompletionChunk>;
  
  /**
   * Generate unique response ID
   */
  protected generateId(): string {
    return `${this.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
  
  /**
   * Get API key from config or environment
   */
  protected getApiKey(): string | undefined {
    if (this.config.apiKey) {
      return this.config.apiKey;
    }
    
    // Try environment variables
    switch (this.id) {
      case 'openai':
        return process.env.OPENAI_API_KEY;
      case 'anthropic':
        return process.env.ANTHROPIC_API_KEY;
      default:
        return undefined;
    }
  }
  
  /**
   * Get base URL from config or default
   */
  protected getBaseUrl(): string {
    if (this.config.baseUrl) {
      return this.config.baseUrl;
    }
    
    switch (this.id) {
      case 'openai':
        return 'https://api.openai.com/v1';
      case 'anthropic':
        return 'https://api.anthropic.com/v1';
      case 'ollama':
        return 'http://localhost:11434';
      default:
        throw new Error(`No default base URL for provider: ${this.id}`);
    }
  }
}
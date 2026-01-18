/**
 * Model Adapter Interface
 * 
 * Provides unified interface for communicating with different LLM providers
 * including local (Ollama), cloud (Anthropic, OpenAI), and hybrid deployments.
 */

import { ModelProfile } from '../types/schemas';

export interface InferenceRequest {
  prompt: string;
  context: Record<string, any>;
  config?: {
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    stop_sequences?: string[];
    system_prompt?: string;
  };
  timeout?: number;
}

export interface InferenceResponse {
  text: string;
  structured_data?: any;
  tokens_in: number;
  tokens_out: number;
  cold_start: boolean;
  memory_used_mb?: number;
  finish_reason: 'stop' | 'length' | 'error' | 'timeout';
  provider_metadata?: Record<string, any>;
}

/**
 * Abstract base class for model adapters
 */
export abstract class ModelAdapter {
  protected modelProfile: ModelProfile;
  protected warmupComplete: boolean = false;

  constructor(modelProfile: ModelProfile) {
    this.modelProfile = modelProfile;
  }

  /**
   * Perform inference with the model
   */
  abstract infer(request: InferenceRequest): Promise<InferenceResponse>;

  /**
   * Warm up the model (load into memory, etc.)
   */
  abstract warmup(): Promise<void>;

  /**
   * Get model information
   */
  getProfile(): ModelProfile {
    return this.modelProfile;
  }

  /**
   * Check if model is ready
   */
  isWarmed(): boolean {
    return this.warmupComplete;
  }

  /**
   * Cleanup resources
   */
  abstract cleanup(): Promise<void>;
}

/**
 * Ollama local model adapter
 */
export class OllamaAdapter extends ModelAdapter {
  private baseUrl: string;

  constructor(modelProfile: ModelProfile, baseUrl: string = 'http://localhost:11434') {
    super(modelProfile);
    this.baseUrl = baseUrl;
  }

  async infer(request: InferenceRequest): Promise<InferenceResponse> {
    const startTime = Date.now();
    const coldStart = !this.warmupComplete;

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelProfile.deployment.model_name,
          prompt: this.buildPrompt(request),
          stream: false,
          options: {
            temperature: request.config?.temperature ?? 0.7,
            top_p: request.config?.top_p ?? 0.9,
            num_predict: request.config?.max_tokens ?? 2048,
            stop: request.config?.stop_sequences
          }
        }),
        signal: request.timeout ? AbortSignal.timeout(request.timeout) : undefined
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.statusText}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      this.warmupComplete = true;

      return {
        text: data.response,
        tokens_in: data.prompt_eval_count ?? 0,
        tokens_out: data.eval_count ?? 0,
        cold_start: coldStart,
        finish_reason: data.done ? 'stop' : 'error',
        provider_metadata: {
          model: data.model,
          total_duration: data.total_duration,
          load_duration: data.load_duration,
          eval_duration: data.eval_duration
        }
      };
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error('Inference timeout');
      }
      throw error;
    }
  }

  async warmup(): Promise<void> {
    // Send a simple prompt to load model into memory
    await this.infer({
      prompt: 'Hello',
      context: {},
      config: { max_tokens: 10 }
    });
    this.warmupComplete = true;
  }

  async cleanup(): Promise<void> {
    // Ollama handles cleanup automatically
    this.warmupComplete = false;
  }

  private buildPrompt(request: InferenceRequest): string {
    let prompt = '';
    
    if (request.config?.system_prompt) {
      prompt += `System: ${request.config.system_prompt}\n\n`;
    }
    
    if (Object.keys(request.context).length > 0) {
      prompt += `Context: ${JSON.stringify(request.context, null, 2)}\n\n`;
    }
    
    prompt += request.prompt;
    
    return prompt;
  }
}

/**
 * Chrysalis Go Gateway adapter
 */
export class ChrysalisGatewayAdapter extends ModelAdapter {
  private gatewayUrl: string;
  private agentId: string;

  constructor(
    modelProfile: ModelProfile,
    gatewayUrl: string,
    agentId: string = 'kata-engine'
  ) {
    super(modelProfile);
    this.gatewayUrl = gatewayUrl;
    this.agentId = agentId;
  }

  async infer(request: InferenceRequest): Promise<InferenceResponse> {
    const startTime = Date.now();
    const coldStart = !this.warmupComplete;

    try {
      const response = await fetch(`${this.gatewayUrl}/v1/infer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-ID': this.agentId
        },
        body: JSON.stringify({
          prompt: request.prompt,
          context: request.context,
          model_tier: this.modelProfile.characteristics.type,
          model_name: this.modelProfile.deployment.model_name,
          temperature: request.config?.temperature,
          top_p: request.config?.top_p,
          max_tokens: request.config?.max_tokens,
          stop_sequences: request.config?.stop_sequences,
          system_prompt: request.config?.system_prompt
        }),
        signal: request.timeout ? AbortSignal.timeout(request.timeout) : undefined
      });

      if (!response.ok) {
        throw new Error(`Gateway request failed: ${response.statusText}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      this.warmupComplete = true;

      return {
        text: data.response,
        structured_data: data.structured_data,
        tokens_in: data.tokens_in ?? 0,
        tokens_out: data.tokens_out ?? 0,
        cold_start: coldStart,
        finish_reason: data.finish_reason ?? 'stop',
        provider_metadata: data.metadata
      };
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error('Inference timeout');
      }
      throw error;
    }
  }

  async warmup(): Promise<void> {
    await this.infer({
      prompt: 'Warmup',
      context: {},
      config: { max_tokens: 10 }
    });
    this.warmupComplete = true;
  }

  async cleanup(): Promise<void> {
    this.warmupComplete = false;
  }
}

/**
 * Anthropic Claude adapter
 */
export class AnthropicAdapter extends ModelAdapter {
  private apiKey: string;
  private baseUrl: string = 'https://api.anthropic.com/v1';

  constructor(modelProfile: ModelProfile, apiKey: string) {
    super(modelProfile);
    this.apiKey = apiKey;
  }

  async infer(request: InferenceRequest): Promise<InferenceResponse> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.modelProfile.deployment.model_name,
          messages: [
            {
              role: 'user',
              content: this.buildPrompt(request)
            }
          ],
          system: request.config?.system_prompt,
          max_tokens: request.config?.max_tokens ?? 4096,
          temperature: request.config?.temperature ?? 1.0,
          top_p: request.config?.top_p,
          stop_sequences: request.config?.stop_sequences
        }),
        signal: request.timeout ? AbortSignal.timeout(request.timeout) : undefined
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Anthropic request failed: ${error.error?.message ?? response.statusText}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      return {
        text: data.content[0].text,
        tokens_in: data.usage.input_tokens,
        tokens_out: data.usage.output_tokens,
        cold_start: false, // Cloud models don't have cold start
        finish_reason: data.stop_reason === 'end_turn' ? 'stop' : 
                      data.stop_reason === 'max_tokens' ? 'length' : 'stop',
        provider_metadata: {
          id: data.id,
          model: data.model,
          stop_reason: data.stop_reason
        }
      };
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error('Inference timeout');
      }
      throw error;
    }
  }

  async warmup(): Promise<void> {
    // Cloud models don't need warmup
    this.warmupComplete = true;
  }

  async cleanup(): Promise<void> {
    // No cleanup needed for stateless API
  }

  private buildPrompt(request: InferenceRequest): string {
    let prompt = request.prompt;
    
    if (Object.keys(request.context).length > 0) {
      prompt = `Context:\n${JSON.stringify(request.context, null, 2)}\n\n${prompt}`;
    }
    
    return prompt;
  }
}

/**
 * OpenAI GPT adapter
 */
export class OpenAIAdapter extends ModelAdapter {
  private apiKey: string;
  private baseUrl: string = 'https://api.openai.com/v1';

  constructor(modelProfile: ModelProfile, apiKey: string) {
    super(modelProfile);
    this.apiKey = apiKey;
  }

  async infer(request: InferenceRequest): Promise<InferenceResponse> {
    const startTime = Date.now();

    try {
      const messages: Array<{ role: string; content: string }> = [];
      
      if (request.config?.system_prompt) {
        messages.push({
          role: 'system',
          content: request.config.system_prompt
        });
      }
      
      messages.push({
        role: 'user',
        content: this.buildPrompt(request)
      });

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.modelProfile.deployment.model_name,
          messages,
          temperature: request.config?.temperature ?? 0.7,
          top_p: request.config?.top_p,
          max_tokens: request.config?.max_tokens,
          stop: request.config?.stop_sequences
        }),
        signal: request.timeout ? AbortSignal.timeout(request.timeout) : undefined
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI request failed: ${error.error?.message ?? response.statusText}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      return {
        text: data.choices[0].message.content,
        tokens_in: data.usage.prompt_tokens,
        tokens_out: data.usage.completion_tokens,
        cold_start: false,
        finish_reason: data.choices[0].finish_reason === 'stop' ? 'stop' :
                      data.choices[0].finish_reason === 'length' ? 'length' : 'stop',
        provider_metadata: {
          id: data.id,
          model: data.model,
          created: data.created
        }
      };
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error('Inference timeout');
      }
      throw error;
    }
  }

  async warmup(): Promise<void> {
    this.warmupComplete = true;
  }

  async cleanup(): Promise<void> {
    // No cleanup needed
  }

  private buildPrompt(request: InferenceRequest): string {
    let prompt = request.prompt;
    
    if (Object.keys(request.context).length > 0) {
      prompt = `Context:\n${JSON.stringify(request.context, null, 2)}\n\n${prompt}`;
    }
    
    return prompt;
  }
}

/**
 * Factory for creating model adapters
 */
export class ModelAdapterFactory {
  static create(
    modelProfile: ModelProfile,
    options: {
      apiKey?: string;
      gatewayUrl?: string;
      ollamaUrl?: string;
      agentId?: string;
    } = {}
  ): ModelAdapter {
    const provider = modelProfile.deployment.provider.toLowerCase();

    switch (provider) {
      case 'ollama':
        return new OllamaAdapter(modelProfile, options.ollamaUrl);
      
      case 'chrysalis':
      case 'gateway':
        if (!options.gatewayUrl) {
          throw new Error('Gateway URL required for Chrysalis adapter');
        }
        return new ChrysalisGatewayAdapter(
          modelProfile,
          options.gatewayUrl,
          options.agentId
        );
      
      case 'anthropic':
        if (!options.apiKey) {
          throw new Error('API key required for Anthropic adapter');
        }
        return new AnthropicAdapter(modelProfile, options.apiKey);
      
      case 'openai':
        if (!options.apiKey) {
          throw new Error('API key required for OpenAI adapter');
        }
        return new OpenAIAdapter(modelProfile, options.apiKey);
      
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }
}

/**
 * Universal Adapter Configuration
 * 
 * Configures the Universal LLM-Powered Adapter for protocol translation.
 * Default model: GPT5.2-codex via OpenRouter
 * 
 * @module config/universal-adapter
 */

import type { LLMProvider } from '../adapters/universal';

// ============================================================================
// Types
// ============================================================================

export interface UniversalAdapterConfig {
  /** LLM provider to use */
  provider: 'openrouter' | 'ollama' | 'anthropic' | 'openai';
  /** Model identifier */
  model: string;
  /** Base URL for the provider */
  baseUrl: string;
  /** API key (from environment) */
  apiKey?: string;
  /** Temperature for generation */
  temperature: number;
  /** Max tokens for response */
  maxTokens: number;
  /** Timeout in milliseconds */
  timeoutMs: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default configuration for the Universal Adapter
 * Uses GPT5.2-codex via OpenRouter for protocol translation tasks
 */
export const DEFAULT_UNIVERSAL_ADAPTER_CONFIG: UniversalAdapterConfig = {
  provider: 'openrouter',
  model: 'openai/gpt-5.2-codex',
  baseUrl: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  temperature: 0.1, // Low temperature for deterministic translations
  maxTokens: 8192,
  timeoutMs: 60000,
};

/**
 * Alternative configurations for different use cases
 */
export const UNIVERSAL_ADAPTER_PRESETS: Record<string, Partial<UniversalAdapterConfig>> = {
  /** Default: GPT5.2-codex for high-quality protocol translation */
  default: {
    provider: 'openrouter',
    model: 'openai/gpt-5.2-codex',
  },
  /** Fast: Use a smaller model for quick translations */
  fast: {
    provider: 'openrouter',
    model: 'anthropic/claude-3-haiku',
    temperature: 0.1,
    maxTokens: 4096,
  },
  /** Local: Use Ollama for offline operation */
  local: {
    provider: 'ollama',
    model: 'phi4-mini',
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    temperature: 0.1,
  },
  /** Premium: Use Claude for complex translations */
  premium: {
    provider: 'openrouter',
    model: 'anthropic/claude-sonnet-4',
    temperature: 0.05,
    maxTokens: 16384,
  },
};

// ============================================================================
// LLM Provider Factory
// ============================================================================

/**
 * Create an LLM provider for the Universal Adapter
 */
export function createLLMProvider(config: UniversalAdapterConfig = DEFAULT_UNIVERSAL_ADAPTER_CONFIG): LLMProvider {
  return {
    async complete(prompt: string): Promise<Record<string, unknown>> {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

      try {
        let response: Response;
        let body: Record<string, unknown>;

        if (config.provider === 'ollama') {
          // Ollama API
          response = await fetch(`${config.baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: config.model,
              prompt,
              stream: false,
              options: {
                temperature: config.temperature,
                num_predict: config.maxTokens,
              },
            }),
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status}`);
          }

          const data = await response.json();
          // Parse JSON from response
          try {
            return JSON.parse(data.response);
          } catch {
            return { raw: data.response };
          }
        } else {
          // OpenRouter / OpenAI compatible API
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          
          if (config.apiKey) {
            headers['Authorization'] = `Bearer ${config.apiKey}`;
          }
          
          if (config.provider === 'openrouter') {
            headers['HTTP-Referer'] = 'https://chrysalis.dev';
            headers['X-Title'] = 'Chrysalis Universal Adapter';
          }

          response = await fetch(`${config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model: config.model,
              messages: [
                {
                  role: 'system',
                  content: 'You are a protocol translation expert. Always respond with valid JSON.',
                },
                {
                  role: 'user',
                  content: prompt,
                },
              ],
              temperature: config.temperature,
              max_tokens: config.maxTokens,
              response_format: { type: 'json_object' },
            }),
            signal: controller.signal,
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error ${response.status}: ${errorText}`);
          }

          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          
          if (!content) {
            throw new Error('No content in API response');
          }

          // Parse JSON from response
          try {
            return JSON.parse(content);
          } catch {
            return { raw: content };
          }
        }
      } finally {
        clearTimeout(timeoutId);
      }
    },
  };
}

/**
 * Create an LLM provider with a preset configuration
 */
export function createLLMProviderWithPreset(preset: keyof typeof UNIVERSAL_ADAPTER_PRESETS): LLMProvider {
  const presetConfig = UNIVERSAL_ADAPTER_PRESETS[preset];
  const config: UniversalAdapterConfig = {
    ...DEFAULT_UNIVERSAL_ADAPTER_CONFIG,
    ...presetConfig,
  };
  return createLLMProvider(config);
}

// ============================================================================
// Convenience Exports
// ============================================================================

export { UniversalAdapter, createUniversalAdapter } from '../adapters/universal';

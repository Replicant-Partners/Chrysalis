/**
 * LLM Provider Configuration
 * 
 * Centralized configuration for LLM providers with Ollama as the default.
 * Supports configurable fallback to cloud providers.
 * 
 * Priority order (configurable):
 * 1. Ollama (local) - default for system agents
 * 2. OpenRouter (cloud fallback)
 * 3. Direct provider APIs (Anthropic, OpenAI) - deprecated
 * 
 * @module config/llm-providers
 */

import { OLLAMA_CONFIG, DEFAULT_ADA_MODEL, OLLAMA_MODELS } from './ollama-models';

// ============================================================================
// Types
// ============================================================================

export type ProviderType = 'ollama' | 'openrouter' | 'anthropic' | 'openai' | 'huggingface' | 'mock';

export interface ProviderConfig {
  type: ProviderType;
  baseUrl: string;
  apiKey?: string;
  defaultModel: string;
  enabled: boolean;
  priority: number;
}

export interface LLMProviderSettings {
  /** Primary provider (default: ollama) */
  primary: ProviderType;
  /** Fallback provider if primary fails */
  fallback?: ProviderType;
  /** Provider-specific configurations */
  providers: Record<ProviderType, ProviderConfig>;
  /** Enable automatic fallback on failure */
  autoFallback: boolean;
  /** Timeout in ms before falling back */
  fallbackTimeoutMs: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default LLM provider settings
 * Ollama is the primary provider for local inference
 */
export const DEFAULT_LLM_SETTINGS: LLMProviderSettings = {
  primary: 'ollama',
  fallback: 'openrouter',
  autoFallback: true,
  fallbackTimeoutMs: 30000,
  providers: {
    ollama: {
      type: 'ollama',
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      defaultModel: DEFAULT_ADA_MODEL,
      enabled: true,
      priority: 1,
    },
    openrouter: {
      type: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultModel: 'anthropic/claude-3-haiku',
      enabled: !!process.env.OPENROUTER_API_KEY,
      priority: 2,
    },
    anthropic: {
      type: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      apiKey: process.env.ANTHROPIC_API_KEY,
      defaultModel: 'claude-3-haiku-20240307',
      enabled: false, // Deprecated - use OpenRouter instead
      priority: 99,
    },
    openai: {
      type: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY,
      defaultModel: 'gpt-4o-mini',
      enabled: false, // Deprecated - use OpenRouter instead
      priority: 99,
    },
    huggingface: {
      type: 'huggingface',
      baseUrl: 'https://api-inference.huggingface.co',
      apiKey: process.env.HUGGINGFACE_API_KEY,
      defaultModel: 'meta-llama/Llama-3.2-3B-Instruct',
      enabled: !!process.env.HUGGINGFACE_API_KEY,
      priority: 3,
    },
    mock: {
      type: 'mock',
      baseUrl: '',
      defaultModel: 'mock',
      enabled: process.env.NODE_ENV === 'test',
      priority: 100,
    },
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the active provider configuration
 * @param settings
 */
export function getActiveProvider(settings: LLMProviderSettings = DEFAULT_LLM_SETTINGS): ProviderConfig {
  const primary = settings.providers[settings.primary];
  if (primary.enabled) {
    return primary;
  }
  
  // Fall back to next enabled provider by priority
  const enabledProviders = Object.values(settings.providers)
    .filter(p => p.enabled)
    .sort((a, b) => a.priority - b.priority);
  
  if (enabledProviders.length === 0) {
    throw new Error('No LLM providers are enabled. Please configure at least one provider.');
  }
  
  return enabledProviders[0];
}

/**
 * Get fallback provider if configured
 * @param settings
 */
export function getFallbackProvider(settings: LLMProviderSettings = DEFAULT_LLM_SETTINGS): ProviderConfig | null {
  if (!settings.fallback || !settings.autoFallback) {
    return null;
  }
  
  const fallback = settings.providers[settings.fallback];
  return fallback.enabled ? fallback : null;
}

/**
 * Check if Ollama is available
 * @param baseUrl
 */
export async function isOllamaAvailable(baseUrl: string = OLLAMA_CONFIG.baseUrl): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get available Ollama models
 * @param baseUrl
 */
export async function getAvailableOllamaModels(baseUrl: string = OLLAMA_CONFIG.baseUrl): Promise<string[]> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`);
    if (!response.ok) {return [];}
    
    const data = await response.json();
    return (data.models || []).map((m: { name: string }) => m.name);
  } catch {
    return [];
  }
}

/**
 * Create provider settings from environment
 */
export function createSettingsFromEnv(): LLMProviderSettings {
  const settings = { ...DEFAULT_LLM_SETTINGS };
  
  // Override primary if specified
  const primaryEnv = process.env.LLM_PRIMARY_PROVIDER as ProviderType | undefined;
  if (primaryEnv && settings.providers[primaryEnv]) {
    settings.primary = primaryEnv;
  }
  
  // Override fallback if specified
  const fallbackEnv = process.env.LLM_FALLBACK_PROVIDER as ProviderType | undefined;
  if (fallbackEnv && settings.providers[fallbackEnv]) {
    settings.fallback = fallbackEnv;
  }
  
  // Disable auto-fallback if specified
  if (process.env.LLM_DISABLE_FALLBACK === 'true') {
    settings.autoFallback = false;
  }
  
  return settings;
}

// ============================================================================
// Gateway Integration
// ============================================================================

/**
 * Format provider config for Go Gateway
 * @param provider
 */
export function toGatewayConfig(provider: ProviderConfig): {
  provider: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
} {
  return {
    provider: provider.type,
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    model: provider.defaultModel,
  };
}

/**
 * Get gateway configuration with Ollama as default
 * @param settings
 */
export function getGatewayConfig(settings: LLMProviderSettings = DEFAULT_LLM_SETTINGS) {
  const active = getActiveProvider(settings);
  const fallback = getFallbackProvider(settings);
  
  return {
    primary: toGatewayConfig(active),
    fallback: fallback ? toGatewayConfig(fallback) : null,
    autoFallback: settings.autoFallback,
    fallbackTimeoutMs: settings.fallbackTimeoutMs,
  };
}

// ============================================================================
// Exports
// ============================================================================

export { OLLAMA_CONFIG, DEFAULT_ADA_MODEL, OLLAMA_MODELS };

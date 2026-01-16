/**
 * Ollama Local Model Configuration
 * 
 * Defines available local LLM models for testing and development.
 * All models are in the ~3GB class for optimal local performance.
 * 
 * Start Ollama: `ollama run <model-name>`
 * Example: `ollama run ministral-3:3b`
 * 
 * @module config/ollama-models
 */

export interface OllamaModelConfig {
  name: string;
  displayName: string;
  size: string;
  sizeBytes: number;
  description: string;
  recommended: boolean;
  capabilities: string[];
}

/**
 * Available 3GB-class Ollama models for Ada and system agents
 */
export const OLLAMA_MODELS: Record<string, OllamaModelConfig> = {
  'ministral-3:3b': {
    name: 'ministral-3:3b',
    displayName: 'Ministral 3B',
    size: '3.0 GB',
    sizeBytes: 3_000_000_000,
    description: 'Default model for Ada. Balanced performance and efficiency.',
    recommended: true,
    capabilities: ['chat', 'reasoning', 'code-understanding', 'assistance'],
  },
  'granite4:3b': {
    name: 'granite4:3b',
    displayName: 'Granite 3B',
    size: '2.1 GB',
    sizeBytes: 2_100_000_000,
    description: 'IBM Granite model optimized for enterprise tasks.',
    recommended: false,
    capabilities: ['chat', 'reasoning', 'structured-output'],
  },
  'qwen3:4b': {
    name: 'qwen3:4b',
    displayName: 'Qwen 4B',
    size: '2.5 GB',
    sizeBytes: 2_500_000_000,
    description: 'Alibaba Qwen model with strong multilingual support.',
    recommended: false,
    capabilities: ['chat', 'reasoning', 'multilingual', 'code'],
  },
  'llama3.2:latest': {
    name: 'llama3.2:latest',
    displayName: 'Llama 3.2',
    size: '2.0 GB',
    sizeBytes: 2_000_000_000,
    description: 'Meta Llama 3.2 - efficient and versatile.',
    recommended: false,
    capabilities: ['chat', 'reasoning', 'general-purpose'],
  },
  'gemma3:latest': {
    name: 'gemma3:latest',
    displayName: 'Gemma 3',
    size: '3.3 GB',
    sizeBytes: 3_300_000_000,
    description: 'Google Gemma - strong reasoning capabilities.',
    recommended: false,
    capabilities: ['chat', 'reasoning', 'code', 'analysis'],
  },
  'deepseek-r1:1.5b': {
    name: 'deepseek-r1:1.5b',
    displayName: 'DeepSeek R1 1.5B',
    size: '1.1 GB',
    sizeBytes: 1_100_000_000,
    description: 'DeepSeek reasoning model - compact and fast.',
    recommended: false,
    capabilities: ['reasoning', 'chat', 'code'],
  },
  'smollm:1.7b': {
    name: 'smollm:1.7b',
    displayName: 'SmolLM 1.7B',
    size: '990 MB',
    sizeBytes: 990_000_000,
    description: 'Ultra-compact model for lightweight tasks.',
    recommended: false,
    capabilities: ['chat', 'basic-reasoning'],
  },
};

/**
 * Default model for Ada system agent
 */
export const DEFAULT_ADA_MODEL = 'ministral-3:3b';

/**
 * Ollama provider configuration
 */
export const OLLAMA_CONFIG = {
  baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  provider: 'ollama' as const,
  defaultModel: DEFAULT_ADA_MODEL,
};

/**
 * Get model configuration by name
 */
export function getOllamaModel(modelName: string): OllamaModelConfig | undefined {
  return OLLAMA_MODELS[modelName];
}

/**
 * Get all recommended models
 */
export function getRecommendedModels(): OllamaModelConfig[] {
  return Object.values(OLLAMA_MODELS).filter(m => m.recommended);
}

/**
 * Get models by capability
 */
export function getModelsByCapability(capability: string): OllamaModelConfig[] {
  return Object.values(OLLAMA_MODELS).filter(m => 
    m.capabilities.includes(capability)
  );
}

/**
 * Format model name for gateway (includes provider prefix)
 */
export function formatModelForGateway(modelName: string): string {
  // Gateway expects format: "ollama:ministral-3:3b" or just "ministral-3:3b"
  // if provider routing is configured
  return modelName;
}
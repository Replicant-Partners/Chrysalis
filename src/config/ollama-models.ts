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
  'phi4-mini': {
    name: 'phi4-mini',
    displayName: 'Phi-4 Mini',
    size: '2.5 GB',
    sizeBytes: 2_500_000_000,
    description: 'Default model for system agents. Microsoft Phi-4 with strong reasoning.',
    recommended: true,
    capabilities: ['chat', 'reasoning', 'code', 'analysis', 'assistance'],
  },
  'mistral3:3b': {
    name: 'mistral3:3b',
    displayName: 'Mistral 3B',
    size: '2.0 GB',
    sizeBytes: 2_000_000_000,
    description: 'Alternative local model. Mistral with efficient inference.',
    recommended: true,
    capabilities: ['chat', 'reasoning', 'code', 'multilingual'],
  },
  'gemma3n': {
    name: 'gemma3n',
    displayName: 'Gemma 3N',
    size: '2.3 GB',
    sizeBytes: 2_300_000_000,
    description: 'Alternative local model. Google Gemma optimized variant.',
    recommended: true,
    capabilities: ['chat', 'reasoning', 'code', 'analysis'],
  },
  'ministral-3:3b': {
    name: 'ministral-3:3b',
    displayName: 'Ministral 3B',
    size: '3.0 GB',
    sizeBytes: 3_000_000_000,
    description: 'Legacy default. Balanced performance and efficiency.',
    recommended: false,
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
 * Default model for system agents (phi4-mini)
 */
export const DEFAULT_SYSTEM_AGENT_MODEL = 'phi4-mini';

/**
 * Alternative local models for system agents
 */
export const SYSTEM_AGENT_MODEL_OPTIONS = ['phi4-mini', 'mistral3:3b', 'gemma3n'] as const;

/**
 * @deprecated Use DEFAULT_SYSTEM_AGENT_MODEL instead
 */
export const DEFAULT_ADA_MODEL = DEFAULT_SYSTEM_AGENT_MODEL;

/**
 * Ollama provider configuration
 */
export const OLLAMA_CONFIG = {
  baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  provider: 'ollama' as const,
  defaultModel: DEFAULT_SYSTEM_AGENT_MODEL,
  systemAgentModels: SYSTEM_AGENT_MODEL_OPTIONS,
};

/**
 * Get model configuration by name
 * @param modelName
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
 * @param capability
 */
export function getModelsByCapability(capability: string): OllamaModelConfig[] {
  return Object.values(OLLAMA_MODELS).filter(m => 
    m.capabilities.includes(capability)
  );
}

/**
 * Format model name for gateway (includes provider prefix)
 * @param modelName
 */
export function formatModelForGateway(modelName: string): string {
  // Gateway expects format: "ollama:ministral-3:3b" or just "ministral-3:3b"
  // if provider routing is configured
  return modelName;
}
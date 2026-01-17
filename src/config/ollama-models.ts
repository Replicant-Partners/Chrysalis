/**
 * Ollama Local Model Configuration
 *
 * Defines available local LLM models for testing and development.
 * Primary selection pool targets 3GB class (±15%: 2.55-3.45 GB) for optimal
 * local performance on systems with 8-16GB RAM.
 *
 * Start Ollama: `ollama run <model-name>`
 * Example: `ollama run ministral-3:3b`
 *
 * @see docs/research/OLLAMA_3GB_MODEL_AUDIT_AND_COMPARISON.md
 * @module config/ollama-models
 */

export interface OllamaModelBenchmarks {
  mmlu?: number;
  math500?: number;
  humaneval?: number;
  arenaHard?: number;
  aime?: number;
  gpqa?: number;
  triviaqa?: number;
  simpleqa?: number;
}

export interface OllamaModelConfig {
  name: string;
  displayName: string;
  size: string;
  sizeBytes: number;
  description: string;
  recommended: boolean;
  capabilities: string[];
  /** Benchmark scores for comparison (values are percentages) */
  benchmarks?: OllamaModelBenchmarks;
}

/**
 * Available Ollama models for Ada and system agents
 *
 * Primary 3GB Cohort (±15%: 2.55-3.45 GB deployed size):
 * - ministral-3:3b (default) - Best overall balance
 * - gemma3:latest - Vision + reasoning
 * - phi4-mini-reasoning - Math/science specialist
 *
 * @see docs/research/OLLAMA_3GB_MODEL_AUDIT_AND_COMPARISON.md
 */
export const OLLAMA_MODELS: Record<string, OllamaModelConfig> = {
  // === PRIMARY 3GB COHORT ===
  'ministral-3:3b': {
    name: 'ministral-3:3b',
    displayName: 'Ministral 3B',
    size: '3.0 GB',
    sizeBytes: 3_000_000_000,
    description: 'Default for Ada. Best overall balance of reasoning, code, and tool use. Native function calling and vision.',
    recommended: true,
    capabilities: ['chat', 'reasoning', 'code', 'tools', 'vision', 'multilingual'],
    benchmarks: { mmlu: 70.7, math500: 83.0, humaneval: 77.4, arenaHard: 30.5 },
  },
  'gemma3:latest': {
    name: 'gemma3:latest',
    displayName: 'Gemma 3 4B',
    size: '3.3 GB',
    sizeBytes: 3_300_000_000,
    description: 'Google model with strong vision capability. Best for document/image analysis.',
    recommended: false,
    capabilities: ['chat', 'reasoning', 'vision', 'analysis'],
    benchmarks: { mmlu: 58.9, triviaqa: 64.0 },
  },
  'phi4-mini-reasoning:latest': {
    name: 'phi4-mini-reasoning:latest',
    displayName: 'Phi-4 Mini Reasoning',
    size: '3.2 GB',
    sizeBytes: 3_200_000_000,
    description: 'Microsoft reasoning specialist. Best for math/science tasks with 94.6% MATH-500.',
    recommended: false,
    capabilities: ['reasoning', 'math', 'science', 'chat'],
    benchmarks: { math500: 94.6, aime: 57.5, gpqa: 52.0 },
  },

  // === SUPPORTING MODELS (Near 3GB threshold) ===
  'qwen3:4b': {
    name: 'qwen3:4b',
    displayName: 'Qwen 4B',
    size: '2.5 GB',
    sizeBytes: 2_500_000_000,
    description: 'Strong multilingual with dual thinking/non-thinking modes. 100+ languages.',
    recommended: false,
    capabilities: ['chat', 'reasoning', 'multilingual', 'code', 'tools', 'thinking'],
    benchmarks: { mmlu: 71.3 },
  },
  'granite4:3b': {
    name: 'granite4:3b',
    displayName: 'Granite 3B',
    size: '2.1 GB',
    sizeBytes: 2_100_000_000,
    description: 'IBM enterprise model with native tool calling. Good for structured output.',
    recommended: false,
    capabilities: ['chat', 'reasoning', 'tools', 'structured-output'],
  },
  'granite3.2-vision:latest': {
    name: 'granite3.2-vision:latest',
    displayName: 'Granite 3.2 Vision',
    size: '2.4 GB',
    sizeBytes: 2_400_000_000,
    description: 'IBM vision-capable model with tools support. Limited 16k context.',
    recommended: false,
    capabilities: ['chat', 'reasoning', 'tools', 'vision'],
  },
  'llama3.2:latest': {
    name: 'llama3.2:latest',
    displayName: 'Llama 3.2 3B',
    size: '2.0 GB',
    sizeBytes: 2_000_000_000,
    description: 'Meta baseline. Versatile general-purpose with tool calling.',
    recommended: false,
    capabilities: ['chat', 'reasoning', 'tools', 'general-purpose'],
    benchmarks: { mmlu: 59.65, humaneval: 62.8 },
  },
  'phi3:3.8b': {
    name: 'phi3:3.8b',
    displayName: 'Phi-3 3.8B',
    size: '2.2 GB',
    sizeBytes: 2_200_000_000,
    description: 'Microsoft Phi-3. Predecessor to Phi-4, still capable for general tasks.',
    recommended: false,
    capabilities: ['chat', 'reasoning', 'code'],
    benchmarks: { mmlu: 68.9 },
  },

  // === EXTENDED REASONING MODELS ===
  'smallthinker:3b': {
    name: 'smallthinker:3b',
    displayName: 'SmallThinker 3B',
    size: '3.6 GB',
    sizeBytes: 3_600_000_000,
    description: 'Qwen2.5-based reasoning model. Best for math competitions with 150% AIME improvement over base.',
    recommended: false,
    capabilities: ['reasoning', 'math', 'thinking', 'edge-deployment'],
    benchmarks: { aime: 16.67, mmlu: 68.2 },
  },
  // NOTE: jan-nano not on Ollama official library. Use via:
  // - Jan app (jan.ai) - native support
  // - GGUF: huggingface.co/Menlo/Jan-nano-gguf
  // - vLLM: vllm serve Menlo/Jan-nano --enable-auto-tool-choice
  'jan-nano:4b': {
    name: 'jan-nano:4b',
    displayName: 'Jan Nano 4B',
    size: '3.0 GB',
    sizeBytes: 3_000_000_000,
    description: 'Menlo Research deep research model. 83.2% SimpleQA with MCP. Outperforms 671B models on fact retrieval.',
    recommended: false,
    capabilities: ['research', 'tools', 'mcp', 'web-search', 'fact-checking'],
    benchmarks: { simpleqa: 83.2 },
  },
  'olmo3:7b': {
    name: 'olmo3:7b',
    displayName: 'OLMo 3 7B Think',
    size: '4.5 GB',
    sizeBytes: 4_500_000_000,
    description: 'Allen Institute open-science model. Fully reproducible with training data. Best for auditable research.',
    recommended: false,
    capabilities: ['reasoning', 'math', 'code', 'research', 'thinking'],
    benchmarks: { math500: 95.1, aime: 71.6, humaneval: 77.2 },
  },

  // === COMPACT MODELS (Speed-optimized) ===
  'deepseek-r1:1.5b': {
    name: 'deepseek-r1:1.5b',
    displayName: 'DeepSeek R1 1.5B',
    size: '1.1 GB',
    sizeBytes: 1_100_000_000,
    description: 'Compact reasoning with chain-of-thought. Good for simple reasoning tasks.',
    recommended: false,
    capabilities: ['reasoning', 'chat', 'thinking'],
  },
  'smollm:1.7b': {
    name: 'smollm:1.7b',
    displayName: 'SmolLM 1.7B',
    size: '990 MB',
    sizeBytes: 990_000_000,
    description: 'Ultra-compact for routing and quick tasks. Very limited 2k context.',
    recommended: false,
    capabilities: ['chat', 'basic-reasoning', 'fast'],
  },
  'qwen3:1.7b': {
    name: 'qwen3:1.7b',
    displayName: 'Qwen 1.7B',
    size: '1.4 GB',
    sizeBytes: 1_400_000_000,
    description: 'Compact Qwen with thinking mode. Better than SmolLM for reasoning.',
    recommended: false,
    capabilities: ['chat', 'reasoning', 'tools', 'thinking', 'multilingual'],
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
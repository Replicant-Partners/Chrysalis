/**
 * Chrysalis Centralized Configuration Module (C-4)
 * 
 * Single source of truth for all configuration across TypeScript services.
 * Follows the Facade pattern to provide a unified interface over multiple
 * configuration sources (environment variables, config files, defaults).
 * 
 * @module config
 * @see plans/CHRYSALIS_DEVELOPMENT_STREAMLINING_PLAN.md - Item C-4
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Environment configuration with validated types
 */
export interface EnvironmentConfig {
  /** Node environment */
  nodeEnv: 'development' | 'production' | 'test';
  /** Debug mode enabled */
  debug: boolean;
  /** Log level */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * LLM provider configuration
 */
export interface LLMConfig {
  /** OpenAI API key */
  openaiApiKey?: string;
  /** Anthropic API key */
  anthropicApiKey?: string;
  /** Default model to use */
  defaultModel: string;
  /** Request timeout in milliseconds */
  timeoutMs: number;
  /** Max retries for failed requests */
  maxRetries: number;
}

/**
 * Memory system configuration
 */
export interface MemoryConfig {
  /** Embedding model name */
  embeddingModel: string;
  /** Embedding dimensions */
  embeddingDimensions: number;
  /** Vector store type */
  vectorStoreType: 'chroma' | 'lance' | 'faiss';
  /** Storage path for vector store */
  storagePath: string;
  /** Working memory buffer size */
  workingMemorySize: number;
  /** Default retrieval limit */
  defaultRetrievalLimit: number;
  /** Similarity threshold for retrieval */
  similarityThreshold: number;
}

/**
 * Service configuration
 */
export interface ServiceConfig {
  /** Service name */
  name: string;
  /** Service port */
  port: number;
  /** Service host */
  host: string;
  /** Health check endpoint */
  healthEndpoint: string;
}

/**
 * Observability configuration
 */
export interface ObservabilityConfig {
  /** Enable OpenTelemetry */
  enabled: boolean;
  /** OTLP endpoint URL */
  otlpEndpoint: string;
  /** Service name for tracing */
  serviceName: string;
  /** Sampling rate (0.0 - 1.0) */
  samplingRate: number;
  /** Enable metrics collection */
  metricsEnabled: boolean;
  /** Metrics port */
  metricsPort: number;
}

/**
 * Complete application configuration
 */
export interface ChrysalisConfig {
  environment: EnvironmentConfig;
  llm: LLMConfig;
  memory: MemoryConfig;
  services: {
    ledger: ServiceConfig;
    projection: ServiceConfig;
    grounding: ServiceConfig;
    skillforge: ServiceConfig;
    gateway: ServiceConfig;
  };
  observability: ObservabilityConfig;
}

/**
 * Default configuration values
 */
const DEFAULTS: ChrysalisConfig = {
  environment: {
    nodeEnv: 'development',
    debug: false,
    logLevel: 'info',
  },
  llm: {
    defaultModel: 'gpt-4o',
    timeoutMs: 30000,
    maxRetries: 3,
  },
  memory: {
    embeddingModel: 'openai/text-embedding-3-small',
    embeddingDimensions: 1536,
    vectorStoreType: 'chroma',
    storagePath: './data/memory',
    workingMemorySize: 10,
    defaultRetrievalLimit: 5,
    similarityThreshold: 0.7,
  },
  services: {
    ledger: {
      name: 'chrysalis-ledger',
      port: 3001,
      host: '0.0.0.0',
      healthEndpoint: '/health',
    },
    projection: {
      name: 'chrysalis-projection',
      port: 3002,
      host: '0.0.0.0',
      healthEndpoint: '/health',
    },
    grounding: {
      name: 'chrysalis-grounding',
      port: 3003,
      host: '0.0.0.0',
      healthEndpoint: '/health',
    },
    skillforge: {
      name: 'chrysalis-skillforge',
      port: 3004,
      host: '0.0.0.0',
      healthEndpoint: '/health',
    },
    gateway: {
      name: 'chrysalis-gateway',
      port: 3000,
      host: '0.0.0.0',
      healthEndpoint: '/health',
    },
  },
  observability: {
    enabled: false,
    otlpEndpoint: 'http://localhost:4318',
    serviceName: 'chrysalis',
    samplingRate: 0.1,
    metricsEnabled: false,
    metricsPort: 9090,
  },
};

/**
 * Configuration singleton instance
 */
let configInstance: ChrysalisConfig | null = null;

/**
 * Parse boolean from environment variable
 */
function parseEnvBool(value: string | undefined, defaultVal: boolean): boolean {
  if (value === undefined) return defaultVal;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Parse integer from environment variable
 */
function parseEnvInt(value: string | undefined, defaultVal: number): number {
  if (value === undefined) return defaultVal;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultVal : parsed;
}

/**
 * Parse float from environment variable
 */
function parseEnvFloat(value: string | undefined, defaultVal: number): number {
  if (value === undefined) return defaultVal;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultVal : parsed;
}

/**
 * Load configuration from environment variables
 */
function loadFromEnvironment(): Partial<ChrysalisConfig> {
  return {
    environment: {
      nodeEnv: (process.env.NODE_ENV as EnvironmentConfig['nodeEnv']) || DEFAULTS.environment.nodeEnv,
      debug: parseEnvBool(process.env.CHRYSALIS_DEBUG, DEFAULTS.environment.debug),
      logLevel: (process.env.CHRYSALIS_LOG_LEVEL as EnvironmentConfig['logLevel']) || DEFAULTS.environment.logLevel,
    },
    llm: {
      openaiApiKey: process.env.OPENAI_API_KEY,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      defaultModel: process.env.CHRYSALIS_LLM_MODEL || DEFAULTS.llm.defaultModel,
      timeoutMs: parseEnvInt(process.env.CHRYSALIS_LLM_TIMEOUT_MS, DEFAULTS.llm.timeoutMs),
      maxRetries: parseEnvInt(process.env.CHRYSALIS_LLM_MAX_RETRIES, DEFAULTS.llm.maxRetries),
    },
    memory: {
      embeddingModel: process.env.CHRYSALIS_EMBEDDING_MODEL || DEFAULTS.memory.embeddingModel,
      embeddingDimensions: parseEnvInt(process.env.CHRYSALIS_EMBEDDING_DIMENSIONS, DEFAULTS.memory.embeddingDimensions),
      vectorStoreType: (process.env.CHRYSALIS_VECTOR_STORE as MemoryConfig['vectorStoreType']) || DEFAULTS.memory.vectorStoreType,
      storagePath: process.env.CHRYSALIS_STORAGE_PATH || DEFAULTS.memory.storagePath,
      workingMemorySize: parseEnvInt(process.env.CHRYSALIS_WORKING_MEMORY_SIZE, DEFAULTS.memory.workingMemorySize),
      defaultRetrievalLimit: parseEnvInt(process.env.CHRYSALIS_RETRIEVAL_LIMIT, DEFAULTS.memory.defaultRetrievalLimit),
      similarityThreshold: parseEnvFloat(process.env.CHRYSALIS_SIMILARITY_THRESHOLD, DEFAULTS.memory.similarityThreshold),
    },
    observability: {
      enabled: parseEnvBool(process.env.OTEL_SDK_DISABLED, false) ? false : parseEnvBool(process.env.CHRYSALIS_OTEL_ENABLED, DEFAULTS.observability.enabled),
      otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || DEFAULTS.observability.otlpEndpoint,
      serviceName: process.env.OTEL_SERVICE_NAME || DEFAULTS.observability.serviceName,
      samplingRate: parseEnvFloat(process.env.CHRYSALIS_OTEL_SAMPLING_RATE, DEFAULTS.observability.samplingRate),
      metricsEnabled: parseEnvBool(process.env.CHRYSALIS_METRICS_ENABLED, DEFAULTS.observability.metricsEnabled),
      metricsPort: parseEnvInt(process.env.CHRYSALIS_METRICS_PORT, DEFAULTS.observability.metricsPort),
    },
  };
}

/**
 * Load configuration from a JSON file
 */
function loadFromFile(filePath: string): Partial<ChrysalisConfig> {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn(`Warning: Failed to load config file ${filePath}:`, error);
  }
  return {};
}

/**
 * Deep merge configuration objects
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] !== undefined) {
      if (typeof source[key] === 'object' && !Array.isArray(source[key]) && source[key] !== null) {
        result[key] = deepMerge(
          result[key] || ({} as Record<string, unknown>), 
          source[key] as Record<string, unknown>
        );
      } else {
        result[key] = source[key];
      }
    }
  }
  
  return result;
}

/**
 * Initialize configuration from all sources
 * Priority: Environment > Config File > Defaults
 */
export function initializeConfig(configFilePath?: string): ChrysalisConfig {
  // Start with defaults
  let config: ChrysalisConfig = { ...DEFAULTS };
  
  // Merge config file if provided
  if (configFilePath) {
    const fileConfig = loadFromFile(configFilePath);
    config = deepMerge(config, fileConfig);
  } else {
    // Try default config file locations
    const defaultPaths = [
      path.join(process.cwd(), 'chrysalis.config.json'),
      path.join(process.cwd(), '.chrysalis/config.json'),
      path.join(process.cwd(), 'config/chrysalis.json'),
    ];
    
    for (const defaultPath of defaultPaths) {
      if (fs.existsSync(defaultPath)) {
        const fileConfig = loadFromFile(defaultPath);
        config = deepMerge(config, fileConfig);
        break;
      }
    }
  }
  
  // Merge environment variables (highest priority)
  const envConfig = loadFromEnvironment();
  config = deepMerge(config, envConfig);
  
  // Cache the instance
  configInstance = config;
  
  return config;
}

/**
 * Get the current configuration instance
 * Initializes with defaults if not already initialized
 */
export function getConfig(): ChrysalisConfig {
  if (!configInstance) {
    configInstance = initializeConfig();
  }
  return configInstance;
}

/**
 * Reset configuration (primarily for testing)
 */
export function resetConfig(): void {
  configInstance = null;
}

/**
 * Get a specific configuration section
 */
export function getConfigSection<K extends keyof ChrysalisConfig>(section: K): ChrysalisConfig[K] {
  return getConfig()[section];
}

/**
 * Validate configuration for required fields
 */
export function validateConfig(config: ChrysalisConfig = getConfig()): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate LLM config - at least one API key should be present for production
  if (config.environment.nodeEnv === 'production') {
    if (!config.llm.openaiApiKey && !config.llm.anthropicApiKey) {
      errors.push('Production mode requires at least one LLM API key (OPENAI_API_KEY or ANTHROPIC_API_KEY)');
    }
  }
  
  // Validate observability config
  if (config.observability.enabled) {
    if (!config.observability.otlpEndpoint) {
      errors.push('Observability enabled but OTLP endpoint not configured');
    }
    if (config.observability.samplingRate < 0 || config.observability.samplingRate > 1) {
      errors.push('Sampling rate must be between 0.0 and 1.0');
    }
  }
  
  // Validate memory config
  if (config.memory.similarityThreshold < 0 || config.memory.similarityThreshold > 1) {
    errors.push('Similarity threshold must be between 0.0 and 1.0');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Export configuration to JSON (for debugging)
 */
export function exportConfig(config: ChrysalisConfig = getConfig()): string {
  // Mask sensitive values
  const masked = {
    ...config,
    llm: {
      ...config.llm,
      openaiApiKey: config.llm.openaiApiKey ? '***' : undefined,
      anthropicApiKey: config.llm.anthropicApiKey ? '***' : undefined,
    },
  };
  return JSON.stringify(masked, null, 2);
}

// Export default config for reference
export { DEFAULTS as defaultConfig };
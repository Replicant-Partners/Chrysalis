/**
 * LLM Hydration Service Types
 * 
 * Type definitions for the LLM Hydration Service that provides
 * agents with access to LLM providers.
 * 
 * @module LLMTypes
 * @version 1.0.0
 */

// =============================================================================
// MESSAGE TYPES
// =============================================================================

/**
 * Role in a conversation
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * A message in a conversation
 */
export interface Message {
  role: MessageRole;
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

/**
 * Tool call representation
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Tool definition for function calling
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// =============================================================================
// REQUEST/RESPONSE TYPES
// =============================================================================

/**
 * Completion request
 */
export interface CompletionRequest {
  /** Conversation messages */
  messages: Message[];

  /** Model to use (optional, uses default if not specified) */
  model?: string;

  /** Temperature for generation (0-2) */
  temperature?: number;

  /** Maximum tokens to generate */
  maxTokens?: number;

  /** Stop sequences */
  stop?: string[];

  /** Tools available for function calling */
  tools?: ToolDefinition[];

  /** Tool choice preference */
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };

  /** Agent ID for cost tracking */
  agentId: string;

  /** Optional metadata for tracking */
  metadata?: Record<string, unknown>;
}

/**
 * Token usage information
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Completion response
 */
export interface CompletionResponse {
  /** Generated content */
  content: string;

  /** Model used */
  model: string;

  /** Finish reason */
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;

  /** Tool calls if any */
  toolCalls?: ToolCall[];

  /** Token usage */
  usage: TokenUsage;

  /** Estimated cost in USD */
  estimatedCost: number;

  /** Provider used */
  provider: string;

  /** Response ID for tracking */
  id: string;
}

/**
 * Streaming completion chunk
 */
export interface CompletionChunk {
  /** Chunk content */
  content: string;

  /** Is this the final chunk? */
  done: boolean;

  /** Finish reason (only on final chunk) */
  finishReason?: CompletionResponse['finishReason'];

  /** Token usage (only on final chunk) */
  usage?: TokenUsage;

  /** Tool calls delta */
  toolCallsDelta?: Partial<ToolCall>[];
}

// =============================================================================
// PROVIDER TYPES
// =============================================================================

/**
 * Provider identifier
 */
export type ProviderId = 'openai' | 'anthropic' | 'ollama';

/**
 * Provider configuration
 */
export interface ProviderConfig {
  /** Provider identifier */
  id: ProviderId;

  /** API key (not needed for Ollama/local) */
  apiKey?: string;

  /** Base URL override */
  baseUrl?: string;

  /** Default model for this provider */
  defaultModel: string;

  /** Available models */
  models: string[];

  /** Whether provider is enabled */
  enabled: boolean;

  /** Priority (lower = higher priority) */
  priority: number;

  /** Rate limit per minute */
  rateLimit?: number;
}

/**
 * Provider status
 */
export interface ProviderStatus {
  id: ProviderId;
  available: boolean;
  lastCheck: Date;
  error?: string;
  latencyMs?: number;
  circuitState?: string;
}

/**
 * Provider interface that adapters must implement
 */
export interface LLMProvider {
  /** Provider identifier */
  readonly id: ProviderId;

  /** Check if provider is available */
  isAvailable(): Promise<boolean>;

  /** Get available models */
  getModels(): string[];

  /** Complete a request */
  complete(request: CompletionRequest): Promise<CompletionResponse>;

  /** Stream a completion */
  stream(request: CompletionRequest): AsyncIterable<CompletionChunk>;
}

// =============================================================================
// SERVICE CONFIGURATION
// =============================================================================

/**
 * Cost tracking configuration
 */
export interface CostTrackingConfig {
  /** Maximum cost per request */
  maxCostPerRequest: number;
  /** Daily budget limit */
  dailyBudget: number;
  /** Monthly budget limit */
  monthlyBudget: number;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  /** Requests per minute */
  requestsPerMinute: number;
}

/**
 * LLM Hydration Service configuration
 */
export interface LLMServiceConfig {
  /** Provider configurations */
  providers: ProviderConfig[];

  /** Default provider to use */
  defaultProvider: ProviderId;

  /** Default model to use */
  defaultModel: string;

  /** Default temperature */
  defaultTemperature: number;

  /** Default max tokens */
  defaultMaxTokens: number;

  /** Enable cost tracking */
  enableCostTracking: boolean;

  /** Cost tracking configuration */
  costTracking?: CostTrackingConfig;

  /** Enable rate limiting */
  enableRateLimiting: boolean;

  /** Rate limiting configuration */
  rateLimiting?: RateLimitConfig;

  /** Enable circuit breaker */
  enableCircuitBreaker: boolean;

  /** Enable fallback to other providers on failure */
  fallbackEnabled: boolean;

  /** Fallback provider if primary fails */
  fallbackProvider?: ProviderId;
}

/**
 * Default configuration
 */
export const DEFAULT_LLM_CONFIG: LLMServiceConfig = {
  providers: [],
  defaultProvider: 'openai',
  defaultModel: 'gpt-4o-mini',
  defaultTemperature: 0.7,
  defaultMaxTokens: 4096,
  enableCostTracking: true,
  costTracking: {
    maxCostPerRequest: 1.00,
    dailyBudget: 10.00,
    monthlyBudget: 100.00
  },
  enableRateLimiting: true,
  rateLimiting: {
    requestsPerMinute: 60
  },
  enableCircuitBreaker: true,
  fallbackEnabled: true,
  fallbackProvider: 'ollama'
};

// =============================================================================
// AGENT CLIENT TYPES
// =============================================================================

/**
 * Conversation context for agent clients
 */
export interface ConversationContext {
  /** Conversation ID */
  id: string;

  /** Agent ID */
  agentId: string;

  /** System prompt */
  systemPrompt?: string;

  /** Message history */
  messages: Message[];

  /** Maximum history size */
  maxHistorySize: number;

  /** Created timestamp */
  createdAt: Date;

  /** Last updated timestamp */
  updatedAt: Date;

  /** Conversation ID for tracking */
  conversationId?: string;

  /** History alias */
  history?: Message[];

  /** Tools available */
  tools?: ToolDefinition[];
}

/**
 * Agent LLM client interface
 */
export interface AgentLLMClient {
  /** Agent ID */
  readonly agentId: string;

  /** Send a message and get a response */
  chat(content: string, options?: Partial<CompletionRequest>): Promise<CompletionResponse>;

  /** Stream a response */
  streamChat(content: string, options?: Partial<CompletionRequest>): AsyncIterable<CompletionChunk>;

  /** Get conversation context */
  getContext(): ConversationContext;

  /** Clear conversation history */
  clearHistory(): void;

  /** Set system prompt */
  setSystemPrompt(prompt: string): void;

  /** Send a message and get a response (alias for chat) */
}

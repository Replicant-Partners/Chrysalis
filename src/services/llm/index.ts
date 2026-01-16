/**
 * LLM Service Module
 * 
 * Central module for LLM access in Chrysalis.
 * Provides multi-provider support, cost control, rate limiting,
 * and agent-facing clients with conversation management.
 * 
 * @module llm
 */

// Core service
export {
  LLMHydrationService,
  getDefaultService,
  resetDefaultService,
  type ServiceStats
} from './LLMHydrationService';

// Agent client
export {
  AgentLLMClient,
  AgentClientFactory,
  type AgentClientConfig
} from './AgentLLMClient';

// Providers
export {
  BaseProvider,
  OpenAIProvider,
  AnthropicProvider,
  OllamaProvider
} from './providers';

// Types
export type {
  // Message types
  MessageRole,
  Message,
  ToolCall,
  ToolDefinition,

  // Request/Response types
  CompletionRequest,
  CompletionResponse,
  CompletionChunk,

  // Provider types
  ProviderId,
  ProviderConfig,
  ProviderStatus,
  LLMProvider,

  // Service configuration
  LLMServiceConfig,
  CostTrackingConfig,
  RateLimitConfig,

  // Agent types
  ConversationContext,
  AgentLLMClient as IAgentLLMClient
} from './types';

// Constants
export { DEFAULT_LLM_CONFIG } from './types';
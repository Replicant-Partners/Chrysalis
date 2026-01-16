/**
 * LLM Service Module
 * 
 * Central module for LLM access in Chrysalis.
 * 
 * ARCHITECTURE NOTE: 
 * The Go LLM Gateway (go-services/cmd/gateway) is the single source of truth
 * for LLM provider management, rate limiting, circuit breaking, and cost tracking.
 * 
 * This TypeScript module provides:
 * - GatewayLLMClient: Thin HTTP client to the Go gateway
 * - AgentLLMClient: Agent-facing client with conversation context
 * - Types: Message types, request/response types
 * 
 * @module llm
 */

// Gateway client (thin HTTP client to Go service)
export { GatewayLLMClient, type GatewayLLMClientConfig, type GatewayLLMMessage, type GatewayLLMResponse } from '../gateway/GatewayLLMClient';

// Agent client (conversation context management)
export {
  AgentLLMClient,
  AgentClientFactory,
  type AgentClientConfig
} from './AgentLLMClient';

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

  // Provider types (for reference, providers live in Go)
  ProviderId,

  // Agent types
  ConversationContext,
  AgentLLMClient as IAgentLLMClient
} from './types';

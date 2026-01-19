/**
 * DEPRECATED: System Agent API
 *
 * This TypeScript implementation has been replaced by a Rust implementation.
 * Please use the Rust-based system agents service instead.
 *
 * Exports for the system agent chat API.
 *
 * @module api/system-agents
 * @deprecated Use the Rust implementation in src/native/rust-system-agents/
 */

export {
  SystemAgentAPIController,
  createSystemAgentAPIServer,
  startSystemAgentAPIServer,
  type SystemAgentAPIConfig,
  type ChatRequest,
  type ChatResponseData,
  type InterAgentRequest,
  type ProactiveCheckRequest,
} from './controller';

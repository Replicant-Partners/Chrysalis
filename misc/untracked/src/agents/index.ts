/**
 * Agents Module
 *
 * Provides agent bridge framework for connecting various AI agents
 * to ChrysalisTerminal.
 *
 * @module agents
 */

// Bridge framework (placeholder)
export * from './bridges';

// Terminal connector
export { TerminalAgentConnector } from './TerminalAgentConnector';

// Chat controller
export { AgentChatController } from './AgentChatController';
export type { AgentResponse, ChatMessage, AgentChatControllerConfig } from './AgentChatController';

/**
 * Agents Module
 *
 * Provides agent bridge framework for connecting various AI agents
 * to ChrysalisTerminal.
 *
 * Supported agents:
 * - System Agents (Ada, Lea, Phil, David, Milton)
 * - Serena (oraios/serena) - MCP-based code agent
 * - ElizaOS - Character-based conversational agents
 * - DirectLLM - Claude, GPT, Ollama via API
 *
 * @module agents
 */

// Bridge framework
export * from './bridges';

// Terminal connector
export { TerminalAgentConnector } from './TerminalAgentConnector';

// Chat controller
export { AgentChatController } from './AgentChatController';
export type { UserMessage, AgentResponse, AgentChatControllerConfig } from './AgentChatController';

// System agent loader
export {
  SystemAgentLoader,
  loadSystemAgentsForWorkspace,
  getRecommendedAgentPair,
  type SystemAgentConfig,
  type LoadedSystemAgent,
  type SystemAgentRoster,
} from './system/SystemAgentLoader';

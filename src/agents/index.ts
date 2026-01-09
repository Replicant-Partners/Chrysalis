/**
 * Agents Module
 * 
 * Provides agent bridge framework for connecting various AI agents
 * to ChrysalisTerminal.
 * 
 * Supported agents:
 * - Serena (oraios/serena) - MCP-based code agent
 * - ElizaOS - Character-based conversational agents
 * - DirectLLM - Claude, GPT, Ollama via API
 * 
 * @module agents
 */

// Bridge framework
export * from './bridges';

// Terminal connector
export {
  TerminalAgentConnector,
  TerminalAgentConnectorConfig,
  createTerminalAgentConnector
} from './TerminalAgentConnector';
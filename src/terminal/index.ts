/**
 * Terminal Module
 * 
 * ChrysalisTerminal - Three-frame interface for human/agent collaboration:
 * - Left ChatPane: Agent conversation
 * - Center JSONCanvas: Interactive widget container
 * - Right ChatPane: User/human conversation
 * 
 * Uses YJS CRDT for real-time synchronization.
 * 
 * @module terminal
 */

// Core terminal
export { ChrysalisTerminal } from './ChrysalisTerminal';

// Agent client
export {
  AgentTerminalClient,
  createAgentTerminalClient,
  type AgentTerminalConfig,
  type AgentMessageHandler
} from './AgentTerminalClient';

// Lean protocols
export * from './protocols';

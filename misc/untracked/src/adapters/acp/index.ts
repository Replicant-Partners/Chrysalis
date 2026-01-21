/**
 * ACP (Agent Client Protocol) Module
 *
 * Provides both client and server implementations of the ACP protocol,
 * allowing Chrysalis to:
 * 1. Connect to external ACP agents (Claude Code, OpenCode, Gemini, etc.)
 * 2. Expose itself as an ACP agent for editors (VS Code, Zed, Emacs)
 *
 * @module adapters/acp
 */

// Types
export * from './types';

// Client (connect to ACP agents)
export {
  ACPClient,
  ACPMultiClient,
  ACPAgentFactory,
  createACPClient,
} from './client';

// Server (expose as ACP agent)
export {
  ACPServer,
  createACPServer,
  type ACPServerConfig,
} from './server';

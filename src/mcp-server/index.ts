/**
 * MCP Server Module
 * 
 * This module exports the MCP server implementation and utilities
 * for exposing Chrysalis capabilities through the Model Context Protocol.
 * 
 * @module mcp-server
 * @version 1.0.0
 * 
 * @example
 * ```typescript
 * import { MCPServer, createMCPServer, registerChrysalisCapabilities } from './mcp-server';
 * 
 * // Create and configure server
 * const server = createMCPServer({
 *   name: 'chrysalis-mcp',
 *   version: '1.0.0'
 * });
 * 
 * // Register Chrysalis-specific capabilities
 * registerChrysalisCapabilities(server);
 * 
 * // Start server
 * await server.start({ type: 'stdio' });
 * ```
 */

// ============================================================================
// Core Server Exports
// ============================================================================

export { MCPServer, createMCPServer, default as MCPServerDefault } from './mcp-server';

// ============================================================================
// Type Exports
// ============================================================================

export {
  // JSON-RPC types
  JsonRpcId,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  JsonRpcError,
  JSON_RPC_ERROR_CODES,
  
  // MCP types
  MCP_PROTOCOL_VERSION,
  MCPServerCapabilities,
  MCPClientCapabilities,
  MCPServerInfo,
  MCPClientInfo,
  InitializeParams,
  InitializeResult,
  
  // Tool types
  MCPToolDefinition,
  ListToolsResult,
  CallToolParams,
  CallToolResult,
  
  // Resource types
  MCPResourceDefinition,
  MCPResourceTemplate,
  ListResourcesResult,
  ListResourceTemplatesResult,
  ReadResourceParams,
  ReadResourceResult,
  ResourceContent,
  SubscribeResourceParams,
  ResourceUpdatedParams,
  
  // Prompt types
  MCPPromptDefinition,
  MCPPromptArgument,
  ListPromptsResult,
  GetPromptParams,
  GetPromptResult,
  PromptMessage,
  
  // Content types
  MCPContent,
  TextContent,
  ImageContent,
  EmbeddedResource,
  
  // Logging types
  LogLevel,
  LogMessageParams,
  
  // Configuration types
  MCPServerConfig,
  TransportType,
  TransportConfig,
  
  // Handler types
  ToolHandler,
  ResourceHandler,
  PromptHandler,
  RegisteredTool,
  RegisteredResource,
  RegisteredPrompt,
  
  // Event types
  ServerEventType,
  ServerEvent
} from './types';

// ============================================================================
// Chrysalis Tools Exports
// ============================================================================

export {
  // Tool definitions
  memoryQueryTool,
  memoryStoreTool,
  agentInvokeTool,
  agentListTool,
  semanticAnalyzerTool,
  patternDetectorTool,
  adapterStatusTool,
  
  // Resource definitions
  memoryStoreResource,
  agentRegistryResource,
  protocolAdaptersResource,
  evolutionaryPatternsResource,
  systemConfigResource,
  
  // Resource templates
  memoryItemTemplate,
  agentProfileTemplate,
  adapterTemplate,
  
  // Prompt definitions
  memorySearchPrompt,
  agentTaskPrompt,
  protocolAnalysisPrompt,
  
  // Registration helper
  registerChrysalisCapabilities,
  
  // Default export
  default as chrysalisTools
} from './chrysalis-tools';

// ============================================================================
// Convenience Factory
// ============================================================================

import { MCPServer, createMCPServer } from './mcp-server';
import { MCPServerConfig } from './types';
import { registerChrysalisCapabilities } from './chrysalis-tools';

/**
 * Create a fully configured Chrysalis MCP server.
 * 
 * This is a convenience function that creates an MCP server
 * and registers all Chrysalis capabilities in one step.
 * 
 * @param config - Server configuration
 * @param options - Capability options
 * @returns Configured MCPServer instance
 * 
 * @example
 * ```typescript
 * const server = createChrysalisMCPServer({
 *   name: 'chrysalis-mcp',
 *   version: '1.0.0'
 * });
 * 
 * await server.start({ type: 'stdio' });
 * ```
 */
export function createChrysalisMCPServer(
  config: MCPServerConfig,
  options?: {
    enableMemory?: boolean;
    enableAgents?: boolean;
    enablePatterns?: boolean;
    enableAdapters?: boolean;
  }
): MCPServer {
  const server = createMCPServer(config);
  registerChrysalisCapabilities(server, options);
  return server;
}

// ============================================================================
// CLI Entry Point
// ============================================================================

/**
 * Start Chrysalis MCP server from command line.
 * 
 * This function is intended to be called when running
 * the MCP server as a standalone process.
 * 
 * @example
 * ```bash
 * npx ts-node src/mcp-server/index.ts
 * ```
 */
export async function main(): Promise<void> {
  const server = createChrysalisMCPServer({
    name: 'chrysalis-mcp-server',
    version: '1.0.0',
    instructions: 'Chrysalis MCP Server - Exposes memory, agents, and protocol adaptation capabilities.',
    enableTools: true,
    enableResources: true,
    enablePrompts: true,
    enableLogging: true,
    enableResourceSubscription: true
  });
  
  // Set up event listeners
  server.on('log', (event) => {
    console.error(`[${event.level}] ${event.message}`);
  });
  
  server.on('client-connected', (data) => {
    console.error(`Client connected: ${data.clientInfo?.name || 'unknown'}`);
  });
  
  server.on('client-disconnected', () => {
    console.error('Client disconnected');
  });
  
  server.on('tool-called', (data) => {
    console.error(`Tool called: ${data.tool}`);
  });
  
  // Handle shutdown
  process.on('SIGINT', async () => {
    console.error('Shutting down...');
    await server.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.error('Shutting down...');
    await server.stop();
    process.exit(0);
  });
  
  // Start server
  await server.start({ type: 'stdio' });
  console.error('Chrysalis MCP Server started (stdio)');
}

// Run if executed directly
if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

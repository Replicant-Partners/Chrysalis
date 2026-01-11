/**
 * MCP Server Types
 * 
 * Type definitions for Model Context Protocol server implementation.
 * Based on MCP specification: https://spec.modelcontextprotocol.io
 * 
 * @module mcp-server/types
 * @version 1.0.0
 */

// ============================================================================
// JSON-RPC 2.0 Types
// ============================================================================

/**
 * JSON-RPC 2.0 Request ID.
 */
export type JsonRpcId = string | number | null;

/**
 * JSON-RPC 2.0 Request.
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

/**
 * JSON-RPC 2.0 Response.
 */
export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result?: unknown;
  error?: JsonRpcError;
}

/**
 * JSON-RPC 2.0 Notification (no id).
 */
export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

/**
 * JSON-RPC 2.0 Error.
 */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * Standard JSON-RPC error codes.
 */
export const JSON_RPC_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // MCP-specific errors
  RESOURCE_NOT_FOUND: -32001,
  TOOL_NOT_FOUND: -32002,
  PROMPT_NOT_FOUND: -32003,
  CAPABILITY_NOT_SUPPORTED: -32004
} as const;

// ============================================================================
// MCP Protocol Types
// ============================================================================

/**
 * MCP Protocol version.
 */
export const MCP_PROTOCOL_VERSION = '2024-11-05';

/**
 * MCP Server capabilities.
 */
export interface MCPServerCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  logging?: object;
  experimental?: Record<string, unknown>;
}

/**
 * MCP Client capabilities.
 */
export interface MCPClientCapabilities {
  roots?: {
    listChanged?: boolean;
  };
  sampling?: object;
  experimental?: Record<string, unknown>;
}

/**
 * MCP Server info.
 */
export interface MCPServerInfo {
  name: string;
  version: string;
}

/**
 * MCP Client info.
 */
export interface MCPClientInfo {
  name: string;
  version: string;
}

/**
 * Initialize request params.
 */
export interface InitializeParams {
  protocolVersion: string;
  capabilities: MCPClientCapabilities;
  clientInfo: MCPClientInfo;
}

/**
 * Initialize result.
 */
export interface InitializeResult {
  protocolVersion: string;
  capabilities: MCPServerCapabilities;
  serverInfo: MCPServerInfo;
  instructions?: string;
}

// ============================================================================
// Tool Types
// ============================================================================

/**
 * JSON Schema for tool parameters.
 */
export interface ToolInputSchema {
  type: 'object';
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * JSON Schema property.
 */
export interface JsonSchemaProperty {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null';
  description?: string;
  enum?: unknown[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

/**
 * MCP Tool definition.
 */
export interface MCPToolDefinition {
  name: string;
  description?: string;
  inputSchema: ToolInputSchema;
}

/**
 * Tool list result.
 */
export interface ListToolsResult {
  tools: MCPToolDefinition[];
  nextCursor?: string;
}

/**
 * Tool call request params.
 */
export interface CallToolParams {
  name: string;
  arguments?: Record<string, unknown>;
}

/**
 * Tool call result.
 */
export interface CallToolResult {
  content: MCPContent[];
  isError?: boolean;
}

// ============================================================================
// Resource Types
// ============================================================================

/**
 * MCP Resource definition.
 */
export interface MCPResourceDefinition {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * Resource list result.
 */
export interface ListResourcesResult {
  resources: MCPResourceDefinition[];
  nextCursor?: string;
}

/**
 * Resource template definition.
 */
export interface MCPResourceTemplate {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * Resource templates list result.
 */
export interface ListResourceTemplatesResult {
  resourceTemplates: MCPResourceTemplate[];
  nextCursor?: string;
}

/**
 * Read resource params.
 */
export interface ReadResourceParams {
  uri: string;
}

/**
 * Read resource result.
 */
export interface ReadResourceResult {
  contents: ResourceContent[];
}

/**
 * Resource content.
 */
export interface ResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string; // base64 encoded
}

/**
 * Resource subscription params.
 */
export interface SubscribeResourceParams {
  uri: string;
}

/**
 * Resource updated notification params.
 */
export interface ResourceUpdatedParams {
  uri: string;
}

// ============================================================================
// Prompt Types
// ============================================================================

/**
 * MCP Prompt definition.
 */
export interface MCPPromptDefinition {
  name: string;
  description?: string;
  arguments?: MCPPromptArgument[];
}

/**
 * Prompt argument.
 */
export interface MCPPromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

/**
 * Prompt list result.
 */
export interface ListPromptsResult {
  prompts: MCPPromptDefinition[];
  nextCursor?: string;
}

/**
 * Get prompt params.
 */
export interface GetPromptParams {
  name: string;
  arguments?: Record<string, string>;
}

/**
 * Get prompt result.
 */
export interface GetPromptResult {
  description?: string;
  messages: PromptMessage[];
}

/**
 * Prompt message.
 */
export interface PromptMessage {
  role: 'user' | 'assistant';
  content: MCPContent;
}

// ============================================================================
// Content Types
// ============================================================================

/**
 * MCP Content (union type).
 */
export type MCPContent = TextContent | ImageContent | EmbeddedResource;

/**
 * Text content.
 */
export interface TextContent {
  type: 'text';
  text: string;
}

/**
 * Image content.
 */
export interface ImageContent {
  type: 'image';
  data: string; // base64 encoded
  mimeType: string;
}

/**
 * Embedded resource content.
 */
export interface EmbeddedResource {
  type: 'resource';
  resource: ResourceContent;
}

// ============================================================================
// Logging Types
// ============================================================================

/**
 * Log level.
 */
export type LogLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';

/**
 * Log message params.
 */
export interface LogMessageParams {
  level: LogLevel;
  logger?: string;
  data?: unknown;
}

// ============================================================================
// Roots Types
// ============================================================================

/**
 * Root definition.
 */
export interface Root {
  uri: string;
  name?: string;
}

/**
 * Roots list result.
 */
export interface ListRootsResult {
  roots: Root[];
}

// ============================================================================
// Progress Types
// ============================================================================

/**
 * Progress token.
 */
export type ProgressToken = string | number;

/**
 * Progress notification params.
 */
export interface ProgressParams {
  progressToken: ProgressToken;
  progress: number;
  total?: number;
}

// ============================================================================
// Server Configuration
// ============================================================================

/**
 * MCP Server configuration.
 */
export interface MCPServerConfig {
  /** Server name */
  name: string;
  /** Server version */
  version: string;
  /** Server instructions for clients */
  instructions?: string;
  /** Enable tool support */
  enableTools?: boolean;
  /** Enable resource support */
  enableResources?: boolean;
  /** Enable prompt support */
  enablePrompts?: boolean;
  /** Enable logging support */
  enableLogging?: boolean;
  /** Enable resource subscription */
  enableResourceSubscription?: boolean;
  /** Custom capabilities */
  customCapabilities?: Record<string, unknown>;
}

/**
 * Transport type.
 */
export type TransportType = 'stdio' | 'sse' | 'websocket';

/**
 * Transport configuration.
 */
export interface TransportConfig {
  type: TransportType;
  /** For SSE/WebSocket: server port */
  port?: number;
  /** For SSE/WebSocket: server host */
  host?: string;
  /** For SSE: endpoint path */
  endpoint?: string;
}

// ============================================================================
// Handler Types
// ============================================================================

/**
 * Tool handler function.
 */
export type ToolHandler = (
  name: string,
  args: Record<string, unknown>
) => Promise<CallToolResult>;

/**
 * Resource handler function.
 */
export type ResourceHandler = (
  uri: string
) => Promise<ResourceContent[]>;

/**
 * Prompt handler function.
 */
export type PromptHandler = (
  name: string,
  args: Record<string, string>
) => Promise<GetPromptResult>;

/**
 * Registered tool.
 */
export interface RegisteredTool {
  definition: MCPToolDefinition;
  handler: ToolHandler;
}

/**
 * Registered resource.
 */
export interface RegisteredResource {
  definition: MCPResourceDefinition;
  handler: ResourceHandler;
}

/**
 * Registered prompt.
 */
export interface RegisteredPrompt {
  definition: MCPPromptDefinition;
  handler: PromptHandler;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Server event types.
 */
export type ServerEventType =
  | 'initialized'
  | 'client-connected'
  | 'client-disconnected'
  | 'tool-called'
  | 'resource-read'
  | 'prompt-requested'
  | 'error'
  | 'shutdown';

/**
 * Server event payload.
 */
export interface ServerEvent {
  type: ServerEventType;
  timestamp: string;
  data?: unknown;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  MCP_PROTOCOL_VERSION,
  JSON_RPC_ERROR_CODES
};

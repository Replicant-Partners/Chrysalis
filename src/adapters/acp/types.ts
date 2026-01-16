/**
 * ACP (Agent Client Protocol) Types
 *
 * Based on the official ACP specification from Zed:
 * - Website: https://agentclientprotocol.com
 * - GitHub: github.com/agentclientprotocol
 *
 * Transport: ndjson (newline-delimited JSON) over stdio
 *
 * @module adapters/acp/types
 */

// =============================================================================
// Transport & Message Framing
// =============================================================================

/**
 * ACP uses JSON-RPC 2.0 style messages over ndjson
 */
export interface ACPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: ACPError;
}

export interface ACPRequest extends ACPMessage {
  id: string | number;
  method: string;
  params?: unknown;
}

export interface ACPResponse extends ACPMessage {
  id: string | number;
  result?: unknown;
  error?: ACPError;
}

export interface ACPNotification extends ACPMessage {
  method: string;
  params?: unknown;
}

export interface ACPError {
  code: number;
  message: string;
  data?: unknown;
}

// =============================================================================
// Capabilities (negotiated at connection)
// =============================================================================

/**
 * ACP capabilities negotiated between client and agent
 */
export interface ACPCapabilities {
  // MCP integration
  mcp?: {
    http?: boolean;
    sse?: boolean;
  };

  // Prompt capabilities
  prompt?: {
    audio?: boolean;
    image?: boolean;
    embeddedContext?: boolean;
  };

  // Session management
  session?: {
    load?: boolean;
    save?: boolean;
    modes?: string[];
    models?: string[];
  };

  // File operations
  files?: {
    read?: boolean;
    write?: boolean;
  };

  // Terminal operations
  terminal?: {
    create?: boolean;
    output?: boolean;
    waitForExit?: boolean;
    kill?: boolean;
    release?: boolean;
  };

  // Permission system
  permissions?: {
    request?: boolean;
  };

  // Extensions
  extensions?: string[];
}

// =============================================================================
// Agent → Client Requests
// =============================================================================

/**
 * Base request structure
 */
export interface ACPBaseRequest {
  type: string;
}

/**
 * Write a text file
 */
export interface WriteTextFileRequest extends ACPBaseRequest {
  type: 'WriteTextFileRequest';
  path: string;
  content: string;
  createDirectories?: boolean;
}

export interface WriteTextFileResponse {
  success: boolean;
  error?: string;
}

/**
 * Read a text file
 */
export interface ReadTextFileRequest extends ACPBaseRequest {
  type: 'ReadTextFileRequest';
  path: string;
}

export interface ReadTextFileResponse {
  content: string;
  error?: string;
}

/**
 * Create a terminal session
 */
export interface CreateTerminalRequest extends ACPBaseRequest {
  type: 'CreateTerminalRequest';
  cwd?: string;
  env?: Record<string, string>;
  command?: string;
  args?: string[];
}

export interface CreateTerminalResponse {
  terminalId: string;
  error?: string;
}

/**
 * Terminal output (streamed from terminal)
 */
export interface TerminalOutputRequest extends ACPBaseRequest {
  type: 'TerminalOutputRequest';
  terminalId: string;
}

export interface TerminalOutputResponse {
  output: string;
  error?: string;
}

/**
 * Wait for terminal command to exit
 */
export interface WaitForTerminalExitRequest extends ACPBaseRequest {
  type: 'WaitForTerminalExitRequest';
  terminalId: string;
  timeout?: number;
}

export interface WaitForTerminalExitResponse {
  exitCode: number;
  error?: string;
}

/**
 * Kill a terminal command
 */
export interface KillTerminalCommandRequest extends ACPBaseRequest {
  type: 'KillTerminalCommandRequest';
  terminalId: string;
  signal?: string;
}

export interface KillTerminalCommandResponse {
  success: boolean;
  error?: string;
}

/**
 * Release a terminal session
 */
export interface ReleaseTerminalRequest extends ACPBaseRequest {
  type: 'ReleaseTerminalRequest';
  terminalId: string;
}

export interface ReleaseTerminalResponse {
  success: boolean;
}

/**
 * Request permission from user
 */
export interface RequestPermissionRequest extends ACPBaseRequest {
  type: 'RequestPermissionRequest';
  permission: string;
  description?: string;
  options?: string[];
}

export interface RequestPermissionResponse {
  granted: boolean;
  selectedOption?: string;
}

/**
 * Extension request (for custom capabilities)
 */
export interface ExtRequest extends ACPBaseRequest {
  type: 'ExtRequest';
  extensionType: string;
  payload: unknown;
}

export interface ExtResponse {
  payload: unknown;
  error?: string;
}

// Union type for all agent requests
export type ACPAgentRequest =
  | WriteTextFileRequest
  | ReadTextFileRequest
  | CreateTerminalRequest
  | TerminalOutputRequest
  | WaitForTerminalExitRequest
  | KillTerminalCommandRequest
  | ReleaseTerminalRequest
  | RequestPermissionRequest
  | ExtRequest;

// =============================================================================
// Notifications
// =============================================================================

/**
 * Session notification (streaming updates)
 */
export interface SessionNotification {
  type: 'SessionNotification';
  sessionId: string;
  content?: string;
  status?: 'thinking' | 'working' | 'done' | 'error';
  toolCalls?: ACPToolCall[];
  progress?: number;
}

/**
 * Tool call notification
 */
export interface ACPToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: 'pending' | 'running' | 'success' | 'failed';
  result?: unknown;
  error?: string;
}

/**
 * Extension notification
 */
export interface ExtNotification {
  type: 'ExtNotification';
  extensionType: string;
  payload: unknown;
}

// Union type for all notifications
export type ACPNotificationType =
  | SessionNotification
  | ExtNotification;

// =============================================================================
// Client → Agent Messages
// =============================================================================

/**
 * Initialize connection
 */
export interface InitializeRequest {
  type: 'Initialize';
  clientInfo: {
    name: string;
    version: string;
  };
  capabilities: ACPCapabilities;
}

export interface InitializeResponse {
  agentInfo: ACPAgentInfo;
  capabilities: ACPCapabilities;
}

/**
 * Send a prompt/message to the agent
 */
export interface PromptRequest {
  type: 'Prompt';
  sessionId?: string;
  content: string;
  attachments?: ACPAttachment[];
  context?: ACPContext;
}

export interface PromptResponse {
  sessionId: string;
  content?: string;
  status: 'started' | 'streaming' | 'complete' | 'error';
  error?: string;
}

/**
 * Attachment types
 */
export interface ACPAttachment {
  type: 'file' | 'image' | 'audio';
  path?: string;
  content?: string;
  mimeType?: string;
  encoding?: 'base64' | 'utf-8';
}

/**
 * Context for the prompt
 */
export interface ACPContext {
  // Embedded file context
  files?: Array<{
    path: string;
    content: string;
    language?: string;
  }>;

  // Memory/history context
  memory?: string;

  // Tool definitions
  tools?: ACPToolDefinition[];

  // Custom context
  custom?: Record<string, unknown>;
}

/**
 * Tool definition for the agent
 */
export interface ACPToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      default?: unknown;
    }>;
    required?: string[];
  };
}

/**
 * Cancel ongoing operation
 */
export interface CancelRequest {
  type: 'Cancel';
  sessionId: string;
}

export interface CancelResponse {
  success: boolean;
}

/**
 * Session management
 */
export interface LoadSessionRequest {
  type: 'LoadSession';
  sessionId: string;
}

export interface SaveSessionRequest {
  type: 'SaveSession';
  sessionId: string;
}

export interface SessionResponse {
  sessionId: string;
  success: boolean;
  error?: string;
}

// =============================================================================
// Agent Info
// =============================================================================

/**
 * ACP agent information
 */
export interface ACPAgentInfo {
  name: string;
  version: string;
  description?: string;
  vendor?: string;

  // Supported models
  models?: string[];

  // Supported modes
  modes?: string[];

  // Agent-specific metadata
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Connection State
// =============================================================================

export type ACPConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'initializing'
  | 'ready'
  | 'error';

/**
 * ACP connection configuration
 */
export interface ACPConnectionConfig {
  // Agent command to spawn (e.g., "./opencode acp")
  command?: string;
  args?: string[];

  // Or connect to running agent via stdio
  stdin?: NodeJS.WritableStream;
  stdout?: NodeJS.ReadableStream;

  // Or via HTTP/SSE
  httpUrl?: string;
  sseUrl?: string;

  // Client identification
  clientInfo: {
    name: string;
    version: string;
  };

  // Requested capabilities
  capabilities?: Partial<ACPCapabilities>;

  // Timeouts
  connectTimeout?: number;
  requestTimeout?: number;

  // Callbacks
  onNotification?: (notification: ACPNotificationType) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

// =============================================================================
// ACP Registry
// =============================================================================

/**
 * Agent registry entry (from agentclientprotocol/registry)
 */
export interface ACPRegistryEntry {
  id: string;
  name: string;
  provider: string;
  command: string;
  version?: string;
  description?: string;
  homepage?: string;
  repository?: string;
  models?: string[];
  tags?: string[];
}

// =============================================================================
// Error Codes
// =============================================================================

export const ACPErrorCodes = {
  // JSON-RPC standard errors
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,

  // ACP-specific errors
  NOT_INITIALIZED: -32000,
  CAPABILITY_NOT_SUPPORTED: -32001,
  PERMISSION_DENIED: -32002,
  RESOURCE_NOT_FOUND: -32003,
  OPERATION_CANCELLED: -32004,
  TIMEOUT: -32005,
  AGENT_ERROR: -32006,
} as const;

export type ACPErrorCode = typeof ACPErrorCodes[keyof typeof ACPErrorCodes];

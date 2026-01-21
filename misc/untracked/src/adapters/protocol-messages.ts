/**
 * Chrysalis Protocol Messages
 * 
 * Protocol-agnostic message structures for cross-protocol communication.
 * Provides a universal message envelope that can be translated to/from
 * any supported protocol format.
 * 
 * @module adapters/protocol-messages
 * @version 1.0.0
 * @see {@link ../plans/phase-1a-enhanced-type-system-spec.md}
 */

import { AgentFramework } from './protocol-types';

// ============================================================================
// Universal Message Envelope
// ============================================================================

/**
 * Universal message envelope for cross-protocol communication.
 * 
 * This structure provides a protocol-agnostic representation of messages
 * that can be translated to/from any supported protocol format.
 */
export interface UniversalMessage {
  /** Unique message identifier (UUID v4) */
  messageId: string;
  /** Correlation ID for request-response matching */
  correlationId?: string;
  /** Message timestamp (ISO 8601) */
  timestamp: string;
  /** Source protocol that generated this message */
  sourceProtocol: AgentFramework;
  /** Target protocol for delivery (if known) */
  targetProtocol?: AgentFramework;
  /** Message type classification */
  type: UniversalMessageType;
  /** Message payload */
  payload: UniversalPayload;
  /** Protocol-specific headers */
  headers?: Record<string, string>;
  /** Tracing context for observability */
  trace?: TraceContext;
  /** Message priority (0.0 - 1.0, higher = more important) */
  priority?: number;
  /** Time-to-live in milliseconds */
  ttlMs?: number;
}

/**
 * Universal message type classification.
 * 
 * Covers all common message types across supported protocols:
 * - A2A: tasks/send, tasks/get, tasks/list
 * - MCP: tools/list, tools/call, resources/read
 * - ANP: discovery, identity verification
 * - ACP: enterprise messaging
 */
export type UniversalMessageType = 
  // Agent Discovery & Identity
  | 'agent-card'           // Capability advertisement (A2A Agent Card)
  | 'agent-query'          // Query for agent information
  | 'identity-verify'      // Identity verification request (ANP)
  | 'identity-response'    // Identity verification response
  // Task Management
  | 'task-request'         // Create/send task (A2A tasks/send)
  | 'task-response'        // Task result
  | 'task-status'          // Status update (A2A task state)
  | 'task-cancel'          // Cancel task request
  | 'task-list'            // List tasks request/response
  // Tool Operations
  | 'tool-list'            // List available tools (MCP tools/list)
  | 'tool-invoke'          // Tool invocation (MCP tools/call)
  | 'tool-result'          // Tool invocation result
  // Resource Operations  
  | 'resource-list'        // List available resources (MCP resources/list)
  | 'resource-request'     // Resource access request (MCP resources/read)
  | 'resource-response'    // Resource content response
  // Prompt Operations
  | 'prompt-list'          // List prompt templates (MCP prompts/list)
  | 'prompt-request'       // Get prompt (MCP prompts/get)
  | 'prompt-response'      // Prompt content
  // Discovery Operations
  | 'discovery-query'      // Agent discovery query
  | 'discovery-response'   // Discovery results
  // Streaming
  | 'stream-start'         // Start streaming response
  | 'stream-chunk'         // Streaming data chunk
  | 'stream-end'           // End streaming response
  // Control
  | 'ping'                 // Health check ping
  | 'pong'                 // Health check response
  | 'error';               // Error message

// ============================================================================
// Universal Payload
// ============================================================================

/**
 * Universal payload supporting all message types.
 * 
 * Only the relevant fields are populated based on message type.
 * Uses discriminated unions for type-safe access.
 */
export interface UniversalPayload {
  /** Agent identity information */
  agent?: UniversalAgentRef;
  /** Task information */
  task?: UniversalTaskRef;
  /** Tool invocation details */
  tool?: UniversalToolInvoke;
  /** Resource reference */
  resource?: UniversalResourceRef;
  /** Prompt reference */
  prompt?: UniversalPromptRef;
  /** Discovery query */
  discovery?: UniversalDiscoveryQuery;
  /** Streaming content */
  stream?: UniversalStreamChunk;
  /** Error information */
  error?: UniversalError;
  /** Raw protocol-specific data (preserved for fidelity) */
  raw?: Record<string, unknown>;
}

// ============================================================================
// Agent Reference Types
// ============================================================================

/**
 * Universal agent reference.
 * 
 * Represents an agent identity that can be resolved across protocols.
 */
export interface UniversalAgentRef {
  /** Protocol-specific identifier */
  protocolId: string;
  /** Protocol type */
  protocol: AgentFramework;
  /** Human-readable name */
  name: string;
  /** Agent description */
  description?: string;
  /** W3C DID (from ANP, if available) */
  did?: string;
  /** Chrysalis fingerprint (if registered) */
  chrysalisFingerprint?: string;
  /** Service endpoint URL */
  endpoint?: string;
  /** Agent capabilities */
  capabilities?: string[];
  /** Agent version */
  version?: string;
  /** Agent card URL (A2A) */
  agentCardUrl?: string;
  /** Verification status */
  verified?: boolean;
}

/**
 * Agent card structure (A2A compatible).
 * 
 * Full capability advertisement document.
 */
export interface UniversalAgentCard {
  /** Agent name */
  name: string;
  /** Agent description */
  description?: string;
  /** Agent endpoint URL */
  url: string;
  /** Provider information */
  provider?: {
    organization: string;
    contactEmail?: string;
  };
  /** Agent version */
  version: string;
  /** Documentation URL */
  documentationUrl?: string;
  /** Supported capabilities */
  capabilities: {
    streaming?: boolean;
    pushNotifications?: boolean;
    stateTransitionHistory?: boolean;
  };
  /** Authentication requirements */
  authentication: {
    schemes: AuthScheme[];
  };
  /** Default input modes */
  defaultInputModes: ContentMode[];
  /** Default output modes */
  defaultOutputModes: ContentMode[];
  /** Available skills */
  skills: UniversalSkill[];
}

/**
 * Authentication scheme.
 */
export type AuthScheme = 
  | { type: 'none' }
  | { type: 'bearer'; tokenUrl?: string }
  | { type: 'oauth2'; flows: OAuth2Flows }
  | { type: 'apiKey'; header: string; in?: 'header' | 'query' }
  | { type: 'did'; method: string };

/**
 * OAuth2 flows configuration.
 */
export interface OAuth2Flows {
  authorizationCode?: {
    authorizationUrl: string;
    tokenUrl: string;
    scopes?: Record<string, string>;
  };
  clientCredentials?: {
    tokenUrl: string;
    scopes?: Record<string, string>;
  };
}

/**
 * Content mode for input/output.
 */
export type ContentMode = 'text' | 'image' | 'audio' | 'video' | 'file' | 'data';

/**
 * Agent skill declaration (A2A compatible).
 */
export interface UniversalSkill {
  /** Skill identifier */
  id: string;
  /** Skill name */
  name: string;
  /** Skill description */
  description?: string;
  /** Skill tags for discovery */
  tags?: string[];
  /** Example invocations */
  examples?: SkillExample[];
  /** Supported input modes */
  inputModes?: ContentMode[];
  /** Supported output modes */
  outputModes?: ContentMode[];
}

/**
 * Skill invocation example.
 */
export interface SkillExample {
  /** Example name */
  name?: string;
  /** Example input */
  input: string;
  /** Expected output */
  output?: string;
}

// ============================================================================
// Task Types
// ============================================================================

/**
 * Universal task reference (A2A-inspired).
 * 
 * Represents a delegated task that can be tracked across protocols.
 */
export interface UniversalTaskRef {
  /** Task identifier */
  taskId: string;
  /** Current task state */
  state: UniversalTaskState;
  /** Task description */
  description?: string;
  /** Task input parts */
  input?: UniversalMessagePart[];
  /** Task output parts */
  output?: UniversalMessagePart[];
  /** Task artifacts */
  artifacts?: UniversalArtifact[];
  /** Task metadata */
  metadata?: Record<string, unknown>;
  /** Task history (state transitions) */
  history?: TaskStateTransition[];
  /** Created timestamp */
  createdAt?: string;
  /** Last updated timestamp */
  updatedAt?: string;
}

/**
 * Universal task state.
 * 
 * Aligned with A2A task states.
 */
export type UniversalTaskState = 
  | 'pending'        // Task created but not started
  | 'submitted'      // Task submitted to agent
  | 'running'        // Task is being processed
  | 'working'        // Agent is actively working (alias for running)
  | 'input-required' // Waiting for additional input
  | 'completed'      // Task completed successfully
  | 'failed'         // Task failed
  | 'canceled';      // Task was canceled

/**
 * Task state transition record.
 */
export interface TaskStateTransition {
  /** Previous state */
  from: UniversalTaskState;
  /** New state */
  to: UniversalTaskState;
  /** Transition timestamp */
  timestamp: string;
  /** Reason for transition */
  reason?: string;
}

/**
 * Universal message part (multi-modal support).
 * 
 * Supports text, images, files, and structured data.
 */
export interface UniversalMessagePart {
  /** Content type */
  type: ContentMode;
  /** Text content (for type: 'text') */
  content?: string;
  /** URI reference (for type: 'image', 'file', 'audio', 'video') */
  uri?: string;
  /** Base64 encoded data */
  data?: string;
  /** MIME type */
  mimeType?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Task artifact (file or data produced by task).
 */
export interface UniversalArtifact {
  /** Artifact identifier */
  artifactId: string;
  /** Artifact name */
  name: string;
  /** Artifact type */
  type: ContentMode;
  /** Artifact URI */
  uri?: string;
  /** Artifact data (if inline) */
  data?: string;
  /** MIME type */
  mimeType?: string;
  /** Artifact description */
  description?: string;
  /** Created timestamp */
  createdAt: string;
}

// ============================================================================
// Tool Types
// ============================================================================

/**
 * Universal tool invocation.
 * 
 * Represents a tool call that can be executed via MCP, OpenAI, or other protocols.
 */
export interface UniversalToolInvoke {
  /** Tool name */
  toolName: string;
  /** Protocol providing the tool */
  toolProtocol: AgentFramework;
  /** Tool parameters */
  parameters: Record<string, unknown>;
  /** Tool input schema (JSON Schema) */
  schema?: JsonSchema;
  /** Invocation result */
  result?: unknown;
  /** Error (if invocation failed) */
  error?: UniversalError;
  /** Execution duration (ms) */
  durationMs?: number;
  /** Whether to return result directly without further processing */
  returnDirect?: boolean;
}

/**
 * Universal tool definition.
 */
export interface UniversalToolDef {
  /** Tool name */
  name: string;
  /** Tool description */
  description?: string;
  /** Input schema */
  inputSchema: JsonSchema;
  /** Output schema (optional) */
  outputSchema?: JsonSchema;
  /** Source protocol */
  protocol: AgentFramework;
  /** Tool endpoint (if remote) */
  endpoint?: string;
  /** Tool tags */
  tags?: string[];
}

/**
 * JSON Schema (simplified for tool schemas).
 */
export interface JsonSchema {
  type: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  description?: string;
  enum?: unknown[];
  default?: unknown;
  additionalProperties?: boolean | JsonSchema;
  [key: string]: unknown;
}

// ============================================================================
// Resource Types
// ============================================================================

/**
 * Universal resource reference (MCP-inspired).
 */
export interface UniversalResourceRef {
  /** Resource URI */
  uri: string;
  /** Resource name */
  name: string;
  /** Resource description */
  description?: string;
  /** MIME type */
  mimeType?: string;
  /** Resource content (if inline) */
  content?: string;
  /** Resource protocol */
  protocol: AgentFramework;
  /** Resource metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Prompt Types
// ============================================================================

/**
 * Universal prompt reference (MCP-inspired).
 */
export interface UniversalPromptRef {
  /** Prompt name */
  name: string;
  /** Prompt description */
  description?: string;
  /** Prompt arguments */
  arguments?: PromptArgument[];
  /** Rendered prompt content */
  content?: string;
  /** Source protocol */
  protocol: AgentFramework;
}

/**
 * Prompt argument definition.
 */
export interface PromptArgument {
  /** Argument name */
  name: string;
  /** Argument description */
  description?: string;
  /** Whether argument is required */
  required?: boolean;
  /** Default value */
  default?: string;
}

// ============================================================================
// Discovery Types
// ============================================================================

/**
 * Universal discovery query.
 */
export interface UniversalDiscoveryQuery {
  /** Capability-based search */
  capabilities?: string[];
  /** Semantic search query */
  semanticQuery?: string;
  /** Protocol filter */
  protocols?: AgentFramework[];
  /** Tag filter */
  tags?: string[];
  /** Maximum results */
  limit?: number;
  /** Pagination offset */
  offset?: number;
  /** Sort criteria */
  sortBy?: 'relevance' | 'name' | 'updated';
}

/**
 * Discovery result.
 */
export interface UniversalDiscoveryResult {
  /** Discovered agents */
  agents: UniversalAgentRef[];
  /** Total count */
  total: number;
  /** Query metadata */
  metadata?: {
    queryTimeMs: number;
    sources: AgentFramework[];
  };
}

// ============================================================================
// Streaming Types
// ============================================================================

/**
 * Streaming content chunk.
 */
export interface UniversalStreamChunk {
  /** Stream identifier */
  streamId: string;
  /** Chunk sequence number */
  sequence: number;
  /** Is this the final chunk? */
  final: boolean;
  /** Chunk content */
  content?: string;
  /** Chunk data (for binary) */
  data?: string;
  /** Chunk metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Universal error format.
 * 
 * Provides consistent error representation across protocols.
 */
export interface UniversalError {
  /** Error code */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Error details */
  details?: Record<string, unknown>;
  /** Whether the operation can be retried */
  retryable: boolean;
  /** Suggested retry delay (ms) */
  retryAfterMs?: number;
  /** Source protocol that generated the error */
  sourceProtocol?: AgentFramework;
  /** Stack trace (for debugging) */
  stack?: string;
}

/**
 * Standard error codes.
 */
export enum ErrorCode {
  // General
  UNKNOWN = 'UNKNOWN',
  INTERNAL = 'INTERNAL',
  TIMEOUT = 'TIMEOUT',
  CANCELLED = 'CANCELLED',
  
  // Validation
  INVALID_REQUEST = 'INVALID_REQUEST',
  INVALID_PARAMETER = 'INVALID_PARAMETER',
  MISSING_PARAMETER = 'MISSING_PARAMETER',
  
  // Authentication/Authorization
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  
  // Resources
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED',
  
  // Protocol
  UNSUPPORTED_PROTOCOL = 'UNSUPPORTED_PROTOCOL',
  PROTOCOL_ERROR = 'PROTOCOL_ERROR',
  VERSION_MISMATCH = 'VERSION_MISMATCH',
  
  // Task
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  TASK_FAILED = 'TASK_FAILED',
  TASK_CANCELLED = 'TASK_CANCELLED',
  INVALID_TASK_STATE = 'INVALID_TASK_STATE',
  
  // Tool
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',
  INVALID_TOOL_PARAMETERS = 'INVALID_TOOL_PARAMETERS',
  
  // Agent
  AGENT_NOT_FOUND = 'AGENT_NOT_FOUND',
  AGENT_UNAVAILABLE = 'AGENT_UNAVAILABLE',
  CAPABILITY_NOT_FOUND = 'CAPABILITY_NOT_FOUND'
}

// ============================================================================
// Trace Context
// ============================================================================

/**
 * Trace context for distributed tracing.
 * 
 * Compatible with W3C Trace Context and OpenTelemetry.
 */
export interface TraceContext {
  /** Trace identifier (128-bit hex string) */
  traceId: string;
  /** Span identifier (64-bit hex string) */
  spanId: string;
  /** Parent span identifier */
  parentSpanId?: string;
  /** Trace flags */
  traceFlags?: number;
  /** Baggage items (key-value pairs propagated across services) */
  baggage?: Record<string, string>;
  /** Sampling decision */
  sampled?: boolean;
}

// ============================================================================
// Message Factory Functions
// ============================================================================

/**
 * Create a new universal message.
 */
export function createMessage(
  type: UniversalMessageType,
  sourceProtocol: AgentFramework,
  payload: UniversalPayload,
  options?: {
    correlationId?: string;
    targetProtocol?: AgentFramework;
    headers?: Record<string, string>;
    trace?: TraceContext;
    priority?: number;
    ttlMs?: number;
  }
): UniversalMessage {
  return {
    messageId: generateMessageId(),
    timestamp: new Date().toISOString(),
    type,
    sourceProtocol,
    payload,
    ...options
  };
}

/**
 * Create a task request message.
 */
export function createTaskRequest(
  sourceProtocol: AgentFramework,
  taskId: string,
  input: UniversalMessagePart[],
  options?: {
    targetProtocol?: AgentFramework;
    description?: string;
    correlationId?: string;
    trace?: TraceContext;
  }
): UniversalMessage {
  return createMessage('task-request', sourceProtocol, {
    task: {
      taskId,
      state: 'submitted',
      input,
      description: options?.description
    }
  }, options);
}

/**
 * Create a tool invocation message.
 */
export function createToolInvoke(
  sourceProtocol: AgentFramework,
  toolName: string,
  parameters: Record<string, unknown>,
  options?: {
    toolProtocol?: AgentFramework;
    schema?: JsonSchema;
    correlationId?: string;
    trace?: TraceContext;
  }
): UniversalMessage {
  return createMessage('tool-invoke', sourceProtocol, {
    tool: {
      toolName,
      toolProtocol: options?.toolProtocol || 'mcp',
      parameters,
      schema: options?.schema
    }
  }, options);
}

/**
 * Create an error message.
 */
export function createError(
  sourceProtocol: AgentFramework,
  code: string,
  message: string,
  options?: {
    details?: Record<string, unknown>;
    retryable?: boolean;
    correlationId?: string;
    trace?: TraceContext;
  }
): UniversalMessage {
  return createMessage('error', sourceProtocol, {
    error: {
      code,
      message,
      details: options?.details,
      retryable: options?.retryable ?? false,
      sourceProtocol
    }
  }, { correlationId: options?.correlationId, trace: options?.trace });
}

/**
 * Generate a unique message ID.
 */
function generateMessageId(): string {
  // Use crypto.randomUUID if available (Node.js 19+, modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback to timestamp + random
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a message is a task-related message.
 */
export function isTaskMessage(message: UniversalMessage): boolean {
  return message.type.startsWith('task-');
}

/**
 * Check if a message is a tool-related message.
 */
export function isToolMessage(message: UniversalMessage): boolean {
  return message.type.startsWith('tool-');
}

/**
 * Check if a message is a resource-related message.
 */
export function isResourceMessage(message: UniversalMessage): boolean {
  return message.type.startsWith('resource-');
}

/**
 * Check if a message is an error message.
 */
export function isErrorMessage(message: UniversalMessage): message is UniversalMessage & { payload: { error: UniversalError } } {
  return message.type === 'error' && message.payload.error !== undefined;
}

/**
 * Check if a message is a streaming message.
 */
export function isStreamingMessage(message: UniversalMessage): boolean {
  return message.type.startsWith('stream-');
}

// ============================================================================
// Exports
// ============================================================================

export default {
  createMessage,
  createTaskRequest,
  createToolInvoke,
  createError,
  isTaskMessage,
  isToolMessage,
  isResourceMessage,
  isErrorMessage,
  isStreamingMessage,
  ErrorCode
};

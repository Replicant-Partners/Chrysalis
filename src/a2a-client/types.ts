/**
 * A2A (Agent-to-Agent) Protocol Types
 * 
 * Type definitions based on Google's Agent-to-Agent protocol specification.
 * Enables multi-agent communication and task delegation.
 * 
 * @module a2a-client/types
 * @version 1.0.0
 * @see https://google.github.io/A2A/
 */

// ============================================================================
// JSON-RPC Types
// ============================================================================

/**
 * JSON-RPC 2.0 request ID.
 */
export type JsonRpcId = string | number | null;

/**
 * JSON-RPC 2.0 request structure.
 */
export interface JsonRpcRequest<T = unknown> {
  jsonrpc: '2.0';
  id: JsonRpcId;
  method: string;
  params?: T;
}

/**
 * JSON-RPC 2.0 response structure.
 */
export interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result?: T;
  error?: JsonRpcError;
}

/**
 * JSON-RPC 2.0 error structure.
 */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * Standard A2A error codes.
 */
export const A2A_ERROR_CODES = {
  // JSON-RPC standard errors
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  
  // A2A specific errors
  TASK_NOT_FOUND: -32001,
  TASK_NOT_CANCELABLE: -32002,
  PUSH_NOTIFICATION_NOT_SUPPORTED: -32003,
  UNSUPPORTED_OPERATION: -32004,
  CONTENT_TYPE_NOT_SUPPORTED: -32005,
  INVALID_AGENT_CARD: -32006
} as const;

// ============================================================================
// Agent Card Types
// ============================================================================

/**
 * Agent capabilities.
 */
export interface AgentCapabilities {
  /** Supports streaming responses */
  streaming?: boolean;
  /** Supports push notifications */
  pushNotifications?: boolean;
  /** Supports state transition history */
  stateTransitionHistory?: boolean;
}

/**
 * Agent authentication scheme.
 */
export interface AuthenticationInfo {
  /** Supported auth schemes */
  schemes: AuthScheme[];
  /** Required credentials */
  credentials?: string[];
}

/**
 * Authentication scheme.
 */
export type AuthScheme = 'Bearer' | 'Basic' | 'APIKey' | 'OAuth2' | 'Custom';

/**
 * Agent skill definition.
 */
export interface AgentSkill {
  /** Unique skill ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Skill description */
  description?: string;
  /** Input schema (JSON Schema) */
  inputSchema?: Record<string, unknown>;
  /** Output schema (JSON Schema) */
  outputSchema?: Record<string, unknown>;
  /** Supported input modes */
  inputModes?: string[];
  /** Supported output modes */
  outputModes?: string[];
  /** Example invocations */
  examples?: SkillExample[];
  /** Tags for categorization */
  tags?: string[];
}

/**
 * Skill example.
 */
export interface SkillExample {
  /** Example description */
  description?: string;
  /** Example input */
  input: TaskInput;
  /** Expected output */
  output?: TaskOutput;
}

/**
 * Agent provider information.
 */
export interface AgentProvider {
  /** Provider organization */
  organization: string;
  /** Contact URL */
  url?: string;
  /** Contact email */
  email?: string;
}

/**
 * Agent card - metadata about an A2A agent.
 */
export interface AgentCard {
  /** Agent name */
  name: string;
  /** Agent description */
  description?: string;
  /** A2A endpoint URL */
  url: string;
  /** Agent version */
  version?: string;
  /** Agent capabilities */
  capabilities?: AgentCapabilities;
  /** Authentication info */
  authentication?: AuthenticationInfo;
  /** Agent skills */
  skills?: AgentSkill[];
  /** Default input modes */
  defaultInputModes?: string[];
  /** Default output modes */
  defaultOutputModes?: string[];
  /** Provider info */
  provider?: AgentProvider;
  /** Documentation URL */
  documentationUrl?: string;
  /** Agent icon URL */
  iconUrl?: string;
  /** Legal/compliance info */
  legalInfoUrl?: string;
  /** Privacy policy URL */
  privacyPolicyUrl?: string;
  /** Terms of service URL */
  termsOfServiceUrl?: string;
}

// ============================================================================
// Content Types
// ============================================================================

/**
 * Base content part interface.
 */
export interface ContentPartBase {
  /** Content type discriminator */
  type: string;
}

/**
 * Text content part.
 */
export interface TextPart extends ContentPartBase {
  type: 'text';
  /** Text content */
  text: string;
}

/**
 * File content part.
 */
export interface FilePart extends ContentPartBase {
  type: 'file';
  /** File reference */
  file: FileContent;
}

/**
 * File content.
 */
export interface FileContent {
  /** File name */
  name?: string;
  /** MIME type */
  mimeType?: string;
  /** File URL (for remote files) */
  uri?: string;
  /** Base64 encoded content (for inline files) */
  bytes?: string;
}

/**
 * Data content part (structured data).
 */
export interface DataPart extends ContentPartBase {
  type: 'data';
  /** Data object */
  data: Record<string, unknown>;
  /** Optional schema reference */
  schema?: string;
}

/**
 * Union of all content part types.
 */
export type ContentPart = TextPart | FilePart | DataPart;

/**
 * Message role.
 */
export type MessageRole = 'user' | 'agent';

/**
 * Message in a conversation.
 */
export interface Message {
  /** Message role */
  role: MessageRole;
  /** Message content parts */
  parts: ContentPart[];
  /** Message metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Task Types
// ============================================================================

/**
 * Task state.
 */
export type TaskState = 
  | 'submitted'    // Task has been submitted
  | 'working'      // Agent is processing
  | 'input-required' // Agent needs more input
  | 'completed'    // Task completed successfully
  | 'failed'       // Task failed
  | 'canceled';    // Task was canceled

/**
 * Task input.
 */
export interface TaskInput {
  /** Input message */
  message: Message;
  /** Target skill ID (optional) */
  skillId?: string;
  /** Push notification config */
  pushNotification?: PushNotificationConfig;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Task output.
 */
export interface TaskOutput {
  /** Output message */
  message?: Message;
  /** Artifacts produced */
  artifacts?: Artifact[];
  /** Error information */
  error?: TaskError;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Task error.
 */
export interface TaskError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Error details */
  details?: Record<string, unknown>;
}

/**
 * Artifact produced by a task.
 */
export interface Artifact {
  /** Artifact ID */
  id: string;
  /** Artifact name */
  name?: string;
  /** Artifact type */
  type?: string;
  /** Artifact content parts */
  parts: ContentPart[];
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Task status.
 */
export interface TaskStatus {
  /** Current state */
  state: TaskState;
  /** Output (if any) */
  output?: TaskOutput;
  /** State timestamp */
  timestamp?: string;
}

/**
 * Task state transition.
 */
export interface TaskStateTransition {
  /** From state */
  from: TaskState;
  /** To state */
  to: TaskState;
  /** Transition timestamp */
  timestamp: string;
  /** Transition metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Full task object.
 */
export interface Task {
  /** Task ID */
  id: string;
  /** Session ID */
  sessionId?: string;
  /** Task input */
  input: TaskInput;
  /** Current status */
  status: TaskStatus;
  /** State history (if capability enabled) */
  history?: TaskStateTransition[];
  /** Task metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Push Notification Types
// ============================================================================

/**
 * Push notification configuration.
 */
export interface PushNotificationConfig {
  /** Callback URL */
  url: string;
  /** Auth token for callback */
  token?: string;
  /** Events to notify on */
  events?: PushNotificationEvent[];
}

/**
 * Push notification events.
 */
export type PushNotificationEvent = 
  | 'task.state.changed'
  | 'task.output.updated'
  | 'task.artifact.added';

/**
 * Push notification payload.
 */
export interface PushNotification {
  /** Notification ID */
  id: string;
  /** Event type */
  event: PushNotificationEvent;
  /** Task ID */
  taskId: string;
  /** Payload data */
  data: unknown;
  /** Timestamp */
  timestamp: string;
}

// ============================================================================
// Method Parameter Types
// ============================================================================

/**
 * tasks/send parameters.
 */
export interface TaskSendParams {
  /** Task input */
  input: TaskInput;
  /** Session ID (optional, creates new if omitted) */
  sessionId?: string;
  /** Task metadata */
  metadata?: Record<string, unknown>;
}

/**
 * tasks/send result.
 */
export interface TaskSendResult {
  /** Created task */
  task: Task;
}

/**
 * tasks/sendSubscribe parameters (streaming).
 */
export interface TaskSendSubscribeParams extends TaskSendParams {
  /** Enable streaming */
  stream: true;
}

/**
 * tasks/get parameters.
 */
export interface TaskGetParams {
  /** Task ID */
  id: string;
  /** Include history */
  includeHistory?: boolean;
}

/**
 * tasks/get result.
 */
export interface TaskGetResult {
  /** Task */
  task: Task;
}

/**
 * tasks/cancel parameters.
 */
export interface TaskCancelParams {
  /** Task ID */
  id: string;
  /** Cancellation reason */
  reason?: string;
}

/**
 * tasks/cancel result.
 */
export interface TaskCancelResult {
  /** Updated task */
  task: Task;
}

/**
 * tasks/pushNotification/get parameters.
 */
export interface PushNotificationGetParams {
  /** Task ID */
  id: string;
}

/**
 * tasks/pushNotification/get result.
 */
export interface PushNotificationGetResult {
  /** Current config */
  config: PushNotificationConfig | null;
}

/**
 * tasks/pushNotification/set parameters.
 */
export interface PushNotificationSetParams {
  /** Task ID */
  id: string;
  /** New config */
  config: PushNotificationConfig;
}

/**
 * tasks/pushNotification/set result.
 */
export interface PushNotificationSetResult {
  /** Updated config */
  config: PushNotificationConfig;
}

/**
 * tasks/resubscribe parameters.
 */
export interface TaskResubscribeParams {
  /** Task ID */
  id: string;
}

// ============================================================================
// Streaming Event Types
// ============================================================================

/**
 * Streaming event types.
 */
export type StreamEventType = 
  | 'task.status'
  | 'task.artifact'
  | 'task.output'
  | 'error'
  | 'done';

/**
 * Base streaming event.
 */
export interface StreamEventBase {
  /** Event type */
  type: StreamEventType;
}

/**
 * Task status streaming event.
 */
export interface TaskStatusEvent extends StreamEventBase {
  type: 'task.status';
  /** Task status */
  status: TaskStatus;
  /** Final flag */
  final?: boolean;
}

/**
 * Task artifact streaming event.
 */
export interface TaskArtifactEvent extends StreamEventBase {
  type: 'task.artifact';
  /** Artifact */
  artifact: Artifact;
}

/**
 * Task output streaming event.
 */
export interface TaskOutputEvent extends StreamEventBase {
  type: 'task.output';
  /** Output delta */
  delta: Partial<TaskOutput>;
}

/**
 * Error streaming event.
 */
export interface ErrorEvent extends StreamEventBase {
  type: 'error';
  /** Error */
  error: JsonRpcError;
}

/**
 * Done streaming event.
 */
export interface DoneEvent extends StreamEventBase {
  type: 'done';
  /** Final task */
  task: Task;
}

/**
 * Union of all streaming events.
 */
export type StreamEvent = 
  | TaskStatusEvent 
  | TaskArtifactEvent 
  | TaskOutputEvent 
  | ErrorEvent 
  | DoneEvent;

// ============================================================================
// Client Configuration Types
// ============================================================================

/**
 * A2A client configuration.
 */
export interface A2AClientConfig {
  /** Agent card URL or direct agent card */
  agentCard: string | AgentCard;
  /** Authentication credentials */
  auth?: A2AAuthConfig;
  /** Request timeout (ms) */
  timeout?: number;
  /** Enable automatic retries */
  retryEnabled?: boolean;
  /** Max retry attempts */
  maxRetries?: number;
  /** Retry delay (ms) */
  retryDelay?: number;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Authentication configuration.
 */
export interface A2AAuthConfig {
  /** Auth scheme */
  scheme: AuthScheme;
  /** Token (for Bearer auth) */
  token?: string;
  /** API key (for APIKey auth) */
  apiKey?: string;
  /** Username (for Basic auth) */
  username?: string;
  /** Password (for Basic auth) */
  password?: string;
  /** Custom auth header value */
  customValue?: string;
}

// ============================================================================
// Client Event Types
// ============================================================================

/**
 * Client event types.
 */
export type ClientEventType = 
  | 'connected'
  | 'disconnected'
  | 'task-created'
  | 'task-updated'
  | 'task-completed'
  | 'task-failed'
  | 'stream-start'
  | 'stream-event'
  | 'stream-end'
  | 'stream-validation-error'  // Phase 1: Schema validation error
  | 'stream-parse-error'       // Phase 1: JSON parse error
  | 'sessions-cleaned'         // Phase 1: Session cleanup event
  | 'error';

/**
 * Client event.
 */
export interface ClientEvent {
  /** Event type */
  type: ClientEventType;
  /** Event timestamp */
  timestamp: string;
  /** Event data */
  data: unknown;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * A2A method names.
 */
export type A2AMethod = 
  | 'tasks/send'
  | 'tasks/sendSubscribe'
  | 'tasks/get'
  | 'tasks/cancel'
  | 'tasks/pushNotification/get'
  | 'tasks/pushNotification/set'
  | 'tasks/resubscribe';

/**
 * HTTP method for A2A.
 */
export type HttpMethod = 'POST';

/**
 * Session state.
 */
export interface Session {
  /** Session ID */
  id: string;
  /** Task IDs in this session */
  taskIds: string[];
  /** Session metadata */
  metadata?: Record<string, unknown>;
  /** Creation timestamp */
  createdAt: string;
  /** Last activity timestamp */
  lastActivityAt: string;
}

/**
 * AG-UI Protocol Type Definitions
 * 
 * Core types and interfaces for the Agent User Interaction Protocol
 * Defines message structure, roles, events, and transport mechanisms
 * 
 * @module agui/protocol
 */

// =============================================================================
// Core Message Types
// =============================================================================

export type AGUIRole = 'user' | 'assistant' | 'system' | 'tool' | 'developer' | 'activity';

export type AGUIEventType = 
  | 'message.created'
  | 'message.updated'
  | 'message.deleted'
  | 'session.started'
  | 'session.ended'
  | 'agent.connected'
  | 'agent.disconnected'
  | 'agent.thinking'
  | 'agent.responding'
  | 'tool.invoked'
  | 'tool.completed'
  | 'tool.failed'
  | 'user.interaction'
  | 'system.notification'
  | 'state.changed'
  | 'error.occurred';

export interface AGUIMessage {
  id: string;
  sessionId: string;
  role: AGUIRole;
  type: AGUIEventType;
  timestamp: string; // ISO 8601
  data: unknown;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Specific Message Types
// =============================================================================

export interface UserMessage extends AGUIMessage {
  role: 'user';
  type: 'message.created' | 'user.interaction';
  data: {
    content: string;
    attachments?: Array<{
      type: 'file' | 'image' | 'code';
      content: string;
      name?: string;
    }>;
  };
}

export interface AssistantMessage extends AGUIMessage {
  role: 'assistant';
  type: 'message.created' | 'agent.thinking' | 'agent.responding';
  data: {
    content?: string;
    thinking?: string;
    confidence?: number;
    toolCalls?: Array<{
      id: string;
      name: string;
      arguments: Record<string, unknown>;
    }>;
  };
}

export interface SystemMessage extends AGUIMessage {
  role: 'system';
  type: 'session.started' | 'session.ended' | 'system.notification' | 'state.changed';
  data: {
    message?: string;
    state?: Record<string, unknown>;
    notification?: {
      level: 'info' | 'warning' | 'error' | 'success';
      title: string;
      description: string;
    };
  };
}

export interface ToolMessage extends AGUIMessage {
  role: 'tool';
  type: 'tool.invoked' | 'tool.completed' | 'tool.failed';
  data: {
    toolName: string;
    toolCallId?: string;
    input?: Record<string, unknown>;
    output?: unknown;
    error?: string;
    duration?: number; // ms
  };
}

export interface ActivityMessage extends AGUIMessage {
  role: 'activity';
  type: 'message.updated' | 'message.deleted' | 'agent.connected' | 'agent.disconnected';
  data: {
    activity: string;
    details?: Record<string, unknown>;
    previousState?: unknown;
    newState?: unknown;
  };
}

export interface ErrorMessage extends AGUIMessage {
  role: 'system' | 'tool';
  type: 'error.occurred';
  data: {
    error: string;
    code?: string;
    stack?: string;
    context?: Record<string, unknown>;
  };
}

// =============================================================================
// Transport Configuration
// =============================================================================

export type TransportType = 'websocket' | 'http' | 'sse';

export interface TransportConfig {
  type: TransportType;
  url: string;
  options?: {
    reconnect?: boolean;
    maxReconnectAttempts?: number;
    reconnectDelay?: number;
    timeout?: number;
    headers?: Record<string, string>;
  };
}

// =============================================================================
// Session Management
// =============================================================================

export interface AGUISession {
  id: string;
  userId?: string;
  agentId?: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'inactive' | 'terminated';
  metadata?: Record<string, unknown>;
}

export interface SessionConfig {
  sessionId?: string;
  userId?: string;
  agentId?: string;
  timeout?: number; // ms
  keepAlive?: boolean;
}

// =============================================================================
// Event Handlers
// =============================================================================

export type MessageHandler<T extends AGUIMessage = AGUIMessage> = (message: T) => void | Promise<void>;

export type EventHandler<T = unknown> = (data: T) => void | Promise<void>;

export interface EventSubscription {
  id: string;
  eventType: AGUIEventType;
  handler: MessageHandler;
  once?: boolean;
}

// =============================================================================
// Client Configuration
// =============================================================================

export interface AGUIClientConfig {
  transport: TransportConfig;
  session?: SessionConfig;
  autoConnect?: boolean;
  logging?: {
    enabled?: boolean;
    level?: 'debug' | 'info' | 'warn' | 'error';
  };
  retryPolicy?: {
    maxRetries?: number;
    backoffMultiplier?: number;
    initialDelay?: number;
  };
}

// =============================================================================
// Utility Types
// =============================================================================

export type AGUIMessageMap = {
  user: UserMessage;
  assistant: AssistantMessage;
  system: SystemMessage;
  tool: ToolMessage;
  activity: ActivityMessage;
  developer: AGUIMessage; // Generic for developer messages
};

export type ExtractMessageData<T extends AGUIMessage> = T['data'];

export type MessageByRole<R extends AGUIRole> = AGUIMessageMap[R];

export type MessageByType<T extends AGUIEventType> = AGUIMessage & { type: T };

// =============================================================================
// Validation Types
// =============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface MessageValidator {
  validate(message: AGUIMessage): ValidationResult;
}

// =============================================================================
// Serialization Types
// =============================================================================

export interface SerializationFormat {
  serialize(message: AGUIMessage): string;
  deserialize(data: string): AGUIMessage;
}

export type SupportedFormats = 'json' | 'jsonl' | 'cbor' | 'msgpack';

// =============================================================================
// Error Types
// =============================================================================

export class AGUIError extends Error {
  constructor(
    message: string,
    public code?: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AGUIError';
  }
}

export class TransportError extends AGUIError {
  constructor(message: string, code?: string, context?: Record<string, unknown>) {
    super(message, code, context);
    this.name = 'TransportError';
  }
}

export class SerializationError extends AGUIError {
  constructor(message: string, code?: string, context?: Record<string, unknown>) {
    super(message, code, context);
    this.name = 'SerializationError';
  }
}

export class ValidationError extends AGUIError {
  constructor(message: string, code?: string, context?: Record<string, unknown>) {
    super(message, code, context);
    this.name = 'ValidationError';
  }
}
/**
 * Message Types for TUI
 *
 * @module tui/types/messages
 */

/**
 * Agent message in conversation
 */
export interface AgentMessage {
  /** Unique message ID */
  id: string;

  /** Agent who sent this message */
  agentId: string;

  /** Agent display name */
  agentName: string;

  /** Agent role (architect, coder, etc.) */
  agentRole: string;

  /** Message content (may be partial during streaming) */
  content: string;

  /** Is message still streaming */
  streaming: boolean;

  /** Timestamp */
  timestamp: Date;

  /** Response metrics (if complete) */
  metrics?: ResponseMetrics;

  /** Tool executions within this message */
  toolCalls?: ToolExecution[];

  /** If this is a handoff, from which agent */
  handoffFrom?: string;
}

/**
 * Response metrics for completed messages
 */
export interface ResponseMetrics {
  /** Response duration in ms */
  duration: number;

  /** Input token count */
  inputTokens: number;

  /** Output token count */
  outputTokens: number;

  /** Model used */
  model: string;

  /** Estimated cost in USD */
  cost: number;
}

/**
 * Tool execution within a message
 */
export interface ToolExecution {
  /** Tool call ID */
  id: string;

  /** Tool name */
  name: string;

  /** Tool arguments */
  args: Record<string, unknown>;

  /** Execution status */
  status: 'pending' | 'running' | 'success' | 'error';

  /** Result (if complete) */
  result?: string;

  /** Error message (if failed) */
  error?: string;

  /** Execution duration in ms */
  duration?: number;
}

/**
 * User message (input)
 */
export interface UserMessage {
  /** Unique message ID */
  id: string;

  /** Message content */
  content: string;

  /** Timestamp */
  timestamp: Date;

  /** Was this a magic command */
  isCommand: boolean;

  /** Parsed command (if isCommand) */
  command?: ParsedCommand;
}

/**
 * Parsed magic command
 */
export interface ParsedCommand {
  /** Command name (without /) */
  name: string;

  /** Command arguments */
  args: string[];

  /** Raw argument string */
  rawArgs: string;
}

/**
 * System notification message
 */
export interface SystemMessage {
  /** Unique message ID */
  id: string;

  /** Message type */
  type: 'info' | 'warning' | 'error' | 'success';

  /** Message content */
  content: string;

  /** Timestamp */
  timestamp: Date;

  /** Auto-dismiss after ms (0 = never) */
  dismissAfter?: number;
}

/**
 * Union type for all message types
 */
export type Message = AgentMessage | UserMessage | SystemMessage;

/**
 * Type guards
 */
export function isAgentMessage(msg: Message): msg is AgentMessage {
  return 'agentId' in msg;
}

export function isUserMessage(msg: Message): msg is UserMessage {
  return 'isCommand' in msg;
}

export function isSystemMessage(msg: Message): msg is SystemMessage {
  return 'type' in msg && !('agentId' in msg);
}

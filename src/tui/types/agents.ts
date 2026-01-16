/**
 * Agent Types for TUI
 *
 * @module tui/types/agents
 */

/**
 * Agent representation in TUI
 */
export interface Agent {
  /** Unique agent ID */
  id: string;

  /** Display name */
  name: string;

  /** Agent role (architect, coder, reviewer, etc.) */
  role: AgentRole;

  /** Underlying model */
  model: string;

  /** Current status */
  status: AgentStatus;

  /** Emoji for display */
  emoji: string;

  /** Color scheme */
  color: string;

  /** Description */
  description?: string;

  /** Last activity timestamp */
  lastActive?: Date;

  /** Current task (if working) */
  currentTask?: string;
}

/**
 * Agent roles
 */
export type AgentRole =
  | 'architect'
  | 'coder'
  | 'reviewer'
  | 'researcher'
  | 'tester'
  | 'coordinator'
  | 'custom';

/**
 * Agent status
 */
export type AgentStatus =
  | 'idle'      // Ready but not active
  | 'thinking'  // Processing request
  | 'streaming' // Streaming response
  | 'waiting'   // Waiting for tool result
  | 'error'     // In error state
  | 'offline';  // Not available

/**
 * Agent status display mapping
 */
export const AGENT_STATUS_DISPLAY: Record<AgentStatus, { icon: string; color: string }> = {
  idle: { icon: '⚪', color: 'gray' },
  thinking: { icon: '🔵', color: 'blue' },
  streaming: { icon: '🟢', color: 'green' },
  waiting: { icon: '🟡', color: 'yellow' },
  error: { icon: '🔴', color: 'red' },
  offline: { icon: '⚫', color: 'gray' },
};

/**
 * Agent handoff information
 */
export interface AgentHandoff {
  /** Source agent ID */
  fromAgentId: string;

  /** Target agent ID */
  toAgentId: string;

  /** Reason for handoff */
  reason: string;

  /** Context passed to target */
  context?: string;

  /** Timestamp */
  timestamp: Date;
}

/**
 * Agent statistics
 */
export interface AgentStats {
  /** Total messages sent */
  messageCount: number;

  /** Total tokens used */
  totalTokens: number;

  /** Total cost */
  totalCost: number;

  /** Average response time in ms */
  avgResponseTime: number;

  /** Total tool calls made */
  toolCalls: number;
}

/**
 * Default agents for initialization
 */
export const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'architect',
    name: 'Architect',
    role: 'architect',
    model: 'claude-3.5-sonnet',
    status: 'idle',
    emoji: '🏗️',
    color: 'yellow',
    description: 'Designs systems and plans implementations',
  },
  {
    id: 'coder',
    name: 'Coder',
    role: 'coder',
    model: 'gpt-4o',
    status: 'idle',
    emoji: '💻',
    color: 'green',
    description: 'Implements code and makes changes',
  },
  {
    id: 'reviewer',
    name: 'Reviewer',
    role: 'reviewer',
    model: 'claude-3.5-sonnet',
    status: 'idle',
    emoji: '🔍',
    color: 'magenta',
    description: 'Reviews code and finds issues',
  },
];

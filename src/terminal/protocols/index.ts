/**
 * Terminal Protocols
 *
 * Type definitions for agent canvas and terminal interactions.
 *
 * @module terminal/protocols
 */

export interface AgentPosition {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export type AgentState = string;

export interface AgentSpecSummary {
  name: string;
  role: string;
  goal?: string;
  version?: string;
  description?: string;
  capabilities?: string[];
  modelTier?: string;
}

export interface CanvasAgent {
  id: string;
  spec: AgentSpecSummary;
  state: AgentState;
  position: AgentPosition;
  createdAt: number;
  updatedAt: number;
}

export interface CanvasMetadata {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
  description?: string;
}

export interface CanvasAgentLayout {
  agentId: string;
  position: AgentPosition;
  collapsed?: boolean;
  pinned?: boolean;
  selected?: boolean;
  updatedAt?: number;
}

export interface AgentCanvasState {
  id: string;
  metadata: CanvasMetadata;
  agents: CanvasAgent[];
  layouts: Record<string, CanvasAgentLayout>;
  selectedAgentId?: string;

  connections?: AgentConnection[];
  focusedAgentId?: string;
  mode?: CanvasMode;
  viewport?: Viewport;
}

export interface AgentConnection {
  id: string;
  sourceAgentId: string;
  targetAgentId: string;
  type: ConnectionType;
  label?: string;
  metadata?: Record<string, unknown>;
}

export type ConnectionType = 'collaboration' | 'handoff' | 'supervision' | 'peer';

export type CanvasMode = 'view' | 'edit' | 'connect' | 'debug';

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface TerminalMessage {
  id: string;
  type: 'input' | 'output' | 'error' | 'system';
  content: string;
  timestamp: Date;
  agentId?: string;
  metadata?: Record<string, unknown>;
}

export interface TerminalSession {
  id: string;
  agentId: string;
  messages: TerminalMessage[];
  isActive: boolean;
  startTime: Date;
  endTime?: Date;
}

export default {
  // Re-export for convenience
};

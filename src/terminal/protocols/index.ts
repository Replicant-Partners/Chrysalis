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
}

export interface AgentState {
  isActive: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  currentTask?: string;
  confidence?: number;
}

export interface CanvasAgent {
  id: string;
  name: string;
  role: string;
  position: AgentPosition;
  state: AgentState;
  color?: string;
  avatar?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentCanvasState {
  agents: CanvasAgent[];
  connections: AgentConnection[];
  selectedAgentId?: string;
  focusedAgentId?: string;
  mode: CanvasMode;
  viewport: Viewport;
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

export interface AgentSpecSummary {
  id: string;
  name: string;
  role: string;
  description: string;
  capabilities: string[];
  modelTier: string;
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

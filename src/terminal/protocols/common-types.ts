/**
 * Lean terminal/common types for Agent Team canvas + chat.
 * This replaces the heavier JSON-canvas/widget registry model.
 */

export type ParticipantId = string;
export type ParticipantType = 'human' | 'agent' | 'system';
export type FramePosition = 'left' | 'right' | 'center';
export type TerminalId = string;

export interface ChatMessage {
  id: string;
  senderId: ParticipantId;
  senderType: ParticipantType;
  senderName: string;
  content: string;
  timestamp: number;
  replyToId?: string;
  metadata?: Record<string, unknown>;
  attachments?: any[];
}

export interface ChatPaneState {
  id: string;
  title: string;
  messages: ChatMessage[];
  participants: ParticipantId[];
  isTyping: ParticipantId[];
  position?: 'left' | 'right';
}

export interface AgentPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex?: number;
}

export type AgentState = 'dormant' | 'waking' | 'awake' | 'sleeping' | 'error';

export interface AgentSpecSummary {
  name: string;
  role: string;
  goal: string;
  version: string;
  backstory?: string;
  tools?: Array<{ name: string; description?: string }>;
  skills?: Array<{ name: string; description?: string }>;
  tags?: string[];
}

export interface CanvasAgent {
  id: string;
  spec: AgentSpecSummary;
  state: AgentState;
  position: AgentPosition;
  createdAt: number;
  updatedAt: number;
  sourceFormat?: string;
  lastError?: {
    code: string;
    message: string;
    recoverable?: boolean;
  };
}

export interface AgentLayout {
  agentId: string;
  position: AgentPosition;
  collapsed: boolean;
  selected: boolean;
  pinned: boolean;
  updatedAt?: number;
}

export interface AgentCanvasMetadata {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  createdBy: ParticipantId;
  description?: string;
  tags?: string[];
}

export interface AgentCanvasState {
  id: string;
  metadata: AgentCanvasMetadata;
  agents: CanvasAgent[];
  layouts: Record<string, AgentLayout>;
  selectedAgentId?: string;
}

export interface DataResourceLink {
  id: string;
  resourceId: string;
  resourceType?: string;
  name: string;
  storageLocation?: string;
  storageType?: string;
  requiresAuth?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

// Minimal canvas node placeholders (for compatibility)
export interface CanvasNode {
  id: string;
  type: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
}
export type WidgetNode = CanvasNode;
export type CanvasEdge = unknown;

// Minimal terminal events/config
export type TerminalEventType = string;
export interface TerminalEvent {
  type: TerminalEventType;
  timestamp: number;
  payload?: unknown;
}
export type TerminalEventHandler = (event: TerminalEvent) => void;

export interface TerminalConfig {
  sessionName?: string;
  leftPane?: { title: string };
  rightPane?: { title: string };
  participantId?: string;
}

export interface TerminalSession {
  id: TerminalId;
  name: string;
  left: ChatPaneState;
  right: ChatPaneState;
  canvas: AgentCanvasState;
}

export const DEFAULT_TERMINAL_CONFIG: TerminalConfig = {
  sessionName: 'Chrysalis Terminal',
  leftPane: { title: 'Agents' },
  rightPane: { title: 'You' }
};

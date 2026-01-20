/**
 * ChrysalisWorkspace Types
 *
 * Type definitions for the main workspace component.
 *
 * @module components/ChrysalisWorkspace/types
 */

import { CanvasAgent, AgentCanvasState } from '../../terminal/protocols';

export type ChatPanePosition = 'left' | 'right';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  agentId?: string;
  isStreaming?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ChatParticipant {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  color?: string;
  isActive: boolean;
}

export interface AgentBinding {
  agentId: string;
  agentName: string;
  agentRole: string;
  position: ChatPanePosition;
  isActive: boolean;
  avatar?: string;
  color?: string;
  metadata?: Record<string, unknown>;
}

export interface PanelSizes {
  leftWidth: number;
  rightWidth: number;
}

export interface WorkspaceSession {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  bindings: AgentBinding[];
  messages: Record<ChatPanePosition, ChatMessage[]>;
  canvasState?: AgentCanvasState;
}

export interface WorkspaceConfig {
  defaultLeftAgent: string;
  defaultRightAgent: string;
  enableMemory: boolean;
  enableLearning: boolean;
  enableSync: boolean;
  memoryApiUrl: string;
  systemAgentsUrl: string;
  gatewayUrl: string;
  panelSizes: PanelSizes;
}

export const DEFAULT_WORKSPACE_CONFIG: WorkspaceConfig = {
  defaultLeftAgent: 'ada',
  defaultRightAgent: 'lea',
  enableMemory: true,
  enableLearning: false,
  enableSync: true,
  memoryApiUrl: 'http://localhost:8082',
  systemAgentsUrl: 'http://localhost:3200',
  gatewayUrl: 'http://localhost:8080',
  panelSizes: {
    leftWidth: 320,
    rightWidth: 320,
  },
};

export interface ChrysalisWorkspaceProps {
  /** Initial workspace session to load */
  initialSession?: WorkspaceSession;
  /** Configuration overrides */
  config?: Partial<WorkspaceConfig>;
  /** Available agents for binding */
  availableAgents?: AgentBinding[];
  /** Callback when session changes */
  onSessionChange?: (session: WorkspaceSession) => void;
  /** Callback when message is sent */
  onMessageSent?: (message: ChatMessage, position: ChatPanePosition) => void;
  /** Callback when agent is selected */
  onAgentSelected?: (agentId: string, position: ChatPanePosition) => void;
  /** Custom canvas component */
  customCanvas?: React.ComponentType<{ state: AgentCanvasState }>;
  /** Enable debug mode */
  debug?: boolean;
}

export interface ChatPaneProps {
  position: ChatPanePosition;
  binding: AgentBinding;
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  onAgentChange?: (agentId: string) => void;
  availableAgents?: AgentBinding[];
  isLoading?: boolean;
  showMemoryIndicator?: boolean;
}

export default {
  DEFAULT_WORKSPACE_CONFIG,
};

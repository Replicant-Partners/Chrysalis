/**
 * ChrysalisWorkspace Types
 *
 * Type definitions for the three-frame dual-chat canvas architecture.
 *
 * @module components/ChrysalisWorkspace/types
 */

import * as Y from 'yjs';
import type { AgentMemoryAdapter } from '../../memory/AgentMemoryAdapter';

// =============================================================================
// Chat Types
// =============================================================================

/**
 * Sender type for chat messages
 */
export type ChatSenderType = 'user' | 'agent' | 'system';

/**
 * Memory indicators showing what memories were used/created
 */
export interface MemoryIndicator {
  type: 'episodic' | 'semantic' | 'skill';
  memoryId: string;
  content: string;
  confidence: number;
  usedInResponse: boolean;
}

/**
 * Permission request from agent requiring user approval
 */
export interface PermissionRequest {
  requestId: string;
  agentId: string;
  agentName: string;
  trust: 'external' | 'internal' | 'ada';
  action: string;
  summary: string;
  scopePreview?: string;
  riskLevel?: 'low' | 'med' | 'high';
  status: 'pending' | 'approved' | 'denied' | 'expired';
}

/**
 * Chat message structure
 */
export interface ChatMessage {
  id: string;
  timestamp: number;
  senderId: string;
  senderName: string;
  senderType: ChatSenderType;
  content: string;
  
  // Optional metadata for learning feedback
  metadata?: {
    memoryIds?: string[];        // IDs of memories this message created
    recalledMemories?: string[]; // IDs of memories recalled for this response
    skillUsed?: string;          // Skill ID if agent used a learned skill
    processingTimeMs?: number;   // How long the agent took to respond
  };
  
  // Memory indicators for UI display
  memoryIndicators?: MemoryIndicator[];
  
  // Permission request (for Ada or other agents requiring approval)
  permissionRequest?: PermissionRequest;
}

/**
 * Chat participant (user or agent)
 */
export interface ChatParticipant {
  id: string;
  type: 'user' | 'agent';
  name: string;
  avatarUrl?: string;
  joinedAt: number;
  isTyping?: boolean;
}

/**
 * Chat pane position
 */
export type ChatPanePosition = 'left' | 'right';

/**
 * Agent binding for a chat pane
 */
export interface AgentBinding {
  agentId: string;
  agentName: string;
  agentType: 'primary' | 'secondary';
  avatarUrl?: string;
}

// =============================================================================
// Workspace Types
// =============================================================================

/**
 * Workspace session information
 */
export interface WorkspaceSession {
  id: string;
  createdAt: number;
  primaryAgentId: string;
  secondaryAgentId?: string;
  userId: string;
  userName: string;
}

/**
 * Workspace viewport state
 */
export interface WorkspaceViewport {
  canvasZoom: number;
  canvasPanX: number;
  canvasPanY: number;
}

/**
 * Panel resize state
 */
export interface PanelSizes {
  leftWidth: number;   // Percentage (0-100)
  rightWidth: number;  // Percentage (0-100)
  centerWidth: number; // Calculated: 100 - left - right
}

/**
 * Workspace configuration
 */
export interface WorkspaceConfig {
  // Panel sizing
  defaultPanelSizes: PanelSizes;
  minPanelWidth: number;  // Minimum width in pixels
  
  // Chat configuration
  maxMessagesPerPane: number;
  showMemoryIndicators: boolean;
  showTypingIndicators: boolean;
  
  // Canvas configuration
  enableDocumentDrop: boolean;
  enableSkillLearning: boolean;

  // Gateway (Go service) configuration for lean path
  gateway?: {
    baseUrl?: string;
    authToken?: string;
    model?: string;
    stream?: boolean;
  };

  // Canvas rendering
  canvasSnapToGrid: boolean;
  canvasGridSize: number;
  canvasShowGrid: boolean;

  // Collaboration (YJS) toggle; off by default for lean path
  enableYjs: boolean;
}

/**
 * Default workspace configuration
 */
export const DEFAULT_WORKSPACE_CONFIG: WorkspaceConfig = {
  defaultPanelSizes: {
    leftWidth: 25,
    rightWidth: 25,
    centerWidth: 50,
  },
  minPanelWidth: 280,
  maxMessagesPerPane: 500,
  showMemoryIndicators: true,
  showTypingIndicators: true,
  enableDocumentDrop: false,
  enableSkillLearning: true,
  canvasSnapToGrid: true,
  canvasGridSize: 20,
  canvasShowGrid: true,
  enableYjs: false,
};

// =============================================================================
// YJS Document Types
// =============================================================================

/**
 * YJS-synced workspace state structure
 */
export interface WorkspaceYJSState {
  leftChat: Y.Array<ChatMessage>;
  rightChat: Y.Array<ChatMessage>;
  session: Y.Map<unknown>;
  participants: Y.Map<ChatParticipant>;
}

/**
 * Create a typed wrapper for YJS document
 */
export interface WorkspaceYJSDoc {
  doc: Y.Doc;
  leftChat: Y.Array<ChatMessage>;
  rightChat: Y.Array<ChatMessage>;
  session: Y.Map<unknown>;
  participants: Y.Map<ChatParticipant>;
}

// =============================================================================
// Component Props
// =============================================================================

/**
 * ChatPane component props
 */
export interface ChatPaneProps {
  paneId: ChatPanePosition;
  agent: AgentBinding;
  messages: ChatMessage[];
  participants: ChatParticipant[];

  // State
  isLoading?: boolean;
  isAgentTyping?: boolean;

  // Configuration
  showMemoryIndicators?: boolean;
  maxMessages?: number;

  // Persistent affordances
  showInviteButton?: boolean;
  showDndButton?: boolean;
  dndState?: 'off' | 'on';

  // Callbacks
  onSendMessage: (content: string) => void;
  onClearChat?: () => void;
  onInviteClick?: () => void;
  onToggleDnd?: (state: 'off' | 'on') => void;
  onPermissionApprove?: (requestId: string) => void;
  onPermissionDeny?: (requestId: string) => void;
  onPermissionExplain?: (requestId: string) => void;
}

/**
 * Memory event emitted by the workspace for UI feedback
 */
export interface MemoryUIEvent {
  type: 'added' | 'recalled' | 'learned' | 'consolidated';
  tier?: 'working' | 'episodic' | 'semantic' | 'procedural';
  memoryId?: string;
  memoryIds?: string[];
  content?: string;
  count?: number;
  source?: string;
  factsExtracted?: number;
}

/**
 * ChrysalisWorkspace component props
 */
export interface ChrysalisWorkspaceProps {
  // Session
  sessionId?: string;
  userId: string;
  userName: string;
  
  // Agent bindings
  primaryAgent: AgentBinding;
  secondaryAgent?: AgentBinding;
  
  // YJS sync (optional - if not provided, local state only)
  yjsDoc?: Y.Doc;
  
  // Memory system (optional - if not provided, creates internal adapter)
  memoryAdapter?: AgentMemoryAdapter;
  
  // Configuration
  config?: Partial<WorkspaceConfig>;
  
  // Callbacks
  onSessionStart?: (session: WorkspaceSession) => void;
  onSessionEnd?: (session: WorkspaceSession) => void;
  onMessageSent?: (message: ChatMessage, pane: ChatPanePosition) => void;
  onAgentResponse?: (message: ChatMessage, pane: ChatPanePosition) => void;
  onDocumentDrop?: (file: File, position: { x: number; y: number }) => void;
  
  // Memory events for UI feedback
  onMemoryEvent?: (event: MemoryUIEvent) => void;
}
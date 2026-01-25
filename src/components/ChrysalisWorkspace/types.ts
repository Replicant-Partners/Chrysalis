/**
 * ChrysalisWorkspace Types
 *
 * Type definitions for the main workspace component.
 *
 * @module components/ChrysalisWorkspace/types
 */

import type React from 'react';
import type { AgentMemoryAdapter } from '../../memory/AgentMemoryAdapter';
import type { AgentCanvasState } from '../../terminal/protocols';

export type ChatPanePosition = 'left' | 'right';

export type MemoryTier = 'episodic' | 'semantic' | 'skill';

export interface YjsArrayLike<T> {
  toArray(): T[];
  push(items: T[]): void;
  observe(cb: () => void): void;
  unobserve(cb: () => void): void;
  delete(index: number, length: number): void;
  length: number;
}

export interface YjsDocLike {
  getArray<T>(name: string): YjsArrayLike<T>;
}

export interface MemoryIndicator {
  memoryId: string;
  type: MemoryTier;
  content: string;
  usedInResponse?: boolean;
}

 export interface PermissionRequest {
   requestId: string;
   agentName: string;
   trust?: string | number;
   summary: string;
   action?: string;
   scopePreview?: string;
   riskLevel?: string;
   status: 'pending' | 'approved' | 'denied';
 }

export interface ChatMessage {
   id: string;
   timestamp: number;
   senderId: string;
   senderName: string;
   senderType: 'user' | 'agent' | 'system';
   content: string;
   metadata?: Record<string, unknown>;
   memoryIndicators?: MemoryIndicator[];
   permissionRequest?: PermissionRequest;
}

export interface ChatParticipant {
   id: string;
   type: 'user' | 'agent' | 'system';
   name: string;
   joinedAt: number;
   avatarUrl?: string;
   color?: string;
}

export type TrustLevel = 'external' | 'internal' | 'ada';

export interface AgentBinding {
   agentId: string;
   agentName: string;
   agentType: string;
   agentRole?: string;
   trustLevel?: TrustLevel;
   avatarUrl?: string;
   color?: string;
   metadata?: Record<string, unknown>;
}

export interface PanelSizes {
   leftWidth: number;
   centerWidth: number;
   rightWidth: number;
}

export interface WorkspaceSession {
   id: string;
   createdAt: number;
   primaryAgentId: string;
   secondaryAgentId?: string;
   userId: string;
   userName: string;
   canvasState?: AgentCanvasState;
}

export interface WorkspaceConfig {
   memoryApiUrl: string;
   systemAgentsUrl: string;
   enableMemory: boolean;
   enableLearning: boolean;
   enableYjs: boolean;
   enableDocumentDrop: boolean;
   showMemoryIndicators: boolean;
   maxMessagesPerPane: number;

   defaultPanelSizes: PanelSizes;
   canvasSnapToGrid: boolean;
   canvasShowGrid: boolean;
   canvasGridSize: number;

   gateway?: {
     baseUrl?: string;
     authToken?: string;
     model?: string;
     stream?: boolean;
   };
}

export const DEFAULT_WORKSPACE_CONFIG: WorkspaceConfig = {
   memoryApiUrl: 'http://localhost:8082',
   systemAgentsUrl: 'http://localhost:3200',
   enableMemory: true,
   enableLearning: false,
   enableYjs: false,
   enableDocumentDrop: true,
   showMemoryIndicators: true,
   maxMessagesPerPane: 500,
   defaultPanelSizes: {
     leftWidth: 25,
     centerWidth: 50,
     rightWidth: 25,
   },
   canvasSnapToGrid: true,
   canvasShowGrid: true,
   canvasGridSize: 20,
   gateway: {
     baseUrl: 'http://localhost:8080',
   },
};

export interface ChrysalisWorkspaceProps {
   sessionId?: string;
   userId: string;
   userName: string;
   primaryAgent: AgentBinding;
   secondaryAgent?: AgentBinding;
   yjsDoc?: YjsDocLike;
   memoryAdapter?: AgentMemoryAdapter;
   config?: Partial<WorkspaceConfig>;
   /** Optional custom content for the center pane (e.g., embedded CanvasApp) */
   centerContent?: React.ReactNode;

   onSessionStart?: (session: WorkspaceSession) => void;
   onSessionEnd?: (session: WorkspaceSession) => void;
   onMessageSent?: (message: ChatMessage, position: ChatPanePosition) => void;
   onAgentResponse?: (message: ChatMessage, position: ChatPanePosition) => void;
   onDocumentDrop?: (file: File, position: { x: number; y: number }) => void;
   onMemoryEvent?: (event: Record<string, unknown>) => void;
}

 export interface ChatPaneProps {
   paneId: ChatPanePosition;
   agent: AgentBinding;
   messages: ChatMessage[];
   participants: ChatParticipant[];
   isLoading?: boolean;
   isAgentTyping?: boolean;
   showMemoryIndicators?: boolean;
   maxMessages?: number;
   showInviteButton?: boolean;
   showDndButton?: boolean;
   dndState?: 'off' | 'on';
   onSendMessage: (content: string) => void;
   onClearChat?: () => void;
   onInviteClick?: () => void;
   onToggleDnd?: (state: 'off' | 'on') => void;
   onPermissionApprove?: (requestId: string) => void;
   onPermissionDeny?: (requestId: string) => void;
   onPermissionExplain?: (requestId: string) => void;
 }

export default {
  DEFAULT_WORKSPACE_CONFIG,
};

/**
 * ChrysalisWorkspace Module
 * 
 * Three-frame dual-chat canvas architecture for agent interaction.
 * 
 * @module components/ChrysalisWorkspace
 */

// Main component
export { ChrysalisWorkspace, default } from './ChrysalisWorkspace';

// Chat component
export { ChatPane } from './ChatPane';

// Types
export type {
  // Chat types
  ChatSenderType,
  ChatMessage,
  ChatParticipant,
  ChatPanePosition,
  MemoryIndicator,
  AgentBinding,
  
  // Workspace types
  WorkspaceSession,
  WorkspaceViewport,
  PanelSizes,
  WorkspaceConfig,
  
  // YJS types
  WorkspaceYJSState,
  WorkspaceYJSDoc,
  
  // Props types
  ChatPaneProps,
  ChrysalisWorkspaceProps,
  
  // Memory event types
  MemoryUIEvent,
} from './types';

// Constants
export { DEFAULT_WORKSPACE_CONFIG } from './types';
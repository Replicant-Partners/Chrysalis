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
  ChatMessage,
  ChatParticipant,
  ChatPanePosition,
  ChatSenderType,
  DndState,
  MemoryIndicator,
  MemoryUIEvent,
  PermissionRequest,
  PanelSizes,
  WorkspaceAgent,
  WorkspaceConfig,
  WorkspaceSession,
  ChatPaneProps,
  ChrysalisWorkspaceProps,
} from './types';

// Constants
export { DEFAULT_WORKSPACE_CONFIG } from './types';
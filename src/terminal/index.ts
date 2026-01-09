/**
 * Terminal Module
 * 
 * ChrysalisTerminal - Three-frame interface for human/agent collaboration:
 * - Left ChatPane: Agent conversation
 * - Center JSONCanvas: Interactive widget container
 * - Right ChatPane: User/human conversation
 * 
 * Uses YJS CRDT for real-time synchronization.
 * 
 * @module terminal
 */

// Core terminal
export { ChrysalisTerminal } from './ChrysalisTerminal';

// Agent client
export {
  AgentTerminalClient,
  createAgentTerminalClient,
  type AgentTerminalConfig,
  type AgentMessageHandler
} from './AgentTerminalClient';

// Protocols
export {
  // Types
  DEFAULT_TERMINAL_CONFIG,
  
  // Widgets
  MarkdownWidget,
  CodeWidget,
  ChartWidget,
  TableWidget,
  ImageWidget,
  ButtonWidget,
  InputWidget,
  MemoryViewerWidget,
  SkillExecutorWidget,
  ConversationWidget,
  BUILTIN_WIDGETS,
  WidgetRegistry,
  defaultWidgetRegistry
} from './protocols';

// Re-export protocol types
export type {
  // Identifiers
  TerminalId,
  ParticipantId,
  ParticipantType,
  FramePosition,
  
  // Session
  TerminalSession,
  Participant,
  CursorPosition,
  
  // Chat
  ChatPaneState,
  ChatMessage,
  MessageAttachment,
  MessageReaction,
  
  // Canvas
  CanvasState,
  CanvasViewport,
  CanvasNode,
  CanvasEdge,
  TextNode,
  FileNode,
  LinkNode,
  GroupNode,
  WidgetNode,
  
  // Widgets
  WidgetDefinition,
  WidgetCategory,
  WidgetCapability,
  
  // Sync
  SyncMessage,
  StateDelta,
  AwarenessState,
  
  // Events
  TerminalEventType,
  TerminalEvent,
  TerminalEventHandler,
  
  // Config
  TerminalConfig
} from './protocols';
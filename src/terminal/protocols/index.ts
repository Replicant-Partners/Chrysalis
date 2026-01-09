/**
 * Terminal Protocols Index
 * 
 * Protocol definitions for ChrysalisTerminal.
 * 
 * @module terminal/protocols
 */

// Core types
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
  
  // Chat Pane
  ChatPaneState,
  ChatMessage,
  MessageAttachment,
  MessageReaction,
  
  // Canvas
  CanvasState,
  CanvasViewport,
  BaseCanvasNode,
  TextNode,
  FileNode,
  LinkNode,
  GroupNode,
  WidgetNode,
  CanvasNode,
  CanvasEdge,
  
  // Widgets
  WidgetDefinition,
  WidgetCategory,
  WidgetCapability,
  WidgetEventDefinition,
  WidgetActionDefinition,
  JSONSchema,
  
  // Widget props
  MarkdownWidgetProps,
  CodeWidgetProps,
  ChartWidgetProps,
  TableWidgetProps,
  ImageWidgetProps,
  ButtonWidgetProps,
  InputWidgetProps,
  MemoryViewerWidgetProps,
  SkillExecutorWidgetProps,
  
  // Sync
  SyncMessageType,
  SyncMessage,
  StateDelta,
  AwarenessState,
  
  // Events
  TerminalEventType,
  TerminalEvent,
  TerminalEventHandler,
  
  // Configuration
  TerminalConfig
} from './types';

export { DEFAULT_TERMINAL_CONFIG } from './types';

// Widgets
export {
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
} from './widgets';
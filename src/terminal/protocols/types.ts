/**
 * ChrysalisTerminal Protocol Types
 * 
 * Protocol definitions for the three-frame terminal interface:
 * - Left ChatPane: Agent conversation
 * - Center JSONCanvas: Interactive widget container
 * - Right ChatPane: User/human conversation
 * 
 * This is a PROTOCOL layer - both humans and agents use the same
 * data structures synced via YJS CRDT.
 * 
 * @module terminal/protocols/types
 */

// ============================================================================
// Core Identifiers
// ============================================================================

/**
 * Unique identifier for terminal sessions
 */
export type TerminalId = string;

/**
 * Unique identifier for participants (human or agent)
 */
export type ParticipantId = string;

/**
 * Participant type
 */
export type ParticipantType = 'human' | 'agent' | 'system';

/**
 * Frame position in the terminal
 */
export type FramePosition = 'left' | 'center' | 'right';

// ============================================================================
// Terminal Session
// ============================================================================

/**
 * Terminal session state
 */
export interface TerminalSession {
  id: TerminalId;
  name: string;
  createdAt: number;
  lastActivity: number;
  participants: Participant[];
  frames: {
    left: ChatPaneState;
    center: CanvasState;
    right: ChatPaneState;
  };
  metadata: Record<string, unknown>;
}

/**
 * Participant in a terminal session
 */
export interface Participant {
  id: ParticipantId;
  type: ParticipantType;
  name: string;
  role: 'owner' | 'collaborator' | 'viewer';
  joinedAt: number;
  lastSeen: number;
  cursor?: CursorPosition;
  metadata: Record<string, unknown>;
}

/**
 * Cursor position for awareness
 */
export interface CursorPosition {
  framePosition: FramePosition;
  x?: number;
  y?: number;
  nodeId?: string;
  messageId?: string;
}

// ============================================================================
// Chat Pane Protocol
// ============================================================================

/**
 * Chat pane state
 */
export interface ChatPaneState {
  id: string;
  position: 'left' | 'right';
  title: string;
  messages: ChatMessage[];
  participants: ParticipantId[];
  isTyping: ParticipantId[];
  scrollPosition: number;
  metadata: Record<string, unknown>;
}

/**
 * Chat message
 */
export interface ChatMessage {
  id: string;
  senderId: ParticipantId;
  senderType: ParticipantType;
  senderName: string;
  content: string;
  timestamp: number;
  editedAt?: number;
  replyToId?: string;
  attachments?: MessageAttachment[];
  reactions?: MessageReaction[];
  metadata: Record<string, unknown>;
}

/**
 * Message attachment
 */
export interface MessageAttachment {
  id: string;
  type: 'image' | 'file' | 'code' | 'canvas-reference' | 'memory-reference';
  name: string;
  mimeType?: string;
  url?: string;
  content?: string;
  referenceId?: string;  // For canvas/memory references
}

/**
 * Message reaction
 */
export interface MessageReaction {
  emoji: string;
  participants: ParticipantId[];
}

// ============================================================================
// JSON Canvas Protocol
// ============================================================================

/**
 * Canvas state following JSON Canvas spec
 * https://jsoncanvas.org/
 */
export interface CanvasState {
  id: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  viewport: CanvasViewport;
  selectedNodes: string[];
  selectedEdges: string[];
  metadata: Record<string, unknown>;
}

/**
 * Canvas viewport
 */
export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Base canvas node (JSON Canvas spec)
 */
export interface BaseCanvasNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

/**
 * Text node
 */
export interface TextNode extends BaseCanvasNode {
  type: 'text';
  text: string;
}

/**
 * File node
 */
export interface FileNode extends BaseCanvasNode {
  type: 'file';
  file: string;
  subpath?: string;
}

/**
 * Link node
 */
export interface LinkNode extends BaseCanvasNode {
  type: 'link';
  url: string;
}

/**
 * Group node
 */
export interface GroupNode extends BaseCanvasNode {
  type: 'group';
  label?: string;
  background?: string;
  backgroundStyle?: 'cover' | 'ratio' | 'repeat';
}

/**
 * Widget node - custom widgets that agents can build to
 */
export interface WidgetNode extends BaseCanvasNode {
  type: 'widget';
  widgetType: string;
  widgetVersion: string;
  props: Record<string, unknown>;
  state: Record<string, unknown>;
  createdBy: ParticipantId;
}

/**
 * Union type for all canvas nodes
 */
export type CanvasNode = TextNode | FileNode | LinkNode | GroupNode | WidgetNode;

/**
 * Canvas edge (JSON Canvas spec)
 */
export interface CanvasEdge {
  id: string;
  fromNode: string;
  fromSide?: 'top' | 'right' | 'bottom' | 'left';
  fromEnd?: 'none' | 'arrow';
  toNode: string;
  toSide?: 'top' | 'right' | 'bottom' | 'left';
  toEnd?: 'none' | 'arrow';
  color?: string;
  label?: string;
}

// ============================================================================
// JSON Widget Protocol
// ============================================================================

/**
 * Widget definition - protocol that agents build to
 */
export interface WidgetDefinition {
  type: string;
  version: string;
  name: string;
  description: string;
  icon?: string;
  category: WidgetCategory;
  
  // Schema definitions
  propsSchema: JSONSchema;
  stateSchema: JSONSchema;
  
  // Dimensions
  defaultWidth: number;
  defaultHeight: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  
  // Capabilities
  capabilities: WidgetCapability[];
  
  // Events the widget can emit
  events: WidgetEventDefinition[];
  
  // Actions the widget can receive
  actions: WidgetActionDefinition[];
}

/**
 * Widget categories
 */
export type WidgetCategory = 
  | 'visualization'
  | 'input'
  | 'output'
  | 'control'
  | 'data'
  | 'communication'
  | 'utility'
  | 'custom';

/**
 * Widget capabilities
 */
export type WidgetCapability =
  | 'interactive'      // User can interact
  | 'realtime'         // Updates in real-time
  | 'persistent'       // State persists
  | 'exportable'       // Can export data
  | 'configurable'     // Has settings
  | 'resizable'        // Can be resized
  | 'connectable'      // Can connect to other widgets
  | 'memory-aware'     // Can access agent memory
  | 'llm-powered';     // Uses LLM for processing

/**
 * Widget event definition
 */
export interface WidgetEventDefinition {
  name: string;
  description: string;
  payloadSchema: JSONSchema;
}

/**
 * Widget action definition
 */
export interface WidgetActionDefinition {
  name: string;
  description: string;
  paramsSchema: JSONSchema;
  returnsSchema?: JSONSchema;
}

/**
 * JSON Schema type (simplified)
 */
export interface JSONSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  enum?: unknown[];
  default?: unknown;
  description?: string;
}

// ============================================================================
// Built-in Widget Types
// ============================================================================

/**
 * Markdown widget props
 */
export interface MarkdownWidgetProps {
  content: string;
  theme?: 'light' | 'dark';
}

/**
 * Code widget props
 */
export interface CodeWidgetProps {
  code: string;
  language: string;
  filename?: string;
  showLineNumbers?: boolean;
  editable?: boolean;
}

/**
 * Chart widget props
 */
export interface ChartWidgetProps {
  type: 'line' | 'bar' | 'pie' | 'scatter';
  data: {
    labels?: string[];
    datasets: Array<{
      label: string;
      data: number[];
      color?: string;
    }>;
  };
  options?: Record<string, unknown>;
}

/**
 * Table widget props
 */
export interface TableWidgetProps {
  columns: Array<{
    key: string;
    label: string;
    type?: 'string' | 'number' | 'boolean' | 'date';
    sortable?: boolean;
  }>;
  data: Record<string, unknown>[];
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

/**
 * Image widget props
 */
export interface ImageWidgetProps {
  src: string;
  alt?: string;
  fit?: 'contain' | 'cover' | 'fill';
}

/**
 * Button widget props
 */
export interface ButtonWidgetProps {
  label: string;
  action: string;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

/**
 * Input widget props
 */
export interface InputWidgetProps {
  type: 'text' | 'number' | 'textarea' | 'select' | 'checkbox';
  label: string;
  placeholder?: string;
  value?: unknown;
  options?: Array<{ label: string; value: unknown }>;
}

/**
 * Memory viewer widget props
 */
export interface MemoryViewerWidgetProps {
  agentId: string;
  memoryTier?: 'working' | 'episodic' | 'semantic' | 'procedural' | 'all';
  limit?: number;
  searchQuery?: string;
}

/**
 * Skill executor widget props
 */
export interface SkillExecutorWidgetProps {
  agentId: string;
  skillName: string;
  parameters?: Record<string, unknown>;
  autoExecute?: boolean;
}

// ============================================================================
// Sync Protocol
// ============================================================================

/**
 * Sync message types
 */
export type SyncMessageType =
  | 'sync:state'        // Full state sync
  | 'sync:delta'        // Incremental update
  | 'sync:awareness'    // Cursor/presence updates
  | 'sync:ack'          // Acknowledgment
  | 'sync:error';       // Error

/**
 * Sync message envelope
 */
export interface SyncMessage {
  type: SyncMessageType;
  sessionId: TerminalId;
  senderId: ParticipantId;
  timestamp: number;
  payload: unknown;
  vector?: number[];     // For CRDT ordering
}

/**
 * State delta for incremental sync
 */
export interface StateDelta {
  frame: FramePosition;
  path: string[];        // JSON path to modified element
  operation: 'set' | 'delete' | 'insert' | 'update';
  value?: unknown;
  index?: number;        // For array operations
  oldValue?: unknown;    // For conflict detection
}

/**
 * Awareness state for participant presence
 */
export interface AwarenessState {
  participantId: ParticipantId;
  cursor?: CursorPosition;
  selection?: {
    frame: FramePosition;
    selectedIds: string[];
  };
  status: 'active' | 'idle' | 'away';
  lastActivity: number;
}

// ============================================================================
// Terminal Events
// ============================================================================

/**
 * Terminal event types
 */
export type TerminalEventType =
  // Session events
  | 'session:created'
  | 'session:joined'
  | 'session:left'
  | 'session:closed'
  // Chat events
  | 'chat:message'
  | 'chat:typing'
  | 'chat:reaction'
  | 'chat:edit'
  | 'chat:delete'
  // Canvas events
  | 'canvas:node:added'
  | 'canvas:node:updated'
  | 'canvas:node:deleted'
  | 'canvas:node:moved'
  | 'canvas:edge:added'
  | 'canvas:edge:deleted'
  | 'canvas:viewport:changed'
  | 'canvas:selection:changed'
  // Widget events
  | 'widget:created'
  | 'widget:action'
  | 'widget:event'
  | 'widget:destroyed'
  // Sync events
  | 'sync:connected'
  | 'sync:disconnected'
  | 'sync:conflict'
  | 'sync:resolved';

/**
 * Terminal event
 */
export interface TerminalEvent {
  type: TerminalEventType;
  sessionId: TerminalId;
  participantId: ParticipantId;
  timestamp: number;
  payload: unknown;
}

/**
 * Event handler type
 */
export type TerminalEventHandler = (event: TerminalEvent) => void | Promise<void>;

// ============================================================================
// Configuration
// ============================================================================

/**
 * Terminal configuration
 */
export interface TerminalConfig {
  // Session
  sessionId?: TerminalId;
  sessionName?: string;
  
  // Participant
  participantId: ParticipantId;
  participantType: ParticipantType;
  participantName: string;
  
  // Sync
  syncServerUrl?: string;
  syncEnabled: boolean;
  
  // Frames
  leftPane: {
    enabled: boolean;
    title: string;
    allowedParticipants: ParticipantType[];
  };
  centerCanvas: {
    enabled: boolean;
    allowedWidgets: string[];  // Empty = all
  };
  rightPane: {
    enabled: boolean;
    title: string;
    allowedParticipants: ParticipantType[];
  };
  
  // Widgets
  widgetRegistry: Map<string, WidgetDefinition>;
  
  // Persistence
  persistPath?: string;
  autosave: boolean;
  autosaveInterval: number;
}

/**
 * Default terminal configuration
 */
export const DEFAULT_TERMINAL_CONFIG: Omit<TerminalConfig, 'participantId' | 'participantType' | 'participantName' | 'widgetRegistry'> = {
  syncEnabled: true,
  leftPane: {
    enabled: true,
    title: 'Agent',
    allowedParticipants: ['agent', 'system']
  },
  centerCanvas: {
    enabled: true,
    allowedWidgets: []
  },
  rightPane: {
    enabled: true,
    title: 'Human',
    allowedParticipants: ['human', 'system']
  },
  autosave: true,
  autosaveInterval: 5000
};
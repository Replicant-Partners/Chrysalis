/**
 * Canvas System Core Type Definitions
 * 
 * Defines the foundational types, interfaces, and contracts for the Chrysalis Terminal
 * multi-canvas workspace system supporting human-agent collaborative knowledge work.
 * 
 * @see docs/CANVAS_FOUNDATION_IMPLEMENTATION.md
 * @see plans/CHRYSALIS_TERMINAL_IMPLEMENTATION_ROADMAP.md
 */

import { ReactElement, ComponentType } from 'react';
// TODO: Install reactflow package before uncommenting
// import { Node, Edge, Viewport } from 'reactflow';

// Temporary type stubs until reactflow is installed
type Node = any;
type Edge = any;
type Viewport = any;
type NodeChange = any;
type EdgeChange = any;
type Connection = any;
type OnNodesChange = any;
type OnEdgesChange = any;
type OnConnect = any;

/**
 * Canvas Kind Type
 * 
 * The 6 canonical canvas types in Chrysalis Terminal:
 * - settings: System configuration management
 * - agent: AI agent team orchestration
 * - scrapbook: Exploratory knowledge gathering
 * - research: Structured knowledge acquisition
 * - wiki: Persistent knowledge base
 * - terminal-browser: Collaborative development workspace
 */
export type CanvasKind =
  | 'settings'
  | 'agent'
  | 'scrapbook'
  | 'research'
  | 'wiki'
  | 'terminal-browser';

/**
 * Widget Node Data
 * 
 * Base interface for all widget node data payloads.
 * Individual widgets extend this with widget-specific fields.
 */
export interface WidgetNodeData {
  /**
   * Widget type identifier (must match WidgetDefinition.type)
   */
  type: string;

  /**
   * Display label for the widget
   */
  label: string;

  /**
   * Optional metadata for annotations and associations
   */
  metadata?: Record<string, unknown>;

  /**
   * Widget-specific configuration
   */
  config?: Record<string, unknown>;
}

/**
 * Widget Props
 * 
 * Standard props passed to all widget renderers
 */
export interface WidgetProps<TData extends WidgetNodeData = WidgetNodeData> {
  /**
   * Widget node data
   */
  data: TData;

  /**
   * Unique node identifier
   */
  id: string;

  /**
   * Whether the widget is currently selected
   */
  selected?: boolean;

  /**
   * Callback for data updates
   */
  onDataChange?: (newData: Partial<TData>) => void;

  /**
   * Callback for widget events
   */
  onEvent?: (event: WidgetEvent) => void;
}

/**
 * Widget Definition
 * 
 * Defines a widget type that can be registered with a WidgetRegistry.
 * Widgets are the atomic units of functionality within canvases.
 */
export interface WidgetDefinition<TData extends WidgetNodeData = WidgetNodeData> {
  /**
   * Unique widget type identifier
   */
  type: string;

  /**
   * Human-readable display name
   */
  displayName: string;

  /**
   * React component that renders the widget
   */
  renderer: ComponentType<WidgetProps<TData>>;

  /**
   * Required capabilities for this widget type
   * @example ['terminal:execute', 'file:read', 'network:request']
   */
  capabilities: string[];

  /**
   * JSON Schema for widget data validation (optional)
   */
  schema?: unknown; // JSONSchema type

  /**
   * Default data for new widget instances
   */
  defaultData?: Partial<TData>;

  /**
   * Category for widget organization in UI
   */
  category?: string;

  /**
   * Icon for widget visualization
   */
  icon?: string;
}

/**
 * Canvas Policy
 * 
 * Defines enforcement rules and limits for a canvas instance.
 * Policies control resource usage, allowed operations, and security constraints.
 */
export interface CanvasPolicy {
  /**
   * Maximum number  of nodes allowed on canvas
   */
  maxNodes: number;

  /**
   * Maximum number of edges allowed on canvas
   */
  maxEdges: number;

  /**
   * Rate limiting configuration
   */
  rateLimit: {
    /**
     * Maximum actions per window
     */
    actions: number;

    /**
     * Time window in milliseconds
     */
    windowMs: number;
  };

  /**
   * Allowlist of widget types permitted on this canvas
   */
  allowedWidgetTypes: string[];

  /**
   * Required capabilities for canvas operations
   */
  requiredCapabilities?: string[];

  /**
   * Maximum file size for uploads (bytes)
   */
  maxUploadSize?: number;

  /**
   * Whether background execution is permitted
   */
  allowBackgroundExecution?: boolean;
}

/**
 * Canvas Theme
 * 
 * Visual styling configuration for canvas rendering
 */
export interface CanvasTheme {
  /**
   * Background color or pattern
   */
  background: string;

  /**
   * Grid styling (if enabled)
   */
  grid?: {
    color: string;
    size: number;
  };

  /**
   * Node styling defaults
   */
  node?: {
    background: string;
    border: string;
    color: string;
    borderRadius: string;
  };

  /**
   * Edge styling defaults
   */
  edge?: {
    stroke: string;
    strokeWidth: number;
  };

  /**
   * Selection styling
   */
  selection?: {
    border: string;
    background: string;
  };
}

/**
 * Bounds for tile-based loading
 */
export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Tile Data
 * 
 * Represents a spatial tile of canvas data for virtualization
 */
export interface Tile<TNode, TEdge> {
  bounds: Bounds;
  nodes: TNode[];
  edges: TEdge[];
  timestamp: number;
}

/**
 * Change Set for persistence operations
 */
export interface ChangeSet<TNode, TEdge> {
  nodesAdded: TNode[];
  nodesUpdated: TNode[];
  nodesDeleted: string[]; // IDs
  edgesAdded: TEdge[];
  edgesDeleted: string[]; // IDs
}

/**
 * Data Event for subscription notifications
 */
export interface DataEvent {
  type: 'nodesChanged' | 'edgesChanged' | 'canvasLoaded' | 'canvasSaved';
  canvasId: string;
  timestamp: number;
  payload?: unknown;
}

/**
 * Unsubscribe Function
 */
export type Unsubscribe = () => void;

/**
 * Canvas Data Source
 * 
 * Abstraction for loading and persisting canvas data.
 * Supports tile-based virtualization and real-time subscriptions.
 */
export interface CanvasDataSource<TNode extends Node, TEdge extends Edge> {
  /**
   * Load a spatial tile of canvas data
   */
  loadTile(bounds: Bounds): Promise<Tile<TNode, TEdge>>;

  /**
   * Persist changes to the canvas
   */
  persist(changes: ChangeSet<TNode, TEdge>): Promise<void>;

  /**
   * Subscribe to data change events
   */
  subscribe(callback: (event: DataEvent) => void): Unsubscribe;

  /**
   * Load complete canvas (for small canvases or initial load)
   */
  loadAll(): Promise<{ nodes: TNode[]; edges: TEdge[] }>;
}

/**
 * Canvas Events
 */
export type CanvasEventType =
  | 'canvas:loaded'
  | 'canvas:saved'
  | 'canvas:error'
  | 'node:created'
  | 'node:updated'
  | 'node:deleted'
  | 'edge:created'
  | 'edge:deleted'
  | 'viewport:changed'
  | 'selection:changed'
  | 'policy:violated'
  | 'rate:limit:exceeded';

export interface CanvasEvent {
  type: CanvasEventType;
  canvasId: string;
  timestamp: number;
  payload?: unknown;
}

/**
 * Widget Events
 */
export type WidgetEventType =
  | 'widget:mounted'
  | 'widget:unmounted'
  | 'widget:activated'
  | 'widget:deactivated'
  | 'widget:error';

export interface WidgetEvent {
  type: WidgetEventType;
  widgetId: string;
  widgetType: string;
  timestamp: number;
  payload?: unknown;
}

/**
 * Accessibility Configuration
 */
export interface AccessibilityConfig {
  /**
   * Enable keyboard navigation
   */
  enableKeyboardNav: boolean;

  /**
   * ARIA label for the canvas
   */
  ariaLabel?: string;

  /**
   * Announce changes to screen readers
   */
  liveRegion?: boolean;

  /**
   * Respect prefers-reduced-motion
   */
  reducedMotion?: boolean;

  /**
   * Minimum contrast ratio (WCAG requirement)
   */
  minContrastRatio?: number;
}

/**
 * Canvas Lifecycle State
 */
export type CanvasLifecycleState =
  | 'initializing'
  | 'ready'
  | 'active'
  | 'background'
  | 'suspended'
  | 'hibernated'
  | 'error';

/**
 * Widget Lifecycle State
 */
export type WidgetLifecycleState =
  | 'created'
  | 'mounted'
  | 'active'
  | 'editing'
  | 'detached'
  | 'destroyed';

/**
 * Validation Result
 * 
 * Standard result type for validation operations
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * Create Widget Request
 * 
 * Request payload for creating a new widget instance
 */
export interface CreateWidgetRequest<TData extends WidgetNodeData = WidgetNodeData> {
  type: string;
  data: TData;
  position: { x: number; y: number };
  canvasId: string;
}

/**
 * Update Widget Request
 * 
 * Request payload for updating an existing widget
 */
export interface UpdateWidgetRequest<TData extends WidgetNodeData = WidgetNodeData> {
  widgetId: string;
  changes: Partial<TData>;
  canvasId: string;
}

/**
 * Canvas Configuration
 * 
 * Complete configuration for a canvas instance
 */
export interface CanvasConfig {
  kind: CanvasKind;
  id: string;
  policy: CanvasPolicy;
  theme?: CanvasTheme;
  accessibility?: AccessibilityConfig;
  initialViewport?: Viewport;
}

/**
 * Canvas Node
 * 
 * ReactFlow Node extended with WidgetNodeData
 */
export interface CanvasNode<TData extends WidgetNodeData = WidgetNodeData> extends Node {
  data: TData;
  type: string; // matches WidgetDefinition.type
}

/**
 * Canvas Edge
 * 
 * ReactFlow Edge with optional metadata
 */
export interface CanvasEdge extends Edge {
  data?: {
    label?: string;
    metadata?: Record<string, unknown>;
  };
}

/**
 * Canvas Data
 * 
 * Complete persisted state of a canvas
 */
export interface CanvasData<
  TNode extends CanvasNode = CanvasNode,
  TEdge extends CanvasEdge = CanvasEdge
> {
  canvasId: string;
  kind: CanvasKind;
  nodes: TNode[];
  edges: TEdge[];
  viewport: Viewport;
  metadata?: Record<string, unknown>;
  version: number;
  lastModified: number;
}

/**
 * Collaboration Types
 */

export type PermissionLevel = 'view' | 'edit' | 'admin';

export interface SessionToken {
  canvasId: string;
  token: string;
  permissions: PermissionLevel;
  expiresAt: number;
}

export interface CollaboratorPresence {
  userId: string;
  username: string;
  cursor?: { x: number; y: number };
  selection?: string[]; // Selected node IDs
  color: string; // For cursor/selection visualization
  lastActivity: number;
}

/**
 * Operation for CRDT/OT synchronization
 */
export type Operation =
  | { type: 'node:create'; node: CanvasNode }
  | { type: 'node:update'; nodeId: string; changes: Partial<WidgetNodeData> }
  | { type: 'node:delete'; nodeId: string }
  | { type: 'node:move'; nodeId: string; position: { x: number; y: number } }
  | { type: 'edge:create'; edge: CanvasEdge }
  | { type: 'edge:delete'; edgeId: string }
  | { type: 'viewport:update'; viewport: Partial<Viewport> };

export interface OperationMessage {
  operation: Operation;
  canvasId: string;
  authorId: string;
  timestamp: number;
  vectorClock?: Record<string, number>; // For CRDT
}

/**
 * Re-export ReactFlow types for convenience (once reactflow is installed)
 */
// export type { Node, Edge, Viewport } from 'reactflow';
// export type {
//   NodeChange,
//   EdgeChange,
//   Connection,
//   OnNodesChange,
//   OnEdgesChange,
//   OnConnect,
// } from 'reactflow';

/**
 * Utility type for extracting widget data type from canvas type
 */
export type WidgetDataForCanvas<K extends CanvasKind> =
  K extends 'settings' ? SettingsWidgetData :
  K extends 'agent' ? AgentWidgetData :
  K extends 'scrapbook' ? ScrapbookWidgetData :
  K extends 'research' ? ResearchWidgetData :
  K extends 'wiki' ? WikiWidgetData :
  K extends 'terminal-browser' ? TerminalBrowserWidgetData :
  WidgetNodeData;

/**
 * Canvas-specific widget data types (to be extended by implementations)
 */
export interface SettingsWidgetData extends WidgetNodeData {
  type: 'config' | 'connection' | 'credential';
}

export interface AgentWidgetData extends WidgetNodeData {
  type: 'agent_card' | 'team_group';
}

export interface ScrapbookWidgetData extends WidgetNodeData {
  type: 'artifact' | 'note' | 'link' | 'group';
}

export interface ResearchWidgetData extends WidgetNodeData {
  type: 'source' | 'citation' | 'synthesis' | 'hypothesis';
}

export interface WikiWidgetData extends WidgetNodeData {
  type: 'wiki_page' | 'wiki_section' | 'wiki_link';
}

export interface TerminalBrowserWidgetData extends WidgetNodeData {
  type: 'terminal_session' | 'browser_tab' | 'code_editor';
}

/**
 * Export all types for definition external use
 * Note: Interfaces are already exported via 'export interface' declarations above
 * Only need to export the ReactFlow re-exports here
 */
export type {
  Node,
  Edge,
  Viewport,
  NodeChange,
  EdgeChange,
  Connection,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
};

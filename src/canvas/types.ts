/**
 * Canvas Type Definitions
 * 
 * Core types for the canvas widget system.
 */

import type { Node, Edge } from 'reactflow';

// ============================================================================
// Canvas Kinds
// ============================================================================

export type CanvasKind = 
  | 'agent'
  | 'research'
  | 'scrapbook'
  | 'settings'
  | 'terminal'
  | 'terminal-browser'
  | 'wiki'
  | 'custom';

// ============================================================================
// Widget Types
// ============================================================================

/**
 * Base interface for widget node data.
 * Widget-specific data types should extend this interface.
 */
export interface WidgetNodeData {
  /** Widget type identifier (optional - can be inferred from node.type) */
  type?: string;
  /** Display label */
  label?: string;
}

/**
 * Generic widget data that allows any properties
 */
export type AnyWidgetData = WidgetNodeData & Record<string, unknown>;

export interface WidgetProps<T extends WidgetNodeData = WidgetNodeData> {
  /** Node ID */
  id: string;
  /** Widget data */
  data: T;
  /** Whether the node is selected */
  selected?: boolean;
  /** Whether the node is dragging */
  dragging?: boolean;
  /** Callback when widget data changes */
  onDataChange?: (newData: Partial<T>) => void;
}

export type WidgetCapability = 
  | 'read' 
  | 'write' 
  | 'edit'
  | 'control' 
  | 'manage' 
  | 'delete'
  | 'execute'
  | 'navigate'
  | 'test';

export interface WidgetDefinition<T extends WidgetNodeData = WidgetNodeData> {
  /** Unique widget type identifier */
  type: string;
  /** Human-readable name */
  displayName: string;
  /** React component to render the widget */
  renderer: React.ComponentType<WidgetProps<T>>;
  /** Capabilities this widget supports */
  capabilities: WidgetCapability[];
  /** Default data for new instances */
  defaultData: Omit<T, 'type'>;
  /** Category for organization */
  category?: string;
  /** Icon (emoji or icon name) */
  icon?: string;
  /** Minimum dimensions */
  minSize?: { width: number; height: number };
  /** Maximum dimensions */
  maxSize?: { width: number; height: number };
}

// ============================================================================
// Canvas Policy
// ============================================================================

export interface RateLimitConfig {
  /** Maximum actions allowed */
  actions: number;
  /** Time window in milliseconds */
  windowMs: number;
}

export interface CanvasPolicy {
  /** Maximum number of nodes allowed */
  maxNodes: number;
  /** Maximum number of edges allowed */
  maxEdges: number;
  /** Rate limiting configuration */
  rateLimit: RateLimitConfig;
  /** Allowed widget types (empty = all allowed) */
  allowedWidgetTypes: string[];
  /** Whether to allow edge creation */
  allowEdges?: boolean;
  /** Whether to allow node deletion */
  allowDelete?: boolean;
}

// ============================================================================
// Canvas Theme
// ============================================================================

export interface CanvasTheme {
  /** Background color */
  background: string;
  /** Grid color */
  gridColor: string;
  /** Grid configuration */
  grid?: {
    color: string;
    size: number;
  };
  /** Node border color */
  nodeBorder: string;
  /** Selected node border color */
  selectedBorder: string;
  /** Edge color */
  edgeColor: string;
  /** Edge configuration */
  edge?: {
    color: string;
    selectedColor: string;
  };
  /** Text color */
  textColor: string;
  /** Font family */
  fontFamily: string;
}

// ============================================================================
// Accessibility
// ============================================================================

export interface AccessibilityConfig {
  /** Enable keyboard navigation */
  enableKeyboardNav: boolean;
  /** Enable ARIA live region for announcements */
  liveRegion: boolean;
  /** Respect prefers-reduced-motion */
  reducedMotion: boolean;
  /** Minimum contrast ratio for text */
  minContrastRatio: number;
  /** ARIA label for the canvas */
  ariaLabel?: string;
}

// ============================================================================
// Canvas Events
// ============================================================================

export type CanvasEventType =
  | 'node:add'
  | 'node:remove'
  | 'node:move'
  | 'node:select'
  | 'node:update'
  | 'node:updated'
  | 'edge:add'
  | 'edge:remove'
  | 'edge:created'
  | 'viewport:change'
  | 'lifecycle:change'
  | 'selection:changed'
  | 'canvas:loaded'
  | 'canvas:error'
  | 'rate:limit:exceeded'
  | 'policy:violated'
  | 'error';

export interface CanvasEvent {
  /** Event type */
  type: CanvasEventType;
  /** Canvas ID */
  canvasId: string;
  /** Event timestamp */
  timestamp: number;
  /** Event payload */
  payload?: unknown;
}

// ============================================================================
// Canvas Lifecycle
// ============================================================================

export type CanvasLifecycleState =
  | 'initializing'
  | 'ready'
  | 'active'
  | 'loading'
  | 'saving'
  | 'error'
  | 'disposed';

// ============================================================================
// Data Source
// ============================================================================

export interface DataSourceEvent<N, E> {
  type: 'sync' | 'update' | 'error' | 'nodesChanged' | 'edgesChanged';
  nodes?: N[];
  edges?: E[];
  error?: Error;
}

export interface CanvasChangeSet<N = Node<WidgetNodeData>, E = Edge> {
  nodesAdded: N[];
  nodesUpdated: N[];
  nodesDeleted: string[];
  edgesAdded: E[];
  edgesDeleted: string[];
}

export interface CanvasDataSource<N = Node<WidgetNodeData>, E = Edge> {
  /** Load initial state */
  load(): Promise<{ nodes: N[]; edges: E[] }>;
  /** Load all data (alias for load) */
  loadAll?(): Promise<{ nodes: N[]; edges: E[] }>;
  /** Save current state */
  save(nodes: N[], edges: E[]): Promise<void>;
  /** Persist changes incrementally */
  persist?(changes: CanvasChangeSet<N, E>): Promise<void>;
  /** Subscribe to external changes */
  subscribe(callback: (event: DataSourceEvent<N, E>) => void): () => void;
  /** Dispose resources */
  dispose(): void;
}

// ============================================================================
// Validation
// ============================================================================

export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors */
  errors: ValidationError[];
  /** Validation warnings */
  warnings: ValidationWarning[];
}

export interface ValidationError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Related node/edge ID */
  targetId?: string;
}

export interface ValidationWarning {
  /** Warning code */
  code: string;
  /** Warning message */
  message: string;
  /** Related node/edge ID */
  targetId?: string;
}

// ============================================================================
// Canvas Node (extended ReactFlow Node)
// ============================================================================

export type CanvasNode<T extends WidgetNodeData = WidgetNodeData> = Node<T>;

// ============================================================================
// Canvas Data (for serialization)
// ============================================================================

export interface CanvasData {
  canvasId?: string;
  kind?: CanvasKind;
  nodes: CanvasNode[];
  edges: Edge[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
  version?: number;
  lastModified?: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type { Node, Edge } from 'reactflow';

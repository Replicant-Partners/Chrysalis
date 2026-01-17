/**
 * Canvas System Types
 * 
 * Core type definitions for the canvas system.
 * 
 * @module canvas/types
 */

// =============================================================================
// Canvas Kinds
// =============================================================================

export type CanvasKind = 
  | 'settings'
  | 'board'
  | 'scrapbook'
  | 'research'
  | 'wiki'
  | 'terminal'
  | 'browser'
  | 'scenarios'
  | 'curation'
  | 'media';

// =============================================================================
// Widget Types
// =============================================================================

/**
 * Widget type identifier (constrained per-canvas by registry)
 */
export type WidgetType = string;

/**
 * Base widget node data
 */
export interface WidgetNodeData<TWidget extends WidgetType = WidgetType, TPayload = unknown> {
  widgetType: TWidget;
  title?: string;
  meta?: Record<string, unknown>;
  payload?: TPayload;
}

/**
 * Widget definition for registry
 */
export interface WidgetDefinition<TWidget extends WidgetType = WidgetType> {
  type: TWidget;
  displayName: string;
  description?: string;
  icon?: string;
  renderer: React.ComponentType<WidgetRendererProps<TWidget>>;
  schema?: Record<string, unknown>; // JSON Schema for payload validation
  capabilities?: string[]; // Required capabilities to use this widget
  defaultSize?: { width: number; height: number };
}

/**
 * Props passed to widget renderers
 */
export interface WidgetRendererProps<TWidget extends WidgetType = WidgetType> {
  widgetType: TWidget;
  data: WidgetNodeData<TWidget>;
  nodeId: string;
  selected: boolean;
  onUpdate: (data: Partial<WidgetNodeData<TWidget>>) => void;
  onDelete: () => void;
}

// =============================================================================
// Canvas Policy
// =============================================================================

export interface CanvasPolicy {
  /** Allowed widget types for this canvas */
  allowlist: WidgetType[];
  
  /** Explicitly denied widget types */
  denylist?: WidgetType[];
  
  /** Maximum nodes allowed */
  maxNodes?: number;
  
  /** Maximum edges allowed */
  maxEdges?: number;
  
  /** Rate limits */
  rateLimit?: {
    maxActionsPerMinute: number;
    maxCreationsPerMinute: number;
  };
}

// =============================================================================
// Canvas Theme
// =============================================================================

export interface CanvasTheme {
  background: string;
  gridColor: string;
  nodeBackground: string;
  nodeBorder: string;
  nodeText: string;
  edgeColor: string;
  selectedNodeBorder: string;
  selectedEdgeColor: string;
}

// =============================================================================
// Canvas Data Source
// =============================================================================

/**
 * Tile-based data loader for virtualization
 */
export interface CanvasDataSource {
  /** Load nodes/edges for a specific tile */
  loadTile(tileX: number, tileY: number): Promise<{
    nodes: CanvasNode[];
    edges: CanvasEdge[];
  }>;
  
  /** Save canvas state */
  saveState(nodes: CanvasNode[], edges: CanvasEdge[]): Promise<void>;
  
  /** Get tile size in canvas units */
  getTileSize(): { width: number; height: number };
}

// =============================================================================
// Canvas Node/Edge
// =============================================================================

export interface CanvasNode<TWidget extends WidgetType = WidgetType> {
  id: string;
  type: 'widget';
  position: { x: number; y: number };
  data: WidgetNodeData<TWidget>;
  width?: number;
  height?: number;
  selected?: boolean;
  draggable?: boolean;
  deletable?: boolean;
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  type?: 'default' | 'smoothstep' | 'straight' | 'step';
  animated?: boolean;
  label?: string;
  data?: Record<string, unknown>;
}

// =============================================================================
// Canvas Events
// =============================================================================

export type CanvasEventType =
  | 'canvas_open'
  | 'canvas_close'
  | 'widget_add'
  | 'widget_update'
  | 'widget_delete'
  | 'widget_blocked'
  | 'edge_add'
  | 'edge_delete'
  | 'viewport_change'
  | 'data_load_start'
  | 'data_load_complete'
  | 'error';

export interface CanvasEvent {
  type: CanvasEventType;
  canvasKind: CanvasKind;
  timestamp: string;
  payload?: unknown;
  traceId?: string;
}

// =============================================================================
// Accessibility
// =============================================================================

export interface A11yConfig {
  enableKeyboardNav: boolean;
  announceChanges: boolean;
  highContrast?: boolean;
  reducedMotion?: boolean;
}

// =============================================================================
// Logging
// =============================================================================

export interface CanvasLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
}

// =============================================================================
// Lifecycle Hooks
// =============================================================================

export interface CanvasLifecycleHooks {
  onInit?: (canvasKind: CanvasKind) => void | Promise<void>;
  onBeforePersist?: (nodes: CanvasNode[], edges: CanvasEdge[]) => void | Promise<void>;
  onDestroy?: (canvasKind: CanvasKind) => void | Promise<void>;
}
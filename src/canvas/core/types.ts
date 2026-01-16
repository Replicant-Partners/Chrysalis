/**
 * Canvas Core Types
 *
 * Base type definitions for the canvas-widget architecture.
 * All five canvas types (Settings, Board, Scrapbook, Research, Terminal-Browser)
 * build on these foundational types.
 */

// =============================================================================
// Canvas Identity
// =============================================================================

/** The five supported canvas types */
export type CanvasKind =
  | 'settings'
  | 'board'
  | 'scrapbook'
  | 'research'
  | 'terminal-browser';

/** Unique identifier for a canvas instance */
export type CanvasId = string;

/** Canvas metadata */
export interface CanvasMeta {
  id: CanvasId;
  kind: CanvasKind;
  title: string;
  createdAt: number;
  updatedAt: number;
  version: number;
}

// =============================================================================
// Viewport & Positioning
// =============================================================================

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface Bounds {
  position: Position;
  dimensions: Dimensions;
}

// =============================================================================
// Grid Configuration
// =============================================================================

export interface GridConfig {
  enabled: boolean;
  size: number;          // Grid cell size in pixels
  snapToGrid: boolean;
  showGrid: boolean;
  gridColor?: string;
}

export const DEFAULT_GRID_CONFIG: GridConfig = {
  enabled: true,
  size: 20,
  snapToGrid: true,
  showGrid: true,
  gridColor: '#2a2a3a',
};

// =============================================================================
// Node Types (Widget Containers)
// =============================================================================

/** Base node data that all widgets must include */
export interface BaseNodeData {
  widgetType: string;
  title?: string;
  locked?: boolean;
  metadata?: Record<string, unknown>;
}

/** A node on the canvas (container for a widget) */
export interface CanvasNode<T extends BaseNodeData = BaseNodeData> {
  id: string;
  type: string;           // React Flow node type
  position: Position;
  data: T;
  width?: number;
  height?: number;
  selected?: boolean;
  dragging?: boolean;
  zIndex?: number;
  parentId?: string;      // For grouping/nesting
}

// =============================================================================
// Edge Types (Connections)
// =============================================================================

export type EdgeType = 'default' | 'straight' | 'step' | 'smoothstep' | 'bezier';

export interface CanvasEdge {
  id: string;
  source: string;         // Source node ID
  target: string;         // Target node ID
  sourceHandle?: string;  // Specific handle on source
  targetHandle?: string;  // Specific handle on target
  type?: EdgeType;
  label?: string;
  animated?: boolean;
  style?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

// =============================================================================
// Canvas State
// =============================================================================

export interface CanvasState {
  meta: CanvasMeta;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  viewport: Viewport;
  selection: {
    nodeIds: string[];
    edgeIds: string[];
  };
  grid: GridConfig;
}

// =============================================================================
// Lifecycle Events
// =============================================================================

export type CanvasLifecyclePhase =
  | 'initializing'
  | 'ready'
  | 'active'
  | 'background'
  | 'saving'
  | 'restoring'
  | 'destroying';

export interface CanvasLifecycleEvent {
  phase: CanvasLifecyclePhase;
  canvasId: CanvasId;
  timestamp: number;
  previousPhase?: CanvasLifecyclePhase;
}

// =============================================================================
// Canvas Events
// =============================================================================

export type CanvasEventType =
  | 'node:added'
  | 'node:removed'
  | 'node:moved'
  | 'node:resized'
  | 'node:selected'
  | 'node:deselected'
  | 'node:data-changed'
  | 'edge:connected'
  | 'edge:disconnected'
  | 'edge:selected'
  | 'viewport:changed'
  | 'selection:changed'
  | 'lifecycle:changed'
  | 'state:saved'
  | 'state:restored';

export interface CanvasEvent<T = unknown> {
  type: CanvasEventType;
  canvasId: CanvasId;
  timestamp: number;
  payload: T;
}

// =============================================================================
// Event Payloads
// =============================================================================

export interface NodeAddedPayload {
  node: CanvasNode;
  source: 'user' | 'api' | 'restore';
}

export interface NodeRemovedPayload {
  nodeId: string;
  node: CanvasNode;
}

export interface NodeMovedPayload {
  nodeId: string;
  from: Position;
  to: Position;
}

export interface NodeResizedPayload {
  nodeId: string;
  from: Dimensions;
  to: Dimensions;
}

export interface EdgeConnectedPayload {
  edge: CanvasEdge;
}

export interface EdgeDisconnectedPayload {
  edgeId: string;
  edge: CanvasEdge;
}

export interface ViewportChangedPayload {
  from: Viewport;
  to: Viewport;
}

export interface SelectionChangedPayload {
  nodeIds: string[];
  edgeIds: string[];
}

// =============================================================================
// Canvas Configuration
// =============================================================================

export interface CanvasConfig {
  kind: CanvasKind;

  // Viewport limits
  minZoom: number;
  maxZoom: number;

  // Grid
  grid: GridConfig;

  // Behavior
  allowNodeOverlap: boolean;
  autoArrangeOnOverlap: boolean;

  // Infinite scroll
  infiniteScroll: {
    horizontal: boolean;
    vertical: boolean;
  };

  // Performance
  virtualization: {
    enabled: boolean;
    buffer: number;  // Extra nodes to render outside viewport
  };

  // Persistence
  autoSaveInterval?: number;  // ms, undefined = no autosave
}

export const DEFAULT_CANVAS_CONFIG: CanvasConfig = {
  kind: 'board',
  minZoom: 0.1,
  maxZoom: 4,
  grid: DEFAULT_GRID_CONFIG,
  allowNodeOverlap: false,
  autoArrangeOnOverlap: true,
  infiniteScroll: {
    horizontal: true,
    vertical: true,
  },
  virtualization: {
    enabled: true,
    buffer: 100,
  },
  autoSaveInterval: 30000,
};

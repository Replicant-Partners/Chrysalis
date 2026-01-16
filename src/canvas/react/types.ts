/**
 * React Canvas Types
 *
 * Type definitions for React components that render canvases and widgets.
 */

import type { ReactNode, CSSProperties } from 'react';
import type { CanvasId, CanvasKind, CanvasNode, CanvasEdge, Viewport } from '../core/types';
import type { WidgetDefinition } from '../widgets/types';

// =============================================================================
// Canvas Component Props
// =============================================================================

export interface CanvasProps {
  /** Canvas identifier */
  id: CanvasId;

  /** Canvas type */
  kind: CanvasKind;

  /** Initial nodes */
  nodes?: CanvasNode[];

  /** Initial edges */
  edges?: CanvasEdge[];

  /** Initial viewport */
  viewport?: Partial<Viewport>;

  /** Grid configuration */
  grid?: {
    enabled: boolean;
    size: number;
    visible: boolean;
  };

  /** Read-only mode */
  readOnly?: boolean;

  /** Custom class name */
  className?: string;

  /** Custom styles */
  style?: CSSProperties;

  /** Node change handler */
  onNodesChange?: (nodes: CanvasNode[]) => void;

  /** Edge change handler */
  onEdgesChange?: (edges: CanvasEdge[]) => void;

  /** Selection change handler */
  onSelectionChange?: (selection: { nodeIds: string[]; edgeIds: string[] }) => void;

  /** Viewport change handler */
  onViewportChange?: (viewport: Viewport) => void;

  /** Node click handler */
  onNodeClick?: (node: CanvasNode) => void;

  /** Node double-click handler */
  onNodeDoubleClick?: (node: CanvasNode) => void;

  /** Canvas click handler (background) */
  onCanvasClick?: (position: { x: number; y: number }) => void;

  /** Context menu handler */
  onContextMenu?: (event: { position: { x: number; y: number }; node?: CanvasNode }) => void;

  /** Drop handler for external content */
  onDrop?: (event: { position: { x: number; y: number }; data: unknown }) => void;

  /** Children (toolbar, overlays, etc.) */
  children?: ReactNode;
}

// =============================================================================
// Widget Component Props
// =============================================================================

export interface WidgetProps<T = unknown> {
  /** Widget node data */
  node: CanvasNode<T>;

  /** Widget definition */
  definition: WidgetDefinition<T>;

  /** Is this widget selected? */
  selected: boolean;

  /** Is this widget being dragged? */
  dragging: boolean;

  /** Is this widget being resized? */
  resizing: boolean;

  /** Read-only mode */
  readOnly?: boolean;

  /** Data change handler */
  onDataChange?: (data: Partial<T>) => void;

  /** State change handler */
  onStateChange?: (state: string) => void;

  /** Connection request handler */
  onConnect?: (handleId: string) => void;
}

export interface WidgetWrapperProps {
  /** Widget node */
  node: CanvasNode;

  /** Is this widget selected? */
  selected: boolean;

  /** Selection handler */
  onSelect: (nodeId: string, additive: boolean) => void;

  /** Position change handler */
  onPositionChange: (nodeId: string, position: { x: number; y: number }) => void;

  /** Size change handler */
  onSizeChange: (nodeId: string, size: { width: number; height: number }) => void;

  /** Delete handler */
  onDelete: (nodeId: string) => void;

  /** Read-only mode */
  readOnly?: boolean;

  /** Children (widget content) */
  children: ReactNode;
}

// =============================================================================
// Toolbar Props
// =============================================================================

export interface CanvasToolbarProps {
  /** Available widgets for this canvas */
  availableWidgets: WidgetDefinition[];

  /** Add widget handler */
  onAddWidget: (typeId: string) => void;

  /** Zoom level (0-100 maps to 0.1-2.0) */
  zoom: number;

  /** Zoom change handler */
  onZoomChange: (zoom: number) => void;

  /** Grid visibility */
  gridVisible: boolean;

  /** Grid visibility toggle */
  onGridToggle: () => void;

  /** Undo available */
  canUndo: boolean;

  /** Redo available */
  canRedo: boolean;

  /** Undo handler */
  onUndo: () => void;

  /** Redo handler */
  onRedo: () => void;
}

// =============================================================================
// Minimap Props
// =============================================================================

export interface MinimapProps {
  /** All nodes */
  nodes: CanvasNode[];

  /** Current viewport */
  viewport: Viewport;

  /** Viewport change handler */
  onViewportChange: (viewport: Partial<Viewport>) => void;

  /** Minimap size */
  size?: { width: number; height: number };
}

// =============================================================================
// Context Menu Props
// =============================================================================

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  children?: ContextMenuItem[];
  action?: () => void;
}

export interface ContextMenuProps {
  /** Position to show menu */
  position: { x: number; y: number };

  /** Menu items */
  items: ContextMenuItem[];

  /** Close handler */
  onClose: () => void;
}

// =============================================================================
// Hooks Types
// =============================================================================

export interface UseCanvasReturn {
  /** Canvas nodes */
  nodes: CanvasNode[];

  /** Canvas edges */
  edges: CanvasEdge[];

  /** Current viewport */
  viewport: Viewport;

  /** Current selection */
  selection: { nodeIds: string[]; edgeIds: string[] };

  /** Add a node */
  addNode: (node: Omit<CanvasNode, 'id'>) => string;

  /** Update a node */
  updateNode: (nodeId: string, updates: Partial<CanvasNode>) => void;

  /** Remove a node */
  removeNode: (nodeId: string) => void;

  /** Add an edge */
  addEdge: (edge: Omit<CanvasEdge, 'id'>) => string;

  /** Remove an edge */
  removeEdge: (edgeId: string) => void;

  /** Set selection */
  setSelection: (selection: { nodeIds: string[]; edgeIds: string[] }) => void;

  /** Set viewport */
  setViewport: (viewport: Partial<Viewport>) => void;

  /** Fit all nodes in view */
  fitView: () => void;

  /** Center on a node */
  centerOnNode: (nodeId: string) => void;

  /** Undo */
  undo: () => void;

  /** Redo */
  redo: () => void;

  /** Can undo */
  canUndo: boolean;

  /** Can redo */
  canRedo: boolean;
}

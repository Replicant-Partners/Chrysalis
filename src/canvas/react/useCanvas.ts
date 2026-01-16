/**
 * useCanvas Hook
 *
 * React hook for managing canvas state with undo/redo support.
 * Integrates with the layout engine for snap-to-grid.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import type { CanvasNode, CanvasEdge, Viewport, CanvasKind } from '../core/types';
import type { UseCanvasReturn } from './types';
import { LayoutEngine, getLayoutEngine } from '../layout';

// =============================================================================
// History Management
// =============================================================================

interface HistoryState {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

interface HistoryManager {
  past: HistoryState[];
  future: HistoryState[];
}

const MAX_HISTORY = 50;

// =============================================================================
// Hook Implementation
// =============================================================================

export interface UseCanvasOptions {
  /** Canvas type */
  kind: CanvasKind;

  /** Initial nodes */
  initialNodes?: CanvasNode[];

  /** Initial edges */
  initialEdges?: CanvasEdge[];

  /** Initial viewport */
  initialViewport?: Partial<Viewport>;

  /** Enable snap-to-grid */
  snapToGrid?: boolean;

  /** Grid size for snapping */
  gridSize?: number;

  /** Enable history (undo/redo) */
  enableHistory?: boolean;
}

export function useCanvas(options: UseCanvasOptions): UseCanvasReturn {
  const {
    kind,
    initialNodes = [],
    initialEdges = [],
    initialViewport = {},
    snapToGrid = true,
    gridSize = 20,
    enableHistory = true,
  } = options;

  // State
  const [nodes, setNodes] = useState<CanvasNode[]>(initialNodes);
  const [edges, setEdges] = useState<CanvasEdge[]>(initialEdges);
  const [viewport, setViewportState] = useState<Viewport>({
    x: 0,
    y: 0,
    zoom: 1,
    ...initialViewport,
  });
  const [selection, setSelection] = useState<{ nodeIds: string[]; edgeIds: string[] }>({
    nodeIds: [],
    edgeIds: [],
  });

  // History
  const historyRef = useRef<HistoryManager>({ past: [], future: [] });
  const isUndoingRef = useRef(false);

  // Layout engine
  const layoutEngine = useMemo(() => {
    const engine = getLayoutEngine();
    engine.updateConfig({
      grid: {
        enabled: snapToGrid,
        size: gridSize,
        visible: true,
        snapThreshold: gridSize / 2,
        subdivisions: 1,
      },
    });
    return engine;
  }, [snapToGrid, gridSize]);

  // ===========================================================================
  // History Helpers
  // ===========================================================================

  const pushHistory = useCallback(() => {
    if (!enableHistory || isUndoingRef.current) return;

    historyRef.current.past.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    });

    // Limit history size
    if (historyRef.current.past.length > MAX_HISTORY) {
      historyRef.current.past.shift();
    }

    // Clear future on new action
    historyRef.current.future = [];
  }, [nodes, edges, enableHistory]);

  // ===========================================================================
  // Node Operations
  // ===========================================================================

  const addNode = useCallback((node: Omit<CanvasNode, 'id'>): string => {
    pushHistory();

    const id = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Snap position to grid
    let position = node.position;
    if (snapToGrid) {
      position = layoutEngine.snapToGrid(position);
    }

    const newNode: CanvasNode = {
      ...node,
      id,
      position,
    };

    setNodes(prev => [...prev, newNode]);
    return id;
  }, [pushHistory, snapToGrid, layoutEngine]);

  const updateNode = useCallback((nodeId: string, updates: Partial<CanvasNode>): void => {
    pushHistory();

    setNodes(prev => prev.map(node => {
      if (node.id !== nodeId) return node;

      let newNode = { ...node, ...updates };

      // Snap position if updated
      if (updates.position && snapToGrid) {
        newNode.position = layoutEngine.snapToGrid(updates.position);
      }

      return newNode;
    }));
  }, [pushHistory, snapToGrid, layoutEngine]);

  const removeNode = useCallback((nodeId: string): void => {
    pushHistory();

    // Remove node
    setNodes(prev => prev.filter(n => n.id !== nodeId));

    // Remove connected edges
    setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));

    // Remove from selection
    setSelection(prev => ({
      nodeIds: prev.nodeIds.filter(id => id !== nodeId),
      edgeIds: prev.edgeIds,
    }));
  }, [pushHistory]);

  // ===========================================================================
  // Edge Operations
  // ===========================================================================

  const addEdge = useCallback((edge: Omit<CanvasEdge, 'id'>): string => {
    pushHistory();

    const id = `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newEdge: CanvasEdge = { ...edge, id };

    setEdges(prev => [...prev, newEdge]);
    return id;
  }, [pushHistory]);

  const removeEdge = useCallback((edgeId: string): void => {
    pushHistory();

    setEdges(prev => prev.filter(e => e.id !== edgeId));

    setSelection(prev => ({
      nodeIds: prev.nodeIds,
      edgeIds: prev.edgeIds.filter(id => id !== edgeId),
    }));
  }, [pushHistory]);

  // ===========================================================================
  // Viewport Operations
  // ===========================================================================

  const setViewport = useCallback((updates: Partial<Viewport>): void => {
    setViewportState(prev => ({
      ...prev,
      ...updates,
      zoom: Math.max(0.1, Math.min(2, updates.zoom ?? prev.zoom)),
    }));
  }, []);

  const fitView = useCallback((): void => {
    if (nodes.length === 0) {
      setViewport({ x: 0, y: 0, zoom: 1 });
      return;
    }

    // Calculate bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    nodes.forEach(node => {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + (node.size?.width || 200));
      maxY = Math.max(maxY, node.position.y + (node.size?.height || 100));
    });

    const padding = 50;
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;

    // Assuming a viewport of 800x600 for calculation
    const viewportWidth = 800;
    const viewportHeight = 600;

    const zoom = Math.min(
      viewportWidth / width,
      viewportHeight / height,
      1 // Don't zoom in past 100%
    );

    setViewport({
      x: -(minX - padding) * zoom + (viewportWidth - width * zoom) / 2,
      y: -(minY - padding) * zoom + (viewportHeight - height * zoom) / 2,
      zoom,
    });
  }, [nodes, setViewport]);

  const centerOnNode = useCallback((nodeId: string): void => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const viewportWidth = 800;
    const viewportHeight = 600;

    const nodeWidth = node.size?.width || 200;
    const nodeHeight = node.size?.height || 100;

    setViewport({
      x: -(node.position.x + nodeWidth / 2) * viewport.zoom + viewportWidth / 2,
      y: -(node.position.y + nodeHeight / 2) * viewport.zoom + viewportHeight / 2,
    });
  }, [nodes, viewport.zoom, setViewport]);

  // ===========================================================================
  // Undo/Redo
  // ===========================================================================

  const undo = useCallback((): void => {
    if (!enableHistory || historyRef.current.past.length === 0) return;

    isUndoingRef.current = true;

    // Save current state to future
    historyRef.current.future.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    });

    // Restore past state
    const pastState = historyRef.current.past.pop()!;
    setNodes(pastState.nodes);
    setEdges(pastState.edges);

    isUndoingRef.current = false;
  }, [nodes, edges, enableHistory]);

  const redo = useCallback((): void => {
    if (!enableHistory || historyRef.current.future.length === 0) return;

    isUndoingRef.current = true;

    // Save current state to past
    historyRef.current.past.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    });

    // Restore future state
    const futureState = historyRef.current.future.pop()!;
    setNodes(futureState.nodes);
    setEdges(futureState.edges);

    isUndoingRef.current = false;
  }, [nodes, edges, enableHistory]);

  const canUndo = enableHistory && historyRef.current.past.length > 0;
  const canRedo = enableHistory && historyRef.current.future.length > 0;

  // ===========================================================================
  // Return
  // ===========================================================================

  return {
    nodes,
    edges,
    viewport,
    selection,
    addNode,
    updateNode,
    removeNode,
    addEdge,
    removeEdge,
    setSelection,
    setViewport,
    fitView,
    centerOnNode,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}

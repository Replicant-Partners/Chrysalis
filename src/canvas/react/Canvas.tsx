/**
 * Canvas Component
 *
 * React component for rendering an interactive canvas with widgets.
 * Supports panning, zooming, selection, and widget manipulation.
 */

import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
  MouseEvent,
  WheelEvent,
  KeyboardEvent,
} from 'react';
import type { CanvasNode, CanvasEdge, Viewport } from '../core/types';
import type { CanvasProps } from './types';
import { useCanvas } from './useCanvas';
import { WidgetWrapper } from './WidgetWrapper';
import { getWidgetRegistry } from '../widgets';

// =============================================================================
// Styles
// =============================================================================

const canvasStyles: React.CSSProperties = {
  width: '100%',
  height: '100%',
  position: 'relative',
  overflow: 'hidden',
  backgroundColor: '#0f0f14',
  cursor: 'grab',
};

const viewportStyles: React.CSSProperties = {
  position: 'absolute',
  transformOrigin: '0 0',
  willChange: 'transform',
};

const gridStyles: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
};

const selectionBoxStyles: React.CSSProperties = {
  position: 'absolute',
  border: '1px dashed #6366f1',
  backgroundColor: 'rgba(99, 102, 241, 0.1)',
  pointerEvents: 'none',
};

// =============================================================================
// Grid Pattern
// =============================================================================

interface GridPatternProps {
  size: number;
  zoom: number;
  offset: { x: number; y: number };
  visible: boolean;
}

const GridPattern: React.FC<GridPatternProps> = ({ size, zoom, offset, visible }) => {
  if (!visible) return null;

  const scaledSize = size * zoom;
  const patternId = `grid-${size}`;

  return (
    <svg style={gridStyles} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern
          id={patternId}
          width={scaledSize}
          height={scaledSize}
          patternUnits="userSpaceOnUse"
          x={offset.x % scaledSize}
          y={offset.y % scaledSize}
        >
          <circle
            cx={scaledSize / 2}
            cy={scaledSize / 2}
            r={1}
            fill="#2a2a3a"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
};

// =============================================================================
// Canvas Component
// =============================================================================

export const Canvas: React.FC<CanvasProps> = ({
  id,
  kind,
  nodes: initialNodes = [],
  edges: initialEdges = [],
  viewport: initialViewport = {},
  grid = { enabled: true, size: 20, visible: true },
  readOnly = false,
  className = '',
  style = {},
  onNodesChange,
  onEdgesChange,
  onSelectionChange,
  onViewportChange,
  onNodeClick,
  onNodeDoubleClick,
  onCanvasClick,
  onContextMenu,
  onDrop,
  children,
}) => {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);

  // Canvas state
  const canvas = useCanvas({
    kind,
    initialNodes,
    initialEdges,
    initialViewport,
    snapToGrid: grid.enabled,
    gridSize: grid.size,
  });

  // Selection box state
  const [selectionBox, setSelectionBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Widget registry
  const widgetRegistry = useMemo(() => getWidgetRegistry(), []);

  // ===========================================================================
  // Callbacks for external handlers
  // ===========================================================================

  useEffect(() => {
    onNodesChange?.(canvas.nodes);
  }, [canvas.nodes, onNodesChange]);

  useEffect(() => {
    onEdgesChange?.(canvas.edges);
  }, [canvas.edges, onEdgesChange]);

  useEffect(() => {
    onSelectionChange?.(canvas.selection);
  }, [canvas.selection, onSelectionChange]);

  useEffect(() => {
    onViewportChange?.(canvas.viewport);
  }, [canvas.viewport, onViewportChange]);

  // ===========================================================================
  // Coordinate Conversion
  // ===========================================================================

  const screenToCanvas = useCallback((screenX: number, screenY: number): { x: number; y: number } => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    return {
      x: (screenX - rect.left - canvas.viewport.x) / canvas.viewport.zoom,
      y: (screenY - rect.top - canvas.viewport.y) / canvas.viewport.zoom,
    };
  }, [canvas.viewport]);

  // ===========================================================================
  // Mouse Handlers
  // ===========================================================================

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      // Middle click or Shift+Left click = pan
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX - canvas.viewport.x, y: e.clientY - canvas.viewport.y };
      e.currentTarget.style.cursor = 'grabbing';
    } else if (e.button === 0 && e.target === containerRef.current) {
      // Left click on background = start selection box
      if (!readOnly) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        selectionStartRef.current = canvasPos;
        canvas.setSelection({ nodeIds: [], edgeIds: [] });
      }
    }
  }, [canvas, readOnly, screenToCanvas]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isPanningRef.current) {
      // Panning
      canvas.setViewport({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
    } else if (selectionStartRef.current) {
      // Selection box
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      const start = selectionStartRef.current;

      setSelectionBox({
        x: Math.min(start.x, canvasPos.x),
        y: Math.min(start.y, canvasPos.y),
        width: Math.abs(canvasPos.x - start.x),
        height: Math.abs(canvasPos.y - start.y),
      });
    }
  }, [canvas, screenToCanvas]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      e.currentTarget.style.cursor = 'grab';
    }

    if (selectionStartRef.current && selectionBox) {
      // Find nodes in selection box
      const selectedNodeIds = canvas.nodes
        .filter(node => {
          const nodeRight = node.position.x + (node.size?.width || 200);
          const nodeBottom = node.position.y + (node.size?.height || 100);
          const boxRight = selectionBox.x + selectionBox.width;
          const boxBottom = selectionBox.y + selectionBox.height;

          return (
            node.position.x < boxRight &&
            nodeRight > selectionBox.x &&
            node.position.y < boxBottom &&
            nodeBottom > selectionBox.y
          );
        })
        .map(n => n.id);

      canvas.setSelection({ nodeIds: selectedNodeIds, edgeIds: [] });
      selectionStartRef.current = null;
      setSelectionBox(null);
    } else if (e.target === containerRef.current) {
      // Click on background
      onCanvasClick?.(screenToCanvas(e.clientX, e.clientY));
    }
  }, [canvas, selectionBox, onCanvasClick, screenToCanvas]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Zoom centered on mouse position
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(2, canvas.viewport.zoom * zoomFactor));

    const zoomRatio = newZoom / canvas.viewport.zoom;

    canvas.setViewport({
      x: mouseX - (mouseX - canvas.viewport.x) * zoomRatio,
      y: mouseY - (mouseY - canvas.viewport.y) * zoomRatio,
      zoom: newZoom,
    });
  }, [canvas]);

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
    onContextMenu?.({
      position: screenToCanvas(e.clientX, e.clientY),
      node: undefined, // Would need to check if over a node
    });
  }, [onContextMenu, screenToCanvas]);

  // ===========================================================================
  // Keyboard Handlers
  // ===========================================================================

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Delete selected nodes
    if ((e.key === 'Delete' || e.key === 'Backspace') && !readOnly) {
      canvas.selection.nodeIds.forEach(id => canvas.removeNode(id));
      canvas.selection.edgeIds.forEach(id => canvas.removeEdge(id));
    }

    // Undo/Redo
    if (e.metaKey || e.ctrlKey) {
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        canvas.undo();
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        canvas.redo();
      }
    }

    // Fit view
    if (e.key === '1' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      canvas.fitView();
    }
  }, [canvas, readOnly]);

  // ===========================================================================
  // Drop Handler
  // ===========================================================================

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();

    const data = e.dataTransfer.getData('application/json');
    if (data) {
      try {
        const parsed = JSON.parse(data);
        onDrop?.({
          position: screenToCanvas(e.clientX, e.clientY),
          data: parsed,
        });
      } catch {
        // Invalid JSON
      }
    }
  }, [onDrop, screenToCanvas]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  // ===========================================================================
  // Widget Handlers
  // ===========================================================================

  const handleNodeSelect = useCallback((nodeId: string, additive: boolean) => {
    if (additive) {
      const isSelected = canvas.selection.nodeIds.includes(nodeId);
      canvas.setSelection({
        nodeIds: isSelected
          ? canvas.selection.nodeIds.filter(id => id !== nodeId)
          : [...canvas.selection.nodeIds, nodeId],
        edgeIds: canvas.selection.edgeIds,
      });
    } else {
      canvas.setSelection({ nodeIds: [nodeId], edgeIds: [] });
    }
  }, [canvas]);

  const handleNodePositionChange = useCallback((nodeId: string, position: { x: number; y: number }) => {
    canvas.updateNode(nodeId, { position });
  }, [canvas]);

  const handleNodeSizeChange = useCallback((nodeId: string, size: { width: number; height: number }) => {
    canvas.updateNode(nodeId, { size });
  }, [canvas]);

  const handleNodeDelete = useCallback((nodeId: string) => {
    canvas.removeNode(nodeId);
  }, [canvas]);

  const handleNodeClick = useCallback((node: CanvasNode) => {
    onNodeClick?.(node);
  }, [onNodeClick]);

  const handleNodeDoubleClick = useCallback((node: CanvasNode) => {
    onNodeDoubleClick?.(node);
  }, [onNodeDoubleClick]);

  // ===========================================================================
  // Render
  // ===========================================================================

  const viewportTransform = `translate(${canvas.viewport.x}px, ${canvas.viewport.y}px) scale(${canvas.viewport.zoom})`;

  return (
    <div
      ref={containerRef}
      className={`chrysalis-canvas ${className}`}
      style={{ ...canvasStyles, ...style }}
      tabIndex={0}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Grid */}
      <GridPattern
        size={grid.size}
        zoom={canvas.viewport.zoom}
        offset={{ x: canvas.viewport.x, y: canvas.viewport.y }}
        visible={grid.visible}
      />

      {/* Viewport container */}
      <div style={{ ...viewportStyles, transform: viewportTransform }}>
        {/* Edges */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            overflow: 'visible',
          }}
        >
          {canvas.edges.map(edge => {
            const sourceNode = canvas.nodes.find(n => n.id === edge.source);
            const targetNode = canvas.nodes.find(n => n.id === edge.target);
            if (!sourceNode || !targetNode) return null;

            const sourceX = sourceNode.position.x + (sourceNode.size?.width || 200) / 2;
            const sourceY = sourceNode.position.y + (sourceNode.size?.height || 100) / 2;
            const targetX = targetNode.position.x + (targetNode.size?.width || 200) / 2;
            const targetY = targetNode.position.y + (targetNode.size?.height || 100) / 2;

            return (
              <path
                key={edge.id}
                d={`M ${sourceX} ${sourceY} L ${targetX} ${targetY}`}
                stroke={edge.data?.color || '#6366f1'}
                strokeWidth={2}
                fill="none"
              />
            );
          })}
        </svg>

        {/* Nodes */}
        {canvas.nodes.map(node => {
          const definition = widgetRegistry.get(node.type);

          return (
            <WidgetWrapper
              key={node.id}
              node={node}
              selected={canvas.selection.nodeIds.includes(node.id)}
              onSelect={handleNodeSelect}
              onPositionChange={handleNodePositionChange}
              onSizeChange={handleNodeSizeChange}
              onDelete={handleNodeDelete}
              onClick={() => handleNodeClick(node)}
              onDoubleClick={() => handleNodeDoubleClick(node)}
              readOnly={readOnly}
            >
              {/* Widget content would go here - using placeholder */}
              <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                padding: '12px',
                backgroundColor: '#1e1e2e',
                borderRadius: '8px',
                color: '#cdd6f4',
              }}>
                <div style={{
                  fontSize: '12px',
                  color: '#89b4fa',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  <span>{definition?.icon || '📦'}</span>
                  <span>{definition?.name || node.type}</span>
                </div>
                <div style={{ fontSize: '14px', flex: 1 }}>
                  {(node.data as any)?.title || (node.data as any)?.name || 'Widget'}
                </div>
              </div>
            </WidgetWrapper>
          );
        })}
      </div>

      {/* Selection box */}
      {selectionBox && (
        <div
          style={{
            ...selectionBoxStyles,
            left: selectionBox.x * canvas.viewport.zoom + canvas.viewport.x,
            top: selectionBox.y * canvas.viewport.zoom + canvas.viewport.y,
            width: selectionBox.width * canvas.viewport.zoom,
            height: selectionBox.height * canvas.viewport.zoom,
          }}
        />
      )}

      {/* Children (toolbar, etc.) */}
      {children}
    </div>
  );
};

export default Canvas;

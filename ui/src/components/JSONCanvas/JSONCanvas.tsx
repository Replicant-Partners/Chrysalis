/**
 * JSONCanvas Component
 * 
 * Renders the center canvas with draggable widgets.
 * Features:
 * - Infinite canvas with pan/zoom
 * - Widget node rendering
 * - Edge connections between widgets
 * - Widget type-specific renderers
 */

import React, { useRef, useState, useCallback, useMemo } from 'react';
import clsx from 'clsx';
import type { 
  CanvasNode, 
  CanvasEdge, 
  WidgetNode 
} from '@terminal/protocols/types';
import { WidgetRenderer } from './WidgetRenderer';
import { wrapNode } from '../../utils/CanvasNodeWrapper';
import { RenderVisitor } from './visitors/RenderVisitor';
import styles from './JSONCanvas.module.css';

// ============================================================================
// Types
// ============================================================================

export interface JSONCanvasProps {
  /** Canvas nodes */
  nodes: CanvasNode[];
  /** Canvas edges */
  edges: CanvasEdge[];
  /** Current viewport */
  viewport: { x: number; y: number; zoom: number };
  /** Called when viewport changes */
  onViewportChange?: (viewport: { x: number; y: number; zoom: number }) => void;
  /** Called when a node is selected */
  onNodeSelect?: (nodeId: string | null) => void;
  /** Called when a node is moved */
  onNodeMove?: (nodeId: string, x: number, y: number) => void;
  /** Called when a node is resized */
  onNodeResize?: (nodeId: string, width: number, height: number) => void;
  /** Currently selected node ID */
  selectedNodeId?: string | null;
  /** CSS class name */
  className?: string;
}

// ============================================================================
// Canvas Node Component
// ============================================================================

interface CanvasNodeProps {
  node: CanvasNode;
  isSelected: boolean;
  zoom: number;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
}

function CanvasNodeComponent({ 
  node, 
  isSelected, 
  zoom, 
  onSelect,
  onMove 
}: CanvasNodeProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, nodeX: 0, nodeY: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      nodeX: node.x,
      nodeY: node.y
    };
    onSelect();
  }, [node.x, node.y, onSelect]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const dx = (e.clientX - dragStartRef.current.x) / zoom;
    const dy = (e.clientY - dragStartRef.current.y) / zoom;

    onMove(
      dragStartRef.current.nodeX + dx,
      dragStartRef.current.nodeY + dy
    );
  }, [isDragging, zoom, onMove]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Render using Visitor pattern
  const renderContent = () => {
    const visitor = new RenderVisitor(isSelected, zoom);
    const wrapped = wrapNode(node);
    return wrapped.accept(visitor);
  };

  return (
    <div
      className={clsx(
        styles.canvasNode,
        isSelected && styles.selected,
        isDragging && styles.dragging
      )}
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height
      }}
      onMouseDown={handleMouseDown}
    >
      {renderContent()}
      {isSelected && (
        <div className={styles.resizeHandles}>
          <div className={clsx(styles.resizeHandle, styles.nw)} />
          <div className={clsx(styles.resizeHandle, styles.ne)} />
          <div className={clsx(styles.resizeHandle, styles.sw)} />
          <div className={clsx(styles.resizeHandle, styles.se)} />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Edge Component
// ============================================================================

interface EdgeProps {
  edge: CanvasEdge;
  nodes: Map<string, CanvasNode>;
}

function Edge({ edge, nodes }: EdgeProps) {
  const fromNode = nodes.get(edge.fromNode);
  const toNode = nodes.get(edge.toNode);

  if (!fromNode || !toNode) return null;

  // Calculate connection points
  const getConnectionPoint = (node: CanvasNode, side: string) => {
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;

    switch (side) {
      case 'top': return { x: cx, y: node.y };
      case 'bottom': return { x: cx, y: node.y + node.height };
      case 'left': return { x: node.x, y: cy };
      case 'right': return { x: node.x + node.width, y: cy };
      default: return { x: cx, y: cy };
    }
  };

  const from = getConnectionPoint(fromNode, edge.fromSide || 'right');
  const to = getConnectionPoint(toNode, edge.toSide || 'left');

  // Create bezier curve
  const dx = Math.abs(to.x - from.x) * 0.5;
  const path = `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;

  return (
    <g className={styles.edge}>
      <path
        d={path}
        fill="none"
        stroke="#94a3b8"
        strokeWidth={2}
        markerEnd="url(#arrowhead)"
      />
    </g>
  );
}

// ============================================================================
// JSON Canvas Component
// ============================================================================

export function JSONCanvas({
  nodes,
  edges,
  viewport,
  onViewportChange,
  onNodeSelect,
  onNodeMove,
  selectedNodeId,
  className
}: JSONCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, viewX: 0, viewY: 0 });

  const nodeMap = useMemo(() => {
    const map = new Map<string, CanvasNode>();
    nodes.forEach(n => map.set(n.id, n));
    return map;
  }, [nodes]);

  // Handle canvas pan
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (e.target !== canvasRef.current) return;

    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      viewX: viewport.x,
      viewY: viewport.y
    };
    onNodeSelect?.(null);
  }, [viewport, onNodeSelect]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;

    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;

    onViewportChange?.({
      x: panStartRef.current.viewX + dx,
      y: panStartRef.current.viewY + dy,
      zoom: viewport.zoom
    });
  }, [isPanning, viewport.zoom, onViewportChange]);

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Handle zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(2, Math.max(0.25, viewport.zoom * delta));

    onViewportChange?.({
      ...viewport,
      zoom: newZoom
    });
  }, [viewport, onViewportChange]);

  return (
    <div 
      className={clsx(styles.jsonCanvas, className)}
      ref={canvasRef}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onMouseLeave={handleCanvasMouseUp}
      onWheel={handleWheel}
    >
      {/* Background grid */}
      <div 
        className={styles.grid}
        style={{
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
          backgroundSize: `${20 * viewport.zoom}px ${20 * viewport.zoom}px`
        }}
      />

      {/* Canvas content layer */}
      <div 
        className={styles.contentLayer}
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`
        }}
      >
        {/* SVG layer for edges */}
        <svg className={styles.edgeLayer}>
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
            </marker>
          </defs>
          {edges.map(edge => (
            <Edge key={edge.id} edge={edge} nodes={nodeMap} />
          ))}
        </svg>

        {/* Nodes */}
        {nodes.map(node => (
          <CanvasNodeComponent
            key={node.id}
            node={node}
            isSelected={selectedNodeId === node.id}
            zoom={viewport.zoom}
            onSelect={() => onNodeSelect?.(node.id)}
            onMove={(x, y) => onNodeMove?.(node.id, x, y)}
          />
        ))}
      </div>

      {/* Viewport info */}
      <div className={styles.viewportInfo}>
        <span>Zoom: {Math.round(viewport.zoom * 100)}%</span>
        <span>Widgets: {nodes.filter(n => n.type === 'widget').length}</span>
      </div>

      {/* Empty state */}
      {nodes.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🎨</div>
          <h3>Canvas Empty</h3>
          <p>Agents can create widgets here</p>
        </div>
      )}
    </div>
  );
}

export default JSONCanvas;
/**
 * Widget Wrapper Component
 *
 * Wraps individual widgets with:
 * - Selection highlighting
 * - Drag handling
 * - Resize handling
 * - Context actions
 */

import React, {
  useRef,
  useState,
  useCallback,
  MouseEvent,
  ReactNode,
} from 'react';
import type { CanvasNode } from '../core/types';

// =============================================================================
// Types
// =============================================================================

interface WidgetWrapperProps {
  node: CanvasNode;
  selected: boolean;
  onSelect: (nodeId: string, additive: boolean) => void;
  onPositionChange: (nodeId: string, position: { x: number; y: number }) => void;
  onSizeChange: (nodeId: string, size: { width: number; height: number }) => void;
  onDelete: (nodeId: string) => void;
  onClick?: () => void;
  onDoubleClick?: () => void;
  readOnly?: boolean;
  children: ReactNode;
}

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

// =============================================================================
// Styles
// =============================================================================

const wrapperStyles: React.CSSProperties = {
  position: 'absolute',
  userSelect: 'none',
  cursor: 'move',
};

const selectedStyles: React.CSSProperties = {
  boxShadow: '0 0 0 2px #6366f1',
  borderRadius: '8px',
};

const resizeHandleStyles: React.CSSProperties = {
  position: 'absolute',
  width: '10px',
  height: '10px',
  backgroundColor: '#6366f1',
  border: '2px solid #1e1e2e',
  borderRadius: '2px',
  zIndex: 10,
};

// =============================================================================
// Component
// =============================================================================

export const WidgetWrapper: React.FC<WidgetWrapperProps> = ({
  node,
  selected,
  onSelect,
  onPositionChange,
  onSizeChange,
  onDelete,
  onClick,
  onDoubleClick,
  readOnly = false,
  children,
}) => {
  // Refs
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; nodeX: number; nodeY: number } | null>(null);
  const resizeStartRef = useRef<{
    handle: ResizeHandle;
    startX: number;
    startY: number;
    nodeX: number;
    nodeY: number;
    nodeWidth: number;
    nodeHeight: number;
  } | null>(null);

  // State
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // Dimensions
  const width = node.size?.width || 200;
  const height = node.size?.height || 100;
  const minWidth = 100;
  const minHeight = 60;

  // ===========================================================================
  // Drag Handling
  // ===========================================================================

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (readOnly) return;
    if ((e.target as HTMLElement).dataset.resizeHandle) return;

    e.stopPropagation();

    // Select on click
    onSelect(node.id, e.shiftKey || e.metaKey || e.ctrlKey);

    // Start drag
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      nodeX: node.position.x,
      nodeY: node.position.y,
    };
    setIsDragging(true);

    // Add document listeners
    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);
  }, [node.id, node.position, onSelect, readOnly]);

  const handleDocumentMouseMove = useCallback((e: globalThis.MouseEvent) => {
    if (dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      // Note: In a real implementation, we'd divide by zoom level
      // This is a simplified version
      onPositionChange(node.id, {
        x: dragStartRef.current.nodeX + dx,
        y: dragStartRef.current.nodeY + dy,
      });
    }

    if (resizeStartRef.current) {
      const { handle, startX, startY, nodeX, nodeY, nodeWidth, nodeHeight } = resizeStartRef.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let newX = nodeX;
      let newY = nodeY;
      let newWidth = nodeWidth;
      let newHeight = nodeHeight;

      // Handle resize based on which handle is being dragged
      if (handle.includes('e')) {
        newWidth = Math.max(minWidth, nodeWidth + dx);
      }
      if (handle.includes('w')) {
        const widthChange = Math.min(dx, nodeWidth - minWidth);
        newWidth = nodeWidth - widthChange;
        newX = nodeX + widthChange;
      }
      if (handle.includes('s')) {
        newHeight = Math.max(minHeight, nodeHeight + dy);
      }
      if (handle.includes('n')) {
        const heightChange = Math.min(dy, nodeHeight - minHeight);
        newHeight = nodeHeight - heightChange;
        newY = nodeY + heightChange;
      }

      onPositionChange(node.id, { x: newX, y: newY });
      onSizeChange(node.id, { width: newWidth, height: newHeight });
    }
  }, [node.id, onPositionChange, onSizeChange]);

  const handleDocumentMouseUp = useCallback(() => {
    dragStartRef.current = null;
    resizeStartRef.current = null;
    setIsDragging(false);
    setIsResizing(false);

    document.removeEventListener('mousemove', handleDocumentMouseMove);
    document.removeEventListener('mouseup', handleDocumentMouseUp);
  }, [handleDocumentMouseMove]);

  // ===========================================================================
  // Resize Handling
  // ===========================================================================

  const handleResizeStart = useCallback((handle: ResizeHandle) => (e: MouseEvent) => {
    if (readOnly) return;

    e.stopPropagation();

    resizeStartRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      nodeX: node.position.x,
      nodeY: node.position.y,
      nodeWidth: width,
      nodeHeight: height,
    };
    setIsResizing(true);

    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);
  }, [node.position, width, height, readOnly, handleDocumentMouseMove, handleDocumentMouseUp]);

  // ===========================================================================
  // Click Handling
  // ===========================================================================

  const handleClick = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    onClick?.();
  }, [onClick]);

  const handleDoubleClick = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    onDoubleClick?.();
  }, [onDoubleClick]);

  // ===========================================================================
  // Render
  // ===========================================================================

  const resizeHandles: Array<{ handle: ResizeHandle; style: React.CSSProperties }> = [
    { handle: 'n', style: { top: -5, left: '50%', marginLeft: -5, cursor: 'ns-resize' } },
    { handle: 's', style: { bottom: -5, left: '50%', marginLeft: -5, cursor: 'ns-resize' } },
    { handle: 'e', style: { right: -5, top: '50%', marginTop: -5, cursor: 'ew-resize' } },
    { handle: 'w', style: { left: -5, top: '50%', marginTop: -5, cursor: 'ew-resize' } },
    { handle: 'ne', style: { top: -5, right: -5, cursor: 'nesw-resize' } },
    { handle: 'nw', style: { top: -5, left: -5, cursor: 'nwse-resize' } },
    { handle: 'se', style: { bottom: -5, right: -5, cursor: 'nwse-resize' } },
    { handle: 'sw', style: { bottom: -5, left: -5, cursor: 'nesw-resize' } },
  ];

  return (
    <div
      ref={wrapperRef}
      style={{
        ...wrapperStyles,
        left: node.position.x,
        top: node.position.y,
        width,
        height,
        ...(selected ? selectedStyles : {}),
        opacity: isDragging ? 0.8 : 1,
        zIndex: selected ? 100 : node.zIndex || 1,
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {/* Widget content */}
      {children}

      {/* Resize handles (only when selected and not read-only) */}
      {selected && !readOnly && resizeHandles.map(({ handle, style }) => (
        <div
          key={handle}
          data-resize-handle={handle}
          style={{ ...resizeHandleStyles, ...style }}
          onMouseDown={handleResizeStart(handle)}
        />
      ))}
    </div>
  );
};

export default WidgetWrapper;

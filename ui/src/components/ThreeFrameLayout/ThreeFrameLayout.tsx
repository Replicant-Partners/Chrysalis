/**
 * ThreeFrameLayout Component
 * 
 * The main layout component for ChrysalisTerminal:
 * - Left: Agent ChatPane
 * - Center: JSON Canvas
 * - Right: Human ChatPane
 */

import React, { useState, useCallback } from 'react';
import clsx from 'clsx';
import styles from './ThreeFrameLayout.module.css';

// ============================================================================
// Types
// ============================================================================

export interface ThreeFrameLayoutProps {
  /** Left pane content (agent chat) */
  leftPane: React.ReactNode;
  /** Center pane content (canvas) */
  centerPane: React.ReactNode;
  /** Right pane content (human chat) */
  rightPane: React.ReactNode;
  /** Header content (optional) */
  header?: React.ReactNode;
  /** Footer content (optional) */
  footer?: React.ReactNode;
  /** Initial left pane width (px) */
  leftWidth?: number;
  /** Initial right pane width (px) */
  rightWidth?: number;
  /** Minimum pane width */
  minPaneWidth?: number;
  /** CSS class name */
  className?: string;
}

// ============================================================================
// Resizer Component
// ============================================================================

interface ResizerProps {
  onResize: (delta: number) => void;
  direction: 'left' | 'right';
}

function Resizer({ onResize, direction }: ResizerProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    
    const startX = e.clientX;
    
    const handleMouseMove = (e: MouseEvent) => {
      const delta = direction === 'left' 
        ? e.clientX - startX 
        : startX - e.clientX;
      onResize(delta);
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [onResize, direction]);

  return (
    <div 
      className={clsx(styles.resizer, isDragging && styles.dragging)}
      onMouseDown={handleMouseDown}
    >
      <div className={styles.resizerHandle} />
    </div>
  );
}

// ============================================================================
// Three Frame Layout Component
// ============================================================================

export function ThreeFrameLayout({
  leftPane,
  centerPane,
  rightPane,
  header,
  footer,
  leftWidth: initialLeftWidth = 320,
  rightWidth: initialRightWidth = 320,
  minPaneWidth = 200,
  className
}: ThreeFrameLayoutProps) {
  const [leftWidth, setLeftWidth] = useState(initialLeftWidth);
  const [rightWidth, setRightWidth] = useState(initialRightWidth);

  const handleLeftResize = useCallback((delta: number) => {
    setLeftWidth(prev => Math.max(minPaneWidth, prev + delta));
  }, [minPaneWidth]);

  const handleRightResize = useCallback((delta: number) => {
    setRightWidth(prev => Math.max(minPaneWidth, prev + delta));
  }, [minPaneWidth]);

  return (
    <div className={clsx(styles.layout, className)}>
      {/* Header */}
      {header && (
        <div className={styles.header}>
          {header}
        </div>
      )}

      {/* Main content area */}
      <div className={styles.content}>
        {/* Left pane - Agent Chat */}
        <div 
          className={styles.leftPane}
          style={{ width: leftWidth }}
        >
          {leftPane}
        </div>

        {/* Left resizer */}
        <Resizer onResize={handleLeftResize} direction="left" />

        {/* Center pane - Canvas */}
        <div className={styles.centerPane}>
          {centerPane}
        </div>

        {/* Right resizer */}
        <Resizer onResize={handleRightResize} direction="right" />

        {/* Right pane - Human Chat */}
        <div 
          className={styles.rightPane}
          style={{ width: rightWidth }}
        >
          {rightPane}
        </div>
      </div>

      {/* Footer */}
      {footer && (
        <div className={styles.footer}>
          {footer}
        </div>
      )}
    </div>
  );
}

export default ThreeFrameLayout;
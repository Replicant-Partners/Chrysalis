/**
 * Grid Canvas - React Grid Layout wrapper to prevent overlaps
 */

import React, { useState, useCallback } from 'react';
import { Grid, Maximize2 } from 'lucide-react';
import { Button } from '../design-system';
import styles from './GridCanvas.module.css';

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
  static?: boolean;
}

interface GridCanvasProps {
  children: React.ReactNode;
  gridSize?: number;
  allowOverlap?: boolean;
  onLayoutChange?: (layout: LayoutItem[]) => void;
}

type ArrangeAlgorithm = 'compact' | 'horizontal' | 'vertical' | 'masonry';

export const GridCanvas: React.FC<GridCanvasProps> = ({
  children,
  gridSize = 24,
  onLayoutChange,
}) => {
  const [layout, setLayout] = useState<LayoutItem[]>([]);
  const [showGrid, setShowGrid] = useState(false);

  const autoArrange = useCallback((algorithm: ArrangeAlgorithm) => {
    const arrangedLayout: LayoutItem[] = [...layout];
    
    switch (algorithm) {
      case 'compact':
        // Compact to top-left
        arrangedLayout.sort((a, b) => a.y - b.y || a.x - b.x);
        let currentY = 0;
        arrangedLayout.forEach((item) => {
          item.x = 0;
          item.y = currentY;
          currentY += item.h;
        });
        break;

      case 'horizontal':
        // Arrange in rows
        let x = 0;
        let y = 0;
        let maxHeight = 0;
        arrangedLayout.forEach((item) => {
          if (x + item.w > gridSize) {
            x = 0;
            y += maxHeight;
            maxHeight = 0;
          }
          item.x = x;
          item.y = y;
          x += item.w;
          maxHeight = Math.max(maxHeight, item.h);
        });
        break;

      case 'vertical':
        // Arrange in columns
        let colX = 0;
        let colY = 0;
        let maxWidth = 0;
        arrangedLayout.forEach((item) => {
          item.x = colX;
          item.y = colY;
          colY += item.h;
          maxWidth = Math.max(maxWidth, item.w);
          
          // Move to next column if too tall
          if (colY > 20) {
            colX += maxWidth;
            colY = 0;
            maxWidth = 0;
          }
        });
        break;

      case 'masonry':
        // Masonry layout (Pinterest-style)
        const columns: number[] = new Array(Math.floor(gridSize / 4)).fill(0);
        arrangedLayout.forEach((item) => {
          const minColIndex = columns.indexOf(Math.min(...columns));
          item.x = minColIndex * 4;
          item.y = columns[minColIndex];
          columns[minColIndex] += item.h;
        });
        break;
    }

    setLayout([...arrangedLayout]);
    onLayoutChange?.(arrangedLayout);
  }, [layout, gridSize, onLayoutChange]);

  return (
    <div className={styles.container}>
      {/* Grid Controls */}
      <div className={styles.controls}>
        <div className={styles.controlGroup}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowGrid(!showGrid)}
            iconBefore={<Grid size={16} />}
          >
            {showGrid ? 'Hide Grid' : 'Show Grid'}
          </Button>
          
          <div className={styles.divider} />
          
          <span className={styles.label}>Auto-Arrange:</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => autoArrange('compact')}
            title="Compact to top-left"
          >
            Compact
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => autoArrange('horizontal')}
            title="Arrange in rows"
          >
            Rows
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => autoArrange('vertical')}
            title="Arrange in columns"
          >
            Columns
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => autoArrange('masonry')}
            title="Masonry layout"
          >
            Masonry
          </Button>
        </div>

        <div className={styles.controlGroup}>
          <Button
            variant="ghost"
            size="sm"
            iconBefore={<Maximize2 size={16} />}
            title="Fit to screen"
          >
            Fit
          </Button>
        </div>
      </div>

      {/* Grid Layout */}
      <div className={`${styles.gridContainer} ${showGrid ? styles.showGrid : ''}`}>
        <div className={styles.layout}>
          <p className={styles.notice}>
            Grid layout integration ready. Actual grid functionality will be enabled once demo widgets are added.
          </p>
          {children}
        </div>
      </div>
    </div>
  );
};
/**
 * Canvas Tab Bar - Scrollable tab bar with context menu support
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { TabContextMenu } from '../CanvasNavigator/TabContextMenu';
import styles from './CanvasTabBar.module.css';

interface CanvasTab {
  id: string;
  title: string;
  type: string;
  isFixed: boolean;
  isVisible: boolean;
}

interface CanvasTabBarProps {
  canvases: CanvasTab[];
  activeCanvasId: string;
  onCanvasSelect: (canvasId: string) => void;
  onCanvasRename: (canvasId: string, newTitle: string) => void;
  onCanvasHide: (canvasId: string) => void;
  onCanvasClose: (canvasId: string) => void;
  onCanvasAdd: () => void;
  onCanvasDuplicate: (canvasId: string) => void;
  onCanvasTypeChange: (canvasId: string) => void;
}

export const CanvasTabBar: React.FC<CanvasTabBarProps> = ({
  canvases,
  activeCanvasId,
  onCanvasSelect,
  onCanvasRename,
  onCanvasHide,
  onCanvasClose,
  onCanvasAdd,
  onCanvasDuplicate,
  onCanvasTypeChange,
}) => {
  const [contextMenu, setContextMenu] = useState<{
    canvas: CanvasTab;
    position: { x: number; y: number };
  } | null>(null);
  const [renameCanvasId, setRenameCanvasId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const visibleCanvases = canvases.filter((c) => c.isVisible);

  const getCanvasIcon = (type: string): string => {
    const icons: Record<string, string> = {
      settings: '⚙️',
      board: '📋',
      scrapbook: '📔',
      research: '📚',
      wiki: '📖',
      terminal: '🖥️',
      browser: '🌐',
      scenarios: '🎯',
      curation: '📦',
      media: '🎬',
      storyboard: '🎬',
      remixer: '🎨',
    };
    return icons[type] || '📄';
  };

  const handleContextMenu = (e: React.MouseEvent, canvas: CanvasTab) => {
    e.preventDefault();
    setContextMenu({
      canvas,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  const handleRename = (canvas: CanvasTab) => {
    setRenameCanvasId(canvas.id);
    setRenameValue(canvas.title);
  };

  const handleRenameSubmit = () => {
    if (renameCanvasId && renameValue.trim()) {
      onCanvasRename(renameCanvasId, renameValue.trim());
    }
    setRenameCanvasId(null);
    setRenameValue('');
  };

  const handleRenameCancel = () => {
    setRenameCanvasId(null);
    setRenameValue('');
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 1);
    }
  };

  useEffect(() => {
    checkScroll();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      return () => {
        container.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [visibleCanvases]);

  return (
    <div className={styles.tabBar}>
      {showLeftArrow && (
        <button
          className={styles.scrollButton}
          onClick={() => scroll('left')}
        >
          <ChevronLeft size={16} />
        </button>
      )}

      <div className={styles.tabContainer} ref={scrollContainerRef}>
        <div className={styles.tabs}>
          {visibleCanvases.map((canvas) => (
            <div
              key={canvas.id}
              className={`${styles.tab} ${
                canvas.id === activeCanvasId ? styles.active : ''
              }`}
              onClick={() => onCanvasSelect(canvas.id)}
              onContextMenu={(e) => handleContextMenu(e, canvas)}
            >
              <span className={styles.tabIcon}>{getCanvasIcon(canvas.type)}</span>
              {renameCanvasId === canvas.id ? (
                <input
                  type="text"
                  className={styles.renameInput}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={handleRenameSubmit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameSubmit();
                    if (e.key === 'Escape') handleRenameCancel();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              ) : (
                <span className={styles.tabTitle}>{canvas.title}</span>
              )}
              {canvas.isFixed && (
                <span className={styles.pinnedIndicator}>📌</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {showRightArrow && (
        <button
          className={styles.scrollButton}
          onClick={() => scroll('right')}
        >
          <ChevronRight size={16} />
        </button>
      )}

      <button className={styles.addButton} onClick={onCanvasAdd}>
        <Plus size={16} />
      </button>

      {contextMenu && (
        <TabContextMenu
          canvas={contextMenu.canvas}
          onRename={() => handleRename(contextMenu.canvas)}
          onHide={() => onCanvasHide(contextMenu.canvas.id)}
          onClose={() => onCanvasClose(contextMenu.canvas.id)}
          onDuplicate={() => onCanvasDuplicate(contextMenu.canvas.id)}
          onChangeType={() => onCanvasTypeChange(contextMenu.canvas.id)}
          position={contextMenu.position}
          onCloseMenu={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};
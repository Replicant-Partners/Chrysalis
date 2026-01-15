/**
 * Hidden Canvas Drawer - Shows list of hidden canvases
 */

import React, { useState } from 'react';
import { Eye, X, EyeOff } from 'lucide-react';
import { Button } from '../design-system';
import styles from './HiddenCanvasDrawer.module.css';

interface HiddenCanvasDrawerProps {
  hiddenCanvases: Array<{
    id: string;
    title: string;
    type: string;
  }>;
  onCanvasShow: (canvasId: string) => void;
  onCanvasClose: (canvasId: string) => void;
}

export const HiddenCanvasDrawer: React.FC<HiddenCanvasDrawerProps> = ({
  hiddenCanvases,
  onCanvasShow,
  onCanvasClose,
}) => {
  const [isOpen, setIsOpen] = useState(false);

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

  if (hiddenCanvases.length === 0) return null;

  return (
    <div className={styles.container}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        iconBefore={<EyeOff size={16} />}
      >
        <span className={styles.badge}>{hiddenCanvases.length}</span>
      </Button>

      {isOpen && (
        <>
          <div className={styles.overlay} onClick={() => setIsOpen(false)} />
          <div className={styles.drawer}>
            <div className={styles.header}>
              <h3 className={styles.title}>
                Hidden Canvases ({hiddenCanvases.length})
              </h3>
              <button
                className={styles.closeButton}
                onClick={() => setIsOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className={styles.list}>
              {hiddenCanvases.map((canvas) => (
                <div key={canvas.id} className={styles.item}>
                  <span className={styles.icon}>{getCanvasIcon(canvas.type)}</span>
                  <span className={styles.itemTitle}>{canvas.title}</span>
                  <div className={styles.actions}>
                    <button
                      className={styles.actionButton}
                      onClick={() => {
                        onCanvasShow(canvas.id);
                        setIsOpen(false);
                      }}
                      title="Show"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      className={styles.actionButton}
                      onClick={() => onCanvasClose(canvas.id)}
                      title="Close"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.footer}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  hiddenCanvases.forEach((c) => onCanvasShow(c.id));
                  setIsOpen(false);
                }}
              >
                Show All
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
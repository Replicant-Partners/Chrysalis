/**
 * Tab Context Menu - Right-click menu for canvas tabs
 */

import React from 'react';
import { Edit, Eye, X, Copy, Palette } from 'lucide-react';
import styles from './TabContextMenu.module.css';

interface TabContextMenuProps {
  canvas: {
    id: string;
    title: string;
    isFixed: boolean;
  };
  onRename: () => void;
  onHide: () => void;
  onClose: () => void;
  onDuplicate: () => void;
  onChangeType: () => void;
  position: { x: number; y: number };
  onCloseMenu: () => void;
}

export const TabContextMenu: React.FC<TabContextMenuProps> = ({
  canvas,
  onRename,
  onHide,
  onClose,
  onDuplicate,
  onChangeType,
  position,
  onCloseMenu,
}) => {
  const handleAction = (action: () => void) => {
    action();
    onCloseMenu();
  };

  return (
    <>
      <div className={styles.overlay} onClick={onCloseMenu} />
      <div 
        className={styles.menu}
        style={{ 
          left: `${position.x}px`, 
          top: `${position.y}px` 
        }}
      >
        <button
          className={styles.menuItem}
          onClick={() => handleAction(onRename)}
          disabled={canvas.isFixed}
        >
          <Edit size={16} />
          <span>Rename Tab</span>
        </button>

        <button
          className={styles.menuItem}
          onClick={() => handleAction(onHide)}
          disabled={canvas.isFixed}
        >
          <Eye size={16} />
          <span>Hide Tab</span>
        </button>

        <button
          className={styles.menuItem}
          onClick={() => handleAction(onClose)}
          disabled={canvas.isFixed}
        >
          <X size={16} />
          <span>Close Tab</span>
        </button>

        <div className={styles.divider} />

        <button
          className={styles.menuItem}
          onClick={() => handleAction(onDuplicate)}
        >
          <Copy size={16} />
          <span>Duplicate Tab</span>
        </button>

        <button
          className={styles.menuItem}
          onClick={() => handleAction(onChangeType)}
          disabled={canvas.isFixed}
        >
          <Palette size={16} />
          <span>Change Type</span>
        </button>

        {canvas.isFixed && (
          <div className={styles.infoText}>
            Settings canvas is pinned
          </div>
        )}
      </div>
    </>
  );
};
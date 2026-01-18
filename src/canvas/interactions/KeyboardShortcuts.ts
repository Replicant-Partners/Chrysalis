/**
 * Keyboard Shortcuts Handler
 * 
 * Manages keyboard interactions for canvas navigation and editing.
 */

import type { Node, Edge } from 'reactflow';

export type ShortcutAction =
  | 'delete'
  | 'select-all'
  | 'deselect-all'
  | 'undo'
  | 'redo'
  | 'copy'
  | 'paste'
  | 'move-up'
  | 'move-down'
  | 'move-left'
  | 'move-right';

export interface ShortcutHandler {
  action: ShortcutAction;
  callback: () => void;
}

export class KeyboardShortcutsManager {
  private handlers: Map<ShortcutAction, () => void> = new Map();
  private isEnabled = true;

  constructor(
    private readonly element: HTMLElement | Window = window
  ) {
    this.element.addEventListener('keydown', this.handleKeyDown);
  }

  public registerHandler(action: ShortcutAction, callback: () => void): void {
    this.handlers.set(action, callback);
  }

  public unregisterHandler(action: ShortcutAction): void {
    this.handlers.delete(action);
  }

  public enable(): void {
    this.isEnabled = true;
  }

  public disable(): void {
    this.isEnabled = false;
  }

  public destroy(): void {
    this.element.removeEventListener('keydown', this.handleKeyDown);
    this.handlers.clear();
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.isEnabled) {
      return;
    }

    // Determine action from key combination
    let action: ShortcutAction | null = null;

    if (event.key === 'Delete' || event.key === 'Backspace') {
      action = 'delete';
    } else if (event.key === 'Escape') {
      action = 'deselect-all';
    } else if (event.key === 'a' && (event.ctrlKey || event.metaKey)) {
      action = 'select-all';
      event.preventDefault();
    } else if (event.key === 'z' && (event.ctrlKey || event.metaKey) && !event.shiftKey) {
      action = 'undo';
      event.preventDefault();
    } else if (
      (event.key === 'z' && (event.ctrlKey || event.metaKey) && event.shiftKey) ||
      (event.key === 'y' && (event.ctrlKey || event.metaKey))
    ) {
      action = 'redo';
      event.preventDefault();
    } else if (event.key === 'c' && (event.ctrlKey || event.metaKey)) {
      action = 'copy';
    } else if (event.key === 'v' && (event.ctrlKey || event.metaKey)) {
      action = 'paste';
    } else if (event.key === 'ArrowUp') {
      action = 'move-up';
    } else if (event.key === 'ArrowDown') {
      action = 'move-down';
    } else if (event.key === 'ArrowLeft') {
      action = 'move-left';
    } else if (event.key === 'ArrowRight') {
      action = 'move-right';
    }

    if (action) {
      const handler = this.handlers.get(action);
      if (handler) {
        handler();
      }
    }
  };
}

/**
 * Create default keyboard shortcuts for a canvas
 */
export function createDefaultShortcuts(
  selectedNodes: string[],
  onDeleteNodes: (ids: string[]) => void,
  onSelectAll: () => void,
  onDeselectAll: () => void,
  onMoveNodes: (direction: 'up' | 'down' | 'left' | 'right', distance: number) => void
): KeyboardShortcutsManager {
  const manager = new KeyboardShortcutsManager();

  manager.registerHandler('delete', () => {
    if (selectedNodes.length > 0) {
      onDeleteNodes(selectedNodes);
    }
  });

  manager.registerHandler('select-all', () => {
    onSelectAll();
  });

  manager.registerHandler('deselect-all', () => {
    onDeselectAll();
  });

  manager.registerHandler('move-up', () => {
    if (selectedNodes.length > 0) {
      onMoveNodes('up', 10);
    }
  });

  manager.registerHandler('move-down', () => {
    if (selectedNodes.length > 0) {
      onMoveNodes('down', 10);
    }
  });

  manager.registerHandler('move-left', () => {
    if (selectedNodes.length > 0) {
      onMoveNodes('left', 10);
    }
  });

  manager.registerHandler('move-right', () => {
    if (selectedNodes.length > 0) {
      onMoveNodes('right', 10);
    }
  });

  return manager;
}

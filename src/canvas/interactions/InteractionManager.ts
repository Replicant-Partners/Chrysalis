/**
 * Interaction Manager
 * 
 * Coordinates user interactions with the canvas including drag, select, and connect operations.
 */

import type { Node, Edge, XYPosition } from 'reactflow';

export interface InteractionState {
  isDragging: boolean;
  isSelecting: boolean;
  isConnecting: boolean;
  selectionBox: { start: XYPosition; end: XYPosition } | null;
  draggedNodes: string[];
}

export class InteractionManager {
  private state: InteractionState = {
    isDragging: false,
    isSelecting: false,
    isConnecting: false,
    selectionBox: null,
    draggedNodes: [],
  };

  private subscribers: Array<(state: InteractionState) => void> = [];

  public startDrag(nodeIds: string[]): void {
    this.state = {
      ...this.state,
      isDragging: true,
      draggedNodes: nodeIds,
    };
    this.notify();
  }

  public endDrag(): void {
    this.state = {
      ...this.state,
      isDragging: false,
      draggedNodes: [],
    };
    this.notify();
  }

  public startSelection(position: XYPosition): void  {
    this.state = {
      ...this.state,
      isSelecting: true,
      selectionBox: { start: position, end: position },
    };
    this.notify();
  }

  public updateSelection(position: XYPosition): void {
    if (this.state.selectionBox) {
      this.state = {
        ...this.state,
        selectionBox: {
          ...this.state.selectionBox,
          end: position,
        },
      };
      this.notify();
    }
  }

  public endSelection(): void {
    this.state = {
      ...this.state,
      isSelecting: false,
      selectionBox: null,
    };
    this.notify();
  }

  public getNodesInSelection(nodes: Node[]): Node[] {
    if (!this.state.selectionBox) {
      return [];
    }

    const { start, end } = this.state.selectionBox;
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);

    return nodes.filter((node) => {
      return (
        node.position.x >= minX &&
        node.position.x <= maxX &&
        node.position.y >= minY &&
        node.position.y <= maxY
      );
    });
  }

  public subscribe(callback: (state: InteractionState) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  public getState(): Readonly<InteractionState> {
    return this.state;
  }

  private notify(): void {
    this.subscribers.forEach((callback) => callback(this.state));
  }
}

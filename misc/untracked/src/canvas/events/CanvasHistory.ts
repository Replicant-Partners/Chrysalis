/**
 * Canvas History Manager
 * Undo/redo functionality
 */

import type { Node, Edge } from 'reactflow';

export interface HistoryState<TNode extends Node, TEdge extends Edge> {
  nodes: TNode[];
  edges: TEdge[];
  timestamp: number;
}

export class CanvasHistory<TNode extends Node, TEdge extends Edge> {
  private past: HistoryState<TNode, TEdge>[] = [];
  private future: HistoryState<TNode, TEdge>[] = [];
  private current: HistoryState<TNode, TEdge> | null = null;
  private maxHistorySize: number;

  constructor(maxHistorySize = 50) {
    this.maxHistorySize = maxHistorySize;
  }

  public record(nodes: TNode[], edges: TEdge[]): void {
    if (this.current) {
      this.past.push(this.current);
      if (this.past.length > this.maxHistorySize) {
        this.past.shift();
      }
    }

    this.current = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      timestamp: Date.now(),
    };

    this.future = [];
  }

  public undo(): HistoryState<TNode, TEdge> | null {
    if (this.past.length === 0 || !this.current) {
      return null;
    }

    this.future.unshift(this.current);
    this.current = this.past.pop()!;
    return this.current;
  }

  public redo(): HistoryState<TNode, TEdge> | null {
    if (this.future.length === 0 || !this.current) {
      return null;
    }

    this.past.push(this.current);
    this.current = this.future.shift()!;
    return this.current;
  }

  public canUndo(): boolean {
    return this.past.length > 0;
  }

  public canRedo(): boolean {
    return this.future.length > 0;
  }

  public clear(): void {
    this.past = [];
    this.future = [];
    this.current = null;
  }
}

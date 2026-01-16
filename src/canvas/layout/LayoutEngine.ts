/**
 * Layout Engine
 *
 * Manages spatial layout for canvas nodes:
 * - Infinite scroll with virtualization
 * - Snap-to-grid positioning
 * - Collision detection and resolution
 * - Auto-arrangement algorithms
 */

import { EventEmitter } from 'events';
import type { Position, Dimensions, CanvasNode } from '../core/types';
import {
  LayoutEngineConfig,
  ViewportBounds,
  CollisionResult,
  CollisionStrategy,
  ArrangementAlgorithm,
  ArrangementOptions,
  ArrangementResult,
  LayoutEvent,
  LayoutEventType,
  DEFAULT_LAYOUT_ENGINE_CONFIG,
} from './types';

// =============================================================================
// Layout Engine
// =============================================================================

export class LayoutEngine {
  private config: LayoutEngineConfig;
  private emitter = new EventEmitter();

  constructor(config?: Partial<LayoutEngineConfig>) {
    this.config = { ...DEFAULT_LAYOUT_ENGINE_CONFIG, ...config };
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  getConfig(): LayoutEngineConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<LayoutEngineConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  // ===========================================================================
  // Grid Snapping
  // ===========================================================================

  /**
   * Snap a position to the grid.
   */
  snapToGrid(position: Position): Position {
    if (!this.config.grid.enabled || !this.config.grid.snapOnMove) {
      return position;
    }

    const cellSize = this.config.grid.cellSize;
    return {
      x: Math.round(position.x / cellSize) * cellSize,
      y: Math.round(position.y / cellSize) * cellSize,
    };
  }

  /**
   * Snap dimensions to the grid.
   */
  snapDimensionsToGrid(dimensions: Dimensions): Dimensions {
    if (!this.config.grid.enabled || !this.config.grid.snapOnResize) {
      return dimensions;
    }

    const cellSize = this.config.grid.cellSize;
    return {
      width: Math.max(
        this.config.minNodeSize.width,
        Math.round(dimensions.width / cellSize) * cellSize
      ),
      height: Math.max(
        this.config.minNodeSize.height,
        Math.round(dimensions.height / cellSize) * cellSize
      ),
    };
  }

  /**
   * Get the nearest grid point to a position.
   */
  getNearestGridPoint(position: Position): Position {
    const cellSize = this.config.grid.cellSize;
    return {
      x: Math.round(position.x / cellSize) * cellSize,
      y: Math.round(position.y / cellSize) * cellSize,
    };
  }

  // ===========================================================================
  // Collision Detection
  // ===========================================================================

  /**
   * Check if a node collides with any other nodes.
   */
  detectCollisions(
    node: CanvasNode,
    allNodes: CanvasNode[],
    excludeIds: string[] = []
  ): CollisionResult {
    if (this.config.collision.strategy === 'none') {
      return { hasCollision: false, collidingNodeIds: [] };
    }

    const nodeBounds = this.getNodeBounds(node);
    const padding = this.config.collision.padding;
    const collidingNodeIds: string[] = [];

    for (const other of allNodes) {
      if (other.id === node.id || excludeIds.includes(other.id)) {
        continue;
      }

      const otherBounds = this.getNodeBounds(other);

      // Add padding to bounds
      const expandedBounds = {
        left: nodeBounds.left - padding,
        top: nodeBounds.top - padding,
        right: nodeBounds.right + padding,
        bottom: nodeBounds.bottom + padding,
      };

      if (this.boundsIntersect(expandedBounds, otherBounds)) {
        collidingNodeIds.push(other.id);
      }
    }

    const result: CollisionResult = {
      hasCollision: collidingNodeIds.length > 0,
      collidingNodeIds,
    };

    // Calculate suggested position if there's a collision
    if (result.hasCollision) {
      result.suggestedPosition = this.findNonCollidingPosition(
        node,
        allNodes,
        excludeIds
      );
    }

    if (result.hasCollision) {
      this.emit('collision:detected', { nodeId: node.id, collidingNodeIds });
    }

    return result;
  }

  /**
   * Find a position for a node that doesn't collide with others.
   */
  findNonCollidingPosition(
    node: CanvasNode,
    allNodes: CanvasNode[],
    excludeIds: string[] = []
  ): Position {
    const cellSize = this.config.grid.cellSize;
    const padding = this.config.collision.padding;
    let position = { ...node.position };
    let attempts = 0;
    const maxAttempts = 100;

    // Try positions in a spiral pattern
    const directions = [
      { dx: 1, dy: 0 },   // right
      { dx: 0, dy: 1 },   // down
      { dx: -1, dy: 0 },  // left
      { dx: 0, dy: -1 },  // up
    ];
    let dirIndex = 0;
    let stepSize = 1;
    let stepsInCurrentDirection = 0;
    let stepsTaken = 0;

    while (attempts < maxAttempts) {
      const testNode = { ...node, position };
      const collision = this.detectCollisionsRaw(testNode, allNodes, [...excludeIds, node.id]);

      if (!collision) {
        return this.config.grid.snapOnMove ? this.snapToGrid(position) : position;
      }

      // Move in spiral pattern
      const dir = directions[dirIndex];
      position = {
        x: position.x + dir.dx * cellSize,
        y: position.y + dir.dy * cellSize,
      };

      stepsInCurrentDirection++;
      stepsTaken++;

      // Change direction
      if (stepsInCurrentDirection >= stepSize) {
        stepsInCurrentDirection = 0;
        dirIndex = (dirIndex + 1) % 4;

        // Increase step size every two direction changes
        if (dirIndex === 0 || dirIndex === 2) {
          stepSize++;
        }
      }

      attempts++;
    }

    // Fallback: place below all existing nodes
    let maxY = 0;
    allNodes.forEach(n => {
      const bottom = n.position.y + (n.height ?? 100);
      if (bottom > maxY) maxY = bottom;
    });

    return this.snapToGrid({ x: node.position.x, y: maxY + padding });
  }

  /**
   * Resolve collisions based on configured strategy.
   */
  resolveCollisions(
    node: CanvasNode,
    allNodes: CanvasNode[]
  ): Map<string, Position> {
    const newPositions = new Map<string, Position>();
    const collision = this.detectCollisions(node, allNodes);

    if (!collision.hasCollision) {
      return newPositions;
    }

    switch (this.config.collision.strategy) {
      case 'prevent':
        // Don't move anything - caller should reject the move
        break;

      case 'push':
        // Push colliding nodes away
        this.resolvePush(node, collision.collidingNodeIds, allNodes, newPositions);
        break;

      case 'swap':
        // Swap with first colliding node
        if (collision.collidingNodeIds.length > 0) {
          const otherNode = allNodes.find(n => n.id === collision.collidingNodeIds[0]);
          if (otherNode) {
            newPositions.set(node.id, otherNode.position);
            newPositions.set(otherNode.id, node.position);
          }
        }
        break;

      case 'stack':
        // Stack vertically
        if (collision.suggestedPosition) {
          newPositions.set(node.id, collision.suggestedPosition);
        }
        break;
    }

    if (newPositions.size > 0) {
      this.emit('collision:resolved', {
        nodeId: node.id,
        strategy: this.config.collision.strategy,
        movedNodes: Array.from(newPositions.keys()),
      });
    }

    return newPositions;
  }

  private resolvePush(
    pusher: CanvasNode,
    collidingIds: string[],
    allNodes: CanvasNode[],
    newPositions: Map<string, Position>
  ): void {
    const pusherBounds = this.getNodeBounds(pusher);
    const padding = this.config.collision.padding;

    for (const collidingId of collidingIds) {
      const other = allNodes.find(n => n.id === collidingId);
      if (!other) continue;

      const otherBounds = this.getNodeBounds(other);

      // Calculate push direction based on relative positions
      const dx = (otherBounds.left + otherBounds.right) / 2 -
                 (pusherBounds.left + pusherBounds.right) / 2;
      const dy = (otherBounds.top + otherBounds.bottom) / 2 -
                 (pusherBounds.top + pusherBounds.bottom) / 2;

      // Push in the dominant direction
      let newPos: Position;
      if (Math.abs(dx) > Math.abs(dy)) {
        // Push horizontally
        if (dx > 0) {
          newPos = { x: pusherBounds.right + padding, y: other.position.y };
        } else {
          newPos = { x: pusherBounds.left - (other.width ?? 100) - padding, y: other.position.y };
        }
      } else {
        // Push vertically
        if (dy > 0) {
          newPos = { x: other.position.x, y: pusherBounds.bottom + padding };
        } else {
          newPos = { x: other.position.x, y: pusherBounds.top - (other.height ?? 100) - padding };
        }
      }

      newPositions.set(collidingId, this.snapToGrid(newPos));
    }
  }

  private detectCollisionsRaw(
    node: CanvasNode,
    allNodes: CanvasNode[],
    excludeIds: string[]
  ): boolean {
    const nodeBounds = this.getNodeBounds(node);
    const padding = this.config.collision.padding;

    for (const other of allNodes) {
      if (other.id === node.id || excludeIds.includes(other.id)) {
        continue;
      }

      const otherBounds = this.getNodeBounds(other);
      const expandedBounds = {
        left: nodeBounds.left - padding,
        top: nodeBounds.top - padding,
        right: nodeBounds.right + padding,
        bottom: nodeBounds.bottom + padding,
      };

      if (this.boundsIntersect(expandedBounds, otherBounds)) {
        return true;
      }
    }

    return false;
  }

  // ===========================================================================
  // Auto-Arrangement
  // ===========================================================================

  /**
   * Arrange nodes according to the specified algorithm.
   */
  arrange(
    nodes: CanvasNode[],
    options?: Partial<ArrangementOptions>
  ): ArrangementResult {
    const opts = { ...this.config.defaultArrangement, ...options };

    this.emit('arrangement:started', { algorithm: opts.algorithm, nodeCount: nodes.length });

    let result: ArrangementResult;

    switch (opts.algorithm) {
      case 'grid':
        result = this.arrangeGrid(nodes, opts);
        break;
      case 'horizontal':
        result = this.arrangeHorizontal(nodes, opts);
        break;
      case 'vertical':
        result = this.arrangeVertical(nodes, opts);
        break;
      case 'compact':
        result = this.arrangeCompact(nodes, opts);
        break;
      default:
        // Default to grid for unsupported algorithms
        result = this.arrangeGrid(nodes, opts);
    }

    this.emit('arrangement:completed', {
      algorithm: opts.algorithm,
      movedNodes: result.positions.size,
      bounds: result.bounds,
    });

    return result;
  }

  private arrangeGrid(nodes: CanvasNode[], opts: ArrangementOptions): ArrangementResult {
    const positions = new Map<string, Position>();
    const gap = opts.gap;
    const maxWidth = opts.maxWidth ?? 1000;

    let x = opts.startPosition.x;
    let y = opts.startPosition.y;
    let rowHeight = 0;
    let minX = x, maxX = x, minY = y, maxY = y;

    for (const node of nodes) {
      const width = node.width ?? 200;
      const height = node.height ?? 100;

      // Check if we need to wrap to next row
      if (x + width > opts.startPosition.x + maxWidth && x !== opts.startPosition.x) {
        x = opts.startPosition.x;
        y += rowHeight + gap;
        rowHeight = 0;
      }

      positions.set(node.id, this.snapToGrid({ x, y }));

      // Update bounds tracking
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);

      // Move to next position
      x += width + gap;
      rowHeight = Math.max(rowHeight, height);
    }

    return {
      positions,
      bounds: {
        position: { x: minX, y: minY },
        dimensions: { width: maxX - minX, height: maxY - minY },
      },
      skippedNodeIds: [],
    };
  }

  private arrangeHorizontal(nodes: CanvasNode[], opts: ArrangementOptions): ArrangementResult {
    const positions = new Map<string, Position>();
    let x = opts.startPosition.x;
    const y = opts.startPosition.y;
    let maxHeight = 0;

    for (const node of nodes) {
      const width = node.width ?? 200;
      const height = node.height ?? 100;

      positions.set(node.id, this.snapToGrid({ x, y }));
      x += width + opts.gap;
      maxHeight = Math.max(maxHeight, height);
    }

    return {
      positions,
      bounds: {
        position: opts.startPosition,
        dimensions: { width: x - opts.startPosition.x - opts.gap, height: maxHeight },
      },
      skippedNodeIds: [],
    };
  }

  private arrangeVertical(nodes: CanvasNode[], opts: ArrangementOptions): ArrangementResult {
    const positions = new Map<string, Position>();
    const x = opts.startPosition.x;
    let y = opts.startPosition.y;
    let maxWidth = 0;

    for (const node of nodes) {
      const width = node.width ?? 200;
      const height = node.height ?? 100;

      positions.set(node.id, this.snapToGrid({ x, y }));
      y += height + opts.gap;
      maxWidth = Math.max(maxWidth, width);
    }

    return {
      positions,
      bounds: {
        position: opts.startPosition,
        dimensions: { width: maxWidth, height: y - opts.startPosition.y - opts.gap },
      },
      skippedNodeIds: [],
    };
  }

  private arrangeCompact(nodes: CanvasNode[], opts: ArrangementOptions): ArrangementResult {
    // Sort nodes by position (top-left first)
    const sorted = [...nodes].sort((a, b) => {
      const ay = a.position.y;
      const by = b.position.y;
      if (Math.abs(ay - by) > 50) return ay - by;
      return a.position.x - b.position.x;
    });

    return this.arrangeGrid(sorted, opts);
  }

  // ===========================================================================
  // Viewport & Virtualization
  // ===========================================================================

  /**
   * Get the viewport bounds in canvas coordinates.
   */
  calculateViewportBounds(
    containerWidth: number,
    containerHeight: number,
    panX: number,
    panY: number,
    zoom: number
  ): ViewportBounds {
    const width = containerWidth / zoom;
    const height = containerHeight / zoom;

    return {
      left: -panX / zoom,
      top: -panY / zoom,
      right: -panX / zoom + width,
      bottom: -panY / zoom + height,
      width,
      height,
      zoom,
    };
  }

  /**
   * Get nodes that are visible in the viewport (for virtualization).
   */
  getVisibleNodes(nodes: CanvasNode[], viewport: ViewportBounds): CanvasNode[] {
    const buffer = this.config.virtualizationBuffer;
    const expandedViewport = {
      left: viewport.left - buffer,
      top: viewport.top - buffer,
      right: viewport.right + buffer,
      bottom: viewport.bottom + buffer,
    };

    return nodes.filter(node => {
      const bounds = this.getNodeBounds(node);
      return this.boundsIntersect(bounds, expandedViewport);
    });
  }

  /**
   * Check if a node is visible in the viewport.
   */
  isNodeVisible(node: CanvasNode, viewport: ViewportBounds): boolean {
    const bounds = this.getNodeBounds(node);
    return this.boundsIntersect(bounds, viewport);
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  private getNodeBounds(node: CanvasNode): { left: number; top: number; right: number; bottom: number } {
    const width = node.width ?? 200;
    const height = node.height ?? 100;
    return {
      left: node.position.x,
      top: node.position.y,
      right: node.position.x + width,
      bottom: node.position.y + height,
    };
  }

  private boundsIntersect(
    a: { left: number; top: number; right: number; bottom: number },
    b: { left: number; top: number; right: number; bottom: number }
  ): boolean {
    return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
  }

  /**
   * Clamp dimensions to min/max.
   */
  clampDimensions(dimensions: Dimensions): Dimensions {
    return {
      width: Math.max(
        this.config.minNodeSize.width,
        Math.min(this.config.maxNodeSize.width, dimensions.width)
      ),
      height: Math.max(
        this.config.minNodeSize.height,
        Math.min(this.config.maxNodeSize.height, dimensions.height)
      ),
    };
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  on(event: LayoutEventType, handler: (e: LayoutEvent) => void): void {
    this.emitter.on(event, handler);
  }

  off(event: LayoutEventType, handler: (e: LayoutEvent) => void): void {
    this.emitter.off(event, handler);
  }

  private emit<T>(type: LayoutEventType, payload: T): void {
    const event: LayoutEvent<T> = {
      type,
      timestamp: Date.now(),
      payload,
    };
    this.emitter.emit(type, event);
  }
}

// =============================================================================
// Singleton
// =============================================================================

let globalEngine: LayoutEngine | null = null;

export function getLayoutEngine(): LayoutEngine {
  if (!globalEngine) {
    globalEngine = new LayoutEngine();
  }
  return globalEngine;
}

export function createLayoutEngine(config?: Partial<LayoutEngineConfig>): LayoutEngine {
  return new LayoutEngine(config);
}

export function resetLayoutEngine(): void {
  globalEngine = null;
}

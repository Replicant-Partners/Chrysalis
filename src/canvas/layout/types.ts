/**
 * Layout Engine Types
 *
 * Defines the spatial layout system:
 * - Infinite scroll configuration
 * - Grid snapping
 * - Collision detection
 * - Auto-arrangement strategies
 */

import type { Position, Dimensions, Bounds, CanvasNode } from '../core/types';

// =============================================================================
// Viewport & Scroll
// =============================================================================

/**
 * Infinite scroll configuration.
 */
export interface InfiniteScrollConfig {
  /** Enable horizontal infinite scroll */
  horizontal: boolean;

  /** Enable vertical infinite scroll */
  vertical: boolean;

  /** Scroll speed multiplier */
  scrollSpeed: number;

  /** Inertia after releasing scroll (0 = none, 1 = full) */
  inertia: number;

  /** Edge scroll zone size in pixels (for drag-near-edge scrolling) */
  edgeScrollZone: number;

  /** Edge scroll speed in pixels per frame */
  edgeScrollSpeed: number;
}

export const DEFAULT_SCROLL_CONFIG: InfiniteScrollConfig = {
  horizontal: true,
  vertical: true,
  scrollSpeed: 1,
  inertia: 0.95,
  edgeScrollZone: 50,
  edgeScrollSpeed: 10,
};

/**
 * Viewport bounds - the visible region of the infinite canvas.
 */
export interface ViewportBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  zoom: number;
}

// =============================================================================
// Grid Configuration
// =============================================================================

/**
 * Enhanced grid configuration for layout engine.
 */
export interface LayoutGridConfig {
  /** Grid is active */
  enabled: boolean;

  /** Grid cell size in pixels */
  cellSize: number;

  /** Snap nodes to grid when moving */
  snapOnMove: boolean;

  /** Snap nodes to grid when resizing */
  snapOnResize: boolean;

  /** Show grid lines */
  showGrid: boolean;

  /** Show grid dots instead of lines */
  dotGrid: boolean;

  /** Grid line/dot color */
  gridColor: string;

  /** Major grid line interval (every Nth line is darker) */
  majorLineInterval: number;

  /** Major line color */
  majorLineColor: string;
}

export const DEFAULT_LAYOUT_GRID: LayoutGridConfig = {
  enabled: true,
  cellSize: 20,
  snapOnMove: true,
  snapOnResize: true,
  showGrid: true,
  dotGrid: false,
  gridColor: '#2a2a3a',
  majorLineInterval: 5,
  majorLineColor: '#3a3a4a',
};

// =============================================================================
// Collision Detection
// =============================================================================

/**
 * Collision detection strategy.
 */
export type CollisionStrategy =
  | 'none'          // Allow overlaps
  | 'prevent'       // Block the move/resize that causes overlap
  | 'push'          // Push overlapping nodes away
  | 'swap'          // Swap positions with overlapped node
  | 'stack';        // Stack vertically with offset

/**
 * Collision detection configuration.
 */
export interface CollisionConfig {
  /** Detection strategy */
  strategy: CollisionStrategy;

  /** Padding between nodes (minimum gap) */
  padding: number;

  /** Check collisions during drag (can be expensive) */
  checkDuringDrag: boolean;

  /** Highlight collisions during drag */
  highlightCollisions: boolean;

  /** Collision highlight color */
  collisionHighlightColor: string;
}

export const DEFAULT_COLLISION_CONFIG: CollisionConfig = {
  strategy: 'push',
  padding: 10,
  checkDuringDrag: true,
  highlightCollisions: true,
  collisionHighlightColor: 'rgba(255, 100, 100, 0.3)',
};

/**
 * Result of collision detection.
 */
export interface CollisionResult {
  hasCollision: boolean;
  collidingNodeIds: string[];
  suggestedPosition?: Position;
}

// =============================================================================
// Auto-Arrangement
// =============================================================================

/**
 * Auto-arrangement algorithm.
 */
export type ArrangementAlgorithm =
  | 'grid'          // Arrange in a grid pattern
  | 'horizontal'    // Arrange in horizontal rows
  | 'vertical'      // Arrange in vertical columns
  | 'radial'        // Arrange in a circle/radial pattern
  | 'tree'          // Arrange as a tree (based on edges)
  | 'force'         // Force-directed layout
  | 'compact';      // Compact to remove gaps

/**
 * Auto-arrangement options.
 */
export interface ArrangementOptions {
  algorithm: ArrangementAlgorithm;

  /** Starting position for arrangement */
  startPosition: Position;

  /** Gap between nodes */
  gap: number;

  /** Maximum width before wrapping (for grid/horizontal) */
  maxWidth?: number;

  /** Maximum height before wrapping (for vertical) */
  maxHeight?: number;

  /** Animate the arrangement */
  animate: boolean;

  /** Animation duration in ms */
  animationDuration: number;

  /** Only arrange selected nodes */
  selectedOnly: boolean;

  /** Respect existing groups (don't separate grouped nodes) */
  respectGroups: boolean;
}

export const DEFAULT_ARRANGEMENT_OPTIONS: ArrangementOptions = {
  algorithm: 'grid',
  startPosition: { x: 0, y: 0 },
  gap: 20,
  animate: true,
  animationDuration: 300,
  selectedOnly: false,
  respectGroups: true,
};

/**
 * Result of auto-arrangement.
 */
export interface ArrangementResult {
  /** New positions for each node */
  positions: Map<string, Position>;

  /** Bounding box of arranged nodes */
  bounds: Bounds;

  /** Nodes that couldn't be arranged */
  skippedNodeIds: string[];
}

// =============================================================================
// Layout Engine Configuration
// =============================================================================

export interface LayoutEngineConfig {
  scroll: InfiniteScrollConfig;
  grid: LayoutGridConfig;
  collision: CollisionConfig;
  defaultArrangement: ArrangementOptions;

  /** Virtualization buffer (extra nodes to render outside viewport) */
  virtualizationBuffer: number;

  /** Minimum node size */
  minNodeSize: Dimensions;

  /** Maximum node size */
  maxNodeSize: Dimensions;
}

export const DEFAULT_LAYOUT_ENGINE_CONFIG: LayoutEngineConfig = {
  scroll: DEFAULT_SCROLL_CONFIG,
  grid: DEFAULT_LAYOUT_GRID,
  collision: DEFAULT_COLLISION_CONFIG,
  defaultArrangement: DEFAULT_ARRANGEMENT_OPTIONS,
  virtualizationBuffer: 200,
  minNodeSize: { width: 50, height: 30 },
  maxNodeSize: { width: 2000, height: 2000 },
};

// =============================================================================
// Layout Events
// =============================================================================

export type LayoutEventType =
  | 'viewport:scrolled'
  | 'viewport:zoomed'
  | 'node:snapped'
  | 'collision:detected'
  | 'collision:resolved'
  | 'arrangement:started'
  | 'arrangement:completed';

export interface LayoutEvent<T = unknown> {
  type: LayoutEventType;
  timestamp: number;
  payload: T;
}

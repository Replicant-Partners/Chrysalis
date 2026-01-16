/**
 * BaseCanvas
 *
 * Abstract base class for all canvas types. Provides:
 * - Lifecycle management (init, mount, unmount, save, restore)
 * - State management (nodes, edges, viewport, selection)
 * - Event propagation
 * - Grid and snap-to-grid
 * - Collision detection hooks
 *
 * Subclasses: SettingsCanvas, BoardCanvas, ScrapbookCanvas, ResearchCanvas, TerminalBrowserCanvas
 */

import { EventEmitter } from 'events';
import {
  CanvasKind,
  CanvasId,
  CanvasMeta,
  CanvasState,
  CanvasConfig,
  CanvasNode,
  CanvasEdge,
  Viewport,
  Position,
  Dimensions,
  GridConfig,
  CanvasLifecyclePhase,
  CanvasEvent,
  CanvasEventType,
  NodeAddedPayload,
  NodeRemovedPayload,
  NodeMovedPayload,
  ViewportChangedPayload,
  SelectionChangedPayload,
  DEFAULT_CANVAS_CONFIG,
  DEFAULT_GRID_CONFIG,
  BaseNodeData,
} from './types';

// =============================================================================
// Canvas Event Emitter Interface
// =============================================================================

export interface CanvasEventEmitter {
  on<T>(event: CanvasEventType, handler: (e: CanvasEvent<T>) => void): void;
  off<T>(event: CanvasEventType, handler: (e: CanvasEvent<T>) => void): void;
  emit<T>(event: CanvasEventType, payload: T): void;
}

// =============================================================================
// Abstract Base Canvas
// =============================================================================

export abstract class BaseCanvas implements CanvasEventEmitter {
  protected readonly id: CanvasId;
  protected readonly kind: CanvasKind;
  protected config: CanvasConfig;

  protected nodes: Map<string, CanvasNode> = new Map();
  protected edges: Map<string, CanvasEdge> = new Map();
  protected viewport: Viewport = { x: 0, y: 0, zoom: 1 };
  protected selection: { nodeIds: Set<string>; edgeIds: Set<string> } = {
    nodeIds: new Set(),
    edgeIds: new Set(),
  };

  protected lifecyclePhase: CanvasLifecyclePhase = 'initializing';
  protected meta: CanvasMeta;

  private emitter = new EventEmitter();
  private autoSaveTimer?: NodeJS.Timeout;

  constructor(id: CanvasId, kind: CanvasKind, config?: Partial<CanvasConfig>) {
    this.id = id;
    this.kind = kind;
    this.config = { ...DEFAULT_CANVAS_CONFIG, ...config, kind };

    this.meta = {
      id,
      kind,
      title: `New ${kind} Canvas`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };
  }

  // ===========================================================================
  // Lifecycle Methods
  // ===========================================================================

  /**
   * Initialize the canvas. Called once when canvas is created.
   * Subclasses should call super.init() and then set up their specific state.
   */
  async init(): Promise<void> {
    this.setLifecyclePhase('initializing');
    await this.onInit();
    this.setLifecyclePhase('ready');
  }

  /**
   * Mount the canvas for display. Called when canvas becomes visible.
   */
  async mount(): Promise<void> {
    this.setLifecyclePhase('active');
    await this.onMount();
    this.startAutoSave();
  }

  /**
   * Unmount the canvas from display. Called when canvas is hidden but kept alive.
   */
  async unmount(): Promise<void> {
    this.stopAutoSave();
    await this.onUnmount();
    this.setLifecyclePhase('background');
  }

  /**
   * Save canvas state. Returns serializable state for persistence.
   */
  async save(): Promise<CanvasState> {
    this.setLifecyclePhase('saving');
    const state = await this.onSave();
    this.emitEvent('state:saved', { state });
    this.setLifecyclePhase(this.lifecyclePhase === 'saving' ? 'active' : this.lifecyclePhase);
    return state;
  }

  /**
   * Restore canvas from saved state.
   */
  async restore(state: CanvasState): Promise<void> {
    this.setLifecyclePhase('restoring');
    await this.onRestore(state);
    this.emitEvent('state:restored', { state });
    this.setLifecyclePhase('ready');
  }

  /**
   * Destroy the canvas. Called when canvas is permanently removed.
   */
  async destroy(): Promise<void> {
    this.setLifecyclePhase('destroying');
    this.stopAutoSave();
    await this.onDestroy();
    this.emitter.removeAllListeners();
    this.nodes.clear();
    this.edges.clear();
  }

  // ===========================================================================
  // Lifecycle Hooks (Override in subclasses)
  // ===========================================================================

  protected async onInit(): Promise<void> {
    // Override in subclass
  }

  protected async onMount(): Promise<void> {
    // Override in subclass
  }

  protected async onUnmount(): Promise<void> {
    // Override in subclass
  }

  protected async onSave(): Promise<CanvasState> {
    return this.getState();
  }

  protected async onRestore(state: CanvasState): Promise<void> {
    this.meta = state.meta;
    this.nodes.clear();
    state.nodes.forEach(n => this.nodes.set(n.id, n));
    this.edges.clear();
    state.edges.forEach(e => this.edges.set(e.id, e));
    this.viewport = state.viewport;
    this.selection = {
      nodeIds: new Set(state.selection.nodeIds),
      edgeIds: new Set(state.selection.edgeIds),
    };
    this.config.grid = state.grid;
  }

  protected async onDestroy(): Promise<void> {
    // Override in subclass
  }

  // ===========================================================================
  // State Access
  // ===========================================================================

  getId(): CanvasId {
    return this.id;
  }

  getKind(): CanvasKind {
    return this.kind;
  }

  getConfig(): CanvasConfig {
    return { ...this.config };
  }

  getMeta(): CanvasMeta {
    return { ...this.meta };
  }

  getLifecyclePhase(): CanvasLifecyclePhase {
    return this.lifecyclePhase;
  }

  getState(): CanvasState {
    return {
      meta: { ...this.meta },
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
      viewport: { ...this.viewport },
      selection: {
        nodeIds: Array.from(this.selection.nodeIds),
        edgeIds: Array.from(this.selection.edgeIds),
      },
      grid: { ...this.config.grid },
    };
  }

  getNodes(): CanvasNode[] {
    return Array.from(this.nodes.values());
  }

  getNode(id: string): CanvasNode | undefined {
    return this.nodes.get(id);
  }

  getEdges(): CanvasEdge[] {
    return Array.from(this.edges.values());
  }

  getEdge(id: string): CanvasEdge | undefined {
    return this.edges.get(id);
  }

  getViewport(): Viewport {
    return { ...this.viewport };
  }

  getSelection(): { nodeIds: string[]; edgeIds: string[] } {
    return {
      nodeIds: Array.from(this.selection.nodeIds),
      edgeIds: Array.from(this.selection.edgeIds),
    };
  }

  // ===========================================================================
  // Node Operations
  // ===========================================================================

  addNode<T extends BaseNodeData>(node: CanvasNode<T>, source: 'user' | 'api' | 'restore' = 'api'): CanvasNode<T> {
    // Snap to grid if enabled
    if (this.config.grid.snapToGrid) {
      node = {
        ...node,
        position: this.snapToGrid(node.position),
      };
    }

    // Check for overlap and reposition if needed
    if (!this.config.allowNodeOverlap && this.config.autoArrangeOnOverlap) {
      node = {
        ...node,
        position: this.findNonOverlappingPosition(node),
      };
    }

    this.nodes.set(node.id, node);
    this.meta.updatedAt = Date.now();

    this.emitEvent('node:added', { node, source } as NodeAddedPayload);
    return node;
  }

  removeNode(nodeId: string): CanvasNode | undefined {
    const node = this.nodes.get(nodeId);
    if (!node) return undefined;

    this.nodes.delete(nodeId);
    this.selection.nodeIds.delete(nodeId);

    // Remove connected edges
    const connectedEdges = this.getEdgesForNode(nodeId);
    connectedEdges.forEach(e => this.removeEdge(e.id));

    this.meta.updatedAt = Date.now();
    this.emitEvent('node:removed', { nodeId, node } as NodeRemovedPayload);
    return node;
  }

  moveNode(nodeId: string, to: Position): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    const from = node.position;
    let newPosition = to;

    // Snap to grid if enabled
    if (this.config.grid.snapToGrid) {
      newPosition = this.snapToGrid(to);
    }

    this.nodes.set(nodeId, { ...node, position: newPosition });
    this.meta.updatedAt = Date.now();

    this.emitEvent('node:moved', { nodeId, from, to: newPosition } as NodeMovedPayload);
    return true;
  }

  resizeNode(nodeId: string, dimensions: Dimensions): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    const from = { width: node.width ?? 0, height: node.height ?? 0 };
    this.nodes.set(nodeId, { ...node, ...dimensions });
    this.meta.updatedAt = Date.now();

    this.emitEvent('node:resized', { nodeId, from, to: dimensions });
    return true;
  }

  updateNodeData<T extends BaseNodeData>(nodeId: string, data: Partial<T>): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    this.nodes.set(nodeId, {
      ...node,
      data: { ...node.data, ...data } as T
    });
    this.meta.updatedAt = Date.now();

    this.emitEvent('node:data-changed', { nodeId, data });
    return true;
  }

  // ===========================================================================
  // Edge Operations
  // ===========================================================================

  addEdge(edge: CanvasEdge): CanvasEdge {
    this.edges.set(edge.id, edge);
    this.meta.updatedAt = Date.now();

    this.emitEvent('edge:connected', { edge });
    return edge;
  }

  removeEdge(edgeId: string): CanvasEdge | undefined {
    const edge = this.edges.get(edgeId);
    if (!edge) return undefined;

    this.edges.delete(edgeId);
    this.selection.edgeIds.delete(edgeId);
    this.meta.updatedAt = Date.now();

    this.emitEvent('edge:disconnected', { edgeId, edge });
    return edge;
  }

  getEdgesForNode(nodeId: string): CanvasEdge[] {
    return Array.from(this.edges.values()).filter(
      e => e.source === nodeId || e.target === nodeId
    );
  }

  // ===========================================================================
  // Selection Operations
  // ===========================================================================

  selectNodes(nodeIds: string[], additive = false): void {
    if (!additive) {
      this.selection.nodeIds.clear();
    }
    nodeIds.forEach(id => {
      if (this.nodes.has(id)) {
        this.selection.nodeIds.add(id);
      }
    });
    this.emitSelectionChanged();
  }

  selectEdges(edgeIds: string[], additive = false): void {
    if (!additive) {
      this.selection.edgeIds.clear();
    }
    edgeIds.forEach(id => {
      if (this.edges.has(id)) {
        this.selection.edgeIds.add(id);
      }
    });
    this.emitSelectionChanged();
  }

  clearSelection(): void {
    this.selection.nodeIds.clear();
    this.selection.edgeIds.clear();
    this.emitSelectionChanged();
  }

  // ===========================================================================
  // Viewport Operations
  // ===========================================================================

  setViewport(viewport: Viewport): void {
    const from = this.viewport;
    this.viewport = {
      x: viewport.x,
      y: viewport.y,
      zoom: Math.max(this.config.minZoom, Math.min(this.config.maxZoom, viewport.zoom)),
    };
    this.emitEvent('viewport:changed', { from, to: this.viewport } as ViewportChangedPayload);
  }

  // ===========================================================================
  // Grid Operations
  // ===========================================================================

  setGridConfig(config: Partial<GridConfig>): void {
    this.config.grid = { ...this.config.grid, ...config };
  }

  snapToGrid(position: Position): Position {
    const gridSize = this.config.grid.size;
    return {
      x: Math.round(position.x / gridSize) * gridSize,
      y: Math.round(position.y / gridSize) * gridSize,
    };
  }

  // ===========================================================================
  // Collision Detection
  // ===========================================================================

  /**
   * Check if a node overlaps with any existing nodes.
   */
  checkOverlap(node: CanvasNode, excludeIds: string[] = []): CanvasNode[] {
    const overlapping: CanvasNode[] = [];
    const nodeBounds = this.getNodeBounds(node);

    this.nodes.forEach((existingNode, id) => {
      if (id === node.id || excludeIds.includes(id)) return;

      const existingBounds = this.getNodeBounds(existingNode);
      if (this.boundsIntersect(nodeBounds, existingBounds)) {
        overlapping.push(existingNode);
      }
    });

    return overlapping;
  }

  /**
   * Find a position for a node that doesn't overlap with existing nodes.
   */
  findNonOverlappingPosition(node: CanvasNode): Position {
    let position = { ...node.position };
    const gridSize = this.config.grid.size;
    let attempts = 0;
    const maxAttempts = 100;

    while (this.checkOverlap({ ...node, position }).length > 0 && attempts < maxAttempts) {
      // Try moving right first, then down
      position.x += gridSize;
      if (attempts % 10 === 9) {
        position.x = node.position.x;
        position.y += gridSize;
      }
      attempts++;
    }

    return this.config.grid.snapToGrid ? this.snapToGrid(position) : position;
  }

  protected getNodeBounds(node: CanvasNode): { x1: number; y1: number; x2: number; y2: number } {
    const width = node.width ?? 200;
    const height = node.height ?? 100;
    return {
      x1: node.position.x,
      y1: node.position.y,
      x2: node.position.x + width,
      y2: node.position.y + height,
    };
  }

  protected boundsIntersect(
    a: { x1: number; y1: number; x2: number; y2: number },
    b: { x1: number; y1: number; x2: number; y2: number }
  ): boolean {
    return !(a.x2 <= b.x1 || b.x2 <= a.x1 || a.y2 <= b.y1 || b.y2 <= a.y1);
  }

  // ===========================================================================
  // Event Emitter Implementation
  // ===========================================================================

  on<T>(event: CanvasEventType, handler: (e: CanvasEvent<T>) => void): void {
    this.emitter.on(event, handler);
  }

  off<T>(event: CanvasEventType, handler: (e: CanvasEvent<T>) => void): void {
    this.emitter.off(event, handler);
  }

  emit<T>(event: CanvasEventType, payload: T): void {
    this.emitEvent(event, payload);
  }

  protected emitEvent<T>(type: CanvasEventType, payload: T): void {
    const event: CanvasEvent<T> = {
      type,
      canvasId: this.id,
      timestamp: Date.now(),
      payload,
    };
    this.emitter.emit(type, event);
  }

  private emitSelectionChanged(): void {
    this.emitEvent('selection:changed', {
      nodeIds: Array.from(this.selection.nodeIds),
      edgeIds: Array.from(this.selection.edgeIds),
    } as SelectionChangedPayload);
  }

  // ===========================================================================
  // Lifecycle Phase Management
  // ===========================================================================

  protected setLifecyclePhase(phase: CanvasLifecyclePhase): void {
    const previousPhase = this.lifecyclePhase;
    this.lifecyclePhase = phase;
    this.emitEvent('lifecycle:changed', { phase, canvasId: this.id, timestamp: Date.now(), previousPhase });
  }

  // ===========================================================================
  // Auto-Save
  // ===========================================================================

  private startAutoSave(): void {
    if (this.config.autoSaveInterval && !this.autoSaveTimer) {
      this.autoSaveTimer = setInterval(() => {
        this.save().catch(err => {
          console.error(`[Canvas ${this.id}] Auto-save failed:`, err);
        });
      }, this.config.autoSaveInterval);
    }
  }

  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }
  }

  // ===========================================================================
  // Abstract Methods (Must implement in subclasses)
  // ===========================================================================

  /**
   * Get the list of widget types allowed on this canvas.
   * Subclasses define their own widget whitelist.
   */
  abstract getAllowedWidgetTypes(): string[];

  /**
   * Validate whether a widget type can be added to this canvas.
   */
  abstract canAddWidget(widgetType: string): boolean;
}

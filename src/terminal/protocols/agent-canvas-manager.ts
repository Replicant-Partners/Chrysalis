/**
 * Agent Canvas Manager
 * 
 * Manages the storage, synchronization, and lifecycle of agents on the Agent Canvas.
 * Uses YJS for CRDT-based conflict-free replication.
 * 
 * Key responsibilities:
 * - Store and retrieve agents from canvas
 * - Sync agents across clients via YJS
 * - Manage agent positions and layout
 * - Handle agent import/export
 * - Event notifications for UI updates
 */

import * as Y from 'yjs';
import {
  AgentState,
  AgentSourceFormat,
  CanvasAgent,
  AgentCanvasState,
  AgentCanvasMetadata,
  DataResourceLink,
  AgentCanvasEvent,
  createCanvasAgent,
  isCanvasAgent,
  AGENT_CANVAS_CONSTANTS
} from './agent-canvas';
import { 
  AgentImportPipeline, 
  ImportResult, 
  ImportPipelineConfig,
  getDefaultImportPipeline
} from './agent-import-pipeline';

// =============================================================================
// Types
// =============================================================================

/**
 * Agent position on the canvas
 */
export interface AgentPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

/**
 * Agent layout configuration
 */
export interface AgentLayout {
  agentId: string;
  position: AgentPosition;
  collapsed: boolean;
  selected: boolean;
  pinned: boolean;
}

/**
 * Canvas viewport state
 */
export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
  width: number;
  height: number;
}

/**
 * Agent selection state
 */
export interface SelectionState {
  selectedIds: Set<string>;
  lastSelected: string | null;
  multiSelect: boolean;
}

/**
 * Event types emitted by the canvas manager
 */
export type CanvasManagerEventType =
  | 'agent:added'
  | 'agent:removed'
  | 'agent:updated'
  | 'agent:moved'
  | 'agent:state-changed'
  | 'selection:changed'
  | 'viewport:changed'
  | 'sync:connected'
  | 'sync:disconnected'
  | 'sync:error'
  | 'import:started'
  | 'import:completed'
  | 'import:failed';

/**
 * Event data for canvas manager events
 */
export interface CanvasManagerEvent {
  type: CanvasManagerEventType;
  agentId?: string;
  agent?: CanvasAgent;
  layout?: AgentLayout;
  selection?: SelectionState;
  viewport?: CanvasViewport;
  importResult?: ImportResult;
  error?: Error;
  timestamp: number;
}

/**
 * Event listener type
 */
export type CanvasManagerEventListener = (event: CanvasManagerEvent) => void;

/**
 * Configuration for AgentCanvasManager
 */
export interface AgentCanvasManagerConfig {
  /** Canvas ID for persistence */
  canvasId: string;
  /** Maximum agents allowed on canvas */
  maxAgents: number;
  /** Default agent node dimensions */
  defaultAgentSize: { width: number; height: number };
  /** Grid snap size (0 for no snap) */
  gridSnapSize: number;
  /** Auto-layout new agents */
  autoLayout: boolean;
  /** Import pipeline configuration */
  importConfig?: Partial<ImportPipelineConfig>;
}

const DEFAULT_CONFIG: AgentCanvasManagerConfig = {
  canvasId: 'default-agent-canvas',
  maxAgents: AGENT_CANVAS_CONSTANTS.MAX_AGENTS_PER_CANVAS,
  defaultAgentSize: { width: 280, height: 200 },
  gridSnapSize: 20,
  autoLayout: true
};

// =============================================================================
// YJS Document Structure
// =============================================================================

/**
 * YJS shared types for agent canvas
 * 
 * Document structure:
 * - agents: Y.Map<string, CanvasAgent>      - Agent specifications
 * - layouts: Y.Map<string, AgentLayout>     - Agent positions/layout
 * - metadata: Y.Map<string, any>            - Canvas metadata
 */
interface CanvasYDoc {
  agents: Y.Map<string>;
  layouts: Y.Map<string>;
  metadata: Y.Map<string>;
}

// =============================================================================
// Agent Canvas Manager Class
// =============================================================================

/**
 * AgentCanvasManager manages agents on the canvas
 */
export class AgentCanvasManager {
  private config: AgentCanvasManagerConfig;
  private doc: Y.Doc;
  private agents: Y.Map<string>;
  private layouts: Y.Map<string>;
  private metadata: Y.Map<string>;
  private selection: SelectionState;
  private viewport: CanvasViewport;
  private listeners: Map<string, Set<CanvasManagerEventListener>>;
  private importPipeline: AgentImportPipeline;
  private undoManager: Y.UndoManager;
  private isInitialized: boolean = false;

  constructor(config: Partial<AgentCanvasManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize YJS document
    this.doc = new Y.Doc();
    this.agents = this.doc.getMap('agents');
    this.layouts = this.doc.getMap('layouts');
    this.metadata = this.doc.getMap('metadata');
    
    // Initialize state
    this.selection = {
      selectedIds: new Set(),
      lastSelected: null,
      multiSelect: false
    };
    
    this.viewport = {
      x: 0,
      y: 0,
      zoom: 1,
      width: 1920,
      height: 1080
    };
    
    // Initialize listeners
    this.listeners = new Map();
    
    // Initialize import pipeline
    this.importPipeline = new AgentImportPipeline(this.config.importConfig);
    
    // Initialize undo manager for agents and layouts
    this.undoManager = new Y.UndoManager([this.agents, this.layouts]);
    
    // Setup YJS observers
    this.setupObservers();
    
    // Initialize metadata
    this.initializeMetadata();
    
    this.isInitialized = true;
  }

  /**
   * Setup YJS observers for syncing
   */
  private setupObservers(): void {
    // Agent changes
    this.agents.observe((event) => {
      event.changes.keys.forEach((change, key) => {
        if (change.action === 'add') {
          const agent = this.agents.get(key);
          this.emit({
            type: 'agent:added',
            agentId: key,
            agent: agent as CanvasAgent,
            timestamp: Date.now()
          });
        } else if (change.action === 'delete') {
          this.emit({
            type: 'agent:removed',
            agentId: key,
            timestamp: Date.now()
          });
        } else if (change.action === 'update') {
          const agent = this.agents.get(key);
          this.emit({
            type: 'agent:updated',
            agentId: key,
            agent: agent as CanvasAgent,
            timestamp: Date.now()
          });
        }
      });
    });

    // Layout changes
    this.layouts.observe((event) => {
      event.changes.keys.forEach((change, key) => {
        if (change.action === 'update') {
          const layout = this.layouts.get(key);
          this.emit({
            type: 'agent:moved',
            agentId: key,
            layout: layout as AgentLayout,
            timestamp: Date.now()
          });
        }
      });
    });
  }

  /**
   * Initialize canvas metadata
   */
  private initializeMetadata(): void {
    if (!this.metadata.get('canvasId')) {
      this.doc.transact(() => {
        this.metadata.set('canvasId', this.config.canvasId);
        this.metadata.set('createdAt', Date.now());
        this.metadata.set('version', '1.0.0');
        this.metadata.set('agentCount', 0);
      });
    }
  }

  // ===========================================================================
  // Agent CRUD Operations
  // ===========================================================================

  /**
   * Add an agent to the canvas
   */
  addAgent(agent: CanvasAgent, position?: Partial<AgentPosition>): string {
    if (this.agents.size >= this.config.maxAgents) {
      throw new Error(`Canvas is full. Maximum ${this.config.maxAgents} agents allowed.`);
    }

    const agentId = agent.id;

    // Calculate position if not provided
    const finalPosition = this.calculatePosition(position);

    // Create layout
    const layout: AgentLayout = {
      agentId,
      position: finalPosition,
      collapsed: false,
      selected: false,
      pinned: false
    };

    // Add to YJS doc atomically
    this.doc.transact(() => {
      this.agents.set(agentId, agent);
      this.layouts.set(agentId, layout);
      this.metadata.set('agentCount', this.agents.size);
      this.metadata.set('updatedAt', Date.now());
    });

    return agentId;
  }

  /**
   * Remove an agent from the canvas
   */
  removeAgent(agentId: string): boolean {
    if (!this.agents.has(agentId)) {
      return false;
    }

    this.doc.transact(() => {
      this.agents.delete(agentId);
      this.layouts.delete(agentId);
      this.selection.selectedIds.delete(agentId);
      if (this.selection.lastSelected === agentId) {
        this.selection.lastSelected = null;
      }
      this.metadata.set('agentCount', this.agents.size);
      this.metadata.set('updatedAt', Date.now());
    });

    return true;
  }

  /**
   * Get an agent by ID
   */
  getAgent(agentId: string): CanvasAgent | undefined {
    return this.agents.get(agentId) as CanvasAgent | undefined;
  }

  /**
   * Get all agents on the canvas
   * Optimized to use Array.from instead of forEach with closure
   */
  getAllAgents(): CanvasAgent[] {
    return Array.from(this.agents.values()) as CanvasAgent[];
  }

  /**
   * Get multiple agents by their IDs in a single batch call
   * More efficient than calling getAgent() in a loop (N+1 pattern)
   * @param ids - Array of agent IDs to retrieve
   * @returns Array of found agents (missing IDs are silently skipped)
   */
  getAgentsByIds(ids: string[]): CanvasAgent[] {
    const result: CanvasAgent[] = [];
    for (const id of ids) {
      const agent = this.agents.get(id);
      if (agent) {
        result.push(agent as CanvasAgent);
      }
    }
    return result;
  }

  /**
   * Get agent count
   */
  getAgentCount(): number {
    return this.agents.size;
  }

  /**
   * Update an agent's spec
   */
  updateAgent(agentId: string, updates: Partial<CanvasAgent>): boolean {
    const agent = this.agents.get(agentId) as CanvasAgent | undefined;
    if (!agent) {
      return false;
    }

    const updatedAgent: CanvasAgent = {
      ...agent,
      ...updates,
      id: agentId, // Preserve ID
      updatedAt: Date.now()
    };

    this.doc.transact(() => {
      this.agents.set(agentId, updatedAgent);
      this.metadata.set('updatedAt', Date.now());
    });

    return true;
  }

  /**
   * Update agent state (dormant/waking/awake/sleeping/error)
   */
  updateAgentState(agentId: string, state: AgentState, errorMessage?: string): boolean {
    const agent = this.agents.get(agentId) as CanvasAgent | undefined;
    if (!agent) {
      return false;
    }

    const updates: Partial<CanvasAgent> = {
      state,
      lastError: errorMessage
    };

    if (state === 'awake') {
      updates.lastWakeTime = Date.now();
    } else if (state === 'dormant') {
      updates.lastSleepTime = Date.now();
    }

    this.updateAgent(agentId, updates);

    this.emit({
      type: 'agent:state-changed',
      agentId,
      agent: this.getAgent(agentId),
      timestamp: Date.now()
    });

    return true;
  }

  // ===========================================================================
  // Layout Operations
  // ===========================================================================

  /**
   * Get agent layout
   */
  getLayout(agentId: string): AgentLayout | undefined {
    return this.layouts.get(agentId) as AgentLayout | undefined;
  }

  /**
   * Get all layouts
   * Optimized to use direct Map construction
   */
  getAllLayouts(): Map<string, AgentLayout> {
    return new Map(
      Array.from(this.layouts.entries()).map(
        ([key, layout]) => [key, layout as AgentLayout]
      )
    );
  }

  /**
   * Move an agent to a new position
   */
  moveAgent(agentId: string, position: Partial<AgentPosition>): boolean {
    const layout = this.layouts.get(agentId) as AgentLayout | undefined;
    if (!layout) {
      return false;
    }

    const newPosition: AgentPosition = {
      ...layout.position,
      ...position
    };

    // Apply grid snap if configured
    if (this.config.gridSnapSize > 0) {
      newPosition.x = Math.round(newPosition.x / this.config.gridSnapSize) * this.config.gridSnapSize;
      newPosition.y = Math.round(newPosition.y / this.config.gridSnapSize) * this.config.gridSnapSize;
    }

    const updatedLayout: AgentLayout = {
      ...layout,
      position: newPosition
    };

    this.layouts.set(agentId, updatedLayout);
    return true;
  }

  /**
   * Resize an agent
   */
  resizeAgent(agentId: string, width: number, height: number): boolean {
    const layout = this.layouts.get(agentId) as AgentLayout | undefined;
    if (!layout) {
      return false;
    }

    const updatedLayout: AgentLayout = {
      ...layout,
      position: {
        ...layout.position,
        width: Math.max(100, width),
        height: Math.max(80, height)
      }
    };

    this.layouts.set(agentId, updatedLayout);
    return true;
  }

  /**
   * Toggle agent collapsed state
   */
  toggleCollapsed(agentId: string): boolean {
    const layout = this.layouts.get(agentId) as AgentLayout | undefined;
    if (!layout) {
      return false;
    }

    const updatedLayout: AgentLayout = {
      ...layout,
      collapsed: !layout.collapsed
    };

    this.layouts.set(agentId, updatedLayout);
    return true;
  }

  /**
   * Pin/unpin agent
   */
  togglePinned(agentId: string): boolean {
    const layout = this.layouts.get(agentId) as AgentLayout | undefined;
    if (!layout) {
      return false;
    }

    const updatedLayout: AgentLayout = {
      ...layout,
      pinned: !layout.pinned
    };

    this.layouts.set(agentId, updatedLayout);
    return true;
  }

  /**
   * Calculate position for new agent
   */
  private calculatePosition(position?: Partial<AgentPosition>): AgentPosition {
    const defaultPos: AgentPosition = {
      x: position?.x ?? 100,
      y: position?.y ?? 100,
      width: position?.width ?? this.config.defaultAgentSize.width,
      height: position?.height ?? this.config.defaultAgentSize.height,
      zIndex: position?.zIndex ?? this.agents.size + 1
    };

    if (this.config.autoLayout && position?.x === undefined && position?.y === undefined) {
      // Auto-layout: place in grid pattern
      const cols = Math.floor((this.viewport.width - 100) / (this.config.defaultAgentSize.width + 40));
      const index = this.agents.size;
      const col = index % cols;
      const row = Math.floor(index / cols);

      defaultPos.x = 50 + col * (this.config.defaultAgentSize.width + 40);
      defaultPos.y = 50 + row * (this.config.defaultAgentSize.height + 40);
    }

    return defaultPos;
  }

  // ===========================================================================
  // Selection Operations
  // ===========================================================================

  /**
   * Select an agent
   */
  selectAgent(agentId: string, multiSelect: boolean = false): void {
    if (!multiSelect) {
      // Clear previous selection
      this.selection.selectedIds.forEach(id => {
        const layout = this.layouts.get(id) as AgentLayout;
        if (layout) {
          this.layouts.set(id, { ...layout, selected: false });
        }
      });
      this.selection.selectedIds.clear();
    }

    this.selection.selectedIds.add(agentId);
    this.selection.lastSelected = agentId;
    this.selection.multiSelect = multiSelect;

    const layout = this.layouts.get(agentId) as AgentLayout;
    if (layout) {
      this.layouts.set(agentId, { ...layout, selected: true });
    }

    this.emit({
      type: 'selection:changed',
      selection: { ...this.selection, selectedIds: new Set(this.selection.selectedIds) },
      timestamp: Date.now()
    });
  }

  /**
   * Deselect an agent
   */
  deselectAgent(agentId: string): void {
    this.selection.selectedIds.delete(agentId);
    if (this.selection.lastSelected === agentId) {
      this.selection.lastSelected = this.selection.selectedIds.size > 0 
        ? Array.from(this.selection.selectedIds)[0] 
        : null;
    }

    const layout = this.layouts.get(agentId) as AgentLayout;
    if (layout) {
      this.layouts.set(agentId, { ...layout, selected: false });
    }

    this.emit({
      type: 'selection:changed',
      selection: { ...this.selection, selectedIds: new Set(this.selection.selectedIds) },
      timestamp: Date.now()
    });
  }

  /**
   * Clear all selection
   */
  clearSelection(): void {
    this.selection.selectedIds.forEach(id => {
      const layout = this.layouts.get(id) as AgentLayout;
      if (layout) {
        this.layouts.set(id, { ...layout, selected: false });
      }
    });
    this.selection.selectedIds.clear();
    this.selection.lastSelected = null;
    this.selection.multiSelect = false;

    this.emit({
      type: 'selection:changed',
      selection: { ...this.selection, selectedIds: new Set() },
      timestamp: Date.now()
    });
  }

  /**
   * Select all agents
   */
  selectAll(): void {
    this.agents.forEach((_, agentId) => {
      this.selection.selectedIds.add(agentId);
      const layout = this.layouts.get(agentId) as AgentLayout;
      if (layout) {
        this.layouts.set(agentId, { ...layout, selected: true });
      }
    });
    this.selection.multiSelect = true;

    this.emit({
      type: 'selection:changed',
      selection: { ...this.selection, selectedIds: new Set(this.selection.selectedIds) },
      timestamp: Date.now()
    });
  }

  /**
   * Get selected agents
   */
  getSelectedAgents(): CanvasAgent[] {
    return Array.from(this.selection.selectedIds)
      .map(id => this.getAgent(id))
      .filter((agent): agent is CanvasAgent => agent !== undefined);
  }

  // ===========================================================================
  // Viewport Operations
  // ===========================================================================

  /**
   * Update viewport
   */
  setViewport(viewport: Partial<CanvasViewport>): void {
    this.viewport = { ...this.viewport, ...viewport };
    this.emit({
      type: 'viewport:changed',
      viewport: { ...this.viewport },
      timestamp: Date.now()
    });
  }

  /**
   * Get current viewport
   */
  getViewport(): CanvasViewport {
    return { ...this.viewport };
  }

  /**
   * Zoom to fit all agents
   */
  zoomToFit(): void {
    if (this.agents.size === 0) {
      this.setViewport({ x: 0, y: 0, zoom: 1 });
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    this.layouts.forEach((layout: AgentLayout) => {
      minX = Math.min(minX, layout.position.x);
      minY = Math.min(minY, layout.position.y);
      maxX = Math.max(maxX, layout.position.x + layout.position.width);
      maxY = Math.max(maxY, layout.position.y + layout.position.height);
    });

    const contentWidth = maxX - minX + 100;
    const contentHeight = maxY - minY + 100;
    const zoom = Math.min(
      this.viewport.width / contentWidth,
      this.viewport.height / contentHeight,
      1
    );

    this.setViewport({
      x: minX - 50,
      y: minY - 50,
      zoom: Math.max(0.1, Math.min(zoom, 2))
    });
  }

  // ===========================================================================
  // Import Operations
  // ===========================================================================

  /**
   * Import agent from file
   */
  async importFromFile(file: File, position?: Partial<AgentPosition>): Promise<ImportResult> {
    this.emit({
      type: 'import:started',
      timestamp: Date.now()
    });

    try {
      const result = await this.importPipeline.importFromFile(file);
      
      if (result.status === 'success' || result.status === 'partial') {
        if (result.agent) {
          this.addAgent(result.agent, position);
        }
        this.emit({
          type: 'import:completed',
          importResult: result,
          timestamp: Date.now()
        });
      } else {
        this.emit({
          type: 'import:failed',
          importResult: result,
          timestamp: Date.now()
        });
      }

      return result;
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      this.emit({
        type: 'import:failed',
        error,
        timestamp: Date.now()
      });
      throw error;
    }
  }

  /**
   * Import agent from URL
   */
  async importFromURL(url: string, position?: Partial<AgentPosition>): Promise<ImportResult> {
    this.emit({
      type: 'import:started',
      timestamp: Date.now()
    });

    try {
      const result = await this.importPipeline.importFromURL(url);
      
      if (result.status === 'success' || result.status === 'partial') {
        if (result.agent) {
          this.addAgent(result.agent, position);
        }
        this.emit({
          type: 'import:completed',
          importResult: result,
          timestamp: Date.now()
        });
      } else {
        this.emit({
          type: 'import:failed',
          importResult: result,
          timestamp: Date.now()
        });
      }

      return result;
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      this.emit({
        type: 'import:failed',
        error,
        timestamp: Date.now()
      });
      throw error;
    }
  }

  /**
   * Import agent from text/JSON
   */
  async importFromText(text: string, position?: Partial<AgentPosition>): Promise<ImportResult> {
    this.emit({
      type: 'import:started',
      timestamp: Date.now()
    });

    try {
      const result = await this.importPipeline.importFromText(text);
      
      if (result.status === 'success' || result.status === 'partial') {
        if (result.agent) {
          this.addAgent(result.agent, position);
        }
        this.emit({
          type: 'import:completed',
          importResult: result,
          timestamp: Date.now()
        });
      } else {
        this.emit({
          type: 'import:failed',
          importResult: result,
          timestamp: Date.now()
        });
      }

      return result;
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      this.emit({
        type: 'import:failed',
        error,
        timestamp: Date.now()
      });
      throw error;
    }
  }

  /**
   * Import multiple files
   */
  async importMultiple(files: File[]): Promise<ImportResult[]> {
    const results: ImportResult[] = [];
    
    for (const file of files) {
      try {
        const result = await this.importFromFile(file);
        results.push(result);
      } catch (e) {
        // Continue with other files on error
        results.push({
          status: 'error',
          sourceFormat: 'unknown',
          errors: [{
            code: 'FILE_READ_ERROR',
            message: e instanceof Error ? e.message : String(e),
            recoverable: false
          }],
          warnings: [],
          metadata: {
            sourceName: file.name,
            sourceType: 'file',
            detectedFormat: 'unknown',
            importTimestamp: Date.now(),
            conversionDuration: 0,
            originalSize: file.size,
            convertedSize: 0
          }
        });
      }
    }

    return results;
  }

  // ===========================================================================
  // Export Operations
  // ===========================================================================

  /**
   * Export single agent as JSON
   */
  exportAgent(agentId: string): string | null {
    const agent = this.getAgent(agentId);
    if (!agent) {
      return null;
    }
    return JSON.stringify(agent.spec, null, 2);
  }

  /**
   * Export all agents
   */
  exportAll(): string {
    const agents = this.getAllAgents();
    const exportData = {
      canvasId: this.config.canvasId,
      version: '1.0.0',
      exportedAt: Date.now(),
      agents: agents.map(a => ({
        id: a.id,
        spec: a.spec,
        layout: this.getLayout(a.id)
      }))
    };
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export selected agents
   */
  exportSelected(): string {
    const agents = this.getSelectedAgents();
    const exportData = {
      canvasId: this.config.canvasId,
      version: '1.0.0',
      exportedAt: Date.now(),
      agents: agents.map(a => ({
        id: a.id,
        spec: a.spec,
        layout: this.getLayout(a.id)
      }))
    };
    return JSON.stringify(exportData, null, 2);
  }

  // ===========================================================================
  // Undo/Redo Operations
  // ===========================================================================

  /**
   * Undo last operation
   */
  undo(): void {
    this.undoManager.undo();
  }

  /**
   * Redo last undone operation
   */
  redo(): void {
    this.undoManager.redo();
  }

  /**
   * Check if can undo
   */
  canUndo(): boolean {
    return this.undoManager.canUndo();
  }

  /**
   * Check if can redo
   */
  canRedo(): boolean {
    return this.undoManager.canRedo();
  }

  // ===========================================================================
  // Event System
  // ===========================================================================

  /**
   * Subscribe to events
   */
  on(eventType: CanvasManagerEventType | '*', listener: CanvasManagerEventListener): () => void {
    const key = eventType;
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(key)?.delete(listener);
    };
  }

  /**
   * Emit an event
   */
  private emit(event: CanvasManagerEvent): void {
    // Emit to specific listeners
    this.listeners.get(event.type)?.forEach(listener => {
      try {
        listener(event);
      } catch (e) {
        console.error(`Error in canvas manager event listener:`, e);
      }
    });

    // Emit to wildcard listeners
    this.listeners.get('*')?.forEach(listener => {
      try {
        listener(event);
      } catch (e) {
        console.error(`Error in canvas manager wildcard listener:`, e);
      }
    });
  }

  // ===========================================================================
  // YJS Document Access
  // ===========================================================================

  /**
   * Get YJS document for external sync providers
   */
  getYDoc(): Y.Doc {
    return this.doc;
  }

  /**
   * Get canvas state for serialization
   */
  getCanvasState(): AgentCanvasState {
    const agents: CanvasAgent[] = [];
    this.agents.forEach((agent) => {
      agents.push(agent as CanvasAgent);
    });

    return {
      agents,
      metadata: this.getCanvasMetadata(),
      selectedAgentId: this.selection.lastSelected || undefined
    };
  }

  /**
   * Get canvas metadata
   */
  getCanvasMetadata(): AgentCanvasMetadata {
    return {
      canvasId: this.metadata.get('canvasId') as string || this.config.canvasId,
      createdAt: this.metadata.get('createdAt') as number || Date.now(),
      updatedAt: this.metadata.get('updatedAt') as number || Date.now(),
      version: this.metadata.get('version') as string || '1.0.0',
      agentCount: this.agents.size
    };
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Destroy the manager and cleanup resources
   */
  destroy(): void {
    this.undoManager.destroy();
    this.doc.destroy();
    this.listeners.clear();
    this.selection.selectedIds.clear();
    this.isInitialized = false;
  }
}

// =============================================================================
// Factory and Singleton
// =============================================================================

let defaultManager: AgentCanvasManager | null = null;

/**
 * Get or create the default agent canvas manager
 */
export function getDefaultAgentCanvasManager(config?: Partial<AgentCanvasManagerConfig>): AgentCanvasManager {
  if (!defaultManager) {
    defaultManager = new AgentCanvasManager(config);
  }
  return defaultManager;
}

/**
 * Create a new agent canvas manager
 */
export function createAgentCanvasManager(config?: Partial<AgentCanvasManagerConfig>): AgentCanvasManager {
  return new AgentCanvasManager(config);
}

/**
 * Reset the default manager (for testing)
 */
export function resetDefaultAgentCanvasManager(): void {
  if (defaultManager) {
    defaultManager.destroy();
    defaultManager = null;
  }
}
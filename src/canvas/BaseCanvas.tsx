/**
 * BaseCanvas Component
 * 
 * Foundation canvas implementation using ReactFlow with standard React state management.
 * 
 * @see docs/CANVAS_FOUNDATION_IMPLEMENTATION.md
 * @see types.ts for type definitions
 */

import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type Viewport,
  type ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';

import type {
  CanvasEvent,
  CanvasKind,
  CanvasPolicy,
  CanvasTheme,
  AccessibilityConfig,
  CanvasDataSource,
  ValidationResult,
  WidgetNodeData,
  CanvasLifecycleState,
} from './types';
import type { WidgetRegistry } from './WidgetRegistry';

/**
 * BaseCanvas Props
 */
export interface BaseCanvasProps {
  /**
   * Canvas kind identifier
   */
  canvasKind: CanvasKind;

  /**
   * Unique canvas instance ID
   */
  canvasId: string;

  /**
   * Widget registry for this canvas
   */
  registry: WidgetRegistry;

  /**
   * Policy enforcement configuration
   */
  policy: CanvasPolicy;

  /**
   * Optional canvas theme
   */
  theme?: CanvasTheme;

  /**
   * Optional accessibility configuration
   */
  accessibility?: AccessibilityConfig;

  /**
   * Optional initial viewport
   */
  initialViewport?: Viewport;

  /**
   * Optional data source for persistence
   */
  dataSource?: CanvasDataSource<Node<WidgetNodeData>, Edge>;

  /**
   * Event handler for canvas events
   */
  onEvent?: (event: CanvasEvent) => void;

  /**
   * Callback when canvas is ready
   */
  onReady?: (instance: ReactFlowInstance) => void;

  /**
   * Optional initial nodes
   */
  initialNodes?: Node<WidgetNodeData>[];

  /**
   * Optional initial edges
   */
  initialEdges?: Edge[];

  /**
   * Whether to show controls (zoom, fit, etc.)
   */
  showControls?: boolean;

  /**
   * Whether to show minimap
   */
  showMinimap?: boolean;

  /**
   * Whether to show background grid
   */
  showBackground?: boolean;
}

/**
 * Rate limiter for policy enforcement
 */
class RateLimiter {
  private actions: number[] = [];

  constructor(
    private readonly maxActions: number,
    private readonly windowMs: number
  ) { }

  public check(): boolean {
    const now = Date.now();
    // Remove expired entries
    this.actions = this.actions.filter((time) => now - time < this.windowMs);

    if (this.actions.length >= this.maxActions) {
      return false;
    }

    this.actions.push(now);
    return true;
  }

  public reset(): void {
    this.actions = [];
  }
}

/**
 * BaseCanvas Component Implementation
 * @param root0
 * @param root0.canvasKind
 * @param root0.canvasId
 * @param root0.registry
 * @param root0.policy
 * @param root0.theme
 * @param root0.accessibility
 * @param root0.initialViewport
 * @param root0.dataSource
 * @param root0.onEvent
 * @param root0.onReady
 * @param root0.initialNodes
 * @param root0.initialEdges
 * @param root0.showControls
 * @param root0.showMinimap
 * @param root0.showBackground
 */
export const BaseCanvas: React.FC<BaseCanvasProps> = ({
  canvasKind,
  canvasId,
  registry,
  policy,
  theme,
  accessibility = {
    enableKeyboardNav: true,
    liveRegion: true,
    reducedMotion: true,
    minContrastRatio: 4.5,
  },
  initialViewport,
  dataSource,
  onEvent,
  onReady,
  initialNodes = [],
  initialEdges = [],
  showControls = true,
  showMinimap = false,
  showBackground = true,
}) => {
  // State management using standard React useState
  const [nodes, setNodes] = useState<Node<WidgetNodeData>[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [lifecycleState, setLifecycleState] = useState<CanvasLifecycleState>('initializing');
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);

  // Refs
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const rateLimiter = useRef(new RateLimiter(policy.rateLimit.actions, policy.rateLimit.windowMs));

  /**
   * Emit canvas event
   */
  const emitEvent = useCallback((type: CanvasEvent['type'], payload?: unknown) => {
    const event: CanvasEvent = {
      type,
      canvasId,
      timestamp: Date.now(),
      payload,
    };
    onEvent?.(event);
  }, [canvasId, onEvent]);

  /**
   * Policy validation - check if operation is allowed
   */
  const validateOperation = useCallback((operation: string, data?: unknown): ValidationResult => {
    const errors: string[] = [];

    // Check rate limiting
    if (!rateLimiter.current.check()) {
      errors.push(`Rate limit exceeded: ${policy.rateLimit.actions} actions per ${policy.rateLimit.windowMs}ms`);
      emitEvent('rate:limit:exceeded');
    }

    // Check node count
    if (operation === 'node:create' && nodes.length >= policy.maxNodes) {
      errors.push(`Maximum nodes (${policy.maxNodes}) reached`);
      emitEvent('policy:violated', { rule: 'maxNodes', current: nodes.length });
    }

    // Check edge count
    if (operation === 'edge:create' && edges.length >= policy.maxEdges) {
      errors.push(`Maximum edges (${policy.maxEdges}) reached`);
      emitEvent('policy:violated', { rule: 'maxEdges', current: edges.length });
    }

    // Check widget type allowlist
    if (operation === 'node:create' && data) {
      const node = data as Node<WidgetNodeData>;
      if (node.data.type && !policy.allowedWidgetTypes.includes(node.data.type)) {
        errors.push(`Widget type '${node.data.type}' not allowed for canvas kind '${canvasKind}'`);
        emitEvent('policy:violated', { rule: 'allowedWidgetTypes', type: node.data.type });
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.map(msg => ({ code: 'POLICY_VIOLATION', message: msg })),
      warnings: [],
    };
  }, [nodes.length, edges.length, policy, canvasKind, emitEvent]);

  /**
   * Enhanced nodes change handler with policy enforcement
   */
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    for (const change of changes) {
      if (change.type === 'add') {
        const validation = validateOperation('node:create', change.item);
        if (!validation.valid) {
          console.warn('Node creation blocked by policy:', validation.errors);
          return;
        }
      }
    }
    setNodes((nds) => applyNodeChanges(changes, nds));
    emitEvent('node:updated', { changeCount: changes.length });
  }, [validateOperation, emitEvent]);

  /**
   * Enhanced edges change handler with policy enforcement
   */
  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    for (const change of changes) {
      if (change.type === 'add') {
        const validation = validateOperation('edge:create', change.item);
        if (!validation.valid) {
          console.warn('Edge creation blocked by policy:', validation.errors);
          return;
        }
      }
    }
    setEdges((eds) => applyEdgeChanges(changes, eds));
    emitEvent('edge:created', { changeCount: changes.length });
  }, [validateOperation, emitEvent]);

  /**
   * Connection handler with validation
   */
  const handleConnect = useCallback((connection: Connection) => {
    const validation = validateOperation('edge:create');
    if (!validation.valid) {
      console.warn('Connection blocked by policy:', validation.errors);
      return;
    }

    setEdges((eds) => addEdge(connection, eds));
    emitEvent('edge:created', { connection });
  }, [validateOperation, emitEvent]);

  /**
   * Selection change handler
   */
  const handleSelectionChange = useCallback((params: { nodes: Node[]; edges: Edge[] }) => {
    const nodeIds = params.nodes.map((n) => n.id);
    setSelectedNodes(nodeIds);
    emitEvent('selection:changed', { nodes: nodeIds, edges: params.edges.map((e) => e.id) });
  }, [emitEvent]);

  /**
   * ReactFlow initialization
   */
  const handleInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;

    // Set initial viewport if provided
    if (initialViewport) {
      instance.setViewport(initialViewport);
    }

    setLifecycleState('ready');
    emitEvent('canvas:loaded');
    onReady?.(instance);
  }, [initialViewport, onReady, emitEvent]);

  /**
   * Create node types from widget registry
   */
  const nodeTypes = useMemo(() => {
    const types: Record<string, React.ComponentType<any>> = {};

    for (const widgetType of registry.getTypes()) {
      const definition = registry.get(widgetType);
      if (definition) {
        types[widgetType] = definition.renderer as React.ComponentType<any>;
      }
    }

    return types;
  }, [registry]);

  /**
   * Apply theme styling
   */
  const canvasStyle = useMemo(() => {
    if (!theme) {
      return {};
    }

    return {
      background: theme.background,
    };
  }, [theme]);

  /**
   * Load data from data source on mount
   */
  useEffect(() => {
    if (!dataSource) {
      setLifecycleState('active');
      return;
    }

    const loadData = async (): Promise<void> => {
      try {
        setLifecycleState('initializing');
        const data = await (dataSource.loadAll ? dataSource.loadAll() : dataSource.load());
        setNodes(data.nodes);
        setEdges(data.edges);
        setLifecycleState('active');
        emitEvent('canvas:loaded', { nodeCount: data.nodes.length, edgeCount: data.edges.length });
      } catch (error) {
        console.error('Failed to load canvas data:', error);
        setLifecycleState('error');
        emitEvent('canvas:error', { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    };

    void loadData();
  }, [dataSource, emitEvent]);

  /**
   * Subscribe to data source changes
   */
  useEffect(() => {
    if (!dataSource) {
      return;
    }

    const unsubscribe = dataSource.subscribe((event) => {
      // Handle real-time updates
      if (event.type === 'nodesChanged') {
        // TODO: Merge changes from remote
      } else if (event.type === 'edgesChanged') {
        // TODO: Merge changes from remote
      }
    });

    return unsubscribe;
  }, [dataSource]);

  /**
   * Accessibility: Keyboard navigation
   */
  useEffect(() => {
    if (!accessibility.enableKeyboardNav) {
      return;
    }

    const handleKeyDown = (_event: KeyboardEvent): void => {
      // TODO: Implement keyboard shortcuts
      // - Delete: Remove selected nodes
      // - Ctrl+A: Select all
      // - Escape: Deselect all
      // - Arrow keys: Move selected nodes
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [accessibility.enableKeyboardNav, selectedNodes]);

  /**
   * Accessibility: Announce changes to screen readers
   */
  useEffect(() => {
    if (!accessibility.liveRegion) {
      return;
    }

    // TODO: Implement ARIA live region announcements
  }, [accessibility.liveRegion, nodes.length, edges.length]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        ...canvasStyle,
      }}
      role="application"
      aria-label={accessibility.ariaLabel || `${canvasKind} canvas workspace`}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onInit={handleInit}
        onSelectionChange={handleSelectionChange}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-right"
        defaultEdgeOptions={{
          animated: !accessibility.reducedMotion,
          style: theme?.edge || {},
        }}
      >
        {showBackground && (
          <Background
            color={theme?.grid?.color || '#e0e0e0'}
            gap={theme?.grid?.size || 16}
          />
        )}
        {showControls && <Controls />}
        {showMinimap && <MiniMap />}
      </ReactFlow>
    </div>
  );
};

/**
 * BaseCanvas wrapped with ReactFlowProvider
 * @param props
 */
export const BaseCanvasWithProvider: React.FC<BaseCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <BaseCanvas {...props} />
    </ReactFlowProvider>
  );
};

export default BaseCanvasWithProvider;

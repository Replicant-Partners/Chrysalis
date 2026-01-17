/**
 * BaseCanvas Component
 * 
 * Base XYFlow canvas component with widget registry enforcement,
 * virtualization, and lifecycle management.
 * 
 * @module canvas/BaseCanvas
 */

import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  NodeTypes,
  EdgeTypes,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';

import type {
  CanvasKind,
  WidgetType,
  WidgetNodeData,
  CanvasNode,
  CanvasEdge,
  CanvasPolicy,
  CanvasTheme,
  CanvasDataSource,
  CanvasLogger,
  CanvasLifecycleHooks,
  A11yConfig,
  CanvasEvent
} from './types';
import { WidgetRegistry } from './WidgetRegistry';
import { createLogger } from '../shared/logger';

// =============================================================================
// Component Props
// =============================================================================

export interface BaseCanvasProps<TWidget extends WidgetType = WidgetType> {
  /** Canvas identifier */
  canvasKind: CanvasKind;
  
  /** Widget registry for this canvas */
  registry: WidgetRegistry<TWidget>;
  
  /** Data source for tile-based loading */
  dataSource?: CanvasDataSource;
  
  /** Canvas policy (allowlist, limits, etc.) */
  policy: CanvasPolicy;
  
  /** Theme configuration */
  theme?: CanvasTheme;
  
  /** Accessibility configuration */
  a11y?: A11yConfig;
  
  /** Lifecycle hooks */
  lifecycle?: CanvasLifecycleHooks;
  
  /** Event handler */
  onEvent?: (event: CanvasEvent) => void;
  
  /** Custom logger */
  logger?: CanvasLogger;
  
  /** Initial nodes */
  initialNodes?: CanvasNode<TWidget>[];
  
  /** Initial edges */
  initialEdges?: CanvasEdge[];
}

// =============================================================================
// Default Theme
// =============================================================================

const DEFAULT_THEME: CanvasTheme = {
  background: '#1a1a1a',
  gridColor: '#333',
  nodeBackground: '#2a2a2a',
  nodeBorder: '#444',
  nodeText: '#e0e0e0',
  edgeColor: '#555',
  selectedNodeBorder: '#0ea5e9',
  selectedEdgeColor: '#0ea5e9',
};

const DEFAULT_A11Y: A11yConfig = {
  enableKeyboardNav: true,
  announceChanges: true,
  highContrast: false,
  reducedMotion: false,
};

// =============================================================================
// BaseCanvas Implementation
// =============================================================================

function BaseCanvasInner<TWidget extends WidgetType = WidgetType>(
  props: BaseCanvasProps<TWidget>
) {
  const {
    canvasKind,
    registry,
    dataSource,
    policy,
    theme = DEFAULT_THEME,
    a11y = DEFAULT_A11Y,
    lifecycle,
    onEvent,
    logger: customLogger,
    initialNodes = [],
    initialEdges = [],
  } = props;
  
  const logger = customLogger || createLogger(`canvas-${canvasKind}`);
  const reactFlow = useReactFlow();
  
  // State
  const [nodes, setNodes] = useState<Node[]>(initialNodes as Node[]);
  const [edges, setEdges] = useState<Edge[]>(initialEdges as Edge[]);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Refs
  const actionCountRef = useRef(0);
  const lastActionTimeRef = useRef(Date.now());
  
  // ===========================================================================
  // Lifecycle
  // ===========================================================================
  
  useEffect(() => {
    // Initialize canvas
    const init = async () => {
      try {
        if (lifecycle?.onInit) {
          await lifecycle.onInit(canvasKind);
        }
        
        emitEvent({
          type: 'canvas_open',
          canvasKind,
          timestamp: new Date().toISOString(),
        });
        
        setIsInitialized(true);
        logger.info('Canvas initialized', { canvasKind });
      } catch (error) {
        logger.error('Canvas initialization failed', error as Error, { canvasKind });
        emitEvent({
          type: 'error',
          canvasKind,
          timestamp: new Date().toISOString(),
          payload: { error: (error as Error).message, phase: 'init' }
        });
      }
    };
    
    init();
    
    // Cleanup on unmount
    return () => {
      if (lifecycle?.onDestroy) {
        lifecycle.onDestroy(canvasKind);
      }
      
      emitEvent({
        type: 'canvas_close',
        canvasKind,
        timestamp: new Date().toISOString(),
      });
    };
  }, [canvasKind]);
  
  // ===========================================================================
  // Event Emission
  // ===========================================================================
  
  const emitEvent = useCallback((event: CanvasEvent) => {
    if (onEvent) {
      onEvent(event);
    }
    logger.debug('Canvas event', { event });
  }, [onEvent, logger]);
  
  // ===========================================================================
  // Rate Limiting
  // ===========================================================================
  
  const checkRateLimit = useCallback((): boolean => {
    if (!policy.rateLimit) return true;
    
    const now = Date.now();
    const timeSinceLastAction = now - lastActionTimeRef.current;
    
    // Reset counter if more than a minute has passed
    if (timeSinceLastAction > 60000) {
      actionCountRef.current = 0;
      lastActionTimeRef.current = now;
    }
    
    actionCountRef.current++;
    
    if (actionCountRef.current > policy.rateLimit.maxActionsPerMinute) {
      logger.warn('Rate limit exceeded', { canvasKind });
      return false;
    }
    
    return true;
  }, [policy, canvasKind]);
  
  // ===========================================================================
  // Node/Edge Changes
  // ===========================================================================
  
  const onNodesChange: OnNodesChange = useCallback((changes) => {
    if (!checkRateLimit()) return;
    
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, [checkRateLimit]);
  
  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    if (!checkRateLimit()) return;
    
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, [checkRateLimit]);
  
  const onConnect: OnConnect = useCallback((connection: Connection) => {
    if (!checkRateLimit()) return;
    
    // Check edge limit
    if (policy.maxEdges && edges.length >= policy.maxEdges) {
      logger.warn('Edge limit reached', { canvasKind, limit: policy.maxEdges });
      emitEvent({
        type: 'widget_blocked',
        canvasKind,
        timestamp: new Date().toISOString(),
        payload: { reason: 'edge_limit_reached', limit: policy.maxEdges }
      });
      return;
    }
    
    setEdges((eds) => addEdge(connection, eds));
    
    emitEvent({
      type: 'edge_add',
      canvasKind,
      timestamp: new Date().toISOString(),
      payload: { source: connection.source, target: connection.target }
    });
  }, [checkRateLimit, policy, edges.length, canvasKind]);
  
  // ===========================================================================
  // Widget Operations
  // ===========================================================================
  
  const addWidget = useCallback((
    widgetType: TWidget,
    position: { x: number; y: number },
    data?: Partial<WidgetNodeData<TWidget>>
  ) => {
    // Check node limit
    if (policy.maxNodes && nodes.length >= policy.maxNodes) {
      logger.warn('Node limit reached', { canvasKind, limit: policy.maxNodes });
      emitEvent({
        type: 'widget_blocked',
        canvasKind,
        timestamp: new Date().toISOString(),
        payload: { reason: 'node_limit_reached', limit: policy.maxNodes }
      });
      return null;
    }
    
    // Validate with registry
    const validation = registry.guardCreate({
      widgetType,
      title: data?.title,
      payload: data?.payload,
      meta: data?.meta
    });
    
    if (!validation.valid) {
      logger.warn('Widget creation blocked', {
        canvasKind,
        widgetType,
        errors: validation.errors
      });
      emitEvent({
        type: 'widget_blocked',
        canvasKind,
        timestamp: new Date().toISOString(),
        payload: { widgetType, errors: validation.errors }
      });
      return null;
    }
    
    // Create node
    const nodeId = `${canvasKind}-${widgetType}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const definition = registry.getDefinition(widgetType);
    
    const newNode: Node = {
      id: nodeId,
      type: 'widget',
      position,
      data: {
        widgetType,
        title: data?.title,
        payload: data?.payload,
        meta: data?.meta
      },
      ...(definition?.defaultSize ? {
        style: {
          width: definition.defaultSize.width,
          height: definition.defaultSize.height
        }
      } : {})
    };
    
    setNodes((nds) => [...nds, newNode]);
    
    emitEvent({
      type: 'widget_add',
      canvasKind,
      timestamp: new Date().toISOString(),
      payload: { nodeId, widgetType }
    });
    
    logger.info('Widget added', { canvasKind, nodeId, widgetType });
    
    return nodeId;
  }, [canvasKind, registry, policy, nodes.length]);
  
  // ===========================================================================
  // Node Types
  // ===========================================================================
  
  const nodeTypes: NodeTypes = useMemo(() => {
    const types: NodeTypes = {};
    
    // Register all widget renderers as node types
    for (const definition of registry.getAllDefinitions()) {
      types[definition.type] = ({ data, id, selected }) => {
        const handleUpdate = (updates: Partial<WidgetNodeData<TWidget>>) => {
          const validation = registry.guardUpdate(
            definition.type as TWidget,
            data,
            updates
          );
          
          if (!validation.valid) {
            logger.warn('Widget update blocked', {
              canvasKind,
              nodeId: id,
              errors: validation.errors
            });
            return;
          }
          
          setNodes((nds) =>
            nds.map((n) =>
              n.id === id ? { ...n, data: { ...n.data, ...updates } } : n
            )
          );
          
          emitEvent({
            type: 'widget_update',
            canvasKind,
            timestamp: new Date().toISOString(),
            payload: { nodeId: id, updates }
          });
        };
        
        const handleDelete = () => {
          setNodes((nds) => nds.filter((n) => n.id !== id));
          emitEvent({
            type: 'widget_delete',
            canvasKind,
            timestamp: new Date().toISOString(),
            payload: { nodeId: id }
          });
        };
        
        const WidgetRenderer = definition.renderer;
        
        return (
          <WidgetRenderer
            widgetType={definition.type as TWidget}
            data={data}
            nodeId={id}
            selected={selected}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        );
      };
    }
    
    return types;
  }, [registry, canvasKind]);
  
  // ===========================================================================
  // Render
  // ===========================================================================
  
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: theme.background,
      }}
      role="application"
      aria-label={`${canvasKind} canvas`}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
        minZoom={0.1}
        maxZoom={4}
        onlyRenderVisibleElements={true}
        proOptions={{ hideAttribution: false }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color={theme.gridColor}
        />
        <Controls showInteractive={a11y.enableKeyboardNav} />
        {/* MiniMap optional based on canvas size */}
        {nodes.length > 20 && (
          <MiniMap
            nodeColor={(n) => n.selected ? theme.selectedNodeBorder : theme.nodeBorder}
            maskColor="rgba(0, 0, 0, 0.5)"
          />
        )}
      </ReactFlow>
    </div>
  );
}

// =============================================================================
// Wrapped with ReactFlowProvider
// =============================================================================

export function BaseCanvas<TWidget extends WidgetType = WidgetType>(
  props: BaseCanvasProps<TWidget>
) {
  return (
    <ReactFlowProvider>
      <BaseCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

export default BaseCanvas;
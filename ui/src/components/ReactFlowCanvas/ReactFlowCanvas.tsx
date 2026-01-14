/**
 * ReactFlowCanvas Component
 * 
 * Infinite canvas for agent visualization using React Flow.
 * Replaces the previous JSONCanvas with a production-ready solution.
 * 
 * Features:
 * - YJS CRDT synchronization for real-time collaboration
 * - Custom agent node components
 * - Mini map, controls, background grid
 * - Keyboard shortcuts and accessibility
 */

import { useCallback } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  Panel,
  NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { AgentNode } from './nodes/AgentNode';
import { useTerminal } from '../../hooks/useTerminal';
import { useReactFlowYJS } from '../../hooks/useReactFlowYJS';
import styles from './ReactFlowCanvas.module.css';

// ============================================================================
// Node Types
// ============================================================================

const nodeTypes = {
  'agent': AgentNode,
  'agent:mcp': AgentNode,
  'agent:multi': AgentNode,
  'agent:orchestrated': AgentNode,
} as NodeTypes;

// ============================================================================
// Props
// ============================================================================

export interface ReactFlowCanvasProps {
  /** Optional initial nodes */
  initialNodes?: Node[];
  /** Optional initial edges */
  initialEdges?: Edge[];
  /** Viewport change callback */
  onViewportChange?: (viewport: { x: number; y: number; zoom: number }) => void;
  /** Node selection callback */
  onNodeSelect?: (nodeId: string | null) => void;
  /** Selected node ID */
  selectedNodeId?: string | null;
}

// ============================================================================
// Component
// ============================================================================

export function ReactFlowCanvas({
  initialNodes = [],
  initialEdges = [],
  onViewportChange,
  onNodeSelect,
  selectedNodeId,
}: ReactFlowCanvasProps) {
  const { doc, connected } = useTerminal({
    terminalId: 'default',
    autoConnect: true
  });
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // YJS synchronization
  useReactFlowYJS(doc, nodes, edges, setNodes, setEdges);

  // Handle new connections
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Handle node click
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeSelect?.(node.id);
    },
    [onNodeSelect]
  );

  // Handle pane click (deselect)
  const onPaneClick = useCallback(() => {
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  // Handle viewport change
  const onMoveEnd = useCallback(
    () => {
      // Viewport change handled by React Flow internally
      // onViewportChange can be called from other hooks if needed
    },
    [onViewportChange]
  );

  // Mini map node color
  const miniMapNodeColor = useCallback((node: Node) => {
    if (node.id === selectedNodeId) return 'var(--color-primary)';
    if (node.type?.includes('agent')) return 'var(--color-success)';
    return 'var(--color-bg-tertiary)';
  }, [selectedNodeId]);

  return (
    <div className={styles.container}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onMoveEnd={onMoveEnd}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={16} 
          size={1}
          className={styles.background}
        />
        <Controls 
          className={styles.controls}
          showInteractive={false}
        />
        <MiniMap 
          nodeColor={miniMapNodeColor}
          className={styles.minimap}
          maskColor="rgba(0, 0, 0, 0.3)"
        />
        {!connected && (
          <Panel position="top-center" className={styles.statusPanel}>
            <div className={styles.statusBadge}>
              ⚠️ Disconnected - Changes not synced
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
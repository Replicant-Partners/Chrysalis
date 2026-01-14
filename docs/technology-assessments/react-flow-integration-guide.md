# React Flow Integration Guide for Chrysalis

**Quick Start**: Practical implementation guide for integrating React Flow into Chrysalis canvas system.

---

## Installation

```bash
cd ui
npm install @xyflow/react
```

**Dependencies Added**:
- `@xyflow/react`: ^12.x (core library)
- Peer dependencies: React 18+ (already installed)

---

## Basic Setup

### 1. Create Canvas Component

```typescript
// ui/src/components/ReactFlowCanvas/ReactFlowCanvas.tsx
import { useCallback, useState } from 'react';
import ReactFlow, {
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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { AgentNode } from './nodes/AgentNode';
import { useTerminal } from '../../hooks/useTerminal';
import { useReactFlowYJS } from '../../hooks/useReactFlowYJS';

const nodeTypes = {
  'agent:mcp': AgentNode,
  'agent:multi': AgentNode,
  'agent:orchestrated': AgentNode,
};

export function ReactFlowCanvas() {
  const { doc, connected } = useTerminal();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // YJS synchronization
  useReactFlowYJS(doc, nodes, edges, setNodes, setEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}
```

---

## Custom Agent Node

### 2. Create Agent Node Component

```typescript
// ui/src/components/ReactFlowCanvas/nodes/AgentNode.tsx
import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { useTerminal } from '../../../hooks/useTerminal';
import styles from './AgentNode.module.css';

export interface AgentNodeData {
  agentId: string;
  agentName: string;
  agentType: 'mcp' | 'multi-agent' | 'orchestrated';
  state: 'active' | 'idle' | 'error';
  role: string;
  tools?: Array<{ name: string }>;
}

export const AgentNode = memo(({ data, selected }: NodeProps<AgentNodeData>) => {
  const terminal = useTerminal();

  const handleExecute = () => {
    terminal.actions.sendAgentMessage(data.agentId, { command: 'execute' });
  };

  const getStateColor = () => {
    switch (data.state) {
      case 'active': return 'var(--color-success)';
      case 'idle': return 'var(--color-text-tertiary)';
      case 'error': return 'var(--color-error)';
      default: return 'var(--color-text-secondary)';
    }
  };

  const getTypeIcon = () => {
    switch (data.agentType) {
      case 'mcp': return '🔧';
      case 'multi-agent': return '👥';
      case 'orchestrated': return '🎯';
      default: return '🤖';
    }
  };

  return (
    <div className={`${styles.agentNode} ${selected ? styles.selected : ''}`}>
      <Handle type="target" position={Position.Left} id="input" />
      
      <div className={styles.header}>
        <span className={styles.icon}>{getTypeIcon()}</span>
        <span className={styles.name}>{data.agentName}</span>
        <div 
          className={styles.statusDot} 
          style={{ backgroundColor: getStateColor() }}
        />
      </div>

      <div className={styles.body}>
        <div className={styles.role}>{data.role}</div>
        {data.tools && data.tools.length > 0 && (
          <div className={styles.tools}>
            {data.tools.slice(0, 3).map(tool => (
              <span key={tool.name} className={styles.tool}>
                {tool.name}
              </span>
            ))}
            {data.tools.length > 3 && (
              <span className={styles.toolMore}>+{data.tools.length - 3}</span>
            )}
          </div>
        )}
      </div>

      <div className={styles.actions}>
        <button onClick={handleExecute} className={styles.executeBtn}>
          Execute
        </button>
      </div>

      <Handle type="source" position={Position.Right} id="output" />
    </div>
  );
});

AgentNode.displayName = 'AgentNode';
```

### 3. Agent Node Styles

```css
/* ui/src/components/ReactFlowCanvas/nodes/AgentNode.module.css */
.agentNode {
  padding: 0;
  border-radius: 8px;
  background: var(--color-bg-secondary);
  border: 2px solid var(--color-border);
  min-width: 200px;
  font-family: var(--font-family);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.2s ease;
}

.agentNode:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.agentNode.selected {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-alpha);
}

.header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: var(--color-bg-tertiary);
  border-bottom: 1px solid var(--color-border);
}

.icon {
  font-size: 20px;
}

.name {
  flex: 1;
  font-weight: 600;
  font-size: 14px;
  color: var(--color-text-primary);
}

.statusDot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.body {
  padding: 12px;
}

.role {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}

.tools {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tool {
  background: var(--color-bg-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  color: var(--color-text-secondary);
}

.toolMore {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.actions {
  padding: 8px 12px;
  border-top: 1px solid var(--color-border);
}

.executeBtn {
  width: 100%;
  padding: 6px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.executeBtn:hover {
  background: var(--color-primary-hover);
}
```

---

## YJS Synchronization

### 4. Create YJS Hook

```typescript
// ui/src/hooks/useReactFlowYJS.ts
import { useEffect, useRef, useCallback } from 'react';
import { Node, Edge } from '@xyflow/react';
import * as Y from 'yjs';
import { useDebouncedCallback } from 'use-debounce';

export function useReactFlowYJS(
  doc: Y.Doc,
  nodes: Node[],
  edges: Edge[],
  setNodes: (nodes: Node[]) => void,
  setEdges: (edges: Edge[]) => void
) {
  const yNodes = useRef<Y.Array<Node>>();
  const yEdges = useRef<Y.Array<Edge>>();
  const isUpdatingFromYJS = useRef(false);

  // Initialize YJS arrays
  useEffect(() => {
    if (!doc) return;

    yNodes.current = doc.getArray<Node>('canvas_nodes');
    yEdges.current = doc.getArray<Edge>('canvas_edges');

    // Initial load
    setNodes(yNodes.current.toArray());
    setEdges(yEdges.current.toArray());

    // YJS → React Flow
    const handleYJSUpdate = () => {
      if (!yNodes.current || !yEdges.current) return;
      
      isUpdatingFromYJS.current = true;
      setNodes(yNodes.current.toArray());
      setEdges(yEdges.current.toArray());
      setTimeout(() => {
        isUpdatingFromYJS.current = false;
      }, 0);
    };

    yNodes.current.observe(handleYJSUpdate);
    yEdges.current.observe(handleYJSUpdate);

    return () => {
      yNodes.current?.unobserve(handleYJSUpdate);
      yEdges.current?.unobserve(handleYJSUpdate);
    };
  }, [doc, setNodes, setEdges]);

  // React Flow → YJS (debounced)
  const syncToYJS = useDebouncedCallback(
    useCallback(() => {
      if (!doc || !yNodes.current || !yEdges.current || isUpdatingFromYJS.current) {
        return;
      }

      doc.transact(() => {
        yNodes.current!.delete(0, yNodes.current!.length);
        yNodes.current!.push(nodes);
        yEdges.current!.delete(0, yEdges.current!.length);
        yEdges.current!.push(edges);
      });
    }, [doc, nodes, edges]),
    100 // 100ms debounce
  );

  useEffect(() => {
    if (!isUpdatingFromYJS.current) {
      syncToYJS();
    }
  }, [nodes, edges, syncToYJS]);
}
```

---

## Integration with ThreeFrameLayout

### 5. Replace JSONCanvas

```typescript
// ui/src/App.tsx
import { ReactFlowCanvas } from './components/ReactFlowCanvas/ReactFlowCanvas';

// In AppContent component, replace centerPane:
centerPane={
  <div style={{ 
    height: '100%', 
    display: 'flex', 
    flexDirection: 'column',
    background: 'var(--color-slate-900)'
  }}>
    <div style={{ 
      padding: 'var(--space-4)', 
      borderBottom: '1px solid var(--color-slate-800)',
      background: 'var(--color-slate-850)'
    }}>
      <h2 style={{ 
        margin: 0, 
        fontSize: 'var(--font-size-lg)',
        fontWeight: 'var(--font-weight-semibold)',
        color: 'var(--color-text-primary)'
      }}>
        {activeCanvas?.title}
      </h2>
    </div>
    <div style={{ flex: 1, overflow: 'hidden' }}>
      <ReactFlowCanvas />
    </div>
  </div>
}
```

---

## Testing

### 6. Unit Tests

```typescript
// ui/src/components/ReactFlowCanvas/__tests__/AgentNode.test.tsx
import { render, screen } from '@testing-library/react';
import { NodeProps } from '@xyflow/react';
import { AgentNode, AgentNodeData } from '../nodes/AgentNode';

const mockNodeProps: NodeProps<AgentNodeData> = {
  id: 'test-1',
  data: {
    agentId: 'agent-1',
    agentName: 'Test Agent',
    agentType: 'mcp',
    state: 'active',
    role: 'Test Role',
    tools: [{ name: 'tool1' }, { name: 'tool2' }]
  },
  selected: false,
  isConnectable: true,
  xPos: 0,
  yPos: 0,
  dragging: false,
  zIndex: 0,
  type: 'agent:mcp',
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
};

describe('AgentNode', () => {
  it('renders agent name correctly', () => {
    render(<AgentNode {...mockNodeProps} />);
    expect(screen.getByText('Test Agent')).toBeInTheDocument();
  });

  it('displays correct icon for MCP agent', () => {
    render(<AgentNode {...mockNodeProps} />);
    expect(screen.getByText('🔧')).toBeInTheDocument();
  });

  it('shows tool badges', () => {
    render(<AgentNode {...mockNodeProps} />);
    expect(screen.getByText('tool1')).toBeInTheDocument();
    expect(screen.getByText('tool2')).toBeInTheDocument();
  });
});
```

---

## Performance Optimization

### 7. Memoization

```typescript
// Memoize node component
export const AgentNode = memo(({ data, selected }: NodeProps<AgentNodeData>) => {
  // ... component code
}, (prev, next) => {
  // Custom comparison
  return (
    prev.data.agentId === next.data.agentId &&
    prev.data.state === next.data.state &&
    prev.selected === next.selected
  );
});
```

### 8. Virtualization for Large Graphs

```typescript
// React Flow handles virtualization automatically
// But you can optimize further:
<ReactFlow
  nodes={nodes}
  edges={edges}
  onlyRenderVisibleElements={true} // Only render visible nodes
  elevateNodesOnSelect={true} // Performance optimization
/>
```

---

## Migration Utilities

### 9. JSONCanvas Conversion

```typescript
// ui/src/utils/canvasConversion.ts
import { Node, Edge } from '@xyflow/react';

interface JSONCanvas {
  nodes: Array<{
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
    text?: string;
  }>;
  edges: Array<{
    id: string;
    fromNode: string;
    toNode: string;
    fromSide?: string;
    toSide?: string;
  }>;
}

export function jsonCanvasToReactFlow(canvas: JSONCanvas): { 
  nodes: Node[]; 
  edges: Edge[]; 
} {
  const nodes: Node[] = canvas.nodes.map(node => ({
    id: node.id,
    type: 'agent:mcp', // Default type
    position: { x: node.x, y: node.y },
    data: {
      label: node.text || 'Untitled',
      agentId: node.id,
      agentName: node.text || 'Untitled',
      agentType: 'mcp',
      state: 'idle',
      role: 'Agent'
    },
    style: {
      width: node.width,
      height: node.height,
    }
  }));

  const edges: Edge[] = canvas.edges.map(edge => ({
    id: edge.id,
    source: edge.fromNode,
    target: edge.toNode,
    sourceHandle: edge.fromSide || 'right',
    targetHandle: edge.toSide || 'left',
  }));

  return { nodes, edges };
}
```

---

## Troubleshooting

### Common Issues

**Issue**: Nodes not dragging
```typescript
// Ensure nodesDraggable is not disabled
<ReactFlow nodesDraggable={true} />
```

**Issue**: YJS sync conflicts
```typescript
// Add transaction wrapping
doc.transact(() => {
  // All updates here are atomic
});
```

**Issue**: Performance degradation with 500+ nodes
```typescript
// Enable performance optimizations
<ReactFlow
  nodes={nodes}
  onlyRenderVisibleElements={true}
  elevateNodesOnSelect={true}
  zoomOnScroll={true}
  panOnScroll={false}
/>
```

---

## Next Steps

1. ✅ Follow this guide to implement basic React Flow canvas
2. ✅ Test with 10 agent nodes
3. ✅ Verify YJS synchronization with multiple clients
4. ✅ Measure performance and bundle size
5. ✅ Integrate with existing Chrysalis features

---

## Resources

- [React Flow Documentation](https://reactflow.dev/learn)
- [React Flow Examples](https://reactflow.dev/examples)
- [YJS Documentation](https://docs.yjs.dev)
- [Chrysalis Architecture](../architecture/overview.md)
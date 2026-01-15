/**
 * Graph View Component
 * 
 * Interactive relationship graph using @xyflow/react
 */

import React, { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Download, Network } from 'lucide-react';
import { Button } from '../design-system';
import { getArtifactTypeColor, getRelationshipTypeLabel } from './utils';
import type { Artifact, Relationship } from './types';
import styles from './GraphView.module.css';

interface GraphViewProps {
  artifacts: Artifact[];
  relationships: Relationship[];
}

// Custom node component
const ArtifactNode = ({ data }: { data: { artifact: Artifact; relationshipCount: number } }) => {
  const { artifact, relationshipCount } = data;
  const color = getArtifactTypeColor(artifact.type);
  
  return (
    <div className={styles.node} style={{ borderColor: color }}>
      <div className={styles.nodeHeader} style={{ background: color + '20' }}>
        <span className={styles.nodeType}>{artifact.type}</span>
        {relationshipCount > 0 && (
          <span className={styles.nodeCount}>{relationshipCount}</span>
        )}
      </div>
      <div className={styles.nodeBody}>
        <div className={styles.nodeTitle}>{artifact.title}</div>
        {artifact.tags.length > 0 && (
          <div className={styles.nodeTags}>
            {artifact.tags.slice(0, 2).map(tag => (
              <span key={tag} className={styles.nodeTag}>#{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const nodeTypes = {
  artifact: ArtifactNode,
};

export const GraphView: React.FC<GraphViewProps> = ({
  artifacts,
  relationships,
}) => {
  // Convert artifacts to nodes
  const initialNodes: Node[] = useMemo(() => {
    const relationshipCounts: Record<string, number> = {};
    relationships.forEach((rel) => {
      relationshipCounts[rel.sourceId] = (relationshipCounts[rel.sourceId] || 0) + 1;
      relationshipCounts[rel.targetId] = (relationshipCounts[rel.targetId] || 0) + 1;
    });
    
    return artifacts.map((artifact, index) => ({
      id: artifact.id,
      type: 'artifact',
      position: {
        x: (index % 5) * 250 + 50,
        y: Math.floor(index / 5) * 200 + 50,
      },
      data: {
        artifact,
        relationshipCount: relationshipCounts[artifact.id] || 0,
      },
    }));
  }, [artifacts, relationships]);
  
  // Convert relationships to edges
  const initialEdges: Edge[] = useMemo(() => {
    return relationships.map((rel) => ({
      id: rel.id,
      source: rel.sourceId,
      target: rel.targetId,
      type: 'smoothstep',
      label: getRelationshipTypeLabel(rel.type),
      animated: rel.type === 'builds-on' || rel.type === 'derives-from',
      style: {
        stroke: rel.confidence && rel.confidence > 80
          ? 'var(--color-cyan-400)'
          : rel.confidence && rel.confidence > 40
          ? 'var(--color-slate-400)'
          : 'var(--color-slate-600)',
        strokeWidth: 2,
      },
      labelStyle: {
        fontSize: 12,
        fill: 'var(--color-text-tertiary)',
      },
      labelBgStyle: {
        fill: 'var(--color-slate-800)',
        fillOpacity: 0.9,
      },
    }));
  }, [relationships]);
  
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  
  const onConnect = useCallback(
    (connection: Connection) => {
      console.log('New connection:', connection);
      // TODO: Create new relationship
    },
    []
  );
  
  const handleExportMermaid = () => {
    const artifactMap = new Map(artifacts.map(a => [a.id, a]));
    
    let mermaid = 'graph TD\n';
    
    artifacts.forEach((artifact) => {
      const label = artifact.title.replace(/[[\]]/g, ''); // Remove brackets
      mermaid += `    ${artifact.id}[${label}]\n`;
    });
    
    mermaid += '\n';
    
    relationships.forEach((rel) => {
      const source = artifactMap.get(rel.sourceId);
      const target = artifactMap.get(rel.targetId);
      
      if (source && target) {
        let arrow = '-->'; // Default
        
        if (rel.type === 'builds-on' || rel.type === 'derives-from') {
          arrow = '==>';
        } else if (rel.type === 'contradicts') {
          arrow = '-.->'; 
        } else if (rel.type === 'related-to') {
          arrow = '---';
        }
        
        const label = getRelationshipTypeLabel(rel.type);
        mermaid += `    ${rel.sourceId} ${arrow}|${label}| ${rel.targetId}\n`;
      }
    });
    
    console.log('Mermaid diagram:\n', mermaid);
    
    // Copy to clipboard
    navigator.clipboard.writeText(mermaid).then(() => {
      alert('Mermaid diagram copied to clipboard!');
    });
  };
  
  if (artifacts.length === 0) {
    return (
      <div className={styles.empty}>
        <Network size={64} className={styles.emptyIcon} />
        <h3 className={styles.emptyTitle}>No artifacts to visualize</h3>
        <p className={styles.emptyText}>
          Add artifacts and create relationships to see the knowledge graph
        </p>
      </div>
    );
  }
  
  return (
    <div className={styles.graphContainer}>
      <div className={styles.graphHeader}>
        <div className={styles.graphInfo}>
          <Network size={18} />
          <span>{artifacts.length} nodes • {relationships.length} connections</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          iconBefore={<Download size={16} />}
          onClick={handleExportMermaid}
        >
          Export Mermaid
        </Button>
      </div>
      
      <div className={styles.graphCanvas}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-right"
        >
          <Background />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              const artifact = (node.data as { artifact: Artifact }).artifact;
              return getArtifactTypeColor(artifact.type);
            }}
          />
        </ReactFlow>
      </div>
    </div>
  );
};
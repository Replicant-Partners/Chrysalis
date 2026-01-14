/**
 * AgentNode Component
 * 
 * Custom React Flow node for rendering Chrysalis agents.
 * Displays agent state, tools, and provides execution controls.
 */

import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { useTerminal } from '../../../hooks/useTerminal';
import styles from './AgentNode.module.css';

// ============================================================================
// Types
// ============================================================================

export interface AgentNodeData {
  agentId?: string;
  agentName?: string;
  agentType?: 'mcp' | 'multi-agent' | 'orchestrated';
  state?: 'active' | 'idle' | 'error' | 'dormant';
  role?: string;
  tools?: Array<{ name: string }>;
  label?: string;
}

// ============================================================================
// Component
// ============================================================================

export const AgentNode = memo(({ data, selected }: NodeProps<any>) => {
  const terminal = useTerminal({
    terminalId: 'default',
    autoConnect: true
  });

  const agentName = data?.agentName || data?.label || 'Untitled Agent';
  const agentType = data?.agentType || 'mcp';
  const state = data?.state || 'idle';
  const role = data?.role || 'Agent';

  const handleExecute = () => {
    if (data?.agentId) {
      terminal.actions.sendAgentMessage(data.agentId);
    }
  };

  const getStateColor = () => {
    switch (state) {
      case 'active': return 'var(--color-success)';
      case 'idle': return 'var(--color-text-tertiary)';
      case 'error': return 'var(--color-error)';
      case 'dormant': return 'var(--color-text-muted)';
      default: return 'var(--color-text-secondary)';
    }
  };

  const getTypeIcon = () => {
    switch (agentType) {
      case 'mcp': return '🔧';
      case 'multi-agent': return '👥';
      case 'orchestrated': return '🎯';
      default: return '🤖';
    }
  };

  return (
    <div className={`${styles.agentNode} ${selected ? styles.selected : ''}`}>
      <Handle 
        type="target" 
        position={Position.Left} 
        id="input"
        className={styles.handle}
      />
      
      <div className={styles.header}>
        <span className={styles.icon}>{getTypeIcon()}</span>
        <span className={styles.name}>{agentName}</span>
        <div 
          className={styles.statusDot} 
          style={{ backgroundColor: getStateColor() }}
          title={`Status: ${state}`}
        />
      </div>

      <div className={styles.body}>
        <div className={styles.role}>{role}</div>
        {data?.tools && data.tools.length > 0 && (
          <div className={styles.tools}>
            {data.tools.slice(0, 3).map((tool: any, idx: number) => (
              <span key={idx} className={styles.tool}>
                {tool.name}
              </span>
            ))}
            {data.tools.length > 3 && (
              <span className={styles.toolMore}>+{data.tools.length - 3}</span>
            )}
          </div>
        )}
      </div>

      {data?.agentId && (
        <div className={styles.actions}>
          <button onClick={handleExecute} className={styles.executeBtn}>
            Execute
          </button>
        </div>
      )}

      <Handle 
        type="source" 
        position={Position.Right} 
        id="output"
        className={styles.handle}
      />
    </div>
  );
});

AgentNode.displayName = 'AgentNode';
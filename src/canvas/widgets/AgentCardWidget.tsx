import React from 'react';
import type { WidgetProps, WidgetNodeData } from '../types';

export interface AgentCardData extends WidgetNodeData {
  agentName: string;
  state: 'created' | 'stopped' | 'running' | 'auto-run' | 'error';
  memoryStack?: string;
}

export const AgentCardWidget: React.FC<WidgetProps<AgentCardData>> = ({ data }) => {
  const stateColors = {
    created: '#gray',
    stopped: '#888',
    running: '#4caf50',
    'auto-run': '#2196f3',
    error: '#f44336',
  };

  return (
    <div style={{
      padding: 16,
      background: 'white',
      border: `2px solid ${stateColors[data.state]}`,
      borderRadius: 8,
      minWidth: 200,
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontWeight: 'bold', fontSize: 16 }}>{data.agentName}</div>
        <div style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: stateColors[data.state]
        }} />
      </div>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
        {data.state.toUpperCase()}
      </div>
      {data.memoryStack && (
        <div style={{ fontSize: 12, color: '#2196f3' }}>
          Memory: {data.memoryStack}
        </div>
      )}
    </div>
  );
};

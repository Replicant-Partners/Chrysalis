import React, { useState } from 'react';

import type { WidgetProps, WidgetNodeData } from '../types';

export interface HypothesisWidgetData extends WidgetNodeData {
  statement: string;
  evidence: string[];
  status: 'proposed' | 'testing' | 'validated' | 'refuted';
}

export const HypothesisWidget: React.FC<WidgetProps<HypothesisWidgetData>> = ({ data, onDataChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusColor = (): string => {
    switch (data.status) {
      case 'validated':
        return '#4caf50';
      case 'refuted':
        return '#f44336';
      case 'testing':
        return '#ff9800';
      default:
        return '#2196f3';
    }
  };

  const getStatusIcon = (): string => {
    switch (data.status) {
      case 'validated':
        return '✓';
      case 'refuted':
        return '✗';
      case 'testing':
        return '🔬';
      default:
        return '❓';
    }
  };

  return (
    <div style={{
      padding: '16px',
      background: 'white',
      border: `3px solid ${getStatusColor()}`,
      borderRadius: '8px',
      minWidth: '300px',
      maxWidth: '450px',
      boxShadow: '0 3px 8px rgba(0,0,0,0.12)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontWeight: 'bold', color: '#333' }}>
          {getStatusIcon()} {data.label}
        </div>
        <div style={{
          padding: '4px 10px',
          background: getStatusColor(),
          color: 'white',
          fontSize: '11px',
          borderRadius: '12px',
          fontWeight: 500
        }}>
          {data.status.toUpperCase()}
        </div>
      </div>

      <div style={{
        fontSize: '14px',
        lineHeight: 1.6,
        color: '#333',
        marginBottom: '12px',
        fontStyle: 'italic'
      }}>
        "{data.statement}"
      </div>

      {data.evidence.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              background: '#e0e0e0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginBottom: '8px'
            }}
          >
            {isExpanded ? '▼' : '▶'} Evidence ({data.evidence.length})
          </button>
          
          {isExpanded && (
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#666' }}>
              {data.evidence.map((item, idx) => (
                <li key={idx} style={{ marginBottom: '4px' }}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default HypothesisWidget;

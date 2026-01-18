import React, { useState } from 'react';

import type { WidgetProps, WidgetNodeData } from '../types';

export interface ArtifactWidgetData extends WidgetNodeData {
  artifactType: 'code' | 'text' | 'image' | 'data';
  content: string;
  language?: string;
  source?: string;
}

export const ArtifactWidget: React.FC<WidgetProps<ArtifactWidgetData>> = ({ data,  onDataChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getTypeIcon = (): string => {
    switch (data.artifactType) {
      case 'code':
        return '💻';
      case 'text':
        return '📄';
      case 'image':
        return '🖼️';
      case 'data':
        return '📊';
      default:
        return '📦';
    }
  };

  const getTypeColor = (): string => {
    switch (data.artifactType) {
      case 'code':
        return '#e3f2fd';
      case 'text':
        return '#f5f5f5';
      case 'image':
        return '#fce4ec';
      case 'data':
        return '#e8f5e9';
      default:
        return '#fff';
    }
  };

  return (
    <div style={{
      padding: '16px',
      background: getTypeColor(),
      border: '2px solid #ddd',
      borderRadius: '8px',
      minWidth: '250px',
      maxWidth: '400px',
      boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontWeight: 'bold', color: '#333' }}>
          {getTypeIcon()} {data.label}
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            padding: '4px 8px',
            fontSize: '12px',
            background: '#e0e0e0',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {data.language && (
        <div style={{ fontSize: '11px', color: '#666', marginBottom: '8px' }}>
          Language: <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{data.language}</span>
        </div>
      )}

      {data.source && (
        <div style={{ fontSize: '11px', color: '#666', marginBottom: '8px' }}>
          Source: {data.source}
        </div>
      )}

      <div style={{
        background: data.artifactType === 'code' ? '#263238' : '#f9f9f9',
        color: data.artifactType === 'code' ? '#aed581' : '#333',
        padding: '12px',
        borderRadius: '4px',
        fontFamily: data.artifactType === 'code' ? 'monospace' : 'inherit',
        fontSize: data.artifactType === 'code' ? '13px' : '14px',
        maxHeight: isExpanded ? 'none' : '100px',
        overflow: isExpanded ? 'auto' : 'hidden',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
      }}>
        {data.content}
      </div>

      {!isExpanded && data.content.length > 200 && (
        <div style={{ fontSize: '11px', color: '#999', marginTop: '6px', textAlign: 'center' }}>
          Click to expand...
        </div>
      )}
    </div>
  );
};

export default ArtifactWidget;

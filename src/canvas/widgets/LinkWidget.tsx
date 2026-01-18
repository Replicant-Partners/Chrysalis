import React from 'react';

import type { WidgetProps, WidgetNodeData } from '../types';

export interface LinkWidgetData extends WidgetNodeData {
  url: string;
  title?: string;
  description?: string;
}

export const LinkWidget: React.FC<WidgetProps<LinkWidgetData>> = ({ data }) => {
  return (
    <div style={{
      padding: '12px',
      background: 'white',
      border: '2px solid #2196f3',
      borderRadius: '8px',
      minWidth: '200px',
      maxWidth: '300px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#1976d2' }}>
        🔗 {data.label}
      </div>
      {data.title && (
        <div style={{ fontSize: '14px', marginBottom: '6px', color: '#333' }}>
          {data.title}
        </div>
      )}
      {data.description && (
        <div style={{ fontSize: '12px', marginBottom: '8px', color: '#666' }}>
          {data.description}
        </div>
      )}
      <a
        href={data.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: '12px',
          color: '#2196f3',
          textDecoration: 'none',
          wordBreak: 'break-all'
        }}
      >
        {data.url}
      </a>
    </div>
  );
};

export default LinkWidget;

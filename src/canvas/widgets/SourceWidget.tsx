import React from 'react';
import type { WidgetProps, WidgetNodeData } from '../types';

export interface SourceWidgetData extends WidgetNodeData {
  url?: string;
  citation?: string;
  excerpt?: string;
}

export const SourceWidget: React.FC<WidgetProps<SourceWidgetData>> = ({ data }) => {
  return (
    <div style={{ padding: 16, background: 'white', border: '2px solid #2196f3', borderRadius: 8, minWidth: 250, maxWidth: 400 }}>
      <div style={{ fontWeight: 'bold', marginBottom: 8 }}>{data.label}</div>
      {data.url && (
        <a href={data.url} target="_blank" rel="noopener noreferrer" style={{ color: '#2196f3', fontSize: 12, display: 'block', marginBottom: 8 }}>
          {data.url}
        </a>
      )}
      {data.citation && (
        <div style={{ fontSize: 11, color: '#666', fontStyle: 'italic', marginBottom: 8 }}>
          {data.citation}
        </div>
      )}
      {data.excerpt && (
        <div style={{ fontSize: 13, lineHeight: 1.5 }}>
          {data.excerpt}
        </div>
      )}
    </div>
  );
};

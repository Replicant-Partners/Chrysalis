import React from 'react';

import type { WidgetProps, WidgetNodeData } from '../types';

export interface CitationWidgetData extends WidgetNodeData {
  authors: string[];
  title: string;
  year: number;
  doi?: string;
  notes?: string;
}

export const CitationWidget: React.FC<WidgetProps<CitationWidgetData>> = ({ data }) => {
  return (
    <div style={{
      padding: '16px',
      background: '#f9f9f9',
      border: '2px solid #9c27b0',
      borderRadius: '8px',
      minWidth: '300px',
      maxWidth: '450px',
      boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
    }}>
      <div style={{ fontWeight: 'bold', color: '#7b1fa2', marginBottom: '12px' }}>
        📚 {data.label}
      </div>
      
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '14px', fontWeight: 500, color: '#333' }}>
          {data.title}
        </div>
      </div>

      <div style={{ fontSize: '13px', color: '#555', marginBottom: '8px' }}>
        {data.authors.join(', ')} ({data.year})
      </div>

      {data.doi && (
        <div style={{
          fontSize: '11px',
          color: '#666',
          fontFamily: 'monospace',
          marginBottom: '8px',
          padding: '6px',
          background: 'white',
          borderRadius: '4px'
        }}>
          DOI: {data.doi}
        </div>
      )}

      {data.notes && (
        <div style={{
          fontSize: '12px',
          color: '#666',
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid #ddd'
        }}>
          {data.notes}
        </div>
      )}
    </div>
  );
};

export default CitationWidget;

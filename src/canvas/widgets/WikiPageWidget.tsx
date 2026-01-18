import React from 'react';

import type { WidgetProps, WidgetNodeData } from '../types';

export interface WikiPageWidgetData extends WidgetNodeData {
  title: string;
  content: string;
  categories: string[];
  lastModified: number;
}

export const WikiPageWidget: React.FC<WidgetProps<WikiPageWidgetData>> = ({ data }) => {
  return (
    <div style={{
      padding: '16px',
      background: 'white',
      border: '2px solid #00796b',
      borderRadius: '8px',
      minWidth: '300px',
      maxWidth: '500px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <div style={{
        fontWeight: 'bold',
        fontSize: '16px',
        color: '#00796b',
        marginBottom: '12px',
        borderBottom: '2px solid #00796b',
        paddingBottom: '8px'
      }}>
        📄 {data.title}
      </div>

      <div style={{
        fontSize: '14px',
        lineHeight: 1.6,
        color: '#333',
        marginBottom: '12px',
        maxHeight: '150px',
        overflow: 'hidden'
      }}>
        {data.content.substring(0, 200)}
        {data.content.length > 200 && '...'}
      </div>

      {data.categories.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          {data.categories.map((cat) => (
            <span
              key={cat}
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                margin: '4px 4px 0 0',
                background: '#e0f2f1',
                color: '#00796b',
                fontSize: '11px',
                borderRadius: '12px',
                fontWeight: 500
              }}
            >
              {cat}
            </span>
          ))}
        </div>
      )}

      <div style={{ fontSize: '10px', color: '#999', marginTop: '8px' }}>
        Last modified: {new Date(data.lastModified).toLocaleString()}
      </div>
    </div>
  );
};

export default WikiPageWidget;

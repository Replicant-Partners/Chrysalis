import React from 'react';

import type { WidgetProps, WidgetNodeData } from '../types';

export interface WikiLinkWidgetData extends WidgetNodeData {
  targetPage: string;
  linkType: 'internal' | 'external';
  description?: string;
}

export const WikiLinkWidget: React.FC<WidgetProps<WikiLinkWidgetData>> = ({ data }) => {
  return (
    <div style={{
      padding: '10px 14px',
      background: data.linkType === 'internal' ? '#e0f2f1' : '#e3f2fd',
      border: `2px solid ${data.linkType === 'internal' ? '#00796b' : '#1976d2'}`,
      borderRadius: '6px',
      minWidth: '180px',
      maxWidth: '280px',
      cursor: 'pointer',
      transition: 'transform 0.2s',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      <div style={{
        fontWeight: 500,
        color: data.linkType === 'internal' ? '#00796b' : '#1976d2',
        marginBottom: '4px'
      }}>
        {data.linkType === 'internal' ? '[[' : '↗'} {data.targetPage} {data.linkType === 'internal' ? ']]' : ''}
      </div>
      
      {data.description && (
        <div style={{ fontSize: '11px', color: '#666' }}>
          {data.description}
        </div>
      )}
    </div>
  );
};

export default WikiLinkWidget;

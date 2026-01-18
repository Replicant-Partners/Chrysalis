import React from 'react';

import type { WidgetProps, WidgetNodeData } from '../types';

export interface WikiSectionWidgetData extends WidgetNodeData {
  heading: string;
  content: string;
  level: 1 | 2 | 3;
}

export const WikiSectionWidget: React.FC<WidgetProps<WikiSectionWidgetData>> = ({ data }) => {
  const getFontSize = (): number => {
    switch (data.level) {
      case 1:
        return 18;
      case 2:
        return 16;
      case 3:
        return 14;
      default:
        return 14;
    }
  };

  return (
    <div style={{
      padding: '12px',
      background: '#f5f5f5',
      border: '1px solid #00796b',
      borderLeft: `4px solid #00796b`,
      borderRadius: '4px',
      minWidth: '280px',
      maxWidth: '450px'
    }}>
      <div style={{
        fontWeight: 'bold',
        fontSize: `${getFontSize()}px`,
        color: '#00796b',
        marginBottom: '8px'
      }}>
        {'#'.repeat(data.level)} {data.heading}
      </div>

      <div style={{
        fontSize: '13px',
        lineHeight: 1.5,
        color: '#555'
      }}>
        {data.content}
      </div>
    </div>
  );
};

export default WikiSectionWidget;

import React from 'react';

import type { WidgetProps, WidgetNodeData } from '../types';

export interface TeamGroupWidgetData extends WidgetNodeData {
  groupName: string;
  members: string[];
  purpose: string;
}

export const TeamGroupWidget: React.FC<WidgetProps<TeamGroupWidgetData>> = ({ data }) => {
  return (
    <div style={{
      padding: '16px',
      background: '#f3e5f5',
      border: '3px dashed #9c27b0',
      borderRadius: '12px',
      minWidth: '250px',
      maxWidth: '350px',
      boxShadow: '0 2px 6px rgba(156, 39, 176, 0.2)'
    }}>
      <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#7b1fa2', marginBottom: '12px' }}>
        👥 {data.groupName}
      </div>

      <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px', fontStyle: 'italic' }}>
        {data.purpose}
      </div>

      <div style={{ fontSize: '12px', color: '#444' }}>
        <div style={{ fontWeight: 500, marginBottom: '6px' }}>
          Members ({data.members.length}):
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {data.members.map((member) => (
            <span
              key={member}
              style={{
                padding: '4px 10px',
                background: 'white',
                border: '1px solid #ba68c8',
                borderRadius: '12px',
                fontSize: '11px',
                color: '#7b1fa2'
              }}
            >
              {member}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TeamGroupWidget;

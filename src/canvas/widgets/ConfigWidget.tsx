import React, { useState } from 'react';
import type { WidgetProps, WidgetNodeData } from '../types';

export interface ConfigWidgetData extends WidgetNodeData {
  key: string;
  value: string;
  description?: string;
}

export const ConfigWidget: React.FC<WidgetProps<ConfigWidgetData>> = ({
  data,
  onDataChange
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(data.value);

  const handleSave = () => {
    onDataChange?.({ value });
    setIsEditing(false);
  };

  return (
    <div style={{
      padding: '16px',
      background: 'white',
      border: '2px solid #e0e0e0',
      borderRadius: '8px',
      minWidth: '250px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>
        {data.label}
      </div>
      {data.description && (
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
          {data.description}
        </div>
      )}
      <div style={{ marginBottom: '8px', color: '#555', fontSize: '14px' }}>
        {data.key}
      </div>
      {isEditing ? (
        <div>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              marginBottom: '8px'
            }}
          />
          <button onClick={handleSave} style={{ marginRight: '8px' }}>Save</button>
          <button onClick={() => setIsEditing(false)}>Cancel</button>
        </div>
      ) : (
        <div>
          <div style={{
            padding: '8px',
            background: '#f5f5f5',
            borderRadius: '4px',
            marginBottom: '8px',
            fontFamily: 'monospace'
          }}>
            {data.value}
          </div>
          <button onClick={() => setIsEditing(true)}>Edit</button>
        </div>
      )}
    </div>
  );
};

export default ConfigWidget;

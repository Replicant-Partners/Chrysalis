import React, { useState } from 'react';

import type { WidgetProps, WidgetNodeData } from '../types';

export interface SynthesisWidgetData extends WidgetNodeData {
  summary: string;
  sources: string[];
  confidence?: 'low' | 'medium' | 'high';
}

export const SynthesisWidget: React.FC<WidgetProps<SynthesisWidgetData>> = ({ data, onDataChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [summary, setSummary] = useState(data.summary);

  const getConfidenceColor = (): string => {
    switch (data.confidence) {
      case 'high':
        return '#4caf50';
      case 'medium':
        return '#ff9800';
      case 'low':
        return '#f44336';
      default:
        return '#9e9e9e';
    }
  };

  return (
    <div style={{
      padding: '16px',
      background: '#fff8e1',
      border: '2px solid #fbc02d',
      borderRadius: '8px',
      minWidth: '350px',
      maxWidth: '500px',
      boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontWeight: 'bold', color: '#f57f17' }}>
          💡 {data.label}
        </div>
        {data.confidence && (
          <div style={{
            padding: '4px 8px',
            background: getConfidenceColor(),
            color: 'white',
            fontSize: '11px',
            borderRadius: '12px',
            fontWeight: 500
          }}>
            {data.confidence.toUpperCase()}
          </div>
        )}
      </div>

      {isEditing ? (
        <>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            style={{
              width: '100%',
              minHeight: '100px',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '13px',
              resize: 'vertical'
            }}
          />
          <div style={{ marginTop: '8px' }}>
            <button
              onClick={() => {
                onDataChange?.({ summary });
                setIsEditing(false);
              }}
              style={{
                padding: '6px 12px',
                marginRight: '8px',
                background: '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Save
            </button>
            <button
              onClick={() => {
                setSummary(data.summary);
                setIsEditing(false);
              }}
              style={{
                padding: '6px 12px',
                background: '#e0e0e0',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{
            fontSize: '14px',
            lineHeight: 1.6,
            color: '#333',
            marginBottom: '12px',
            whiteSpace: 'pre-wrap'
          }}>
            {data.summary}
          </div>
          <button
            onClick={() => setIsEditing(true)}
            style={{
              padding: '6px 12px',
              background: '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Edit
          </button>
        </>
      )}

      {data.sources.length > 0 && (
        <div style={{
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid #ddd'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 500, color: '#666', marginBottom: '6px' }}>
            Sources: {data.sources.length}
          </div>
          <div style={{ fontSize: '10px', color: '#999' }}>
            {data.sources.slice(0, 3).join(', ')}
            {data.sources.length > 3 && ` +${data.sources.length - 3} more`}
          </div>
        </div>
      )}
    </div>
  );
};

export default SynthesisWidget;

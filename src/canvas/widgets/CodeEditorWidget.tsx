import React, { useState } from 'react';

import type { WidgetProps, WidgetNodeData } from '../types';

export interface CodeEditorWidgetData extends WidgetNodeData {
  filename: string;
  language: string;
  code: string;
  isDirty: boolean;
}

export const CodeEditorWidget: React.FC<WidgetProps<CodeEditorWidgetData>> = ({ data, onDataChange }) => {
  const [code, setCode] = useState(data.code);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = (): void => {
    onDataChange?.({ code, isDirty: false });
    setIsEditing(false);
  };

  const getLanguageColor = (): string => {
    const colors: Record<string, string> = {
      typescript: '#3178c6',
      javascript: '#f7df1e',
      python: '#3776ab',
      rust: '#ce422b',
      go: '#00add8',
    };
    return colors[data.language.toLowerCase()] || '#607d8b';
  };

  return (
    <div style={{
      padding: '0',
      background: '#1e1e1e',
      border: '2px solid #333',
      borderRadius: '8px',
      minWidth: '400px',
      maxWidth: '600px',
      overflow: 'hidden',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
    }}>
      {/* Editor header */}
      <div style={{
        padding: '8px 12px',
        background: '#2d2d2d',
        borderBottom: '1px solid #444',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            padding: '2px 8px',
            background: getLanguageColor(),
            color: 'white',
            fontSize: '10px',
            borderRadius: '4px',
            fontWeight: 500
          }}>
            {data.language.toUpperCase()}
          </span>
          <span style={{ color: '#d4d4d4', fontSize: '13px' }}>
            {data.filename}
          </span>
          {data.isDirty && (
            <span style={{ color: '#ffa500', fontSize: '16px' }}>●</span>
          )}
        </div>
        {isEditing ? (
          <button
            onClick={handleSave}
            style={{
              padding: '4px 10px',
              background: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            Save
          </button>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            style={{
              padding: '4px 10px',
              background: '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            Edit
          </button>
        )}
      </div>

      {/* Code content */}
      {isEditing ? (
        <textarea
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            onDataChange?.({ isDirty: true });
          }}
          style={{
            width: '100%',
            minHeight: '200px',
            padding: '12px',
            background: '#1e1e1e',
            color: '#d4d4d4',
            border: 'none',
            fontFamily: 'Monaco, Menlo, "Courier New", monospace',
            fontSize: '13px',
            lineHeight: 1.6,
            resize: 'vertical'
          }}
        />
      ) : (
        <pre style={{
          margin: 0,
          padding: '12px',
          color: '#d4d4d4',
          fontFamily: 'Monaco, Menlo, "Courier New", monospace',
          fontSize: '13px',
          lineHeight: 1.6,
          maxHeight: '300px',
          overflow: 'auto'
        }}>
          {data.code}
        </pre>
      )}
    </div>
  );
};

export default CodeEditorWidget;

/**
 * Note Widget
 * 
 * Simple note widget for Board canvas.
 * 
 * @module canvas/widgets/NoteWidget
 */

import React, { useState, useRef, useEffect } from 'react';
import type { WidgetRendererProps } from '../types';

// =============================================================================
// Note Payload
// =============================================================================

export interface NotePayload {
  content: string;
  color?: string;
}

// =============================================================================
// Note Widget Component
// =============================================================================

export function NoteWidget(props: WidgetRendererProps<'note'>) {
  const { data, nodeId, selected, onUpdate, onDelete } = props;
  const payload = data.payload as NotePayload | undefined;
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(payload?.content || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const color = payload?.color || '#fef08a';
  
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);
  
  const handleSave = () => {
    onUpdate({
      payload: {
        ...payload,
        content,
      },
    });
    setIsEditing(false);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setContent(payload?.content || '');
      setIsEditing(false);
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSave();
    }
  };
  
  return (
    <div
      style={{
        width: '200px',
        minHeight: '150px',
        background: color,
        borderRadius: '4px',
        border: selected ? '2px solid #0ea5e9' : '1px solid #d4d4d4',
        padding: '12px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, sans-serif',
      }}
      onDoubleClick={() => setIsEditing(true)}
    >
      {/* Title */}
      <div
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: '#000',
          marginBottom: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>{data.title || 'Note'}</span>
        <button
          onClick={onDelete}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#666',
            cursor: 'pointer',
            fontSize: '16px',
            padding: 0,
            lineHeight: 1,
          }}
          aria-label="Delete note"
        >
          ×
        </button>
      </div>
      
      {/* Content */}
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.5)',
            border: '1px solid #ccc',
            borderRadius: '2px',
            padding: '8px',
            fontSize: '14px',
            color: '#000',
            resize: 'vertical',
            minHeight: '100px',
            fontFamily: 'inherit',
          }}
          placeholder="Type your note... (Cmd+Enter to save, Esc to cancel)"
        />
      ) : (
        <div
          style={{
            flex: 1,
            fontSize: '14px',
            color: '#000',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            cursor: 'text',
          }}
          onClick={() => setIsEditing(true)}
        >
          {payload?.content || 'Double-click to edit...'}
        </div>
      )}
    </div>
  );
}

export default NoteWidget;
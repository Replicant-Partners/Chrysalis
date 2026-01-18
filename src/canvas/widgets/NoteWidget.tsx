import React, { useState } from 'react';
import type { WidgetProps, WidgetNodeData } from '../types';

export interface NoteWidgetData extends WidgetNodeData {
  content: string;
  tags?: string[];
}

export const NoteWidget: React.FC<WidgetProps<NoteWidgetData>> = ({ data, onDataChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(data.content);

  return (
    <div style={{ padding: 16, background: '#fffacd', border: '1px solid #f0e68c', borderRadius: 4, minWidth: 200, maxWidth: 300 }}>
      <div style={{ fontWeight: 'bold', marginBottom: 8 }}>{data.label}</div>
      {isEditing ? (
        <>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{ width: '100%', minHeight: 80, padding: 8, border: '1px solid #ddd', borderRadius: 4 }}
          />
          <button onClick={() => { onDataChange?.({ content }); setIsEditing(false); }}>Save</button>
        </>
      ) : (
        <>
          <div style={{ whiteSpace: 'pre-wrap', marginBottom: 8 }}>{data.content}</div>
          <button onClick={() => setIsEditing(true)}>Edit</button>
        </>
      )}
      {data.tags && data.tags.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 12 }}>
          {data.tags.map((tag) => (
            <span key={tag} style={{ background: '#e0e0e0', padding: '2px 8px', borderRadius: 12, marginRight: 4 }}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';

import { tokens, ThemeMode } from '../../components/shared/tokens';

import type { WidgetProps, WidgetNodeData } from '../types';

export interface NoteWidgetData extends WidgetNodeData {
  content: string;
  tags?: string[];
}

interface NoteStyleProps {
  mode: ThemeMode;
}

const noteStyles = {
  container: (mode: ThemeMode) => ({
    padding: tokens.spacing.md,
    background: tokens.color.surface.secondaryPane[mode],
    border: `1px solid ${tokens.color.border.subtle[mode]}`,
    borderRadius: tokens.radius.md,
    minWidth: 220,
    maxWidth: 340,
    fontFamily: 'inherit',
  }),
  header: (mode: ThemeMode) => ({
    fontWeight: tokens.typography.weight.bold,
    fontSize: tokens.typography.title,
    color: tokens.color.text.primary[mode],
    marginBottom: tokens.spacing.sm,
  }),
  content: (mode: ThemeMode) => ({
    fontSize: tokens.typography.body,
    color: tokens.color.text.primary[mode],
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap' as const,
    marginBottom: tokens.spacing.sm,
  }),
  textarea: (mode: ThemeMode) => ({
    width: '100%',
    minHeight: '80px',
    padding: tokens.spacing.sm,
    background: tokens.color.surface.base[mode],
    border: `1px solid ${tokens.color.border.subtle[mode]}`,
    borderRadius: tokens.radius.sm,
    color: tokens.color.text.primary[mode],
    fontSize: tokens.typography.body,
    fontFamily: 'inherit',
    resize: 'vertical' as const,
  }),
  button: (mode: ThemeMode) => ({
    padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
    background: tokens.color.surface.base[mode],
    border: `1px solid ${tokens.color.border.subtle[mode]}`,
    borderRadius: tokens.radius.sm,
    color: tokens.color.text.secondary[mode],
    fontSize: tokens.typography.label,
    cursor: 'pointer',
    fontWeight: tokens.typography.weight.normal,
  }),
  tagContainer: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: tokens.spacing.xs,
    marginTop: tokens.spacing.sm,
  },
  tag: (mode: ThemeMode) => ({
    padding: `2px ${tokens.spacing.xs}px`,
    background: tokens.color.surface.base[mode],
    border: `1px solid ${tokens.color.border.subtle[mode]}`,
    borderRadius: tokens.radius.sm,
    fontSize: tokens.typography.label - 1,
    color: tokens.color.text.secondary[mode],
  }),
};

export const NoteWidget: React.FC<WidgetProps<NoteWidgetData>> = ({ data, onDataChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(data.content);
  const mode: ThemeMode = 'dark'; // TODO: Get from theme context

  const handleSave = (): void => {
    onDataChange?.({ content });
    setIsEditing(false);
  };

  return (
    <div style={noteStyles.container(mode)}>
      <div style={noteStyles.header(mode)}>{data.label}</div>

      {isEditing ? (
        <>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={noteStyles.textarea(mode)}
            autoFocus
          />
          <div style={{ display: 'flex', gap: tokens.spacing.xs, marginTop: tokens.spacing.sm }}>
            <button onClick={handleSave} style={noteStyles.button(mode)}>Save</button>
            <button onClick={() => { setContent(data.content); setIsEditing(false); }} style={noteStyles.button(mode)}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <div style={noteStyles.content(mode)}>{data.content}</div>
          <button onClick={() => setIsEditing(true)} style={noteStyles.button(mode)}>Edit</button>
        </>
      )}

      {data.tags && data.tags.length > 0 && (
        <div style={noteStyles.tagContainer}>
          {data.tags.map((tag) => (
            <span key={tag} style={noteStyles.tag(mode)}>{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
};

export default NoteWidget;

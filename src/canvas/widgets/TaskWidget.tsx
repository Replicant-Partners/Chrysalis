/**
 * Task Widget
 * 
 * Task/todo widget for Board canvas with status tracking.
 * 
 * @module canvas/widgets/TaskWidget
 */

import React, { useState } from 'react';
import type { WidgetRendererProps } from '../types';

// =============================================================================
// Task Payload
// =============================================================================

export interface TaskPayload {
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
}

// =============================================================================
// Task Widget Component
// =============================================================================

export function TaskWidget(props: WidgetRendererProps<'task'>) {
  const { data, nodeId, selected, onUpdate, onDelete } = props;
  const payload = data.payload as TaskPayload | undefined;
  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState(payload?.description || '');
  
  const status = payload?.status || 'todo';
  const priority = payload?.priority || 'medium';
  
  const statusColors = {
    todo: '#e5e7eb',
    in_progress: '#fef08a',
    done: '#86efac',
  };
  
  const priorityColors = {
    low: '#94a3b8',
    medium: '#f59e0b',
    high: '#ef4444',
  };
  
  const handleStatusChange = () => {
    const nextStatus = status === 'todo' ? 'in_progress' : status === 'in_progress' ? 'done' : 'todo';
    onUpdate({
      payload: {
        ...payload,
        status: nextStatus,
      },
    });
  };
  
  const handleSave = () => {
    onUpdate({
      payload: {
        ...payload,
        description,
      },
    });
    setIsEditing(false);
  };
  
  return (
    <div
      style={{
        width: '250px',
        background: statusColors[status],
        borderRadius: '4px',
        border: selected ? '2px solid #0ea5e9' : '1px solid #d4d4d4',
        padding: '12px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Status checkbox */}
          <button
            onClick={handleStatusChange}
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '4px',
              border: '2px solid #666',
              background: status === 'done' ? '#22c55e' : 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '14px',
              padding: 0,
            }}
            aria-label={`Mark as ${status === 'done' ? 'todo' : 'done'}`}
          >
            {status === 'done' && '✓'}
          </button>
          
          {/* Priority indicator */}
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: priorityColors[priority],
            }}
            title={`Priority: ${priority}`}
          />
        </div>
        
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
          aria-label="Delete task"
        >
          ×
        </button>
      </div>
      
      {/* Description */}
      {isEditing ? (
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setDescription(payload?.description || '');
              setIsEditing(false);
            }
          }}
          style={{
            width: '100%',
            minHeight: '80px',
            background: 'white',
            border: '1px solid #ccc',
            borderRadius: '2px',
            padding: '8px',
            fontSize: '14px',
            color: '#000',
            resize: 'vertical',
            fontFamily: 'inherit',
          }}
          placeholder="Task description..."
        />
      ) : (
        <div
          style={{
            fontSize: '14px',
            color: '#000',
            textDecoration: status === 'done' ? 'line-through' : 'none',
            opacity: status === 'done' ? 0.6 : 1,
            cursor: 'text',
            minHeight: '60px',
          }}
          onClick={() => setIsEditing(true)}
        >
          {payload?.description || 'Click to edit...'}
        </div>
      )}
      
      {/* Footer with status */}
      <div
        style={{
          marginTop: '8px',
          fontSize: '11px',
          color: '#666',
          textTransform: 'capitalize',
        }}
      >
        {status.replace('_', ' ')}
      </div>
    </div>
  );
}

export default TaskWidget;
/**
 * Terminal Session Widget
 * 
 * Widget for displaying an interactive terminal session.
 * Connects to PTY WebSocket backend.
 * 
 * @module canvas/widgets/TerminalSessionWidget
 */

import React, { useEffect, useRef, useState } from 'react';
import type { WidgetRendererProps } from '../types';

// Dynamic import for xterm to avoid build issues if not installed
let Terminal: any;
let FitAddon: any;

// Lazy load xterm modules
const loadXterm = async () => {
  if (!Terminal) {
    try {
      const xtermModule = await import('@xterm/xterm');
      Terminal = xtermModule.Terminal;
      
      const fitModule = await import('@xterm/addon-fit');
      FitAddon = fitModule.FitAddon;
    } catch (error) {
      console.warn('xterm not available:', error);
    }
  }
};

// =============================================================================
// Terminal Session Payload
// =============================================================================

export interface TerminalSessionPayload {
  sessionId: string;
  shell?: string;
  cwd?: string;
  cols?: number;
  rows?: number;
}

// =============================================================================
// Terminal Session Widget Component
// =============================================================================

export function TerminalSessionWidget(
  props: WidgetRendererProps<'terminal_session'>
) {
  const { data, nodeId, selected, onUpdate, onDelete } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const payload = data.payload as TerminalSessionPayload | undefined;
  
  useEffect(() => {
    // TODO: Initialize xterm.js here
    // - Create Terminal instance
    // - Connect to PTY WebSocket
    // - Handle resize
    // - Cleanup on unmount
    
    return () => {
      // Cleanup xterm and WebSocket connection
    };
  }, [payload?.sessionId]);
  
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#000',
        borderRadius: '4px',
        border: selected ? '2px solid #0ea5e9' : '1px solid #444',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 12px',
          background: '#1a1a1a',
          borderBottom: '1px solid #444',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ color: '#e0e0e0', fontSize: '12px', fontWeight: 500 }}>
          {data.title || `Terminal - ${payload?.shell || 'bash'}`}
        </span>
        <button
          onClick={onDelete}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#999',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '0 4px',
          }}
          aria-label="Close terminal"
        >
          ×
        </button>
      </div>
      
      {/* Terminal container */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          padding: '8px',
          overflow: 'hidden',
        }}
      >
        {/* xterm.js will be rendered here */}
        <div style={{ color: '#0f0', fontFamily: 'monospace', fontSize: '14px' }}>
          {payload?.sessionId ? (
            <>Session: {payload.sessionId}<br />CWD: {payload.cwd || '~'}</>
          ) : (
            'Terminal widget - xterm.js integration pending'
          )}
        </div>
      </div>
    </div>
  );
}

export default TerminalSessionWidget;
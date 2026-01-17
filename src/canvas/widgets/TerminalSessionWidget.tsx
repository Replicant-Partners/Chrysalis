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
  const terminalRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<'loading' | 'connected' | 'disconnected' | 'error'>('loading');
  const payload = data.payload as TerminalSessionPayload | undefined;
  
  useEffect(() => {
    if (!containerRef.current || !payload?.sessionId) return;
    
    let mounted = true;
    
    const initTerminal = async () => {
      await loadXterm();
      
      if (!mounted || !Terminal || !FitAddon) {
        setStatus('error');
        return;
      }
      
      // Create terminal instance
      const terminal = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: '#000000',
          foreground: '#ffffff',
        },
        cols: payload.cols || 80,
        rows: payload.rows || 24,
      });
      
      terminalRef.current = terminal;
      
      // Add fit addon
      const fitAddon = new FitAddon();
      fitAddonRef.current = fitAddon;
      terminal.loadAddon(fitAddon);
      
      // Open terminal in container
      terminal.open(containerRef.current);
      fitAddon.fit();
      
      // Connect to PTY WebSocket
      const wsUrl = `ws://localhost:8081`; // TODO: Make configurable
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        if (!mounted) return;
        setStatus('connected');
        
        // Create session
        ws.send(JSON.stringify({
          type: 'create',
          sessionId: payload.sessionId,
          shell: payload.shell || '/bin/bash',
          cwd: payload.cwd || process.env.HOME || '~',
          cols: terminal.cols,
          rows: terminal.rows,
        }));
      };
      
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'data' && message.payload) {
          terminal.write(message.payload);
        }
      };
      
      ws.onerror = () => {
        if (!mounted) return;
        setStatus('error');
      };
      
      ws.onclose = () => {
        if (!mounted) return;
        setStatus('disconnected');
      };
      
      // Send terminal input to PTY
      terminal.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'data',
            sessionId: payload.sessionId,
            data,
          }));
        }
      });
      
      // Handle terminal resize
      const handleResize = () => {
        fitAddon.fit();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'resize',
            sessionId: payload.sessionId,
            cols: terminal.cols,
            rows: terminal.rows,
          }));
        }
      };
      
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    };
    
    initTerminal();
    
    return () => {
      mounted = false;
      
      // Cleanup terminal
      if (terminalRef.current) {
        terminalRef.current.dispose();
      }
      
      // Close WebSocket
      if (wsRef.current) {
        if (payload?.sessionId) {
          wsRef.current.send(JSON.stringify({
            type: 'close',
            sessionId: payload.sessionId,
          }));
        }
        wsRef.current.close();
      }
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
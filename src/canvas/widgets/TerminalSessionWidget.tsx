import React, { useState } from 'react';

import type { WidgetProps, WidgetNodeData } from '../types';

export interface TerminalSessionWidgetData extends WidgetNodeData {
  sessionId: string;
  workingDirectory: string;
  status: 'active' | 'idle' | 'terminated';
  lastCommand?: string;
}

export const TerminalSessionWidget: React.FC<WidgetProps<TerminalSessionWidgetData>> = ({ data, onDataChange }) => {
  const [command, setCommand] = useState('');

  const getStatusColor = (): string => {
    switch (data.status) {
      case 'active':
        return '#4caf50';
      case 'idle':
        return '#ff9800';
      case 'terminated':
        return '#f44336';
      default:
        return '#9e9e9e';
    }
  };

  const handleExecute = (): void => {
    if (command.trim()) {
      onDataChange?.({ lastCommand: command, status: 'active' });
      setCommand('');
    }
  };

  return (
    <div style={{
      padding: '12px',
      background: '#263238',
      border: `2px solid ${getStatusColor()}`,
      borderRadius: '8px',
      minWidth: '350px',
      maxWidth: '500px',
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#aed581',
      boxShadow: '0 3px 10px rgba(0,0,0,0.3)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#78909c' }}>
        <div>$ {data.label}</div>
        <div style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: getStatusColor()
        }} />
      </div>

      <div style={{ fontSize: '11px', color: '#546e7a', marginBottom: '8px' }}>
        {data.workingDirectory}
      </div>

      {data.lastCommand && (
        <div style={{ marginBottom: '8px', color: '#aed581' }}>
          &gt; {data.lastCommand}
        </div>
      )}

      <div style={{ display: 'flex', gap: '4px' }}>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleExecute()}
          placeholder="Enter command..."
          style={{
            flex: 1,
            padding: '6px',
            background: '#37474f',
            border: '1px solid #546e7a',
            borderRadius: '4px',
            color: '#aed581',
            fontFamily: 'monospace',
            fontSize: '12px'
          }}
        />
        <button
          onClick={handleExecute}
          style={{
            padding: '6px 12px',
            background: '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Run
        </button>
      </div>
    </div>
  );
};

export default TerminalSessionWidget;

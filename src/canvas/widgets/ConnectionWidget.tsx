import React, { useState } from 'react';

import type { WidgetProps, WidgetNodeData } from '../types';

export interface ConnectionWidgetData extends WidgetNodeData {
  service: string;
  status: 'connected' | 'disconnected' | 'error';
  endpoint: string;
  lastCheck?: number;
}

export const ConnectionWidget: React.FC<WidgetProps<ConnectionWidgetData>> = ({
  data,
  onDataChange
}) => {
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const testConnection = (): void => {
    setIsTestingConnection(true);
    // Simulate connection test
    setTimeout(() => {
      onDataChange?.({ status: 'connected', lastCheck: Date.now() });
      setIsTestingConnection(false);
    }, 1000);
  };

  const getStatusColor = (): string => {
    switch (data.status) {
      case 'connected':
        return '#4caf50';
      case 'error':
        return '#f44336';
      default:
        return '#9e9e9e';
    }
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontWeight: 'bold', color: '#333' }}>
          {data.label}
        </div>
        <div style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          background: getStatusColor()
        }} />
      </div>

      <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
        Service: <span style={{ fontWeight: 500, color: '#333' }}>{data.service}</span>
      </div>

      <div style={{
        fontSize: '12px',
        color: '#999',
        fontFamily: 'monospace',
        marginBottom: '12px',
        padding: '8px',
        background: '#f5f5f5',
        borderRadius: '4px'
      }}>
        {data.endpoint}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={testConnection}
          disabled={isTestingConnection}
          style={{
            padding: '6px 12px',
            background: isTestingConnection ? '#ccc' : '#2196f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isTestingConnection ? 'not-allowed' : 'pointer'
          }}
        >
          {isTestingConnection ? 'Testing...' : 'Test Connection'}
        </button>
        {data.lastCheck && (
          <span style={{ fontSize: '11px', color: '#999' }}>
            Last checked: {new Date(data.lastCheck).toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
};

export default ConnectionWidget;

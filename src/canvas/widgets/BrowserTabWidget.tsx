import React from 'react';

import type { WidgetProps, WidgetNodeData } from '../types';

export interface BrowserTabWidgetData extends WidgetNodeData {
  url: string;
  title: string;
  favicon?: string;
  status: 'loading' | 'loaded' | 'error';
}

export const BrowserTabWidget: React.FC<WidgetProps<BrowserTabWidgetData>> = ({ data }) => {
  const getStatusIcon = (): string => {
    switch (data.status) {
      case 'loading':
        return '⏳';
      case 'loaded':
        return '✓';
      case 'error':
        return '⚠️';
      default:
        return '🌐';
    }
  };

  return (
    <div style={{
      padding: '14px',
      background: 'white',
      border: '2px solid #607d8b',
      borderRadius: '8px',
      minWidth: '300px',
      maxWidth: '400px',
      boxShadow: '0 2px 6px rgba(0,0,0,0.12)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        {data.favicon ? (
          <img src={data.favicon} alt="" style={{ width: '16px', height: '16px' }} />
        ) : (
          <span>🌐</span>
        )}
        <div style={{ fontWeight: 'bold', color: '#37474f', flex: 1 }}>
          {data.title}
        </div>
        <span style={{ fontSize: '14px' }}>{getStatusIcon()}</span>
      </div>

      <div style={{
        fontSize: '11px',
        color: '#455a64',
        fontFamily: 'monospace',
        background: '#eceff1',
        padding: '6px',
        borderRadius: '4px',
        wordBreak: 'break-all'
      }}>
        {data.url}
      </div>
      
      {data.status === 'error' && (
        <div style={{
          marginTop: '8px',
          padding: '6px',
          background: '#ffebee',
          color: '#c62828',
          fontSize: '11px',
          borderRadius: '4px'
        }}>
          Failed to load
        </div>
      )}
    </div>
  );
};

export default BrowserTabWidget;

import React, { useEffect, useState, useCallback } from 'react';

import { browserService } from '../../services/browser/BrowserService';

import type { WidgetProps, WidgetNodeData } from '../types';

export interface BrowserTabWidgetData extends WidgetNodeData {
  url: string;
  title: string;
  favicon?: string;
  status: 'loading' | 'loaded' | 'error';
  tabId?: string;
}

export const BrowserTabWidget: React.FC<WidgetProps<BrowserTabWidgetData>> = ({ data, onDataChange }) => {
  const [inputUrl, setInputUrl] = useState(data.url);
  const [isNavigating, setIsNavigating] = useState(false);

  // Initialize browser tab
  useEffect(() => {
    if (!data.tabId && data.url) {
      const tabId = browserService.createTab(data.url);
      onDataChange?.({ tabId });
    }

    // Subscribe to tab updates
    if (data.tabId) {
      const unsubscribe = browserService.on('updated', (tab) => {
        if (tab.id === data.tabId) {
          onDataChange?.({
            status: tab.status,
            title: tab.title,
            url: tab.url,
            favicon: tab.favicon,
          });
        }
      });

      return () => {
        unsubscribe();
      };
    }
  }, [data.tabId, data.url, onDataChange]);

  // Navigate to URL
  const handleNavigate = useCallback(async () => {
    if (!data.tabId || !inputUrl.trim()) return;

    setIsNavigating(true);
    try {
      await browserService.navigate(data.tabId, {
        url: inputUrl,
        timeout: 30000,
        waitUntil: 'load',
      });
    } catch (error) {
      console.error('[BrowserTabWidget] Navigation error:', error);
    } finally {
      setIsNavigating(false);
    }
  }, [data.tabId, inputUrl]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNavigate();
    }
  }, [handleNavigate]);

  // Navigation controls
  const handleBack = useCallback(async () => {
    if (data.tabId) {
      await browserService.goBack(data.tabId);
    }
  }, [data.tabId]);

  const handleForward = useCallback(async () => {
    if (data.tabId) {
      await browserService.goForward(data.tabId);
    }
  }, [data.tabId]);

  const handleReload = useCallback(async () => {
    if (data.tabId) {
      await browserService.reload(data.tabId);
    }
  }, [data.tabId]);

  const handleStop = useCallback(async () => {
    if (data.tabId) {
      await browserService.stop(data.tabId);
    }
  }, [data.tabId]);
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
      maxWidth: '450px',
      boxShadow: '0 2px 6px rgba(0,0,0,0.12)'
    }}>
      {/* Navigation Controls */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        <button
          onClick={handleBack}
          disabled={isNavigating}
          style={{
            padding: '4px 8px',
            fontSize: '12px',
            background: '#eceff1',
            border: '1px solid #cfd8dc',
            borderRadius: '4px',
            cursor: isNavigating ? 'not-allowed' : 'pointer'
          }}
          title="Go back"
        >
          ←
        </button>
        <button
          onClick={handleForward}
          disabled={isNavigating}
          style={{
            padding: '4px 8px',
            fontSize: '12px',
            background: '#eceff1',
            border: '1px solid #cfd8dc',
            borderRadius: '4px',
            cursor: isNavigating ? 'not-allowed' : 'pointer'
          }}
          title="Go forward"
        >
          →
        </button>
        <button
          onClick={data.status === 'loading' ? handleStop : handleReload}
          disabled={isNavigating}
          style={{
            padding: '4px 8px',
            fontSize: '12px',
            background: '#eceff1',
            border: '1px solid #cfd8dc',
            borderRadius: '4px',
            cursor: isNavigating ? 'not-allowed' : 'pointer'
          }}
          title={data.status === 'loading' ? 'Stop' : 'Reload'}
        >
          {data.status === 'loading' ? '✕' : '↻'}
        </button>
      </div>

      {/* Header with Title */}
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

      {/* URL Input */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        <input
          type="text"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isNavigating}
          placeholder="Enter URL..."
          style={{
            flex: 1,
            fontSize: '11px',
            color: '#455a64',
            fontFamily: 'monospace',
            background: '#eceff1',
            padding: '6px',
            borderRadius: '4px',
            border: '1px solid #cfd8dc'
          }}
        />
        <button
          onClick={handleNavigate}
          disabled={isNavigating || !inputUrl.trim()}
          style={{
            padding: '4px 12px',
            fontSize: '11px',
            background: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isNavigating || !inputUrl.trim() ? 'not-allowed' : 'pointer',
            opacity: isNavigating || !inputUrl.trim() ? 0.5 : 1
          }}
        >
          Go
        </button>
      </div>

      {/* Current URL Display */}
      <div style={{
        fontSize: '10px',
        color: '#78909c',
        fontFamily: 'monospace',
        background: '#f5f5f5',
        padding: '4px 6px',
        borderRadius: '4px',
        wordBreak: 'break-all',
        marginBottom: '8px'
      }}>
        {data.url}
      </div>
      
      {/* Error Display */}
      {data.status === 'error' && (
        <div style={{
          padding: '6px',
          background: '#ffebee',
          color: '#c62828',
          fontSize: '11px',
          borderRadius: '4px'
        }}>
          ⚠️ Failed to load
        </div>
      )}

      {/* Browser View Placeholder */}
      <div style={{
        marginTop: '8px',
        padding: '20px',
        background: '#fafafa',
        border: '1px dashed #cfd8dc',
        borderRadius: '4px',
        textAlign: 'center',
        color: '#90a4ae',
        fontSize: '11px'
      }}>
        {data.status === 'loading' ? (
          <div>Loading page...</div>
        ) : data.status === 'loaded' ? (
          <div>
            Browser embedding not implemented
            <br />
            <small style={{ fontSize: '10px' }}>See src/services/browser/README.md</small>
          </div>
        ) : (
          <div>No content</div>
        )}
      </div>
    </div>
  );
};

export default BrowserTabWidget;

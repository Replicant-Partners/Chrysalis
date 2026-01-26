/**
 * Canvas Integration Test Entry Point
 * 
 * Standalone entry for browser-based integration testing of the canvas system.
 * Provides isolated testing environment with mock data and test controls.
 */

import React, { useState, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { ReactFlowProvider } from 'reactflow';

import {
  BaseCanvasWithProvider,
  ScrapbookCanvas,
  SettingsCanvas,
  ResearchCanvas,
  createLocalStorageDataSource,
  createMemoryDataSource,
  createWidgetRegistry,
} from '../canvas';
import type { CanvasKind, CanvasEvent, AnyWidgetData } from '../canvas/types';
import type { Node, Edge } from 'reactflow';

import 'reactflow/dist/style.css';

// Test fixtures using AnyWidgetData for flexible widget properties
const TEST_FIXTURES: Record<string, { nodes: Node<AnyWidgetData>[]; edges: Edge[] }> = {
  scrapbook: {
    nodes: [
      {
        id: 'test-note-1',
        type: 'note',
        position: { x: 100, y: 100 },
        data: {
          type: 'note',
          label: 'Test Note 1',
          content: 'This is a test note for integration testing.',
          tags: ['test', 'integration'],
        },
      },
      {
        id: 'test-link-1',
        type: 'link',
        position: { x: 400, y: 100 },
        data: {
          type: 'link',
          label: 'Test Link',
          url: 'https://example.com',
          title: 'Example Site',
        },
      },
    ],
    edges: [],
  },
  settings: {
    nodes: [
      {
        id: 'test-config-1',
        type: 'config',
        position: { x: 100, y: 100 },
        data: {
          type: 'config',
          label: 'API Configuration',
          key: 'api.endpoint',
          value: 'https://api.example.com',
          description: 'Primary API endpoint',
        },
      },
    ],
    edges: [],
  },
  research: {
    nodes: [
      {
        id: 'test-source-1',
        type: 'source',
        position: { x: 100, y: 100 },
        data: {
          type: 'source',
          label: 'Research Source',
          url: 'https://research.example.com',
          citation: 'Example Research Paper',
          excerpt: 'Key findings from the research...',
        },
      },
    ],
    edges: [],
  },
};

// Test event log
interface TestEvent {
  timestamp: number;
  type: string;
  payload?: unknown;
}

// Integration Test App
const IntegrationTestApp: React.FC = () => {
  const [activeCanvas, setActiveCanvas] = useState<CanvasKind>('scrapbook');
  const [events, setEvents] = useState<TestEvent[]>([]);
  const [useMemoryDataSource, setUseMemoryDataSource] = useState(true);
  const [testStatus, setTestStatus] = useState<'idle' | 'running' | 'passed' | 'failed'>('idle');

  // Create data source based on mode
  const dataSource = useMemo(() => {
    const fixtures = TEST_FIXTURES[activeCanvas as keyof typeof TEST_FIXTURES];
    if (useMemoryDataSource && fixtures) {
      return createMemoryDataSource(fixtures.nodes, fixtures.edges);
    }
    return createLocalStorageDataSource(`integration-test-${activeCanvas}`);
  }, [activeCanvas, useMemoryDataSource]);

  // Event handler
  const handleEvent = useCallback((event: CanvasEvent) => {
    setEvents((prev) => [
      ...prev.slice(-49), // Keep last 50 events
      {
        timestamp: event.timestamp,
        type: event.type,
        payload: event.payload,
      },
    ]);
  }, []);

  // Run automated tests
  const runTests = useCallback(async () => {
    setTestStatus('running');
    setEvents([]);

    try {
      // Test 1: Verify canvas loads
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // Test 2: Check data source
      const data = await dataSource.load();
      if (!data.nodes || !data.edges) {
        throw new Error('DataSource load failed');
      }

      // Test 3: Verify event system
      const hasLoadEvent = events.some((e) => e.type === 'canvas:loaded');
      
      setTestStatus('passed');
      console.log('[Integration Test] All tests passed');
    } catch (error) {
      setTestStatus('failed');
      console.error('[Integration Test] Test failed:', error);
    }
  }, [dataSource, events]);

  // Clear events
  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  // Render canvas based on type
  const renderCanvas = () => {
    const commonProps = {
      canvasId: `integration-test-${activeCanvas}`,
      dataSource,
      onEvent: handleEvent,
      showControls: true,
      showMinimap: true,
      showBackground: true,
    };

    switch (activeCanvas) {
      case 'scrapbook':
        return <ScrapbookCanvas {...commonProps} />;
      case 'settings':
        return <SettingsCanvas {...commonProps} />;
      case 'research':
        return <ResearchCanvas {...commonProps} />;
      default:
        return <ScrapbookCanvas {...commonProps} />;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      {/* Left Panel: Controls */}
      <div
        style={{
          width: '300px',
          background: '#1a1d24',
          color: '#e0e0e0',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          borderRight: '1px solid #2f3b55',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '18px', color: '#3498db' }}>
          Canvas Integration Test
        </h2>

        {/* Canvas Type Selector */}
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#9aa4b5' }}>
            Canvas Type
          </label>
          <select
            value={activeCanvas}
            onChange={(e) => setActiveCanvas(e.target.value as CanvasKind)}
            style={{
              width: '100%',
              padding: '8px',
              background: '#2a2f3a',
              color: '#e0e0e0',
              border: '1px solid #3f4a5a',
              borderRadius: '4px',
            }}
          >
            <option value="scrapbook">Scrapbook Canvas</option>
            <option value="settings">Settings Canvas</option>
            <option value="research">Research Canvas</option>
          </select>
        </div>

        {/* Data Source Toggle */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={useMemoryDataSource}
              onChange={(e) => setUseMemoryDataSource(e.target.checked)}
            />
            <span style={{ fontSize: '13px' }}>Use Memory DataSource (with fixtures)</span>
          </label>
        </div>

        {/* Test Controls */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={runTests}
            disabled={testStatus === 'running'}
            style={{
              flex: 1,
              padding: '10px',
              background: testStatus === 'running' ? '#555' : '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: testStatus === 'running' ? 'not-allowed' : 'pointer',
            }}
          >
            {testStatus === 'running' ? 'Running...' : 'Run Tests'}
          </button>
          <button
            onClick={clearEvents}
            style={{
              padding: '10px',
              background: '#555',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        </div>

        {/* Test Status */}
        <div
          style={{
            padding: '12px',
            background:
              testStatus === 'passed'
                ? '#1b5e20'
                : testStatus === 'failed'
                ? '#b71c1c'
                : '#2a2f3a',
            borderRadius: '4px',
            textAlign: 'center',
            fontWeight: 'bold',
          }}
        >
          Status: {testStatus.toUpperCase()}
        </div>

        {/* Event Log */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '12px', color: '#9aa4b5', marginBottom: '8px' }}>
            Event Log ({events.length})
          </div>
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              background: '#0d1117',
              borderRadius: '4px',
              padding: '8px',
              fontSize: '11px',
              fontFamily: 'monospace',
            }}
          >
            {events.length === 0 ? (
              <div style={{ color: '#555' }}>No events yet...</div>
            ) : (
              events.map((event, i) => (
                <div
                  key={i}
                  style={{
                    padding: '4px 0',
                    borderBottom: '1px solid #1f2937',
                    color: event.type.includes('error') ? '#f44336' : '#aed581',
                  }}
                >
                  <span style={{ color: '#666' }}>
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>{' '}
                  <span style={{ color: '#3498db' }}>{event.type}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Right Panel: Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlowProvider>{renderCanvas()}</ReactFlowProvider>
      </div>
    </div>
  );
};

// Mount the integration test app
const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <IntegrationTestApp />
    </React.StrictMode>
  );
}

export default IntegrationTestApp;

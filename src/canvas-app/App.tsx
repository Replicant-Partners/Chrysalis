import React, { useState, useRef, useCallback, useMemo } from 'react';
import { ReactFlowProvider } from 'reactflow';

import {
  BaseCanvasWithProvider,
  createLocalStorageDataSource,
  createWidgetRegistry,
} from '../canvas';
import { DragDropHandler } from './DragDropHandler';
import { ConfigWidget, ConfigWidgetData } from '../canvas/widgets/ConfigWidget';
import { ConnectionWidget, ConnectionWidgetData } from '../canvas/widgets/ConnectionWidget';
import { NoteWidget, NoteWidgetData } from '../canvas/widgets/NoteWidget';
import { LinkWidget, LinkWidgetData } from '../canvas/widgets/LinkWidget';
import { ArtifactWidget, ArtifactWidgetData } from '../canvas/widgets/ArtifactWidget';

import type { CanvasKind, CanvasNode, CanvasData, CanvasPolicy, WidgetDefinition } from '../canvas/types';
import type { AgentCardData } from '../canvas/widgets/AgentCardWidget';

import 'reactflow/dist/style.css';

const POLICIES: Record<CanvasKind, CanvasPolicy> = {
  'settings': {
    maxNodes: 50,
    maxEdges: 100,
    rateLimit: { actions: 20, windowMs: 1000 },
    allowedWidgetTypes: ['config', 'connection', 'credential'],
  },
  'scrapbook': {
    maxNodes: 500,
    maxEdges: 1000,
    rateLimit: { actions: 50, windowMs: 1000 },
    allowedWidgetTypes: ['artifact', 'note', 'link', 'group'],
  },
  'agent': {
    maxNodes: 100,
    maxEdges: 200,
    rateLimit: { actions: 50, windowMs: 1000 },
    allowedWidgetTypes: ['agent_card', 'team_group'],
  },
  'research': {
    maxNodes: 300,
    maxEdges: 600,
    rateLimit: { actions: 40, windowMs: 1000 },
    allowedWidgetTypes: ['source', 'citation', 'synthesis', 'hypothesis'],
  },
  'wiki': {
    maxNodes: 1000,
    maxEdges: 2000,
    rateLimit: { actions: 30, windowMs: 1000 },
    allowedWidgetTypes: ['wiki_page', 'wiki_section', 'wiki_link'],
  },
  'terminal-browser': {
    maxNodes: 200,
    maxEdges: 400,
    rateLimit: { actions: 100, windowMs: 1000 },
    allowedWidgetTypes: ['terminal_session', 'browser_tab', 'code_editor'],
  },
  'terminal': {
    maxNodes: 100,
    maxEdges: 200,
    rateLimit: { actions: 100, windowMs: 1000 },
    allowedWidgetTypes: ['terminal_session'],
  },
  'custom': {
    maxNodes: 500,
    maxEdges: 1000,
    rateLimit: { actions: 50, windowMs: 1000 },
    allowedWidgetTypes: [],
  }
};

const getInitialNodes = (kind: CanvasKind): CanvasNode[] => {
  switch (kind) {
    case 'scrapbook':
      return [
        {
          id: '1',
          type: 'note',
          position: { x: 100, y: 100 },
          data: {
            type: 'note',
            label: 'Welcome Note',
            content: 'Double-click to edit',
            tags: ['getting-started']
          } as NoteWidgetData
        },
        {
          id: '2',
          type: 'link',
          position: { x: 400, y: 100 },
          data: {
            type: 'link',
            label: 'Example Link',
            url: 'https://reactflow.dev',
            title: 'ReactFlow Docs'
          } as LinkWidgetData
        }
      ];
    case 'settings':
      return [
        {
          id: '1',
          type: 'config',
          position: { x: 100, y: 100 },
          data: {
            type: 'config',
            label: 'API Key',
            key: 'api.key',
            value: '***hidden***',
            description: 'API authentication key'
          } as ConfigWidgetData
        }
      ];
    case 'agent':
      return [
        {
          id: '1',
          type: 'agent_card',
          position: { x: 100, y: 100 },
          data: {
            type: 'agent_card',
            label: 'Ada',
            agentName: 'Ada Lovelace',
            state: 'running',
            memoryStack: 'primary'
          } as AgentCardData
        }
      ];
    default:
      return [];
  }
};

const App: React.FC = () => {
  const [activeCanvas, setActiveCanvas] = useState<CanvasKind>('scrapbook');
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canvasId = `${activeCanvas}-canvas`;
  const dataSource = useMemo(() => createLocalStorageDataSource(canvasId), [canvasId]);

  // Create registry for current canvas
  const registry = useMemo(() => {
    const reg = createWidgetRegistry(activeCanvas, POLICIES[activeCanvas].allowedWidgetTypes);

    // Register widgets based on canvas type
    if (activeCanvas === 'scrapbook') {
      reg.register({ type: 'note', displayName: 'Note', renderer: NoteWidget, capabilities: ['edit', 'read'], defaultData: { content: '', tags: [] }, icon: '📝' } as WidgetDefinition<NoteWidgetData>);
      reg.register({ type: 'link', displayName: 'Link', renderer: LinkWidget, capabilities: ['read'], defaultData: { url: '', title: '' }, icon: '🔗' } as WidgetDefinition<LinkWidgetData>);
      reg.register({ type: 'artifact', displayName: 'Artifact', renderer: ArtifactWidget, capabilities: ['read'], defaultData: { artifactType: 'text', content: '' }, icon: '📦' } as WidgetDefinition<ArtifactWidgetData>);
    } else if (activeCanvas === 'settings') {
      reg.register({ type: 'config', displayName: 'Config', renderer: ConfigWidget, capabilities: ['edit'], defaultData: { key: '', value: '' }, icon: '⚙️' } as WidgetDefinition<ConfigWidgetData>);
      reg.register({ type: 'connection', displayName: 'Connection', renderer: ConnectionWidget, capabilities: ['read'], defaultData: { service: '', status: 'disconnected', endpoint: '' }, icon: '🔌' } as WidgetDefinition<ConnectionWidgetData>);
    }
    // TODO: Register widgets for other canvas types

    return reg;
  }, [activeCanvas]);

  const initialNodes = useMemo(() => getInitialNodes(activeCanvas), [activeCanvas]);

  const handleNodeCreated = useCallback(async (node: CanvasNode): Promise<void> => {
    if (dataSource.persist) {
      await dataSource.persist({
        nodesAdded: [node],
        nodesUpdated: [],
        nodesDeleted: [],
        edgesAdded: [],
        edgesDeleted: []
      });
    }
    // Trigger re-render by updating key
    setRefreshKey(prev => prev + 1);
  }, [dataSource]);

  const handleNew = async (): Promise<void> => {
    if (confirm('Clear current canvas and start fresh?')) {
      localStorage.removeItem(`canvas-${canvasId}`);
      window.location.reload();
    }
  };

  const handleSave = async (): Promise<void> => {
    const data = await (dataSource.loadAll ? dataSource.loadAll() : dataSource.load());
    const canvasData: CanvasData = {
      canvasId,
      kind: activeCanvas,
      nodes: data.nodes,
      edges: data.edges,
      viewport: { x: 0, y: 0, zoom: 1 },
      version: 1,
      lastModified: Date.now()
    };

    const blob = new Blob([JSON.stringify(canvasData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeCanvas}-canvas-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowFileMenu(false);
  };

  const handleOpen = (): void => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    const canvasData: CanvasData = JSON.parse(text);

    if (dataSource.persist) {
      await dataSource.persist({
        nodesAdded: canvasData.nodes,
        nodesUpdated: [],
        nodesDeleted: [],
        edgesAdded: canvasData.edges,
        edgesDeleted: []
      });
    }

    window.location.reload();
  };

  // Decision 3: Standalone app limited to canvas types that work without backends
  const workingCanvasKinds: CanvasKind[] = ['settings', 'scrapbook', 'research'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* Top bar with File menu and canvas tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 12px',
        background: '#34495e',
        borderBottom: '2px solid #2c3e50',
        gap: '16px'
      }}>
        {/* File menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowFileMenu(!showFileMenu)}
            style={{
              padding: '6px 12px',
              background: showFileMenu ? '#2c3e50' : 'transparent',
              color: 'white',
              border: '1px solid #546e7a',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            File ▼
          </button>

          {showFileMenu && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '4px',
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              minWidth: '180px',
              zIndex: 1000
            }}>
              <button
                onClick={handleNew}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
              >
                New Canvas
              </button>
              <button
                onClick={handleOpen}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
              >
                Open...
              </button>
              <button
                onClick={handleSave}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
              >
                Save As...
              </button>
            </div>
          )}
        </div>

        {/* Canvas tabs - filtered to working types */}
        <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
          {workingCanvasKinds.map((kind) => (
            <button
              key={kind}
              onClick={() => {
                setActiveCanvas(kind);
                setShowFileMenu(false);
              }}
              style={{
                padding: '6px 14px',
                background: activeCanvas === kind ? '#3498db' : 'transparent',
                color: 'white',
                border: activeCanvas === kind ? 'none' : '1px solid #546e7a',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              {kind.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas container */}
      <div style={{ flex: 1, position: 'relative' }} key={refreshKey}>
        <ReactFlowProvider>
          <DragDropHandler
            canvasKind={activeCanvas}
            registry={registry}
            onNodeCreated={handleNodeCreated}
          >
            <BaseCanvasWithProvider
              canvasKind={activeCanvas}
              canvasId={canvasId}
              registry={registry}
              policy={POLICIES[activeCanvas]}
              dataSource={dataSource}
              initialNodes={initialNodes}
              onEvent={(event) => console.log('Canvas event:', event)}
            />
          </DragDropHandler>
        </ReactFlowProvider>
      </div>
    </div>
  );
};

export default App;

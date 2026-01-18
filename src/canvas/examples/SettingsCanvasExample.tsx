/**
 * Settings Canvas Working Example
 * Demonstrates complete setup with registered widgets and data persistence
 */

import React, { useEffect } from 'react';
import { SettingsCanvas } from '../canvases/SettingsCanvas';
import { ConfigWidget, ConfigWidgetData } from '../widgets/ConfigWidget';
import { createLocalStorageDataSource } from '../DataSource';
import type { WidgetDefinition,  CanvasNode } from '../types';

const CANVAS_ID = 'settings-example-canvas';

// Register ConfigWidget with the canvas
const configWidgetDef: WidgetDefinition<ConfigWidgetData> = {
  type: 'config',
  displayName: 'Configuration Setting',
  renderer: ConfigWidget,
  capabilities: ['edit', 'read'],
  defaultData: {
    key: 'new.setting',
    value: 'default-value',
    description: 'Configuration setting description'
  },
  category: 'system',
  icon: '⚙️'
};

// Initial nodes for the settings canvas
const createInitialNodes = (): CanvasNode<ConfigWidgetData>[] => [
  {
    id: '1',
    type: 'config',
    position: { x: 100, y: 100 },
    data: {
      type: 'config',
      label: 'API Endpoint',
      key: 'api.endpoint',
      value: 'https://api.chrysalis.dev',
      description: 'Primary API endpoint URL'
    }
  },
  {
    id: '2',
    type: 'config',
    position: { x: 400, y: 100 },
    data: {
      type: 'config',
      label: 'Max Connections',
      key: 'network.max_connections',
      value: '50',
      description: 'Maximum concurrent network connections'
    }
  },
  {
    id: '3',
    type: 'config',
    position: { x: 100, y: 300 },
    data: {
      type: 'config',
      label: 'Cache TTL',
      key: 'cache.ttl_seconds',
      value: '3600',
      description: 'Cache time-to-live in seconds'
    }
  }
];

export const SettingsCanvasExample: React.FC = () => {
  const dataSource = React.useMemo(
    () => createLocalStorageDataSource<CanvasNode<ConfigWidgetData>, never>(CANVAS_ID),
    []
  );

  // Initialize canvas with example data on first load
  useEffect(() => {
    const initCanvas = async () => {
      const existing = await dataSource.loadAll();
      if (existing.nodes.length === 0) {
        await dataSource.persist({
          nodesAdded: createInitialNodes(),
          nodesUpdated: [],
          nodesDeleted: [],
          edgesAdded: [],
          edgesDeleted: []
        });
      }
    };
    initCanvas();
  }, [dataSource]);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <h1 style={{ margin: '16px' }}>Settings Canvas Example</h1>
      <div style={{ height: 'calc(100vh - 80px)' }}>
        <SettingsCanvas
          canvasId={CANVAS_ID}
          dataSource={dataSource}
          onEvent={(event) => console.log('Canvas event:', event)}
        />
      </div>
    </div>
  );
};

export default SettingsCanvasExample;

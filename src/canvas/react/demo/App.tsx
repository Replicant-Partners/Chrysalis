/**
 * Canvas Demo App
 *
 * Demonstrates the canvas-widget architecture with:
 * - Canvas type switcher (all 5 types)
 * - Widget addition via toolbar
 * - Drag, resize, selection
 * - Snap-to-grid
 * - Undo/redo
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Canvas } from '../Canvas';
import { Toolbar } from '../Toolbar';
import type { CanvasKind, CanvasNode, Viewport } from '../../core/types';
import { getWidgetRegistry } from '../../widgets';
import { REFERENCE_WIDGETS, ALL_REFERENCE_WIDGETS } from '../../reference-widgets';

// =============================================================================
// Styles
// =============================================================================

const appStyles: React.CSSProperties = {
  width: '100vw',
  height: '100vh',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#11111b',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const headerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 20px',
  backgroundColor: '#1e1e2e',
  borderBottom: '1px solid #313244',
};

const titleStyles: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 600,
  color: '#cdd6f4',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
};

const tabsStyles: React.CSSProperties = {
  display: 'flex',
  gap: '4px',
};

const tabStyles: React.CSSProperties = {
  padding: '8px 16px',
  border: 'none',
  borderRadius: '6px',
  backgroundColor: 'transparent',
  color: '#a6adc8',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};

const activeTabStyles: React.CSSProperties = {
  backgroundColor: '#313244',
  color: '#cdd6f4',
};

const canvasContainerStyles: React.CSSProperties = {
  flex: 1,
  position: 'relative',
};

const statusBarStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 20px',
  backgroundColor: '#1e1e2e',
  borderTop: '1px solid #313244',
  fontSize: '12px',
  color: '#6c7086',
};

// =============================================================================
// Canvas Tabs Configuration
// =============================================================================

interface CanvasTabConfig {
  kind: CanvasKind;
  label: string;
  icon: string;
}

const CANVAS_TABS: CanvasTabConfig[] = [
  { kind: 'board', label: 'Board', icon: '📋' },
  { kind: 'scrapbook', label: 'Scrapbook', icon: '📎' },
  { kind: 'research', label: 'Research', icon: '🔬' },
  { kind: 'terminal-browser', label: 'Terminal', icon: '💻' },
  { kind: 'settings', label: 'Settings', icon: '⚙️' },
];

// =============================================================================
// Demo App Component
// =============================================================================

export const DemoApp: React.FC = () => {
  // State
  const [activeCanvas, setActiveCanvas] = useState<CanvasKind>('board');
  const [nodes, setNodes] = useState<Record<CanvasKind, CanvasNode[]>>({
    settings: [],
    board: [
      // Demo nodes
      {
        id: 'demo-1',
        type: 'board/card',
        position: { x: 100, y: 100 },
        size: { width: 280, height: 180 },
        data: { title: 'Welcome!', content: 'Drag me around', color: '#89b4fa' },
      },
      {
        id: 'demo-2',
        type: 'board/card',
        position: { x: 450, y: 150 },
        size: { width: 280, height: 180 },
        data: { title: 'Connect widgets', content: 'Build workflows', color: '#a6e3a1' },
      },
    ],
    scrapbook: [],
    research: [],
    'terminal-browser': [],
  });
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [gridVisible, setGridVisible] = useState(true);
  const [selection, setSelection] = useState<{ nodeIds: string[]; edgeIds: string[] }>({
    nodeIds: [],
    edgeIds: []
  });

  // Register reference widgets
  useMemo(() => {
    const registry = getWidgetRegistry();
    ALL_REFERENCE_WIDGETS.forEach(widget => {
      try {
        registry.register(widget);
      } catch {
        // Already registered
      }
    });
  }, []);

  // Get available widgets for current canvas
  const availableWidgets = useMemo(() => {
    return REFERENCE_WIDGETS[activeCanvas] || [];
  }, [activeCanvas]);

  // Handlers
  const handleNodesChange = useCallback((newNodes: CanvasNode[]) => {
    setNodes(prev => ({ ...prev, [activeCanvas]: newNodes }));
  }, [activeCanvas]);

  const handleViewportChange = useCallback((newViewport: Viewport) => {
    setViewport(newViewport);
  }, []);

  const handleSelectionChange = useCallback((newSelection: { nodeIds: string[]; edgeIds: string[] }) => {
    setSelection(newSelection);
  }, []);

  const handleAddWidget = useCallback((typeId: string) => {
    const widgetDef = availableWidgets.find(w => w.typeId === typeId);
    if (!widgetDef) return;

    const newNode: CanvasNode = {
      id: `node_${Date.now()}`,
      type: typeId,
      position: {
        // Place in center of viewport
        x: Math.round((-viewport.x / viewport.zoom + 400) / 20) * 20,
        y: Math.round((-viewport.y / viewport.zoom + 300) / 20) * 20,
      },
      size: widgetDef.defaultSize,
      data: widgetDef.defaultData,
    };

    setNodes(prev => ({
      ...prev,
      [activeCanvas]: [...prev[activeCanvas], newNode],
    }));
  }, [activeCanvas, availableWidgets, viewport]);

  const handleZoomChange = useCallback((newZoom: number) => {
    setViewport(prev => ({ ...prev, zoom: newZoom }));
  }, []);

  const handleGridToggle = useCallback(() => {
    setGridVisible(prev => !prev);
  }, []);

  // Undo/Redo stubs (would be handled by useCanvas hook in real usage)
  const [canUndo] = useState(false);
  const [canRedo] = useState(false);
  const handleUndo = useCallback(() => {}, []);
  const handleRedo = useCallback(() => {}, []);

  return (
    <div style={appStyles}>
      {/* Header */}
      <header style={headerStyles}>
        <div style={titleStyles}>
          <span>🦋</span>
          <span>Chrysalis Canvas</span>
        </div>

        {/* Canvas Type Tabs */}
        <div style={tabsStyles}>
          {CANVAS_TABS.map(tab => (
            <button
              key={tab.kind}
              style={{
                ...tabStyles,
                ...(activeCanvas === tab.kind ? activeTabStyles : {}),
              }}
              onClick={() => setActiveCanvas(tab.kind)}
            >
              <span style={{ marginRight: '6px' }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ width: 120 }} /> {/* Spacer for balance */}
      </header>

      {/* Canvas */}
      <div style={canvasContainerStyles}>
        <Canvas
          id={`canvas-${activeCanvas}`}
          kind={activeCanvas}
          nodes={nodes[activeCanvas]}
          viewport={viewport}
          grid={{ enabled: true, size: 20, visible: gridVisible }}
          onNodesChange={handleNodesChange}
          onViewportChange={handleViewportChange}
          onSelectionChange={handleSelectionChange}
        >
          <Toolbar
            availableWidgets={availableWidgets}
            onAddWidget={handleAddWidget}
            zoom={viewport.zoom}
            onZoomChange={handleZoomChange}
            gridVisible={gridVisible}
            onGridToggle={handleGridToggle}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={handleUndo}
            onRedo={handleRedo}
          />
        </Canvas>
      </div>

      {/* Status Bar */}
      <footer style={statusBarStyles}>
        <div>
          {nodes[activeCanvas].length} widgets
          {selection.nodeIds.length > 0 && ` • ${selection.nodeIds.length} selected`}
        </div>
        <div>
          Zoom: {Math.round(viewport.zoom * 100)}% •
          Grid: {gridVisible ? 'On' : 'Off'} •
          Position: {Math.round(-viewport.x / viewport.zoom)}, {Math.round(-viewport.y / viewport.zoom)}
        </div>
      </footer>
    </div>
  );
};

export default DemoApp;

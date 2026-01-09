/**
 * AgentCanvas React Component
 * 
 * Main canvas component for displaying and managing Chrysalis Agents.
 * Features:
 * - Drag-and-drop import of agent files (JSON/YAML)
 * - Visual grid with agent nodes
 * - Pan and zoom controls
 * - Selection and multi-select
 * - Import menu toolbar
 */

import React, { 
  useState, 
  useCallback, 
  useEffect, 
  useRef,
  useMemo
} from 'react';
import { AgentNodeWidget } from './AgentNodeWidget';
import { AgentImportMenu } from './AgentImportMenu';
import { 
  AgentCanvasManager, 
  getDefaultAgentCanvasManager,
  AgentLayout,
  CanvasViewport,
  SelectionState,
  CanvasManagerEvent
} from '../../terminal/protocols/agent-canvas-manager';
import { 
  AgentLifecycleManager,
  createAgentLifecycleManager,
  LifecycleEvent
} from '../../terminal/protocols/agent-lifecycle-manager';
import { CanvasAgent, AgentState } from '../../terminal/protocols/agent-canvas';
import { ImportResult } from '../../terminal/protocols/agent-import-pipeline';

// =============================================================================
// Types
// =============================================================================

export interface AgentCanvasProps {
  /** Optional custom canvas manager */
  canvasManager?: AgentCanvasManager;
  /** Called when an agent is selected */
  onAgentSelect?: (agentId: string | null) => void;
  /** Called when chat is requested with an agent */
  onChatRequest?: (agentId: string) => void;
  /** Called when import completes */
  onImportComplete?: (result: ImportResult) => void;
  /** Custom class name */
  className?: string;
  /** Show toolbar */
  showToolbar?: boolean;
  /** Show minimap */
  showMinimap?: boolean;
  /** Read-only mode */
  readOnly?: boolean;
}

interface CanvasState {
  agents: CanvasAgent[];
  layouts: Map<string, AgentLayout>;
  viewport: CanvasViewport;
  selection: SelectionState;
  isDragging: boolean;
  dragTarget: string | null;
  dragOffset: { x: number; y: number };
  isPanning: boolean;
  panStart: { x: number; y: number };
  isDropTarget: boolean;
  importProgress: ImportProgress | null;
}

interface ImportProgress {
  status: 'idle' | 'processing' | 'success' | 'error';
  message: string;
  fileName?: string;
}

// =============================================================================
// Styles
// =============================================================================

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    width: '100%',
    backgroundColor: '#1a1a2e',
    overflow: 'hidden',
    position: 'relative' as const,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    backgroundColor: '#16213e',
    borderBottom: '1px solid #0f3460',
    zIndex: 100,
  },
  toolbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  toolbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  toolbarButton: {
    padding: '6px 12px',
    backgroundColor: '#0f3460',
    border: 'none',
    borderRadius: '4px',
    color: '#e0e0e0',
    cursor: 'pointer',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'background-color 0.2s',
  },
  toolbarButtonHover: {
    backgroundColor: '#1a4a7a',
  },
  toolbarTitle: {
    color: '#e94560',
    fontWeight: 600,
    fontSize: '14px',
    marginRight: '16px',
  },
  agentCount: {
    color: '#888',
    fontSize: '12px',
  },
  canvasWrapper: {
    flex: 1,
    position: 'relative' as const,
    overflow: 'hidden',
  },
  canvas: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    cursor: 'grab',
  },
  canvasPanning: {
    cursor: 'grabbing',
  },
  canvasContent: {
    position: 'absolute' as const,
    transformOrigin: '0 0',
  },
  gridPattern: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: `
      linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
    `,
    backgroundSize: '20px 20px',
    pointerEvents: 'none' as const,
  },
  dropOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(233, 69, 96, 0.1)',
    border: '3px dashed #e94560',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    pointerEvents: 'none' as const,
  },
  dropText: {
    color: '#e94560',
    fontSize: '24px',
    fontWeight: 600,
    marginBottom: '8px',
  },
  dropSubtext: {
    color: '#888',
    fontSize: '14px',
  },
  emptyState: {
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center' as const,
    color: '#666',
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '16px',
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: 500,
    marginBottom: '8px',
    color: '#888',
  },
  emptySubtitle: {
    fontSize: '14px',
    color: '#666',
  },
  zoomControls: {
    position: 'absolute' as const,
    bottom: '16px',
    right: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    zIndex: 50,
  },
  zoomButton: {
    width: '32px',
    height: '32px',
    backgroundColor: '#16213e',
    border: '1px solid #0f3460',
    borderRadius: '4px',
    color: '#e0e0e0',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
  },
  zoomLevel: {
    textAlign: 'center' as const,
    fontSize: '11px',
    color: '#888',
    padding: '4px',
  },
  importProgress: {
    position: 'absolute' as const,
    bottom: '16px',
    left: '16px',
    padding: '12px 16px',
    backgroundColor: '#16213e',
    border: '1px solid #0f3460',
    borderRadius: '6px',
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  importSpinner: {
    width: '20px',
    height: '20px',
    border: '2px solid #0f3460',
    borderTop: '2px solid #e94560',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  importText: {
    color: '#e0e0e0',
    fontSize: '13px',
  },
  minimap: {
    position: 'absolute' as const,
    bottom: '16px',
    left: '16px',
    width: '150px',
    height: '100px',
    backgroundColor: 'rgba(22, 33, 62, 0.9)',
    border: '1px solid #0f3460',
    borderRadius: '4px',
    zIndex: 50,
    overflow: 'hidden',
  },
  minimapViewport: {
    position: 'absolute' as const,
    border: '1px solid #e94560',
    backgroundColor: 'rgba(233, 69, 96, 0.1)',
    pointerEvents: 'none' as const,
  },
  minimapAgent: {
    position: 'absolute' as const,
    backgroundColor: '#0f3460',
    borderRadius: '2px',
  },
};

// =============================================================================
// AgentCanvas Component
// =============================================================================

export const AgentCanvas: React.FC<AgentCanvasProps> = ({
  canvasManager: externalManager,
  onAgentSelect,
  onChatRequest,
  onImportComplete,
  className,
  showToolbar = true,
  showMinimap = false,
  readOnly = false,
}) => {
  // Manager instances
  const manager = useMemo(() => 
    externalManager || getDefaultAgentCanvasManager(),
    [externalManager]
  );

  const lifecycleManager = useMemo(() => 
    createAgentLifecycleManager(manager),
    [manager]
  );

  // PERFORMANCE: Split state into independent pieces to reduce re-renders
  // Each state slice only triggers re-renders for components that use it
  const [agents, setAgents] = useState<CanvasAgent[]>([]);
  const [layouts, setLayouts] = useState<Map<string, AgentLayout>>(new Map());
  const [viewport, setViewport] = useState<CanvasViewport>({ x: 0, y: 0, zoom: 1, width: 1920, height: 1080 });
  const [selection, setSelection] = useState<SelectionState>({ selectedIds: new Set(), lastSelected: null, multiSelect: false });
  const [dragState, setDragState] = useState<{ isDragging: boolean; dragTarget: string | null; dragOffset: { x: number; y: number } }>({
    isDragging: false,
    dragTarget: null,
    dragOffset: { x: 0, y: 0 }
  });
  const [panState, setPanState] = useState<{ isPanning: boolean; panStart: { x: number; y: number } }>({
    isPanning: false,
    panStart: { x: 0, y: 0 }
  });
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);

  const [showImportMenu, setShowImportMenu] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // ===========================================================================
  // Sync with Manager
  // ===========================================================================

  useEffect(() => {
    // Initial load
    setAgents(manager.getAllAgents());
    setLayouts(manager.getAllLayouts());
    setViewport(manager.getViewport());

    // Subscribe to manager events
    const unsubscribe = manager.on('*', (event: CanvasManagerEvent) => {
      switch (event.type) {
        case 'agent:added':
        case 'agent:removed':
        case 'agent:updated':
          // PERFORMANCE: Only update the state slices that changed
          setAgents(manager.getAllAgents());
          setLayouts(manager.getAllLayouts());
          break;
        case 'agent:moved':
          // Only layouts changed, not agents
          setLayouts(manager.getAllLayouts());
          break;
        case 'selection:changed':
          if (event.selection) {
            setSelection(event.selection);
            onAgentSelect?.(event.selection.lastSelected);
          }
          break;
        case 'viewport:changed':
          if (event.viewport) {
            setViewport(event.viewport);
          }
          break;
        case 'import:started':
          setImportProgress({ status: 'processing', message: 'Importing agent...' });
          break;
        case 'import:completed':
          setImportProgress({ status: 'success', message: 'Agent imported successfully!' });
          setTimeout(() => setImportProgress(null), 2000);
          onImportComplete?.(event.importResult!);
          break;
        case 'import:failed':
          setImportProgress({
            status: 'error',
            message: event.error?.message || 'Import failed'
          });
          setTimeout(() => setImportProgress(null), 3000);
          break;
      }
    });

    return () => {
      unsubscribe();
    };
  }, [manager, onAgentSelect, onImportComplete]);

  // ===========================================================================
  // Drag and Drop Import
  // ===========================================================================

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!readOnly) {
      setIsDropTarget(true);
    }
  }, [readOnly]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDropTarget(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDropTarget(false);

    if (readOnly) return;

    const files = Array.from(e.dataTransfer.files).filter(
      f => f.name.endsWith('.json') || f.name.endsWith('.yaml') || f.name.endsWith('.yml')
    );

    if (files.length === 0) return;

    // Get drop position
    const rect = canvasRef.current?.getBoundingClientRect();
    const dropX = rect ? (e.clientX - rect.left) / viewport.zoom + viewport.x : 100;
    const dropY = rect ? (e.clientY - rect.top) / viewport.zoom + viewport.y : 100;

    // Import files
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const position = {
        x: dropX + i * 40,
        y: dropY + i * 40,
      };

      try {
        await manager.importFromFile(file, position);
      } catch (error) {
        console.error(`Failed to import ${file.name}:`, error);
      }
    }
  }, [manager, readOnly, viewport]);

  // ===========================================================================
  // Canvas Interactions
  // ===========================================================================

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current || e.target === contentRef.current) {
      // Start panning
      setPanState({
        isPanning: true,
        panStart: { x: e.clientX, y: e.clientY },
      });
      
      // Clear selection if not holding shift
      if (!e.shiftKey) {
        manager.clearSelection();
      }
    }
  }, [manager]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (panState.isPanning) {
      const dx = e.clientX - panState.panStart.x;
      const dy = e.clientY - panState.panStart.y;
      
      manager.setViewport({
        x: viewport.x - dx / viewport.zoom,
        y: viewport.y - dy / viewport.zoom,
      });

      setPanState(prev => ({
        ...prev,
        panStart: { x: e.clientX, y: e.clientY },
      }));
    } else if (dragState.isDragging && dragState.dragTarget && !readOnly) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const x = (e.clientX - rect.left) / viewport.zoom + viewport.x - dragState.dragOffset.x;
        const y = (e.clientY - rect.top) / viewport.zoom + viewport.y - dragState.dragOffset.y;
        manager.moveAgent(dragState.dragTarget, { x, y });
      }
    }
  }, [panState, dragState, viewport, manager, readOnly]);

  const handleCanvasMouseUp = useCallback(() => {
    setPanState(prev => ({ ...prev, isPanning: false }));
    setDragState({ isDragging: false, dragTarget: null, dragOffset: { x: 0, y: 0 } });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(2, viewport.zoom * delta));
    
    // Zoom toward cursor position
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const wx = viewport.x + mouseX / viewport.zoom;
      const wy = viewport.y + mouseY / viewport.zoom;
      
      const newX = wx - mouseX / newZoom;
      const newY = wy - mouseY / newZoom;
      
      manager.setViewport({ x: newX, y: newY, zoom: newZoom });
    }
  }, [viewport, manager]);

  // ===========================================================================
  // Agent Node Interactions
  // ===========================================================================

  const handleAgentMouseDown = useCallback((agentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const layout = layouts.get(agentId);
    if (!layout || readOnly) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const mouseX = (e.clientX - rect.left) / viewport.zoom + viewport.x;
      const mouseY = (e.clientY - rect.top) / viewport.zoom + viewport.y;
      
      setDragState({
        isDragging: true,
        dragTarget: agentId,
        dragOffset: {
          x: mouseX - layout.position.x,
          y: mouseY - layout.position.y,
        },
      });
    }

    manager.selectAgent(agentId, e.shiftKey);
  }, [layouts, viewport, manager, readOnly]);

  const handleAgentWake = useCallback(async (agentId: string) => {
    try {
      await lifecycleManager.wake(agentId);
    } catch (error) {
      console.error(`Failed to wake agent ${agentId}:`, error);
    }
  }, [lifecycleManager]);

  const handleAgentSleep = useCallback(async (agentId: string) => {
    try {
      await lifecycleManager.sleep(agentId);
    } catch (error) {
      console.error(`Failed to sleep agent ${agentId}:`, error);
    }
  }, [lifecycleManager]);

  const handleAgentRemove = useCallback((agentId: string) => {
    if (readOnly) return;
    manager.removeAgent(agentId);
  }, [manager, readOnly]);

  const handleAgentChat = useCallback((agentId: string) => {
    onChatRequest?.(agentId);
  }, [onChatRequest]);

  // ===========================================================================
  // Zoom Controls
  // ===========================================================================

  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(2, viewport.zoom * 1.2);
    manager.setViewport({ zoom: newZoom });
  }, [viewport.zoom, manager]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(0.1, viewport.zoom / 1.2);
    manager.setViewport({ zoom: newZoom });
  }, [viewport.zoom, manager]);

  const handleZoomReset = useCallback(() => {
    manager.setViewport({ x: 0, y: 0, zoom: 1 });
  }, [manager]);

  const handleFitToContent = useCallback(() => {
    manager.zoomToFit();
  }, [manager]);

  // ===========================================================================
  // Keyboard Shortcuts
  // ===========================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target !== document.body) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!readOnly) {
          const selected = Array.from(selection.selectedIds);
          selected.forEach(id => manager.removeAgent(id));
        }
      } else if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        manager.selectAll();
      } else if (e.key === 'Escape') {
        manager.clearSelection();
        setShowImportMenu(false);
      } else if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          manager.redo();
        } else {
          manager.undo();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [manager, readOnly, selection]);

  // ===========================================================================
  // Render
  // ===========================================================================

  // PERFORMANCE: Memoize transform calculation to avoid recalculation during drags
  const transform = useMemo(() =>
    `translate(${-viewport.x * viewport.zoom}px, ${-viewport.y * viewport.zoom}px) scale(${viewport.zoom})`,
    [viewport.x, viewport.y, viewport.zoom]
  );

  return (
    <div 
      className={className}
      style={styles.container}
    >
      {/* Toolbar */}
      {showToolbar && (
        <div style={styles.toolbar}>
          <div style={styles.toolbarLeft}>
            <span style={styles.toolbarTitle}>🦋 Agent Canvas</span>
            <span style={styles.agentCount}>
              {agents.length} agent{agents.length !== 1 ? 's' : ''}
            </span>
            {!readOnly && (
              <button
                style={styles.toolbarButton}
                onClick={() => setShowImportMenu(!showImportMenu)}
              >
                + Import Agent
              </button>
            )}
          </div>
          <div style={styles.toolbarRight}>
            <button style={styles.toolbarButton} onClick={handleFitToContent}>
              Fit
            </button>
            <button style={styles.toolbarButton} onClick={handleZoomReset}>
              100%
            </button>
          </div>
        </div>
      )}

      {/* Import Menu */}
      {showImportMenu && !readOnly && (
        <AgentImportMenu
          onClose={() => setShowImportMenu(false)}
          onImportFile={async (file) => {
            await manager.importFromFile(file);
            setShowImportMenu(false);
          }}
          onImportURL={async (url) => {
            await manager.importFromURL(url);
            setShowImportMenu(false);
          }}
          onImportText={async (text) => {
            await manager.importFromText(text);
            setShowImportMenu(false);
          }}
        />
      )}

      {/* Canvas Area */}
      <div
        ref={canvasRef}
        style={{
          ...styles.canvasWrapper,
          ...(panState.isPanning ? styles.canvasPanning : {}),
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onWheel={handleWheel}
      >
        {/* Grid Pattern */}
        <div style={styles.gridPattern} />

        {/* Canvas Content */}
        <div
          ref={contentRef}
          style={{
            ...styles.canvasContent,
            transform,
          }}
        >
          {agents.map(agent => {
            const layout = layouts.get(agent.id);
            if (!layout) return null;

            return (
              <AgentNodeWidget
                key={agent.id}
                agent={agent}
                layout={layout}
                isSelected={selection.selectedIds.has(agent.id)}
                onMouseDown={(e) => handleAgentMouseDown(agent.id, e)}
                onWake={() => handleAgentWake(agent.id)}
                onSleep={() => handleAgentSleep(agent.id)}
                onRemove={() => handleAgentRemove(agent.id)}
                onChat={() => handleAgentChat(agent.id)}
                readOnly={readOnly}
              />
            );
          })}
        </div>

        {/* Empty State */}
        {agents.length === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>🦋</div>
            <div style={styles.emptyTitle}>No Agents Yet</div>
            <div style={styles.emptySubtitle}>
              Drag and drop agent files here, or use the Import button
            </div>
          </div>
        )}

        {/* Drop Overlay */}
        {isDropTarget && (
          <div style={styles.dropOverlay}>
            <div style={styles.dropText}>Drop Agent Files Here</div>
            <div style={styles.dropSubtext}>
              Supports JSON and YAML (uSA, ElizaOS, CrewAI, Replicant)
            </div>
          </div>
        )}

        {/* Zoom Controls */}
        <div style={styles.zoomControls}>
          <button style={styles.zoomButton} onClick={handleZoomIn}>+</button>
          <div style={styles.zoomLevel}>{Math.round(viewport.zoom * 100)}%</div>
          <button style={styles.zoomButton} onClick={handleZoomOut}>−</button>
        </div>

        {/* Import Progress */}
        {importProgress && (
          <div style={styles.importProgress}>
            {importProgress.status === 'processing' && (
              <div style={styles.importSpinner} />
            )}
            <span style={styles.importText}>{importProgress.message}</span>
          </div>
        )}

        {/* Minimap */}
        {showMinimap && agents.length > 0 && (
          <div style={styles.minimap}>
            {/* Minimap content would go here */}
          </div>
        )}
      </div>

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AgentCanvas;
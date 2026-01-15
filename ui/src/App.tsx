/**
 * ChrysalisTerminal App
 * 
 * Main application component that connects to the terminal backend
 * and renders the three-frame UI with live YJS synchronization.
 */

import { useState, useCallback, useMemo } from 'react';
import { ThreeFrameLayout } from './components/ThreeFrameLayout/ThreeFrameLayout';
import { CanvasNavigator, type Agent } from './components/CanvasNavigator';
import { type CanvasTab, type CanvasType, type CanvasConfig } from './components/CanvasNavigator/types';
import { CanvasTabBar } from './components/CanvasTabBar';
import { HiddenCanvasDrawer } from './components/CanvasNavigator/HiddenCanvasDrawer';
import { ChatPane } from './components/ChatPane/ChatPane';
import { ReactFlowCanvas } from './components/ReactFlowCanvas';
import { SettingsCanvas } from './components/SettingsCanvas';
import { ScrapbookCanvas } from './components/ScrapbookCanvas';
import { ResearchCanvas } from './components/ResearchCanvas';
import { WikiCanvas } from './components/WikiCanvas';
import { TerminalCanvas } from './components/TerminalCanvas';
import { BrowserCanvas } from './components/BrowserCanvas';
import { ScenariosCanvas } from './components/ScenariosCanvas';
import { CurationCanvas } from './components/CurationCanvas';
import { MediaCanvas } from './components/MediaCanvas';
import { WalletModal } from './components/Wallet';
import { WalletProvider } from './contexts/WalletContext';
import { VoyeurProvider } from './contexts/VoyeurContext';
import { VoyeurPane } from './components/VoyeurPane';
import { useTerminal } from './hooks/useTerminal';
import { Badge, Button } from './components/design-system';
import './App.css';

// ============================================================================
// Types
// ============================================================================

interface AppProps {
  /** Terminal ID to connect to */
  terminalId?: string;
  /** WebSocket server URL */
  serverUrl?: string;
}

// ============================================================================
// Header Component
// ============================================================================

interface HeaderProps {
  connected: boolean;
  synced: boolean;
  sessionName?: string;
  participantCount: number;
  onToggleVoyeur?: () => void;
  voyeurOpen?: boolean;
}

function Header({ connected, synced, sessionName, participantCount, onToggleVoyeur, voyeurOpen }: HeaderProps) {
  return (
    <div className="app-header">
      <div className="app-logo">
        <span className="logo-icon">🦋</span>
        <div>
          <div className="logo-text">Chrysalis</div>
          <div style={{ fontSize: '0.625rem', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
            AI Agent Interaction Workbench
          </div>
        </div>
      </div>
      
      <div className="app-session" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <span className="session-name">{sessionName || 'New Session'}</span>
          <span className="session-participants">
            {participantCount} participant{participantCount !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ height: '32px', width: '1px', background: 'var(--color-border-subtle)' }} />
        <Badge variant={connected ? 'live' : 'error'} withDot>
          {connected ? (synced ? 'Live Session' : 'Connecting...') : 'Offline'}
        </Badge>
        {participantCount > 0 && (
          <Badge variant="default">
            {participantCount} Agent{participantCount !== 1 ? 's' : ''} Active
          </Badge>
        )}
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        {onToggleVoyeur && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onToggleVoyeur}
            title="Toggle Observability Stream"
          >
            <span style={{ fontSize: '0.875rem' }}>👁️</span>
            {voyeurOpen ? 'Hide' : 'Show'} Voyeur
          </Button>
        )}
        <Button variant="ghost" size="sm">
          <span style={{ fontSize: '0.875rem' }}>📁</span>
          Project
        </Button>
        <Button variant="ghost" size="sm">
          <span style={{ fontSize: '0.875rem' }}>💾</span>
          Save
        </Button>
        <Button variant="ghost" size="sm">
          <span style={{ fontSize: '0.875rem' }}>⚙️</span>
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Footer Component
// ============================================================================

interface FooterProps {
  leftMessageCount: number;
  rightMessageCount: number;
  widgetCount: number;
}

function Footer({ leftMessageCount, rightMessageCount, widgetCount }: FooterProps) {
  return (
    <div className="app-footer">
      <div className="footer-stats">
        <span>🤖 Agent: {leftMessageCount} messages</span>
        <span>👤 Human: {rightMessageCount} messages</span>
        <span>🎨 Canvas: {widgetCount} widgets</span>
      </div>
      <div className="footer-version">
        Chrysalis v3.1.0
      </div>
    </div>
  );
}

// ============================================================================
// Main App Component
// ============================================================================

export function App({ terminalId, serverUrl }: AppProps) {
  return (
    <WalletProvider>
      <VoyeurProvider
        options={{
          serverUrl: 'http://localhost:8787',
          streamPath: '/voyeur-stream',
          maxBufferSize: 500
        }}
        autoConnect={false}
      >
        <AppContent terminalId={terminalId} serverUrl={serverUrl} />
        <WalletModal />
      </VoyeurProvider>
    </WalletProvider>
  );
}

function AppContent({ terminalId, serverUrl }: AppProps) {
  // Connect to terminal
  const terminal = useTerminal({
    terminalId: terminalId || 'default',
    serverUrl,
    autoConnect: true
  });

  // Local UI state - Canvas navigation
  const defaultConfig: CanvasConfig = {
    scrollMode: 'both',
    gridSize: 24,
    autoExpand: true,
    snapToGrid: true,
    allowOverlap: false,
  };

  const [canvases, setCanvases] = useState<CanvasTab[]>([
    { id: 'canvas-0', index: 0, type: 'settings', title: 'Settings', isFixed: true, isVisible: true, isPinned: true, config: defaultConfig },
    { id: 'canvas-1', index: 1, type: 'scrapbook', title: 'Scrapbook', isFixed: false, isVisible: true, isPinned: false, config: defaultConfig },
    { id: 'canvas-2', index: 2, type: 'research', title: 'Research', isFixed: false, isVisible: true, isPinned: false, config: defaultConfig },
    { id: 'canvas-3', index: 3, type: 'wiki', title: 'Wiki', isFixed: false, isVisible: true, isPinned: false, config: defaultConfig },
    { id: 'canvas-4', index: 4, type: 'terminal', title: 'Terminal', isFixed: false, isVisible: true, isPinned: false, config: defaultConfig },
  ]);
  const [activeCanvasId, setActiveCanvasId] = useState('canvas-0');
  
  // Agent roster
  const [agents] = useState<Agent[]>([
    { id: 'ada', name: 'Ada Lovelace', role: 'Creative Coach', status: 'active' },
    { id: 'dgv', name: 'DGV', role: 'Action Executor', status: 'active' },
    { id: 'milton', name: 'Milton', role: 'Ops Guardian', status: 'idle' },
  ]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [voyeurOpen, setVoyeurOpen] = useState(false);

  // Canvas handlers
  const handleCanvasSelect = useCallback((canvasId: string) => {
    setActiveCanvasId(canvasId);
  }, []);

  const handleCanvasTypeChange = useCallback((canvasId: string, newType: CanvasType) => {
    setCanvases(prev => prev.map(canvas => 
      canvas.id === canvasId ? { ...canvas, type: newType } : canvas
    ));
  }, []);

  const handleCanvasRename = useCallback((canvasId: string, newTitle: string) => {
    setCanvases(prev => prev.map(canvas =>
      canvas.id === canvasId ? { ...canvas, title: newTitle } : canvas
    ));
  }, []);

  const handleCanvasHide = useCallback((canvasId: string) => {
    setCanvases(prev => prev.map(canvas =>
      canvas.id === canvasId ? { ...canvas, isVisible: false } : canvas
    ));
  }, []);

  const handleCanvasShow = useCallback((canvasId: string) => {
    setCanvases(prev => prev.map(canvas =>
      canvas.id === canvasId ? { ...canvas, isVisible: true } : canvas
    ));
  }, []);

  const handleCanvasClose = useCallback((canvasId: string) => {
    setCanvases(prev => {
      const canvas = prev.find(c => c.id === canvasId);
      if (canvas?.isFixed) return prev; // Cannot close fixed canvases
      
      const updated = prev.filter(c => c.id !== canvasId);
      if (activeCanvasId === canvasId && updated.length > 0) {
        setActiveCanvasId(updated[0].id);
      }
      return updated;
    });
  }, [activeCanvasId]);

  const handleCanvasAdd = useCallback(() => {
    const newId = `canvas-${Date.now()}`;
    const newCanvas: CanvasTab = {
      id: newId,
      index: canvases.length,
      type: 'board',
      title: `Canvas ${canvases.length + 1}`,
      isFixed: false,
      isVisible: true,
      isPinned: false,
      config: defaultConfig,
    };
    setCanvases(prev => [...prev, newCanvas]);
    setActiveCanvasId(newId);
  }, [canvases.length, defaultConfig]);

  const handleCanvasDuplicate = useCallback((canvasId: string) => {
    const canvas = canvases.find(c => c.id === canvasId);
    if (!canvas) return;

    const newId = `canvas-${Date.now()}`;
    const newCanvas: CanvasTab = {
      ...canvas,
      id: newId,
      title: `${canvas.title} (Copy)`,
      index: canvases.length,
      isFixed: false,
    };
    setCanvases(prev => [...prev, newCanvas]);
    setActiveCanvasId(newId);
  }, [canvases]);

  const hiddenCanvases = useMemo(() => 
    canvases.filter(c => !c.isVisible),
    [canvases]
  );

  // Chat handlers
  const handleHumanSendMessage = useCallback((content: string) => {
    terminal.actions.sendHumanMessage(content);
  }, [terminal.actions]);

  const handleViewportChange = useCallback((viewport: { x: number; y: number; zoom: number }) => {
    terminal.actions.setViewport(viewport.x, viewport.y, viewport.zoom);
  }, [terminal.actions]);

  // Computed values - useMemo to avoid recalculating on every render
  const participantCount = useMemo(() => {
    if (!terminal.session) return 0;
    const left = terminal.session.left.participants.length;
    const right = terminal.session.right.participants.length;
    return left + right;
  }, [terminal.session]);

  const widgetCount = useMemo(() => 
    terminal.canvas.nodes.filter(n => n.type === 'widget').length,
    [terminal.canvas.nodes]
  );

  const activeCanvas = useMemo(() => 
    canvases.find(c => c.id === activeCanvasId),
    [canvases, activeCanvasId]
  );

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      padding: 'var(--space-3)',
      background: 'linear-gradient(135deg, var(--color-slate-900) 0%, var(--color-slate-800) 50%, var(--color-slate-900) 100%)'
    }}>
      <div className="mercury-frame" style={{ height: '100%' }}>
        <div className="mercury-frame-inner">
          <ThreeFrameLayout
            header={
              <>
                <Header
                  connected={terminal.connected}
                  synced={terminal.synced}
                  sessionName={terminal.session?.name || 'New Session'}
                  participantCount={participantCount}
                  onToggleVoyeur={() => setVoyeurOpen(!voyeurOpen)}
                  voyeurOpen={voyeurOpen}
                />
                <CanvasTabBar
                  canvases={canvases}
                  activeCanvasId={activeCanvasId}
                  onCanvasSelect={handleCanvasSelect}
                  onCanvasRename={handleCanvasRename}
                  onCanvasHide={handleCanvasHide}
                  onCanvasClose={handleCanvasClose}
                  onCanvasAdd={handleCanvasAdd}
                  onCanvasDuplicate={handleCanvasDuplicate}
                  onCanvasTypeChange={(id) => {
                    // Open type selector modal - for now just cycle through types
                    const canvas = canvases.find(c => c.id === id);
                    if (canvas) {
                      const types: CanvasType[] = ['board', 'scrapbook', 'research', 'wiki', 'terminal', 'browser', 'scenarios', 'curation', 'media'];
                      const currentIndex = types.indexOf(canvas.type);
                      const nextType = types[(currentIndex + 1) % types.length];
                      handleCanvasTypeChange(id, nextType);
                    }
                  }}
                />
              </>
            }
      leftPane={
        <>
          <CanvasNavigator
            canvases={canvases.filter(c => c.isVisible)}
            activeCanvasId={activeCanvasId}
            agents={agents}
            onCanvasSelect={handleCanvasSelect}
            onCanvasTypeChange={handleCanvasTypeChange}
          />
          {hiddenCanvases.length > 0 && (
            <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--color-slate-800)' }}>
              <HiddenCanvasDrawer
                hiddenCanvases={hiddenCanvases}
                onCanvasShow={handleCanvasShow}
                onCanvasClose={handleCanvasClose}
              />
            </div>
          )}
        </>
      }
      centerPane={
        <div style={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          background: 'var(--color-slate-900)'
        }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {activeCanvas?.type === 'settings' ? (
              <SettingsCanvas />
            ) : activeCanvas?.type === 'scrapbook' ? (
              <ScrapbookCanvas />
            ) : activeCanvas?.type === 'research' ? (
              <ResearchCanvas />
            ) : activeCanvas?.type === 'wiki' ? (
              <WikiCanvas />
            ) : activeCanvas?.type === 'terminal' ? (
              <TerminalCanvas />
            ) : activeCanvas?.type === 'browser' ? (
              <BrowserCanvas />
            ) : activeCanvas?.type === 'scenarios' ? (
              <ScenariosCanvas />
            ) : activeCanvas?.type === 'curation' ? (
              <CurationCanvas />
            ) : activeCanvas?.type === 'media' ? (
              <MediaCanvas canvasId={activeCanvas.id} />
            ) : (
              <>
                <div style={{ 
                  padding: 'var(--space-4)', 
                  borderBottom: '1px solid var(--color-slate-800)',
                  background: 'var(--color-slate-850)'
                }}>
                  <h2 style={{ 
                    margin: 0, 
                    fontSize: 'var(--font-size-lg)',
                    fontWeight: 'var(--font-weight-semibold)',
                    color: 'var(--color-text-primary)'
                  }}>
                    {activeCanvas?.title}
                    <span style={{ 
                      marginLeft: 'var(--space-3)',
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--color-text-tertiary)',
                      fontWeight: 'var(--font-weight-normal)'
                    }}>
                      {activeCanvas?.type}
                    </span>
                  </h2>
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <ReactFlowCanvas
                    onViewportChange={handleViewportChange}
                    onNodeSelect={setSelectedNodeId}
                    selectedNodeId={selectedNodeId}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      }
      rightPane={
        <ChatPane
          side="right"
          messages={terminal.rightPane.messages}
          isTyping={terminal.rightPane.isTyping}
          onSendMessage={handleHumanSendMessage}
          onTypingChange={terminal.actions.setHumanTyping}
          title="👤 You"
          placeholder="Type a message to the agent..."
        />
      }
            footer={
              <Footer
                leftMessageCount={terminal.leftPane.messages.length}
                rightMessageCount={terminal.rightPane.messages.length}
                widgetCount={widgetCount}
              />
            }
          />
        </div>
      </div>
      
      {/* Voyeur Modal Overlay */}
      {voyeurOpen && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)'
          }}
          onClick={() => setVoyeurOpen(false)}
        >
          <div
            style={{
              width: '90%',
              height: '80%',
              maxWidth: '1200px',
              background: 'var(--bg-primary, #1a1a2e)',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
              border: '1px solid var(--border-color, #2d2d44)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <VoyeurPane />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
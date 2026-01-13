/**
 * ChrysalisTerminal App
 * 
 * Main application component that connects to the terminal backend
 * and renders the three-frame UI with live YJS synchronization.
 */

import { useState, useCallback } from 'react';
import { ThreeFrameLayout } from './components/ThreeFrameLayout/ThreeFrameLayout';
import { CanvasNavigator, type CanvasTab, type Agent, type CanvasType } from './components/CanvasNavigator';
import { ChatPane } from './components/ChatPane/ChatPane';
import { JSONCanvas } from './components/JSONCanvas/JSONCanvas';
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
  const [canvases, setCanvases] = useState<CanvasTab[]>([
    { id: 'canvas-0', index: 0, type: 'settings', title: 'Settings', isFixed: true },
    { id: 'canvas-1', index: 1, type: 'scrapbook', title: 'Canvas 1', isFixed: false },
    { id: 'canvas-2', index: 2, type: 'storyboard', title: 'Canvas 2', isFixed: false },
    { id: 'canvas-3', index: 3, type: 'remixer', title: 'Canvas 3', isFixed: false },
    { id: 'canvas-4', index: 4, type: 'video', title: 'Canvas 4', isFixed: false },
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

  // Chat handlers
  const handleHumanSendMessage = useCallback((content: string) => {
    terminal.actions.sendHumanMessage(content);
  }, [terminal.actions]);

  const handleAgentSendMessage = useCallback((content: string) => {
    terminal.actions.sendAgentMessage(content);
  }, [terminal.actions]);

  const handleViewportChange = useCallback((viewport: { x: number; y: number; zoom: number }) => {
    terminal.actions.setViewport(viewport.x, viewport.y, viewport.zoom);
  }, [terminal.actions]);

  const handleNodeMove = useCallback((nodeId: string, x: number, y: number) => {
    terminal.actions.updateNode(nodeId, { x, y });
  }, [terminal.actions]);

  // Computed values
  const participantCount = terminal.session?.participants.length || 0;
  const widgetCount = terminal.canvas.nodes.filter(n => n.type === 'widget').length;
  const activeCanvas = canvases.find(c => c.id === activeCanvasId);

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
              <Header
                connected={terminal.connected}
                synced={terminal.synced}
                sessionName={terminal.session?.name || 'New Session'}
                participantCount={participantCount}
                onToggleVoyeur={() => setVoyeurOpen(!voyeurOpen)}
                voyeurOpen={voyeurOpen}
              />
            }
      leftPane={
        <CanvasNavigator
          canvases={canvases}
          activeCanvasId={activeCanvasId}
          agents={agents}
          onCanvasSelect={handleCanvasSelect}
          onCanvasTypeChange={handleCanvasTypeChange}
        />
      }
      centerPane={
        <div style={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          background: 'var(--color-slate-900)'
        }}>
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
              {activeCanvas?.type === 'settings' ? '⚙️ ' : ''}{activeCanvas?.title}
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
            <JSONCanvas
              nodes={terminal.canvas.nodes}
              edges={terminal.canvas.edges}
              viewport={terminal.canvas.viewport}
              onViewportChange={handleViewportChange}
              onNodeSelect={setSelectedNodeId}
              onNodeMove={handleNodeMove}
              selectedNodeId={selectedNodeId}
            />
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
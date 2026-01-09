/**
 * ChrysalisTerminal App
 * 
 * Main application component that connects to the terminal backend
 * and renders the three-frame UI with live YJS synchronization.
 */

import { useState, useCallback } from 'react';
import { ThreeFrameLayout } from './components/ThreeFrameLayout/ThreeFrameLayout';
import { ChatPane } from './components/ChatPane/ChatPane';
import { JSONCanvas } from './components/JSONCanvas/JSONCanvas';
import { WalletModal } from './components/Wallet';
import { WalletProvider } from './contexts/WalletContext';
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
}

function Header({ connected, synced, sessionName, participantCount }: HeaderProps) {
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
      <AppContent terminalId={terminalId} serverUrl={serverUrl} />
      <WalletModal />
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

  // Local UI state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Handlers
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
              />
            }
      leftPane={
        <ChatPane
          side="left"
          messages={terminal.leftPane.messages}
          isTyping={terminal.leftPane.isTyping}
          onSendMessage={handleAgentSendMessage}
          onTypingChange={terminal.actions.setAgentTyping}
          title="🤖 Learning Agent"
        />
      }
      centerPane={
        <JSONCanvas
          nodes={terminal.canvas.nodes}
          edges={terminal.canvas.edges}
          viewport={terminal.canvas.viewport}
          onViewportChange={handleViewportChange}
          onNodeSelect={setSelectedNodeId}
          onNodeMove={handleNodeMove}
          selectedNodeId={selectedNodeId}
        />
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
    </div>
  );
}

export default App;
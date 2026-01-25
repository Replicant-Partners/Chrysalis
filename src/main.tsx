/**
 * Main Entry Point - Chrysalis 3-Pane Workspace
 * 
 * This is the canonical entry point for the Chrysalis web UI.
 * It renders the ChrysalisWorkspace as the shell with:
 * - Left pane: Primary agent chat
 * - Center pane: Canvas application (ReactFlow-based)
 * - Right pane: Secondary agent chat
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { ReactFlowProvider } from 'reactflow';

import { ChrysalisWorkspace } from './components/ChrysalisWorkspace/ChrysalisWorkspace';
import { ThemeProvider } from './components/shared/ThemeContext';
import { CanvasApp } from './canvas-app/CanvasApp';
import { AgentBinding } from './components/ChrysalisWorkspace/types';

import 'reactflow/dist/style.css';

// Default agent bindings - these would typically come from config or user session
const DEFAULT_PRIMARY_AGENT: AgentBinding = {
  agentId: 'ada-primary',
  agentName: 'Ada',
  agentType: 'assistant',
  trustLevel: 'internal',
};

const DEFAULT_SECONDARY_AGENT: AgentBinding = {
  agentId: 'specialist-secondary',
  agentName: 'Specialist',
  agentType: 'researcher',
  trustLevel: 'internal',
};

// Generate a session ID
const sessionId = `session-${Date.now()}`;

// User info (would come from auth in production)
const userId = 'user-local';
const userName = 'User';

/**
 * Root App Component
 * Wraps ChrysalisWorkspace with necessary providers
 */
const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ReactFlowProvider>
        <ChrysalisWorkspace
          sessionId={sessionId}
          userId={userId}
          userName={userName}
          primaryAgent={DEFAULT_PRIMARY_AGENT}
          secondaryAgent={DEFAULT_SECONDARY_AGENT}
          centerContent={<CanvasApp embedded />}
          config={{
            enableYjs: false,
            enableDocumentDrop: true,
            showMemoryIndicators: true,
            maxMessagesPerPane: 100,
            canvasSnapToGrid: true,
            canvasShowGrid: true,
            canvasGridSize: 20,
          }}
          onSessionStart={(session) => {
            console.log('[Chrysalis] Session started:', session.id);
          }}
          onSessionEnd={(session) => {
            console.log('[Chrysalis] Session ended:', session.id);
          }}
          onMessageSent={(message, pane) => {
            console.log(`[Chrysalis] Message sent to ${pane}:`, message.content.slice(0, 50));
          }}
          onAgentResponse={(message, pane) => {
            console.log(`[Chrysalis] Agent response in ${pane}:`, message.content.slice(0, 50));
          }}
        />
      </ReactFlowProvider>
    </ThemeProvider>
  );
};

// Mount the application
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

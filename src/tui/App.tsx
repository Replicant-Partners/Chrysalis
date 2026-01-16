// @ts-nocheck - Ink v6 types require moduleResolution: bundler/node16
/**
 * Chrysalis TUI Root Application
 *
 * Main application component that orchestrates the multi-agent chat interface.
 * Uses Ink (React for CLI) to render a full-screen TUI with:
 * - Conversation pane (multi-agent messages)
 * - Sidebar (agents, memory, sync status)
 * - Status bar (tokens, cost)
 * - Input bar (user input, magic commands)
 *
 * @module tui/App
 */

import React, { useEffect } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import { Layout } from './components/layout/Layout';
import { ConversationPane } from './components/conversation/ConversationPane';
import { Sidebar } from './components/layout/Sidebar';
import { StatusBar } from './components/common/StatusBar';
import { InputBar } from './components/input/InputBar';
import { Header } from './components/common/Header';
import { useMessageStore } from './stores/messageStore';
import { useAgentStore } from './stores/agentStore';
import { useConfigStore } from './stores/configStore';
import type { TUIOptions } from './types/config';

interface ChrysalisAppProps {
  options?: TUIOptions;
}

/**
 * Root application component
 */
export const ChrysalisApp: React.FC<ChrysalisAppProps> = ({ options = {} }) => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const config = useConfigStore();
  const messages = useMessageStore();
  const agents = useAgentStore();

  // Initialize configuration from options
  useEffect(() => {
    if (options?.agent) {
      agents.setFocusedAgent(options.agent);
    }
    if (options?.noSidebar) {
      config.setSidebarVisible(false);
    }
    if (options?.session) {
      // TODO: Load session
    }
  }, [options, agents, config]);

  // Global keyboard handling
  useInput((input: string, key: { ctrl?: boolean; escape?: boolean }) => {
    // Ctrl+C: Exit
    if (key.ctrl && input === 'c') {
      exit();
      return;
    }

    // Ctrl+L: Clear screen (handled by terminal)
    if (key.ctrl && input === 'l') {
      messages.clearMessages();
      return;
    }

    // Ctrl+S: Toggle sidebar
    if (key.ctrl && input === 's') {
      config.toggleSidebar();
      return;
    }

    // Escape: Cancel current operation
    if (key.escape) {
      // TODO: Implement cancel
      return;
    }
  });

  // Calculate terminal dimensions
  const terminalWidth = stdout?.columns ?? 120;
  const terminalHeight = stdout?.rows ?? 40;

  // Layout proportions
  const sidebarWidth = config.sidebarVisible ? Math.floor(terminalWidth * 0.25) : 0;
  const mainPaneWidth = terminalWidth - sidebarWidth;

  return (
    <Box
      flexDirection="column"
      width={terminalWidth}
      height={terminalHeight}
    >
      {/* Header */}
      <Header />

      {/* Main content area */}
      <Box flexGrow={1} flexDirection="row">
        {/* Main pane (conversation) */}
        <Box
          flexDirection="column"
          width={mainPaneWidth}
          borderStyle="single"
          borderColor="gray"
        >
          <ConversationPane height={terminalHeight - 6} />
        </Box>

        {/* Sidebar (conditional) */}
        {config.sidebarVisible && (
          <Box width={sidebarWidth}>
            <Sidebar />
          </Box>
        )}
      </Box>

      {/* Status bar */}
      <StatusBar />

      {/* Input bar */}
      <InputBar />
    </Box>
  );
};

export default ChrysalisApp;

#!/usr/bin/env node
/**
 * ESM entry point for Chrysalis TUI
 *
 * This wrapper is needed because Ink v5+ depends on yoga-layout
 * which uses top-level await, requiring ESM mode.
 *
 * Usage: node src/tui/run.mjs [--agent <name>] [--no-sidebar] [--debug]
 */

import React from 'react';
import { render, Box, Text, useInput, useApp, useStdout } from 'ink';
import { create } from 'zustand';

// Simple message store
const useMessageStore = create((set, get) => ({
  messages: [],
  totalTokens: 0,
  totalCost: 0,
  addSystemMessage: (type, content) => {
    set((state) => ({
      messages: [...state.messages, {
        id: `msg_${Date.now()}`,
        type,
        content,
        timestamp: new Date()
      }]
    }));
  },
  addUserMessage: (content) => {
    set((state) => ({
      messages: [...state.messages, {
        id: `msg_${Date.now()}`,
        content,
        timestamp: new Date(),
        isUser: true
      }]
    }));
  },
  clearMessages: () => set({ messages: [] })
}));

// Input component
function InputBar() {
  const [input, setInput] = React.useState('');
  const addUserMessage = useMessageStore((s) => s.addUserMessage);
  const addSystemMessage = useMessageStore((s) => s.addSystemMessage);
  const clearMessages = useMessageStore((s) => s.clearMessages);
  const { exit } = useApp();

  useInput((char, key) => {
    if (key.return) {
      if (!input.trim()) return;
      const trimmed = input.trim();

      if (trimmed.startsWith('/')) {
        addUserMessage(trimmed);
        const cmd = trimmed.slice(1).split(/\s+/)[0]?.toLowerCase();

        switch (cmd) {
          case 'help':
            addSystemMessage('info', `Commands: /help, /reset, /quit, /agents, /skill, /remember`);
            break;
          case 'reset':
            clearMessages();
            addSystemMessage('success', 'Conversation cleared');
            break;
          case 'quit':
          case 'exit':
            exit();
            return;
          case 'agents':
            addSystemMessage('info', '🏗️ Architect (idle), 💻 Coder (idle), 🔍 Reviewer (idle)');
            break;
          default:
            addSystemMessage('warning', `Unknown command: /${cmd}`);
        }
      } else {
        addUserMessage(trimmed);
        addSystemMessage('info', 'ACP integration pending - message not sent to agents');
      }
      setInput('');
    } else if (key.backspace || key.delete) {
      setInput(input.slice(0, -1));
    } else if (char && !key.ctrl && !key.meta) {
      setInput(input + char);
    }
  });

  return React.createElement(Box, {
    borderStyle: 'single',
    borderColor: 'cyan',
    paddingX: 1
  },
    React.createElement(Text, { color: 'cyan' }, '> '),
    React.createElement(Text, null, input || React.createElement(Text, { color: 'gray' }, 'Type a message or /help for commands...')),
    React.createElement(Text, { color: 'cyan' }, '▎')
  );
}

// Message list
function ConversationPane() {
  const messages = useMessageStore((s) => s.messages);

  return React.createElement(Box, {
    flexDirection: 'column',
    flexGrow: 1,
    paddingX: 1
  },
    messages.length === 0 ?
      React.createElement(Box, { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
        React.createElement(Text, { color: 'gray' }, 'No messages yet. Type a message or /help for commands.')
      ) :
      messages.map((msg) =>
        React.createElement(Box, { key: msg.id, marginY: 0 },
          msg.isUser ?
            React.createElement(Text, { color: 'blue' }, '> ', msg.content) :
            React.createElement(Text, {
              color: msg.type === 'error' ? 'red' :
                     msg.type === 'warning' ? 'yellow' :
                     msg.type === 'success' ? 'green' : 'gray'
            }, '[System] ', msg.content)
        )
      )
  );
}

// Sidebar
function Sidebar() {
  return React.createElement(Box, {
    flexDirection: 'column',
    borderStyle: 'single',
    borderColor: 'gray',
    paddingX: 1,
    width: 25
  },
    React.createElement(Text, { bold: true, color: 'white' }, 'AGENTS'),
    React.createElement(Text, { color: 'gray' }, '⚪ 🏗️ Architect'),
    React.createElement(Text, { color: 'gray' }, '⚪ 💻 Coder'),
    React.createElement(Text, { color: 'gray' }, '⚪ 🔍 Reviewer'),
    React.createElement(Box, { marginTop: 1 }),
    React.createElement(Text, { bold: true, color: 'white' }, 'MEMORY'),
    React.createElement(Text, { color: 'gray' }, '├─ Episodic: ', React.createElement(Text, { color: 'cyan' }, '--')),
    React.createElement(Text, { color: 'gray' }, '├─ Semantic: ', React.createElement(Text, { color: 'cyan' }, '--')),
    React.createElement(Text, { color: 'gray' }, '└─ Skills: ', React.createElement(Text, { color: 'cyan' }, '--')),
    React.createElement(Box, { marginTop: 1 }),
    React.createElement(Text, { bold: true, color: 'white' }, 'SYNC'),
    React.createElement(Text, { color: 'gray' }, '└─ ', React.createElement(Text, { color: 'green' }, '✓'), ' Ready')
  );
}

// Status bar
function StatusBar() {
  const totalTokens = useMessageStore((s) => s.totalTokens);
  const totalCost = useMessageStore((s) => s.totalCost);

  return React.createElement(Box, {
    borderStyle: 'single',
    borderColor: 'gray',
    paddingX: 1,
    justifyContent: 'space-between'
  },
    React.createElement(Box, null,
      React.createElement(Text, { color: 'gray' }, 'Tokens: ', React.createElement(Text, { color: 'cyan' }, totalTokens.toLocaleString())),
      React.createElement(Text, { color: 'gray' }, ' │ Cost: ', React.createElement(Text, { color: 'green' }, '$', totalCost.toFixed(4)))
    ),
    React.createElement(Text, { color: 'gray' }, '/help for commands')
  );
}

// Header
function Header() {
  return React.createElement(Box, {
    borderStyle: 'single',
    borderColor: 'cyan',
    paddingX: 1,
    justifyContent: 'space-between'
  },
    React.createElement(Text, { bold: true, color: 'cyan' }, '🦋 CHRYSALIS v3.1.1'),
    React.createElement(Text, { color: 'green' }, '[Byzantine: ✅ Synced]')
  );
}

// Main app
function ChrysalisApp({ showSidebar = true }) {
  const { stdout } = useStdout();
  const { exit } = useApp();
  const terminalWidth = stdout?.columns ?? 120;
  const terminalHeight = stdout?.rows ?? 40;

  useInput((char, key) => {
    if (key.ctrl && char === 'c') {
      exit();
    }
  });

  return React.createElement(Box, {
    flexDirection: 'column',
    width: terminalWidth,
    height: terminalHeight
  },
    React.createElement(Header),
    React.createElement(Box, { flexGrow: 1, flexDirection: 'row' },
      React.createElement(Box, {
        flexDirection: 'column',
        flexGrow: 1,
        borderStyle: 'single',
        borderColor: 'gray'
      },
        React.createElement(ConversationPane)
      ),
      showSidebar && React.createElement(Sidebar)
    ),
    React.createElement(StatusBar),
    React.createElement(InputBar)
  );
}

// Parse args
const args = process.argv.slice(2);
let showSidebar = true;
for (const arg of args) {
  if (arg === '--no-sidebar') showSidebar = false;
}

// Render
console.clear();
const { waitUntilExit } = render(React.createElement(ChrysalisApp, { showSidebar }));
await waitUntilExit();

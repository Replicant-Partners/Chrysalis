# Ink vs xterm.js: Terminal Component Analysis for Chrysalis

**Date:** January 16, 2026  
**Version:** 1.0  
**Status:** Technical Analysis  
**Related:** TUI_CHAT_INTERFACE_RECOMMENDATION.md, canvas-architecture.md

---

## Executive Summary

After reviewing the TUI Chat Interface Recommendation and Canvas Architecture documents, along with industry adoption patterns, I recommend a **dual-library approach**:

| Use Case | Recommended Library | Rationale |
|----------|---------------------|-----------|
| **Native TUI (CLI)** | **Ink** | React component model, native terminal, Claude Code/Gemini CLI use it |
| **Web/Canvas Terminal** | **xterm.js** | Browser terminal emulator, WebSocket to PTY |
| **Chat Pane Component** | **Ink (native) + xterm.js (web)** | Same codebase, different renderers |

**Key Insight:** Ink and xterm.js are not competitors—they solve different problems and complement each other perfectly for Chrysalis's hybrid TUI architecture.

---

## Understanding the Fundamental Difference

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       TERMINAL COMPONENT LANDSCAPE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   INK (React for CLI)                   xterm.js (Terminal in Browser)      │
│   ─────────────────────                 ────────────────────────────        │
│                                                                             │
│   ┌─────────────────────┐               ┌─────────────────────┐             │
│   │   Your Terminal     │               │   Browser Window    │             │
│   │   ┌───────────────┐ │               │   ┌───────────────┐ │             │
│   │   │ Ink App       │ │               │   │ React/Vue App │ │             │
│   │   │ ┌───────────┐ │ │               │   │ ┌───────────┐ │ │             │
│   │   │ │ <Box>     │ │ │               │   │ │ <Terminal>│ │ │             │
│   │   │ │ <Text>    │ │ │               │   │ │ xterm.js  │ │ │             │
│   │   │ │ <Spinner> │ │ │               │   │ │ emulator  │ │ │             │
│   │   │ └───────────┘ │ │               │   │ └─────┬─────┘ │ │             │
│   │   └───────────────┘ │               │   └───────┼───────┘ │             │
│   │         │           │               │           │         │             │
│   │         ▼           │               │           ▼         │             │
│   │   ANSI Escape Codes │               │     WebSocket       │             │
│   │   to stdout         │               │     to Server       │             │
│   └─────────────────────┘               └───────────┬─────────┘             │
│                                                     │                       │
│   Runs: Node.js process                             ▼                       │
│   Output: Native terminal                  ┌─────────────────┐              │
│   Input: stdin                             │   node-pty      │              │
│                                            │   (PTY Server)  │              │
│                                            └────────┬────────┘              │
│                                                     │                       │
│                                                     ▼                       │
│                                            ┌─────────────────┐              │
│                                            │   Shell/Process │              │
│                                            └─────────────────┘              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Comparison

### Ink (React for CLI)

**Repository:** [github.com/vadimdemedes/ink](https://github.com/vadimdemedes/ink) - 34K stars

**What It Is:**
- React renderer for command-line interfaces
- Uses Yoga (Flexbox) for terminal layouts
- Components render ANSI escape codes to stdout
- Runs as a Node.js process in a terminal

**Who Uses It (from Ink README):**
- **Claude Code** (Anthropic) - agentic coding tool
- **Gemini CLI** (Google) - agentic coding tool
- **GitHub Copilot CLI** - shell command helper
- **Cloudflare Wrangler** - Workers CLI
- **Gatsby, Prisma, Linear** - build/dev tools

**Strengths:**
| Strength | Details |
|----------|---------|
| React Mental Model | JSX, hooks, component composition |
| Streaming Support | Built-in, perfect for LLM token streaming |
| Flexbox Layout | `<Box>`, `<Text>`, `flexDirection`, `padding` |
| Input Handling | `useInput()` hook for keyboard events |
| Focus Management | `useFocus()`, `useFocusManager()` for navigation |
| Testing | `ink-testing-library` for unit tests |
| TypeScript | Native TypeScript support |
| Size | ~45KB (lightweight) |

**Limitations:**
- Only works in real terminals (not in browsers)
- No mouse support (terminal limitation)
- Can't be embedded in web pages directly

**Example (Multi-Agent Chat):**
```tsx
import { Box, Text, useInput } from 'ink';
import { useState } from 'react';

const AgentMessage = ({ agent, content, streaming }) => (
  <Box flexDirection="column" marginBottom={1}>
    <Text bold color={agent.color}>
      {agent.emoji} {agent.name}
    </Text>
    <Box marginLeft={2}>
      <Text>{content}{streaming && '▌'}</Text>
    </Box>
  </Box>
);

const ChatPane = ({ messages, agents }) => {
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      // Interrupt current agent
    }
  });

  return (
    <Box flexDirection="column" flexGrow={1}>
      {messages.map((msg, i) => (
        <AgentMessage
          key={i}
          agent={agents[msg.agentId]}
          content={msg.content}
          streaming={msg.streaming}
        />
      ))}
    </Box>
  );
};
```

---

### xterm.js (Terminal Emulator for Browser)

**Repository:** [github.com/xtermjs/xterm.js](https://github.com/xtermjs/xterm.js) - 18K stars

**What It Is:**
- Full terminal emulator that runs in browsers
- Renders to a `<canvas>` element
- Connects to backend shells via WebSocket + node-pty
- Emulates VT100/xterm escape sequences

**Who Uses It:**
- **VS Code** - integrated terminal
- **GitHub Codespaces** - cloud dev environments
- **JupyterLab** - terminal widget
- **Hyper** - Electron-based terminal
- **Theia IDE** - cloud IDE

**Strengths:**
| Strength | Details |
|----------|---------|
| Full Terminal | Complete VT100/xterm emulation |
| Browser-Native | Runs in any modern browser |
| WebGL Renderer | GPU-accelerated for performance |
| Addons | fit, weblinks, serialize, search |
| Unicode | Full Unicode + emoji support |
| Mouse Support | Click, scroll, selection |
| Copy/Paste | Native clipboard integration |
| Size | ~250KB (heavier, but full emulation) |

**Limitations:**
- Requires WebSocket + PTY backend for shell access
- More complex setup than Ink
- Not a UI framework—just terminal emulation
- Doesn't help with building chat UIs

**Example (Canvas Terminal Widget):**
```tsx
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { useEffect, useRef } from 'react';

const TerminalWidget = ({ sessionId, wsUrl }) => {
  const termRef = useRef(null);
  const xtermRef = useRef(null);
  
  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      scrollback: 10000,
      fontSize: 14,
    });
    
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(termRef.current);
    fitAddon.fit();
    
    // Connect to PTY via WebSocket
    const ws = new WebSocket(`${wsUrl}/sessions/${sessionId}`);
    ws.onmessage = (e) => term.write(e.data);
    term.onData((data) => ws.send(data));
    
    xtermRef.current = { term, ws, fitAddon };
    
    return () => {
      ws.close();
      term.dispose();
    };
  }, [sessionId, wsUrl]);
  
  return <div ref={termRef} style={{ height: '100%', width: '100%' }} />;
};
```

---

## Chrysalis Use Cases

### Use Case 1: Native TUI (chrysalis CLI)

**Requirement:** Terminal-based multi-agent chat interface that runs in VS Code terminal, iTerm, etc.

**Recommendation: Ink**

**Rationale:**
1. Claude Code and Gemini CLI (direct competitors) both use Ink
2. React component model perfect for multi-agent UX patterns
3. Built-in streaming for LLM token display
4. Flexbox layout for sidebar + main pane + status bar
5. No server required—runs directly in terminal

```tsx
// src/tui/ChrysalisTUI.tsx
import { Box, Text, useInput, useApp, render } from 'ink';
import { ConversationPane } from './ConversationPane';
import { AgentSidebar } from './AgentSidebar';
import { InputBar } from './InputBar';
import { StatusBar } from './StatusBar';

export const ChrysalisTUI = () => {
  return (
    <Box flexDirection="column" height="100%">
      <Box flexGrow={1}>
        <ConversationPane flex={3} />
        <AgentSidebar flex={1} />
      </Box>
      <StatusBar />
      <InputBar />
    </Box>
  );
};

// Entry point
render(<ChrysalisTUI />);
```

---

### Use Case 2: Canvas Terminal Widget

**Requirement:** Terminal sessions embedded in XYFlow canvas (per canvas-architecture.md)

**Recommendation: xterm.js**

**Rationale:**
1. Canvas runs in browser (React web app)
2. Need real shell access (bash, zsh, etc.)
3. xterm.js is the standard for browser terminals
4. VS Code uses it—proven at scale
5. WebGL addon for performance with multiple terminals

```tsx
// src/canvas/widgets/TerminalSession.tsx
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebglAddon } from 'xterm-addon-webgl';
import { useEffect, useRef, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

interface TerminalNodeData {
  widgetType: 'terminal_session';
  sessionId: string;
  cwd?: string;
}

export const TerminalSessionWidget = ({ data }: NodeProps<TerminalNodeData>) => {
  const termRef = useRef<HTMLDivElement>(null);
  const [connected, setConnected] = useState(false);
  
  useEffect(() => {
    if (!termRef.current) return;
    
    const term = new Terminal({
      cursorBlink: true,
      scrollback: 5000,
      fontSize: 13,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
      }
    });
    
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    // WebGL for performance
    const webglAddon = new WebglAddon();
    term.loadAddon(webglAddon);
    
    term.open(termRef.current);
    fitAddon.fit();
    
    // Connect to PTY server
    const ws = new WebSocket(`ws://localhost:3001/pty/${data.sessionId}`);
    ws.onopen = () => setConnected(true);
    ws.onmessage = (e) => term.write(e.data);
    term.onData((data) => ws.send(data));
    
    return () => {
      ws.close();
      webglAddon.dispose();
      term.dispose();
    };
  }, [data.sessionId]);
  
  return (
    <div className="terminal-widget">
      <Handle type="target" position={Position.Left} />
      <div className="terminal-header">
        Terminal: {data.sessionId}
        <span className={`status ${connected ? 'connected' : ''}`} />
      </div>
      <div ref={termRef} style={{ height: 300, width: 500 }} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
};
```

---

### Use Case 3: Chat Pane in Canvas

**Requirement:** Multi-agent chat interface as a canvas widget or web component

**Recommendation: Custom React components (not terminal-based)**

**Rationale:**
1. Chat is NOT a terminal—it's a structured conversation UI
2. Need rich formatting: markdown, code blocks, agent avatars
3. Need streaming text with typing indicators
4. React components give more control than terminal emulation

**However, if you want terminal-style chat in browser:**
- Use xterm.js with custom escape sequences
- Or build custom chat components that LOOK like terminal

```tsx
// Option A: Custom Chat Components (RECOMMENDED)
const ChatPane = ({ messages, agents }) => (
  <div className="chat-pane">
    {messages.map((msg) => (
      <AgentMessage
        key={msg.id}
        agent={agents[msg.agentId]}
        content={msg.content}
        streaming={msg.streaming}
      />
    ))}
    <InputBar onSubmit={handleSubmit} />
  </div>
);

// Option B: Terminal-style via xterm.js (if you really want terminal aesthetic)
const TerminalChat = () => {
  // Render chat messages as ANSI-colored text to xterm
  // This gives terminal look but is more complex
};
```

---

## Hybrid Architecture (Recommended)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CHRYSALIS HYBRID TERMINAL ARCHITECTURE                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   NATIVE CLI (Terminal)                    WEB UI (Browser)                 │
│   ─────────────────────                    ────────────────                 │
│                                                                             │
│   ┌─────────────────────┐                  ┌─────────────────────┐          │
│   │   chrysalis CLI     │                  │   Chrysalis Web     │          │
│   │   (Ink v5)          │                  │   (React + Canvas)  │          │
│   ├─────────────────────┤                  ├─────────────────────┤          │
│   │ ┌─────────────────┐ │                  │ ┌─────────────────┐ │          │
│   │ │ Chat Pane       │ │    Shared        │ │ Chat Pane       │ │          │
│   │ │ (Ink <Box>)     │ │◄──Business ────►│ │ (React comp)    │ │          │
│   │ ├─────────────────┤ │    Logic         │ ├─────────────────┤ │          │
│   │ │ Agent Sidebar   │ │                  │ │ Canvas          │ │          │
│   │ │ (Ink <Text>)    │ │                  │ │ (XYFlow)        │ │          │
│   │ ├─────────────────┤ │                  │ │ ┌─────────────┐ │ │          │
│   │ │ Input Bar       │ │                  │ │ │ Terminal    │ │ │          │
│   │ │ (useInput)      │ │                  │ │ │ (xterm.js)  │ │ │          │
│   │ └─────────────────┘ │                  │ │ └─────────────┘ │ │          │
│   └─────────────────────┘                  │ └─────────────────┘ │          │
│            │                               └─────────────────────┘          │
│            │                                          │                     │
│            ▼                                          ▼                     │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      CHRYSALIS CORE                                 │   │
│   │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐        │   │
│   │  │ ACP Server│  │ Universal │  │ Memory    │  │ Agent     │        │   │
│   │  │ (ndjson)  │  │ Adapter   │  │ System    │  │ Orchestr. │        │   │
│   │  └───────────┘  └───────────┘  └───────────┘  └───────────┘        │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Decision Matrix

| Criterion | Ink | xterm.js | Winner |
|-----------|-----|----------|--------|
| **Native CLI** | ✅ Primary use | ❌ Not applicable | **Ink** |
| **Browser Terminal** | ❌ Not applicable | ✅ Primary use | **xterm.js** |
| **Chat UI** | ✅ Good (terminal-style) | ⚠️ Possible (but overkill) | **Ink/Custom** |
| **React Integration** | ✅ Native React | ✅ React wrapper available | **Tie** |
| **Streaming Text** | ✅ Built-in | ✅ Via write() | **Tie** |
| **Rich Formatting** | ⚠️ ANSI colors only | ⚠️ ANSI colors only | **Custom React** |
| **Shell Access** | ❌ No (just UI) | ✅ Via PTY | **xterm.js** |
| **Multi-agent Labels** | ✅ Easy with components | ⚠️ Manual escape codes | **Ink** |
| **Bundle Size** | 45KB | 250KB | **Ink** |
| **Industry Adoption** | Claude Code, Gemini CLI | VS Code, Codespaces | **Both excellent** |

---

## Recommendations for Chrysalis

### 1. Native TUI: Use Ink

```
chrysalis CLI → Ink v5 → Terminal (VS Code, iTerm, etc.)
```

- Build the multi-agent chat TUI with Ink
- Use the patterns from TUI_CHAT_INTERFACE_RECOMMENDATION.md
- Follow Claude Code/Gemini CLI architecture

### 2. Canvas Terminal Widget: Use xterm.js

```
Browser → Canvas → TerminalSession widget → xterm.js → WebSocket → node-pty → Shell
```

- As specified in canvas-architecture.md
- Sandboxed, rate-limited, origin-checked
- Virtualized (pause when offscreen)

### 3. Web Chat Pane: Use Custom React Components

```
Browser → Canvas/App → ChatPane → Custom React components → styled like terminal
```

- NOT a terminal emulator
- Rich markdown, code highlighting
- Agent avatars, timestamps, reactions
- Can LOOK like terminal with CSS

### 4. Web TUI Fallback: Ink → xterm.js bridge

For mobile/remote access, run Ink TUI and pipe to xterm.js:

```
Browser → xterm.js → WebSocket → node-pty → chrysalis CLI (Ink) → PTY output
```

This is the "xterm.js web embedding" from Phase 3 of the migration plan.

---

## Implementation Recommendations

### Phase 1: Ink TUI Foundation

```bash
npm install ink react
npm install ink-text-input ink-spinner ink-select-input # Common components
```

```tsx
// src/tui/index.tsx
import { render } from 'ink';
import { ChrysalisTUI } from './ChrysalisTUI';

render(<ChrysalisTUI />);
```

### Phase 2: xterm.js Canvas Integration

```bash
npm install xterm xterm-addon-fit xterm-addon-webgl xterm-addon-weblinks
```

```tsx
// src/canvas/widgets/registry.ts
export const TERMINAL_CANVAS_WIDGETS = {
  terminal_session: TerminalSessionWidget,
  // Only terminal widgets allowed in Terminal canvas
};
```

### Phase 3: Shared UI Components

Create shared types/logic that work in both environments:

```typescript
// src/shared/chat/types.ts
export interface AgentMessage {
  id: string;
  agentId: string;
  content: string;
  streaming: boolean;
  timestamp: Date;
}

// src/shared/chat/formatters.ts
export function formatAgentMessage(msg: AgentMessage, agent: Agent): string {
  // Returns formatted string (works in both Ink and xterm)
  return `${agent.emoji} ${agent.name}\n${msg.content}`;
}
```

---

---

## Ink Web: The Unified Option

### What Is Ink Web?

[Ink Web](https://www.ink-web.dev/) is a library that allows Ink applications to run **both in the terminal AND in the browser** with the same codebase.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INK WEB ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                    ┌─────────────────────────────┐                          │
│                    │   Your Ink Components       │                          │
│                    │   (<Box>, <Text>, etc.)     │                          │
│                    └─────────────┬───────────────┘                          │
│                                  │                                          │
│              ┌───────────────────┴───────────────────┐                      │
│              │           INK WEB RUNTIME             │                      │
│              └───────────────────┬───────────────────┘                      │
│                                  │                                          │
│         ┌────────────────────────┼────────────────────────┐                 │
│         │                        │                        │                 │
│         ▼                        ▼                        ▼                 │
│   ┌───────────┐           ┌───────────┐           ┌───────────┐            │
│   │  Terminal │           │  Browser  │           │  Browser  │            │
│   │  (Native) │           │  (Canvas) │           │  (DOM)    │            │
│   │           │           │           │           │           │            │
│   │  stdout   │           │ xterm.js  │           │  HTML     │            │
│   │  ANSI     │           │  canvas   │           │  render   │            │
│   └───────────┘           └───────────┘           └───────────┘            │
│                                                                             │
│   SAME CODE ────────────────► MULTIPLE TARGETS                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Why Ink Web Matters for Chrysalis

| Benefit | Description |
|---------|-------------|
| **Single Codebase** | Write once, run in terminal AND browser |
| **No xterm.js Bridge** | Eliminates the "run Ink, pipe to xterm" complexity |
| **Full Ink Compatibility** | Works with existing Ink components |
| **Instant Web Preview** | Same UX in both environments |
| **Simpler Architecture** | No need for PTY server just for chat UI |

### Ink Web vs. Other Approaches

| Approach | Complexity | Code Sharing | Web Experience |
|----------|------------|--------------|----------------|
| Ink (terminal only) | Low | None | Requires xterm.js bridge |
| xterm.js + PTY | Medium | None | Full terminal, but complex |
| Custom React (web) + Ink (terminal) | High | Business logic only | Different UI code |
| **Ink Web** | **Low** | **100%** | **Native Ink in browser** |

### Revised Architecture with Ink Web

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 CHRYSALIS UNIFIED TUI ARCHITECTURE (Ink Web)                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                     CHRYSALIS TUI COMPONENTS                        │   │
│   │                          (Ink + Ink Web)                            │   │
│   │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐             │   │
│   │  │ ConversationPa│ │ AgentSidebar  │ │ InputBar      │             │   │
│   │  │ ne            │ │               │ │               │             │   │
│   │  └───────────────┘ └───────────────┘ └───────────────┘             │   │
│   │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐             │   │
│   │  │ StatusBar     │ │ MemoryPanel   │ │ ToolDisplay   │             │   │
│   │  └───────────────┘ └───────────────┘ └───────────────┘             │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                   ┌────────────────┴────────────────┐                       │
│                   │           INK WEB               │                       │
│                   └────────────────┬────────────────┘                       │
│                                    │                                        │
│         ┌──────────────────────────┼──────────────────────────┐             │
│         │                          │                          │             │
│         ▼                          ▼                          ▼             │
│   ┌───────────────┐         ┌───────────────┐         ┌───────────────┐    │
│   │   TERMINAL    │         │  WEB CANVAS   │         │   MOBILE/     │    │
│   │   (Native)    │         │  (Browser)    │         │   REMOTE      │    │
│   │               │         │               │         │               │    │
│   │ VS Code term  │         │ Chat pane in  │         │ Progressive   │    │
│   │ iTerm, etc.   │         │ XYFlow canvas │         │ Web App       │    │
│   └───────────────┘         └───────────────┘         └───────────────┘    │
│                                                                             │
│   ─────────────────────────────────────────────────────────────────────     │
│                                                                             │
│   STILL NEED xterm.js FOR:                                                  │
│   - Canvas Terminal Widget (shell access, not chat)                         │
│   - Real PTY sessions (bash, zsh, etc.)                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### When to Use What

| Component | Library | Rationale |
|-----------|---------|-----------|
| **Chat TUI (terminal)** | Ink | Native terminal experience |
| **Chat TUI (browser)** | **Ink Web** | Same code as terminal |
| **Chat Pane in Canvas** | **Ink Web** | Unified component |
| **Terminal Session Widget** | xterm.js | Needs real shell (PTY) |
| **Shell Access** | xterm.js + node-pty | Ink doesn't provide shells |

### Example: Unified Chat Pane

```tsx
// src/tui/ChatPane.tsx
// This SAME component works in terminal AND browser via Ink Web
import { Box, Text, useInput } from 'ink';

export const ChatPane = ({ messages, agents, onSubmit }) => {
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      // Interrupt - works in both environments
    }
  });

  return (
    <Box flexDirection="column" flexGrow={1}>
      {messages.map((msg, i) => (
        <Box key={i} marginBottom={1}>
          <Text bold color={agents[msg.agentId].color}>
            {agents[msg.agentId].emoji} {agents[msg.agentId].name}
          </Text>
          <Box marginLeft={2}>
            <Text>{msg.content}</Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
};

// Terminal entry point
// src/cli/index.tsx
import { render } from 'ink';
import { ChrysalisTUI } from '../tui/ChrysalisTUI';
render(<ChrysalisTUI />);

// Browser entry point  
// src/web/ChatWidget.tsx
import { render } from 'ink-web';
import { ChatPane } from '../tui/ChatPane';

export const ChatWidget = (props) => {
  return render(<ChatPane {...props} />);
};
```

### Production Readiness Considerations

From the [Ink Web documentation](https://www.ink-web.dev/):

> **Is Ink Web production-ready?**
> 
> Ink Web is still in development. Consider it experimental.

**Recommendation:**
1. Start with **Ink for terminal** (production-ready, 34K stars)
2. Build components with Ink Web compatibility in mind
3. Add **Ink Web for browser** as it matures
4. Keep **xterm.js for Terminal Canvas widget** (shell access)

---

## Updated Conclusion

**Three-library approach recommended:**

| Environment | Component | Library |
|-------------|-----------|---------|
| Terminal | Chat TUI | **Ink** |
| Browser | Chat TUI/Pane | **Ink Web** (or custom React while experimental) |
| Browser | Terminal Session | **xterm.js** (for shell access) |

**Ink Web is the most promising path to "write once, run everywhere" for the chat interface.** Monitor its maturity and plan to migrate web chat panes to Ink Web when ready.

---

## References

- [Ink GitHub](https://github.com/vadimdemedes/ink) - 34K stars, used by Claude Code, Gemini CLI
- [Ink Web](https://www.ink-web.dev/) - Run Ink in browser, by Chris Roth
- [xterm.js GitHub](https://github.com/xtermjs/xterm.js) - 18K stars, used by VS Code, Codespaces
- [node-pty](https://github.com/microsoft/node-pty) - PTY for Node.js
- [TUI_CHAT_INTERFACE_RECOMMENDATION.md](./TUI_CHAT_INTERFACE_RECOMMENDATION.md)
- [canvas-architecture.md](../canvas-architecture.md)

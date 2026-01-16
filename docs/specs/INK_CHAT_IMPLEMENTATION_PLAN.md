# Ink Chat TUI Implementation Plan

**Date:** January 16, 2026
**Version:** 1.0
**Status:** Implementation Specification
**Decision Reference:** TERMINAL_LIBRARY_SCORING_ANALYSIS.md (APPROVED)

---

## Overview

This document provides a comprehensive implementation plan for wiring up Ink-based chat panes for the Chrysalis multi-agent TUI. It covers architecture, component design, decisions required, and implementation phases.

**Approved Stack:**
- **Chat TUI:** Ink v5 (React for CLI)
- **Terminal Widgets:** xterm.js (browser canvas)
- **Shared Logic:** TypeScript modules

---

## Table of Contents

1. [Architecture](#architecture)
2. [Decisions Required](#decisions-required)
3. [Component Hierarchy](#component-hierarchy)
4. [Data Flow](#data-flow)
5. [Implementation Phases](#implementation-phases)
6. [File Structure](#file-structure)
7. [Dependencies](#dependencies)
8. [Integration Points](#integration-points)
9. [Testing Strategy](#testing-strategy)

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CHRYSALIS TUI                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         INK APPLICATION                              │   │
│  │  ┌─────────────────────────────────────────┬───────────────────┐   │   │
│  │  │           MAIN PANE (70%)               │   SIDEBAR (30%)   │   │   │
│  │  │  ┌────────────────────────────────────┐ │ ┌───────────────┐ │   │   │
│  │  │  │    ConversationStream              │ │ │ AgentList     │ │   │   │
│  │  │  │    ├─ AgentMessage                 │ │ │ ├─ Agent      │ │   │   │
│  │  │  │    │   ├─ SpeakerLabel             │ │ │ │   status    │ │   │   │
│  │  │  │    │   ├─ MessageContent           │ │ │ └─ ...        │ │   │   │
│  │  │  │    │   └─ ToolExecution            │ │ ├───────────────┤ │   │   │
│  │  │  │    └─ StreamingIndicator           │ │ │ MemoryStatus  │ │   │   │
│  │  │  └────────────────────────────────────┘ │ │ ├─ episodic   │ │   │   │
│  │  ├─────────────────────────────────────────┤ │ ├─ semantic   │ │   │   │
│  │  │              STATUS BAR                 │ │ └─ skills     │ │   │   │
│  │  │  tokens: 4,231 | cost: $0.04 | sync: ✓  │ ├───────────────┤ │   │   │
│  │  ├─────────────────────────────────────────┤ │ SyncStatus    │ │   │   │
│  │  │              INPUT BAR                  │ │ └─ instances  │ │   │   │
│  │  │  > /skill "learn pattern"              │ └───────────────┘ │   │   │
│  │  └─────────────────────────────────────────┴───────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                           SHARED LAYER                                       │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                │
│  │ MessageStore   │  │ AgentStore     │  │ MemoryStore    │                │
│  │ (Zustand)      │  │ (Zustand)      │  │ (Zustand)      │                │
│  └───────┬────────┘  └───────┬────────┘  └───────┬────────┘                │
│          │                   │                   │                          │
│  ┌───────┴───────────────────┴───────────────────┴───────┐                 │
│  │                     ACP CLIENT                         │                 │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │                 │
│  │  │ ndjson      │  │ stdio       │  │ streaming   │   │                 │
│  │  │ parser      │  │ transport   │  │ handler     │   │                 │
│  │  └─────────────┘  └─────────────┘  └─────────────┘   │                 │
│  └────────────────────────────────────────────────────────┘                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibility Matrix

| Component | Responsibility | Library | State |
|-----------|---------------|---------|-------|
| `ChrysalisApp` | Root layout, keyboard handling | Ink | Global |
| `ConversationPane` | Message list, scrolling | Ink | MessageStore |
| `AgentMessage` | Single message rendering | Ink | Props |
| `SpeakerLabel` | Agent identification | Ink | Props |
| `StreamingText` | Character-by-character display | Ink | Local |
| `ToolExecution` | Tool call/result display | Ink | Props |
| `Sidebar` | Agent/Memory/Sync status | Ink | Multiple stores |
| `StatusBar` | Tokens, cost, sync indicator | Ink | Multiple stores |
| `InputBar` | User input, magic commands | Ink | Local |
| `ACPClient` | Protocol communication | Custom | Internal |

---

## Decisions Required

### Decision 1: State Management Approach

**Options:**

| Option | Pros | Cons | Complexity |
|--------|------|------|------------|
| **A: Zustand** | Simple, React-friendly, small | Less structure | Low |
| **B: Redux Toolkit** | Structured, devtools | Heavier, boilerplate | Medium |
| **C: React Context** | No deps, built-in | Re-render issues, scaling | Low |
| **D: Jotai** | Atomic, minimal | Less proven in CLI | Low |

**Recommendation:** **Zustand** - Simple, proven with Ink, minimal boilerplate.

```typescript
// Example Zustand store for messages
interface MessageStore {
  messages: AgentMessage[];
  addMessage: (msg: AgentMessage) => void;
  updateStreaming: (id: string, content: string) => void;
  clearMessages: () => void;
}
```

**Decision needed:** Confirm Zustand or select alternative.

---

### Decision 2: ACP Protocol Integration

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A: Native ACP Client** | Use existing `src/adapters/acp/client.ts` | Already built | May need adaptation |
| **B: New Ink-specific Client** | Build new client optimized for Ink | Tailored | Duplication |
| **C: Abstraction Layer** | Wrap ACP client with Ink-friendly API | Best of both | Extra layer |

**Recommendation:** **Option C** - Create a thin wrapper around existing ACP client.

```typescript
// src/tui/services/ACPBridge.ts
export class ACPBridge {
  constructor(private acpClient: ACPClient) {}

  async sendMessage(content: string): AsyncGenerator<StreamChunk>;
  onAgentResponse(handler: (msg: AgentMessage) => void): void;
  onToolExecution(handler: (tool: ToolExecution) => void): void;
}
```

**Decision needed:** Confirm approach and review existing ACP client capabilities.

---

### Decision 3: Multi-Agent Message Attribution

**Options:**

| Option | Visual | Description |
|--------|--------|-------------|
| **A: Color-coded prefixes** | `[🏗️ Architect]` in yellow | Simple, clear |
| **B: Box borders per agent** | Each agent in bordered box | Visual separation |
| **C: Indented handoffs** | Nested indentation on handoff | Shows hierarchy |
| **D: Hybrid (A + C)** | Colors + indentation on handoff | Best clarity |

**Recommendation:** **Option D** - Color-coded prefixes with indented handoffs.

```
🏗️ Architect Agent (claude-3.5-sonnet)
────────────────────────────────────────
I'll analyze the codebase structure and propose a refactoring plan.

    └──▶ 💻 Coder Agent (gpt-4o)
         ────────────────────────────────────────
         Received context. Starting implementation of the plan.
```

**Decision needed:** Confirm visual pattern.

---

### Decision 4: Streaming Token Display

**Options:**

| Option | Behavior | Latency | Complexity |
|--------|----------|---------|------------|
| **A: Character-by-character** | Each token as received | Lowest | High |
| **B: Word buffering** | Buffer until word boundary | Low | Medium |
| **C: Line buffering** | Buffer until newline | Medium | Low |
| **D: Adaptive** | Start char-by-char, switch to word | Optimal | High |

**Recommendation:** **Option D** - Adaptive streaming.

```typescript
// Start character-by-character, switch to word buffering after 50 chars
const CHAR_THRESHOLD = 50;

function streamingStrategy(charCount: number): 'char' | 'word' {
  return charCount < CHAR_THRESHOLD ? 'char' : 'word';
}
```

**Decision needed:** Confirm streaming strategy.

---

### Decision 5: Magic Command Parser

**Options:**

| Option | Syntax | Examples |
|--------|--------|----------|
| **A: Slash commands** | `/command arg` | `/skill "pattern"`, `/remember "fact"` |
| **B: Percent commands** | `%command arg` | `%undo`, `%reset` (Open Interpreter style) |
| **C: At commands** | `@command arg` | `@agents`, `@sync` |
| **D: Slash with subcommands** | `/cmd:subcmd arg` | `/memory:add "fact"` |

**Recommendation:** **Option A** - Slash commands (matches Letta Code, Discord).

**Commands to implement:**

| Command | Description | Arguments |
|---------|-------------|-----------|
| `/skill <text>` | Learn skill from trajectory | String |
| `/remember <text>` | Add to semantic memory | String |
| `/forget <id>` | Remove memory | Memory ID |
| `/undo` | Remove last exchange | None |
| `/reset` | Clear conversation, keep memory | None |
| `/agents` | List active agents | None |
| `/agent <name>` | Focus on specific agent | Agent name |
| `/sync` | Force Byzantine sync | None |
| `/tokens` | Show token usage | None |
| `/export [format]` | Export conversation | md, json |
| `/help` | Show commands | None |
| `/quit` | Exit TUI | None |

**Decision needed:** Confirm command set and syntax.

---

### Decision 6: Keyboard Shortcuts

**Proposed shortcuts:**

| Key | Action | Context |
|-----|--------|---------|
| `Ctrl+C` | Interrupt current agent / Exit | Global |
| `Ctrl+L` | Clear screen | Global |
| `Ctrl+U` | Clear input line | Input |
| `Up/Down` | Input history | Input |
| `Tab` | Autocomplete command | Input |
| `Esc` | Cancel current operation | Global |
| `Ctrl+S` | Toggle sidebar | Global |
| `Ctrl+A` | Cycle through agents | Global |
| `Page Up/Down` | Scroll conversation | Conversation |

**Decision needed:** Confirm shortcuts and any additions.

---

### Decision 7: Error Display Strategy

**Options:**

| Option | Behavior | User Impact |
|--------|----------|-------------|
| **A: Inline errors** | Show error in conversation stream | Visible, clutters |
| **B: Status bar errors** | Show in status bar with timeout | Subtle |
| **C: Modal errors** | Full-screen error for critical | Disruptive |
| **D: Tiered (B for minor, C for critical)** | Context-appropriate | Balanced |

**Recommendation:** **Option D** - Tiered error display.

**Decision needed:** Confirm approach.

---

### Decision 8: Session Persistence

**Options:**

| Option | Behavior | Storage |
|--------|----------|---------|
| **A: No persistence** | Fresh start each time | None |
| **B: Auto-save on exit** | Save conversation on quit | File |
| **C: Continuous auto-save** | Save after each message | File |
| **D: Optional manual save** | User triggers save | File |

**Recommendation:** **Option C** - Continuous auto-save with configurable location.

```typescript
// ~/.chrysalis/sessions/session_<timestamp>.json
interface SessionFile {
  version: string;
  startedAt: string;
  lastUpdated: string;
  messages: AgentMessage[];
  agentStates: Record<string, AgentState>;
  memorySnapshot: MemorySnapshot;
}
```

**Decision needed:** Confirm persistence strategy and storage location.

---

## Component Hierarchy

### Component Tree

```
ChrysalisApp
├── AppProvider (context/stores)
│   ├── MessageStore
│   ├── AgentStore
│   ├── MemoryStore
│   └── ConfigStore
├── Layout
│   ├── MainPane
│   │   ├── Header
│   │   │   └── Title, Version, SyncIndicator
│   │   ├── ConversationPane
│   │   │   ├── MessageList
│   │   │   │   └── AgentMessage[]
│   │   │   │       ├── SpeakerLabel
│   │   │   │       ├── MessageContent
│   │   │   │       │   ├── TextBlock
│   │   │   │       │   ├── CodeBlock
│   │   │   │       │   └── StreamingCursor
│   │   │   │       └── ToolExecution?
│   │   │   │           ├── ToolHeader
│   │   │   │           ├── ToolProgress
│   │   │   │           └── ToolResult
│   │   │   └── StreamingIndicator?
│   │   └── StatusBar
│   │       ├── TokenCount
│   │       ├── CostDisplay
│   │       └── HelpHint
│   ├── Sidebar
│   │   ├── AgentList
│   │   │   └── AgentItem[]
│   │   │       ├── StatusIcon
│   │   │       ├── AgentName
│   │   │       └── AgentModel
│   │   ├── MemoryStatus
│   │   │   ├── EpisodicCount
│   │   │   ├── SemanticCount
│   │   │   └── SkillCount
│   │   └── SyncStatus
│   │       └── InstanceItem[]
│   └── InputBar
│       ├── Prompt
│       ├── Input
│       └── Autocomplete?
└── ModalLayer
    ├── ErrorModal?
    ├── HelpModal?
    └── ConfirmModal?
```

---

## Data Flow

### Message Flow Diagram

```
User Input
    │
    ▼
┌────────────┐     ┌─────────────┐     ┌─────────────┐
│  InputBar  │────▶│ CommandParser│────▶│   Router    │
└────────────┘     └─────────────┘     └──────┬──────┘
                                              │
                   ┌──────────────────────────┼──────────────────────────┐
                   │                          │                          │
                   ▼                          ▼                          ▼
           ┌─────────────┐          ┌─────────────┐          ┌─────────────┐
           │ MagicCommand│          │ ACPBridge   │          │ LocalAction │
           │   Handler   │          │  (to agent) │          │   Handler   │
           └──────┬──────┘          └──────┬──────┘          └──────┬──────┘
                  │                        │                        │
                  │                        ▼                        │
                  │                 ┌─────────────┐                 │
                  │                 │  ACP Server │                 │
                  │                 │  (backend)  │                 │
                  │                 └──────┬──────┘                 │
                  │                        │                        │
                  │                        ▼                        │
                  │                 ┌─────────────┐                 │
                  │                 │ Agent System│                 │
                  │                 │ Orchestrator│                 │
                  │                 └──────┬──────┘                 │
                  │                        │                        │
                  │                        ▼                        │
                  │                 ┌─────────────┐                 │
                  │          ┌─────│  Streaming   │─────┐           │
                  │          │     │   Response   │     │           │
                  │          │     └─────────────┘     │           │
                  │          ▼                         ▼           │
                  │   ┌─────────────┐          ┌─────────────┐     │
                  │   │ Token Chunk │          │ Tool Call   │     │
                  │   └──────┬──────┘          └──────┬──────┘     │
                  │          │                        │            │
                  ▼          ▼                        ▼            ▼
           ┌────────────────────────────────────────────────────────┐
           │                    MessageStore                        │
           └────────────────────────────────────────────────────────┘
                                       │
                                       ▼
           ┌────────────────────────────────────────────────────────┐
           │                  ConversationPane                      │
           │                   (re-renders)                         │
           └────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)

**Goal:** Basic Ink app with conversation display

**Deliverables:**

| Task | File | Description |
|------|------|-------------|
| 1.1 | `src/tui/index.tsx` | Entry point, render Ink app |
| 1.2 | `src/tui/App.tsx` | Root component with layout |
| 1.3 | `src/tui/stores/messageStore.ts` | Zustand store for messages |
| 1.4 | `src/tui/components/ConversationPane.tsx` | Scrollable message list |
| 1.5 | `src/tui/components/AgentMessage.tsx` | Single message component |
| 1.6 | `src/tui/components/InputBar.tsx` | Basic text input |
| 1.7 | `package.json` | Add Ink dependencies |

**Decisions to finalize before Phase 1:**
- [ ] State management (Zustand recommended)
- [ ] Project structure (proposed below)

---

### Phase 2: Multi-Agent Display (Week 2)

**Goal:** Agent identification and streaming display

**Deliverables:**

| Task | File | Description |
|------|------|-------------|
| 2.1 | `src/tui/components/SpeakerLabel.tsx` | Colored agent labels |
| 2.2 | `src/tui/components/StreamingText.tsx` | Character streaming |
| 2.3 | `src/tui/components/ToolExecution.tsx` | Tool call/result display |
| 2.4 | `src/tui/stores/agentStore.ts` | Agent state management |
| 2.5 | `src/tui/hooks/useStreaming.ts` | Streaming state hook |
| 2.6 | `src/tui/utils/agentColors.ts` | Agent color assignments |

**Decisions to finalize before Phase 2:**
- [ ] Multi-agent message attribution (Option D recommended)
- [ ] Streaming token display (Adaptive recommended)

---

### Phase 3: Sidebar & Status (Week 3)

**Goal:** Complete UI with sidebar and status bar

**Deliverables:**

| Task | File | Description |
|------|------|-------------|
| 3.1 | `src/tui/components/Sidebar.tsx` | Sidebar container |
| 3.2 | `src/tui/components/AgentList.tsx` | Active agents display |
| 3.3 | `src/tui/components/MemoryStatus.tsx` | Memory counts |
| 3.4 | `src/tui/components/SyncStatus.tsx` | Instance sync status |
| 3.5 | `src/tui/components/StatusBar.tsx` | Tokens/cost/sync |
| 3.6 | `src/tui/stores/memoryStore.ts` | Memory state |
| 3.7 | `src/tui/stores/syncStore.ts` | Sync state |

---

### Phase 4: Commands & Input (Week 4)

**Goal:** Magic commands and input handling

**Deliverables:**

| Task | File | Description |
|------|------|-------------|
| 4.1 | `src/tui/commands/parser.ts` | Command parser |
| 4.2 | `src/tui/commands/handlers.ts` | Command implementations |
| 4.3 | `src/tui/components/Autocomplete.tsx` | Command autocomplete |
| 4.4 | `src/tui/hooks/useInputHistory.ts` | Input history |
| 4.5 | `src/tui/hooks/useKeyboard.ts` | Keyboard shortcuts |
| 4.6 | Update `InputBar.tsx` | Integrate commands |

**Decisions to finalize before Phase 4:**
- [ ] Magic command set (slash commands recommended)
- [ ] Keyboard shortcuts (proposed set)

---

### Phase 5: ACP Integration (Week 5)

**Goal:** Connect to backend via ACP protocol

**Deliverables:**

| Task | File | Description |
|------|------|-------------|
| 5.1 | `src/tui/services/ACPBridge.ts` | ACP client wrapper |
| 5.2 | `src/tui/services/StreamHandler.ts` | Stream processing |
| 5.3 | `src/tui/hooks/useACP.ts` | ACP connection hook |
| 5.4 | Integration testing | End-to-end message flow |

**Decisions to finalize before Phase 5:**
- [ ] ACP integration approach (Option C recommended)

---

### Phase 6: Polish & Persistence (Week 6)

**Goal:** Error handling, persistence, final polish

**Deliverables:**

| Task | File | Description |
|------|------|-------------|
| 6.1 | `src/tui/components/ErrorBoundary.tsx` | Error handling |
| 6.2 | `src/tui/components/Modal.tsx` | Modal system |
| 6.3 | `src/tui/services/SessionManager.ts` | Session persistence |
| 6.4 | `src/tui/services/ConfigManager.ts` | TUI configuration |
| 6.5 | Documentation | Usage docs |
| 6.6 | CLI integration | Add `chrysalis chat` command |

**Decisions to finalize before Phase 6:**
- [ ] Error display strategy (tiered recommended)
- [ ] Session persistence (continuous auto-save recommended)

---

## File Structure

### Proposed Directory Structure

```
src/
├── tui/                              # Ink TUI application
│   ├── index.tsx                     # Entry point
│   ├── App.tsx                       # Root component
│   │
│   ├── components/                   # Ink components
│   │   ├── layout/
│   │   │   ├── Layout.tsx
│   │   │   ├── MainPane.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── conversation/
│   │   │   ├── ConversationPane.tsx
│   │   │   ├── AgentMessage.tsx
│   │   │   ├── SpeakerLabel.tsx
│   │   │   ├── StreamingText.tsx
│   │   │   ├── CodeBlock.tsx
│   │   │   └── ToolExecution.tsx
│   │   ├── sidebar/
│   │   │   ├── AgentList.tsx
│   │   │   ├── MemoryStatus.tsx
│   │   │   └── SyncStatus.tsx
│   │   ├── input/
│   │   │   ├── InputBar.tsx
│   │   │   └── Autocomplete.tsx
│   │   ├── common/
│   │   │   ├── StatusBar.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── Spinner.tsx
│   │   │   └── Badge.tsx
│   │   └── modals/
│   │       ├── Modal.tsx
│   │       ├── ErrorModal.tsx
│   │       └── HelpModal.tsx
│   │
│   ├── stores/                       # Zustand stores
│   │   ├── index.ts
│   │   ├── messageStore.ts
│   │   ├── agentStore.ts
│   │   ├── memoryStore.ts
│   │   ├── syncStore.ts
│   │   └── configStore.ts
│   │
│   ├── hooks/                        # Custom hooks
│   │   ├── useStreaming.ts
│   │   ├── useKeyboard.ts
│   │   ├── useInputHistory.ts
│   │   ├── useACP.ts
│   │   └── useScrollable.ts
│   │
│   ├── commands/                     # Magic commands
│   │   ├── parser.ts
│   │   ├── handlers.ts
│   │   ├── registry.ts
│   │   └── types.ts
│   │
│   ├── services/                     # External services
│   │   ├── ACPBridge.ts
│   │   ├── StreamHandler.ts
│   │   ├── SessionManager.ts
│   │   └── ConfigManager.ts
│   │
│   ├── utils/                        # Utilities
│   │   ├── agentColors.ts
│   │   ├── formatters.ts
│   │   ├── markdown.ts
│   │   └── constants.ts
│   │
│   └── types/                        # TypeScript types
│       ├── messages.ts
│       ├── agents.ts
│       ├── commands.ts
│       └── config.ts
│
├── shared/                           # Shared between TUI and web
│   ├── types/
│   │   ├── AgentMessage.ts           # Message types
│   │   ├── Agent.ts                  # Agent types
│   │   └── Memory.ts                 # Memory types
│   ├── formatters/
│   │   ├── messageFormatter.ts       # Format messages
│   │   └── costFormatter.ts          # Format costs
│   └── constants/
│       └── agentEmojis.ts            # Agent emoji mappings
│
└── cli/
    └── chrysalis-cli.ts              # Add 'chat' command
```

---

## Dependencies

### New Dependencies to Add

```json
{
  "dependencies": {
    "ink": "^5.0.1",
    "ink-text-input": "^6.0.0",
    "ink-spinner": "^5.0.0",
    "ink-select-input": "^6.0.0",
    "ink-big-text": "^2.0.0",
    "zustand": "^4.5.0",
    "chalk": "^5.3.0",
    "ora": "^8.0.1",
    "cli-truncate": "^4.0.0",
    "figures": "^6.0.1",
    "wrap-ansi": "^9.0.0"
  },
  "devDependencies": {
    "@types/ink": "^2.0.3",
    "ink-testing-library": "^4.0.0"
  }
}
```

### Dependency Justification

| Package | Purpose | Size |
|---------|---------|------|
| `ink` | Core React-for-CLI renderer | 45KB |
| `ink-text-input` | Text input component | 8KB |
| `ink-spinner` | Loading spinners | 3KB |
| `ink-select-input` | Selection menus | 5KB |
| `zustand` | State management | 3KB |
| `chalk` | Terminal colors | 12KB |
| `ora` | Async spinners | 8KB |
| `figures` | Unicode symbols | 2KB |
| `wrap-ansi` | Text wrapping | 4KB |

**Total added bundle:** ~90KB

---

## Integration Points

### 1. CLI Integration

Add `chat` command to `chrysalis-cli.ts`:

```typescript
program
  .command('chat')
  .description('Start interactive multi-agent chat TUI')
  .option('--agent <name>', 'Start with specific agent')
  .option('--session <id>', 'Resume session')
  .option('--no-sidebar', 'Hide sidebar')
  .action(async (options) => {
    const { startTUI } = await import('../tui');
    await startTUI(options);
  });
```

### 2. ACP Server Integration

Connect to existing ACP server at `src/adapters/acp/server.ts`:

```typescript
// src/tui/services/ACPBridge.ts
import { ACPClient } from '../../adapters/acp/client';

export class ACPBridge {
  private client: ACPClient;

  constructor() {
    this.client = new ACPClient({
      transport: 'stdio',
      onMessage: this.handleMessage.bind(this)
    });
  }

  async sendMessage(content: string): Promise<void> {
    await this.client.send({
      type: 'user_message',
      content,
      timestamp: Date.now()
    });
  }

  private handleMessage(msg: ACPMessage): void {
    // Route to appropriate store
  }
}
```

### 3. Memory System Integration

Connect to memory backend at `memory_system/`:

```typescript
// src/tui/hooks/useMemory.ts
import { useMemoryStore } from '../stores/memoryStore';

export function useMemory() {
  const store = useMemoryStore();

  useEffect(() => {
    // Poll memory counts
    const interval = setInterval(async () => {
      const counts = await fetchMemoryCounts();
      store.updateCounts(counts);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return store;
}
```

### 4. Agent System Integration

Connect to agent orchestrator at `src/agents/system/`:

```typescript
// src/tui/hooks/useAgents.ts
import { useAgentStore } from '../stores/agentStore';
import { AgentOrchestrator } from '../../agents/system/AgentOrchestrator';

export function useAgents() {
  const store = useAgentStore();

  useEffect(() => {
    AgentOrchestrator.onAgentChange((agents) => {
      store.setAgents(agents);
    });
  }, []);

  return store;
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// src/tui/__tests__/components/AgentMessage.test.tsx
import { render } from 'ink-testing-library';
import { AgentMessage } from '../components/conversation/AgentMessage';

describe('AgentMessage', () => {
  it('renders speaker label with correct color', () => {
    const { lastFrame } = render(
      <AgentMessage
        agent={{ id: '1', name: 'Architect', emoji: '🏗️', color: 'yellow' }}
        content="Hello world"
      />
    );

    expect(lastFrame()).toContain('🏗️ Architect');
  });

  it('handles streaming content', () => {
    const { lastFrame, rerender } = render(
      <AgentMessage agent={mockAgent} content="Hel" streaming />
    );

    rerender(
      <AgentMessage agent={mockAgent} content="Hello" streaming />
    );

    expect(lastFrame()).toContain('Hello');
    expect(lastFrame()).toContain('▌'); // cursor
  });
});
```

### Integration Tests

```typescript
// src/tui/__tests__/integration/chat-flow.test.tsx
import { render } from 'ink-testing-library';
import { ChrysalisApp } from '../App';

describe('Chat Flow', () => {
  it('sends message and receives response', async () => {
    const { stdin, lastFrame } = render(<ChrysalisApp />);

    stdin.write('/help\n');

    await waitFor(() => {
      expect(lastFrame()).toContain('Available commands');
    });
  });
});
```

---

## Decision Checklist

Before starting implementation, finalize these decisions:

- [ ] **D1:** State management - Zustand vs alternatives
- [ ] **D2:** ACP integration approach - wrapper vs new client
- [ ] **D3:** Multi-agent message attribution - visual pattern
- [ ] **D4:** Streaming token display - char vs word vs adaptive
- [ ] **D5:** Magic command syntax - slash vs percent vs at
- [ ] **D6:** Keyboard shortcuts - confirm proposed set
- [ ] **D7:** Error display strategy - tiered vs modal
- [ ] **D8:** Session persistence - auto-save vs manual

---

## Next Steps

1. **Review this plan** and finalize decisions
2. **Add Ink dependencies** to package.json
3. **Create directory structure** as proposed
4. **Begin Phase 1** implementation
5. **Set up CI** for TUI tests

---

**Document Owner:** Chrysalis Architecture Team
**Implementation Status:** Ready to begin Phase 1
**Related Docs:**
- `docs/specs/TERMINAL_LIBRARY_SCORING_ANALYSIS.md`
- `docs/specs/TUI_CHAT_INTERFACE_RECOMMENDATION.md`
- `src/adapters/acp/README.md`

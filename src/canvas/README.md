# Canvas System

Multi-canvas workspace for Chrysalis Terminal enabling human-in-the-loop interaction with AI agents through specialized visual interfaces.

## Core Purpose

The Canvas system creates **interaction surfaces** where humans directly engage with autonomous agent processes. Each canvas type provides different modalities of human↔agent collaboration:

- **Settings Canvas:** Configure system resources and agent access
- **Agent Canvas:** Control agent execution (start/stop), communicate (chat), modify behavior (edit persona), monitor state (memory stack)
- **Scrapbook Canvas:** Collaborative knowledge gathering between human and agents
- **Research Canvas:** Structured investigation with human-guided frameworks
- **Wiki Canvas:** Shared knowledge base accessible to both humans and agents
- **Terminal-Browser Canvas:** Collaborative development workspace (study group model)

## Architecture

```
Canvas System
├── Core Types (types.ts)
├── BaseCanvas Component (BaseCanvas.tsx)
├── Widget Registry (WidgetRegistry.ts)
├── Data Source Layer (DataSource.ts)
├── Canvas Implementations
│   ├── SettingsCanvas - System configuration
│   ├── AgentCanvas - AI agent orchestration
│   ├── ScrapbookCanvas - Exploratory knowledge gathering
│   ├── ResearchCanvas - Structured knowledge acquisition
│   ├── WikiCanvas - Persistent knowledge base
│   └── TerminalBrowserCanvas - Collaborative development workspace
└── Infrastructure
    ├── File System Abstraction
    ├── Graph Database Integration
    ├── Versioned Persistence
    └── Real-Time Synchronization
```

## Current Implementation Status

### Foundation (Complete)
- ✅ [`types.ts`](types.ts) (543 lines) - Core type system with 6 canvas kinds, widget system, collaboration types
- ✅ [`WidgetRegistry.ts`](WidgetRegistry.ts) (322 lines) - Widget lifecycle, validation, capability enforcement
- ✅ [`BaseCanvas.tsx`](BaseCanvas.tsx) (470 lines) - ReactFlow integration with policy enforcement
- ✅ [`DataSource.ts`](DataSource.ts) (474 lines) - Memory, LocalStorage, IndexedDB persistence
- ✅ [`demo.tsx`](demo.tsx) (109 lines) - Working example with TextWidget

### Infrastructure (Complete)
- ✅ [`interactions/InteractionManager.ts`](interactions/InteractionManager.ts) (115 lines) - Drag/select coordination
- ✅ [`interactions/KeyboardShortcuts.ts`](interactions/KeyboardShortcuts.ts) (156 lines) - Keyboard navigation
- ✅ [`events/EventBus.ts`](events/EventBus.ts) - Centralized event routing
- ✅ [`events/CanvasHistory.ts`](events/CanvasHistory.ts) - Undo/redo stack
- ✅ [`policy/PolicyEngine.ts`](policy/PolicyEngine.ts) - Enhanced validation rules

### Canvas Implementations (Complete)
- ✅ [`canvases/SettingsCanvas.tsx`](canvases/SettingsCanvas.tsx) - System configuration interface
- ✅ [`canvases/AgentCanvas.tsx`](canvases/AgentCanvas.tsx) - Agent orchestration interface
- ✅ [`canvases/ScrapbookCanvas.tsx`](canvases/ScrapbookCanvas.tsx) - Exploratory gathering interface
- ✅ [`canvases/ResearchCanvas.tsx`](canvases/ResearchCanvas.tsx) - Structured research interface
- ✅ [`canvases/WikiCanvas.tsx`](canvases/WikiCanvas.tsx) - Knowledge base interface
- ✅ [`canvases/TerminalBrowserCanvas.tsx`](canvases/TerminalBrowserCanvas.tsx) - Collaborative dev interface

### Widgets (17 total)
**Settings Canvas (2 widgets):**
- ✅ [`widgets/ConfigWidget.tsx`](widgets/ConfigWidget.tsx) - Key/value configuration editor
- ✅ [`widgets/ConnectionWidget.tsx`](widgets/ConnectionWidget.tsx) - Service connection monitor

**Scrapbook Canvas (3 widgets):**
- ✅ [`widgets/NoteWidget.tsx`](widgets/NoteWidget.tsx) - Text notes with tags
- ✅ [`widgets/LinkWidget.tsx`](widgets/LinkWidget.tsx) - URL bookmarks
- ✅ [`widgets/ArtifactWidget.tsx`](widgets/ArtifactWidget.tsx) - Code/text/image artifacts

**Research Canvas (4 widgets):**
- ✅ [`widgets/SourceWidget.tsx`](widgets/SourceWidget.tsx) - Research source citations
- ✅ [`widgets/CitationWidget.tsx`](widgets/CitationWidget.tsx) - Academic citations with DOI
- ✅ [`widgets/SynthesisWidget.tsx`](widgets/SynthesisWidget.tsx) - Research synthesis with confidence levels
- ✅ [`widgets/HypothesisWidget.tsx`](widgets/HypothesisWidget.tsx) - Hypothesis tracking

**Wiki Canvas (3 widgets):**
- ✅ [`widgets/WikiPageWidget.tsx`](widgets/WikiPageWidget.tsx) - Wiki page display
- ✅ [`widgets/WikiSectionWidget.tsx`](widgets/WikiSectionWidget.tsx) - Hierarchical sections
- ✅ [`widgets/WikiLinkWidget.tsx`](widgets/WikiLinkWidget.tsx) - Internal/external links

**Agent Canvas (2 widgets):**
- ✅ [`widgets/AgentCardWidget.tsx`](widgets/AgentCardWidget.tsx) - Agent state display
- ✅ [`widgets/TeamGroupWidget.tsx`](widgets/TeamGroupWidget.tsx) - Team organization

**Terminal-Browser Canvas (3 widgets):**
- ✅ [`widgets/TerminalSessionWidget.tsx`](widgets/TerminalSessionWidget.tsx) - Interactive terminal
- ✅ [`widgets/BrowserTabWidget.tsx`](widgets/BrowserTabWidget.tsx) - Browser tab display
- ✅ [`widgets/CodeEditorWidget.tsx`](widgets/CodeEditorWidget.tsx) - Code editor

### Known Limitations

**Not Yet Implemented:**
- Real-time collaboration sync (CRDT/OT)
- Session token system for canvas sharing
- Hypercard pattern for Agent Canvas (on/off toggle, expandable chat, persona editor)
- MediaWiki backend integration for Wiki Canvas
- xterm.js integration for terminal widgets
- Drag-drop from external sources
- Graph database integration
- Cross-canvas entity resolution

**Testing Status:**
- Unit tests exist for core foundation (DataSource, WidgetRegistry)
- Widget functionality not fully tested
- Canvas integration not tested end-to-end
- Persistence not verified working

**Design System Integration:**
- Widgets use hardcoded colors
- Need migration to design tokens ([`src/components/shared/tokens.ts`](../components/shared/tokens.ts))
- Per [`plans/WIDGET_REDESIGN_PLAN.md`](../../plans/WIDGET_REDESIGN_PLAN.md): 16 of 17 widgets need token-based redesign

## Architecture Pattern: Human-in-the-Loop Interface

Each canvas provides an **interaction surface** enabling humans to observe, control, and collaborate with autonomous agent processes.

## Quick Start

```typescript
import { BaseCanvas } from './canvas';
import { createWidgetRegistry } from './canvas/WidgetRegistry';

// Create widget registry
const registry = createWidgetRegistry('terminal-browser', ['terminal_session', 'browser_tab']);

// Configure canvas
const policy = {
  maxNodes: 100,
  maxEdges: 200,
  rateLimit: { actions: 10, windowMs: 1000 },
  allowedWidgetTypes: ['terminal_session', 'browser_tab'],
};

// Render canvas
<BaseCanvas
  canvasKind="terminal-browser"
  registry={registry}
  policy={policy}
  onEvent={(event) => console.log('Canvas event:', event)}
/>
```

## Implementation Decisions

**ADR-001:** ReactFlow with standard `useState` (not ReactFlow hooks)
- Use standard React `useState<Node[]>` and `useState<Edge[]>`
- Apply changes with `applyNodeChanges()`/`applyEdgeChanges()`
- Rationale: Better type safety, avoid TypeScript conflicts

**ADR-002:** Type aliases for canvas types
- `CanvasNode<TData> = Node<TData>` (ReactFlow Node with our data)
- `CanvasEdge = Edge<{label?, metadata?}>`
- Rationale: Cleaner APIs while maintaining ReactFlow compatibility

**ADR-003:** Multiple DataSource implementations  
- Memory (testing), LocalStorage (persistence), IndexedDB (large canvases)
- All implement `CanvasDataSource<TNode, TEdge>` interface
- Rationale: Different canvases have different scale/persistence needs

## Next Steps

**Immediate:** Resolve build configuration to enable compilation  
**Phase 1:** Complete DataSource, interaction patterns, event system, policy enforcement  
**Phase 2+:** Implement 6 canvas types systematically

See [`plans/NEXT_WORK_ITEM_PRIORITIZATION.md`](../../plans/NEXT_WORK_ITEM_PRIORITIZATION.md) for prioritized implementation roadmap.

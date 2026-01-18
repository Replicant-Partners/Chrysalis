# Canvas System

Multi-canvas workspace implementation for Chrysalis Terminal supporting human-agent collaborative knowledge work.

## Architecture

The Canvas system implements 6 specialized canvas types, each with distinct interaction patterns while sharing common infrastructure:

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

## Documentation

- **Architecture Review:** [`plans/CANVAS_ARCHITECTURAL_REVIEW_2026-01-18.md`](../../plans/CANVAS_ARCHITECTURAL_REVIEW_2026-01-18.md)
- **Implementation Roadmap:** [`plans/CHRYSALIS_TERMINAL_IMPLEMENTATION_ROADMAP.md`](../../plans/CHRYSALIS_TERMINAL_IMPLEMENTATION_ROADMAP.md)
- **Validation Report:** [`plans/PRE-IMPLEMENTATION_VALIDATION_REPORT.md`](../../plans/PRE-IMPLEMENTATION_VALIDATION_REPORT.md)
- **Foundation Spec:** [`docs/CANVAS_FOUNDATION_IMPLEMENTATION.md`](../../docs/CANVAS_FOUNDATION_IMPLEMENTATION.md)
- **Development Protocol:** [`docs/CANVAS_DEVELOPMENT_PROTOCOL.md`](../../docs/CANVAS_DEVELOPMENT_PROTOCOL.md)

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

## Implementation Status

- ✅ Core types defined ([`types.ts`](types.ts)) - 546 lines, complete
- ✅ WidgetRegistry implementation ([`WidgetRegistry.ts`](WidgetRegistry.ts)) - 322 lines, complete
- ⚠️ BaseCanvas component ([`BaseCanvas.tsx`](BaseCanvas.tsx)) - 468 lines, needs build config fix
- ⏳ Data Source layer pending
- ⏳ Canvas implementations pending
- ⏳ Infrastructure layer pending

### Session Progress

**Session 1 (2026-01-18):** Foundation structure created  
- Created BaseCanvas component with ReactFlow integration
- Created demo component showing usage  
- Identified build configuration blocker
- See [`plans/CANVAS_SESSION_1_SUMMARY.md`](../../plans/CANVAS_SESSION_1_SUMMARY.md) for details

## Next Steps

**Immediate:** Resolve build configuration to enable compilation  
**Phase 1:** Complete DataSource, interaction patterns, event system, policy enforcement  
**Phase 2+:** Implement 6 canvas types systematically

See [`plans/NEXT_WORK_ITEM_PRIORITIZATION.md`](../../plans/NEXT_WORK_ITEM_PRIORITIZATION.md) for prioritized implementation roadmap.

# Canvas Design Decisions Document

**Version**: 1.0.0  
**Date**: January 25, 2026  
**Status**: Design Review  
**Purpose**: Resolve integration design questions for Canvas system

---

## Executive Summary

Canvas system exists in **three deployment contexts** that require different design decisions:

1. **Standalone Browser Application** ([`src/canvas-app/App.tsx`](../src/canvas-app/App.tsx)) - Independent canvas-only interface
2. **Embedded in ChrysalisWorkspace** ([`ChrysalisWorkspace.tsx`](../src/components/ChrysalisWorkspace/ChrysalisWorkspace.tsx)) - Center pane of three-column layout
3. **Future: Multiple Canvas Types** - Potential for canvas type selection/management

**Critical Finding**: Current architecture has **conflicting canvas type systems** between specifications and implementations that blocks integration decisions.

---

## Table of Contents

1. [Canvas Type System Conflict](#1-canvas-type-system-conflict)
2. [Deployment Context Design Questions](#2-deployment-context-design-questions)
3. [Canvas Selection & Management](#3-canvas-selection--management)
4. [State Management & Persistence](#4-state-management--persistence)
5. [Integration Architecture](#5-integration-architecture)
6. [Recommended Resolutions](#6-recommended-resolutions)

---

## 1. Canvas Type System Conflict

### 1.1 The Problem

**Two Incompatible Type Systems Exist:**

**System A**: Original Specification ([`docs/specs/CANVAS_SPECIFICATION.md`](../docs/specs/CANVAS_SPECIFICATION.md))
```typescript
type CanvasKind = 
  | 'commons'   // Multi-agent shared workspace
  | 'scratch';  // Individual workspace
```

**System B**: Current Implementation ([`src/canvas/types.ts:13-21`](../src/canvas/types.ts:13-21))
```typescript
type CanvasKind = 
  | 'agent'
  | 'research'
  | 'scrapbook'
  | 'settings'
  | 'terminal'
  | 'terminal-browser'
  | 'wiki'
  | 'custom';
```

**System C**: ChrysalisWorkspace Implementation
```typescript
// Uses custom tab system, not CanvasKind
type CanvasTab = {
  id: 'canvas-commons' | 'canvas-scratch';
  label: string;
  isReady: boolean;
};
```

**Evidence of Confusion**:
- [`src/canvas-app/CanvasApp.tsx:254`](../src/canvas-app/CanvasApp.tsx:254): Uses System B types
- [`ChrysalisWorkspace.tsx:308-311`](../src/components/ChrysalisWorkspace/ChrysalisWorkspace.tsx:308-311): Uses System C (custom tabs)
- Original spec expects 2 canvas types, implementation has 8 types

### 1.2 Impact on Design Decisions

**Cannot Answer**:
1. Which canvas types should standalone app offer?
2. Which canvas types should ChrysalisWorkspace center pane support?
3. Should Commons/Scratch mapping to 6 canvas types, or are they alternatives?
4. Is AgentCanvas == Commons Canvas with agent widgets?

**Design is Blocked Until Type System is Unified**

---

## 2. Deployment Context Design Questions

### 2.1 Standalone Browser Application

**Current State**: [`src/canvas-app/App.tsx`](../src/canvas-app/App.tsx) (381 lines)
- Implements tabbed interface with 6 canvas types
- Has File menu (New, Open, Save)
- Uses localStorage for persistence
- Full-screen application

**Design Questions**:

#### Q1: What is the PURPOSE of the standalone application?
**Options**:
- **A**: Development/testing tool (not for end users)?
- **B**: Separate product for canvas-only workflows?
- **C**: Preview/demo for showcasing canvas capabilities?

**Current Evidence**: Appears to be option A (dev tool) based on:
- No authentication
- No agent integration
- Basic UI styling
- Located in `canvas-app/` (not `app/` or `main/`)

**Decision Needed**: Clarify standalone app purpose to inform feature prioritization

---

#### Q2: Should standalone app support ALL 6+ canvas types or subset?
**Options**:
- **A**: All types - maximize exploration
- **B**: Subset - only types that work standalone (Settings, Scrapbook, Research, Wiki)
- **C**: Single type - focused testing per launch config

**Current State**: Offers all 6 types but some don't function standalone:
- ✅ Settings - works (config editing)
- ✅ Scrapbook - works (notes, links, artifacts)
- ⚠️ Agent - non-functional (no agent runtime)
- ⚠️ Research - partially (no agent synthesis)
- ⚠️ Wiki - non-functional (no memory backend)
- ❌ Terminal-Browser - broken (no terminal)

** Recommended**: Option B - Filter to self-contained canvases

---

#### Q3: Should standalone app have agent bindings?
**Options**:
- **A**: Yes - embed lightweight agent system for testing
- **B**: No - pure canvas testing without agents
- **C**: Optional - configurable via environment/config

**Current State**: No agent integration (pure canvas UI)

**Implications**:
- Option A: Requires agent system dependency
- Option B: Limits to non-agent canvases
- Option C: Most flexible but adds complexity

**Recommended**: Option B initially, evolve to C when agent bridge stabilizes

---

#### Q4: How should standalone app handle file operations?
**Current Behavior**:
```typescript
handleSave() {
  // Download JSON file to disk
  const blob = new Blob([JSON.stringify(canvasData)]);
  const url = URL.createObjectURL(blob);
  a.download = `${activeCanvas}-canvas-${Date.now()}.json`;
}

handleOpen() {
  // Upload JSON file from disk
  fileInputRef.current?.click();
}
```

**Design Question**: Should standalone app support cloud persistence?

**Options**:
- **A**: LocalStorage only (current)
- **B**: Add optional backend API sync
- **C**: Support multiple backends (localStorage, API, CRDT)

**Current Gap**: localStorage has no way to share canvases between users

**Recommended**: Option A for now, plan for Option C when CRDT integration complete

---

### 2.2 Embedded in ChrysalisWorkspace

**Current State**: [`ChrysalisWorkspace.tsx`](../src/components/ChrysalisWorkspace/ChrysalisWorkspace.tsx) (1233 lines)
- Three-column layout: Left chat | Center canvas | Right chat
- Center pane displays AgentCanvas component
- Has custom tab system for 'Commons' and 'Scratch'
- Integrates with memory system and agent chat controllers

**Design Questions**:

#### Q5: What canvas types should embedded workspace support?
**Current Implementation**: Uses [`AgentCanvas`](../src/components/AgentCanvas/AgentCanvas.tsx)

**Design Problem**: This creates **fourth canvas system**:
- System A: Spec (commons/scratch)
- System B: Implementation (agent/research/wiki/etc)
- System C: ChrysalisWorkspace tabs (canvas-commons/canvas-scratch)
- **System D**: AgentCanvas component (separate from BaseCanvas types!)

**Evidence of Confusion**:
```typescript
// ChrysalisWorkspace imports AgentCanvas from different location
import { AgentCanvas, CanvasTabs, CanvasTab } from '../AgentCanvas';

// But canvas system has its own AgentCanvas
import { AgentCanvas } from '../canvas/canvases/AgentCanvas';
```

**These are DIFFERENT components!**
- [`src/components/AgentCanvas/AgentCanvas.tsx`](../src/components/AgentCanvas/AgentCanvas.tsx) - Workspace-specific
- [`src/canvas/canvases/AgentCanvas.tsx`](../src/canvas/canvases/AgentCanvas.tsx) - Canvas system type

**Critical Design Question**: Should ChrysalisWorkspace:
- **Option A**: Use canvas system's AgentCanvas type?
- **Option B**: Keep separate AgentCanvas component?
- **Option C**: Support ALL canvas types in center pane?
- **Option D**: Map Commons → Agent Canvas, Scratch → Scrapbook Canvas?

**Current Architecture is INCOHERENT** - Two separate canvas systems!

**Recommended**: **UNIFY** - ChrysalisWorkspace should import from canvas system, not maintain parallel implementation

---

#### Q6: Should embedded workspace allow canvas type switching?
**Current State**: Fixed tabs ('Commons', 'Scratch'), but AgentCanvas doesn't match spec

**Design Options**:
- **A**: Fixed - workspace determines canvas type (user can't switch)
- **B**: Tabs - switch between 2-3 predefined canvas types
- **C**: Full selector - all canvas types available
- **D**: Contextual - canvas type auto-selected based on workflow

**UX Considerations**:
```
┌─────────────────────────────────────────────────────────┐
│ Left Chat  │     Center Canvas     │     Right Chat     │
│  (Agent)   │  [Commons][Scratch]   │     (Agent)        │
│            │   (AgentCanvas/???)    │                    │
└─────────────────────────────────────────────────────────┘
```

**Question**: What do Commons/Scratch tabs actually SHOW?

**Options**:
- **A**: Same AgentCanvas, different persistence keys?
- **B**: Commons = AgentCanvas, Scratch = ScrapbookCanvas?
- **C**: Different views/filters of same canvas?

**Current Implementation**: Tabs exist but don't switch canvas types!

**Recommended**: Define Commons/Scratch mapping FIRST, then implement switching

---

#### Q7: How should embedded workspace handle side-chat interaction with canvas?
**Current System**:
- Left chat bound to primaryAgent
- Right chat bound to secondaryAgent (optional)
- Center has AgentCanvas

**Design Question**: How do chats interact with canvas?

**Scenarios**:
1. **User types in left chat** → Should agent's response appear on canvas?
2. **User @mentions agent in canvas** → Should conversation appear in side chat?
3. **Agent generates artifact** → Where does it go? (canvas widget vs chat message)

**Current State**: Undefined - chats and canvas are isolated

**Required Design**:
```typescript
interface CanvasChatchBridge {
  // Send chat message to canvas as widget
  sendToCanvas(message: ChatMessage): Promise<WidgetNode>;
  
  // Send canvas event to chat pane
  sendToChat(event: CanvasEvent, position: 'left' | 'right'): void;
  
  // Bi-directional binding
  bindChatToAgent(chatPosition: 'left' | 'right', agentId: string): void;
}
```

**This interface doesn't exist!**

**Recommended**: Design chat-canvas bridge before finalizing workspace layout

---

### 2.3 Independent Browser Application (Future)

**Potential Future State**: Canvas as separate webapp (like Figma, Miro, etc.)

**Design Questions**:

#### Q8: Should there be a multi-canvas management UI?
**Options**:
- **A**: Single canvas per window (like current standalone)
- **B**: Multi-tab canvas browser (multiple canvases in tabs)
- **C**: Split-screen canvas comparison
- **D**: Project-based canvas collections

**Evidence**: No current design for multi-canvas scenarios

**Recommended**: Defer until single-canvas experience is solid

---

#### Q9: How should independent app handle authentication?
**Current State**: No auth (assumed localhost/dev)

**Future Options**:
- **A**: OAuth (GitHub, Google, etc.)
- **B**: Email/password
- **C**: API key auth (for programmatic access)
- **D**: Hybrid (user auth + agent API keys)

**Required For**:
- Cloud persistence
- Shared canvases
- Cross-device sync

**Recommended**: Design auth strategy when cloud backend is specced

---

## 3. Canvas Selection & Management

### 3.1 Canvas Creation Flow

**Design Question**: How do users create new canvases of specific types?

**Current Standalone App**:
```typescript
// Tabs for switching canvas types
<button onClick={() => setActiveCanvas('agent')}>Agent</button>
<button onClick={() => setActiveCanvas('wiki')}>Wiki</button>
// Creates new canvas on switch, OR loads from localStorage?
```

**Ambiguity**: Does switching canvas types:
- **A**: Create NEW canvas of that type?
- **B**: Load EXISTING canvas of that type (one per type)?
- **C**: Show canvas SELECTOR modal to pick from multiple instances?

**Current Behavior**: Option B - one canvas per type in localStorage

**Design Problem**: Can't have multiple Agent canvases or multiple Wiki canvases

**Better UX** (inspired by Notion/Figma):
```
┌─────────────────────────┐
│ Chrysalis               │
│ ├─ 📊 Project Dashboard (agent canvas)
│ ├─ 📓 Meeting Notes (scrapbook canvas)
│ ├─ 🔬 Research: AI Models (research canvas)
│ ├─ 📖 Team Wiki (wiki canvas)
│ └─ ⚙️ Settings (settings canvas)
└─────────────────────────┘
```

**Requires**: Canvas instance management, not just canvas type

**Design Decision Needed**: Canvas instance model:

```typescript
// Option A: Canvas Type (current - one per type)
type CanvasReference = CanvasKind;  // 'agent' | 'wiki' | etc

// Option B: Canvas Instance (proposed)
interface CanvasInstance {
  id: string;                    // unique instance ID
  kind: CanvasKind;             // type of canvas
  name: string;                 // user-defined name
  createdAt: number;
  lastModified: number;
  owner?: string;               // for multi-user
}
```

**Recommended**: Adopt Option B (instance model) for scalability

---

### 3.2 Canvas Persistence Strategy

**Design Question**: Where is canvas state stored?

**Current Implementation**:
```typescript
// Standalone app
const dataSource = createLocalStorageDataSource(canvasId);

// ChrysalisWorkspace
// ??? - appears to use YJS doc but AgentCanvas doesn't connect to it
```

**Persistence Options**:

| Storage | Pros | Cons | Use Case |
|---------|------|------|----------|
| **LocalStorage** | Simple, fast, offline | No sync, size limits (5-10MB) | Dev/testing |
| **IndexedDB** | Larger storage, structured queries | More complex API | Large canvases |
| **YJS CRDT** | Real-time sync, conflict-free | Requires WebSocket server | Multi-user |
| **Backend API** | Centralized, durable | Network dependent | Production |
| **Fireproof** | Offline-first, CRDT | New dependency | Spec'd but not implemented |

**Current Gap**: Different persistence per deployment:
- Standalone: localStorage
- Workspace: ??? (YJS passed but not used by AgentCanvas)

**Design Decision Needed**: Unified persistence strategy

**Recommended**: Implement DataSource adapter pattern:
```typescript
interface CanvasDataSource {
  load(): Promise<CanvasData>;
  save(data: CanvasData): Promise<void>;
  subscribe(callback: (data: CanvasData) => void): () => void;
}

// Implementations:
// - LocalStorageDataSource (exists)
// - YjsDataSource (needed for workspace)
// - FireproofDataSource (needed for shared memory)
// - RemoteApiDataSource (needed for cloud)
```

---

## 4. State Management & Persistence

### 4.1 Canvas State Lifecycle

**Design Question**: When is canvas state loaded/saved?

**Current Behavior** (BaseCanvas):
```typescript
// Load: On mount via DataSource
useEffect(() => {
  const loadData = async () => {
    const data = await dataSource.load();
    setNodes(data.nodes);
    setEdges(data.edges);
  };
  loadData();
}, [dataSource]);

// Save: ??? - No auto-save implemented
```

**Design Problem**: No auto-save strategy!

**Options**:
- **A**: Manual save (current - user clicks Save button)
- **B**: Auto-save on change (with debounce)
- **C**: Optimistic updates + background sync
- **D**: CRDT auto-merge (no explicit save)

**Recommended**: Option B for standalone, Option D for workspace (CRDT)

---

### 4.2 Multi-User State Conflicts

**Design Question**: How are concurrent edits handled?

**Current State**: Undefined (no CRDT integration)

**Scenarios**:
```
User A moves widget to (100, 100)
User B moves same widget to (200, 200)
→ Which position wins?
```

**Options**:
- **A**: Last-write-wins (LWW) - simple but lossy
- **B**: CRDT auto-merge - complex but conflict-free
- **C**: Lock-based - explicit locks prevent conflicts
- **D**: Operational Transform - like CRDT but different algo

**Canvas Spec Requires**: CRDT (Fireproof or YJS)

**Current Gap**: YJS passed to workspace but not wired to canvas

**Recommended**: Implement YjsDataSource to bridge YJS ↔ BaseCanvas

---

## 5. Integration Architecture

### 5.1 Component Hierarchy

**Current Reality**:
```
index.html
├─ src/main.tsx (entry point - not examined)
│
├─ Standalone App (src/canvas-app/App.tsx)
│  └─ BaseCanvas (from src/canvas/BaseCanvas.tsx)
│     └─ Widgets (from src/canvas/widgets/)
│
├─ ChrysalisWorkspace (src/components/ChrysalisWorkspace/)
│  ├─ ChatPane (left/right)
│  └─ AgentCanvas (from src/components/AgentCanvas/)  ← NOT canvas system!
│     └─ ??? (does not use BaseCanvas!)
│
└─ Canvas System (src/canvas/)
   ├─ BaseCanvas.tsx
   ├─ AgentCanvas.tsx (unused by workspace!)
   ├─ WikiCanvas.tsx
   └─ etc.
```

**Design Problem**: **Two parallel canvas systems exist!**
1. Canvas system types (`src/canvas/canvases/`)
2. Workspace AgentCanvas (`src/components/AgentCanvas/`)

**Evidence of Duplication**:
```bash
$ find src -name "*AgentCanvas*"
src/canvas/canvases/AgentCanvas.tsx        # Canvas system type
src/components/AgentCanvas/AgentCanvas.tsx  # Workspace component
```

**Critical Design Decision**: **Unify or Specialize?**

**Option A: Unify** (Recommended)
- ChrysalisWorkspace imports from `src/canvas/canvases/AgentCanvas`
- Delete `src/components/AgentCanvas/` duplication
- Wire YJS to canvas DataSource

**Option B: Specialize**
- Keep separate implementations for different use cases
- Maintain clear boundaries and documentation
- Risk: Divergence and confusion

**Recommended**: **Option A** - Single source of truth

---

### 5.2 Integration Points

**Required Bridges**:

```typescript
// 1. Chat ↔ Canvas Bridge (missing!)
interface ChatCanvasBridge {
  sendMessageToCanvas(msg: ChatMessage): Promise<WidgetNode>;
  sendCanvasEventToChat(event: CanvasEvent, position: 'left' | 'right'): void;
}

// 2. Agent ↔ Canvas Bridge (partially implemented in Rust, not wired)
interface AgentCanvasBridge {
  executeAgentFromCanvas(agentId: string, prompt: string): AsyncIterable<string>;
  displayAgentResponseOnCanvas(response: string): Promise<WidgetNode>;
}

// 3. Memory ↔ Canvas Bridge (missing!)
interface MemoryCanvasBridge {
  saveCanvasToMemory(canvas: CanvasData, agentId: string): Promise<void>;
  loadCanvasFromMemory(canvasId: string): Promise<CanvasData>;
  syncMemoryToWiki(memory: AgentMemory): Promise<WikiPage>;
}

// 4. Terminal ↔ Canvas Bridge (Rust exists, TypeScript wrapper missing)
interface TerminalCanvasBridge {
  createTerminalSession(canvasId: string): Promise<TerminalSession>;
  sendTerminalInput(sessionId: string, input: string): Promise<void>;
  subscribeToTerminalOutput(sessionId: string, callback: (output: string) => void): () => void;
}
```

**Current State**: None of these TypeScript bridges exist!

**Rust canvas_bridge.rs exists** but no TypeScript wrapper to call it

**Recommended**: Implement TypeScript bridge adapters as first integration step

---

## 6. Recommended Resolutions

### 6.1 Immediate Actions (Priority P0)

#### Action 1: Unify Canvas Type System

**Decision**:
```typescript
// Adopt System B (implementation) as canonical
type CanvasKind = 
  | 'agent'           // Multi-agent orchestration
  | 'research'        // Structured investigation
  | 'scrapbook'       // Exploratory gathering
  | 'settings'        // System configuration
  | 'wiki'            // Shared knowledge base
  | 'terminal-browser' // Collaborative dev workspace
  | 'custom';         // User-defined

// Map spec concepts to implementation:
// - "Commons" → AgentCanvas (multi-agent shared workspace)
// - "Scratch" → ScrapbookCanvas (individual exploration)
```

**Rationale**: Implementation has 6 working types, spec has 2 abstract concepts. Map concepts to concrete types.

**Update Required**:
- [ ] Update [`docs/specs/CANVAS_SPECIFICATION.md`](../docs/specs/CANVAS_SPECIFICATION.md) to align with implementation
- [ ] Document Commons = AgentCanvas, Scratch = ScrapbookCanvas mapping
- [ ] Remove confusion from ChrysalisWorkspace tab naming

---

#### Action 2: Unify AgentCanvas Implementations

**Decision**: **Eliminate duplication**

**Steps**:
1. Audit `src/components/AgentCanvas/AgentCanvas.tsx` - what features does it have that `src/canvas/canvases/AgentCanvas.tsx` doesn't?
2. Merge unique features into canvas system AgentCanvas
3. Update ChrysalisWorkspace to import from `src/canvas/canvases/AgentCanvas`
4. Delete `src/components/AgentCanvas/` after confirming nothing breaks

**Rationale**: Single source of truth prevents divergence

---

#### Action 3: Define Standalone App Scope

**Decision**: **Development tool for canvas testing**

**Scope**:
- ✅ Support: Settings, Scrapbook, Research (self-contained)
- ❌ Exclude: Agent, Wiki, Terminal-Browser (require backend integration)
- ✅ Persistence: LocalStorage only
- ❌ No: Authentication, cloud sync

**Rationale**: Focus on what works without backend dependencies

**Update Required**:
- [ ] Filter canvas tabs to supported types only
- [ ] Add README to `src/canvas-app/` explaining purpose
- [ ] Document as "Canvas Development Sandbox"

---

#### Action 4: Define ChrysalisWorkspace Canvas Integration

**Decision**: Use canvas system's AgentCanvas in center pane

**Integration**:
```typescript
// Replace current AgentCanvas import
import { AgentCanvas } from '../../canvas/canvases/AgentCanvas';

// Wire YJS to canvas
const yDataSource = createYjsDataSource(yjsDoc);

// Render in center pane
<AgentCanvas
  canvasId="workspace-agent-canvas"
  dataSource={yDataSource}  // ← Real-time sync!
  onEvent={(event) => bridgeCanvasEventToChats(event)}
/>
```

**Tabs Mapping**:
- "Commons" tab → AgentCanvas (multi-agent collaboration)
- "Scratch" tab → ScrapbookCanvas (private notes)

**Rationale**: Reuse canvas system, enable real-time sync

**Update Required**:
- [ ] Implement `createYjsDataSource()` adapter
- [ ] Wire canvas events to chat panes
- [ ] Test Commons/Scratch tab switching

---

### 6.2 Design Principles Going Forward

#### Principle 1: Single Source of Truth
**Never duplicate canvas implementations** - If specialized behavior is needed, extend base, don't fork

#### Principle 2: Deployment-Agnostic Core
**BaseCanvas should work identically** in standalone app, workspace, and future deployments

#### Principle 3: Progressive Enhancement
**Core canvas functions without backends** (local-only), enhanced features when backends available (memory, agents, etc.)

#### Principle 4: Clear Boundaries
**Canvas system owns visual widget logic**, integration adapters handle external system connections

---

### 6.3 Open Design Questions (Defer to Phase 2)

#### OQ1: Canvas Instance Management
**Question**: Support multiple canvas instances per type?  
**Impact**: UX, persistence, navigation  
**Recommendation**: Defer until single-canvas experience is polished

#### OQ2: Cross-Canvas References
**Question**: Should widgets link between canvases?  
**Impact**: Navigation, context management  
**Recommendation**: Defer until graph DB integration ready

#### OQ3: Canvas Templates
**Question**: Predefined canvas templates for common workflows?  
**Impact**: UX, onboarding  
**Recommendation**: Wait for user feedback on canvas types

#### OQ4: Canvas Permissions
**Question**: Who can edit/view specific canvases?  
**Impact**: Security, collaboration  
**Recommendation**: Design with auth system (Phase 3+)

---

## Appendix A: Current Architecture Audit

### File Conflicts

| Component | Location 1 | Location 2 | Status |
|-----------|-----------|-----------|--------|
| **AgentCanvas** | `src/canvas/canvases/AgentCanvas.tsx` | `src/components/AgentCanvas/AgentCanvas.tsx` | ❌ CONFLICT |
| **CanvasTabs** | (missing) | `src/components/AgentCanvas/CanvasTabs.tsx` | ⚠️ ORPHAN |
| **Canvas Types** | `src/canvas/types.ts` (`CanvasKind`) | `ChrysalisWorkspace` (custom tabs) | ⚠️ DIVERGED |

### Import Analysis

```typescript
// ChrysalisWorkspace imports (WRONG)
import { AgentCanvas, CanvasTabs } from '../AgentCanvas';  // ← Not from canvas system!

// Should be:
import { AgentCanvas } from '../../canvas/canvases/AgentCanvas';
import { BaseCanvas } from '../../canvas';
```

### Persistence Analysis

| Component | DataSource | Sync | Status |
|-----------|-----------|------|--------|
| **Standalone App** | LocalStorage | None | ✅ WORKS |
| **ChrysalisWorkspace** | ??? | YJS (passed but not used) | ❌ BROKEN |
| **Canvas System** | Abstract (any DataSource) | Pluggable | ✅ CORRECT |

---

## Appendix B: Decision Summary Table

| Question | Decision | Rationale | Priority |
|----------|----------|-----------|----------|
| **Canvas Type System** | Use implementation types (agent/wiki/etc), map spec concepts | Implementation is real, spec is aspirational | P0 |
| **AgentCanvas Duplication** | Unify into canvas system, delete components version | Single source of truth | P0 |
| **Standalone App Purpose** | Dev tool for canvas testing, not production | Focus scope on testable features | P0 |
| **Workspace Canvas** | Import AgentCanvas from canvas system | Reuse, don't rebuild | P0 |
| **Commons/Scratch Mapping** | Commons=AgentCanvas, Scratch=ScrapbookCanvas | Concrete mapping of abstract concepts | P0 |
| **YJS Integration** | Implement YjsDataSource adapter | Enable real-time sync | P1 |
| **Chat-Canvas Bridge** | Design and implement TypeScript bridge | Required for agent interaction | P1 |
| **Canvas Instance Model** | Defer - one canvas per type for now | Simplify until UX proven | P2 |
| **Multi-Canvas Management** | Defer - focus on single canvas | Avoid complexity until needed | P2 |
| **Authentication** | Defer - local-only for now | Wait for cloud backend design | P3 |

---

## Conclusion

**Primary Blocker**: Conflicting canvas type systems and duplicated AgentCanvas implementations prevent coherent integration decisions.

**Path Forward**:
1. **Unify type system** (P0) - Adopt implementation types, document spec mapping
2. **Eliminate AgentCanvas duplication** (P0) - Single implementation in canvas system
3. **Define deployment scopes** (P0) - Clarify standalone vs workspace vs future
4. **Implement integration bridges** (P1) - YjsDataSource, Chat-Canvas bridge, etc.
5. **Defer advanced features** (P2-P3) - Multi-canvas, templates, auth, etc.

**Estimated Resolution Time**: 2-3 days to resolve P0 decisions and unify architecture

**Risk**: Low - Changes are clarifications, not rewrites. Core canvas system is solid.

---

**Document Status**: Awaiting design decisions from product/architecture team

**Next Steps**:
1. Review and approve/modify recommendations
2. Update CANVAS_SPECIFICATION.md to align with implementation
3. Implement unification (eliminate duplication)
4. Proceed with integration work per updated architecture


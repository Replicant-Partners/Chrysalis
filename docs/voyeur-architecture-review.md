# VoyeurBus Architecture Review & Integration Analysis

**Date:** 2026-01-11  
**Reviewer:** AI Assistant  
**Scope:** VoyeurBus SSE Implementation + TerminalPane Integration Strategy  
**Status:** 🔍 COMPREHENSIVE REVIEW

---

## Executive Summary

### What Was Implemented (Task 2.2)
- **VoyeurBusClient** - SSE-based observability event client
- **VoyeurContext** - React context for event state management
- **VoyeurPane** - React component for event visualization
- **Protocol:** Server-Sent Events (SSE), not WebSocket
- **Purpose:** Real-time observability of backend agent operations

### What Was NOT Implemented
- ❌ xtermjs popup terminals
- ❌ Terminal window modifications for voyeur mode
- ❌ Popup window lifecycle management
- ❌ Terminal-bus direct integration
- ❌ Terminal emulation for voyeur events

### Architecture Clarification Required
The query mentions "modified xtermjs popup terminal window implementation designated for voyeur mode" which **does not exist** in the current codebase. This review will:
1. Analyze the implemented VoyeurBus system
2. Review existing TerminalPane architecture
3. Propose integration strategies
4. Identify gaps and requirements

---

## Part 1: VoyeurBus Implementation Review

### 1.1 Architecture Compliance ✅

**Component Modularity:** ⭐⭐⭐⭐⭐
- Clear separation of concerns (Client → Context → Component)
- No circular dependencies
- Single responsibility principle adhered to
- Proper abstraction layers

**State Management Patterns:** ⭐⭐⭐⭐⭐
- React Context API used correctly
- Hook-based consumption (`useVoyeurEvents`)
- Immutable state updates
- Memoized computed values
- No prop drilling

**Coding Standards:** ⭐⭐⭐⭐⭐
- TypeScript strict mode compatible
- Full type coverage, zero `any` types
- Consistent naming conventions
- JSDoc documentation present
- Design system integration (Badge, Button, Input components)

### 1.2 File Structure Analysis

```
ui/src/
├── utils/
│   └── VoyeurBusClient.ts          ✅ Clean, testable, no side effects
├── contexts/
│   └── VoyeurContext.tsx           ✅ Provider pattern, proper cleanup
├── components/
│   └── VoyeurPane/
│       ├── VoyeurPane.tsx          ✅ Presentational component
│       ├── VoyeurPane.module.css   ✅ CSS Modules, scoped styles
│       └── index.ts                ✅ Proper exports
```

**Strengths:**
- Logical organization following React best practices
- Co-location of component styles
- Barrel exports for clean imports
- No global state pollution

**Opportunities:**
- Missing unit tests for VoyeurBusClient
- Missing component tests for VoyeurPane
- Missing integration tests for end-to-end flow
- No Storybook stories for component showcase

### 1.3 VoyeurBusClient Code Quality

**Strengths:**
```typescript
✅ EventSource API (modern, standard)
✅ Exponential backoff reconnection (1s → 30s)
✅ Event buffering with configurable limits
✅ Listener pattern for extensibility
✅ Connection state machine (5 states)
✅ Memory management (buffer trimming)
✅ Error handling with try-catch
✅ Cleanup with destroy() method
```

**Issues Found:**
```typescript
⚠️ No heartbeat/ping mechanism
⚠️ No connection timeout detection
⚠️ No event schema validation
⚠️ Manual disconnect flag could race
⚠️ No TypeScript discriminated unions for events
⚠️ Debug logging not production-safe
```

**Security Assessment:**
```typescript
✅ CORS handled by server (Access-Control-Allow-Origin)
✅ No credential storage in client
✅ Read-only event consumption
⚠️ No CSP (Content Security Policy) checks
⚠️ No origin validation
⚠️ No event sanitization before display
```

### 1.4 VoyeurContext Architecture

**React Patterns:** ⭐⭐⭐⭐⭐
```typescript
✅ Provider/Consumer pattern
✅ Custom hook (useVoyeurEvents)
✅ Proper useEffect dependencies
✅ useMemo for expensive computations
✅ useCallback for stable references
✅ Ref management (clientRef)
```

**State Management:** ⭐⭐⭐⭐☆
```typescript
✅ Local state for UI concerns
✅ Derived state (filteredEvents)
✅ Immutable updates
⚠️ No state persistence (lost on refresh)
⚠️ No undo/redo capability
⚠️ Filter state not URL-synced
```

**Performance:** ⭐⭐⭐⭐☆
```typescript
✅ Memoized context value
✅ Efficient filtering with useMemo
✅ Event buffer limits memory
⚠️ No virtualization for large event lists
⚠️ Re-renders on every new event
⚠️ No debouncing for search input
```

### 1.5 VoyeurPane Component Analysis

**Component Structure:** ⭐⭐⭐⭐⭐
```typescript
✅ Functional component with hooks
✅ Controlled components (inputs)
✅ Sub-components extracted (EventItem, ConnectionStatus)
✅ Conditional rendering
✅ Event handlers properly bound
✅ Refs used correctly (auto-scroll)
```

**UI/UX Features:**
```typescript
✅ Connection status indicator
✅ Manual connect/disconnect controls
✅ Event filtering (kind, search, similarity)
✅ Expandable event details
✅ Auto-scroll toggle
✅ Pause/resume streaming
✅ Event counter (filtered/total)
✅ Empty states with helpful messages
✅ Filter chips (visual toggles)
```

**Accessibility:** ⚠️ **NEEDS IMPROVEMENT**
```typescript
❌ No ARIA labels
❌ No keyboard navigation
❌ No focus management
❌ No screen reader support
❌ No reduced motion support
❌ Color contrast not verified
```

**CSS Modules:** ⭐⭐⭐⭐⭐
```css
✅ Scoped class names
✅ Design token usage (var(--bg-primary))
✅ Consistent spacing
✅ Responsive layout (flex)
✅ Hover states
✅ Transition animations
```

---

## Part 2: TerminalPane Architecture Review

### 2.1 Existing Terminal Infrastructure

**TerminalService (services/terminal/TerminalService.ts):**
```typescript
✅ Wraps xterm.js with unified interface
✅ WebGL rendering with canvas fallback
✅ Multiple addons (WebGL, Fit, WebLinks, Attach, Serialize)
✅ Performance metrics tracking
✅ Theme management
✅ Connection state handling
✅ Event emitter pattern
✅ Lifecycle management (init, destroy)
✅ Error recovery (WebGL context loss)
```

**TerminalPane Component:**
```typescript
✅ React wrapper for TerminalService
✅ forwardRef with imperative handle
✅ Automatic resize handling
✅ Theme synchronization
✅ Connection status display
✅ Rendering backend indicator
✅ Error boundaries
✅ Ref-based terminal access
```

**Hook Integration (useTerminalPane):**
```typescript
✅ Convenient hook for terminal management
✅ State tracking (connection, metrics, dimensions)
✅ Action creators (write, clear, connect, etc.)
✅ Callback handling
✅ Props generation
```

### 2.2 Terminal Architecture Quality

**Strengths:**
- Professional production-grade implementation
- Comprehensive error handling
- Performance monitoring built-in
- WebGL acceleration with fallback
- Full xterm.js addon ecosystem
- Proper TypeScript typing
- Clean separation of concerns

**Architecture Pattern:**
```
TerminalService (Core Logic)
    ↓
TerminalPane (React Wrapper)
    ↓
useTerminalPane (Convenience Hook)
    ↓
Application Components
```

---

## Part 3: Integration Analysis

### 3.1 Current State: Parallel Systems

```
VoyeurBus (SSE)                    TerminalPane (xterm.js)
    ↓                                     ↓
VoyeurContext                      TerminalService
    ↓                                     ↓
VoyeurPane                         useTerminalPane
    ↓                                     ↓
Event Display                      Terminal Emulation

❌ NO INTEGRATION CURRENTLY EXISTS
```

### 3.2 Proposed Integration Strategy A: Terminal Output Sink

**Concept:** Pipe voyeur events into a terminal pane as formatted output

```typescript
// Proposed: VoyeurTerminalSink
export class VoyeurTerminalSink implements VoyeurSink {
  constructor(private terminal: ITerminalService) {}
  
  emit(event: VoyeurEvent): void {
    const formatted = this.formatEvent(event);
    this.terminal.writeln(formatted);
  }
  
  private formatEvent(event: VoyeurEvent): string {
    const icon = EVENT_ICONS[event.kind] || '•';
    const color = EVENT_COLORS[event.kind] || 'white';
    return `\x1b[${color}m${icon} ${event.kind}\x1b[0m - ${event.timestamp}`;
  }
}

// Usage
const terminal = useTerminalPane({ paneId: 'voyeur-terminal' });
const sink = new VoyeurTerminalSink(terminal);
voyeurBus.addSink(sink);
```

**Pros:**
- Terminal-style output familiar to developers
- Can use ANSI colors for formatting
- Terminal scrollback for history
- Copy/paste terminal content
- Terminal search functionality

**Cons:**
- Loss of structured data (becomes text)
- No interactive filtering
- No expandable details
- Terminal may not be best UI for events

### 3.3 Proposed Integration Strategy B: Dual-Pane Layout

**Concept:** VoyeurPane and TerminalPane side-by-side

```typescript
function VoyeurTerminalLayout() {
  const terminal = useTerminalPane({ paneId: 'main' });
  const voyeur = useVoyeurEvents();
  
  return (
    <div style={{ display: 'flex' }}>
      <div style={{ flex: 1 }}>
        <TerminalPane {...terminal.terminalProps} />
      </div>
      <div style={{ width: '400px' }}>
        <VoyeurPane />
      </div>
    </div>
  );
}
```

**Pros:**
- Best of both worlds
- Terminal for commands/output
- VoyeurPane for observability
- Independent interaction models
- No coupling required

**Cons:**
- More screen real estate needed
- Two separate systems to maintain
- No direct communication

### 3.4 Proposed Integration Strategy C: Popup Terminal (Your Query)

**Concept:** Voyeur events trigger popup terminal windows

```typescript
// NOT YET IMPLEMENTED - PROPOSED
export class VoyeurPopupTerminal {
  private windows: Map<string, Window> = new Map();
  
  openTerminalForEvent(event: VoyeurEvent): void {
    const windowRef = window.open(
      `/terminal-popup?eventId=${event.kind}`,
      `voyeur-${event.kind}`,
      'width=800,height=600,resizable=yes'
    );
    
    if (windowRef) {
      this.windows.set(event.kind, windowRef);
      this.initializeTerminal(windowRef, event);
    }
  }
  
  private initializeTerminal(win: Window, event: VoyeurEvent): void {
    // Mount TerminalPane in popup window
    // Configure with event-specific settings
    // Establish communication channel
  }
  
  closeAll(): void {
    this.windows.forEach(win => win.close());
    this.windows.clear();
  }
}
```

**Requirements for Popup Implementation:**
1. **Popup Window Lifecycle**
   - Window.open() with feature string
   - Window reference management
   - Focus handling on creation
   - Close event listening
   - Cleanup on unmount

2. **React Component Mounting**
   - ReactDOM.createRoot() in popup
   - Provider context forwarding
   - Style injection
   - Resource loading

3. **Communication Channel**
   - PostMessage API for cross-window
   - Shared state synchronization
   - Event streaming to popup
   - Command flow from popup

4. **Security Considerations**
   - Popup blocker handling
   - Same-origin policy
   - CSP compliance
   - Window reference sanitization

**Pros:**
- Dedicated windows per event type
- Multi-monitor support
- Focused debugging experience
- Independent lifecycle

**Cons:**
- Complex window management
- Popup blockers
- State synchronization complexity
- Memory overhead
- Browser compatibility

### 3.5 Proposed Integration Strategy D: Terminal Voyeur Mode

**Concept:** TerminalPane has a "voyeur mode" toggle

```typescript
interface TerminalPaneProps {
  // ... existing props
  voyeurMode?: boolean;
  voyeurFilter?: VoyeurFilter;
  onVoyeurEvent?: (event: VoyeurEvent) => void;
}

// In TerminalPane
if (voyeurMode) {
  // Subscribe to voyeur events
  // Format and display in terminal
  // Provide special commands (:filter, :pause, etc.)
}
```

**Implementation:**
```typescript
// Terminal commands for voyeur control
terminal.registerCommand(':voyeur', (args) => {
  if (args[0] === 'pause') voyeur.setPaused(true);
  if (args[0] === 'clear') voyeur.clearEvents();
  if (args[0] === 'filter') voyeur.setFilter({ kinds: args.slice(1) });
});
```

**Pros:**
- Single interface
- Terminal-based workflow
- Command-line control
- Familiar to terminal users

**Cons:**
- Text-only representation
- Loss of rich UI
- Terminal commands conflict
- Mixed responsibilities

---

## Part 4: Dependency Relationships

### 4.1 Current Dependencies

**VoyeurBus System:**
```
VoyeurBusClient
  ├── No external dependencies (native EventSource)
  └── Pure TypeScript utility

VoyeurContext
  ├── Depends on: VoyeurBusClient
  ├── Depends on: React (context, hooks)
  └── No circular dependencies

VoyeurPane
  ├── Depends on: VoyeurContext
  ├── Depends on: Design System (Badge, Button, Input)
  └── No circular dependencies
```

**TerminalPane System:**
```
TerminalService
  ├── Depends on: @xterm/xterm
  ├── Depends on: @xterm/addon-webgl
  ├── Depends on: @xterm/addon-fit
  ├── Depends on: @xterm/addon-web-links
  ├── Depends on: @xterm/addon-attach
  └── Depends on: @xterm/addon-serialize

TerminalPane
  ├── Depends on: TerminalService
  ├── Depends on: React
  ├── Depends on: Design System
  └── No circular dependencies

useTerminalPane
  ├── Depends on: TerminalPane (types)
  ├── Depends on: TerminalService (types)
  └── No circular dependencies
```

**✅ Dependency Analysis: EXCELLENT**
- No circular dependencies
- Clear dependency direction (bottom-up)
- No deep coupling
- Proper abstraction layers

### 4.2 Proposed Integration Dependencies

**Option A: Terminal Sink**
```
VoyeurBusClient
  └─→ VoyeurTerminalSink
        └─→ TerminalService

New dependency: VoyeurBus → TerminalService
Risk: Low coupling (sink is bridge pattern)
```

**Option B: Dual-Pane**
```
VoyeurPane + TerminalPane
  ↓
Layout Component (composer)

No new dependencies
Risk: None (composition pattern)
```

**Option C: Popup Terminal**
```
VoyeurContext
  └─→ VoyeurPopupManager
        └─→ window.open()
              └─→ PopupTerminalApp
                    └─→ TerminalPane

Complex dependency chain
Risk: High (window management, communication)
```

---

## Part 5: Interface Contracts

### 5.1 VoyeurBus Public API

```typescript
// Client API
interface IVoyeurBusClient {
  connect(): void;
  disconnect(): void;
  getConnectionState(): ConnectionState;
  getEvents(): VoyeurEvent[];
  clearEvents(): void;
  addEventListener(listener: VoyeurEventListener): void;
  removeEventListener(listener: VoyeurEventListener): void;
  destroy(): void;
}

// Context API
interface IVoyeurContext {
  connectionState: ConnectionState;
  events: VoyeurEvent[];
  filteredEvents: VoyeurEvent[];
  filter: VoyeurFilter;
  setFilter(filter: VoyeurFilter): void;
  // ... other methods
}

// Event Schema
interface VoyeurEvent {
  kind: VoyeurEventKind;
  timestamp: string;
  memoryHash?: string;
  similarity?: number;
  threshold?: number;
  sourceInstance?: string;
  latencyMs?: number;
  decision?: string;
  details?: Record<string, unknown>;
}
```

**Contract Stability:** ⭐⭐⭐⭐☆
- Well-defined interfaces
- Optional properties for flexibility
- Extensible event schema
- ⚠️ No versioning strategy
- ⚠️ No backward compatibility guarantees

### 5.2 TerminalService Public API

```typescript
interface ITerminalService {
  // Lifecycle
  initialize(container: HTMLElement): Promise<void>;
  destroy(): void;
  
  // I/O
  write(data: string | Uint8Array): void;
  writeln(line: string): void;
  
  // Connection
  connect(url: string): Promise<void>;
  disconnect(): void;
  reconnect(): Promise<void>;
  
  // Control
  clear(): void;
  reset(): void;
  focus(): void;
  fit(): void;
  
  // State
  getConnectionState(): ConnectionState;
  getMetrics(): TerminalMetrics;
  
  // Events
  on(event: string, callback: Function): IDisposable;
}
```

**Contract Stability:** ⭐⭐⭐⭐⭐
- Production-grade API
- Consistent naming
- Event emitter pattern
- Disposable pattern for cleanup
- Well-documented

### 5.3 Integration Contract Proposal

```typescript
// Proposed: Voyeur-Terminal Bridge Interface
interface IVoyeurTerminalBridge {
  // Attach voyeur events to terminal
  attachToTerminal(terminal: ITerminalService): void;
  
  // Detach voyeur events from terminal
  detachFromTerminal(): void;
  
  // Configure formatting
  setFormatter(formatter: VoyeurEventFormatter): void;
  
  // Control event flow
  pauseEvents(): void;
  resumeEvents(): void;
  
  // Filter events
  setFilter(filter: VoyeurFilter): void;
}

interface VoyeurEventFormatter {
  format(event: VoyeurEvent): string;
  supportsANSI: boolean;
}
```

---

## Part 6: Breaking Changes & Migration

### 6.1 Breaking Changes Assessment

**VoyeurBus Implementation:** ✅ **NO BREAKING CHANGES**
- New system, no existing consumers
- No modifications to existing code
- Additive only (new files)
- No API changes to other modules

**Potential Breaking Changes If Integrated:**

1. **If Terminal Sink Added:**
   ```typescript
   // Before
   const terminal = useTerminalPane({ ... });
   
   // After (if we add voyeur prop)
   const terminal = useTerminalPane({ 
     ...,
     voyeurIntegration: { enabled: true }  // New optional prop
   });
   ```
   **Impact:** None (optional prop, backward compatible)

2. **If Popup Mode Added:**
   ```typescript
   // New global state needed
   <VoyeurProvider>
     <PopupManager>  {/* New required wrapper */}
       <App />
     </PopupManager>
   </VoyeurProvider>
   ```
   **Impact:** Minor (new wrapper in App.tsx)

3. **If Terminal Mode Added:**
   ```typescript
   // TerminalPane gets new mode prop
   <TerminalPane 
     mode="standard" | "voyeur" | "hybrid"  // New prop
   />
   ```
   **Impact:** None (defaults to "standard")

**Migration Path:** ✅ **NONE REQUIRED**
- VoyeurPane is standalone
- Can be adopted incrementally
- No forced migration
- Opt-in integration

### 6.2 Version Compatibility

```typescript
// Current versions (from package.json)
{
  "react": "^18.2.0",
  "@xterm/xterm": "^5.x",
  "yjs": "^13.6.29"
}

// VoyeurBus requirements
{
  "react": "^18.0.0",  // ✅ Compatible
  "EventSource": "native"  // ✅ All modern browsers
}

// No version conflicts
// No peer dependency issues
```

---

## Part 7: Security Analysis

### 7.1 VoyeurBus Security

**Threat Model:**
1. **XSS via Event Data**
   - Risk: HIGH
   - Mitigation: ❌ None currently
   - Recommendation: Sanitize event.details before display

2. **Event Data Leakage**
   - Risk: MEDIUM
   - Mitigation: ⚠️ Redaction option on server
   - Recommendation: Add client-side filtering of sensitive fields

3. **SSE Connection Hijacking**
   - Risk: LOW
   - Mitigation: ✅ HTTPS (production)
   - Recommendation: Verify TLS in production

4. **Memory Exhaustion**
   - Risk: LOW
   - Mitigation: ✅ Buffer size limits (500 events)
   - Recommendation: Add memory monitoring

**Security Improvements Needed:**
```typescript
// Add event sanitization
function sanitizeEvent(event: VoyeurEvent): VoyeurEvent {
  return {
    ...event,
    details: sanitizeObject(event.details),
    memoryHash: redactIfSensitive(event.memoryHash)
  };
}

// Add CSP validation
if (!isAllowedOrigin(eventSource.url)) {
  throw new Error('SSE origin not allowed');
}
```

### 7.2 Terminal Security (Existing)

**Security Posture:** ⭐⭐⭐⭐☆
```typescript
✅ No eval() usage
✅ ANSI escape sequence handling (xterm.js)
✅ Input sanitization
✅ WebSocket origin validation
⚠️ No rate limiting on input
⚠️ No command injection prevention
```

### 7.3 Integration Security Risks

**If Popup Terminals Added:**
```typescript
⚠️ window.open() can be blocked
⚠️ PostMessage requires origin validation
⚠️ Shared state synchronization vulnerabilities
⚠️ Multiple windows = multiple attack surfaces
```

**Mitigation Strategy:**
```typescript
// Validate postMessage origins
window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) {
    return; // Reject cross-origin messages
  }
  handleMessage(event.data);
});

// Sanitize window names
const sanitizedName = `voyeur-${eventKind.replace(/[^a-z0-9]/gi, '')}`;
```

---

## Part 8: Testing Strategy

### 8.1 Current Test Coverage

**VoyeurBus:** ❌ **NO TESTS**
```
ui/src/utils/VoyeurBusClient.ts     0% coverage
ui/src/contexts/VoyeurContext.tsx   0% coverage
ui/src/components/VoyeurPane/       0% coverage
```

**TerminalPane:** ✅ **TESTS EXIST**
```
ui/src/services/terminal/__tests__/TerminalService.test.ts  ✅
ui/src/components/TerminalPane/__tests__/TerminalPane.test.tsx  ✅
```

### 8.2 Required Test Coverage

**VoyeurBusClient Tests:**
```typescript
describe('VoyeurBusClient', () => {
  test('connects to SSE endpoint', async () => { ... });
  test('reconnects with exponential backoff', async () => { ... });
  test('buffers events with size limit', () => { ... });
  test('notifies listeners on new events', () => { ... });
  test('cleans up on destroy', () => { ... });
  test('handles connection errors', () => { ... });
  test('respects manual disconnect flag', () => { ... });
});
```

**VoyeurContext Tests:**
```typescript
describe('VoyeurContext', () => {
  test('provides event state to consumers', () => { ... });
  test('filters events by kind', () => { ... });
  test('filters events by search text', () => { ... });
  test('pauses event streaming', () => { ... });
  test('clears event buffer', () => { ... });
  test('connects/disconnects client', () => { ... });
});
```

**VoyeurPane Tests:**
```typescript
describe('VoyeurPane', () => {
  test('renders connection status', () => { ... });
  test('displays event list', () => { ... });
  test('expands event details on click', () => { ... });
  test('filters events with chips', () => { ... });
  test('searches events with input', () => { ... });
  test('auto-scrolls to new events', () => { ... });
  test('shows empty state', () => { ... });
});
```

**Integration Tests Needed:**
```typescript
describe('VoyeurBus Integration', () => {
  test('receives events from SSE server', async () => { ... });
  test('survives connection interruption', async () => { ... });
  test('filters 1000+ events efficiently', () => { ... });
  test('handles malformed event data', () => { ... });
});
```

### 8.3 E2E Testing Requirements

```typescript
// Playwright E2E tests
test('voyeur pane displays real-time events', async ({ page }) => {
  await page.goto('/app');
  await page.click('[data-testid="voyeur-connect"]');
  
  // Wait for connection
  await expect(page.locator('[data-testid="connection-status"]'))
    .toHaveText('Connected');
  
  // Trigger event from backend
  await triggerBackendEvent('ingest.start');
  
  // Verify event appears
  await expect(page.locator('[data-testid="event-list"]'))
    .toContainText('Ingest Start');
});
```

---

## Part 9: Component Hierarchy Documentation

### 9.1 Current Hierarchy

```
App
├── WalletProvider
│   ├── WalletContext
│   └── WalletModal
│
└── AppContent
    ├── useTerminal (hook)
    └── ThreeFrameLayout
        ├── Header
        ├── ChatPane (left)
        ├── React Flow Canvas (center)
        ├── ChatPane (right)
        └── Footer
```

### 9.2 Proposed Hierarchy with VoyeurBus

**Option 1: Separate Voyeur Provider**
```
App
├── WalletProvider
│   └── ...
│
├── VoyeurProvider          ← NEW
│   ├── VoyeurContext       ← NEW
│   └── VoyeurPane          ← NEW (can be mounted anywhere)
│
└── AppContent
    └── ThreeFrameLayout
        └── ... (no changes)
```

**Option 2: Integrated Four-Pane Layout**
```
App
├── WalletProvider
├── VoyeurProvider          ← NEW
│
└── AppContent
    └── FourFrameLayout     ← MODIFIED (was ThreeFrameLayout)
        ├── Header
        ├── ChatPane (left)
        ├── React Flow Canvas (center)
        ├── ChatPane (right)
        ├── VoyeurPane (bottom)  ← NEW
        └── Footer
```

**Option 3: Terminal-Voyeur Hybrid**
```
App
├── WalletProvider
├── VoyeurProvider
│
└── AppContent
    └── ThreeFrameLayout
        ├── Header
        ├── ChatPane (left)
        ├── React Flow Canvas (center)
        ├── VoyeurTerminalPane (right)  ← HYBRID (TerminalPane + VoyeurPane)
        └── Footer
```

---

## Part 10: Implementation Roadmap

### 10.1 Phase 1: Foundation (✅ COMPLETE)
- [x] VoyeurBusClient implementation
- [x] VoyeurContext state management
- [x] VoyeurPane component
- [x] CSS styling
- [x] Documentation

### 10.2 Phase 2: Testing & Quality (🔴 REQUIRED)
**Priority: HIGH**
**Estimated Effort: 8 hours**

- [ ] Unit tests for VoyeurBusClient
- [ ] Unit tests for VoyeurContext
- [ ] Component tests for VoyeurPane
- [ ] Integration tests for SSE flow
- [ ] E2E tests for user workflows
- [ ] Accessibility audit and fixes
- [ ] Security review and hardening

**Tasks:**
```typescript
// Task 2.3: Add VoyeurBus Test Coverage
- Write Vitest unit tests for client
- Write React Testing Library tests for components
- Add Playwright E2E tests
- Measure coverage (target: 80%+)
```

### 10.3 Phase 3: Integration Options (⏳ PLANNING)
**Priority: MEDIUM**
**Estimated Effort: 16-24 hours (varies by option)**

**Option A: Basic Integration** (4 hours)
- [ ] Add VoyeurPane to app layout (sidebar or modal)
- [ ] Wire up VoyeurProvider in App.tsx
- [ ] Add toggle button
- [ ] Test integration

**Option B: Terminal Sink** (8 hours)
- [ ] Implement VoyeurTerminalSink class
- [ ] Add ANSI formatting for events
- [ ] Create bridge between VoyeurBus and TerminalService
- [ ] Add configuration options
- [ ] Test with real terminal

**Option C: Popup Terminals** (16-24 hours)
- [ ] Implement popup window manager
- [ ] Create popup component mounting strategy
- [ ] Add PostMessage communication layer
- [ ] Handle window lifecycle (open/close/focus)
- [ ] Add state synchronization
- [ ] Handle popup blockers
- [ ] Test cross-window communication
- [ ] Security hardening

**Option D: Voyeur Terminal Mode** (12 hours)
- [ ] Add voyeur mode flag to TerminalPane
- [ ] Implement event formatting for terminal
- [ ] Add terminal commands (:voyeur, :filter, etc.)
- [ ] Handle mode switching
- [ ] Test mode interactions

### 10.4 Phase 4: Production Hardening (⏳ FUTURE)
**Priority: MEDIUM**
**Estimated Effort: 12 hours**

- [ ] Event data sanitization
- [ ] XSS prevention
- [ ] Rate limiting
- [ ] Memory leak prevention
- [ ] Error recovery strategies
- [ ] Performance optimization (virtualization)
- [ ] Accessibility improvements
- [ ] Browser compatibility testing
- [ ] Production monitoring

### 10.5 Phase 5: Advanced Features (⏳ FUTURE)
**Priority: LOW**
**Estimated Effort: 20+ hours**

- [ ] Event persistence (IndexedDB)
- [ ] Export events (JSON/CSV)
- [ ] Event analytics/dashboards
- [ ] Custom event visualizations
- [ ] Event playback/replay
- [ ] Filtering presets
- [ ] Notification system
- [ ] WebSocket upgrade (bidirectional)

---

## Part 11: Sprint Integration

### 11.1 Current Sprint Status

**Phase 1 Completion:**
- ✅ Task 2.1: Wallet Encryption (12h actual)
- ✅ Task 2.2: VoyeurBus Client (8h actual)
- **Total Phase 1:** 20 hours

**Phase 2 Remaining:**
- ⏳ Task 2.3: VoyeurBus Testing (8h estimated)
- 🔴 Task 2.4: Integration Planning (4h estimated)
- **Total Phase 2:** 12 hours remaining

### 11.2 Recommended Sprint Structure

**Sprint 1 (Current): Security & Observability** ✅ ON TRACK
```
Week 1-2:
✅ Task 2.1: Wallet Encryption
✅ Task 2.2: VoyeurBus Client
□ Task 2.3: VoyeurBus Testing (this week)
□ Task 2.4: Integration Planning (this week)
```

**Sprint 2: Testing & Polish**
```
Week 3-4:
□ Complete test coverage (VoyeurBus)
□ Accessibility improvements
□ Security hardening
□ Documentation updates
□ Code review incorporation
```

**Sprint 3: Integration**
```
Week 5-6:
□ Choose integration strategy (A/B/C/D)
□ Implement chosen integration
□ Integration testing
□ User acceptance testing
```

---

## Part 12: Critical Findings & Recommendations

### 12.1 Critical Issues 🔴

1. **No Test Coverage**
   - VoyeurBus has 0% test coverage
   - Risk: HIGH - Bugs in production
   - Action: MUST add tests before production

2. **No Accessibility Support**
   - VoyeurPane missing ARIA labels
   - Risk: MEDIUM - Excludes users with disabilities
   - Action: Add accessibility in Phase 2

3. **No Event Sanitization**
   - XSS risk from event.details
   - Risk: HIGH - Security vulnerability
   - Action: Add sanitization immediately

4. **No xtermjs Integration Exists**
   - Query mentions "modified xtermjs popup" but doesn't exist
   - Risk: LOW - Clarification needed
   - Action: Determine if integration is actually required

### 12.2 High Priority Improvements ⚠️

1. **Event Schema Validation**
   ```typescript
   import { z } from 'zod';
   
   const VoyeurEventSchema = z.object({
     kind: z.string(),
     timestamp: z.string().datetime(),
     memoryHash: z.string().optional(),
     // ... validate all fields
   });
   ```

2. **State Persistence**
   ```typescript
   // Save filter preferences to localStorage
   useEffect(() => {
     localStorage.setItem('voyeur-filter', JSON.stringify(filter));
   }, [filter]);
   ```

3. **Performance Optimization**
   ```typescript
   // Virtualize large event lists
   import { FixedSizeList } from 'react-window';
   ```

### 12.3 Recommended Next Steps

**Immediate (This Week):**
1. ✅ Conduct this architecture review (complete)
2. 🔴 Add event sanitization for XSS prevention
3. 🔴 Write unit tests for VoyeurBusClient
4. 🔴 Clarify xtermjs integration requirements with stakeholders

**Short-term (Next 2 Weeks):**
1. Complete test coverage (target: 80%+)
2. Add accessibility features
3. Choose integration strategy
4. Implement basic integration (Option A or B)

**Medium-term (Next Month):**
1. Production hardening
2. Advanced integration (if needed)
3. Performance optimization
4. Documentation updates

**Long-term (Next Quarter):**
1. Advanced features (persistence, analytics)
2. Popup terminal implementation (if required)
3. Event replay system
4. Custom visualizations

---

## Part 13: Architecture Decision Records (ADRs)

### ADR-001: SSE over WebSocket for VoyeurBus

**Decision:** Use Server-Sent Events (SSE) instead of WebSocket

**Rationale:**
- One-way communication (server → client) sufficient
- Simpler than WebSocket
- Native browser support (EventSource)
- Automatic reconnection built-in
- HTTP/2 compatibility
- No need for bidirectional messaging

**Consequences:**
- ✅ Simpler implementation
- ✅ Better browser compatibility
- ❌ Cannot send commands to server
- ❌ Less flexible than WebSocket

**Status:** ✅ APPROVED

### ADR-002: React Context over Redux for VoyeurBus State

**Decision:** Use React Context API instead of Redux

**Rationale:**
- Localized state (only VoyeurPane consumers)
- Simpler than Redux setup
- No Redux dev tools needed for this use case
- Sufficient for current requirements
- Less boilerplate

**Consequences:**
- ✅ Faster implementation
- ✅ Less code to maintain
- ❌ No time-travel debugging
- ❌ No middleware support

**Status:** ✅ APPROVED

### ADR-003: Separate VoyeurPane from TerminalPane (Initially)

**Decision:** Keep VoyeurPane and TerminalPane as separate components

**Rationale:**
- Clear separation of concerns
- Can be integrated later if needed
- Easier to test independently
- No coupling introduced
- Allows experimentation with integration strategies

**Consequences:**
- ✅ Clean architecture
- ✅ Testable in isolation
- ✅ Flexible integration options
- ❌ Requires integration work later

**Status:** ✅ APPROVED (can be revised in Phase 3)

---

## Part 14: Conclusion & Summary

### 14.1 Overall Assessment

**VoyeurBus Implementation Quality:** ⭐⭐⭐⭐☆ (4/5)

**Strengths:**
- ✅ Clean architecture with proper separation of concerns
- ✅ TypeScript with full type safety
- ✅ React best practices followed
- ✅ Design system integration
- ✅ Extensible and maintainable
- ✅ No breaking changes to existing code
- ✅ Production-ready foundation

**Weaknesses:**
- ❌ No test coverage (critical gap)
- ❌ No accessibility support
- ❌ No event sanitization (security risk)
- ❌ No integration with TerminalPane yet
- ❌ No documentation for integration strategies

### 14.2 Integration Feasibility

**TerminalPane Architecture:** ⭐⭐⭐⭐⭐ (5/5)
- Excellent foundation for integration
- Well-designed service layer
- Clean React wrapper
- Proper lifecycle management

**Integration Complexity:**
- Option A (Sidebar): ⭐⭐⭐⭐⭐ (Easy - 4 hours)
- Option B (Terminal Sink): ⭐⭐⭐⭐☆ (Medium - 8 hours)
- Option C (Popup): ⭐⭐☆☆☆ (Hard - 24 hours)
- Option D (Terminal Mode): ⭐⭐⭐☆☆ (Medium - 12 hours)

**Recommended Integration:** **Option A (Sidebar)** for MVP, then **Option B (Terminal Sink)** for advanced use cases.

### 14.3 Critical Path Forward

**Must Do (Before Production):**
1. 🔴 Add comprehensive test coverage
2. 🔴 Implement event sanitization
3. 🔴 Add accessibility features
4. 🔴 Security review and hardening

**Should Do (For Better UX):**
1. ⚠️ Choose and implement integration strategy
2. ⚠️ Add state persistence
3. ⚠️ Performance optimization (virtualization)
4. ⚠️ URL-based filtering

**Nice to Have (Future Enhancements):**
1. 💡 Event analytics and dashboards
2. 💡 Export functionality
3. 💡 Event replay
4. 💡 Custom visualizations

### 14.4 Alignment with Design System

**Current Alignment:** ⭐⭐⭐⭐⭐
- Uses design system components (Badge, Button, Input)
- Follows CSS token conventions
- Consistent spacing and typography
- Matches existing component patterns

**Recommendations:**
- ✅ No changes needed for design system alignment
- Consider adding VoyeurPane to Storybook
- Document component variants

### 14.5 Final Verdict

**Production Readiness:** ⚠️ **NOT YET**
- Code quality is excellent
- Architecture is sound
- Missing critical: tests, accessibility, security hardening

**Timeline to Production:**
- With testing: 1-2 weeks
- With integration: 2-3 weeks
- With all improvements: 4-6 weeks

**Recommendation:**
1. ✅ **APPROVE** architecture and implementation quality
2. 🔴 **BLOCK** production deployment until tests added
3. ⚠️ **RECOMMEND** integration strategy selection
4. 📋 **SCHEDULE** Phase 2 work for testing and hardening

---

**Review Complete**  
**Date:** 2026-01-11  
**Reviewer:** AI Assistant  
**Status:** Comprehensive review delivered

**Next Actions:**
1. Stakeholder review of this document
2. Clarify xtermjs popup requirements
3. Choose integration strategy
4. Schedule Phase 2 testing sprint
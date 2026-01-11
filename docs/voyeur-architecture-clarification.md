# VoyeurBus Architecture Clarification

**Date:** 2026-01-11  
**Critical:** Architecture Misunderstanding Identified

---

## Current State (What Actually Exists)

### VoyeurPane - Lightweight Event Stream Component ✅

**Location:** `ui/src/components/VoyeurPane/VoyeurPane.tsx`

**Implementation:**
```typescript
// VoyeurPane is a React component that:
// 1. Receives events from VoyeurBusClient (SSE)
// 2. Displays events in a custom list UI
// 3. NO xterm.js dependencies
// 4. NO terminal emulation
// 5. Pure React + CSS Modules
```

**Dependencies:**
```typescript
import { useVoyeurEvents } from '../../contexts/VoyeurContext';
import { Badge, Button, Input } from '../design-system';
// NO xterm.js imports
// NO terminal imports
```

**Rendering:**
- Custom React components (EventItem, ConnectionStatus)
- CSS-styled event list
- Expandable JSON details
- Filter chips and search
- **Zero terminal emulation**

### TerminalPane - Separate xterm.js Component ✅

**Location:** `ui/src/components/TerminalPane/TerminalPane.tsx`

**Purpose:** Actual terminal emulation (completely separate from VoyeurPane)

**Dependencies:**
```typescript
import { Terminal } from '@xterm/xterm';
import { WebglAddon } from '@xterm/addon-webgl';
// Full xterm.js implementation
```

### useVoyeurTerminal Hook - Optional Bridge

**Location:** `ui/src/hooks/useTerminalPane.ts:303-376`

**Purpose:** OPTIONAL helper to format voyeur events for terminal display

**Status:** Helper hook, NOT used by VoyeurPane

**Implementation:**
```typescript
// This hook formats events with ANSI colors
// FOR USE WITH TerminalPane IF someone wants terminal-style display
// VoyeurPane does NOT use this hook
```

---

## What Does NOT Exist

❌ Voyeur mode using xterm.js  
❌ VoyeurPane with terminal dependencies  
❌ xterm.js integration in voyeur code  
❌ Need to refactor voyeur away from terminal  
❌ Micro-VM canvas implementation  
❌ Terminal-based voyeur viewer  

---

## Audit Results: xterm.js Dependencies in Voyeur Code

**Command:** `ripgrep "xterm" ui/src/components/VoyeurPane/`

**Result:** **ZERO MATCHES**

```bash
# No xterm.js imports
# No terminal dependencies
# No terminal emulation code
```

**VoyeurPane Dependencies:**
```typescript
✅ React (hooks)
✅ VoyeurBusClient (SSE client)
✅ Design system components (Badge, Button, Input)
✅ CSS Modules
❌ xterm.js - NOT PRESENT
❌ TerminalService - NOT PRESENT
❌ Terminal emulation - NOT PRESENT
```

---

## Current Data Flow

```
Backend VoyeurBus (Port 8787)
    ↓ SSE Stream
VoyeurBusClient.ts (EventSource API)
    ↓ Event buffering
VoyeurContext.tsx (React Context)
    ↓ State management
VoyeurPane.tsx (Custom React Component)
    ↓ Event list UI
User sees events

NO xterm.js in this flow
NO terminal emulation in this flow
```

---

## Clarification Required

The engineer's request mentions:
> "refactor the voyeur mode implementation to utilize a lightweight event stream display component instead of the current xterm.js terminal integration"

**Status:** ✅ **ALREADY DONE**

VoyeurPane IS already:
- ✅ Lightweight event stream display
- ✅ No xterm.js integration
- ✅ Custom React component
- ✅ Efficient rendering
- ✅ Single responsibility (event display)
- ✅ Clean separation from event source

---

## Possible Interpretations

### Interpretation 1: Engineer Wants to Create Micro-VM Canvas (New Feature)
The request mentions creating a "micro-VM canvas specification" which is a **completely new feature** not related to refactoring voyeur.

**If this is the intent:**
- This is NEW architecture, not a refactor
- Requires separate specification document
- Should be Phase 3+ work, not Phase 2
- Estimated: 40-80 hours of work

### Interpretation 2: Engineer Confused About Current Architecture
The engineer may believe voyeur currently uses xterm.js when it doesn't.

**If this is the case:**
- No refactoring needed
- VoyeurPane already meets all requirements
- Can proceed with testing (Task 2.3)

### Interpretation 3: Engineer Wants Terminal-Style Voyeur (Use useVoyeurTerminal)
The engineer may want voyeur events displayed in an actual terminal.

**If this is the intent:**
- useVoyeurTerminal hook already exists
- Just need to wire it up to TerminalPane
- Estimated: 4-8 hours

---

## Recommended Next Steps

### Option A: Proceed with Phase 2 Testing (Recommended)
```
Task 2.3: Add comprehensive test coverage
Task 2.4: Accessibility improvements
Task 2.5: Security hardening
```

### Option B: Create Micro-VM Canvas Spec (New Feature)
```
Task 3.x: Micro-VM Canvas Architecture
- Specification document
- Component architecture
- Inter-component protocol
- Collaborative interaction model
Estimated: 40-80 hours
```

### Option C: Integrate Voyeur with Terminal (Optional)
```
Task 2.x: Terminal-based Voyeur Display
- Use useVoyeurTerminal hook
- Wire to TerminalPane
- Add terminal commands
Estimated: 4-8 hours
```

---

## Decision Needed

**Question for Engineer:**

1. **Is the current VoyeurPane implementation (lightweight event stream component) acceptable?**
   - If YES → Proceed with testing (Phase 2)
   - If NO → Please specify what's wrong with it

2. **Do you want a terminal-style display for voyeur events?**
   - If YES → Use existing useVoyeurTerminal hook with TerminalPane
   - If NO → Current VoyeurPane is correct

3. **Is the Micro-VM Canvas a new feature request for Phase 3+?**
   - If YES → Create specification document (separate from voyeur)
   - If NO → Please clarify the requirement

4. **Did you receive incorrect information about voyeur using xterm.js?**
   - The architecture review (docs/voyeur-architecture-review.md) clearly documents that VoyeurPane does NOT use xterm.js

---

## Summary

**Current State:**
- ✅ VoyeurPane exists
- ✅ Is lightweight event stream component
- ✅ No xterm.js dependencies
- ✅ Follows best practices
- ✅ Ready for testing

**Requested Action:**
- ❌ "Refactor voyeur from xterm.js" - NOTHING TO REFACTOR (voyeur never used xterm.js)

**Awaiting Clarification:**
- What specifically needs to be changed in VoyeurPane?
- Is Micro-VM Canvas a separate new feature?
- Should voyeur use terminal-style display?

---

**Status:** ⚠️ BLOCKED - Awaiting clarification on requirements

**Recommendation:** Review the actual implementation in `ui/src/components/VoyeurPane/` before proceeding with any refactoring that may not be necessary.
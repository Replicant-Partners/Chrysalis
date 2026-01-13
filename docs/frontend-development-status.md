# Chrysalis Frontend Development Status

**Last Updated**: January 13, 2026  
**Current Phase**: Building Three-Frame Five-Canvas UI  
**Status**: In Progress

---

## Executive Summary

Building the frontend UI according to **FRONTEND_THREE_FRAME_FIVE_CANVAS_SPEC.md**. The spec defines:
- **Three frames**: Navigation (left) | Canvas workspace (center) | Dual chat (right)
- **Five canvases**: Settings (fixed) + 4 flexible canvases with type switching
- **Dual chat**: Planning + Action chats in the right pane
- **Agent roster**: Display active agents (Ada, DGV, Milton, 25er, 85er)

---

## Critical Path Items

### ✅ Completed

**A. Canvas Tab Structure** (Left Frame Navigation)
- Created `CanvasNavigator` component
- 5 canvas tabs: Canvas 0 (Settings, fixed) + Canvases 1-4 (flexible)
- Type switcher dropdown for flexible canvases (board/scrapbook/storyboard/remixer/video/meme/custom)
- Agent roster section showing active agents with status indicators
- Collapsible sections for canvases and agents
- Integrated into App.tsx left pane

**Files Created/Modified:**
- `ui/src/components/CanvasNavigator/CanvasNavigator.tsx`
- `ui/src/components/CanvasNavigator/CanvasNavigator.module.css`
- `ui/src/components/CanvasNavigator/index.ts`
- `ui/src/App.tsx` (updated to use CanvasNavigator)

---

### 🔄 Next Steps (Critical Path)

**C. Settings Canvas** (Canvas 0 Content)
- Build Settings canvas UI for tab 0
- Provider status cards (OpenAI, ElevenLabs, RunwayML, etc.)
- Cloud registry dashboard (costs, counts, health)
- Voice provider chooser (ElevenLabs voice list)
- Runway widget package configuration
- Export config as JSON

**B. Dual Chat Pane** (Right Frame)
- Split right pane into Planning chat (top) + Action chat (bottom)
- Planning chat: 25er agent, creates Plan objects
- Action chat: DGV/Milton agents, executes actions with approval queue
- Proposed actions queue with approval buttons
- Voice controls (push-to-talk, playback, voice profile)

**Canvas Renderers** (Center Frame)
- Canvas 1: Scrapbook renderer (photo nodes, groups, tags)
- Canvas 2: Storyboard renderer (slides, transitions, voice annotations)
- Canvas 3: Remixer renderer (Runway widgets, transformation queue)
- Canvas 4: VideoBoard renderer (clips, timeline editor)

---

## Current Implementation Details

### Canvas State Management

```typescript
// 5 canvases initialized in App.tsx
const [canvases, setCanvases] = useState<CanvasTab[]>([
  { id: 'canvas-0', index: 0, type: 'settings', title: 'Settings', isFixed: true },
  { id: 'canvas-1', index: 1, type: 'scrapbook', title: 'Canvas 1', isFixed: false },
  { id: 'canvas-2', index: 2, type: 'storyboard', title: 'Canvas 2', isFixed: false },
  { id: 'canvas-3', index: 3, type: 'remixer', title: 'Canvas 3', isFixed: false },
  { id: 'canvas-4', index: 4, type: 'video', title: 'Canvas 4', isFixed: false },
]);
```

### Agent Roster

```typescript
// Active agents displayed in navigator
const [agents] = useState<Agent[]>([
  { id: 'ada', name: 'Ada Lovelace', role: 'Creative Coach', status: 'active' },
  { id: 'dgv', name: 'DGV', role: 'Action Executor', status: 'active' },
  { id: 'milton', name: 'Milton', role: 'Ops Guardian', status: 'idle' },
]);
```

### Canvas Type Options

Available types for flexible canvases:
- 📋 Board
- 📔 Scrapbook
- 🎬 Storyboard
- 🎨 Remixer
- 🎥 Video
- 😄 Meme
- ⚡ Custom Template

---

## Architecture Alignment

### Spec Compliance

| Spec Requirement | Status | Notes |
|------------------|--------|-------|
| Three-frame layout | ✅ | Using existing ThreeFrameLayout |
| Five canvases | ✅ | Tabs created, renderers pending |
| Canvas type switching | ✅ | Dropdown implemented |
| Settings canvas (fixed) | ✅ | Tab created, content pending |
| Agent roster | ✅ | Navigation section |
| Planning chat | ❌ | Next: Right pane split |
| Action chat | ❌ | Next: Right pane split |
| Canvas renderers | ❌ | Using JSONCanvas placeholder |

### Current UI Structure

```
App
├─ Header (status, Voyeur toggle)
├─ ThreeFrameLayout
│   ├─ CanvasNavigator (LEFT) ✅ NEW
│   │   ├─ Canvas Tabs (5)
│   │   ├─ Type Switchers (4 flexible)
│   │   └─ Agent Roster
│   ├─ Canvas Workspace (CENTER)
│   │   ├─ Canvas Title Header ✅ NEW
│   │   └─ JSONCanvas (placeholder)
│   └─ ChatPane (RIGHT)
│       └─ Single chat (needs split) ❌
└─ VoyeurPane Modal
```

---

## Technical Notes

### State Management
- Canvas tabs: Local state in App.tsx
- Active canvas selection: Local state
- Canvas type switching: Updates local canvas array
- Agent roster: Static for now (will connect to backend)
- YJS integration: Existing, not yet wired to new canvas system

### Styling Approach
- CSS Modules for component styles
- Design tokens from `ui/src/styles/tokens.css`
- Consistent with existing design system

---

## Next Session TODO

1. **Build Settings Canvas Content**
   - Provider status cards
   - Configuration forms
   - JSON export/import

2. **Split Right Chat Pane**
   - Planning chat (top half)
   - Action chat (bottom half)
   - Action approval queue

3. **Wire Canvas Switching**
   - Connect canvas selection to center pane
   - Implement canvas-specific renderers

---

## Related Documents

- Spec: `docs/FRONTEND_THREE_FRAME_FIVE_CANVAS_SPEC.md`
- UI README: `ui/README.md`
- Main Status: `docs/STATUS.md`
- Architecture: `docs/architecture/LLM_COMPLEXITY_ADAPTATION_PATTERN.md`
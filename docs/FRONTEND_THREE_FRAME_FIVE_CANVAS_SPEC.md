# GaryVision Front-End Enhancements Specification

**Title**: Three-frame UI + Five-canvas workspace + Planning/Action chat control plane

**Status**: Draft (ready for implementation)

**Audience**: Front-end engineers, API/backend engineers, product/UX, agent developers

**Source context**: This spec is grounded in the existing GaryVision repo abstractions:
1. Canvas types and metadata: `docs/CANVAS_TYPES.md`
2. Canvas interaction patterns: `docs/CANVAS_TYPES_INTERACTION_PATTERNS.md`
3. Widget packages: `config/canvas_widget_packages.json`
4. Cloud registry + fallback: `docs/CLOUD_SERVICES_QUICK_REFERENCE.md`
5. Agent specs: `config/agents/{ada_lov31ace,dgv,milton,25er,85er}.json`

---

## 1) Executive summary

We will enhance GaryVision with a **three-frame UI** that hosts **five canvases** (one fixed Settings/System configuration canvas + four flexible canvases) and a **dual-lane conversational control plane**:

- **Planning chat**: stabilizes intent and creates a Plan object.
- **Action chat**: executes tool-backed actions, requires approvals for risky operations.

The design reinforces the long-term GaryVision patterns:

- **Dual-lane interaction** (planning vs action) for safety and clarity.
- **Dual-existence artifacts** (canvas-local vs library/global) for creative workflows.
- **Provider registry + fallback chain** for resilience against provider churn.
- **Observability + auditable ops** (Milton guardrails) to prevent configuration drift.

---

## 2) Goals, non-goals, constraints

### Goals
1. Deliver a **three-frame UI** that remains stable while canvases and chats change.
2. Support exactly **five canvases**:
   - Canvas 0: **Settings/System configuration management** (fixed)
   - Canvases 1–4: **flexible** (type can be changed)
3. Support user interaction via **planning + action chats**, using text and/or voice.
4. Integrate existing provider features:
   - **ElevenLabs** voice annotation / voice profiles
   - **RunwayML widgets** in Remixer workflows
   - **Cloud tagging/enhancement** via registry with local fallback
5. Codify a **front-end “swarm” team** using system agents:
   - Ada_Lov31ace, DGV, Milton, 25er, 85er

### Non-goals
1. Building new provider implementations for LumaLabs/LumaAI or AITubo (not present in code). We will instead design **extension points** (registry JSON + widget packages).
2. Rewriting the entire front-end architecture. This spec proposes additive enhancements and new modules.

### Constraints
1. **Separation of planning vs action** must be preserved.
2. Settings/config changes must be **auditable, previewable, and reversible**.
3. The system must preserve elder-friendly UX constraints:
   - clear hierarchy
   - progressive disclosure
   - explicit confirmation for destructive actions

---

## 3) Fixed elements vs variable elements

### Fixed elements
- **Three frames** (left navigation, center workspace, right control plane)
- **Five canvases**
- **One settings canvas** dedicated to configuration management
- **Two chats**: Planning + Action

### Variable elements
- The canvas type for the 4 flexible canvases:
  - `board`, `scrapbook`, `storyboard`, `remixer`, `video`, `meme`, `custom_template`
- Which cloud providers are enabled (by keys + flags)
- Which widget packages are enabled per canvas type

---

## 4) Agent team composition (front-end swarm)

We organize the 5 agents into two cooperating teams.

### Team A: Canvas and Widget Integration

**Responsibilities**:
- canvas UX patterns, node rendering, type-specific tool panels
- Runway widget node creation/execution/status/result ingest in Remixer
- storyboard voice annotation integration

**Agents**:
- **Ada_Lov31ace (Lead)**: creative coach + canvas curator; owns canvas flow coherence.
- **DGV (Action executor)**: owns “do the thing” actions that touch media workflows.
- **85er (Gentle guide)**: ensures elder-optimized interaction patterns and continuity.

**Why this works (root cause check)**:
- Root cause: creative tools become overwhelming. Ada + 85er keep guidance supportive and bounded; DGV grounds actions in real tool capability.

### Team B: Conversation, Voice, and System Control

**Responsibilities**:
- planning/action chat routing, approvals, action ledger
- settings canvas semantics (feature flags, provider config presence, budgets)
- observability, safe ops, rollback guidance

**Agents**:
- **25er (Planning lane lead)**: Five Whys questioning; stabilizes intent.
- **Milton (Ops/config lead)**: safe config proposals, audits, rollback.
- **85er (User support)**: reduces anxiety, maintains preferences.

**Why this works (root cause check)**:
- Root cause: agentic UI failures come from mixing intent formation with execution and hiding operational state. Team B enforces separation + visibility.

---

## 5) Five canvases: definitions and integration contracts

### Canvas 0 (fixed): Settings/System configuration

**Type**: `settings`

**Key UI widgets** (from `docs/CANVAS_TYPES_INTERACTION_PATTERNS.md`):
- Provider status cards (enabled? key present?)
- Cloud registry dashboard (costs, counts, health)
- Voice provider chooser (ElevenLabs voice list)
- Runway widget package configuration
- Export config as JSON

**Backend integration** (contract-level; endpoints may already exist or be added behind current routers):
- `GET /api/v1/canvas/widget-packages` (exists per docs/STATUS.md)
- `GET /api/v1/voice/voices` (ElevenLabs voice profiles)
- `GET /api/v1/cloud/services` + `GET /api/v1/cloud/costs` (registry view)

**Primary agent**: Milton

---

### Canvas 1–4 (flexible): recommended default set

We recommend defaulting the four flexible canvases to:
1. **Scrapbook** (collections/collage)
2. **Storyboard** (narration, slides)
3. **Remixer** (transformations + Runway widgets)
4. **VideoBoard** (video editing/timeline assembly)

Users can switch any flexible canvas to other types.

---

### Canvas 1: Scrapbook / Collection

**Type**: `scrapbook`

**Contents**:
- photo nodes + group containers + tag nodes

**Provider integration**:
- Tagging pipeline results (cloud + local fallback)

**Agents**:
- 85er (gentle organization guidance)
- DGV (curation actions)

---

### Canvas 2: Storyboard with voice

**Type**: `storyboard`

**Contents**:
- slide sequence + transitions + text notes
- voice annotation nodes (audio blobs) + transcript (optional)

**Provider integration**:
- ElevenLabs (TTS + voice profiles)
- transcription provider (optional)

**Agents**:
- Ada_Lov31ace (narrative threading)
- 85er (memory coaching)

---

### Canvas 3: Remixer (Runway widget workspace)

**Type**: `remixer`

**Contents**:
- `runway_widget` nodes
- `runway_result` nodes
- transformation queue

**Provider integration**:
- RunwayML widgets (implemented in `backend/api/routes/runway_widgets.py`)
- cloud enhancement chain (cleanup/orient/upscale) via registry

**Agents**:
- Ada_Lov31ace (creative guidance)
- DGV (execute transformations)

---

### Canvas 4: VideoBoard

**Type**: `video` (or a dedicated VideoBoard flavor if implemented)

**Contents**:
- clip nodes
- timeline editor

**Provider integration**:
- Runway image-to-video (via widgets; VEO models appear in widget package enum)

**Agents**:
- Ada_Lov31ace (creative editing guidance)
- DGV (export + assembly actions)

---

## 6) Three-frame UI layout

### Frame 1 (Left): Navigation + roster

**Purpose**: reduce disorientation; expose “where am I?” and “who is speaking?”

Components:
- Canvas tabs list (Settings + 4 flexible)
- Canvas type selector per flexible canvas
- Active agent roster + lane indicator

### Frame 2 (Center): Active canvas workspace

Components:
- Canvas renderer
- Type-specific panels (templates/timeline/transformation params)

### Frame 3 (Right): Dual chat control plane

Components:
- Planning chat
- Action chat
- Proposed actions queue with approvals
- Voice controls (push-to-talk, playback, voice profile)

---

## 7) Planning + action chat interaction model

### Planning chat

**Primary agent**: 25er (with 85er/Ada/DGV as context helpers)

Output: a **Plan object** that is explicit, reviewable, and routable.

#### Plan object (JSON)
```json
{
  "id": "plan_2026_01_08_0001",
  "goal": "Create a narrated storyboard for the 1987 reunion",
  "selected_canvas_id": "canvas_2",
  "selected_canvas_type": "storyboard",
  "steps": [
    {"id": "step_1", "type": "select_photos", "count": 12},
    {"id": "step_2", "type": "arrange_sequence", "heuristic": "chronological"},
    {"id": "step_3", "type": "record_voice", "provider": "elevenlabs"},
    {"id": "step_4", "type": "export", "format": "video"}
  ],
  "required_services": ["elevenlabs"],
  "risks": ["voice provider not configured"],
  "requires_approval": true
}
```

### Action chat

**Primary agents**: DGV (media actions), Milton (ops/config changes)

Output: an **ActionResult** + artifacts added to canvas/library.

#### ActionResult object (JSON)
```json
{
  "action_id": "action_000123",
  "status": "completed",
  "artifacts": [
    {"kind": "canvas_node", "canvas_id": "canvas_3", "node_id": "runway_result_xyz"},
    {"kind": "library_asset", "asset_id": "video_abc"}
  ],
  "provider": "runwayml",
  "cost_usd": 0.024,
  "rollback": {
    "supported": true,
    "method": "remove_canvas_nodes",
    "notes": "Deleting nodes does not delete library asset without explicit confirmation"
  }
}
```

**Why this model works (root cause check)**:
- Root cause: users feel loss of control when the system “does things.” Plan + explicit approvals prevent that.

---

## 8) Technical architecture and state management

### Front-end state

Recommended store boundaries:
- `uiFrameState`: selected canvas, panel states
- `canvasState`: per-canvas nodes, selection, zoom/pan, history
- `chatState`: planning thread, action thread, proposed actions queue
- `providerState`: provider status, costs, availability, keys-present flags

### Suggested TypeScript types
```ts
export type CanvasType =
  | "settings"
  | "board"
  | "scrapbook"
  | "storyboard"
  | "remixer"
  | "video"
  | "meme"
  | "custom_template";

export interface GvMeta {
  canvas_id: string;
  title: string;
  canvas_type: CanvasType;
  user_id: string;
  created_at_ms: number;
  updated_at_ms: number;
  schema_version: number;
}

export type NodeKind =
  | "file"
  | "text"
  | "link"
  | "group"
  | "runway_widget"
  | "runway_result"
  | "voice_annotation";

export interface CanvasNode {
  id: string;
  type: NodeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  gv_ref?: {
    kind: "photo" | "video" | "audio";
    photo_id?: string;
    asset_id?: string;
  };
  gv_node_type?: NodeKind;
  // Remixer
  gv_widget_type?: string;
  gv_status?: "idle" | "queued" | "running" | "completed" | "error";
  gv_result_type?: "image" | "video" | "audio";
}
```



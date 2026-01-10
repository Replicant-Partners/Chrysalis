# Chrysalis Terminal - Complete Architecture Specification

## Vision

A **human-in-the-loop AI workbench** where you orchestrate teams of agents and human collaborators through an elegant three-frame interface with powerful hidden complexity.

## Core Philosophy

**"Clean Surface, Deep Power"**
- Minimal visible UI by default
- Rich features revealed through:
  - Slash commands (`/invite`, `/agent`, `/canvas`)
  - Emoji scripts (🤖 = agent, 👥 = invite, 📊 = chart)
  - Context menus (right-click)
  - Keyboard shortcuts (Cmd/Ctrl+K)
  - Voyeur mode (observability overlay)

**"Complexity Contained in Containers"**
- Two-pane constraint organizes cognitive load (not limiting, organizing)
- Simple surface (chat panes) prevents overload
- Canvas system enables unlimited complexity underneath
- Like Unix pipes: simple primitives, infinite composition

---

## Architecture Overview

### Three-Frame Layout

```
┌─────────────────────────────────────────────────────────┐
│  🦋 Chrysalis  │  Team A  │  🟢 Live  │  ⚙️ Config    │ Header
├──────────────┬────────────────────┬────────────────────┤
│              │                    │                    │
│  Left Chat   │   Center Canvas    │    Right Chat      │
│  (Team A)    │   (Shared Work)    │    (Team B)        │
│              │                    │                    │
│  👤 You      │   [Widgets]        │    👤 You          │
│  🤖 Agent 1  │   [Nodes]          │    🤖 Agent 3      │
│  👥 Partner  │   [Connections]    │    👥 Client       │
│              │                    │                    │
├──────────────┴────────────────────┴────────────────────┤
│  Metrics  │  Status  │  Voyeur 👁️  │  Canvas Tabs      │ Footer
└─────────────────────────────────────────────────────────┘
```

---

## Access Control Model

### You (Orchestrator)
- **Dual participant** in both chat sessions simultaneously
- Each chat = workflow you're managing with your agent team
- Full control of both chat panes (can message in either)
- Full control of visible canvas
- Can observe invisible canvases (Voyeur mode - observation only)
- Configures "Inside Agents" (your agents)
- Invites external participants
- Manages team selection (swap which teams occupy left/right)

### Inside Agents (Your Agents)

**Definition:** Agents that run within this Terminal instance.

**Key Characteristics:**
- **Execution Context:** Run in this Terminal's compute session
- **High Trust:** Full observability and traceability
- **Shared Resources:** Use Terminal's API keys
- **@mention Override:** Direct requests override read restrictions

Configurable per agent:
```json
{
  "agent_id": "alpha-01",
  "name": "Agent Alpha",
  "avatar": "🤖",
  "role": "data-analyst",
  "access": {
    "left_chat": { "read": true, "write": true },
    "right_chat": { "read": false, "write": false },
    "visible_canvas": { "read": true, "write": true },
    "invisible_canvases": ["data-processing", "analysis"]
  },
  "llm_connection": {
    "provider": "openai",
    "model": "gpt-4",
    "api_key_ref": "user_openai_key_1"
  }
}
```

### External Participants (Invited)

**Definition:** Humans or agents running outside this Terminal.

**Examples:** Serean (OraiOS), Claude, Codex, ElizaOS agents

**Characteristics:**
- Run in different compute/session
- Lower trust (limited visibility)
- Own credentials
- Must be invited to chat first
- Stricter permission boundaries

**Access:**
- Limited to assigned chat only
- No canvas access (unless explicitly shared)
- Cannot see other chats
- Can be humans or external AI agents

---

## Avatar System

### Avatar Types

**1. User Avatars**
- Photo upload (jpg/png)
- Generated avatar (Pravatar.cc)
- Custom emoji (🧑‍💼, 👨‍💻, 👩‍🎨)
- Gradient badge with initials

**2. Inside Agent Avatars**
- Predefined emoji (🤖, 🦋, 🧠, 🎯, 🔮)
- Noto Emoji set (consistent across platforms)
- Fluent Emoji (optional Microsoft style)
- Open Emoji (optional Mozilla style)
- Custom SVG icons
- Gradient backgrounds per agent personality

**3. External Participant Avatars**
- Same as user avatars
- Badge indicator showing external status

### Avatar Curation UI

Located in: **Settings → Appearance → Avatars**

```
┌─────────────────────────────────────────┐
│  Avatar Gallery                         │
├─────────────────────────────────────────┤
│  🤖 Robot (Noto)    🦋 Butterfly        │
│  🧠 Brain           🎯 Target            │
│  🔮 Crystal Ball    🚀 Rocket            │
│  ✨ Sparkles        🌟 Star              │
│                                         │
│  [Upload Custom]  [Generate Random]     │
│                                         │
│  Avatar Style: ◉ Noto  ○ Fluent  ○ Open│
└─────────────────────────────────────────┘
```

---

## Emoji Command Language

### Concept

**Word-to-emoji transpose for system commands** - makes CLI fun and tablet-friendly.

**Status:** Logical concept defined; technical specification in progress.

### Grammar

```
🤖 → /agent          (agent operations)
👥 → /invite         (invite people)
📊 → /chart          (create chart)
🎨 → /canvas         (canvas operations)
🔍 → /search         (search)
💬 → /message        (send message)
⚙️ → /config         (settings)
👁️ → /voyeur         (observability)
📎 → /attach         (attach file)
🎭 → /invisible      (invisible canvas)
```

### Composition

Emoji commands can be chained:
```
🤖+📊          → Ask agent to create chart
👥+💬+@john    → Invite John to chat
🎨+🎭          → Switch to invisible canvas
```

### Custom Mappings

Users can create custom emoji → command mappings:

```json
{
  "custom_emoji_commands": {
    "🔥": "/deploy production",
    "⏸️": "/pause all agents",
    "▶️": "/resume all agents",
    "🎬": "/record session",
    "📸": "/screenshot canvas",
    "🗑️": "/clear chat"
  }
}
```

### Emoji Editor UI

Located in: **Settings → Commands → Emoji Scripts**

```
┌──────────────────────────────────────────────┐
│  Emoji Command Editor                        │
├──────────────────────────────────────────────┤
│  🤖  →  /agent [action]                      │
│  👥  →  /invite @username                    │
│  📊  →  /chart [type]                        │
│                                              │
│  Custom Mappings:                            │
│  🔥  →  [/deploy production          ]  [x]  │
│  ⏸️  →  [/pause all agents           ]  [x]  │
│                                              │
│  [+ Add Custom Mapping]                      │
│                                              │
│  💡 Tip: Use emoji picker (Cmd+Ctrl+Space)  │
└──────────────────────────────────────────────┘
```

---

## Canvas System

### Canvas Architecture

**Canvas = JSONCanvas + Extensions**
- Base: JSONCanvas file (jsoncanvas.org)
- **One visible canvas at a time** (anti-clutter)
- **Infinite invisible canvases** for background work
- **Visibility = boolean property** - any canvas can toggle
- Each canvas = one YJS room (collaboration boundary)

### System Service Canvases (NEW)

**Always-running invisible canvases providing core functionality:**

**Settings Canvas** - Bootstrap dependency, acts like .env file  
**Contacts/Teams Canvas** - Contact management, bulk invites  
**Agent Registry Canvas** - Inside Agent definitions

### Canvas Types

**Types = Templates, Not Constraints**

Each canvas type has **strict accept/reject rules** for drag-and-drop:

```typescript
interface CanvasType {
  type: 'agent' | 'media' | 'data' | 'document' | 'general';
  accepts: string[];  // MIME types or file extensions
  rejects: string[];  // Explicit rejections
  widgets: string[];  // Allowed widget types
}
```

**1. Agent Canvas**
- Accepts: `.agent`, `.json` (agent definitions), agent widgets
- Rejects: Everything else
- Visual feedback: Bounce animation on reject

**2. Media Canvas**
- Accepts: `.mp4`, `.mp3`, `.png`, `.jpg`, `.gif`, `.wav`
- Accepts widgets: RunwayML, ElevenLabs, Stability AI
- Rejects: Non-media files

**3. Data Canvas**
- Accepts: `.csv`, `.json`, `.parquet`, `.db`
- Accepts widgets: Pandas, Jupyter, SQL tools
- Rejects: Media files

**4. Document Canvas**
- Accepts: `.md`, `.txt`, `.pdf`, `.doc`, `.docx`
- Accepts widgets: Editor, PDF viewer
- Rejects: Binary files

**5. General Canvas** (Default)
- Accepts: All file types
- Accepts: All widget types
- No rejections

### Visible vs Invisible Canvases

**Visible Canvas** (Center pane)
- Only one visible at a time
- Shows nodes, edges, widgets
- User can interact directly

**Invisible Canvases** (Background)
- Agents work in parallel
- User can observe via Voyeur mode
- Any canvas can toggle visible/invisible
- Fully functional when invisible

### Canvas Tabs

```
┌─────────────────────────────────────────────┐
│  📋 Main  │  🎭 Task-01  │  🧠 Analysis  │ + │
└─────────────────────────────────────────────┘
           Active      Invisible  Invisible   New
```

---

## Voyeur Mode (Observability)

### Purpose & Philosophy

**Pure Observation, Zero Control**
- Terminal window into agent internal processes
- Real-time observability while interaction continues
- NO intervention (no pause/stop/edit buttons)
- Human orchestrator only (not for agents)

### Activation
- Keyboard: `Cmd/Ctrl + Shift + V`
- Emoji: `👁️`
- Footer button: `Voyeur 👁️`
- Command: `/voyeur on`

### Voyeur Overlay

```
┌─────────────────────────────────────────────┐
│  👁️ Voyeur Mode Active                      │
├─────────────────────────────────────────────┤
│  Agent Alpha (analysis-canvas-1)            │
│  ├─ 🔄 Processing dataset.csv               │
│  ├─ 📊 Generating chart...                  │
│  └─ ⏱️  2.3s elapsed                         │
│                                             │
│  Agent Beta (research-canvas-2)             │
│  ├─ 🔍 Searching documentation              │
│  └─ ⏱️  5.1s elapsed                         │
│                                             │
│  [Hide Voyeur] [Switch Stream]             │
└─────────────────────────────────────────────┘
```

Uses existing `VoyeurBus` event system:
```typescript
voyeurBus.emit('agent.progress', {
  agentId: 'alpha-01',
  canvasId: 'analysis-canvas-1',
  status: 'processing',
  message: 'Processing dataset.csv'
});
```

---

## Chat Features

### Slash Commands

```
/invite @username          → Invite to current chat
/invite @username left     → Invite to left chat
/invite @username right    → Invite to right chat

/agent create             → Create new inside agent
/agent config alpha-01    → Configure agent
/agent start alpha-01     → Start agent
/agent stop alpha-01      → Stop agent

/canvas new media         → Create new media canvas
/canvas switch task-01    → Switch to canvas
/canvas share left        → Share current canvas with left chat

/voyeur on                → Enable Voyeur mode
/voyeur agent alpha-01    → Watch specific agent
```

### @-Mentions

```
@username    → Mention user
@agent-01    → Mention agent
@*           → Mention all (left or right chat)
```

### Message Input Features

- **Emoji picker**: Quick access to emoji command shortcuts
- **File attachments**: Drag into chat or click attach button
- **Code blocks**: Markdown support with syntax highlighting
- **Voice input**: Record audio messages
- **Canvas references**: Link to canvas nodes

---

## Implementation Roadmap

### Phase 1: Foundation (Current)
- [x] Design system (tokens, components)
- [x] Three-frame layout
- [ ] Settings Canvas (API keys, LLM configs)
- [ ] Contacts/Teams Canvas (contact mgmt, bulk invites)

### Phase 2: Avatar & Identity
- [ ] Avatar gallery and editor
- [ ] User avatar upload/generation
- [ ] Agent avatar assignment
- [ ] Avatar display in chats

### Phase 3: Emoji Command System
- [ ] Emoji → command parser
- [ ] Custom emoji mapping editor
- [ ] Emoji picker integration
- [ ] Command execution pipeline

### Phase 4: Access Control
- [ ] Inside agent configuration UI
- [ ] Permission management
- [ ] Invite system
- [ ] External participant view restrictions

### Phase 5: Canvas System
- [ ] Canvas type definitions
- [ ] Drag-and-drop with type validation
- [ ] Bounce/reject animations
- [ ] Invisible canvas management
- [ ] Canvas tabs

### Phase 6: Voyeur Mode
- [ ] Voyeur overlay UI (observation-only)
- [ ] VoyeurBus event integration
- [ ] Agent internal process streaming
- [ ] Stream switching (observe different agents)

### Phase 7: Chat Enhancement
- [ ] Slash command parser
- [ ] @-mention system
- [ ] File attachment handling
- [ ] Voice input (leveraging existing voice system)

---

## Technical Stack

```json
{
  "framework": "Vite + React 18 + TypeScript",
  "state": "Zustand (user settings) + YJS (collaborative)",
  "sync": "y-websocket (one room per canvas)",
  "canvas": "JSONCanvas + extensions",
  "styling": "Vanilla CSS + Design Tokens",
  "icons": "Font Awesome + User-selected emoji (Noto/Fluent/Open)",
  "backend": "Node.js 18+ / Python 3.10+",
  "memory": "Chrysalis Memory System",
  "versioning": "Checkpoint system for rollback"
}
```

---

## Next Steps

**Immediate Priority**: System Service Canvases (Phase 1)

**Settings Canvas** - API keys, LLM configs, system prefs  
**Contacts/Teams Canvas** - Contact mgmt, bulk invites, notifications  
**Agent Registry Canvas** - Inside Agent configs, roles, permissions

Once System Service Canvases are complete, Terminal can initialize and agents can connect.

---

## Related Documentation

- [Complete Clarifications](./ARCHITECTURE_CLARIFICATIONS_COMPLETE.md) - Detailed Q&A (Jan 10, 2026)

---

**Version**: 1.1.0  
**Last Updated**: January 10, 2026  
**Status**: Architecture Specification (Updated with Clarifications)
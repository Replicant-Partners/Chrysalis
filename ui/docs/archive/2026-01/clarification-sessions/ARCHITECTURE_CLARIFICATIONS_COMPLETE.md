# Chrysalis Terminal Architecture - Complete Clarifications
**Date:** January 10, 2026  
**Status:** Complete  
**Purpose:** Comprehensive Q&A session results to resolve architecture ambiguities

---

## Executive Summary

This document captures critical architectural clarifications that refine and extend the original Chrysalis Terminal specification. Key insights include the discovery of System Service Canvases, clarification of Inside/Outside agent boundaries, and the philosophy of "complexity contained in containers."

---

## Major Architectural Clarifications

### 1. Chat System & Team Management

**Original Ambiguity:** Unclear if "Team A/B" were just labels or formal entities.

**Clarification:**
- **Chat pane labels** are customizable display names (can rename to anything)
- **Persistent teams** can be defined (30+ teams possible)
- **UI constraint:** Maximum 2 teams active simultaneously (left/right panes)
- **Design intent:** Two-pane limit maintains focus and prevents cognitive overload
- **Team switching:** User can swap which teams occupy left/right from larger roster

**New Requirement Discovered: Contact Management System**
- Lightweight contact/group management integrated into Terminal
- Stores contact info (email, phone, notification preferences)
- Group/team memberships for bulk operations
- **Bulk invites:** `/invite @team-design` invites entire group at once
- **Notification integration:** Email/text alerts for chat start, invites, mentions
- Prevents forgetting members or name typos during invitations

**Human as Dual Participant:**
- Human participates in **both chat sessions simultaneously**
- Each chat = **workflow** human is managing
- Inside agents + canvas = **team** serving both workflows
- Simple surface (two panes) organizes underlying complexity

---

### 2. System Service Canvas Pattern (NEW)

**Discovery:** Contact Management revealed a fundamental architectural pattern.

**Pattern Definition:**
System Service Canvases are special canvases that:
- **Always-running invisible** (provide background services)
- **System-provided defaults** (lightweight, minimalist implementations)
- **Pluggable architecture** (users can connect external services)
- **LLM-managed connectors** (handle integration and disambiguation)
- **Occasionally visible** (when user needs to configure/edit)

**Examples:**
- 📇 **Contacts/Teams Canvas** - contact management, group definitions
- 🔑 **Settings Canvas** - acts like .env file, stores API keys, LLM configs, system preferences
- 🤖 **Agent Registry Canvas** - Inside Agent definitions and configurations
- ⚙️ **System Preferences Canvas** - UI settings, theme, layout preferences

**Critical Insight:** Settings Canvas is **required for startup** (bootstrap dependency). Without it, Terminal cannot initialize. This explains why it's Phase 1 priority.

---

### 3. Canvas Architecture Deep Dive

**Canvas = React Flow + Extensions**

**Core Principles:**
- Canvas = React Flow (reactflow.dev)
- **One visible canvas at a time** in center pane (anti-clutter system constraint)
- **Infinite invisible canvases** for background services/agent work
- All specialized features implemented as **canvases with widgets**
- **Simple, infinitely iterative pattern**

**Canvas Types = Templates, Not Constraints:**
- Built-in types (agent, media, data, document, general) provide **starting points**
- Each type = React Flow nodes + container characteristics + security rules
- **Extensible:** Users/LLMs can create custom canvas types
- **AI-First Design:** Common protocols for easy LLM manipulation
- Types are about **configurable behavior patterns**, not rigid categories

**Visibility Property:**
- Visibility is a **simple boolean property** (`visible: true/false`)
- **Any canvas can toggle** between visible/invisible
- Invisible canvases remain **fully functional** as JSON containers
- **Universal property** across all canvas types
- Elegant simplicity: one logical structure for all containers

**React Flow Implementation:**
- **Base:** React Flow library
- **Extensions:** Custom node types for Terminal-specific features
  - Widget nodes
  - Agent nodes  
  - System service nodes
- **Modular design:** Define extension patterns systematically
- React Flow nodes with custom agent rendering and Terminal capabilities

**Permission Model:**
- **Canvas-specific:** Each canvas defines its own permission requirements
- **Not generalized:** Don't create universal permission templates
- **Based on purpose:** Security needs vary by canvas type and usage
- **Critical for invisible canvases:** Easy to forget, need explicit tracking
- Voyeur mode becomes important for invisible canvas auditing

---

### 4. Canvas Sharing & Collaboration

**Three Distinct Sharing Paradigms:**

**Mode 1: Static Export/Email**
- Canvas as file attachment
- Snapshot, no synchronization
- Recipient gets independent copy
- Simple distribution

**Mode 2: Live Collaboration Invitation**
- Invite to work on **same canvas instance**
- Single source of truth
- Traditional real-time collaboration
- Trust-based access model

**Mode 3: Distributed CRDT Sync**
- Canvas type has YJS built-in
- Multiple nodes with eventual consistency
- Email = invitation (canvas handles sync automatically)
- Separate but synchronized versions

**Access Philosophy:**
- ✅ **Anyone in canvas = full edit rights** (no read-only modes)
- ✅ **Trust over restrictions** (aligns with Inside Agent philosophy)
- ✅ **Checkpoint system** for rollback (similar to AI coding agents)
- ❌ No granular permission games
- Safety through versioning, not restrictions

**Collaboration Architecture:**
- **Each canvas = one YJS room** (canvas = collaboration boundary)
- **Separate canvases = separate sync scopes**
- **Three panes = three separate containers** (different entities can inhabit each)
- **Chat = lightweight** (just messaging, minimal integration needed)
- **Canvas sharing = trust required** (checkpoint-based safety)

**Team Management Pattern:**
- **External agent teams** → Separate canvas per team
- Each team canvas = isolated collaboration space
- Canvas provides both **workspace AND sync boundary** simultaneously
- Elegant: one abstraction handles visual work + collaboration scope

---

### 5. Inside vs Outside Agents

**Fundamental Distinction: Execution Context**

**Inside Agents:**
- **Run within this Terminal instance**
- Spawned from a canvas (visible or invisible)
- **High trust level** (full observability, traceability)
- **Share Terminal's API keys** ("garden watering" model)
- **Stronger guardrails** available due to control
- **Default: sharing and trust**

**Outside/External Agents:**
- **Run elsewhere** (different session/compute container)
- Examples: Serean (OraiOS), Claude, Codex, ElizaOS agents
- **Lower default trust** (limited visibility)
- **Use own credentials** (separate API access)
- **Restricted permissions** by default

**Key Insights:**
- ❌ NOT about who configured the agent
- ❌ NOT about capabilities (those are separate permissions)
- ✅ IS about **where agent executes** and **what compute governs it**

**Agent Instances vs Types:**
- ❌ **No migration during session** (execution context is session-bound)
- ✅ **Same agent type can have multiple instances:**
  - "Kombai-Internal" (Inside Agent, your Terminal)
  - "Kombai-External" (Outside Agent, different session)
- Different instances = different execution contexts = different status/trust
- UI needs visual distinction (badges, labels, indicators)

**Strategic Vision:**
🎯 **Chrysalis Terminal as A2A (Agent-to-Agent) Platform**
- High-trust internal collaboration (Inside Agents)
- Fast external agent connectivity (Outside Agents)
- Faster-than-human agent-to-agent communication
- Simultaneous high-trust internal mode + connected external collaboration

---

### 6. Agent Engagement & Permissions

**Engagement Model:**
- **Role-defined activation:** Each agent has role that triggers autonomous activity
- **Direct addressing:** Agent responds when @mentioned or explicitly tasked
- Not about emoji targeting; about role scope and explicit requests

**Permission Override Rules:**

**Inside Agents:**
- ✅ **@mention overrides read restrictions**
- Direct request grants temporary access
- Being specifically requested > chat blocking
- Flexible, trust-based model

**External Agents:**
- ❌ **Must be invited to chat first** (can't @mention if not in chat)
- ✅ **If blocked, invitation fails** with clear feedback:
  - "This agent is blocked from this chat. Contact [orchestrator] to change permissions."
- Stricter boundaries than Inside agents
- Enforced separation for security

---

### 7. Voyeur Mode (Observability Layer)

**Purpose & Philosophy:**

**Voyeur = Pure Observation, Zero Control**
- ❌ NO intervention capability (no pause/stop/edit buttons)
- ❌ NO agent control from Voyeur interface
- ✅ **Pure passive observation** - watching agents work
- ✅ **Terminal window into agent's internal processes**
- ✅ **Real-time observability** while normal interaction continues

**Use Cases:**
- 🔍 **Debugging/Security:** Transparency into agent activities
- 📚 **Learning tool:** Understand how your agents work
- 🎮 **Entertainment potential:** "Twitch for AI agents" (ride-along experience)
- 🔬 **Live debugging:** See agent's internal reasoning while you interact with it

**Access Control:**
- ✅ **Human orchestrator only**
- ❌ Not available to agents (Inside or External)
- Philosophy: Build human understanding of agent behavior

**Interaction Model:**
- ✅ **Normal interaction continues** - can still @mention, assign tasks, etc.
- ✅ **Voyeur shows internal processing** - see how agent handles your requests
- ✅ **Real-time stream** of agent thoughts/decisions/tool calls
- ❌ Not about disabling normal communication

**Example Workflow:**
1. Enter Voyeur mode
2. @mention Agent Alpha: "Analyze this data"
3. In chat: normal interaction occurs
4. In Voyeur overlay: see Alpha's internal reasoning, tool calls, decisions

**Design Note:** Original architecture doc showing `[Pause All] [Stop All]` buttons contradicts true voyeurism. **Remove control buttons from Voyeur interface.**

**Psychological Design:**
- Research assignment: Literature on voyeurism UX patterns
- Design for the psychology of observation
- Thrill comes from lack of control ("fly on the wall")
- Entertainment value in passive watching

---

### 8. Emoji Command System

**Core Concept:**
- **Word-to-emoji transpose** for system commands
- 🤖 = `/agent`, 👥 = `/invite`, 📊 = `/chart`, etc.
- **Avatars double as emoji identifiers** (agent emoji = that agent)
- **Fun, tablet-friendly command line interface**
- Makes CLI accessible and enjoyable

**Implementation Status:**
- **Not yet technically specified** (room for design iteration)
- Needs emoji vocabulary mapping system
- Context-sensitive emoji keyboard on tablets/iPads
- Logical idea: direct transpose of words to emojis

**Tablet/Mobile UX:**
- Popup emoji keyboard with command vocabulary
- Shows emoji + corresponding command text
- Context-aware suggestions
- Makes command line fun and accessible on touch devices

**Icon/Emoji Library:**
- **User selects preferred library** (Noto OR Fluent OR Open)
- Settings panel: Choose emoji style
- Consistency across Terminal with selected library
- Future implementation detail

---

### 9. State Management Architecture

**Zustand vs YJS Split:**

**Initial Strategy (Pragmatic Approach):**
- **Zustand:** User-specific settings
  - Theme preferences
  - Layout configuration
  - Personal UI state
- **YJS:** Shared collaborative data
  - Canvas content
  - Chat messages
  - Team state

**Design Bias:**
- Prefer CRDT/YJS where possible for collaboration benefits
- Balance needed for control and manageability
- **Philosophy:** Learn from what works for users

**Decision:** Flexible architecture, iterate based on real-world needs

**Collaboration Sync:**
- **Each canvas = one YJS room**
- Separate canvases = separate sync scopes
- External participants connect to appropriate YJS rooms
- Canvas abstraction handles sync boundary

---

## Design Philosophy Synthesis

### "Complexity Contained in Containers"

The two-pane constraint isn't limiting - it's **organizing**:
- **Simple surface** (two chat panes) prevents cognitive overload
- **Canvas system** enables unlimited complexity underneath
- Complexity explodes into canvas types and instances
- Containers maintain boundaries and organization

**Like Unix Pipes:**
- Simple primitives
- Infinite composition
- Power through combination, not individual complexity

### "Clean Surface, Deep Power"

- Minimal visible UI by default
- Rich features revealed through:
  - Slash commands
  - Emoji scripts
  - Context menus
  - Keyboard shortcuts
  - Voyeur mode
- Users discover depth as needed
- Progressive disclosure of capability

### Trust-Based Design

- **Inside realm:** High trust, sharing, flexibility
- **Outside realm:** Controlled, explicit permissions
- **Canvas participants:** Full trust with checkpoint safety
- **Voyeur mode:** Complete transparency for human orchestrator

---

## Implementation Impact

### Updates Required to Architecture Spec

1. **Add System Service Canvas section**
   - Define pattern clearly
   - List current system canvases
   - Explain bootstrap dependencies

2. **Clarify Canvas Sharing Modes**
   - Three distinct paradigms
   - When to use each mode
   - Technical implementation notes

3. **Revise Voyeur Mode**
   - Remove control buttons from mockup
   - Emphasize pure observation
   - Add psychological design notes

4. **Expand Inside/Outside Agent section**
   - Execution context definition
   - Instance vs type distinction
   - A2A platform vision

5. **Add Contact Management**
   - System canvas description
   - Bulk invite feature
   - Notification integration

### New Components Needed

**System Service Canvases:**
- Settings Canvas (bootstrap)
- Contacts/Teams Canvas
- Agent Registry Canvas

**UI Components:**
- Team selector/switcher in header
- Voyeur mode overlay (observation-only)
- Canvas checkpoint/rollback UI
- Emoji command palette (tablet-optimized)

**Backend Services:**
- YJS room management per canvas
- Notification service (email/text)
- LLM-managed connector system
- Checkpoint versioning system

---

## Open Design Questions

### Requires Further Specification

1. **Canvas Sharing Command Disambiguation**
   - How to distinguish export vs invite vs CRDT modes
   - Suggested: `/canvas export`, `/canvas invite`, `/canvas sync`
   - Or: Canvas type determines available modes

2. **Emoji Command Parser Grammar**
   - Exact syntax for composition
   - Execution timing (immediate vs on Enter)
   - Context-aware vocabulary system

3. **Checkpoint System Details**
   - Automatic vs manual checkpoints
   - Retention policy
   - Recovery workflow UI

4. **External Service Connector Protocol**
   - LLM-managed disambiguation specification
   - Adapter interface for pluggable services
   - Contact management external service examples

---

## Session Insights

### Methodology Success

The one-question-at-a-time approach revealed:
- **Hidden requirements** (Contact Management system)
- **New patterns** (System Service Canvases)
- **Philosophical clarity** ("Complexity in Containers")
- **Contradictions** (Voyeur control buttons)

### Key Discoveries

1. **Canvas as Universal Abstraction**
   - Not just visual workspace
   - Collaboration boundary
   - Sync scope
   - Permission container
   - Configuration storage

2. **Execution Context Defines Trust**
   - Inside/Outside based on compute location
   - Session-bound boundaries
   - Different trust models for different contexts

3. **Two-Pane Constraint as Feature**
   - Not limitation but organization principle
   - Manages cognitive load
   - Enables infinite complexity in containers

---

**Version:** 1.0.0  
**Last Updated:** January 10, 2026  
**Status:** Complete - Ready for Architecture Spec Update
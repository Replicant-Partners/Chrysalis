# 48-Hour Integration Sprint Plan

**Start Date**: January 17, 2026
**Goal**: Connect all pieces end-to-end so we can "see how it moves and shakes"

---

## Current State Assessment

### ✅ What Works (After Quick Fixes)

| Component | Status | Notes |
|-----------|--------|-------|
| **Go Gateway** | ✅ Builds | Fixed `multi_provider.go` loop variable |
| **Python Universal Adapter** | ✅ Imports | Full state machine with Mermaid flow graphs |
| **Python Memory System** | ✅ Imports | FusionRetriever, Beads, Fireproof |
| **System Agent Configs** | ✅ Exist | Ada, Lea, Phil, David, **Milton** (Ops Caretaker) |
| **UI Components** | ✅ Exist | ChrysalisWorkspace, ChatPane, AgentCanvas |
| **GatewayLLMClient (TS)** | ✅ Works | HTTP bridge to Go gateway |

### ⚠️ What's Broken/Disconnected

| Gap | Issue | Priority |
|-----|-------|----------|
| **TypeScript Build** | ~19 errors (missing modules, imports) | P0 - blocks everything |
| **Two Universal Adapters** | Python (complete) vs TS (protocol translation stub) | P1 - pick one |
| **Memory TS↔Python** | Parallel implementations don't talk | P2 |
| **System Agents → LLM** | Works with `mockMode`, needs real gateway | P1 |
| **Canvas → Execution** | Visual only, doesn't run tasks | P2 |
| **Milton** | Config exists but no responsibilities defined | P1 |

---

## The Five System Agents

| Agent | Role | Inspired By | Key Responsibility |
|-------|------|-------------|-------------------|
| **Ada** | Algorithmic Architect | Ada Lovelace | Structural analysis, pattern recognition |
| **Lea** | Implementation Reviewer | (Learning) | Code review, documentation quality |
| **Phil** | Forecast Analyst | Phil Tetlock | Probability calibration, prediction tracking |
| **David** | Metacognitive Guardian | David Dunning | Bias detection, overconfidence monitoring |
| **Milton** | Ops Caretaker | Milton Waddams (Office Space) | Telemetry, maintenance, the stuff nobody notices until it breaks |

### Milton's Personality (Office Space Style)

> "I was told there would be metrics... And I could set the building on fire."

Milton monitors the hidden complexity between user-facing abstractions and infrastructure:
- **Telemetry & Benchmarks**: Watches performance drift nobody else notices
- **Maintenance Advisor**: Proposes safe, bounded changes with rollback plans
- **Five Whys Analysis**: Gets to root causes methodically
- **Guardrails**: Won't touch secrets, won't ingest raw data
- **Escalation**: Hands off to other agents when outside ops scope

---

## 48-Hour Sprint Schedule

### Phase 1: Foundation (Hours 0-8) - Friday Evening/Night

**Goal**: Everything compiles/imports, gateway runs

| Task | Owner | Est. Time |
|------|-------|-----------|
| Fix TypeScript build errors | Claude | 2h |
| Test Go Gateway with Ollama | You | 1h |
| Verify Python Universal Adapter runs a simple task | Claude | 1h |
| Document which adapter (Python vs TS) handles what | Both | 1h |
| Quick test: TS → Gateway → Ollama → Response | Both | 1h |

**Checkpoint**: Can run `curl localhost:8080/v1/chat` and get a response

### Phase 2: System Agents Live (Hours 8-20) - Saturday Day

**Goal**: System agents talk to real LLMs through gateway

| Task | Owner | Est. Time |
|------|-------|-----------|
| Start System Agent API server (`run-system-agents-server.ts`) | You | 30m |
| Verify Ada/Lea/Phil/David configs load correctly | Claude | 1h |
| **Spec Milton's responsibilities in detail** | Both | 2h |
| Create Milton's prompt templates | Claude | 1h |
| Test: `@ada analyze this code` → real response | Both | 1h |
| Add Milton to routing_config.json | Claude | 30m |

**Checkpoint**: `curl /api/agents/chat -d '{"message": "@ada hello"}'` returns real LLM response

### Phase 3: Canvas Specification (Hours 20-32) - Saturday Night/Sunday Morning

**Goal**: Define what the canvases DO (not just look like)

| Task | Owner | Est. Time |
|------|-------|-----------|
| **Spec "Commons" canvas** - shared workspace, agent visualization | Both | 2h |
| **Spec "Scratch" canvas** - individual workspace | Both | 1h |
| Define canvas ↔ agent execution bridge | Claude | 2h |
| Create canvas action types (drop file, run task, etc.) | Claude | 2h |
| Wire canvas state to YJS for collaboration | You | 2h |

**Deliverable**: `docs/specs/CANVAS_SPECIFICATION.md`

### Phase 4: Memory Bridge (Hours 32-40) - Sunday Afternoon

**Goal**: Agents remember things across sessions

| Task | Owner | Est. Time |
|------|-------|-----------|
| Define which memory system is authoritative (Python FusionRetriever) | Both | 30m |
| Create Python memory HTTP API (FastAPI) | Claude | 2h |
| Wire TS AgentMemoryAdapter to call Python API | Claude | 2h |
| Test: Agent recalls previous conversation | Both | 1h |

**Checkpoint**: Chat with Ada, restart server, Ada remembers context

### Phase 5: End-to-End Demo (Hours 40-48) - Sunday Evening

**Goal**: Show the system working as a whole

| Task | Owner | Est. Time |
|------|-------|-----------|
| Create demo script that exercises all agents | Both | 2h |
| Run full flow: User → UI → Agent → Gateway → LLM → Memory → Response | Both | 1h |
| Document what works and what's still TODO | Claude | 1h |
| Record demo video or screenshots | You | 1h |

**Deliverable**: Working demo + `DEMO_RESULTS.md`

---

## Decision Points We'll Need to Make

### 1. Universal Adapter: Python or TypeScript?

**Recommendation**:
- **Python** for task orchestration (Mermaid flow graphs, full state machine)
- **TypeScript** for protocol translation (agent schema conversion)

They're complementary, not competing.

### 2. Memory: Who's the Source of Truth?

**Recommendation**: Python `FusionRetriever` is authoritative
- TS `AgentMemoryAdapter` becomes a thin client
- HTTP bridge between them

### 3. How Do Canvases Execute Tasks?

**Options**:
a) Canvas → WebSocket → Python Universal Adapter
b) Canvas → REST API → Go Gateway → Agent routing
c) Canvas just visualizes, CLI/chat executes

**Recommendation**: Start with (c), iterate to (a)

---

## Files We'll Create/Modify

### New Files
- `docs/specs/CANVAS_SPECIFICATION.md`
- `docs/specs/SYSTEM_AGENT_RESPONSIBILITIES.md`
- `Agents/system-agents/prompts/milton_prompts.json`
- `memory_system/http_api.py` (FastAPI bridge)
- `scripts/demo/run_integration_demo.py`

### Modified Files
- `Agents/system-agents/routing_config.json` (add Milton)
- `Agents/system-agents/Milton_config.json` (expand responsibilities)
- `src/agents/system/SystemAgentLoader.ts` (load Milton)
- Various TS files to fix build errors

---

## Success Criteria

By hour 48, we should be able to:

1. ✅ Start Go Gateway and see it connected to Ollama
2. ✅ Start System Agent server and see 5 agents loaded (including Milton)
3. ✅ Send a message to any agent and get a real LLM response
4. ✅ Open the UI and see the three-pane layout
5. ✅ Type in chat pane and see agent respond
6. ✅ See basic canvas with agent nodes
7. ⚠️ Memory persistence (stretch goal)
8. ⚠️ Full task execution through canvas (stretch goal)

---

## Let's Start!

**First task**: Fix TypeScript build errors so we have a working foundation.

Ready when you are! 🚀

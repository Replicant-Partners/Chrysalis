# Borrowed Ideas → Chrysalis Action Plan (Merged)

**Date:** 2026-01-15 (Updated)
**Inputs merged:**

- `Borrowed_Ideas/borrowed-ideas-analysis.md`
- `Borrowed_Ideas/CHRY_Borrowed_Ideas_Integration_Analysis.md`
- `plans/CHRYSALIS_COMPREHENSIVE_PATTERN_ANALYSIS.md` (Patterns 11-13)
- `Borrowed_Ideas/SYSTEM_AGENT_MIDDLEWARE_DESIGN.md` (New Design Spec)

## Goal
Translate the borrowed ideas (agent behavior configs, durable jobs/events, shared conversational middleware) into an implementable Chrysalis roadmap and begin core scaffolding.

## Architectural Integration

These borrowed ideas implement a **fractal pattern repeat** at Scale 2 (System Agent Layer) of Chrysalis's architecture. See `SYSTEM_AGENT_MIDDLEWARE_DESIGN.md` for the complete design specification.

### Universal Pattern Mapping

| Pattern | Scale 1 Usage | Scale 2 (Middleware) Expansion |
|---------|---------------|--------------------------------|
| Hash | Agent fingerprinting | Job fingerprinting |
| Signatures | Experience auth | Job audit trail |
| Gossip | Memory propagation | Job state propagation |
| DAG | Evolution tracking | Job execution history |
| Convergence | Skill aggregation | Turn convergence |
| Time | Causal ordering | Job event ordering |
| CRDT | Memory merge | Turn state merge |
| Threshold | Byzantine voting | Arbitration voting |

---

## Phase 0 — Alignment & Artifacts (Now)
**Outcome:** Unified plan and implementation targets.

- [x] Merge the two analysis reports into a single action plan (this document).
- [x] Identify concrete implementation anchors (System Agents config/schema, Voyeur events, memory_system stores).

---

## Phase 1 — Schema + Policy Surfaces (P1)
**Outcome:** Chrysalis can express the borrowed behaviors declaratively.

1) **System Agent Schema Extension**
   - Add `behavior` section (jobs, conversation_triggers, openers, idioms).
   - Add `scm_policy` section (initiative, turn_taking, coaching, creativity).
   - Location: `Agents/schemas/system-agent.schema.json`.

2) **TypeScript Runtime Types**
   - Extend `src/agents/system/types.ts` to include optional `behavior` + `scm_policy`.

3) **Job/Event Schema Placeholders**
   - Add pydantic placeholder models in `shared/api_core/schemas.py` (JobRecord, JobEvent) to establish API/validation hooks.

---

## Phase 2 — Durable Jobs + Events SSOT Pilot (P1)
**Outcome:** Minimal durable job/event storage + observability integration.

1) **JobStore + EventStore (Python)**
   - Add `JobStore` and `EventStore` to `memory_system/stores.py`.
   - JSON-per-job storage + JSONL events per job for replay.

2) **Voyeur Event Types (TS)**
   - Extend `src/observability/VoyeurEvents.ts` with job-related event kinds:
     - `job.state`, `job.progress`, `job.output`, `job.error`.

---

## Phase 3 — Shared Conversational Middleware (SCM) Stub (P1)
**Outcome:** Shared gating + arbitration skeleton for multi-agent conversation control.

1) **SCM Core Stub**
   - Add `src/agents/system/SharedConversationMiddleware.ts` with:
     - `shouldSpeak()` gating function
     - `planIntent()` placeholder
     - `realizeStyle()` placeholder

2) **Arbitration Skeleton**
   - Add `src/agents/system/AgentArbiter.ts` with:
     - `rankCandidates()` and `selectWinners()`

3) **Exports**
   - Export SCM and Arbiter from `src/agents/system/index.ts`.

---

## Phase 4 — Follow-on (P2+)
**Outcome:** Expand to real workflows and runtime integration.

- Wire JobStore/EventStore into workflow execution (e.g., embedding upsert or creative loop).
- Add SCM gating to the chat pipeline and evaluation coordinator.
- Implement idioms/openers selection for system agents.
- Add observation metrics to Voyeur (turn economy, arbitration success rate).

---

## Implementation Started (This Session)
- Create schema and type surfaces for `behavior` + `scm_policy`.
- Add JobStore/EventStore pilot storage.
- Add SCM gating + arbitration stubs.

---

## Notes
- All new fields are optional to avoid breaking existing agent configs.
- These implementations are scaffolding: functional, but intentionally minimal for low-risk adoption.

---

## Related Documents

| Document | Purpose |
|----------|---------|
| `SYSTEM_AGENT_MIDDLEWARE_DESIGN.md` | Complete design specification with interfaces and data flows |
| `../plans/CHRYSALIS_COMPREHENSIVE_PATTERN_ANALYSIS.md` | Pattern inventory and fractal architecture mapping |
| `AGENT_JOBS_AND_CONVERSATIONS.md` | Original jobs/triggers/openers/idioms specification |
| `JOBS_EVENTS_SCHEMA_PROPOSAL.md` | Original durable jobs/events proposal |
| `Shared-Conversational-Middleware-Research.md` | Original SCM research document |
| `borrowed-ideas-analysis.md` | Technical compatibility analysis |
| `CHRY_Borrowed_Ideas_Integration_Analysis.md` | Integration opportunities assessment |

## Pattern Language References

The System Agent Middleware implements three new patterns in the Chrysalis Pattern Language:

### Pattern 11: DURABLE WORKFLOW (Confidence: 92%)
Jobs and Events as System of Record for workflow execution state.

### Pattern 12: SHARED CONVERSATION MIDDLEWARE (Confidence: 88%)
Three-routine pipeline (Gate → Plan → Realize) with multi-agent arbitration.

### Pattern 13: AGENT BEHAVIOR CONFIG (Confidence: 90%)
JSON-driven declarative behavior configuration.
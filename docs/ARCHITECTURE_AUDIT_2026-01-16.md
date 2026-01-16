# Architecture Audit - January 16, 2026

**Purpose**: Document the gap between specifications and implementation.  
**Status**: Critical architectural failures identified.

---

## Executive Summary

Multiple core components do not match their specifications. The codebase requires significant rework or replacement.

---

## 1. Go LLM Gateway

### Spec Requirements (from `LLM_COMPLEXITY_ADAPTATION_PATTERN.md`, `adaptive-llm-layer-prompts-and-connectors.md`)

| Requirement | Source |
|-------------|--------|
| Single source of truth for ALL LLM interactions | go-services/README.md |
| Support 6+ system agents concurrently | LLM_COMPLEXITY_ADAPTATION_PATTERN.md |
| Per-agent model tier configuration | Ada=hybrid, Lea=local_slm, Phil=hybrid, David=cloud_llm |
| ComplexityRouter: route by task type + input size + latency budget | adaptive-llm-layer-prompts-and-connectors.md |
| Cache layer keyed by promptId + schemaVersion + hash(input) | adaptive-llm-layer-prompts-and-connectors.md |
| Per-agent rate limiting | Implied by multi-agent architecture |

### What Was Built

| Feature | Status | Notes |
|---------|--------|-------|
| Model-based routing | ✅ | Routes `llama*` → Ollama, `claude*` → Anthropic, etc. |
| Multiple providers | ✅ | OpenAI, Anthropic, Ollama, OpenRouter |
| Streaming | ✅ | SSE-based |
| **Per-agent rate limiting** | ❌ | Single process-level bucket for ALL requests |
| **Per-agent configuration** | ❌ | No agent-specific model tier lookup |
| **ComplexityRouter** | ❌ | Not implemented |
| **Cache layer** | ❌ | Not implemented |
| **Concurrent multi-agent support** | ⚠️ | HTTP server handles goroutines, but all share same rate limit |

### Impact

The gateway cannot serve its intended purpose as a centralized LLM service for multiple agents with different requirements. All agents compete for the same rate limit bucket. No intelligent routing based on task complexity.

---

## 2. Universal LLM Adapter

### Spec Requirements (from `UNIVERSAL_ADAPTER_DESIGN.md`, `UNIVERSAL_ADAPTER_REVIEW.md`)

| Requirement | Source |
|-------------|--------|
| Replace 22 hand-coded adapters with 1 | UNIVERSAL_ADAPTER_DESIGN.md |
| LLM Orchestrator for translation | UNIVERSAL_ADAPTER_DESIGN.md |
| Protocol registry v2 with semantic hints | UNIVERSAL_ADAPTER_REVIEW.md |
| Translation cache for performance | UNIVERSAL_ADAPTER_DESIGN.md |
| Connected to local Ollama via Go gateway | Implied |

### What Was Built

| Feature | Status | Notes |
|---------|--------|-------|
| Protocol registry v1 | ✅ | `src/adapters/universal/index.ts` - hardcoded URLs |
| Protocol registry v2 | ✅ | `src/adapters/universal/registry-v2.ts` - semantic hints, fallbacks |
| Prompts v1 | ✅ | `src/adapters/universal/prompts.ts` |
| Prompts v2 | ✅ | `src/adapters/universal/prompts-v2.ts` - optimized |
| **v2 integration into main adapter** | ❌ | `index.ts` still uses v1 |
| **LLM wired to Go gateway** | ❌ | Generic `LLMProvider` interface, nothing connected |
| **Translation cache** | ❌ | Not implemented |
| **Actually functional** | ❌ | No LLM connected, cannot translate |

### Impact

The Universal Adapter exists as code but is non-functional. It has a generic `LLMProvider` interface with no implementation connected to it. The v2 improvements (registry, prompts) were created but never integrated.

---

## 3. System Agents

### Spec Requirements (from `LLM_COMPLEXITY_ADAPTATION_PATTERN.md`)

| Requirement | Source |
|-------------|--------|
| 4 persona agents: Ada, Lea, Phil, David | Section 5.2 |
| Per-agent model tier: Ada=hybrid, Lea=local_slm, Phil=hybrid, David=cloud_llm | Section 5.5 |
| Evaluation Coordinator for orchestration | Section 5.1 |
| Agent Memory System connection | Section 5.1 |
| Prompt Engineer + AI Engineer integration | Section 5.1 |

### What Was Built

| Feature | Status | Notes |
|---------|--------|-------|
| Agent config files | ✅ | `Agents/system-agents/*.json` |
| SCM Middleware | ✅ | `src/agents/system/SharedConversationMiddleware.ts` |
| AgentArbiter | ✅ | `src/agents/system/AgentArbiter.ts` |
| BehaviorLoader | ✅ | `src/agents/system/BehaviorLoader.ts` |
| SystemAgentChatService | ✅ | `src/agents/system/SystemAgentChatService.ts` |
| **Connected to LLM Gateway** | ⚠️ | Uses `GatewayLLMClient` but gateway lacks per-agent config |
| **Model tier per agent** | ❌ | All agents use same model (no ComplexityRouter) |
| **Evaluation Coordinator** | ✅ | `src/agents/system/EvaluationCoordinator.ts` |
| **Actually testable end-to-end** | ❓ | Unknown - gateway limitations may block this |

### Impact

System agents exist in code but cannot operate as designed because the Go gateway doesn't support per-agent model tier configuration.

---

## 4. Memory System

### Spec Requirements (from `AGENTIC_MEMORY_FRAMEWORKS_2026-01-16.md`)

| Requirement | Source |
|-------------|--------|
| Fixed layers: Beads (short-term), Fireproof (local CRDT), Nomic (embedding) | AGENTIC_MEMORY_FRAMEWORKS_2026-01-16.md |
| Pluggable long-term backends: Zep, Letta, Mem0 | AGENTIC_MEMORY_FRAMEWORKS_2026-01-16.md |
| Fireproof for local CRDT merge | AGENTIC_MEMORY_FRAMEWORKS_2026-01-16.md |
| Multi-agent sync via cloud backend | AGENTIC_MEMORY_FRAMEWORKS_2026-01-16.md |

### What Was Built

| Feature | Status | Notes |
|---------|--------|-------|
| Beads (Python) | ✅ | `memory_system/beads.py` |
| Fireproof (Python emulation) | ✅ | `memory_system/fireproof/` - local CRDT, one-way Zep sync |
| Embedding service | ✅ | `shared/embedding.py` |
| LongTermMemoryBackend interface | ✅ | `src/memory/backends/LongTermMemoryBackend.ts` |
| LettaMemoryAdapter | ✅ | `src/memory/adapters/LettaMemoryAdapter.ts` |
| **Mem0 adapter** | ❌ | Not implemented |
| **Multi-agent CRDT sync** | ❌ | Fireproof only does local merge, not P2P |

### Impact

Memory system is mostly implemented but Mem0 adapter is missing, and multi-agent sync relies on cloud backend (Zep/Letta) rather than P2P CRDT.

---

## 5. Voyeur Observability System

### Spec Requirements

None - **DEPRECATED**

### What Was Built

50 files reference Voyeur. Core implementation:
- `src/observability/VoyeurEvents.ts`
- `src/observability/VoyeurWebServer.ts`
- `src/observability/ConsoleVoyeurSink.ts`
- `src/cli/voyeurTail.ts`

### Impact

Dead code that should be removed.

---

## 6. Canvas/UI System

### Spec Requirements (from `CANVAS_DEVELOPMENT_PROTOCOL.md`, `docs/FRONTEND_THREE_FRAME_FIVE_CANVAS_SPEC.md`)

| Requirement | Source |
|-------------|--------|
| 5 canvas types: Settings, Board, Scrapbook, Research, Terminal-Browser | Spec |
| Widget system with registry | Spec |
| Background execution | Spec |
| Terminal via xterm.js | Spec |
| Browser integration | Spec |

### What Was Built

| Feature | Status | Notes |
|---------|--------|-------|
| Core canvas abstraction | ✅ | `src/canvas/core/` |
| Widget system | ✅ | `src/canvas/widgets/` |
| Layout engine | ✅ | `src/canvas/layout/` |
| Terminal manager | ✅ | `src/canvas/terminal/` |
| React components | ✅ | `src/canvas/react/` |
| **Backend connected** | ⚠️ | PTY server exists, LLM via gateway |
| **Actually runnable** | ❓ | Unknown |

### Impact

UI code exists but may not be functional end-to-end. Depends on broken gateway.

---

## 7. ACP Adapter

### Spec Requirements

| Requirement | Source |
|-------------|--------|
| Connect to external ACP agents (opencode, codex, etc.) | ACP_PROTOCOL_MULTI_AGENT_SYNTHESIS.md |
| Expose Chrysalis as ACP server | ACP_PROTOCOL_MULTI_AGENT_SYNTHESIS.md |
| Hybrid mode with Go gateway fallback | Implied |

### What Was Built

| Feature | Status | Notes |
|---------|--------|-------|
| ACPClient | ✅ | `src/adapters/acp/client.ts` |
| ACPServer | ✅ | `src/adapters/acp/server.ts` |
| ACPBridge | ✅ | `src/agents/bridges/ACPBridge.ts` |
| **Tested with real ACP agent** | ❌ | Unknown |

### Impact

Code exists but untested with actual ACP agents.

---

## Summary of Critical Gaps

| Component | Severity | Issue |
|-----------|----------|-------|
| **Go LLM Gateway** | CRITICAL | Single-tenant, no per-agent config, no ComplexityRouter |
| **Universal Adapter** | CRITICAL | v2 not integrated, no LLM connected, non-functional |
| **System Agents** | HIGH | Depend on broken gateway |
| **Memory System** | MEDIUM | Missing Mem0, no P2P sync |
| **Voyeur** | LOW | Dead code to remove |
| **Canvas/UI** | MEDIUM | Depends on broken gateway |
| **ACP Adapter** | MEDIUM | Untested |

---

## Files for Reference

### Specifications (what should exist)
- `plans/adaptive-llm-layer-prompts-and-connectors.md`
- `docs/architecture/LLM_COMPLEXITY_ADAPTATION_PATTERN.md`
- `docs/architecture/UNIVERSAL_ADAPTER_DESIGN.md`
- `docs/architecture/UNIVERSAL_ADAPTER_REVIEW.md`
- `docs/research/AGENTIC_MEMORY_FRAMEWORKS_2026-01-16.md`

### Implementation (what was built)
- `go-services/` - Go LLM Gateway
- `src/adapters/universal/` - Universal Adapter
- `src/agents/system/` - System Agents
- `memory_system/` - Python memory system
- `src/memory/` - TypeScript memory interfaces
- `src/observability/` - Voyeur (to delete)
- `src/canvas/` - UI system

---

**Document Created**: January 16, 2026  
**Author**: Architecture Audit  
**Next Step**: User decision on remediation approach

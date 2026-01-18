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

### What Was Built (UPDATED 2026-01-16)

| Feature | Status | Notes |
|---------|--------|-------|
| Multiple providers | ✅ | OpenAI, Anthropic, Ollama, OpenRouter |
| Streaming | ✅ | SSE-based |
| **Per-agent rate limiting** | ✅ | `agents.Registry` with per-agent `rate.Limiter` |
| **Per-agent configuration** | ✅ | `AgentConfig` with model tier, default model, temperature |
| **ComplexityRouter** | ✅ | Routes by agent tier (local_slm/cloud_llm/hybrid) + complexity assessment |
| **Cache layer** | ✅ | `ResponseCache` with TTL |
| **Concurrent multi-agent support** | ✅ | Each agent has own config and rate limit bucket |
| **Built-in agents** | ✅ | Ada, Lea, Phil, David, prompt-engineer, ai-engineer, universal-adapter |

### Files Added/Modified

- `go-services/internal/agents/registry.go` - Agent registry with per-agent config and rate limiters
- `go-services/internal/llm/complexity_router.go` - ComplexityRouter implementation
- `go-services/internal/http/server.go` - Updated for per-agent rate limiting
- `go-services/cmd/gateway/main.go` - Wired agent registry and complexity router

### Impact

~~The gateway cannot serve its intended purpose.~~ **FIXED.** Gateway now supports multi-agent concurrent access with per-agent rate limiting and model tier routing.

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
| Protocol registry v2 | ✅ | `src/adapters/universal/registry.ts` - semantic hints, fallbacks |
| Prompts v1 | ✅ | `src/adapters/universal/prompts.ts` |
| Prompts v2 | ✅ | `src/adapters/universal/prompts.ts` - optimized |
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

## 5. Voyeur Observability System (REMOVED)

### Status: ✅ DELETED

Voyeur was removed on 2026-01-16 as it violated entity sovereignty principles.

**Deleted Files:**
- `src/observability/VoyeurEvents.ts`
- `src/observability/VoyeurWebServer.ts`
- `src/observability/ConsoleVoyeurSink.ts`
- `src/cli/voyeurTail.ts`
- `docs/voyeur-*.md`
- `docs/current/OBSERVABILITY_VOYEUR.md`

**Replaced With:**
- Standard structured logging via `logger()` function
- OpenTelemetry-based tracing and metrics

---

## 6. Canvas/UI System

### Spec Requirements (from `CANVAS_DEVELOPMENT_PROTOCOL.md`, `docs/FRONTEND_THREE_FRAME_FIVE_CANVAS_SPEC.md`)

| Requirement | Source |
|-------------|--------|
| 6 canvas types: Settings, Agent, Scrapbook, Research, Wiki, Terminal-Browser | Spec |
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
| **Go LLM Gateway** | ✅ FIXED | Per-agent config, ComplexityRouter, cache implemented |
| **Universal Adapter** | CRITICAL | v2 not integrated, no LLM connected, non-functional |
| **System Agents** | MEDIUM | Gateway now works; need to verify integration |
| **Memory System** | MEDIUM | Missing Mem0, no P2P sync |
| **Voyeur** | ✅ REMOVED | Replaced with standard logging |
| **Canvas/UI** | MEDIUM | Gateway now works; need to verify integration |
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
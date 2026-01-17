# Chrysalis Architecture Overview

> **Version:** 3.1.0  
> **Source:** [`package.json:3`](../../package.json:3)  
> **Status:** ✅ Implemented

## What is Chrysalis?

Chrysalis is a **Uniform Semantic Agent Transformation System** that enables AI agents to morph between different framework implementations while preserving their core identity, accumulated knowledge, and learned skills.

### Core Principle: Framework Transcendence

An agent defined in Chrysalis can be deployed to:
- **ElizaOS** for conversational AI applications
- **CrewAI** for multi-agent task orchestration
- **MCP-native** environments for tool-augmented agents

The transformation is *lossless* for semantically equivalent features and *gracefully degraded* for framework-specific capabilities.

---

## Three Agent Implementation Types

Chrysalis supports three distinct agent implementation paradigms:

```
┌─────────────────────────────────────────────────────────────────┐
│                    UNIFORM SEMANTIC AGENT                       │
│                     Identity + Personality                      │
│                     Knowledge + Skills                          │
│                     Beliefs + Memory                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Morphs Into
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │    MCP     │  │Multi-Agent │  │Orchestrated│
    │   Agent    │  │   Agent    │  │   Agent    │
    └────────────┘  └────────────┘  └────────────┘
    Tool-augmented   Peer-to-peer   Hierarchical
    Single runtime   Collaborative  Managed fleet
```

| Type | Description | Use Case | Source |
|------|-------------|----------|--------|
| **MCP** | Tool-augmented agents using Model Context Protocol | Single agent with rich tool access | [`UniformSemanticAgentV2.ts:13`](../../src/core/UniformSemanticAgentV2.ts:13) |
| **Multi-Agent** | Peer-to-peer collaborative agents | Autonomous agent networks | [`UniformSemanticAgentV2.ts:13`](../../src/core/UniformSemanticAgentV2.ts:13) |
| **Orchestrated** | Managed fleet with coordinator | Task delegation workflows | [`UniformSemanticAgentV2.ts:13`](../../src/core/UniformSemanticAgentV2.ts:13) |

---

## System Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CHRYSALIS SYSTEM                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │   TypeScript    │  │     Python      │  │    Services     │         │
│  │     Core        │  │  Memory System  │  │   Infrastructure│         │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤         │
│  │ UniformAgent    │  │ Memory Core     │  │ LedgerService   │         │
│  │ Adapters        │  │ Semantic        │  │ ProjectionSvc   │         │
│  │ Patterns        │  │ Embeddings      │  │ GroundingSvc    │         │
│  │ Sync Manager    │  │ Graph Store     │  │ SkillForgeSvc   │         │
│  │ Memory Merger   │  │ Converters      │  │ GatewaySvc      │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│           │                   │                    │                    │
│           └───────────────────┴────────────────────┘                    │
│                              │                                          │
│                    ┌─────────┴─────────┐                                │
│                    │  Observability    │                                │
│                    │  VoyeurBus        │                                │
│                    │  Prometheus/OTel  │                                │
│                    └───────────────────┘                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Core Runtime** | TypeScript / Node.js 18+ | Agent definitions, morphing, sync |
| **Memory System** | Python 3.11+ | Semantic decomposition, embeddings |
| **Vector Storage** | LanceDB (primary), Chroma | Memory retrieval |
| **CRDT Sync** | Yjs + y-websocket | Distributed state |
| **Cryptography** | @noble/curves, @noble/hashes | Identity, signatures |
| **Observability** | Prometheus, OpenTelemetry | Metrics and tracing |

---

## Core TypeScript Modules

### Agent Definition

| Module | Location | Purpose |
|--------|----------|---------|
| **UniformSemanticAgentV2** | [`src/core/UniformSemanticAgentV2.ts`](../../src/core/UniformSemanticAgentV2.ts) | Core agent type definition with experience sync |
| **FrameworkAdapter** | [`src/core/FrameworkAdapter.ts`](../../src/core/FrameworkAdapter.ts) | Base class for framework adapters |
| **AdapterRegistry** | [`src/core/AdapterRegistry.ts`](../../src/core/AdapterRegistry.ts) | Registry for available adapters |

### Framework Adapters

| Adapter | Location | Status |
|---------|----------|--------|
| **ElizaOSAdapter** | [`src/adapters/ElizaOSAdapter.ts`](../../src/adapters/ElizaOSAdapter.ts) | ✅ Implemented |
| **CrewAIAdapter** | [`src/adapters/CrewAIAdapter.ts`](../../src/adapters/CrewAIAdapter.ts) | ✅ Implemented |

### Universal Patterns

Ten mathematically-proven patterns from distributed systems research:

| # | Pattern | File | Purpose |
|---|---------|------|---------|
| 1 | Hash | [`src/core/patterns/Hashing.ts`](../../src/core/patterns/Hashing.ts) | One-way transformation |
| 2 | Signature | [`src/core/patterns/DigitalSignatures.ts`](../../src/core/patterns/DigitalSignatures.ts) | Unforgeable identity |
| 3 | Encryption | [`src/core/patterns/Encryption.ts`](../../src/core/patterns/Encryption.ts) | Trapdoor functions |
| 4 | Byzantine | [`src/core/patterns/ByzantineResistance.ts`](../../src/core/patterns/ByzantineResistance.ts) | Adversarial consensus |
| 5 | Time | [`src/core/patterns/LogicalTime.ts`](../../src/core/patterns/LogicalTime.ts) | Causal ordering |
| 6 | CRDT | [`src/core/patterns/CRDTs.ts`](../../src/core/patterns/CRDTs.ts) | Conflict-free merging |
| 7 | Gossip | [`src/core/patterns/Gossip.ts`](../../src/core/patterns/Gossip.ts) | Information dissemination |
| 8 | DAG | [`src/core/patterns/DAG.ts`](../../src/core/patterns/DAG.ts) | Directed structure |
| 9 | Convergence | [`src/core/patterns/Convergence.ts`](../../src/core/patterns/Convergence.ts) | Fixed-point attractors |
| 10 | Random | [`src/core/patterns/Random.ts`](../../src/core/patterns/Random.ts) | Distributed coordination |

See [Universal Patterns](./universal-patterns.md) for detailed documentation.

### Experience Synchronization

| Component | Location | Purpose |
|-----------|----------|---------|
| **ExperienceSyncManager** | [`src/sync/ExperienceSyncManager.ts`](../../src/sync/ExperienceSyncManager.ts) | Coordinate sync protocols |
| **StreamingSync** | [`src/sync/StreamingSync.ts`](../../src/sync/StreamingSync.ts) | Real-time event streaming |
| **LumpedSync** | [`src/sync/LumpedSync.ts`](../../src/sync/LumpedSync.ts) | Batch synchronization |
| **CheckInSync** | [`src/sync/CheckInSync.ts`](../../src/sync/CheckInSync.ts) | Scheduled state sync |

### Memory Integration

| Component | Location | Purpose |
|-----------|----------|---------|
| **MemoryMerger** | [`src/experience/MemoryMerger.ts`](../../src/experience/MemoryMerger.ts) | Dedup and merge memories |
| **SkillAccumulator** | [`src/experience/SkillAccumulator.ts`](../../src/experience/SkillAccumulator.ts) | Aggregate learned skills |
| **KnowledgeIntegrator** | [`src/experience/KnowledgeIntegrator.ts`](../../src/experience/KnowledgeIntegrator.ts) | Verify and integrate knowledge |
| **VectorIndex** | [`src/memory/VectorIndex.ts`](../../memory_system/VectorIndex.ts) | Vector similarity search |

---

## Python Memory System

The Python memory system provides advanced semantic analysis:

| Module | Location | Purpose |
|--------|----------|---------|
| **Memory Core** | [`memory_system/core.py`](../../memory_system/core.py) | Unified memory interface |
| **Semantic Decomposer** | [`memory_system/semantic/decomposer.py`](../../memory_system/semantic/decomposer.py) | Text chunking and analysis |
| **Embedding Service** | [`memory_system/embedding/service.py`](../../memory_system/embedding/service.py) | Vector embeddings |
| **Graph Store** | [`memory_system/graph/store.py`](../../memory_system/graph/store.py) | Knowledge graph |

### Memory Types

```python
# From memory_system/core.py
class Memory:
    """
    Main memory interface for agents
    
    Memory Types:
    - Working Memory: Recent context (in-memory buffer)
    - Episodic Memory: Past experiences (vector store)
    - Semantic Memory: Knowledge/facts (vector store)
    - Core Memory: Persistent context (structured blocks)
    """
```

---

## Services Architecture

Chrysalis provides optional services for distributed deployments:

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| **LedgerService** | 9443 | HTTPS | Event sourcing, append-only log |
| **ProjectionService** | 1234 | WebSocket | CRDT state projection |
| **GroundingService** | - | - | Context grounding |
| **SkillForgeService** | - | - | Skill building pipeline |
| **GatewayService** | - | - | Capability routing |

### Service Startup

```bash
# Start ledger service
npm run service:ledger -- --httpsPort 9443

# Start projection service
npm run service:projection -- --crdtPort 1234 --ledgerBaseUrl https://localhost:9443
```

---

## Observability

### VoyeurBus

Event stream for exposing agent cognition to UIs or logs:

```typescript
// From src/observability/VoyeurEvents.ts
type VoyeurEventKind =
  | 'ingest.start'
  | 'ingest.complete'
  | 'embed.request'
  | 'embed.fallback'
  | 'match.candidate'
  | 'match.none'
  | 'merge.applied'
  | 'merge.deferred'
  | 'error';
```

### Metrics

- **Prometheus**: Enable with `METRICS_PROMETHEUS=true`
- **OpenTelemetry**: Enable with `METRICS_OTEL=true`

See [`src/observability/Metrics.ts`](../../src/observability/Metrics.ts) for implementation.

---

## Fractal Architecture Principle

Chrysalis follows a **fractal architecture** where the same patterns recur at multiple scales:

```
Mathematics     →  Implemented in src/core/patterns/
    ↓
Library Calls   →  EmbeddedPatterns (local functions)
    ↓
Service Calls   →  MCP/gRPC (network services)
    ↓
Agent Behavior  →  Experience sync, skill accumulation
```

The [`AdaptivePatternResolver`](../../src/core/patterns/PatternResolver.ts) automatically selects the appropriate resolution level based on deployment context.

---

## Next Steps

- [Universal Patterns](./universal-patterns.md) - Deep dive into the 10 patterns
- [Experience Sync](./experience-sync.md) - Sync protocols and transports
- [Memory System](./memory-system.md) - Dual-coding architecture
- [Agent Types](./agent-types.md) - MCP, Multi-Agent, Orchestrated details
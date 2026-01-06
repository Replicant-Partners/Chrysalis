# Chrysalis Documentation Status Badges

## Status Legend

Use these badges throughout documentation to indicate implementation status:

| Badge | Meaning | Usage |
|-------|---------|-------|
| ![Implemented](https://img.shields.io/badge/status-implemented-brightgreen) | Feature is fully implemented and tested | Production-ready code |
| ![Partial](https://img.shields.io/badge/status-partial-yellow) | Feature is partially implemented | Some functionality works |
| ![Planned](https://img.shields.io/badge/status-planned-blue) | Feature is designed but not yet implemented | Roadmap item |
| ![Aspirational](https://img.shields.io/badge/status-aspirational-lightgrey) | Conceptual, may not be implemented | Vision document |
| ![Deprecated](https://img.shields.io/badge/status-deprecated-red) | Feature is being phased out | Do not use in new code |
| ![Mock](https://img.shields.io/badge/status-mock-orange) | Implementation uses mock/simulated data | Testing only |

## Inline Badge Syntax

```markdown
<!-- For implemented features -->
![Implemented](https://img.shields.io/badge/status-implemented-brightgreen)

<!-- For partial implementations -->
![Partial](https://img.shields.io/badge/status-partial-yellow)

<!-- For planned features -->
![Planned](https://img.shields.io/badge/status-planned-blue)

<!-- For aspirational content -->
![Aspirational](https://img.shields.io/badge/status-aspirational-lightgrey)

<!-- For deprecated features -->
![Deprecated](https://img.shields.io/badge/status-deprecated-red)

<!-- For mock implementations -->
![Mock](https://img.shields.io/badge/status-mock-orange)
```

## Component Status Overview

### Memory System

| Component | TypeScript | Python | Status |
|-----------|------------|--------|--------|
| Memory Types | `src/memory/types.ts` | `memory_system/chrysalis_types.py` | ![Implemented](https://img.shields.io/badge/status-implemented-brightgreen) |
| Embedding Service | `src/memory/EmbeddingService.ts` | `memory_system/embeddings.py` | ![Partial](https://img.shields.io/badge/status-partial-yellow) |
| Memory Store | `src/memory/MemoryStore.ts` | `memory_system/stores.py` | ![Implemented](https://img.shields.io/badge/status-implemented-brightgreen) |
| CRDT Merge | `src/core/patterns/CRDTs.ts` | `memory_system/crdt_merge.py` | ![Implemented](https://img.shields.io/badge/status-implemented-brightgreen) |
| Gossip Protocol | `src/core/patterns/Gossip.ts` | `memory_system/gossip.py` | ![Mock](https://img.shields.io/badge/status-mock-orange) |
| Byzantine Fault Tolerance | `src/core/patterns/Gossip.ts` | `memory_system/byzantine.py` | ![Partial](https://img.shields.io/badge/status-partial-yellow) |
| Retrieval System | — | `memory_system/retrieval.py` | ![Implemented](https://img.shields.io/badge/status-implemented-brightgreen) |

### Core Patterns

| Pattern | Location | Status |
|---------|----------|--------|
| Actor Model | `src/core/patterns/Actors.ts` | ![Implemented](https://img.shields.io/badge/status-implemented-brightgreen) |
| Supervisor Trees | `src/core/patterns/Supervisors.ts` | ![Implemented](https://img.shields.io/badge/status-implemented-brightgreen) |
| Event Sourcing | `src/core/patterns/EventSource.ts` | ![Implemented](https://img.shields.io/badge/status-implemented-brightgreen) |
| CQRS | `src/core/patterns/CQRS.ts` | ![Implemented](https://img.shields.io/badge/status-implemented-brightgreen) |
| Sagas | `src/core/patterns/Sagas.ts` | ![Implemented](https://img.shields.io/badge/status-implemented-brightgreen) |
| CRDTs | `src/core/patterns/CRDTs.ts` | ![Implemented](https://img.shields.io/badge/status-implemented-brightgreen) |
| Gossip | `src/core/patterns/Gossip.ts` | ![Mock](https://img.shields.io/badge/status-mock-orange) |
| Backpressure | `src/core/patterns/Backpressure.ts` | ![Implemented](https://img.shields.io/badge/status-implemented-brightgreen) |
| Capability Security | `src/core/patterns/Capabilities.ts` | ![Implemented](https://img.shields.io/badge/status-implemented-brightgreen) |
| Semantic Routing | `src/core/patterns/SemanticRouter.ts` | ![Implemented](https://img.shields.io/badge/status-implemented-brightgreen) |

### Fabric Layer

| Component | Location | Status |
|-----------|----------|--------|
| Pattern Resolver | `src/fabric/PatternResolver.ts` | ![Implemented](https://img.shields.io/badge/status-implemented-brightgreen) |
| Distributed Fabric | `src/fabric/DistributedFabric.ts` | ![Partial](https://img.shields.io/badge/status-partial-yellow) |
| Circuit Breaker | `src/utils/CircuitBreaker.ts` | ![Implemented](https://img.shields.io/badge/status-implemented-brightgreen) |

### Agent System

| Component | Location | Status |
|-----------|----------|--------|
| Uniform Semantic Agent | `src/agents/UniformSemanticAgentV2.ts` | ![Implemented](https://img.shields.io/badge/status-implemented-brightgreen) |
| Agent Identity | `src/agents/AgentIdentity.ts` | ![Implemented](https://img.shields.io/badge/status-implemented-brightgreen) |
| Knowledge Graph | `src/memory/KnowledgeGraph.ts` | ![Partial](https://img.shields.io/badge/status-partial-yellow) |

### Frontend / UI

| Component | Location | Status |
|-----------|----------|--------|
| Elder-Friendly UI | — | ![Planned](https://img.shields.io/badge/status-planned-blue) |
| Reminiscence Workflows | — | ![Planned](https://img.shields.io/badge/status-planned-blue) |
| Accessibility (WCAG 2.1) | — | ![Planned](https://img.shields.io/badge/status-planned-blue) |

### Integration

| Component | Location | Status |
|-----------|----------|--------|
| MCP Servers | `mcp-servers/` | ![Partial](https://img.shields.io/badge/status-partial-yellow) |
| Hedera Integration | docs only | ![Aspirational](https://img.shields.io/badge/status-aspirational-lightgrey) |

## Documentation Status

| Document | Status | Notes |
|----------|--------|-------|
| `UNIFIED_SPEC_V3.1.md` | ![Partial](https://img.shields.io/badge/status-partial-yellow) | Primary specification, some features aspirational |
| `COMPLETE_SPEC.md` | ![Deprecated](https://img.shields.io/badge/status-deprecated-red) | Superseded by UNIFIED_SPEC_V3.1 |
| `USA_PROFILE_V0.1.md` | ![Implemented](https://img.shields.io/badge/status-implemented-brightgreen) | Accurate profile specification |
| `IMPLEMENTATION_GUIDE.md` | ![Partial](https://img.shields.io/badge/status-partial-yellow) | Needs update for recent changes |
| `HEDERA_REFERENCE.md` | ![Aspirational](https://img.shields.io/badge/status-aspirational-lightgrey) | Future blockchain integration |

---

## Guidelines for Documentation Authors

### When to Use Each Badge

1. **Implemented** - Use when:
   - Code exists and compiles
   - Basic tests pass
   - Feature can be used in practice

2. **Partial** - Use when:
   - Core functionality works
   - Some edge cases not handled
   - Integration incomplete

3. **Planned** - Use when:
   - Design is complete
   - Implementation scheduled
   - No code exists yet

4. **Aspirational** - Use when:
   - Concept is discussed
   - No concrete plans
   - Future vision

5. **Deprecated** - Use when:
   - Feature being removed
   - Replacement exists
   - Do not use in new code

6. **Mock** - Use when:
   - Implementation simulates behavior
   - Real backend not connected
   - Testing/development only

### Placement Rules

1. Place badge **immediately after the feature heading**
2. Include badge in **component tables** for quick scanning
3. Update badges **when implementation status changes**
4. **Never remove badges** from in-progress features

---

*Last Updated: 2026-01-06*
*Review Cycle: Monthly or after major releases*

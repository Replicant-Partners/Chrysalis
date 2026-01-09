# Chrysalis Documentation Architecture Plan

> **Created:** 2026-01-09  
> **Status:** In Progress  
> **Canonical Version:** 3.1.0 (from `package.json`)

## Executive Summary

This plan establishes a single source of truth for Chrysalis documentation by:
1. Resolving version inconsistencies across documentation
2. Creating a clear hierarchy from onboarding → architecture → implementation
3. Ensuring every claim maps to verified code
4. Archiving outdated content with clear deprecation markers

---

## Part 1: Codebase Analysis Findings

### Version Discrepancies (Must Resolve)

| Source | Claimed Version | Evidence |
|--------|-----------------|----------|
| [`package.json:3`](package.json:3) | **3.1.0** | Canonical (npm source of truth) |
| [`README.md`](README.md) | 3.2.0 | Incorrect - update needed |
| [`memory_system/README.md`](memory_system/README.md) | 3.3.0 | Python package may version separately |
| [`docs/current/UNIFIED_SPEC_V3.1.md`](docs/current/UNIFIED_SPEC_V3.1.md) | 3.1.0 | Correct |

**Decision:** Use `package.json` as canonical. Version is **3.1.0**.

### Verified Architecture Components

#### TypeScript Core (`src/`)

| Component | File | Status |
|-----------|------|--------|
| UniformSemanticAgentV2 | [`src/core/UniformSemanticAgentV2.ts`](src/core/UniformSemanticAgentV2.ts) | ✅ Implemented |
| ElizaOSAdapter | [`src/adapters/ElizaOSAdapter.ts`](src/adapters/ElizaOSAdapter.ts) | ✅ Implemented |
| CrewAIAdapter | [`src/adapters/CrewAIAdapter.ts`](src/adapters/CrewAIAdapter.ts) | ✅ Implemented |
| AdaptivePatternResolver | [`src/fabric/PatternResolver.ts`](src/fabric/PatternResolver.ts) | ✅ Implemented |
| ExperienceSyncManager | [`src/sync/ExperienceSyncManager.ts`](src/sync/ExperienceSyncManager.ts) | ✅ Implemented |
| MemoryMerger | [`src/experience/MemoryMerger.ts`](src/experience/MemoryMerger.ts) | ✅ Implemented |
| VectorIndex | [`src/memory/VectorIndex.ts`](src/memory/VectorIndex.ts) | ✅ Implemented |

#### 10 Universal Patterns (`src/core/patterns/`)

| # | Pattern | File | Status |
|---|---------|------|--------|
| 1 | Hash Functions | `Hashing.ts` | ✅ |
| 2 | Digital Signatures | `DigitalSignatures.ts` | ✅ |
| 3 | Encryption | `Encryption.ts` | ✅ |
| 4 | Byzantine Agreement | `ByzantineResistance.ts` | ✅ |
| 5 | Logical Time | `LogicalTime.ts` | ✅ |
| 6 | CRDTs | `CRDTs.ts` | ✅ |
| 7 | Gossip Protocol | `Gossip.ts` | ✅ |
| 8 | DAG | `DAG.ts` | ✅ |
| 9 | Convergence | `Convergence.ts` | ✅ |
| 10 | Random Selection | `Random.ts` | ✅ |

#### Services (`src/services/`)

| Service | Port | File | Status |
|---------|------|------|--------|
| LedgerService | HTTPS 9443 | [`src/services/ledger/`](src/services/ledger/) | ✅ |
| ProjectionService | WS 1234 | [`src/services/projection/`](src/services/projection/) | ✅ |
| GroundingService | - | `src/services/grounding/` | ✅ |
| SkillForgeService | - | `src/services/skillforge/` | ✅ |
| GatewayService | - | `src/services/capability-gateway/` | ✅ |

#### Python Memory System (`memory_system/`)

| Module | File | Status |
|--------|------|--------|
| Core Memory | [`memory_system/core.py`](memory_system/core.py) | ✅ |
| Semantic Decomposer | `memory_system/semantic/decomposer.py` | ✅ |
| LLM Strategies | `memory_system/semantic/strategies/` | ✅ |
| Graph Store | `memory_system/graph/` | ✅ |
| Embeddings | `memory_system/embedding/` | ✅ |

#### Observability

| Component | File | Status |
|-----------|------|--------|
| VoyeurBus | [`src/observability/VoyeurEvents.ts`](src/observability/VoyeurEvents.ts) | ✅ |
| Prometheus Metrics | [`src/observability/Metrics.ts`](src/observability/Metrics.ts) | ✅ |
| OpenTelemetry | [`src/observability/Metrics.ts`](src/observability/Metrics.ts) | ✅ |

### Missing/Unverified Components

| Component | Expected Location | Status |
|-----------|-------------------|--------|
| chrysalis-cli | `src/cli/chrysalis-cli.ts` | ❌ Not Found |
| MCP Servers | `mcp-servers/*/src/index.ts` | ⚠️ Different structure |
| Agent Protocol | `src/protocols/agent-protocol/` | ❓ Unverified |

---

## Part 2: Target Documentation Architecture

### Directory Structure

```
docs/
├── README.md                    # Navigation hub (keep)
├── index.md                     # → Redirect to README.md
├── getting-started/             # NEW: Onboarding path
│   ├── quickstart.md
│   ├── installation.md
│   └── first-agent.md
├── architecture/                # NEW: Technical deep-dives
│   ├── overview.md              # System architecture
│   ├── universal-patterns.md    # 10 patterns with code refs
│   ├── agent-types.md           # MCP, Multi-Agent, Orchestrated
│   ├── experience-sync.md       # Sync protocols
│   └── memory-system.md         # Dual-coding architecture
├── guides/                      # NEW: How-to guides
│   ├── morphing-agents.md       # ElizaOS ↔ CrewAI
│   ├── building-adapters.md
│   ├── services.md              # Ledger, Projection, etc.
│   └── observability.md         # Voyeur, Metrics
├── reference/                   # API reference
│   ├── typescript-api.md
│   ├── python-api.md
│   └── schema-reference.md
├── current/                     # KEEP: Active specs
│   ├── UNIFIED_SPEC_V3.1.md     # Keep as canonical spec
│   ├── STATUS.md                # Implementation status
│   └── memory/                  # Memory subsystem specs
├── research/                    # KEEP: Research foundation
└── archive/                     # Historical (expand)
    ├── v1/
    ├── v2/
    ├── v3/
    └── deprecated/
```

### Core Documents to Create/Update

#### 1. README.md (Root)
- Fix version to 3.1.0
- Add quick architecture diagram
- Link to docs/README.md for full navigation

#### 2. docs/README.md (Navigation Hub)
- Restructure with clear pathways:
  - **New Users:** getting-started/
  - **Understanding the System:** architecture/
  - **Building with Chrysalis:** guides/
  - **API Reference:** reference/
  - **Specifications:** current/

#### 3. docs/architecture/overview.md (NEW)
- High-level system diagram
- Three agent types explained
- Fractal architecture principle
- Technology stack summary

#### 4. docs/architecture/universal-patterns.md (NEW)
- Each of 10 patterns with:
  - Mathematical foundation
  - Code reference (linked to source)
  - Usage example
  - Resolution strategy (MCP vs Embedded)

#### 5. docs/architecture/experience-sync.md (NEW)
- Streaming, Lumped, Check-in protocols
- Transport types (HTTPS, WebSocket, MCP)
- Memory merger algorithm
- Skill accumulation process

#### 6. docs/guides/services.md (NEW)
- LedgerService: Event sourcing
- ProjectionService: CRDT replication
- GroundingService: Context grounding
- SkillForgeService: Skill building
- GatewayService: Capability routing

---

## Part 3: Migration Plan

### Phase 1: Version Correction
1. Update [`README.md`](README.md) version to 3.1.0
2. Verify [`package.json`](package.json) is source of truth
3. Add version badge to docs

### Phase 2: Create New Structure
1. Create `docs/getting-started/` with quickstart
2. Create `docs/architecture/` with overview
3. Create `docs/guides/` with morphing guide
4. Create `docs/reference/` placeholder

### Phase 3: Migrate Existing Content
1. Extract relevant sections from UNIFIED_SPEC to architecture docs
2. Move implementation details to guides
3. Consolidate memory docs under architecture/memory-system.md

### Phase 4: Archive Cleanup
1. Move all v1, v2 docs to archive if not already
2. Archive deprecated patterns/approaches
3. Create archive/README.md index

### Phase 5: Verification
1. Check all internal links
2. Verify code references point to existing files
3. Ensure diagrams match current architecture

---

## Part 4: Document Templates

### Architecture Document Template
```markdown
# [Component Name]

> **Source:** [`path/to/file.ts`](path/to/file.ts)  
> **Status:** ✅ Implemented | 🔄 In Progress | 📋 Planned

## Overview
[1-2 paragraphs explaining purpose and context]

## Architecture
[Diagram if helpful]

## Key Concepts
### [Concept 1]
[Explanation with code reference]

## Implementation Details
[Technical specifics with source links]

## Usage Example
```typescript
// Example code
```

## Related
- [Link to related doc]
```

### Guide Template
```markdown
# How to [Task]

## Prerequisites
- [Requirement 1]

## Steps
### 1. [Step Name]
[Instructions with code]

### 2. [Step Name]
[Instructions]

## Troubleshooting
### [Common Issue]
[Solution]

## Next Steps
- [Related guide]
```

---

## Part 5: Files to Archive

| Current Location | Archive To | Reason |
|------------------|------------|--------|
| Multiple STATUS files | Keep one in `docs/current/` | Consolidation |
| `docs/current/SYSTEM_SUMMARY.md` | `archive/v3/` | Dated Dec 28, 2025 - may be stale |
| Duplicate READMEs | Single docs/README.md | Simplification |
| Aspirational specs without impl | Mark as 📋 Planned | Transparency |

---

## Part 6: Success Criteria

1. **Single Version:** All docs show 3.1.0 consistently
2. **Navigable:** New user can find quickstart in < 3 clicks
3. **Accurate:** Every code reference points to existing file:line
4. **Complete:** All implemented features documented
5. **Honest:** Unimplemented features clearly marked as planned
6. **Archived:** Historical docs preserved but clearly separated

---

## Next Actions

1. [ ] Create `docs/getting-started/quickstart.md`
2. [ ] Create `docs/architecture/overview.md` with verified architecture
3. [ ] Update root `README.md` with correct version
4. [ ] Create `docs/architecture/universal-patterns.md` with code refs
5. [ ] Consolidate STATUS tracking to single location
6. [ ] Archive stale documents with deprecation notice
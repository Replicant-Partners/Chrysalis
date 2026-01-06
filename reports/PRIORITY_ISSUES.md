# Critical and High Priority Issues

**Chrysalis Review - Action Items for Resolution**  
**Date:** January 6, 2026

---

## Critical Issues (6 Total)

These must be resolved before any production deployment.

---

### CRIT-001: Documentation Claims Unimplemented Features
**Team:** Architecture  
**ID:** CRIT-ARCH-001

**Problem:** Documentation describes features as implemented that are actually simulated or not built. This creates false expectations for users and stakeholders.

| Documented Feature | Actual Status | Location |
|--------------------|---------------|----------|
| True gossip O(log N) | Simulated (calls itself, not network) | [`src/core/patterns/Gossip.ts:283-295`](src/core/patterns/Gossip.ts:283) |
| CRDT-based merge | Types exist, merge incomplete | [`src/core/patterns/CRDTs.ts`](src/core/patterns/CRDTs.ts) |
| Embedding similarity | Mock returns random vectors | [`src/memory/EmbeddingService.ts:79-139`](src/memory/EmbeddingService.ts:79) |
| Vector index (HNSW) | Brute-force fallback only | [`src/memory/VectorIndex.ts:23-68`](src/memory/VectorIndex.ts:23) |

**User Impact:** Family members evaluating system for elder care get false capabilities picture.

**Resolution:**
1. Add status badges (✅ Implemented, 📋 Designed, 🔮 Planned) to all docs
2. Create reality-check audit linking docs to passing tests
3. Update UNIFIED_SPEC_V3.1.md with accurate status

**Effort:** 2 days  
**Owner:** [TBD]

---

### CRIT-002: Dual Memory Systems Without Bridge
**Team:** Architecture  
**ID:** CRIT-ARCH-002

**Problem:** Two incompatible memory systems exist with no synchronization:
- Python: `memory_system/` (production-ready with Chroma/FAISS)
- TypeScript: `src/memory/` (types + mock embeddings)

**Evidence:**
- [`memory_system/core.py`](memory_system/core.py) - 349 lines, production
- [`src/memory/EmbeddingService.ts`](src/memory/EmbeddingService.ts) - Mock default

**User Impact:** Elder's memories stored in one system inaccessible from other. Data loss during migration.

**Resolution:**
1. Define canonical memory schema (JSON)
2. Implement Python → JSON export
3. Implement TypeScript → JSON export
4. Create bidirectional sync with version tracking

**Effort:** 2 weeks  
**Owner:** [TBD]

---

### CRIT-003: Mock Embeddings Return Random Vectors
**Team:** AI/ML  
**ID:** CRIT-AI-001

**Problem:** Default embedding service generates pseudo-random vectors, not semantic embeddings.

**Code Evidence:**
```typescript
// src/memory/EmbeddingService.ts:124-138
private generateVector(seed: number): number[] {
  // Pseudo-random but consistent vector
  const vector = new Array(this.config.dimensions);
  let x = seed;
  for (let i = 0; i < this.config.dimensions; i++) {
    // LCG (Linear Congruential Generator)
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    vector[i] = (x / 0x7fffffff) * 2 - 1;
  }
  // ...
}
```

**User Impact:** Elder asks "What did we discuss about my family?" and gets unrelated results.

**Resolution:** ✅ PARTIALLY ADDRESSED
- Changed factory default from `'mock'` to `'transformer'`
- Added production warning when mock used
- Still needs: `@xenova/transformers` in production dependencies

**Remaining Work:**
1. Add `@xenova/transformers` to package.json
2. Test semantic similarity with elder-relevant content
3. Add fallback chain configuration

**Effort:** 1 day remaining  
**Owner:** [TBD]

---

### CRIT-004: No Frontend Application Exists
**Team:** UI/UX  
**ID:** CRIT-UX-001

**Problem:** Despite extensive backend, no user interface exists for elders to interact with the system.

**Evidence:** Project structure shows no React/Vue/Svelte components, no accessibility testing infrastructure.

**User Impact:** System is completely unusable by target users (creative aging adults).

**Resolution:**
1. Create React + Vite project in `src/frontend/`
2. Build accessibility-first components (WCAG 2.1 AA)
3. Implement large touch targets (44px minimum)
4. Test with screen readers

**Effort:** 4 weeks  
**Owner:** [TBD]

---

### CRIT-005: Type Safety Violations (`any` types)
**Team:** Logic/Semantics  
**ID:** CRIT-LOG-001

**Problem:** Multiple `any` types allow malformed data to propagate, corrupting agent state.

**Evidence:**
| File | Location | Type Issue |
|------|----------|------------|
| `src/core/patterns/Gossip.ts` | Line 39 | `data: any` |
| `src/core/UniformSemanticAgentV2.ts` | Line 349 | `sources?: any[]` |
| `src/core/patterns/CRDTs.ts` | Lines 322-327 | Multiple `any` in AgentState |

**User Impact:** Malformed data could corrupt elder's memories without detection.

**Resolution:** ✅ PARTIALLY ADDRESSED
- Created [`src/core/patterns/GossipTypes.ts`](src/core/patterns/GossipTypes.ts) with typed payloads
- Still needs: Full type migration across codebase

**Remaining Work:**
1. Update Gossip.ts to import typed interfaces
2. Replace all `any` in UniformSemanticAgentV2.ts
3. Add Zod schemas for runtime validation
4. Enable `"strict": true` in tsconfig.json

**Effort:** 2 weeks  
**Owner:** [TBD]

---

### CRIT-006: Knowledge Merge Overwrites Without Conflict Resolution
**Team:** Logic/Semantics  
**ID:** CRIT-LOG-002

**Problem:** CRDT merge uses last-write-wins for knowledge, silently overwriting facts.

**Code Evidence:**
```typescript
// src/core/patterns/CRDTs.ts:382-386
// Merge knowledge - OVERWRITES, doesn't merge semantically
this.state.knowledge = { ...this.state.knowledge, ...other.state.knowledge };
```

**User Impact:** Elder's birthday could be overwritten with incorrect date during sync.

**Resolution:**
1. Implement confidence-weighted merge
2. Track conflict history for review
3. Higher confidence knowledge wins
4. Alert user of unresolved conflicts

**Effort:** 1 week  
**Owner:** [TBD]

---

## High Priority Issues (16 Total)

---

### HIGH-001: No Circuit Breaker Pattern
**Team:** Architecture  
**ID:** HIGH-ARCH-001

**Problem:** MCP client calls lack timeout protection.

**Resolution:** ✅ ADDRESSED
- Created [`src/utils/CircuitBreaker.ts`](src/utils/CircuitBreaker.ts)
- Still needs: Integration with PatternResolver

**Remaining Work:** Wire circuit breaker into PatternResolver.ts

**Effort:** 1 day  
**Owner:** [TBD]

---

### HIGH-002: Observability Gap
**Team:** Architecture  
**ID:** HIGH-ARCH-002

**Problem:** No distributed tracing (OpenTelemetry), no metrics aggregation.

**User Impact:** Support cannot diagnose sync failures for elders.

**Resolution:**
1. Add @opentelemetry/sdk-node
2. Instrument pattern resolver
3. Configure Jaeger exporter

**Effort:** 5 days  
**Owner:** [TBD]

---

### HIGH-003: No PII Detection
**Team:** Architecture  
**ID:** HIGH-ARCH-003

**Problem:** Sanitization policy exists but not implemented.

**User Impact:** Elder's medical/financial info could leak into embeddings.

**Resolution:**
1. Integrate Presidio or similar
2. Detect SSN, phone, email before embedding
3. Redact or reject PII content

**Effort:** 5 days  
**Owner:** [TBD]

---

### HIGH-004: Instance State Machine Undefined
**Team:** Architecture  
**ID:** HIGH-ARCH-004

**Problem:** States defined but transitions not enforced.

```typescript
export type InstanceStatus = 'running' | 'idle' | 'syncing' | 'terminated';
// No state machine prevents terminated → running
```

**Resolution:** Define valid state transitions, enforce in code.

**Effort:** 2 days  
**Owner:** [TBD]

---

### HIGH-005: No Graceful Degradation Strategy
**Team:** Architecture  
**ID:** HIGH-ARCH-005

**Problem:** When MCP unavailable, no user notification of degraded mode.

**Resolution:** Add capability signaling, queue deferred operations.

**Effort:** 3 days  
**Owner:** [TBD]

---

### HIGH-006: No Prompt Injection Protection
**Team:** AI/ML  
**ID:** HIGH-AI-001

**Problem:** Gossip accepts arbitrary payloads that could contain malicious prompts.

**Resolution:**
1. Add content validation schema per message type
2. Implement LLM output filtering
3. Add hallucination detection

**Effort:** 1 week  
**Owner:** [TBD]

---

### HIGH-007: No Hallucination Detection
**Team:** AI/ML  
**ID:** HIGH-AI-002

**Problem:** Retrieved memories not verified for factual consistency.

**Resolution:** Cross-reference retrieved content, flag inconsistencies.

**Effort:** 1 week  
**Owner:** [TBD]

---

### HIGH-008: Embedding Model Versioning
**Team:** AI/ML  
**ID:** HIGH-AI-003

**Problem:** No tracking of which model created which vectors.

**User Impact:** Model upgrade invalidates all existing embeddings.

**Resolution:**
1. Store model version with each embedding
2. Document migration path
3. Re-embed on model change

**Effort:** 3 days  
**Owner:** [TBD]

---

### HIGH-009: Cost Control Missing
**Team:** AI/ML  
**ID:** HIGH-AI-004

**Problem:** No token counting, budget limits, or cost attribution.

**Resolution:**
1. Add token counting middleware
2. Implement budget limits per agent
3. Log costs per operation

**Effort:** 2 days  
**Owner:** [TBD]

---

### HIGH-010: No Error Recovery UX
**Team:** UI/UX  
**ID:** HIGH-UX-001

**Problem:** When operations fail, no user-friendly recovery path.

**Resolution:** Add retry buttons, plain-language explanations.

**Effort:** 3 days (after frontend exists)  
**Owner:** [TBD]

---

### HIGH-011: No Trust Signals
**Team:** UI/UX  
**ID:** HIGH-UX-002

**Problem:** AI interactions lack confidence scores and source attribution.

**Resolution:**
1. Show confidence percentage
2. Display memory source
3. Add "AI generated" labels

**Effort:** 3 days (after frontend exists)  
**Owner:** [TBD]

---

### HIGH-012: Missing Accessibility Features
**Team:** UI/UX  
**ID:** HIGH-UX-003

**Problem:** No screen reader support, high contrast, or keyboard navigation.

**Resolution:** WCAG 2.1 AA compliance, test with real assistive tech.

**Effort:** 1 week (after frontend exists)  
**Owner:** [TBD]

---

### HIGH-013: No Schema Versioning
**Team:** Logic/Semantics  
**ID:** HIGH-LOG-001

**Problem:** Agent schemas evolve but no migration path.

**Resolution:** Implement schema version checks, migration scripts.

**Effort:** 1 week  
**Owner:** [TBD]

---

### HIGH-014: Belief Revision Not Modeled
**Team:** Logic/Semantics  
**ID:** HIGH-LOG-002

**Problem:** Beliefs can change conviction but no AGM revision operators.

**Resolution:** Implement expansion, contraction, revision operators.

**Effort:** 1 week  
**Owner:** [TBD]

---

### HIGH-015: No Formal Specification
**Team:** Logic/Semantics  
**ID:** HIGH-LOG-003

**Problem:** No TLA+ or Alloy model despite distributed claims.

**Resolution:** Create TLA+ model for sync protocol.

**Effort:** 3 weeks  
**Owner:** [TBD]

---

### HIGH-016: Memory Ontology Undefined
**Team:** Logic/Semantics  
**ID:** HIGH-LOG-004

**Problem:** No formal definition of memory type relationships.

**Resolution:** Define ontology, validate transformations.

**Effort:** 1 week  
**Owner:** [TBD]

---

## Priority Summary

| Priority | Count | Effort (Person-Days) |
|----------|-------|---------------------|
| Critical | 6 | ~45 |
| High | 16 | ~55 |
| **Total** | **22** | **~100** |

---

## Recommended Sequencing

### Week 1 (Critical Path)
1. ✅ CRIT-003: Switch embedding default (done)
2. ✅ HIGH-001: Circuit breaker (created, needs integration)
3. ✅ CRIT-005: Typed gossip (partial, needs migration)
4. CRIT-001: Documentation status badges

### Weeks 2-3 (Foundation)
5. CRIT-005: Complete type safety refactor
6. CRIT-006: Semantic knowledge merge
7. CRIT-002: Memory system bridge

### Weeks 4-5 (Safety)
8. HIGH-002: OpenTelemetry integration
9. HIGH-003: PII detection pipeline
10. HIGH-006: Prompt injection protection

### Weeks 6-8 (User Experience)
11. CRIT-004: Frontend MVP
12. HIGH-012: Accessibility compliance
13. HIGH-011: Trust signals

### Weeks 9-10 (Distributed)
14. CRIT-001: Real gossip implementation
15. HIGH-013: Schema versioning

---

## Action Items for Immediate Start

| # | Task | Owner | Due |
|---|------|-------|-----|
| 1 | Add `@xenova/transformers` to package.json | [TBD] | Day 1 |
| 2 | Integrate CircuitBreaker into PatternResolver | [TBD] | Day 2 |
| 3 | Migrate Gossip.ts to use GossipTypes.ts | [TBD] | Day 3 |
| 4 | Add status badges to UNIFIED_SPEC_V3.1.md | [TBD] | Day 4-5 |
| 5 | Begin type safety audit | [TBD] | Week 2 |

---

**Document Prepared By:** Four-Team Review Coalition  
**Last Updated:** January 6, 2026

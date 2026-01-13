# System Agent LLM Complexity Adaptation Pattern

## Technical Research Report

**Date**: January 12, 2026  
**Classification**: Architecture Design Pattern  
**Status**: Implementation Ready

---

## Executive Summary

This document formalizes the **System Agent LLM Complexity Adaptation Pattern** - an architectural approach where complex, brittle, or heuristic-heavy logic is abstracted out to LLM interfaces, enabling the core codebase to remain minimal, type-safe, and focused on I/O and state management.

The pattern implements **Cognitive Offloading** via the **Strategy Pattern**, where the "Strategy" is dynamically fulfilled by an LLM inference call - either locally (SLM via Ollama) or cloud (large foundation models).

---

## 1. Pattern Definition

### 1.1 Formal Definition

```
SYSTEM AGENT LLM COMPLEXITY ADAPTATION PATTERN

Purpose: Replace hard-coded heuristic complexity with semantic LLM reasoning
         while maintaining deterministic system behavior at interfaces.

Structure:
  ┌─────────────────────────────────────────────────────────────────────┐
  │                        CHRYSALIS TERMINAL                           │
  │  ┌─────────────────────────────────────────────────────────────┐   │
  │  │                    CORE SYSTEM (Clean)                      │   │
  │  │  • Type-safe interfaces                                     │   │
  │  │  • State management                                         │   │
  │  │  • I/O operations                                           │   │
  │  │  • Deterministic control flow                               │   │
  │  └───────────────────────┬─────────────────────────────────────┘   │
  │                          │ Strategy Pattern                        │
  │  ┌───────────────────────▼─────────────────────────────────────┐   │
  │  │              LLM COMPLEXITY ADAPTER (Strategy)              │   │
  │  │  ┌─────────────────────────────────────────────────────┐   │   │
  │  │  │              COMPLEXITY ROUTER                      │   │   │
  │  │  │  • Detects task complexity                          │   │   │
  │  │  │  • Routes to appropriate compute                    │   │   │
  │  │  │  • Maintains metadata feedback loop                 │   │   │
  │  │  └─────────────┬─────────────────┬─────────────────────┘   │   │
  │  │                │                 │                         │   │
  │  │   ┌────────────▼─────┐  ┌────────▼────────────┐           │   │
  │  │   │   LOCAL SLM      │  │    CLOUD LLM        │           │   │
  │  │   │  (Ollama)        │  │  (Claude/GPT-4o)    │           │   │
  │  │   │  Gemma 1B/3B     │  │  High complexity    │           │   │
  │  │   │  Llama 3.2 1B    │  │  Multi-step reason  │           │   │
  │  │   │  Low latency     │  │  Higher accuracy    │           │   │
  │  │   └──────────────────┘  └─────────────────────┘           │   │
  │  └─────────────────────────────────────────────────────────────┘   │
  └─────────────────────────────────────────────────────────────────────┘

Participants:
  - Client: Core system making inference requests
  - Strategy Interface: LLMComplexityAdapter with standard JSON contract
  - Concrete Strategies: LocalSLM, CloudLLM implementations
  - Complexity Router: Determines which strategy to invoke

Consequences:
  + Reduced codebase complexity
  + Semantic understanding replaces brittle heuristics
  + Self-improving through metadata capture
  + Easy A/B testing of different models
  - Latency overhead for inference
  - Non-determinism in edge cases
  - Token cost management required
```

### 1.2 Design Pattern Mapping

| GoF Pattern | Application in System |
|-------------|----------------------|
| **Strategy** | LLM as interchangeable inference strategy |
| **Chain of Responsibility** | Complexity routing through model tiers |
| **Adapter** | Protocol translation (existing Universal Adapter) |
| **Observer** | Metadata capture and feedback loop |
| **Facade** | Hiding LLM complexity behind simple interfaces |

---

## 2. Candidate Components for LLM Offloading

Based on analysis of the Chrysalis codebase, the following components are candidates for LLM complexity adaptation:

### 2.1 Priority 1: High-Value Targets

| Component | Location | Current Complexity | LLM Suitability | Model Tier |
|-----------|----------|-------------------|-----------------|------------|
| **Protocol Translation** | `src/adapters/universal/` | ~300 lines mapping logic | ✅ Excellent | Local SLM |
| **Semantic Categorization** | `memory_system/retrieval.py` | Hybrid search heuristics | ✅ Excellent | Local SLM |
| **Agent Validation** | `src/core/UniformSemanticAgentV2.ts` | Field validation rules | ✅ Good | Local SLM |
| **State Transition Logic** | `src/core/InstanceStateMachine.ts` | Decision tree | ⚠️ Partial | Cloud LLM |

### 2.2 Priority 2: Medium-Value Targets

| Component | Location | Current Complexity | LLM Suitability | Model Tier |
|-----------|----------|-------------------|-----------------|------------|
| **Content Classification** | `memory_system/fusion.py` | Score aggregation | ✅ Good | Local SLM |
| **Gossip Peer Selection** | `memory_system/gossip.py` | Random + heuristic | ⚠️ Partial | Local SLM |
| **Byzantine Validation** | `memory_system/byzantine.py` | Statistical methods | ❌ Keep code | N/A |
| **CRDT Merge Logic** | `memory_system/crdt_merge.py` | Mathematical correctness | ❌ Keep code | N/A |

### 2.3 Components to NOT Offload (Keep Deterministic)

| Component | Reason |
|-----------|--------|
| Cryptographic operations (`Encryption.ts`, `threshold.py`) | Security-critical, determinism required |
| CRDT merge operations | Mathematical correctness required |
| Vector similarity calculations | Performance-critical, well-defined math |
| State machine transitions | Need provable correctness |

---

## 3. Local Inference Feasibility Analysis

### 3.1 Model Performance Envelope

| Model | Parameters | Context | Tokens/sec (CPU) | Tokens/sec (GPU) | Optimal Use Case |
|-------|------------|---------|------------------|------------------|------------------|
| **Gemma 1B** | 1.1B | 8K | ~30-50 | ~100-200 | Classification, categorization |
| **Llama 3.2 1B** | 1.2B | 128K | ~25-40 | ~80-150 | Extended context tasks |
| **Gemma 3B** | 3.2B | 8K | ~15-25 | ~60-100 | Simple reasoning |
| **Qwen 2.5 1.5B** | 1.5B | 32K | ~20-35 | ~70-120 | Multilingual, code |

### 3.2 Task-to-Model Mapping

```
┌────────────────────────────────────────────────────────────────────────┐
│                    LOCAL SLM SUITABILITY MATRIX                        │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  TASK                          LATENCY    ACCURACY   RECOMMENDED       │
│  ─────────────────────────────────────────────────────────────────────│
│  Semantic Categorization       <100ms     95%+       Gemma 1B          │
│  Command Classification        <50ms      97%+       Gemma 1B          │
│  NL → CLI Arg Mapping          <200ms     90%+       Llama 3.2 1B      │
│  Protocol Field Mapping        <150ms     92%+       Gemma 1B          │
│  Agent Config Validation       <100ms     95%+       Gemma 1B          │
│  Simple Intent Detection       <80ms      94%+       Gemma 1B          │
│  ─────────────────────────────────────────────────────────────────────│
│  Multi-step Reasoning          N/A        <80%       → Cloud LLM       │
│  Complex Code Generation       N/A        <75%       → Cloud LLM       │
│  Nuanced Judgment              N/A        <70%       → Cloud LLM       │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Latency vs Accuracy Trade-off Zones

```
ACCURACY
   ^
100%│                                     ┌──────────────┐
   │                                     │  CLOUD LLM   │
   │                                     │  (Claude 4)  │
95% │           ┌──────────────────────────┘              │
   │           │    OPTIMAL ZONE                         │
   │           │    Local SLM                            │
90% │           │    (Gemma 1B/3B)                       │
   │           │                                         │
85% │  ┌────────┘                                        │
   │  │                                                  │
80% │  │  DEGRADED ZONE                                  │
   │  │  (Complex tasks on SLM)                         │
   └──┴──────────────────────────────────────────────────► LATENCY
      0    50ms   100ms   200ms   500ms   1s    2s
      
   RULE: Stay in OPTIMAL ZONE for local tasks
         Route to CLOUD for complex reasoning
```

---

## 4. Cross-Domain Expert Integration

### 4.1 AI Engineering (from `ai-engineer.md`)

**Inference Pipeline Optimization**:
```python
class ComplexityRouter:
    """Routes tasks to optimal compute tier based on complexity signals."""
    
    COMPLEXITY_SIGNALS = {
        'token_count': lambda x: len(x.split()) > 500,  # Long context
        'reasoning_depth': lambda x: 'why' in x.lower() or 'explain' in x.lower(),
        'code_generation': lambda x: 'generate' in x.lower() and 'code' in x.lower(),
        'multi_step': lambda x: 'then' in x.lower() or 'after' in x.lower(),
    }
    
    def route(self, task: str, context: dict) -> str:
        """Determine optimal model tier."""
        complexity_score = sum(
            1 for signal, check in self.COMPLEXITY_SIGNALS.items()
            if check(task)
        )
        
        if complexity_score >= 2:
            return 'cloud_llm'
        elif context.get('requires_accuracy', False):
            return 'cloud_llm'
        else:
            return 'local_slm'
```

### 4.2 Prompt Engineering (from `prompt-engineer.md`)

**Resilient Meta-Prompts for Structured Output**:
```typescript
/**
 * Meta-prompt template for local SLM that ensures structured output
 * regardless of model size limitations.
 */
const STRUCTURED_OUTPUT_PROMPT = `
You are a classification system. Respond ONLY with valid JSON.

INPUT: {input}

SCHEMA:
{
  "category": "string (one of: {categories})",
  "confidence": "number (0.0-1.0)",
  "reasoning": "string (one sentence)"
}

OUTPUT:`;

// For small models, use constrained generation
const CONSTRAINED_PROMPT = `
Classify: "{input}"
Category (choose one): {categories}
Answer:`;
```

### 4.3 Context Management (from `context-manager.md`)

**Managing Limited Context Windows in 1B/3B Models**:
```typescript
interface SLMContextStrategy {
  // Aggressive context compression for small models
  maxContextTokens: 2000;  // Leave room for output
  
  // Sliding window with priority
  contextWindow: {
    systemPrompt: 200,      // Fixed
    taskDescription: 300,   // Fixed
    relevantContext: 1000,  // Dynamic - retrieved
    examples: 400,          // Few-shot (2-3 examples)
    buffer: 100             // Safety margin
  };
  
  // Context selection strategy
  retrievalStrategy: 'recency_weighted_semantic';
}
```

### 4.4 Design Patterns (from `design-patterns.md`)

**Adapter + Observer Pattern for Metadata Capture**:
```typescript
/**
 * LLM Complexity Adapter with Observer pattern for self-improvement
 */
class LLMComplexityAdapter {
  private observers: MetadataObserver[] = [];
  
  async infer(task: InferenceTask): Promise<InferenceResult> {
    const startTime = Date.now();
    const modelTier = this.router.route(task);
    
    const result = await this.executeInference(task, modelTier);
    
    // Observer pattern: capture metadata for learning
    const metadata: InferenceMetadata = {
      task: task.type,
      modelUsed: modelTier,
      latencyMs: Date.now() - startTime,
      tokenCount: result.tokensUsed,
      confidence: result.confidence,
      success: result.valid
    };
    
    this.notifyObservers(metadata);
    return result;
  }
  
  private notifyObservers(metadata: InferenceMetadata): void {
    this.observers.forEach(obs => obs.onInference(metadata));
  }
}
```

---

## 5. Prompt Interface Specifications

### 5.1 Standard JSON Contract

```typescript
/**
 * Universal LLM Interface Contract
 * All LLM interactions conform to this schema for consistency.
 */
interface LLMRequest {
  /** Task type for routing */
  taskType: 'classify' | 'translate' | 'validate' | 'generate' | 'reason';
  
  /** Input data */
  input: {
    content: string;
    context?: Record<string, unknown>;
  };
  
  /** Output schema (JSON Schema subset) */
  outputSchema: {
    type: 'object';
    properties: Record<string, { type: string; enum?: string[] }>;
    required: string[];
  };
  
  /** Constraints */
  constraints: {
    maxTokens: number;
    temperature: number;
    requireStructured: boolean;
  };
}

interface LLMResponse {
  /** Parsed result conforming to outputSchema */
  result: Record<string, unknown>;
  
  /** Confidence metadata */
  metadata: {
    confidence: number;
    modelUsed: string;
    tokensUsed: number;
    latencyMs: number;
    reasoning?: string;
  };
  
  /** Raw response for debugging */
  raw?: string;
}
```

### 5.2 Task-Specific Schemas

**Semantic Categorization**:
```json
{
  "taskType": "classify",
  "input": { "content": "search for files modified today" },
  "outputSchema": {
    "type": "object",
    "properties": {
      "category": { "type": "string", "enum": ["file_search", "system_command", "agent_task", "unknown"] },
      "confidence": { "type": "number" },
      "subcategory": { "type": "string" }
    },
    "required": ["category", "confidence"]
  },
  "constraints": { "maxTokens": 100, "temperature": 0.1, "requireStructured": true }
}
```

**Protocol Translation**:
```json
{
  "taskType": "translate",
  "input": {
    "content": { "role": "assistant", "tools": [...] },
    "context": { "sourceProtocol": "crewai", "targetProtocol": "mcp" }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "translated": { "type": "object" },
      "fieldMappings": { "type": "array" },
      "confidence": { "type": "number" }
    },
    "required": ["translated", "confidence"]
  },
  "constraints": { "maxTokens": 2000, "temperature": 0.2, "requireStructured": true }
}
```

---

## 6. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
**Low-risk, high-confidence implementations**

| Task | Priority | Model | Effort |
|------|----------|-------|--------|
| Implement `LLMComplexityAdapter` interface | P0 | N/A | 2d |
| Set up Ollama with Gemma 1B | P0 | Gemma 1B | 1d |
| Create `ComplexityRouter` | P0 | N/A | 1d |
| Implement metadata capture (Observer) | P1 | N/A | 1d |
| Unit tests for interface contract | P1 | N/A | 1d |

**Deliverables**:
- `src/llm-adapter/LLMComplexityAdapter.ts`
- `src/llm-adapter/ComplexityRouter.ts`
- `src/llm-adapter/MetadataObserver.ts`

### Phase 2: Semantic Classification (Week 3-4)
**First LLM-offloaded functionality**

| Task | Priority | Model | Effort |
|------|----------|-------|--------|
| Offload command classification | P0 | Gemma 1B | 2d |
| Offload protocol field mapping | P0 | Gemma 1B | 2d |
| Implement fallback to cloud | P1 | Claude | 1d |
| A/B testing framework | P1 | N/A | 2d |
| Latency monitoring | P1 | N/A | 1d |

**Success Criteria**:
- Classification accuracy ≥ 95%
- P95 latency ≤ 100ms (local)
- Zero regressions vs current code

### Phase 3: Protocol Translation (Week 5-6)
**Migrate Universal Adapter to use LLM**

| Task | Priority | Model | Effort |
|------|----------|-------|--------|
| Integrate LLM into UniversalAdapter | P0 | Gemma 1B/Cloud | 3d |
| Caching layer for translations | P1 | N/A | 2d |
| Round-trip validation tests | P0 | N/A | 2d |
| Performance benchmarks | P1 | N/A | 1d |

### Phase 4: Memory System Enhancement (Week 7-8)
**Semantic understanding in retrieval**

| Task | Priority | Model | Effort |
|------|----------|-------|--------|
| LLM-enhanced semantic search | P0 | Gemma 1B | 2d |
| Query expansion via LLM | P1 | Gemma 1B | 2d |
| Relevance scoring | P1 | Gemma 1B | 2d |
| Hybrid retrieval optimization | P2 | N/A | 2d |

### Phase 5: Self-Improvement Loop (Week 9-10)
**Enable evolutionary learning**

| Task | Priority | Model | Effort |
|------|----------|-------|--------|
| Metadata aggregation pipeline | P0 | N/A | 2d |
| Prompt refinement based on feedback | P1 | Cloud | 2d |
| Model routing optimization | P1 | N/A | 2d |
| Dashboard for metrics | P2 | N/A | 3d |

---

## 7. Metrics & Success Criteria

### 7.1 Performance Metrics

| Metric | Local SLM Target | Cloud Target |
|--------|------------------|--------------|
| P50 Latency | ≤ 50ms | ≤ 500ms |
| P95 Latency | ≤ 100ms | ≤ 1000ms |
| P99 Latency | ≤ 200ms | ≤ 2000ms |
| Accuracy | ≥ 92% | ≥ 98% |
| Availability | 99.9% | 99.5% |

### 7.2 Business Metrics

| Metric | Target |
|--------|--------|
| Lines of code reduced | ≥ 30% in adapter layer |
| New protocol onboarding time | ≤ 1 hour (vs days) |
| Maintenance incidents | ≤ 50% reduction |
| Developer velocity | ≥ 20% improvement |

### 7.3 Self-Improvement Metrics

| Metric | Target |
|--------|--------|
| Routing accuracy improvement | ≥ 5% per month |
| Prompt optimization cycles | Weekly |
| Model upgrade cadence | Quarterly evaluation |

---

## 8. Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| SLM accuracy degradation | Medium | High | Fallback to cloud, monitoring |
| Latency spikes | Medium | Medium | Caching, async processing |
| Model hallucination | Low | High | Structured output validation |
| Cost overrun (cloud) | Medium | Medium | Aggressive local routing |
| Breaking API changes | Low | Medium | Version pinning, adapters |

---

## 9. Conclusion

The **System Agent LLM Complexity Adaptation Pattern** enables Chrysalis to:

1. **Reduce codebase complexity** by offloading heuristic logic to LLM
2. **Improve flexibility** through semantic understanding
3. **Enable self-improvement** via metadata feedback loops
4. **Maintain performance** through intelligent local/cloud routing
5. **Future-proof** the architecture for emerging models and protocols

The phased implementation approach prioritizes low-risk, high-value targets first, with continuous validation against accuracy and latency metrics.

---

**Document Owner**: Chrysalis Architecture Team  
**Governance Files**: ai-engineer.md, prompt-engineer.md, context-manager.md, design-patterns.md  
**Next Review**: After Phase 2 completion
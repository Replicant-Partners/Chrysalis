# System Agents Layer Completion Report (Horizontal 2)

**Status**: ✅ COMPLETE  
**Date**: 2026-01-13  
**Related**: [Adaptive LLM Layer Spec](./adaptive-llm-layer-prompts-and-connectors.md) (Horizontal 1)

## Executive Summary

The System Agents Layer (Horizontal 2) has been fully implemented with:
- 4 specialized evaluation personas (Ada, Lea, Phil, David)
- 13 prompt templates across 4 prompt sets
- Unified prompt registry with complexity routing
- Chat pane and user routing configuration
- Memory system integration hooks (Beads, Fireproof, Zep)

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE LAYER                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────────┐   │
│  │  @ada   │  │  @lea   │  │  @phil  │  │ @david  │  │  @evaluate   │   │
│  │   🏗️    │  │   👩‍💻   │  │   📊    │  │   🛡️    │  │     🔄       │   │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └──────┬───────┘   │
│       │            │            │            │               │           │
└───────┼────────────┼────────────┼────────────┼───────────────┼───────────┘
        │            │            │            │               │
        ▼            ▼            ▼            ▼               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    HORIZONTAL 2: SYSTEM AGENTS LAYER                     │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                     EVALUATION COORDINATOR                          │ │
│  │  ┌──────────────────────────────────────────────────────────────┐  │ │
│  │  │  Stage 1: Ada     Stage 2: Lea    Stage 3: Phil   Stage 4:   │  │ │
│  │  │  (Structural) ──► (Implementation)──► (Forecast) ──► David   │  │ │
│  │  │                                                  (Metacog)   │  │ │
│  │  └──────────────────────────────────────────────────────────────┘  │ │
│  │                              │                                      │ │
│  │                              ▼                                      │ │
│  │  ┌──────────────────────────────────────────────────────────────┐  │ │
│  │  │                    AGGREGATION ENGINE                         │  │ │
│  │  │   Weights: Ada=0.25, Lea=0.30, Phil=0.20, David=0.25         │  │ │
│  │  │   Conflict Resolution → Escalate to David                     │  │ │
│  │  │   Unanimity Bonus: +0.1 / Penalty: -0.05                     │  │ │
│  │  └──────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                      PROMPT REGISTRY (H2)                           │ │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────┐   │ │
│  │  │ Ada Set    │ │ Lea Set    │ │ Phil Set   │ │ David Set      │   │ │
│  │  │ 3 prompts  │ │ 3 prompts  │ │ 3 prompts  │ │ 4 prompts      │   │ │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    HORIZONTAL 1: LLM ADAPTIVE LAYER                      │
│                                                                          │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────────────────┐  │
│  │ ComplexityRouter│  │   LLMAdapter    │  │    Prompt Registry (H1)  │  │
│  │                │  │                 │  │                          │  │
│  │ local_slm ◄───┤  │  .infer()       │  │  10 system prompts       │  │
│  │ cloud_llm ◄───┤  │  .validate()    │  │  ERROR_CLASSIFICATION    │  │
│  │ hybrid    ◄───┤  │  .cache()       │  │  PERFORMANCE_ANALYSIS    │  │
│  └────────────────┘  └─────────────────┘  │  STATE_TRANSITION ...    │  │
│                                           └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         MEMORY SYSTEM LAYER                              │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│  │  Beads Service   │  │ Fireproof Service│  │    Zep Hooks     │       │
│  │                  │  │                  │  │                  │       │
│  │  Episodic Memory │  │  Persistent Docs │  │  Conversation    │       │
│  │  TTL: 7200s      │  │  Vector Cache    │  │  Session Mgmt    │       │
│  │  Max: 200 items  │  │  Promotions      │  │  Sync: 120s      │       │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘       │
│                                                                          │
│  Per-Persona Databases:                                                  │
│  chrysalis_ada | chrysalis_lea | chrysalis_phil | chrysalis_david       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Deliverables Checklist

### Phase 1: Agent Personas ✅

| Persona | Config File | Role | Model Tier |
|---------|-------------|------|------------|
| Ada | [`ada_config.json`](../Agents/system-agents/ada_config.json) | Algorithmic Architect | Hybrid |
| Lea | [`lea_config.json`](../Agents/system-agents/lea_config.json) | Implementation Reviewer | Local SLM |
| Phil | [`phil_config.json`](../Agents/system-agents/phil_config.json) | Forecast Analyst | Hybrid |
| David | [`david_config.json`](../Agents/system-agents/david_config.json) | Metacognitive Guardian | Cloud LLM |

### Phase 2: Prompt Sets ✅

| Set | File | Prompts |
|-----|------|---------|
| Ada | [`ada_evaluation_prompts.json`](../Agents/system-agents/prompts/ada_evaluation_prompts.json) | STRUCTURE_EVALUATION, PATTERN_RECOGNITION, COMPOSITION_GRAPH |
| Lea | [`lea_evaluation_prompts.json`](../Agents/system-agents/prompts/lea_evaluation_prompts.json) | IMPLEMENTATION_REVIEW, DOCUMENTATION_QUALITY, ERROR_HANDLING_AUDIT |
| Phil | [`phil_evaluation_prompts.json`](../Agents/system-agents/prompts/phil_evaluation_prompts.json) | FORECAST_ANALYSIS, PREDICTION_TRACKING, CALIBRATION_REPORT |
| David | [`david_evaluation_prompts.json`](../Agents/system-agents/prompts/david_evaluation_prompts.json) | METACOGNITIVE_AUDIT, BIAS_DETECTION, BLIND_SPOT_SCAN, SELF_ASSESSMENT_CALIBRATION |

### Phase 3: Integration ✅

| Component | File | Purpose |
|-----------|------|---------|
| Prompt Registry | [`prompt_registry.json`](../Agents/system-agents/prompt_registry.json) | Central registry with H1 integration |
| Routing Config | [`routing_config.json`](../Agents/system-agents/routing_config.json) | Chat panes and user routing |
| Memory Hooks | [`memory_hooks.py`](../Agents/system-agents/memory_hooks.py) | Beads, Fireproof, Zep integration |
| README | [`README.md`](../Agents/system-agents/README.md) | Architecture documentation |

## Memory System Integration

### Per-Persona Memory Configuration

```yaml
Ada:
  namespace: ada
  database: chrysalis_ada
  collections: [evaluations, patterns]
  promotion: patternNovelty >= 8 AND confidence >= 0.85

Lea:
  namespace: lea
  database: chrysalis_lea
  collections: [reviews, commonIssues, codePatterns]
  promotion: issueFrequency >= 5 AND severity IN [critical, major]

Phil:
  namespace: phil
  database: chrysalis_phil
  collections: [predictions, calibrationData, brierHistory]
  promotion: predictionCount >= 10 AND domain IS NOT NULL

David:
  namespace: david
  database: chrysalis_david
  collections: [audits, biasRegistry, blindSpots, calibrationData]
  promotion: biasFrequency >= 3 AND severity = high
```

### Promotion Flow

```
Episodic Memory (Beads)
        │
        │ confidence >= 0.8
        ▼
┌───────────────────┐
│ Promotion Queue   │
└─────────┬─────────┘
          │
          │ Rule Matching
          ▼
┌───────────────────┐
│ Fireproof Semantic│
│ Memory Collections│
└─────────┬─────────┘
          │
          │ Cross-Persona Learning
          ▼
┌───────────────────┐
│ Shared Pattern    │
│ Catalog           │
└───────────────────┘
```

## Complexity Routing Configuration

### Model Tiers

| Tier | Provider | Model | Latency Budget | Use Cases |
|------|----------|-------|----------------|-----------|
| `local_slm` | Ollama | gemma:2b | 2000ms | Quick checks, standard reviews, tracking |
| `cloud_llm` | Anthropic | claude-sonnet-4 | 15000ms | Deep analysis, metacognitive audit |
| `hybrid` | Both | Escalating | Variable | Complex evaluations |

### Escalation Triggers

- `localConfidence < 0.7` - Local model uncertain
- `inputTokens >= 2000` - Large input
- `complexity = 'high'` - Tagged as complex
- `novelPattern = true` - Unknown pattern detected

## Integration Points with Horizontal 1

### Shared Prompts

| H1 Prompt | Used By | Integration Point |
|-----------|---------|-------------------|
| ERROR_CLASSIFICATION_PROMPT | Lea | Error handling audit |
| PERFORMANCE_ANALYSIS_PROMPT | Phil | Success prediction |
| SELF_HEALING_PROMPT | Ada, Lea | Recommendation generation |

### Adapter Contract

```typescript
// H2 prompts use H1's LLMAdapter interface
LLMAdapter.infer(
  taskType: string,           // from H2 prompt category
  promptTemplateId: string,   // from H2 promptIndex
  input: object,              // persona-specific input
  outputSchema: object,       // from H2 prompt outputSchema
  options?: {
    modelHint?: string,       // from H2 complexityRouting
    latencyBudgetMs?: number, // from H2 modelTier
    cachePolicy?: string,     // from H2 cachePolicy
    telemetryContext?: object // includes personaId
  }
)
```

## Telemetry Contract (Extended)

```typescript
// H2 extends H1 telemetry with persona-specific fields
{
  // From H1
  taskType: string,
  promptId: string,
  modelUsed: string,
  tokensIn: number,
  tokensOut: number,
  latencyMs: number,
  cacheHit: boolean,
  
  // H2 additions
  personaId: string,
  modelTier: string,
  confidence: number,
  escalated: boolean,
  humanReviewRequired: boolean,
  evaluationStage: number,
  conflictsDetected: boolean
}
```

## Next Steps (Inter-Layer Connection)

Now that both horizontal layers are complete:

1. **Vertical Integration**: Connect specific pattern touchpoints to evaluation pipeline
2. **Shadow Mode**: Run evaluations in parallel with production without affecting output
3. **Feedback Loop**: Implement outcome tracking for calibration
4. **Human-in-the-Loop**: Build approval workflows for high-risk decisions

## Files Created

```
Agents/system-agents/
├── README.md                          # Architecture documentation
├── prompt_registry.json               # Central H2 prompt registry
├── routing_config.json                # Chat pane and user routing
├── memory_hooks.py                    # Memory system integration
│
├── ada_config.json                    # Ada persona config
├── lea_config.json                    # Lea persona config
├── phil_config.json                   # Phil persona config
├── david_config.json                  # David persona config
│
└── prompts/
    ├── ada_evaluation_prompts.json    # 3 prompts
    ├── lea_evaluation_prompts.json    # 3 prompts
    ├── phil_evaluation_prompts.json   # 3 prompts
    └── david_evaluation_prompts.json  # 4 prompts

Total: 13 prompt templates, 4 persona configs, 4 system files
```

## Validation Status

- [x] All persona configs have valid JSON schema
- [x] All prompts have input/output schemas defined
- [x] Prompt registry indexes all 13 prompts
- [x] Routing config covers all chat pane scenarios
- [x] Memory hooks implement Beads/Fireproof/Zep interfaces
- [x] Dependency graph is acyclic (Ada → Lea → Phil → David)
- [x] Telemetry fields are complete
- [x] Golden tests defined for critical prompts

## Conclusion

The System Agents Layer (Horizontal 2) is **COMPLETE** and ready for vertical integration with the LLM Adaptive Layer (Horizontal 1). Both horizontal layers are now fully specified with:

- Clear interfaces between layers
- Memory system integration
- Complexity-aware routing
- Human escalation paths
- Comprehensive telemetry

The system can now proceed to connecting verticals (specific use cases) to the horizontal foundation.

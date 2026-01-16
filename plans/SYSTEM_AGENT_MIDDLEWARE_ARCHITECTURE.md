# System Agent Middleware Architecture

**Version**: 1.0.0
**Date**: January 15, 2026
**Authors**: Implementation Team

---

## Executive Summary

The System Agent Middleware implements a **Domain-Specific Multi-Agent Collaboration Framework** that extends established AI research patterns for software development contexts. This architecture draws from multiple theoretical foundations and adapts them for practical agent coordination within the Chrysalis system.

---

## 1. Theoretical Foundations & AI Pattern Literature

### 1.1 Primary Influences

Our implementation synthesizes patterns from several key research areas:

#### Society of Mind (Minsky, 1986)
- **Core Concept**: Intelligence emerges from interactions between specialized agents
- **Our Adaptation**: Four persona agents (Ada, Lea, Phil, David) with distinct evaluation dimensions
- **Key Mechanism**: Weighted consensus through the AgentArbiter

#### Multi-Agent Debate (Du et al., 2023)
- **Core Concept**: Agents debate and reach consensus through iterative discussion
- **Our Adaptation**: SCM Gate → Plan → Realize pipeline with confidence-weighted voting
- **Research Reference**: "Improving Factuality and Reasoning in Language Models through Multiagent Debate"

#### ReConcile: Round-Table Conference (Chen et al., 2024)
- **Core Concept**: Multi-model framework with confidence-weighted voting
- **Our Adaptation**: AgentArbiter with diversity bonuses and pile-on prevention
- **Research Reference**: ACL 2024 - "Round-Table Conference Improves Reasoning via Consensus among Diverse LLMs"

#### MetaGPT / AgentVerse (2024)
- **Core Concept**: Standardized Operating Procedures for multi-agent collaboration
- **Our Adaptation**: Declarative behavior configs with jobs, triggers, openers, idioms
- **Research Reference**: "Meta Programming for A Multi-Agent Collaborative Framework"

### 1.2 Novel Contributions

Our system introduces **domain-specific adaptations** not found in general-purpose multi-agent debate frameworks:

| Feature | General MAD | Chrysalis SCM |
|---------|-------------|---------------|
| Agent Roles | Homogeneous reasoners | Specialized personas (structure, implementation, forecasting, metacognition) |
| Communication | Shared message pool | Turn-gated with initiative policies |
| Consensus | Voting/debate | Confidence-weighted arbitration with diversity scoring |
| Persistence | Stateless rounds | Durable jobs, episodic memory, vector clocks |
| Behavior | Prompt-defined | Declarative JSON config (jobs, triggers, idioms) |

### 1.3 Pattern Classification

Using the taxonomy from "Multi-Agent Collaboration Mechanisms: A Survey of LLMs" (Tran et al., 2025):

| Dimension | Our Implementation |
|-----------|-------------------|
| **Actors** | Heterogeneous (4 specialized agents) |
| **Type** | Cooperative with complementary expertise |
| **Structure** | Hybrid (centralized arbiter + peer evaluation) |
| **Strategy** | Confidence-weighted voting + diversity bonus |
| **Coordination** | Gate-controlled turn-taking |

---

## 2. Architecture Overview

### 2.1 Component Hierarchy

```mermaid
graph TB
    subgraph "Layer 1: Routing & Coordination"
        SCMRouter["SCMRouter<br/>Entry Point"]
        Arbiter["AgentArbiter<br/>Winner Selection"]
    end

    subgraph "Layer 2: Conversation Middleware"
        SCM["SharedConversationMiddleware<br/>Gate → Plan → Realize"]
        BehaviorLoader["BehaviorLoader<br/>Config Integration"]
    end

    subgraph "Layer 3: Behavior Components"
        Trigger["TriggerEvaluator<br/>Condition Matching"]
        Opener["OpenerSelector<br/>Weighted Selection"]
        Idiom["IdiomRegistry<br/>Personality Injection"]
    end

    subgraph "Layer 4: Persistence"
        JobStore["JobStore<br/>Durable Jobs"]
        EventStore["EventStore<br/>Job History"]
        JobScheduler["JobScheduler<br/>Cron/Event Triggers"]
    end

    subgraph "Layer 5: Observability"
        VoyeurBus["VoyeurBus<br/>Event Emission"]
    end

    SCMRouter --> Arbiter
    SCMRouter --> SCM
    SCMRouter --> BehaviorLoader

    BehaviorLoader --> Trigger
    BehaviorLoader --> Opener
    BehaviorLoader --> Idiom
    BehaviorLoader --> SCM

    JobScheduler --> JobStore
    JobScheduler --> EventStore
    JobStore --> VoyeurBus
    EventStore --> VoyeurBus
    BehaviorLoader --> VoyeurBus
```

### 2.2 Data Flow Diagram

```mermaid
sequenceDiagram
    participant User
    participant Router as SCMRouter
    participant Arbiter as AgentArbiter
    participant SCM as SharedConversationMiddleware
    participant Behavior as BehaviorLoader
    participant Voyeur as VoyeurBus

    User->>Router: Message arrives

    loop For each registered agent
        Router->>SCM: shouldSpeak(context)
        SCM-->>Router: GateResult {shouldSpeak, confidence, intent}
    end

    Router->>Arbiter: selectWinners(candidates)
    Arbiter->>Arbiter: rankCandidates() + diversityBonus()
    Arbiter-->>Router: ArbiterResult {winners, losers}

    alt Winners selected
        loop For each winner
            Router->>Behavior: evaluateBehavior(agentId, context)
            Behavior->>Behavior: TriggerEvaluator.evaluate()
            Behavior->>Behavior: OpenerSelector.select()
            Behavior->>Behavior: IdiomRegistry.inject()
            Behavior-->>Router: BehaviorEvaluation
            Router->>SCM: recordTurn(agentId)
            Router->>Arbiter: recordTurn(agentId)
        end
    end

    Router->>Voyeur: emit(routing.complete)
    Router-->>User: RoutingResult
```

### 2.3 Entity Relationships

```mermaid
erDiagram
    PersonaConfig ||--o| BehaviorConfig : contains
    PersonaConfig ||--o| SCMPolicy : contains

    BehaviorConfig ||--|{ Job : defines
    BehaviorConfig ||--|{ ConversationTrigger : defines
    BehaviorConfig ||--|{ OpenerDefinition : defines
    BehaviorConfig ||--|{ IdiomDefinition : defines

    SCMPolicy ||--|| InitiativePolicy : includes
    SCMPolicy ||--|| TurnTakingPolicy : includes
    SCMPolicy ||--|| CoachingPolicy : includes
    SCMPolicy ||--|| CreativityPolicy : includes
    SCMPolicy ||--|| CoordinationPolicy : includes
    SCMPolicy ||--|| RepairPolicy : includes

    ConversationTrigger ||--|| TriggerCondition : has
    OpenerDefinition ||--|{ OpenerVariation : contains
    IdiomDefinition ||--|{ IdiomPhrase : contains

    JobStore ||--|{ JobRecord : stores
    EventStore ||--|{ JobEvent : stores
    JobRecord ||--|{ JobEvent : generates
```

---

## 3. Component Integration Map

### 3.1 SCM Pipeline (Pattern 12)

```mermaid
flowchart LR
    subgraph Gate["Routine A: Gate"]
        G1[Check Cooldown]
        G2[Check Turn Budget]
        G3[Evaluate Initiative Mode]
        G4[Check Triggers]
        G5[Boost for Repair Signals]
        G1 --> G2 --> G3 --> G4 --> G5
    end

    subgraph Plan["Routine B: Plan"]
        P1[Map Intent to Moves]
        P2[Apply Coaching Policy]
        P3[Set Success Criteria]
        P1 --> P2 --> P3
    end

    subgraph Realize["Routine C: Realize"]
        R1[Apply Autonomy Language]
        R2[Enforce Brevity]
        R3[Limit Questions]
        R1 --> R2 --> R3
    end

    Gate -->|GateResult| Plan
    Plan -->|PlanResult| Realize
    Realize -->|StyleResult| Output
```

### 3.2 Arbitration Flow (Pattern 12)

```mermaid
flowchart TD
    Candidates[All Agent Candidates]

    subgraph Ranking
        R1[Filter: shouldSpeak = true]
        R2[Score: priority × confidence]
        R3[Apply Diversity Bonus]
        R4[Sort by Score]
    end

    subgraph Selection
        S1[Check Global Turn Budget]
        S2[Select Top N Winners]
        S3[Mark Losers]
        S4[Track Metrics]
    end

    Candidates --> R1
    R1 --> R2 --> R3 --> R4
    R4 --> S1 --> S2 --> S3 --> S4

    S4 --> Result[ArbiterResult]
```

### 3.3 Behavior Evaluation Flow (Pattern 13)

```mermaid
flowchart TD
    Context[SystemContext + SCMContext]

    subgraph TriggerEval["TriggerEvaluator"]
        T1{Check Enabled}
        T2{Check Cooldown}
        T3[Evaluate Condition]
        T4[Rank by Priority]
    end

    subgraph OpenerSel["OpenerSelector"]
        O1[Filter by Trigger]
        O2[Filter by Context]
        O3[Weighted Selection]
    end

    subgraph IdiomInj["IdiomRegistry"]
        I1[Match by Triggers]
        I2[Check Seasonal]
        I3[Frequency Throttle]
        I4[Inject to Text]
    end

    Context --> T1
    T1 -->|enabled| T2
    T2 -->|not in cooldown| T3
    T3 --> T4

    T4 -->|top trigger| O1
    O1 --> O2 --> O3

    O3 -->|opener text| I1
    I1 --> I2 --> I3 --> I4

    I4 --> Output[Final Proactive Text]
```

---

## 4. State Management

### 4.1 Turn History Tracking

```mermaid
stateDiagram-v2
    [*] --> Idle

    Idle --> GateEvaluation: Message Received
    GateEvaluation --> Cooldown: cooldown_active
    GateEvaluation --> BudgetExhausted: turn_budget_exceeded
    GateEvaluation --> Eligible: passes_all_checks

    Cooldown --> Idle: wait
    BudgetExhausted --> Idle: wait

    Eligible --> Arbitration: submit_candidate
    Arbitration --> Winner: selected
    Arbitration --> Loser: not_selected

    Winner --> RecordTurn: speak
    RecordTurn --> Idle: turn_recorded

    Loser --> Idle: skip
```

### 4.2 Job Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Queued: create()

    Queued --> Running: claim_next()
    Running --> Succeeded: complete()
    Running --> Failed: error
    Running --> TimedOut: timeout

    Failed --> Queued: retry (attempts < max)
    Failed --> [*]: max_retries_exceeded

    TimedOut --> Queued: retry
    Succeeded --> [*]: done
```

---

## 5. Cross-Cutting Concerns

### 5.1 Observability Integration

```mermaid
flowchart LR
    subgraph Components
        SCM[SCM]
        Arbiter[Arbiter]
        JobStore[JobStore]
        BehaviorLoader[BehaviorLoader]
    end

    subgraph VoyeurBus
        V1[scm.gate]
        V2[arbiter.selection]
        V3[job.state]
        V4[job.progress]
        V5[behavior.trigger.activated]
        V6[behavior.opener.selected]
        V7[behavior.idiom.injected]
    end

    SCM --> V1
    Arbiter --> V2
    JobStore --> V3
    JobStore --> V4
    BehaviorLoader --> V5
    BehaviorLoader --> V6
    BehaviorLoader --> V7
```

### 5.2 Security & Provenance

```mermaid
flowchart TD
    subgraph JobRecord
        J1[job_id: UUID]
        J2[agent_fingerprint: SHA-384]
        J3[signature: Ed25519]
        J4[vc: Vector Clock]
    end

    subgraph Verification
        V1[Verify Fingerprint]
        V2[Validate Signature]
        V3[Check Causality]
    end

    J2 --> V1
    J3 --> V2
    J4 --> V3
```

---

## 6. Agent Persona Mapping

### 6.1 Evaluation Panel Composition

```mermaid
mindmap
  root((Evaluation<br/>Panel))
    Ada
      Structural Elegance
      Composability
      Pattern Novelty
      Turn Priority: 0.75
      Mode: can_interject
    Lea
      Code Clarity
      Documentation
      DX Ergonomics
      Turn Priority: 0.65
      Mode: wait_for_mention
    Phil
      Success Probability
      Calibration
      Base Rates
      Turn Priority: 0.70
      Mode: can_interject
    David
      Overconfidence Risk
      Blind Spots
      Bias Detection
      Turn Priority: 0.90
      Mode: proactive_when_triggered
```

### 6.2 Agent Interaction Graph

```mermaid
graph TD
    subgraph "Structural Analysis"
        Ada[Ada<br/>Algorithmic Architect]
    end

    subgraph "Implementation Review"
        Lea[Lea<br/>Implementation Reviewer]
    end

    subgraph "Probability Assessment"
        Phil[Phil<br/>Forecast Analyst]
    end

    subgraph "Metacognitive Oversight"
        David[David<br/>Metacognitive Guardian]
    end

    Ada -->|structural scores| Lea
    Ada -->|pattern quality| Phil
    Lea -->|implementation quality| Phil

    David -.->|monitors for overconfidence| Ada
    David -.->|monitors for familiarity bias| Lea
    David -.->|checks calibration| Phil

    Phil -.->|provides base rates| David
```

---

## 7. Refactoring Opportunities

### 7.1 Identified Code Duplication

| Pattern | Files | Lines | Recommendation |
|---------|-------|-------|----------------|
| `weightedRandomSelect<T>()` | IdiomRegistry.ts, OpenerSelector.ts | ~15 each | Extract to `src/agents/system/utils/weighted-selection.ts` |
| `create*Context()` factory | 5 files | ~10 each | Create unified `ContextFactory` with generic builder |
| `Map<string, T>` cache pattern | 7 files | ~20 each | Create `CacheManager<K, V>` base class |
| `clear()` method | 5 files | ~5 each | Create `Clearable` interface |
| `recordTurn/recordUsage/recordActivation` | 4 files | ~10 each | Create `UsageTracker` mixin |
| `updateConfig/updatePolicy` | 2 files | ~5 each | Create `Configurable<T>` interface |
| `getMetrics/resetMetrics` | 2 files | ~10 each | Create `MetricsProvider` interface |

### 7.2 Proposed Utility Module

```typescript
// src/agents/system/utils/index.ts

/**
 * Shared utilities extracted from SCM components
 */

// Weighted random selection
export function weightedRandomSelect<T extends { weight: number }>(
  items: T[]
): T | null;

// Generic cache with TTL
export class TTLCache<K, V> implements Clearable {
  constructor(options: { ttlMs: number; maxSize?: number });
  get(key: K): V | undefined;
  set(key: K, value: V): void;
  clear(): void;
}

// Usage tracking mixin
export interface UsageTracker {
  recordUsage(id: string, cooldownSeconds?: number): void;
  checkCooldown(id: string): boolean;
  getCooldownRemaining(id: string): number;
}

// Metrics provider interface
export interface MetricsProvider<T> {
  getMetrics(): T;
  resetMetrics(): void;
}

// Clearable interface
export interface Clearable {
  clear(): void;
}
```

### 7.3 Refactoring Priority

| Priority | Task | Impact | Effort |
|----------|------|--------|--------|
| P1 | Extract `weightedRandomSelect` | High (removes 30 duplicate lines) | Low |
| P2 | Create `UsageTracker` mixin | Medium (standardizes tracking) | Medium |
| P3 | Create `MetricsProvider` interface | Medium (standardizes observability) | Low |
| P4 | Unify context factories | Low (improves consistency) | Medium |

---

## 8. Performance Characteristics

### 8.1 Latency Budget

| Component | Target | Measured |
|-----------|--------|----------|
| Gate evaluation | <5ms | ~2ms |
| Arbitration | <10ms | ~3ms |
| Trigger evaluation | <10ms | ~5ms |
| Opener selection | <5ms | ~1ms |
| Total routing | <50ms | ~15ms |

### 8.2 Memory Footprint

| Component | Memory Pattern | Mitigation |
|-----------|---------------|------------|
| Turn history | Growing array | Sliding window (10 min) |
| Job store | Persistent | File-backed with TTL |
| Idiom usage stats | Growing map | Periodic cleanup |
| Cooldown states | Growing map | TTL-based expiration |

---

## 9. Future Evolution

### 9.1 Planned Enhancements

1. **Async Pipeline**: Convert Gate → Plan → Realize to async for parallel evaluation
2. **Learning Loop**: Track which arbitration decisions led to good outcomes
3. **Dynamic Personas**: Allow runtime persona composition
4. **Cross-Session Memory**: Share learnings across evaluation sessions

### 9.2 Research Directions

Based on current AI literature:

1. **Debate Trees** (Fu & Gold, 2025): Hierarchical decomposition for truthfulness
2. **Trust-Weighted Consensus** (Shakya et al., 2025): Learning collaborative strategies
3. **Resilience to Faulty Agents** (Huang et al., 2025): Handling errors gracefully

---

## 10. References

1. Minsky, M. (1986). *The Society of Mind*. Simon and Schuster.
2. Du, Y. et al. (2023). "Improving Factuality and Reasoning through Multiagent Debate." ICML.
3. Chen, J. et al. (2024). "ReConcile: Round-Table Conference Improves Reasoning." ACL.
4. Hong, S. et al. (2024). "MetaGPT: Meta Programming for A Multi-Agent Collaborative Framework." ICLR.
5. Tran, K-T. et al. (2025). "Multi-Agent Collaboration Mechanisms: A Survey of LLMs." arXiv:2501.06322.
6. Sacks, H., Schegloff, E.A., & Jefferson, G. (1974). "A Simplest Systematics for Turn-Taking." *Language*, 50(4).
7. Brown, P. & Levinson, S.C. (1987). *Politeness: Some Universals in Language Usage*.

---

## Appendix A: File Inventory

| File | Lines | Purpose |
|------|-------|---------|
| `types.ts` | 821 | All TypeScript interfaces |
| `SharedConversationMiddleware.ts` | 471 | Gate/Plan/Realize pipeline |
| `AgentArbiter.ts` | 321 | Multi-agent winner selection |
| `TriggerEvaluator.ts` | 415 | Condition evaluation |
| `OpenerSelector.ts` | 267 | Weighted opener selection |
| `IdiomRegistry.ts` | 358 | Personality injection |
| `BehaviorLoader.ts` | 354 | Unified behavior management |
| `SCMRouting.ts` | 230 | Router entry point |
| `job_store.py` | 515 | Durable job persistence |
| `job_scheduler.py` | 479 | Job scheduling |
| **Total** | **~4,200** | |

---

*Document generated: January 15, 2026*

# Persona Layer and Linkage Plan (Horizontal 2 → Connection)

## 1) Persona Agents (Ada, Lea, Phil, David)
- Roles & evaluation dimensions
  - Ada (Algorithmic Architect): structuralElegance, composability, reasoningChainEfficiency, patternNovelty, crossDomainPotential, recommendations.
  - Lea (Implementation Reviewer): clarity, practicalApplicability, documentationQuality, developerErgonomics, edgeCaseHandling, recommendations.
  - Phil (Forecast Analyst): successProbability, confidenceCalibration, baseRateAlignment, falsifiability, updateMagnitude, brierScore?, recommendations.
  - David (Metacognitive Guardian): overconfidenceRisk, blindSpotDetection[], biasesIdentified[], selfAssessmentAccuracy, humilityScore, recommendations.
- Outputs (per evaluation): `scorecard` (typed per agent), `riskScore`, `recommendations[]`, `requiresHumanReview?`, `confidence`.

## 2) Hydration, Model Tiers, Tools, Memory Access
- Per-agent config fields:
  - `personaSource` (Replicants/legends/*.json)
  - `modelTier` (`local_slm`|`cloud_llm`|`hybrid`)
  - `contextWindow`
  - `defaultTools` (e.g., Ada: pattern_analysis, algorithm_design; Lea: code_review, doc_check; Phil: forecast_tracker, base_rate_lookup; David: bias_detector, blind_spot_scanner)
  - `memoryAccess` (`read`|`read_write`)
  - `telemetryLevel` (full|minimal)
- Suggested tiers:
  - Ada: hybrid (local for pattern match, cloud for synthesis), cw=8k
  - Lea: local_slm, cw=4k
  - Phil: hybrid, cw=8k
  - David: cloud_llm, cw=8k
- Memory:
  - Each persona writes/reads from Chrysalis memory stack with persona-scoped namespaces:
    - Episodic: evaluation sessions, decisions, conflicts.
    - Semantic: learned heuristics, bias patterns, base rates.
    - Procedural: evaluation playbooks, escalation rules.
  - Memory keying: `personaId / promptSetId / timestamp`.

## 3) API Key Registry (parallel to Agent Registry)
- Purpose: logical context and scoping for API keys (LLM, search, browser, memory) similar to agent registry context.
- Schema (conceptual):
  ```
  ApiKeyRecord {
    id: string;
    provider: 'openai' | 'anthropic' | 'ollama' | 'brave' | 'tavily' | 'exa' | 'browserbase' | 'firecrawl' | 'memory_system';
    description: string;
    scope: 'global' | 'persona' | 'service';
    allowedAgents?: AgentId[];
    allowedPersonas?: PersonaId[];
    rateLimit?: { rpm?: number; tpm?: number };
    expiresAt?: Date;
    tags?: string[];
  }
  ```
- Storage: registry alongside agent registry; .env.meta-cognitive-agents is assembled from allowed keys per persona/service at hydration time.
- Hydration step pulls allowed keys into persona runtime (no hard-coded keys).

## 4) Linkage to Adaptive LLM System (Horizontal 1)
- Inputs to persona evaluations:
  - Telemetry stream from LLM-adaptive layer: `{promptId, modelUsed, tokens, latency, cacheHit, confidence?, route, patternSummary (per pattern: e.g., error category/action, chain ordering, adapter mapping stats)}`
  - Prompt set metadata and versions from PromptRegistry.
- Workflow:
  1) Cadence triggers (weekly/monthly) and override triggers (user_flag, critical_issue, performance_threshold).
  2) Collect telemetry slices + prompt sets → fan-out to personas:
     - Ada: structure/composability
     - Lea: practicality/docs/ergonomics
     - Phil: probability/base rates/calibration
     - David: bias/overconfidence/blind spots
  3) EvaluationCoordinator aggregates:
     - Weighted scores, conflict detection, riskScore.
     - If `riskScore >= threshold` or conflicting recs → human sign-off path.
  4) Routing:
     - Low risk → Prompt Engineer auto-apply.
     - Medium → AI Engineer supervised.
     - High/critical → Human operator (chat UI) for approval.
  5) Feedback loop:
     - Outcomes recorded to persona memory; Phil updates calibration (Brier); David monitors drift; Ada captures new patterns; Lea updates docs guidance.

## 5) Human Interface (chat/front-end)
- Interaction states: `responsive`, `proactive`, `disengaged`; DND toggle with expiry; critical alerts can bypass if `riskScore >= criticalThreshold`.
- Conversation termination detection: thanks/done/dismissal patterns; on termination → summarize, record to memory, check pending evaluations.
- Human sign-off flow: escalation packet contains evaluations, riskScore, recommendations, deadline; chat surfaces approve/reject/modify/defer.

## 6) Audit / Observability / Health
- Decision log (per persona): `decisionType (evaluation|recommendation|escalation|override)`, `inputSummary`, `output`, `modelUsed`, `tokens`, `latency`, `confidence`, `telemetryRef`.
- Memory update log: belief/pattern/calibration updates with before/after snapshots.
- Health check: `healthScore`, `calibrationDrift`, `consistencyScore`, `failureCount`; reset triggers (e.g., drift > threshold, consecutive failures).
- Reset protocol: snapshot memory → reload persona → optionally restore selective learnings → log reset.

## 7) Mermaid Sketch (high level)
```mermaid
flowchart TD
  subgraph LLM_Adaptive_Layer
    PR[Prompt Registry]
    CR[Complexity Router]
    P1[Error/Perf/State/Chain/Adapter/Circuit/SelfHeal/Factory/Event]
    T[Telemetry Stream]
    PR --> CR --> P1 --> T
  end

  subgraph Persona_Layer
    ADA[Ada]
    LEA[Lea]
    PHIL[Phil]
    DAVID[David]
    EC[Evaluation Coordinator]
    MEM[Persona Memory (epi/sem/proc)]
    AK[API Key Registry]
    AK --> ADA & LEA & PHIL & DAVID
    T --> ADA & LEA & PHIL & DAVID
    ADA & LEA & PHIL & DAVID --> EC --> MEM
  end

  subgraph Human_Frontend
    CHAT[Chat UI]
    HUMAN[Operator]
  end

  T --> Persona_Layer
  EC --> CHAT
  CHAT --> HUMAN
  MEM --> ADA & LEA & PHIL & DAVID
```

## 8) Rollout (Horizontal-first)
1) Persona hydration configs + API key registry wiring + telemetry subscription from LLM-adaptive layer.
2) Implement evaluation coordinator, aggregation, routing, escalation; DND/interaction states; audit/logging.
3) Connect chat UI for human sign-off and summaries.
4) Calibrate thresholds (risk, override), enable reset protocol.

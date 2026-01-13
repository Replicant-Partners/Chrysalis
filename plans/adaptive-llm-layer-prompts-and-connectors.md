# Adaptive LLM Layer: Prompt Templates and Connector Spec (Horizontal 1)

## 1) Prompt Registry (IDs, Inputs, Outputs)

- **ERROR_CLASSIFICATION_PROMPT**  
  - Inputs: `error_type`, `message`, `stack_trace`, `endpoint`, `user_id`, `request_payload`, `recent_errors[]`, `system_health`, `similar_errors_today`.  
  - Outputs: `category` (transient|user_error|system_bug|external_dependency|security), `severity` (low|medium|high|critical), `root_cause`, `recommended_action` (retry|fail_fast|alert|self_heal|escalate), `user_message`, `internal_notes`.

- **PERFORMANCE_ANALYSIS_PROMPT**  
  - Inputs: `current_metrics`, `baseline_1h`, `baseline_24h`, `baseline_7d`, `time_of_day`, `day_of_week`, `recent_deployments`, `known_incidents`, `traffic_pattern`.  
  - Outputs: `health_status` (healthy|degraded|critical), `anomalies_detected[{metric,severity,explanation}]`, `trend_analysis`, `optimization_suggestions[{area,suggestion,impact}]`, `predicted_issues[{issue,probability,timeframe}]`, `recommended_actions` (none|investigate|scale|alert|rollback).

- **STATE_TRANSITION_PROMPT**  
  - Inputs: `currentState`, `event`, `entityData`, `availableTransitions`, `stateHistory[]`, `businessRules`, `similarCases[]`.  
  - Outputs: `nextState` (enum), `confidence`, `reasoning`, `sideEffects[]`, `warnings[]`.

- **CHAIN_ORCHESTRATION_PROMPT**  
  - Inputs: `request_summary`, `availableHandlers[{id,preconditions,cost,side_effects}]`, `context` (auth/user/tier/flags).  
  - Outputs: `selectedHandlers[]`, `ordering` (sequential|parallel|mixed), `skipReason`, `confidence`.

- **ADAPTER_TRANSLATION_PROMPT**  
  - Inputs: `agent_object`, `sourceProtocol_spec`, `targetProtocol_spec`, `mapping_principles`.  
  - Outputs: `translatedAgent`, `confidence`, `unmappedFields[]`, `warnings[]`.

- **CIRCUIT_BREAKER_PROMPT**  
  - Inputs: `recentFailures[]`, `dependencyHealth`, `recoveryPatterns`, `currentLoad`.  
  - Outputs: `recommendedState` (closed|open|half-open), `suggestedTimeout`, `alternativeRoutes[]`, `recoveryProbability`, `reasoning`.

- **SELF_HEALING_PROMPT**  
  - Inputs: `symptoms[]`, `systemMetrics`, `errorLogs`, `knownIssues`, `runbookKnowledge`, `previousFixes`, `systemArchitecture`.  
  - Outputs: `rootCause`, `confidence`, `remediationSteps[{action,target,parameters,risk}]`, `requiresHumanApproval`, `reasoning`.

- **AGENT_FACTORY_PROMPT**  
  - Inputs: `request.description`, `availableTypes[]`, `capabilitiesMatrix`, `userHistory`, `taskAnalysis`, `resourceBudget`.  
  - Outputs: `agentType`, `configuration`, `capabilities[]`, `reasoning`.

- **EVENT_INTERPRETATION_PROMPT**  
  - Inputs: `eventType`, `eventData`, `timestamp`, `source`, `recentEvents[]`, `subscriberInterests`, `correlatedEvents`.  
  - Outputs: `semanticMeaning`, `relevantSubscribers[]`, `priority` (low|normal|high|critical), `correlations[]`, `suggestedActions[]`.

- **RETRY_TUNING_PROMPT**  
  - Inputs: `policy` (backoff/limits), `recentFailures/latency`, `context` (endpoint class, dependency health, SLO).  
  - Outputs: `adjustedPolicy` (backoff/limits), `confidence`, `rationale`.

_All prompts are versioned artifacts with defined input/output schemas and linked to golden I/O tests._

## 2) Connector / Interface Spec

- **LLMAdapter.infer**(taskType, promptTemplateId, input, outputSchema, options?)  
  `options`: `{ modelHint?, latencyBudgetMs?, cachePolicy? (prefer_local|prefer_cloud|bypass_cache), telemetryContext? }`

- **ComplexityRouter**: chooses model tier based on task type/input size/latency budget; records route rationale.  
  - Local SLM: Ollama (e.g., Gemma 1B) via LocalConnector (low-latency classification/reason).  
  - Cloud LLMs: Claude, OpenAI via CloudConnector (heavier reasoning/synthesis).  
  - Cache layer keyed by `promptId + schemaVersion + hash(input)`; default fallback order: Local → Cloud → Cached (configurable).

- **Telemetry contract (per call)**:  
  `{ taskType, promptId, modelUsed, tokensIn, tokensOut, latencyMs, cacheHit, confidence?, route, inputSize, outputSchemaVersion, outcomeLabel? }`

- **Pattern wrapper contract**:  
  `gather system_data/context → call LLMAdapter with promptId/outputSchema → validate against invariants/guards → emit telemetry (per-call + pattern summary) → execute deterministic side effects.`

## 3) Observability and Governance Hooks

- Structured logs with optional redaction; per-pattern summary events (e.g., error: category/severity/action; chain: handlers + ordering).
- Prompt registry is versioned and enforces output schemas; golden tests for each prompt ID.

## 4) Rollout (Horizontal-First)

1) Install adapters/connectors/telemetry + prompt registry.  
2) Wire each pattern touchpoint to the adapter (shadow/read-only optional).  
3) Enable caching/fallbacks and model-tier routing.  
4) Add per-pattern guardrails/invariant checks.  
5) After horizontals are built, proceed to persona layer and linkage.
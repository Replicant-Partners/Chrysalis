## Builder Ecosystem Modernization Plan

### 1. Objectives
- Eliminate insecure credential-loading paths in KnowledgeBuilder and SkillBuilder.
- Introduce a SOLID-compliant memory adapter port so builders persist artifacts via the Fireproof stack.
- Reinforce AgentBuilder orchestration with resilient calls to downstream builders and deterministic reads from the memory adapter.
- Back the changes with integration tests and feature flags for controlled rollout.

### 2. Credential Handling Upgrade
1. Create a `CredentialProvider` interface inside `shared/api_core` that exposes `resolve_provider_keys(request)`.
2. Implement a Flask middleware binding (`CredentialsMiddleware`) that parses Authorization headers / API key headers once per request and injects results into `g.credentials`.
3. Update `projects/SkillBuilder/server.py` and `projects/KnowledgeBuilder/server.py` to consume the provider instead of reading `apiKeys` from request bodies; emit deprecation warnings if legacy fields are supplied.
4. Add unit tests under each service verifying: (a) env vars are untouched; (b) missing credentials raise `APIError` with `ErrorCode.AUTH_REQUIRED`.

### 3. Memory Adapter Refactor (SOLID Alignment)
1. Define `AgentMemoryPort` protocol (methods: `store_knowledge`, `store_skills`, `fetch_artifacts`, `record_metadata`).
2. Implement `FireproofMemoryAdapter` that wraps `AgentMemoryFactory` + `FireproofService`, translating builder artifacts into Fireproof `DocumentType`s and enforcing schema validation.
3. Extend `AgentMemoryFactory` to accept injected adapter strategy; default to Fireproof when `BUILDER_MEMORY_ENABLED=true`.
4. Provide DTO mappers in builders so pipeline outputs convert to the new schema before persistence (Single Responsibility: pipelines create data, adapter handles storage).

### 4. Builder Integration Updates
#### 4.1 KnowledgeBuilder (Step #1)
- Introduce a `BUILDER_MEMORY_ENABLED` feature flag (env var + Flask config) that determines whether the new adapter path runs.
- Extend `projects/KnowledgeBuilder/server.py` so each request constructs a `KnowledgeArtifactBatch`:
  - `agent_id`: derive from request credentials (API key hash) or fall back to a deterministic service ID when credentials absent in dev.
  - `run_id`: UUID per pipeline invocation; `builder_version`: pulled from `src/__init__.__version__`.
  - `artifacts`: map over `SimplePipeline.collect_and_store` outputs (entity metadata, embeddings, schema resolution attributes) ensuring completeness/quality/trust scores are propagated.
- Add a small `memory_port_factory` helper (under `projects/KnowledgeBuilder/src/memory/`) that instantiates `FireproofMemoryAdapter` using `AgentMemoryConfig` + `FireproofConfig.from_env()` to avoid server-level import churn.
- When the flag is enabled, `create_knowledge` should:
  1. Run the pipeline (existing behavior).
  2. Call `memory_port.store_knowledge(batch)` asynchronously (via `asyncio.run` wrapper or background thread) and record prompt metadata when telemetry is present.
  3. Fall back to current LanceDB/SQLite storage for non-enabled mode to preserve telemetry tests.
- Surface adapter failures as WARN logs but keep HTTP success unless `STRICT_MEMORY_PERSISTENCE=true` (future env toggle) to avoid blocking runs during rollout.

#### 4.2 SkillBuilder (Step #2)
- Mirror the flag + adapter wiring in `projects/SkillBuilder/server.py` and `skill_builder/pipeline/runner.py`.
- Inject credential-aware search providers (Web/GitHub/Hugging Face) before skill synthesis, forwarding any retrieved API keys to downstream collectors through the adapter metadata so auditing remains centralized.
- Persist each YAML-defined skill by constructing `SkillArtifactBatch` and invoking `store_skills` prior to returning the HTTP payload.

#### 4.3 AgentBuilder (Step #3)
- Refactor `src/core/AgentBuilder.ts` (and related orchestrators) to query persisted artifacts via `AgentMemoryPort.fetch_artifacts` instead of bespoke LanceDB readers.
- Expose a `/api/v1/agents/<id>/artifacts` endpoint backed by the port to allow deterministic replay and verification harnesses.

#### 4.4 Feature-flag discipline
- All three builder surfaces honor `BUILDER_MEMORY_ENABLED`; use `STRICT_CREDENTIAL_HEADERS` to enforce header-only credential intake.
- Add `STRICT_MEMORY_PERSISTENCE` (default false) for future hard enforcement once Fireproof coverage reaches 100%.

### 5. AgentBuilder Reinforcement
1. Wrap outbound HTTP calls to KnowledgeBuilder/SkillBuilder with retry + timeout helpers (e.g., exponential backoff, circuit breaker metrics).
2. After successful runs, persist aggregated agent artifacts via `AgentMemoryPort` for replayability.
3. Add `/api/v1/agents/<id>/artifacts` endpoint that reads from the memory adapter rather than in-memory dicts.

### 6. Testing & Verification
- **Unit**: Credential provider tests, adapter schema tests, Fireproof persistence.
- **Integration**: Spin up builders + AgentBuilder with `FireproofConfig.for_testing()`; run end-to-end agent creation ensuring Fireproof stores knowledge + skills.
- **Regression**: Legacy flows covered when `BUILDER_MEMORY_ENABLED=false`.

### 7. Rollout & Documentation
- Feature flags: `BUILDER_MEMORY_ENABLED`, `STRICT_CREDENTIAL_HEADERS`.
- Migration guide describing how to supply Authorization headers and enable the memory adapter.
- Update `memory_system/README.md` and service READMEs.

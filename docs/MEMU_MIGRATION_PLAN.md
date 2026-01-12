# Memu (Nevamind) Embedding Migration Plan

## Goals
- Deprecate Voyage embeddings; standardize on OpenAI format as interim and Memu/Nomic as primary.
- Integrate Memu memory system logic into Chrysalis memory architecture (all agents) without hard dependency on Memu-hosted DBs.
- Support Nomic vectors (Nomic API key available) as an alternative provider.
- Remove LanceDB from the primary path; keep only as optional fallback.
- Fix/avoid dimension mismatches across providers and storage.
- Rebuild and test embeddings and memory artifacts to mirror Memu structure.
- Update documentation accordingly.

## Current State
- Embedding providers: Voyage (primary), OpenAI (fallback), Deterministic (tests).
- Storage: LanceDB fixed-size vectors (1024 dims currently).
- Issue encountered: 3072-dim OpenAI embeddings inserted into 1024-dim LanceDB table caused Arrow cast failure. Added dimension coercion (truncate/pad) in `shared/embedding/service.py` to avoid mismatch.
- Consolidated artifacts backed up at `Replicants/legends/Embeddings/backups/20260111-154409/`.

## Target Architecture
- Providers:
  - **memu** (primary target): Memu embedding protocol and memory APIs.
  - **nomic** (alternative): Nomic embeddings via Nomic API key.
  - **openai** (interim): Standard OpenAI embeddings, no Voyage.
- Storage:
  - Memu-compatible storage API as primary.
  - Optional local compatibility layer (e.g., file/SQLite/Parquet) for offline use.
  - LanceDB removed from default path; kept only as optional legacy flag.
- Schema:
  - Align vector dimensions with Memu/Nomic provider dims; no truncation/padding in primary path.
  - Metadata parity with Memu memory schema (entity/skill identifiers, provenance, timestamps, tags, confidence).

## Migration Steps

### 1) Provider Layer
- Add `shared/embedding/providers/memu.py`:
  - Implement `EmbeddingProvider` interface: `embed`, `embed_batch`, `get_model_name`, `get_dimensions`, `estimate_cost`, `get_provider_name`.
  - Accept MEMU_API_KEY / endpoint; return native Memu dims.
- Add `shared/embedding/providers/nomic.py`:
  - Use Nomic API key; expose dimensions from model (e.g., `nomic-embed-text-v1` or configured).
- Update `shared/embedding/service.py`:
  - Remove Voyage selection; allowed providers: memu, nomic, openai, deterministic.
  - Selection priority: forced provider via `EMBEDDING_PROVIDER`; otherwise memu > nomic > openai > deterministic.
  - Remove dimension coercion on primary path; keep safe-coercion only for legacy/optional fallback (explicit flag).
  - Expose `get_provider_info` to report memu/nomic dims.

### 2) Memory/Storage Layer
- Add Memu storage adapter under `memory_system` (e.g., `memory_system/stores/memu_store.py`):
  - Write/read embeddings and metadata using Memu protocol.
  - Support optional local store mode mirroring Memu schema (Parquet/SQLite) for offline.
- Deprecate LanceDB usage in KnowledgeBuilder/SkillBuilder default paths:
  - Replace LanceDB client wiring with Memu store (or local Memu-compatible store).
  - Keep LanceDB behind a feature flag `LEGACY_LANCEDB=1` for rollback.

### 3) Pipelines (KB/SB)
- KnowledgeBuilder: in `src/pipeline/simple_pipeline.py` and storage wiring, swap LanceDB client for Memu store; ensure vector dimensions match provider dims.
- SkillBuilder: in `skill_builder/pipeline/runner.py`, set embedder to Memu/Nomic; ensure any downstream storage uses Memu store.
- Remove Voyage-specific rate limiting/config; reuse OpenAI/Memu/Nomic rate limits if needed.

### 4) Configuration
- New env flags:
  - `EMBEDDING_PROVIDER` ∈ {memu, nomic, openai, deterministic}
  - `MEMU_API_KEY`, `MEMU_ENDPOINT`
  - `NOMIC_API_KEY`, `NOMIC_MODEL` (optional)
  - `LEGACY_LANCEDB` (optional fallback)
- Update defaults to `memu` when keys are present; otherwise `openai`; never `voyage`.

### 5) Dimension & Schema Alignment
- Set Memu store schema to Memu/Nomic dimensions (no truncation).
- For OpenAI interim, set schema to OpenAI dims (e.g., 3072) when Memu/Nomic are absent.
- Remove hard-coded 1024 LanceDB vector_dim in primary path.

### 6) Testing & Validation
- Unit: provider stubs for memu/nomic; storage adapter tests (local mode).
- Integration (subset): run 3 legends through KB/SB with memu provider → verify inserts, consolidated outputs, no dimension coercion logs.
- Full run: all 49 legends with memu provider; regenerate `all_embeddings.json`, `all_skills.json`, `all_personas.json`.
- Regression: legacy flag path with LanceDB (optional) to ensure no breakage if enabled.

### 7) Documentation
- Update `docs/MEMU_MIGRATION_PLAN.md` (this file) after implementation details finalize.
- Update embedding configuration docs, KB/SB READMEs, and TROUBLESHOOTING to remove Voyage and describe Memu/Nomic/OpenAI selection.
- Note backups location and deprecation of LanceDB/Voyage.

## Open Questions / Assumptions
- Memu embedding API surface (exact request/response schema) and vector dimensions—will implement from available Memu open-source reference.
- Memu storage protocol: expecting HTTP/GRPC endpoints; if absent, implement local mirror schema with Parquet/SQLite + index (FAISS/Qdrant-lite) as compatibility.
- Cost/telemetry hooks: need Memu cost model or mark as unknown; add telemetry events for provider usage.

## Execution Order
1) Implement providers (memu, nomic) + service selection changes.
2) Implement Memu store adapter and wire KB/SB storage to it; guard LanceDB behind feature flag.
3) Align schemas/dimensions; remove Voyage; set defaults.
4) Run subset validation, then full 49-legends two-pass.
5) Update docs and finalize consolidated artifacts.
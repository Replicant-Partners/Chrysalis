# Chrysalis Agentic Memory Migration Plan (Nomic + Zep, Beads)

## Goals
- Remove all Memu/Voyage references from code and docs.
- Standardize embeddings on Nomic (primary), OpenAI (fallback), Deterministic (tests).
- Model long-term memory as KG + embeddings, synced to Zep; short-term/context as Beads (text-blob chain).
- Provide distributed/local-first architecture with cloud sync (Zep for KG/embeddings, object storage for blobs).
- Align SkillBuilder/Knowledge pipelines with the new providers and stores.

## Current State (post-initial refactor)
- Providers: Nomic primary, OpenAI fallback, Deterministic (forced via EMBEDDING_PROVIDER).
- Memu provider file removed.
- SkillBuilder wrapper defaults to Nomic.
- memory_system README largely updated; provider chain diagram still shows Nomic path.
- Zep integration pending; Beads store and sync stubs pending.

## Target Architecture
- Providers: Nomic → OpenAI → Deterministic.
- Long-term memory: Knowledge Graph (local GraphStore networkx/sqlite) + embeddings (local + Zep).
- Short-term/context: Beads (append-only text blobs with span refs), local-first with optional blob offload to object storage and KG pointers.
- Persona/Skills: JSON files linked; skills carry embeddings and KG nodes; persona links skill IDs and embedding IDs.
- Distributed sync: CRDT + vector clocks; push/pull with Zep (KG + vector index) and blob store for Beads/context/persona/skills snapshots.

## Migration Steps
1) Provider Layer
- Ensure shared/embedding/service.py defaults to Nomic dims/model, removes Memu references, and reports provider info without Memu flags.
- Keep forced provider via EMBEDDING_PROVIDER ∈ {nomic, openai, deterministic}.

2) Storage / Sync Layer
- Configure Zep as cloud KG + vector index; keep local GraphStore + local embedding cache (sqlite/Parquet + faiss-lite/sqlite-vec).
- Add Beads store (LMDB/sqlite) with optional blob offload; KG nodes point to blob URIs.

3) Pipelines (KB/SB)
- SkillBuilder: use shared EmbeddingService defaults (Nomic). Ensure downstream storage is Zep/local, no Memu/LanceDB.
- KnowledgeBuilder: same provider ordering; remove legacy LanceDB hard-coding.

4) Configuration
- ENV: NOMIC_API_KEY, NOMIC_MODEL (optional), OPENAI_API_KEY, EMBEDDING_PROVIDER, ZEP_ENDPOINT (for KG/vector), BLOB_STORE_URI (optional), LEGACY_LANCEDB=0 (default).

5) Dimension & Schema Alignment
- Nomic dims default 768; OpenAI fallback 3072; deterministic matches requested dims.
- No truncation/padding in primary path; allow optional coercion only for legacy flags.

6) Testing & Validation
- Unit: provider selection, deterministic fallback, dimension validation.
- Integration: ingest→chunk→embed→upsert KG+vector (local+Zep mock/stub), bead append, retrieval fusion (beads+emb+KG).
- Regression: deterministic-only forced provider for offline tests.

## Decommissioned Items
- Memu provider and any Memu storage adapters.
- Voyage references.
- LanceDB as default (keep only behind LEGACY_LANCEDB if still needed elsewhere; otherwise plan removal).

## Docs to Update
- memory_system/README.md (provider chain diagram now Nomic→OpenAI→Deterministic).
- SkillBuilder/KB pipeline docs.
- New design doc: AGENTIC_MEMORY_DESIGN.md (persona/skills/Beads/KG/embeddings, APIs, sync flows).

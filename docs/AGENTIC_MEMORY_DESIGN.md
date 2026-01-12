# Chrysalis Agentic Memory Design (Persona + Skills + Beads + KG/Embeddings with Zep)

## Objectives
- Treat long-term memory as **KG + embeddings** (Nomic primary, OpenAI fallback, deterministic for tests).
- Treat short-term/context as **Beads**: append-only text blobs (turns, tool outputs) with span references.
- Distributed/local-first: keep local caches (embeddings, KG slice, skills, persona, beads) and sync to cloud (Zep for KG/vector; object storage for blobs/persona/skills snapshots).
- Remove MemU/Voyage; Zep/RDF/Beads are the plan-of-record (Plan A/B).
- Provide clear data models, APIs, and builder functions to accumulate knowledge over time.

## Data Models (JSON/Pydantic-friendly)
- **Persona**: `{id, name, version, description, goals[], norms[], skills:[skill_id], traits, embeddings:[embedding_id], vc, crdt}`
- **Skill**: `{id, name, description, signature/schema, examples, embedding_id, version, vc, crdt, tags}`
- **Bead** (short-term/context): `{id, ts, role, content, source, turn_id, importance, span_refs[], blob_uri?, vc}`
- **Embedding**: `{id, text_hash, vector?, model, dims, provider, created_at, source, span_refs[], cost_est, vc}` (vector stored locally/Zep; pointer if remote)
- **KG Node**: `{id, type, labels[], metadata, version, vc, crdt}`
- **KG Edge**: `{id, source, target, predicate, weight, evidence, vc, crdt}`
- **Blob pointer**: `{id, uri, size, checksum, created_at, retention_ttl}`

## Storage and Indexing
- **Local**: GraphStore (networkx or sqlite), embeddings in sqlite/Parquet + local ANN (faiss-lite or sqlite-vec), beads in LMDB/sqlite with optional blob offload, persona/skills as JSON.
- **Cloud**: Zep KG + vector index; object storage for beads/context/persona/skills snapshots.

## Provider Strategy
- Primary: **Nomic** (`NOMIC_API_KEY`, model default `nomic-embed-text-v1`, dims 768).
- Fallback: **OpenAI** (`OPENAI_API_KEY`, dims 3072).
- Tests/offline: **Deterministic** (forced via `EMBEDDING_PROVIDER=deterministic`).

## APIs (proposed)
- `embed(text, meta) -> embedding_id`: uses EmbeddingService (Nomic→OpenAI→Deterministic).
- `upsert_embeddings(batch)`: local + Zep vector.
- `upsert_kg(nodes, edges)`: local + Zep KG.
- `upsert_bead(bead)`: append to bead store; optional blob offload; return bead_id.
- `retrieve(query, k, strategy={fusion|emb|kg|beads})`: returns ranked items + provenance.
- `get_persona()/put_persona()`, `get_skill()/put_skill()`.
- `sync(push|pull, ranges)`: CRDT + vector-clock merge with Zep and blob store.
- Builder helpers:
  - `load_persona_and_skills(paths) -> persona, skills`
  - `init_memory_stores(cfg) -> {graph_store, emb_store, bead_store, ann_index}`
  - `ingest_chunks(chunks, meta) -> embeddings + kg updates + beads`
  - `append_bead(bead)` and `append_blob_bead(bead, blob_uri)`
  - `retrieve_context(query) -> {beads, kg_facts, emb_hits, skills}`
  - `sync_all(push=True, pull=True)`

## Ingestion Flow
1) Parse/convert → chunk (document/code) → semantic triples (optional) → embed chunks (Nomic)  
2) Upsert embeddings locally + Zep; upsert KG nodes/edges locally + Zep.  
3) Create beads referencing spans/ids; offload large content to blob store and link via blob pointer.  
4) Link skills/persona by IDs in KG (node type=skill/persona) and to embeddings.

## Retrieval (Fusion)
1) Beads: last N by recency/importance within token budget.  
2) Embeddings: ANN local → fallback to Zep; rerank with recency/source.  
3) KG: expand 1–2 hops from embedding-hit node ids (predicates: uses/depends_on/similar_to); include linked skills/tools.  
4) Fusion score: `w_emb*sim + w_recency*decay + w_graph*edge_weight/degree + w_importance`; dedup; enforce token budget; return with provenance.

## Sync / Replication
- Local-first; outbound op queue with vector clocks.
- Push every 60s or after N ops/size; pull every 120s or on cache miss.
- Conflict resolution: CRDT set/2P-set for nodes/edges; LWW for scalars; embeddings last-write by vc+checksum; beads are append-only.
- Gossip optional for peer fanout; cloud (Zep + blob store) is convergence point.

## SLOs
- Retrieval p95: local < 250ms; remote-assisted < 700ms.  
- Sync success > 99%; no data loss under transient network (durable queue + backoff).

## Migration Notes
- MemU provider removed; Voyage removed.  
- Defaults: Nomic 768 dims, OpenAI 3072 fallback.  
- Keep `LEGACY_LANCEDB` off by default; if present elsewhere, guard behind feature flag.  
- Update docs (this file, memory_system/README, pipeline READMEs).  

## Minimal Stub Plan (code follow-ups)
- Add bead store module (LMDB/sqlite) with append/get-last-N and optional blob-offload helper.
- Add persona/skills loader util (read JSON, validate schema, compute embeddings if missing).
- Add sync worker skeleton (push/pull hooks for Zep KG/vector + blob store).

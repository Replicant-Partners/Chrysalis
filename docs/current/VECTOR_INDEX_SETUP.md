# Vector Index Setup (HNSW/LanceDB)

> **Note**: Qdrant support was removed in January 2026. Use LanceDB for persistent storage or ArangoDB for graph+vector hybrid needs.

## Quick Picks
- **Local dev**: `VECTOR_INDEX_TYPE=hnsw` + `npm install hnswlib-node` (falls back to brute force if missing).
- **Embedded persistent**: `VECTOR_INDEX_TYPE=lance` + `npm install lancedb` (+ optional `LANCEDB_PATH`).
- **Graph + Vector hybrid**: Use ArangoDB with its native vector search capabilities.

## Environment Variables
- `VECTOR_INDEX_TYPE`: `hnsw | lance | brute` (default: `hnsw` with fallback).  
- `VECTOR_COLLECTION`: collection/table name (default: `memories`).  
- `VECTOR_DIM`: embedding dimension override.  
- HNSW tuning: `HNSW_MAX_ELEMENTS`, `HNSW_EF_SEARCH`, `HNSW_M`.  
- LanceDB: `LANCEDB_PATH` (default `.lancedb`).  
- Metrics: `METRICS_PROMETHEUS=true` (`METRICS_PROM_PORT`), `METRICS_OTEL=true`.

## Wiring
- `vectorIndexFromEnv()` in `src/memory/VectorIndexFactory.ts` builds config from env.  
- `MemoryMerger` accepts `vector_index_type` and `vector_index_options`; defaults will try HNSW then brute-force.

## Operational Notes
- HNSW is in-memory; snapshot manually if you need durability.  
- LanceDB stores on disk; good for local persistence and KnowledgeBuilder/SkillBuilder pipelines.
- Instrumentation: `MemoryMerger` can report `vector.query` / `vector.upsert` latency via `metrics` callback; wire this to logs/OTel/Prometheus as needed.

## Migration from Qdrant (Historical)
If you have existing Qdrant data:
1. Export vectors using Qdrant's scroll API
2. Import to LanceDB using `lancedb.write_table()`
3. Update environment: `VECTOR_INDEX_TYPE=lance`

## Architecture Decision
LanceDB was chosen as the primary persistent vector store because:
- Zero infrastructure (embedded, file-based)
- Native support in Python and TypeScript
- Excellent integration with KnowledgeBuilder/SkillBuilder pipelines
- Arrow-native format for efficient columnar storage

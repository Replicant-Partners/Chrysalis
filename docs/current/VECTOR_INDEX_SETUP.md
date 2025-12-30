# Vector Index Setup (HNSW/LanceDB/Qdrant)

## Quick Picks
- **Local dev**: `VECTOR_INDEX_TYPE=hnsw` + `npm install hnswlib-node` (falls back to brute force if missing).
- **Embedded persistent**: `VECTOR_INDEX_TYPE=lance` + `npm install lancedb` (+ optional `LANCEDB_PATH`).
- **Cloud/self-hosted**: `VECTOR_INDEX_TYPE=qdrant` + `npm install @qdrant/js-client-rest` + set `QDRANT_URL`/`QDRANT_API_KEY`.

## Environment Variables
- `VECTOR_INDEX_TYPE`: `hnsw | lance | qdrant | brute` (default: `hnsw` with fallback).  
- `VECTOR_COLLECTION`: collection/table name (default: `memories`).  
- `VECTOR_DIM`: embedding dimension override.  
- HNSW tuning: `HNSW_MAX_ELEMENTS`, `HNSW_EF_SEARCH`, `HNSW_M`.  
- LanceDB: `LANCEDB_PATH` (default `.lancedb`).  
- Qdrant: `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION`.
- Metrics: `METRICS_PROMETHEUS=true` (`METRICS_PROM_PORT`), `METRICS_OTEL=true`.

## Wiring
- `vectorIndexFromEnv()` in `src/memory/VectorIndexFactory.ts` builds config from env.  
- `MemoryMerger` accepts `vector_index_type` and `vector_index_options`; defaults will try HNSW then brute-force.

## Operational Notes
- HNSW is in-memory; snapshot manually if you need durability.  
- LanceDB stores on disk; good for local persistence.  
- Qdrant adds network latency; set a sensible `minScore` and cache embeds to reduce calls.  
- Instrumentation: `MemoryMerger` can report `vector.query` / `vector.upsert` latency via `metrics` callback; wire this to logs/OTel/Prometheus as needed.

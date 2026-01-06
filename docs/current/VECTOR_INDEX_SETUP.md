# Vector Index Setup (HNSW/LanceDB/ArangoDB)

> **Note**: Qdrant support was removed in January 2026. LanceDB is the default for embedded persistence; ArangoDB is the recommended fallback for production/distributed deployments.

## Quick Picks
- **Local dev**: `VECTOR_INDEX_TYPE=hnsw` + `npm install hnswlib-node` (falls back to brute force if missing).
- **Embedded persistent**: `VECTOR_INDEX_TYPE=lance` + `npm install lancedb` (+ optional `LANCEDB_PATH`).
- **Production/Distributed**: ArangoDB with native vector search (powered by FAISS).

## Environment Variables
- `VECTOR_INDEX_TYPE`: `hnsw | lance | arango | brute` (default: `hnsw` with fallback).  
- `VECTOR_COLLECTION`: collection/table name (default: `memories`).  
- `VECTOR_DIM`: embedding dimension override.  
- HNSW tuning: `HNSW_MAX_ELEMENTS`, `HNSW_EF_SEARCH`, `HNSW_M`.  
- LanceDB: `LANCEDB_PATH` (default `.lancedb`).  
- ArangoDB: `ARANGO_URL`, `ARANGO_DATABASE`, `ARANGO_USERNAME`, `ARANGO_PASSWORD`.
- Metrics: `METRICS_PROMETHEUS=true` (`METRICS_PROM_PORT`), `METRICS_OTEL=true`.

## Wiring
- `vectorIndexFromEnv()` in `src/memory/VectorIndexFactory.ts` builds config from env.  
- `MemoryMerger` accepts `vector_index_type` and `vector_index_options`; defaults will try HNSW then brute-force.

## Operational Notes
- HNSW is in-memory; snapshot manually if you need durability.  
- LanceDB stores on disk; good for local persistence and KnowledgeBuilder/SkillBuilder pipelines.
- ArangoDB provides scalable vector search with graph traversal support for production deployments.
- Instrumentation: `MemoryMerger` can report `vector.query` / `vector.upsert` latency via `metrics` callback; wire this to logs/OTel/Prometheus as needed.

## ArangoDB Vector Search (Recommended Fallback)

ArangoDB provides native vector search capabilities powered by Facebook's FAISS library:

### Features
- **FAISS Integration**: High-performance approximate nearest neighbor search
- **Multi-model Queries**: Combine vector search with graph traversals in single AQL queries
- **GraphRAG Support**: Enhanced RAG with knowledge graph context
- **Entity Resolution**: Built-in entity clustering via similarity search
- **LangChain Integration**: Use `langchain-arangodb` package with `ArangoVector` class

### Setup
```bash
# Install Python client
pip install arango-datasets langchain-arangodb

# Or use Docker
docker run -p 8529:8529 -e ARANGO_ROOT_PASSWORD=password arangodb/arangodb
```

### Example AQL Vector Query
```aql
FOR doc IN memories
  LET similarity = COSINE_SIMILARITY(doc.embedding, @query_embedding)
  FILTER similarity >= 0.8
  SORT similarity DESC
  LIMIT 10
  RETURN { doc, similarity }
```

### LangChain Integration
```python
from langchain_arangodb import ArangoVector
from langchain_openai import OpenAIEmbeddings

vectorstore = ArangoVector(
    embedding=OpenAIEmbeddings(),
    database_name="chrysalis",
    collection_name="memories"
)

# Search with graph context
results = vectorstore.similarity_search("query text", k=5)
```

## Fallback Chain

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    HNSW     │ ──▶ │   LanceDB   │ ──▶ │  ArangoDB   │ ──▶ │ Brute-Force │
│  (in-memory)│     │ (file-based)│     │ (distributed)│     │  (fallback) │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
     Fast            Persistent         Production          Always works
     No deps         Zero infra         Graph+Vector        O(n) search
```

### Recommended Usage
| Use Case | Recommended Store |
|----------|------------------|
| Local development | HNSW (fast, in-memory) |
| KnowledgeBuilder/SkillBuilder pipelines | LanceDB (file-based) |
| Production with graph needs | ArangoDB (FAISS + graph) |
| Edge/offline deployment | LanceDB |
| Large-scale RAG | ArangoDB with GraphRAG |

## Migration Guide

### From Qdrant to LanceDB (Local)
1. Export vectors using Qdrant's scroll API
2. Import to LanceDB using `lancedb.write_table()`
3. Update environment: `VECTOR_INDEX_TYPE=lance`

### From LanceDB to ArangoDB (Production)
1. Export LanceDB table to JSON/Arrow
2. Create ArangoDB collection with vector index
3. Import documents with embeddings
4. Update environment: `VECTOR_INDEX_TYPE=arango`

## Architecture Decision

**LanceDB** chosen as default embedded vector store because:
- Zero infrastructure (embedded, file-based)
- Native support in Python and TypeScript
- Excellent integration with KnowledgeBuilder/SkillBuilder pipelines
- Arrow-native format for efficient columnar storage

**ArangoDB** chosen as production fallback because:
- Native FAISS-powered vector search
- Multi-model database (graph + document + vector)
- GraphRAG capabilities for context-aware retrieval
- Enterprise-grade scalability and security
- Single query language (AQL) for all data models

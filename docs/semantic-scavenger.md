# Semantic Scavenger Report

**Generated:** 2026-01-06  
**Scope:** Local repositories in ~/Documents/GitClones/  
**Purpose:** Identify semantic operations for potential consolidation into unified service

---

## Executive Summary

This report catalogs semantic operations across the Replicant-Partners ecosystem for potential consolidation. Key findings reveal **5 major capability categories** with significant overlap opportunities.

### Consolidation Priority Matrix

| Priority | Category | Components | Consolidation Benefit |
|----------|----------|------------|----------------------|
| 🔴 High | Triple Decomposition | 3 implementations | Single SPO extractor |
| 🔴 High | Graph Storage | 2 implementations | Unified graph backend |
| 🟡 Medium | Embedding Generation | 4 implementations | Shared embedding service |
| 🟡 Medium | LSP Symbol Resolution | 2 implementations | Centralized symbol index |
| 🟢 Low | Content Converters | 3 implementations | Domain-specific ok |

---

## 1. Semantic Decomposition (Triple Extraction)

### 1.1 SkyPrompt Decomposer
**Location:** `SkyPrompt/src/decomposer.py`  
**Architecture:** Ollama-first with spaCy/Tree-sitter fallback

```python
# Core pattern
class Decomposer:
    async def decompose(text: str) -> Dict[str, Any]:
        # Returns SemanticFrame with:
        # - intent: DEBUG|REFACTOR|CREATE|EXPLAIN|TEST
        # - target: code entity reference
        # - triples: [[Subject, Predicate, Object], ...]
        # - confidence: 0.0-1.0 calibrated
```

**Key Features:**
- Grammar-constrained JSON via Ollama `format=json_schema`
- Token limit checking with `check_token_limit()`
- Confidence calibration via `ConfidenceCalibrator`
- Fallback to keyword-based heuristics

**Dependencies:** ollama, spacy, tree-sitter-languages

### 1.2 MetaSemantic Prompt Decomposer
**Location:** `MetaSemantic/backend/prompt_decomposer.py`  
**Architecture:** Pure spaCy NLP

```python
class PromptDecomposer:
    def decompose(text: str) -> List[Dict[str, str]]:
        # Returns [{"subject": ..., "predicate": ..., "object": ...}]
        # Uses dependency parsing: nsubj → VERB → dobj
```

**Key Features:**
- Compound phrase extraction (`_get_compound_phrase`)
- Subject-Verb-Object pattern matching
- No LLM dependency (faster, deterministic)

**Dependencies:** spacy (en_core_web_sm)

### 1.3 Chrysalis KnowledgeBuilder
**Location:** `Chrysalis/memory_system/knowledgebuilder/`  
**Architecture:** LLM-powered entity/relation extraction

```python
# process_document() pipeline:
# 1. LLM extracts entities + relations from text
# 2. Store in LanceDB (vector) + SQLite (metadata)
# 3. Build knowledge graph with confidence scores
```

**Dependencies:** litellm, lancedb, sentence-transformers

### Consolidation Recommendation

```
┌─────────────────────────────────────────────────────┐
│           Unified Triple Decomposer                  │
├─────────────────────────────────────────────────────┤
│  Input: Raw text/code                               │
│                                                     │
│  Strategy Selection:                                │
│  ├─ Code → Tree-sitter AST parsing                  │
│  ├─ Natural Language → spaCy dependency parsing     │
│  └─ Complex/Ambiguous → LLM (Ollama/LiteLLM)       │
│                                                     │
│  Output: Normalized SemanticFrame                   │
│  {intent, target, triples[], confidence}            │
└─────────────────────────────────────────────────────┘
```

---

## 2. Knowledge Graph Storage

### 2.1 Ludwig KnowledgeGraphDB
**Location:** `Ludwig/src/ludwig/graph/storage.py`  
**Backend:** SQLite with normalized schema

```sql
-- Schema
entities (id, name, type, source_file, metadata JSON)
relationships (source, relation, target, source_file, line_number, metadata)
parsed_files (file_path, title, parsed_at, entity_count, relationship_count)

-- Key operations
batch_add_entities() -- with metadata merge
batch_add_relationships() -- with deduplication
query_outgoing(source, relation) -> targets
query_incoming(target, relation) -> sources
```

**Features:**
- Metadata merging on upsert
- Full-text indexing on entity names
- Migration support via `MigrationRunner`

### 2.2 SkyPrompt GraphStore  
**Location:** `SkyPrompt/src/graph_store.py`  
**Backend:** NetworkX (in-memory) + External JSON context

```python
class GraphStore:
    graph: nx.DiGraph  # In-memory graph
    embeddings: List[Dict]  # From external context
    
    async def find_related(entity_name, depth=1, max_results=100):
        # BFS traversal with fuzzy matching
        # Falls back to embedding search
    
    def _load_external_context(path):
        # Loads {nodes, edges, embeddings, metadata} from JSON
```

**Features:**
- LSP symbol resolution via `LspResolver`
- Tree-sitter code indexing
- Fuzzy node matching with similarity scoring
- Embedding-backed search fallback

### 2.3 External Knowledge: YAGO Client
**Location:** `Ludwig/src/ludwig/external/yago_client.py`  
**Backend:** SPARQL queries to YAGO 4.5

```python
class YAGOClient:
    ENDPOINT = "https://yago-knowledge.org/sparql"
    
    def resolve_entity(name) -> List[YAGOEntity]:
        # Returns URI, label, Schema.org type, description
    
    def get_entity_facts(uri) -> Dict[str, List[str]]:
        # Returns property → values mapping
```

**Features:**
- SQLite query caching (30-day TTL)
- Wikidata fallback if YAGO down
- Schema.org type alignment

### Consolidation Recommendation

```
┌─────────────────────────────────────────────────────────┐
│              Unified Graph Service                       │
├─────────────────────────────────────────────────────────┤
│  Storage Backends (pluggable):                          │
│  ├─ SQLite (Ludwig) - file-based, portable              │
│  ├─ ArangoDB - distributed, multi-model                 │
│  └─ NetworkX - in-memory, fast traversal                │
│                                                         │
│  External Knowledge:                                    │
│  ├─ YAGO 4.5 (Schema.org aligned)                       │
│  └─ Wikidata (fallback)                                 │
│                                                         │
│  API:                                                   │
│  ├─ add_entity(name, type, metadata)                    │
│  ├─ add_relationship(source, predicate, target)         │
│  ├─ query(pattern) → results                            │
│  └─ resolve_external(name) → YAGO/Wikidata entities     │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Vector/Embedding Operations

### 3.1 SemanticLadder Embedder
**Location:** `SemanticLadder/src/ingestion/embedder.py`

```python
class Embedder:
    model: SentenceTransformer  # all-MiniLM-L6-v2
    device: str  # cuda/mps/cpu auto-detect
    
    def embed_text(text) -> np.ndarray
    def embed_batch(texts) -> np.ndarray  
    def embed_chunks(chunks) -> List[Chunk]  # In-place embedding
    def embed_query(query) -> np.ndarray
```

**Features:**
- Auto device detection (CUDA/MPS/CPU)
- Batch processing with progress logging
- Normalized embeddings for cosine similarity

### 3.2 Ludwig Embedding Storage
**Location:** `Ludwig/src/ludwig/embeddings/storage.py`

```python
# Stores embeddings with LanceDB
# Supports similarity search
# Trainer at embeddings/trainer.py
```

### 3.3 Chrysalis LanceDB Integration
**Location:** `Chrysalis/memory_system/knowledgebuilder/lancedb_client.py`

```python
class LanceDBClient:
    def list_tables() -> List[str]
    def create_table(name, schema, data)
    def add_records(table, records)
    def search(table, query_vector, limit)
```

### 3.4 Vector Index Implementations
**Location:** `Chrysalis/src/memory/adapters/`

- `HNSWVectorIndex.ts` - HNSW algorithm (primary)
- `LanceDBVectorIndex.ts` - LanceDB wrapper

### Consolidation Recommendation

```
┌─────────────────────────────────────────────────────┐
│           Unified Embedding Service                  │
├─────────────────────────────────────────────────────┤
│  Models:                                            │
│  ├─ all-MiniLM-L6-v2 (default, fast)               │
│  ├─ all-mpnet-base-v2 (higher quality)             │
│  └─ Custom fine-tuned (domain-specific)            │
│                                                     │
│  Storage:                                           │
│  ├─ LanceDB (default, columnar)                    │
│  ├─ HNSW (in-memory, fast search)                  │
│  └─ ArangoDB (integrated with graph)               │
│                                                     │
│  API:                                               │
│  ├─ embed(text) → vector                           │
│  ├─ embed_batch(texts) → vectors                   │
│  ├─ store(id, vector, metadata)                    │
│  └─ search(query, k) → [(id, score, metadata)]     │
└─────────────────────────────────────────────────────┘
```

---

## 4. Information-Theoretic Analysis

### 4.1 Ludwig Shannon Evaluator
**Location:** `Ludwig/src/ludwig/evaluators/shannon.py`

```python
class ShannonEvaluator(BaseEvaluator):
    def evaluate(context) -> EvaluationResult:
        observations = [
            self._analyze_redundancy(context),      # Duplicate patterns
            self._analyze_information_density(context),  # High/low density
            self._detect_noise(context),            # Signal-to-noise ratio
            self._analyze_entropy(context),         # Shannon entropy
            self._identify_compression_opportunities(context)
        ]
```

**Metrics:**
- **Redundancy**: Duplicate triples, identical relationship patterns
- **Information Density**: Unique relations per entity
- **Noise Detection**: Short names, generic terms
- **Entropy**: Shannon entropy of relationship types
- **Compression**: Concept groups for abstraction

**Unique Value:** This is the only information-theoretic evaluator in the ecosystem. Should be extracted as a standalone library.

---

## 5. Content Converters

### 5.1 LibraryLadder Converters
**Location:** `LibraryLadder/src/library_ladder/converters/`

| Converter | Input | Output | Features |
|-----------|-------|--------|----------|
| `text_to_md.py` | Plain text | Markdown | Chapter detection, Gutenberg cleanup |
| `html_to_md.py` | HTML | Markdown | Structure preservation |
| `epub_to_md.py` | EPUB | Markdown | Multi-file extraction |

**Pattern:**
```python
class ContentConverter:
    @property
    def supported_formats(self) -> list[str]
    def convert(content: bytes, metadata: dict) -> str
```

### 5.2 Ludwig Markdown Parser
**Location:** `Ludwig/src/ludwig/parsers/markdown.py`

Extracts structure from markdown for knowledge graph ingestion.

---

## 6. LSP/Symbol Resolution

### 6.1 SkyPrompt LspResolver
**Location:** `SkyPrompt/src/lsp_resolver.py`

```python
class LspResolver:
    def resolve(name: str) -> Optional[Dict]:
        # Returns {name, path, kind, uri}
        # Loads from ~/.waveterm/skyprompt/lsp_symbols.json
```

### 6.2 serena Language Servers
**Location:** `serena/` (30+ language server integrations)

The serena project provides comprehensive LSP integration for many languages. Could be the foundation for a centralized symbol resolution service.

---

## 7. Agent/Protocol Patterns

### 7.1 Ludwig Agent Reflection
**Location:** `Ludwig/src/ludwig/partners/agent_reflection.py`

Agent self-reflection and learning patterns.

### 7.2 Ludwig Eliza Bridge
**Location:** `Ludwig/src/ludwig/partners/eliza_bridge.py`

Integration with ElizaOS agent framework.

### 7.3 SkyPrompt Gossip Protocol
**Location:** `SkyPrompt/src/network/gossip_node.py`

Distributed gossip protocol for agent communication.

### 7.4 Chrysalis Multi-Agent
**Location:** `Chrysalis/src/adapters/MultiAgentAdapter.ts`

Multi-agent orchestration adapter.

---

## Proposed Unified Service Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Semantic Processing Service                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │ Decomposer  │  │   Graph     │  │  Embedding  │  │  Shannon   │ │
│  │   Module    │  │   Module    │  │   Module    │  │  Analyzer  │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘ │
│         │                │                │               │        │
│  ┌──────┴────────────────┴────────────────┴───────────────┴──────┐ │
│  │                    Unified Storage Layer                       │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │ │
│  │  │ LanceDB  │  │ ArangoDB │  │  SQLite  │  │   YAGO   │       │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                        MCP Interface                         │   │
│  │  Tools: decompose, embed, search, analyze, resolve_entity   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Roadmap

### Phase 1: Core Extraction (2 weeks)
- [ ] Extract `Decomposer` from SkyPrompt as standalone module
- [ ] Extract `KnowledgeGraphDB` from Ludwig as standalone module
- [ ] Extract `Embedder` from SemanticLadder as standalone module
- [ ] Create unified data models (`SemanticFrame`, `GraphEntity`, etc.)

### Phase 2: Integration (2 weeks)
- [ ] Build unified storage adapter layer
- [ ] Integrate LanceDB + ArangoDB backends
- [ ] Add YAGO client for external knowledge
- [ ] Create MCP server interface

### Phase 3: Optimization (1 week)
- [ ] Add Shannon analyzer for quality metrics
- [ ] Implement caching layer
- [ ] Add batch processing APIs
- [ ] Performance benchmarking

### Phase 4: Documentation (1 week)
- [ ] API documentation
- [ ] Integration examples
- [ ] Migration guides from individual projects

---

## Repository Reference

| Repository | Key Components | Language |
|------------|---------------|----------|
| **SkyPrompt** | Decomposer, GraphStore, LspResolver, GossipNode | Python |
| **MetaSemantic** | PromptDecomposer | Python |
| **Ludwig** | KnowledgeGraphDB, YAGOClient, ShannonEvaluator | Python |
| **SemanticLadder** | Embedder, WARC parser | Python |
| **LibraryLadder** | Content converters | Python |
| **Chrysalis** | LanceDB client, Vector indexes, Multi-agent | Python/TypeScript |
| **serena** | 30+ LSP integrations | Python |

---

## Appendix: File Manifest

```
Semantic Decomposition:
├── SkyPrompt/src/decomposer.py (282 lines)
├── MetaSemantic/backend/prompt_decomposer.py (80 lines)
└── Chrysalis/memory_system/knowledgebuilder/core/entity_extractor.py

Graph Storage:
├── Ludwig/src/ludwig/graph/storage.py (713 lines)
├── SkyPrompt/src/graph_store.py (433 lines)
└── Ludwig/src/ludwig/external/yago_client.py (468 lines)

Embedding:
├── SemanticLadder/src/ingestion/embedder.py (155 lines)
├── Ludwig/src/ludwig/embeddings/trainer.py
├── Ludwig/src/ludwig/embeddings/storage.py
└── Chrysalis/memory_system/knowledgebuilder/lancedb_client.py

Analysis:
└── Ludwig/src/ludwig/evaluators/shannon.py (560 lines)

Converters:
├── LibraryLadder/src/library_ladder/converters/text_to_md.py (183 lines)
├── LibraryLadder/src/library_ladder/converters/html_to_md.py
└── LibraryLadder/src/library_ladder/converters/epub_to_md.py

LSP/Symbols:
├── SkyPrompt/src/lsp_resolver.py (66 lines)
└── serena/ (30+ language servers)
```

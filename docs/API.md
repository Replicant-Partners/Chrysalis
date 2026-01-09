# Chrysalis API Documentation

**Version**: 1.0.0  
**Last Updated**: January 9, 2026

## Overview

This document provides comprehensive API documentation for the Chrysalis system, including the Memory System, KnowledgeBuilder, and SkillBuilder components.

## Table of Contents

- [Memory System API](#memory-system-api)
- [KnowledgeBuilder API](#knowledgebuilder-api)
- [SkillBuilder API](#skillbuilder-api)
- [Semantic Merge API](#semantic-merge-api)
- [Data Contracts](#data-contracts)
- [Error Handling](#error-handling)

## Memory System API

### Core Classes

#### ChrysalisMemory

**Location**: `memory_system/chrysalis_memory.py`

**Purpose**: Main interface for semantic memory operations with vector embeddings.

**Constructor**:
```python
ChrysalisMemory(
    store: MemoryStore,
    embedding_service: EmbeddingService,
    retrieval_config: Optional[RetrievalConfig] = None,
    consolidation_config: Optional[ConsolidationConfig] = None,
    forgetting_config: Optional[ForgettingConfig] = None
)
```

**Methods**:

##### `store(content: str, metadata: Dict[str, Any] = None) -> str`

Store content in memory with automatic embedding generation.

**Parameters**:
- `content` (str): Content to store
- `metadata` (dict, optional): Additional metadata

**Returns**: Memory entry ID (str)

**Example**:
```python
from memory_system import ChrysalisMemory, MemoryStore, EmbeddingService

memory = ChrysalisMemory(
    store=MemoryStore(),
    embedding_service=EmbeddingService(provider="voyage")
)

entry_id = memory.store(
    content="Bob Ross was a painter and television host",
    metadata={"source": "biography", "entity": "Bob Ross"}
)
```

##### `retrieve(query: str, limit: int = 10, threshold: float = 0.7) -> List[MemoryEntry]`

Retrieve memories similar to the query.

**Parameters**:
- `query` (str): Search query
- `limit` (int): Maximum number of results
- `threshold` (float): Similarity threshold (0.0-1.0)

**Returns**: List of MemoryEntry objects

**Example**:
```python
results = memory.retrieve(
    query="famous painters",
    limit=5,
    threshold=0.75
)

for entry in results:
    print(f"{entry.content} (similarity: {entry.similarity})")
```

##### `update(entry_id: str, content: str = None, metadata: Dict[str, Any] = None) -> bool`

Update an existing memory entry.

**Parameters**:
- `entry_id` (str): ID of entry to update
- `content` (str, optional): New content
- `metadata` (dict, optional): New metadata

**Returns**: Success status (bool)

**Example**:
```python
success = memory.update(
    entry_id="abc123",
    metadata={"verified": True}
)
```

##### `delete(entry_id: str) -> bool`

Delete a memory entry.

**Parameters**:
- `entry_id` (str): ID of entry to delete

**Returns**: Success status (bool)

#### EmbeddingService

**Location**: `memory_system/embeddings.py`

**Purpose**: Generate vector embeddings using various providers.

**Constructor**:
```python
EmbeddingService(
    provider: str = "voyage",  # "voyage" | "openai" | "deterministic"
    model: str = None,         # Provider-specific model
    dimensions: int = None     # Override default dimensions
)
```

**Methods**:

##### `embed(text: str) -> List[float]`

Generate embedding for text.

**Parameters**:
- `text` (str): Text to embed

**Returns**: Embedding vector (List[float])

**Example**:
```python
from memory_system import EmbeddingService

service = EmbeddingService(provider="voyage")
embedding = service.embed("Bob Ross was a painter")
print(f"Dimensions: {len(embedding)}")  # 1024 for Voyage AI
```

##### `embed_batch(texts: List[str]) -> List[List[float]]`

Generate embeddings for multiple texts.

**Parameters**:
- `texts` (List[str]): Texts to embed

**Returns**: List of embedding vectors

**Example**:
```python
embeddings = service.embed_batch([
    "Bob Ross was a painter",
    "Ada Lovelace was a mathematician"
])
```

**Reference**: [Voyage AI Documentation](https://docs.voyageai.com/)

## KnowledgeBuilder API

### Pipeline Classes

#### SimplePipeline

**Location**: `projects/KnowledgeBuilder/src/pipeline/simple_pipeline.py`

**Purpose**: Main pipeline for knowledge extraction and building.

**Constructor**:
```python
SimplePipeline(
    config: Dict[str, Any],
    embedding_service: EmbeddingService,
    lancedb_client: LanceDBClient,
    cache_client: SQLiteCache
)
```

**Methods**:

##### `process_entity(entity_name: str, entity_type: str, descriptors: List[str]) -> Dict[str, Any]`

Process an entity through the knowledge building pipeline.

**Parameters**:
- `entity_name` (str): Name of entity
- `entity_type` (str): Type (e.g., "Person", "Organization")
- `descriptors` (List[str]): Descriptive terms

**Returns**: Processing results including embedding and collected knowledge

**Example**:
```python
from projects.KnowledgeBuilder.src.pipeline import SimplePipeline
from projects.KnowledgeBuilder.src.storage import LanceDBClient, SQLiteCache
from memory_system import EmbeddingService

pipeline = SimplePipeline(
    config={"similarity_threshold": 0.85},
    embedding_service=EmbeddingService(provider="voyage"),
    lancedb_client=LanceDBClient(path="data/lancedb", dimensions=1024),
    cache_client=SQLiteCache(path="data/cache.db")
)

result = pipeline.process_entity(
    entity_name="Bob Ross",
    entity_type="Person",
    descriptors=["painter", "television host", "artist"]
)

print(f"Embedding dimensions: {len(result['embedding'])}")
print(f"Knowledge collected: {result['collected_knowledge']}")
```

#### Router

**Location**: `projects/KnowledgeBuilder/src/pipeline/router.py`

**Purpose**: Route queries to appropriate data collectors.

**Methods**:

##### `route_query(query: str, entity_type: str) -> List[str]`

Determine which collectors to use for a query.

**Parameters**:
- `query` (str): Search query
- `entity_type` (str): Entity type

**Returns**: List of collector names

**Example**:
```python
from projects.KnowledgeBuilder.src.pipeline import Router

router = Router()
collectors = router.route_query(
    query="Bob Ross biography",
    entity_type="Person"
)
# Returns: ["tavily", "exa", "brave"]
```

### Storage Classes

#### LanceDBClient

**Location**: `projects/KnowledgeBuilder/src/storage/lancedb_client.py`

**Purpose**: Vector database client for embeddings storage.

**Constructor**:
```python
LanceDBClient(
    path: str,
    dimensions: int = 1024,
    table_name: str = "knowledgebuilder_entities"
)
```

**Methods**:

##### `store(entity_name: str, embedding: List[float], metadata: Dict[str, Any]) -> None`

Store entity embedding in vector database.

**Parameters**:
- `entity_name` (str): Entity identifier
- `embedding` (List[float]): Embedding vector
- `metadata` (dict): Additional metadata

**Example**:
```python
from projects.KnowledgeBuilder.src.storage import LanceDBClient

client = LanceDBClient(path="data/lancedb", dimensions=1024)
client.store(
    entity_name="Bob Ross",
    embedding=[0.1, 0.2, ...],  # 1024 dimensions
    metadata={"type": "Person", "source": "biography"}
)
```

##### `search(query_embedding: List[float], limit: int = 10) -> List[Dict[str, Any]]`

Search for similar entities.

**Parameters**:
- `query_embedding` (List[float]): Query vector
- `limit` (int): Maximum results

**Returns**: List of matching entities with similarity scores

**Reference**: [LanceDB Documentation](https://lancedb.github.io/lancedb/)

## SkillBuilder API

### CLI Interface

**Location**: `projects/SkillBuilder/cmd/search-swarm/`

**Purpose**: Command-line interface for skill extraction.

#### Commands

##### `search-swarm extract`

Extract skills from entity description.

**Usage**:
```bash
search-swarm extract \
  --entity "Bob Ross" \
  --type "Person" \
  --descriptors "painter,television host,artist" \
  --output skills.json
```

**Options**:
- `--entity` (required): Entity name
- `--type` (required): Entity type
- `--descriptors` (required): Comma-separated descriptors
- `--output` (required): Output file path
- `--strategy`: Descriptor strategy (focused|diverse|hybrid)
- `--salts`: Number of salt variations

**Output Format**:
```json
{
  "entity_name": "Bob Ross",
  "skills": [
    {
      "skill_name": "painting",
      "embedding": [0.014, -0.008, ...],
      "confidence": 0.95
    }
  ]
}
```

### Python API

**Location**: `projects/SkillBuilder/skill_builder/`

**Usage**:
```python
from skill_builder import SkillExtractor

extractor = SkillExtractor(
    embedding_service=EmbeddingService(provider="voyage")
)

skills = extractor.extract_skills(
    entity_name="Bob Ross",
    entity_type="Person",
    descriptors=["painter", "television host"]
)
```

## Semantic Merge API

### EmbeddingMerger

**Location**: `scripts/semantic_embedding_merger.py`

**Purpose**: Merge embeddings using cosine similarity.

**Constructor**:
```python
EmbeddingMerger(similarity_threshold: float = 0.85)
```

**Methods**:

##### `cosine_similarity(vec1: List[float], vec2: List[float]) -> float`

Calculate cosine similarity between vectors.

**Parameters**:
- `vec1` (List[float]): First vector
- `vec2` (List[float]): Second vector

**Returns**: Similarity score (-1.0 to 1.0)

**Example**:
```python
from semantic_embedding_merger import EmbeddingMerger

merger = EmbeddingMerger()
similarity = merger.cosine_similarity(
    [1.0, 0.0, 0.0],
    [0.95, 0.05, 0.0]
)
print(f"Similarity: {similarity:.2f}")  # 0.95
```

**Reference**: [Cosine Similarity - Wikipedia](https://en.wikipedia.org/wiki/Cosine_similarity)

##### `average_embeddings(embeddings: List[List[float]], weights: List[float] = None) -> List[float]`

Average multiple embeddings with optional weights.

**Parameters**:
- `embeddings` (List[List[float]]): Embedding vectors
- `weights` (List[float], optional): Weights for each embedding

**Returns**: Averaged embedding vector

**Example**:
```python
averaged = merger.average_embeddings(
    [[1.0, 0.0], [0.0, 1.0]],
    weights=[0.4, 0.6]
)
# Returns: [0.4, 0.6]
```

##### `merge_similar_embeddings(existing: List[Dict], new: Dict) -> Tuple[List[Dict], bool]`

Merge new embedding with existing embeddings if similar.

**Parameters**:
- `existing` (List[Dict]): Existing embeddings
- `new` (Dict): New embedding to merge

**Returns**: Tuple of (updated embeddings, was_merged)

**Example**:
```python
existing = [{"embedding": [1.0, 0.0], "merged_count": 1}]
new = {"embedding": [0.95, 0.05]}

updated, was_merged = merger.merge_similar_embeddings(existing, new)
if was_merged:
    print("Embeddings were merged")
```

### SkillMerger

**Location**: `scripts/semantic_embedding_merger.py`

**Purpose**: Merge skills using semantic similarity.

**Constructor**:
```python
SkillMerger(similarity_threshold: float = 0.90)
```

**Methods**:

##### `merge_skills(existing_skills: List[Dict], new_skills: List[Dict]) -> Dict`

Merge new skills with existing skills.

**Parameters**:
- `existing_skills` (List[Dict]): Existing skills
- `new_skills` (List[Dict]): New skills to merge

**Returns**: Dict with merged_skills, added_count, merged_count, skipped_count

**Example**:
```python
from semantic_embedding_merger import SkillMerger

skill_merger = SkillMerger()
result = skill_merger.merge_skills(
    existing=[{"skill_name": "painting", "embedding": [1.0, 0.0]}],
    new=[{"skill_name": "art", "embedding": [0.95, 0.05]}]
)

print(f"Merged: {result['merged_count']}, Added: {result['added_count']}")
```

## Data Contracts

### Memory Entry

```python
@dataclass
class MemoryEntry:
    id: str
    content: str
    embedding: List[float]
    metadata: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    similarity: Optional[float] = None  # Set during retrieval
```

**JSON Representation**:
```json
{
  "id": "abc123",
  "content": "Bob Ross was a painter",
  "embedding": [0.1, 0.2, ...],
  "metadata": {"source": "biography"},
  "created_at": "2026-01-09T10:00:00Z",
  "updated_at": "2026-01-09T10:00:00Z"
}
```

### Knowledge Entry

```python
@dataclass
class KnowledgeEntry:
    entity_name: str
    entity_type: str
    embedding: List[float]
    collected_knowledge: Dict[str, Any]
    descriptors: List[str]
    run_number: int
    processed_at: datetime
```

**JSON Representation**:
```json
{
  "entity_name": "Bob Ross",
  "entity_type": "Person",
  "embedding": [0.1, 0.2, ...],
  "collected_knowledge": {
    "biography": "...",
    "achievements": [...]
  },
  "descriptors": ["painter", "television host"],
  "run_number": 1,
  "processed_at": "2026-01-09T10:00:00Z"
}
```

### Skill Entry

```python
@dataclass
class SkillEntry:
    legend_name: str
    skill_name: str
    embedding: List[float]
    merged_count: int
    similarity_score: Optional[float]
    run_number: int
```

**JSON Representation**:
```json
{
  "legend_name": "Bob Ross",
  "skill_name": "painting",
  "embedding": [0.1, 0.2, ...],
  "merged_count": 2,
  "similarity_score": 0.95,
  "run_number": 1
}
```

## Error Handling

### Exception Hierarchy

```python
class ChrysalisError(Exception):
    """Base exception for Chrysalis system"""
    pass

class EmbeddingError(ChrysalisError):
    """Embedding generation failed"""
    pass

class StorageError(ChrysalisError):
    """Storage operation failed"""
    pass

class ValidationError(ChrysalisError):
    """Data validation failed"""
    pass

class ConfigurationError(ChrysalisError):
    """Configuration error"""
    pass
```

### Error Handling Example

```python
from memory_system import ChrysalisMemory, EmbeddingError

try:
    memory = ChrysalisMemory(...)
    entry_id = memory.store("content")
except EmbeddingError as e:
    print(f"Failed to generate embedding: {e}")
except StorageError as e:
    print(f"Failed to store entry: {e}")
except ChrysalisError as e:
    print(f"Chrysalis error: {e}")
```

### HTTP Status Codes (Future API)

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful operation |
| 201 | Created | Resource created |
| 400 | Bad Request | Invalid input |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Service temporarily unavailable |

## Rate Limits

### Voyage AI
- **Requests per minute**: 60
- **Tokens per minute**: 1,000,000
- **Concurrent requests**: 10

**Reference**: [Voyage AI Rate Limits](https://docs.voyageai.com/docs/rate-limits)

### OpenAI
- **Requests per minute**: 3,500 (tier 1)
- **Tokens per minute**: 200,000 (tier 1)
- **Concurrent requests**: 5,000

**Reference**: [OpenAI Rate Limits](https://platform.openai.com/docs/guides/rate-limits)

## Versioning

This API follows [Semantic Versioning](https://semver.org/):
- **Major version**: Breaking changes
- **Minor version**: New features (backward compatible)
- **Patch version**: Bug fixes

**Current Version**: 1.0.0

## Related Documentation

- [Configuration Guide](CONFIGURATION.md)
- [Data Models](DATA_MODELS.md)
- [Semantic Merge Feature](features/SEMANTIC_MERGE.md)
- [KnowledgeBuilder Architecture](../projects/KnowledgeBuilder/ARCHITECTURE.md)

---

**Last Updated**: January 9, 2026  
**API Version**: 1.0.0  
**Maintainer**: Chrysalis Team

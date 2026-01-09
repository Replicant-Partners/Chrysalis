# Chrysalis Configuration Guide

**Version**: 1.0.0  
**Last Updated**: January 9, 2026

## Overview

This guide documents all configuration options for the Chrysalis system, including environment variables, configuration files, and provider settings.

## Table of Contents

- [Environment Variables](#environment-variables)
- [Configuration Files](#configuration-files)
- [Provider Configuration](#provider-configuration)
- [Component-Specific Configuration](#component-specific-configuration)
- [Examples](#examples)

## Environment Variables

### Core System

#### `EMBEDDING_PROVIDER`

**Purpose**: Select embedding provider  
**Values**: `voyage` | `openai` | `deterministic`  
**Default**: Auto-detect (Voyage AI if key present, else OpenAI, else deterministic)  
**Required**: No

**Example**:
```bash
export EMBEDDING_PROVIDER=voyage
```

**Notes**:
- `voyage`: Voyage AI (recommended, 1024 dimensions)
- `openai`: OpenAI (1536 dimensions)
- `deterministic`: Deterministic mode for testing (1024 dimensions)

**Reference**: [Voyage AI](https://docs.voyageai.com/) | [OpenAI](https://platform.openai.com/docs/guides/embeddings)

### API Keys

#### `VOYAGE_API_KEY`

**Purpose**: Voyage AI API authentication  
**Required**: Yes (if using Voyage AI)  
**Format**: String

**Example**:
```bash
export VOYAGE_API_KEY=pa-xxxxxxxxxxxxxxxxxxxxx
```

**Obtain Key**: [Voyage AI Dashboard](https://dash.voyageai.com/)

#### `OPENAI_API_KEY`

**Purpose**: OpenAI API authentication  
**Required**: Yes (if using OpenAI)  
**Format**: String (starts with `sk-`)

**Example**:
```bash
export OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxx
```

**Obtain Key**: [OpenAI API Keys](https://platform.openai.com/api-keys)

### KnowledgeBuilder

#### `KB_LANCEDB_PATH`

**Purpose**: LanceDB storage directory  
**Default**: `projects/KnowledgeBuilder/data/lancedb`  
**Required**: No

**Example**:
```bash
export KB_LANCEDB_PATH=/path/to/lancedb
```

#### `KB_CACHE_PATH`

**Purpose**: SQLite cache database path  
**Default**: `projects/KnowledgeBuilder/data/schema_cache.db`  
**Required**: No

**Example**:
```bash
export KB_CACHE_PATH=/path/to/cache.db
```

#### `KB_EMBEDDING_DIMENSIONS`

**Purpose**: Override embedding dimensions  
**Default**: Provider-specific (1024 for Voyage, 1536 for OpenAI)  
**Required**: No

**Example**:
```bash
export KB_EMBEDDING_DIMENSIONS=1024
```

**Warning**: Must match provider's actual dimensions to avoid errors.

### Semantic Merge

#### `MERGE_USE_EMBEDDINGS`

**Purpose**: Enable embedding-based merge in SemanticMerger  
**Values**: `0` (disabled) | `1` (enabled)  
**Default**: `0`  
**Required**: No

**Example**:
```bash
export MERGE_USE_EMBEDDINGS=1
```

**Notes**:
- When enabled, uses OpenAI embeddings for text snippet deduplication
- Requires `OPENAI_API_KEY`
- More accurate but slower than difflib

#### `MERGE_EMBED_MODEL`

**Purpose**: Model for embedding-based merge  
**Default**: `text-embedding-3-small`  
**Required**: No (only if `MERGE_USE_EMBEDDINGS=1`)

**Example**:
```bash
export MERGE_EMBED_MODEL=text-embedding-3-large
```

### Data Collection

#### `TAVILY_API_KEY`

**Purpose**: Tavily search API authentication  
**Required**: No (optional collector)

**Example**:
```bash
export TAVILY_API_KEY=tvly-xxxxxxxxxxxxxxxxxxxxx
```

**Obtain Key**: [Tavily Dashboard](https://tavily.com/)

#### `EXA_API_KEY`

**Purpose**: Exa search API authentication  
**Required**: No (optional collector)

**Example**:
```bash
export EXA_API_KEY=exa-xxxxxxxxxxxxxxxxxxxxx
```

**Obtain Key**: [Exa Dashboard](https://exa.ai/)

#### `BRAVE_API_KEY`

**Purpose**: Brave search API authentication  
**Required**: No (optional collector)

**Example**:
```bash
export BRAVE_API_KEY=BSA-xxxxxxxxxxxxxxxxxxxxx
```

**Obtain Key**: [Brave Search API](https://brave.com/search/api/)

#### `FIRECRAWL_API_KEY`

**Purpose**: Firecrawl web scraping API authentication  
**Required**: No (optional collector)

**Example**:
```bash
export FIRECRAWL_API_KEY=fc-xxxxxxxxxxxxxxxxxxxxx
```

**Obtain Key**: [Firecrawl Dashboard](https://firecrawl.dev/)

### Logging

#### `LOG_LEVEL`

**Purpose**: Set logging verbosity  
**Values**: `DEBUG` | `INFO` | `WARNING` | `ERROR` | `CRITICAL`  
**Default**: `INFO`  
**Required**: No

**Example**:
```bash
export LOG_LEVEL=DEBUG
```

## Configuration Files

### KnowledgeBuilder Config

**Location**: `projects/KnowledgeBuilder/config.yaml`

**Structure**:
```yaml
pipeline:
  # Embedding configuration
  embedding_dimensions: 1024
  embedding_provider: voyage
  
  # Similarity thresholds
  similarity_threshold: 0.85
  merge_threshold: 0.90
  
  # Processing options
  batch_size: 100
  max_retries: 3
  timeout_seconds: 30

storage:
  # LanceDB configuration
  lancedb_path: data/lancedb
  table_name: knowledgebuilder_entities
  
  # SQLite cache configuration
  cache_path: data/schema_cache.db
  cache_ttl_hours: 24

collectors:
  # Enable/disable collectors
  tavily: true
  exa: true
  brave: true
  firecrawl: false
  
  # Collector-specific settings
  tavily_max_results: 10
  exa_max_results: 10
  brave_max_results: 10

quality:
  # Quality thresholds
  min_confidence: 0.7
  min_fact_score: 0.6
  require_schema_match: true
```

**Reference**: [KnowledgeBuilder Architecture](../projects/KnowledgeBuilder/ARCHITECTURE.md)

### SkillBuilder Config

**Location**: `projects/SkillBuilder/config/`

#### `domains.yaml`

**Purpose**: Domain-specific skill taxonomies

**Structure**:
```yaml
domains:
  art:
    skills:
      - painting
      - drawing
      - sculpture
    related_domains:
      - design
      - creativity
  
  technology:
    skills:
      - programming
      - system_design
      - debugging
    related_domains:
      - engineering
      - mathematics
```

#### `expertise-levels.yaml`

**Purpose**: Skill proficiency levels

**Structure**:
```yaml
levels:
  novice:
    description: "Basic familiarity"
    confidence_range: [0.0, 0.3]
  
  intermediate:
    description: "Working knowledge"
    confidence_range: [0.3, 0.7]
  
  expert:
    description: "Deep expertise"
    confidence_range: [0.7, 1.0]
```

#### `skill-keywords.yaml`

**Purpose**: Keyword mappings for skill extraction

**Structure**:
```yaml
keywords:
  programming:
    - coding
    - software development
    - computer programming
  
  painting:
    - art
    - visual art
    - fine art
```

### Environment File

**Location**: `.env` (root directory)

**Purpose**: Centralized environment variable configuration

**Structure**:
```bash
# Embedding Providers
EMBEDDING_PROVIDER=voyage
VOYAGE_API_KEY=pa-xxxxxxxxxxxxxxxxxxxxx
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxx

# KnowledgeBuilder
KB_LANCEDB_PATH=projects/KnowledgeBuilder/data/lancedb
KB_CACHE_PATH=projects/KnowledgeBuilder/data/schema_cache.db

# Semantic Merge
MERGE_USE_EMBEDDINGS=0
MERGE_EMBED_MODEL=text-embedding-3-small

# Data Collectors
TAVILY_API_KEY=tvly-xxxxxxxxxxxxxxxxxxxxx
EXA_API_KEY=exa-xxxxxxxxxxxxxxxxxxxxx
BRAVE_API_KEY=BSA-xxxxxxxxxxxxxxxxxxxxx

# Logging
LOG_LEVEL=INFO
```

**Setup**:
```bash
# Copy example file
cp .env.example .env

# Edit with your keys
nano .env
```

**Security**: Never commit `.env` to version control (included in `.gitignore`)

## Provider Configuration

### Voyage AI

**Model**: `voyage-3`  
**Dimensions**: 1024  
**Context Length**: 32,000 tokens  
**Rate Limits**:
- 60 requests/minute
- 1,000,000 tokens/minute
- 10 concurrent requests

**Configuration**:
```bash
export EMBEDDING_PROVIDER=voyage
export VOYAGE_API_KEY=pa-xxxxxxxxxxxxxxxxxxxxx
```

**Pricing**: [Voyage AI Pricing](https://www.voyageai.com/pricing)

**Best For**:
- Semantic search
- Document retrieval
- Knowledge building

**Reference**: [Voyage AI Documentation](https://docs.voyageai.com/)

### OpenAI

**Model**: `text-embedding-3-small` (default) or `text-embedding-3-large`  
**Dimensions**: 1536 (small) or 3072 (large)  
**Context Length**: 8,191 tokens  
**Rate Limits** (Tier 1):
- 3,500 requests/minute
- 200,000 tokens/minute
- 5,000 concurrent requests

**Configuration**:
```bash
export EMBEDDING_PROVIDER=openai
export OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxx
export MERGE_EMBED_MODEL=text-embedding-3-small
```

**Pricing**: [OpenAI Pricing](https://openai.com/api/pricing/)

**Best For**:
- General-purpose embeddings
- Large-scale processing
- High throughput

**Reference**: [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)

### Deterministic (Testing)

**Purpose**: Deterministic embeddings for testing  
**Dimensions**: 1024  
**Rate Limits**: None (local)

**Configuration**:
```bash
export EMBEDDING_PROVIDER=deterministic
```

**Usage**:
```bash
# Enable deterministic mode
python scripts/process_legends.py --allow-deterministic
```

**Notes**:
- Generates consistent embeddings based on text hash
- No API calls or costs
- Not suitable for production
- Useful for testing and development

## Component-Specific Configuration

### Memory System

**Configuration via Constructor**:
```python
from memory_system import ChrysalisMemory, MemoryStore, EmbeddingService

memory = ChrysalisMemory(
    store=MemoryStore(path="data/memory.db"),
    embedding_service=EmbeddingService(
        provider="voyage",
        model="voyage-3",
        dimensions=1024
    ),
    retrieval_config={
        "similarity_threshold": 0.7,
        "max_results": 10
    },
    consolidation_config={
        "enabled": True,
        "interval_hours": 24
    },
    forgetting_config={
        "enabled": False
    }
)
```

### KnowledgeBuilder Pipeline

**Configuration via YAML**:
```yaml
# projects/KnowledgeBuilder/config.yaml
pipeline:
  embedding_dimensions: 1024
  similarity_threshold: 0.85
  batch_size: 100
```

**Configuration via Code**:
```python
from projects.KnowledgeBuilder.src.pipeline import SimplePipeline

pipeline = SimplePipeline(
    config={
        "embedding_dimensions": 1024,
        "similarity_threshold": 0.85,
        "batch_size": 100
    },
    embedding_service=embedding_service,
    lancedb_client=lancedb_client,
    cache_client=cache_client
)
```

### SkillBuilder CLI

**Configuration via Flags**:
```bash
search-swarm extract \
  --entity "Bob Ross" \
  --type "Person" \
  --descriptors "painter,television host" \
  --strategy hybrid \
  --salts 3 \
  --output skills.json
```

**Configuration via YAML**:
```yaml
# projects/SkillBuilder/config/role-map.yaml
roles:
  painter:
    skills:
      - painting
      - color_theory
      - composition
    expertise_level: expert
```

### Semantic Merge

**Configuration via Constructor**:
```python
from semantic_embedding_merger import EmbeddingMerger, SkillMerger

# Embedding merger
embedding_merger = EmbeddingMerger(
    similarity_threshold=0.85  # 85% similarity required
)

# Skill merger
skill_merger = SkillMerger(
    similarity_threshold=0.90  # 90% similarity required
)
```

**Thresholds**:
- **Embeddings**: 0.85 (more permissive for related concepts)
- **Skills**: 0.90 (more strict to avoid merging distinct skills)

**Weights**:
- **New**: 0.60 (60% weight to newer embeddings)
- **Existing**: 0.40 (40% weight to existing embeddings)

## Examples

### Basic Setup

```bash
# 1. Create .env file
cat > .env << EOF
EMBEDDING_PROVIDER=voyage
VOYAGE_API_KEY=your-key-here
LOG_LEVEL=INFO
EOF

# 2. Install dependencies
pip install -r memory_system/requirements.txt
pip install -r projects/KnowledgeBuilder/requirements.txt

# 3. Run processing
python scripts/process_legends.py --legend bob_ross --run-count 2
```

### Development Setup

```bash
# Use deterministic mode for testing
export EMBEDDING_PROVIDER=deterministic
export LOG_LEVEL=DEBUG

# Run with debug logging
python scripts/process_legends.py \
  --legend bob_ross \
  --run-count 2 \
  --allow-deterministic
```

### Production Setup

```bash
# Production environment variables
export EMBEDDING_PROVIDER=voyage
export VOYAGE_API_KEY=pa-xxxxxxxxxxxxxxxxxxxxx
export KB_LANCEDB_PATH=/var/lib/chrysalis/lancedb
export KB_CACHE_PATH=/var/lib/chrysalis/cache.db
export LOG_LEVEL=INFO

# Run with production settings
python scripts/process_legends.py --run-count 3
```

### Multi-Provider Setup

```bash
# Use Voyage for embeddings, OpenAI for merge
export EMBEDDING_PROVIDER=voyage
export VOYAGE_API_KEY=pa-xxxxxxxxxxxxxxxxxxxxx
export MERGE_USE_EMBEDDINGS=1
export OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxx
export MERGE_EMBED_MODEL=text-embedding-3-small
```

## Troubleshooting

### Common Issues

#### Missing API Key

**Error**: `ValueError: No API key found for provider 'voyage'`

**Solution**:
```bash
export VOYAGE_API_KEY=your-key-here
```

#### Dimension Mismatch

**Error**: `ValueError: Dimension mismatch: table has 3072, embedding has 1024`

**Solution**:
```bash
# Delete and recreate table
rm -rf projects/KnowledgeBuilder/data/lancedb/
python scripts/process_legends.py --legend bob_ross --run-count 1
```

#### Rate Limit Exceeded

**Error**: `429 Too Many Requests`

**Solution**:
```bash
# Use deterministic mode for testing
export EMBEDDING_PROVIDER=deterministic
python scripts/process_legends.py --allow-deterministic
```

### Validation

**Check Configuration**:
```python
import os

print(f"Provider: {os.getenv('EMBEDDING_PROVIDER', 'auto')}")
print(f"Voyage Key: {'✓' if os.getenv('VOYAGE_API_KEY') else '✗'}")
print(f"OpenAI Key: {'✓' if os.getenv('OPENAI_API_KEY') else '✗'}")
print(f"Log Level: {os.getenv('LOG_LEVEL', 'INFO')}")
```

**Test Embedding Service**:
```python
from memory_system import EmbeddingService

service = EmbeddingService(provider="voyage")
embedding = service.embed("test")
print(f"Dimensions: {len(embedding)}")  # Should be 1024
```

## Related Documentation

- [API Documentation](API.md)
- [Data Models](DATA_MODELS.md)
- [Quick Start Guide](guides/QUICK_START.md)
- [Troubleshooting](guides/TROUBLESHOOTING.md)

## References

- [Voyage AI Documentation](https://docs.voyageai.com/)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [LanceDB Configuration](https://lancedb.github.io/lancedb/)
- [Environment Variables Best Practices](https://12factor.net/config)

---

**Last Updated**: January 9, 2026  
**Version**: 1.0.0  
**Maintainer**: Chrysalis Team

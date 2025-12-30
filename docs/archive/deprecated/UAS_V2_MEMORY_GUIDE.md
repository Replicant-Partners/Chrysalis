# Uniform Semantic Agent v2.0 - Memory System Guide

**Version:** 2.0.0  
**Release Date:** December 28, 2025  
**Status:** ✅ Production Ready

---

## What's New in v2.0?

🧠 **Comprehensive Memory Architecture Support** based on cutting-edge research

### Key Additions

1. **5 Memory Types** (Industry Standard)
   - Working Memory (Short-Term)
   - Episodic Memory (Experiences)
   - Semantic Memory (Knowledge)
   - Procedural Memory (Skills)
   - Core Memory (Identity)

2. **3 Memory Architectures**
   - Hierarchical (MemGPT/Letta style)
   - Structured (MIRIX style)
   - Dual-Agent (GAM style)
   - Flat (Simple RAG)

3. **Vector & Graph Database Support**
   - FAISS, Pinecone, Weaviate, Chroma, Qdrant, pgvector
   - Neo4j, Neptune Analytics
   - Hybrid configurations

4. **Advanced Memory Operations**
   - Agentic RAG (agent-controlled retrieval)
   - Hybrid search (vector + keyword)
   - Sleep-time consolidation
   - Utility-based forgetting

---

## Quick Start

### 1. Basic Agent with Memory

```yaml
apiVersion: usa/v2  # Use v2!
kind: Agent

metadata:
  name: my-agent
  version: 2.0.0

identity:
  role: AI Assistant
  goal: Help users with tasks

capabilities:
  memory:
    architecture: hierarchical
    
    working:
      enabled: true
      max_tokens: 8192
    
    semantic:
      enabled: true
      storage: vector_db
      rag:
        enabled: true
        top_k: 5
    
    embeddings:
      model: openai/text-embedding-3-small
      dimensions: 1536
    
    storage:
      primary: chroma
      vector_db:
        provider: chroma
        collection: my_memories

# ... rest of config
```

### 2. Load and Use

```python
from usa_implementation.loader import load_agent
from usa_implementation.core import types_v2

# Load agent (auto-detects v2 from apiVersion)
agent = load_agent("my_agent.usa.yaml")

# Access memory configuration
if agent.capabilities.memory:
    print(f"Architecture: {agent.capabilities.memory.architecture.value}")
    print(f"Working Memory: {agent.capabilities.memory.working.enabled}")
    print(f"Embeddings: {agent.capabilities.memory.embeddings.model}")
```

---

## Memory Types Explained

### 1. Working Memory (Short-Term)

**Function:** Immediate context for current session

```yaml
working:
  enabled: true
  max_tokens: 16384     # Context window size
  buffer_type: rolling  # rolling, sliding, fixed
```

**Use Cases:**
- Current conversation
- Active task context
- Temporary state

### 2. Episodic Memory (Experiences)

**Function:** Time-stamped past events and interactions

```yaml
episodic:
  enabled: true
  storage: vector_db
  retention_days: null  # null = unlimited
  temporal_indexing: true
  metadata_fields:
    - timestamp
    - actor
    - event_type
    - location
```

**Use Cases:**
- Conversation history
- User interaction log
- Past decisions and outcomes
- "What happened when" queries

### 3. Semantic Memory (Knowledge)

**Function:** Factual knowledge and concepts

```yaml
semantic:
  enabled: true
  storage: hybrid  # vector_db, graph_db, or hybrid
  rag:
    enabled: true
    top_k: 5
    min_relevance: 0.75
    reranking: true
  knowledge_graph: true
```

**Use Cases:**
- General knowledge base
- Domain expertise
- Fact storage
- Concept relationships

### 4. Procedural Memory (Skills)

**Function:** How-to knowledge and action sequences

```yaml
procedural:
  enabled: true
  storage: structured
  format: pydantic  # pydantic, json_schema, pddl, code
  versioning: true
```

**Use Cases:**
- Task procedures
- Learned workflows
- Skill library
- Action templates

### 5. Core Memory (Persistent Identity)

**Function:** Agent identity and critical facts

```yaml
core:
  enabled: true
  self_editing: true  # Agent can update its own core memory
  blocks:
    - name: persona
      content: |
        I am a research assistant.
        I specialize in academic papers.
      editable: true
    
    - name: user_preferences
      content: |
        User prefers APA citations.
        User focuses on recent papers (2-year window).
      editable: true
```

**Use Cases:**
- Agent persona/identity
- Persistent user preferences
- Mission-critical facts
- Context that should never be forgotten

---

## Memory Architectures

### 1. Hierarchical (MemGPT/Letta Style)

**Best For:** Long-running assistants, unlimited conversations

```yaml
memory:
  architecture: hierarchical
  
  working:
    enabled: true
    max_tokens: 16384
  
  core:
    enabled: true
    self_editing: true
    blocks: [...]
  
  episodic:
    enabled: true
    storage: vector_db
  
  semantic:
    enabled: true
    storage: hybrid
  
  operations:
    retrieval:
      strategy: agentic_rag  # Agent controls memory access
    consolidation:
      strategy: sleep_time  # Async processing
```

**How It Works:**
- In-context memory (core + working) = "RAM"
- External storage (episodic + semantic) = "Disk"
- Agent autonomously pages memory in/out
- Like OS memory management

**Use Cases:**
- Personal assistants
- Customer service agents
- Research assistants
- Any long-term interaction

### 2. Structured (MIRIX Style)

**Best For:** Complex multi-domain agents

```yaml
memory:
  architecture: structured
  
  # Separate specialized components
  working: {enabled: true}
  episodic: {enabled: true, storage: vector_db}
  semantic: {enabled: true, storage: hybrid}
  procedural: {enabled: true, storage: structured}
  core: {enabled: true}
  
  # Specialized retrieval
  operations:
    retrieval:
      strategy: agentic_rag
      hybrid_search: true
```

**How It Works:**
- Each memory type has dedicated storage
- Prevents "memory soup" (mixing types)
- Topic-based routing to relevant memory
- Avoids conflicts (episodic ≠ semantic)

**Use Cases:**
- Multi-domain agents
- Complex business logic
- Agents needing isolation between memory types

### 3. Flat (Simple RAG)

**Best For:** Simple question-answering

```yaml
memory:
  architecture: flat
  
  semantic:
    enabled: true
    storage: vector_db
    rag:
      enabled: true
      top_k: 3
  
  operations:
    retrieval:
      strategy: passive_rag  # Traditional RAG
```

**How It Works:**
- Simple vector database
- Query → Retrieve → Augment → Generate
- No complex memory management

**Use Cases:**
- Q&A chatbots
- Document search
- Simple retrieval tasks

---

## Embeddings Configuration

### Standard Configuration

```yaml
embeddings:
  model: openai/text-embedding-3-small
  dimensions: 1536
  batch_size: 100
  provider: openai
```

### Recommended Models

| Model | Provider | Dimensions | Best For |
|-------|----------|------------|----------|
| `openai/text-embedding-3-small` | OpenAI | 1536 | Fast, cost-effective |
| `openai/text-embedding-3-large` | OpenAI | 3072 | High quality |
| `bge-m3` | BAAI | 1024 | Multilingual, open |
| `embed-v3` | Cohere | 1024 | Long context |

---

## Storage Configuration

### Vector Database

```yaml
storage:
  primary: weaviate
  vector_db:
    provider: weaviate  # faiss, pinecone, chroma, qdrant
    collection: my_memories
    config:
      url: ${WEAVIATE_URL}
      api_key: ${WEAVIATE_API_KEY}
```

**Options:**
- **FAISS**: Fast, in-memory, open-source
- **Pinecone**: Managed cloud, scalable
- **Weaviate**: Hybrid vector+graph
- **Chroma**: Lightweight, embedded
- **Qdrant**: High performance, Rust-based
- **pgvector**: PostgreSQL extension

### Graph Database

```yaml
storage:
  graph_db:
    provider: neo4j  # or neptune
    database: knowledge_graph
    config:
      uri: ${NEO4J_URI}
      user: ${NEO4J_USER}
      password: ${NEO4J_PASSWORD}
```

**Use For:**
- Multi-hop reasoning
- Relationship queries
- Knowledge graphs
- Explainable AI

### Hybrid Configuration

```yaml
storage:
  primary: weaviate
  vector_db:
    provider: weaviate
    collection: memories
  graph_db:
    provider: neo4j
    database: relationships
  cache: redis  # Speed up retrieval
  backup: postgresql
```

---

## Memory Operations

### Retrieval Strategies

```yaml
operations:
  retrieval:
    strategy: agentic_rag  # Agent-controlled
    hybrid_search: true    # Vector + keyword
    reranking: true        # Re-rank results
    max_results: 10
```

**Strategies:**
- `passive_rag`: Traditional RAG (system retrieves)
- `agentic_rag`: Agent controls (when/what to retrieve)
- `hybrid_search`: Vector + keyword + metadata
- `semantic_only`: Pure vector similarity
- `temporal_aware`: Time-based retrieval
- `graph_traversal`: Follow relationships

### Consolidation

```yaml
operations:
  consolidation:
    strategy: sleep_time  # Background processing
    frequency: daily
    async_processing: true
```

**Strategies:**
- `none`: No consolidation
- `periodic`: Scheduled (hourly/daily/weekly)
- `sleep_time`: Async during idle (best!)
- `threshold_based`: When memory grows too large
- `continuous`: Real-time

**What It Does:**
- Merge similar memories
- Extract insights
- Update core memory
- Generate summaries
- Refine knowledge

### Forgetting (Memory Pruning)

```yaml
operations:
  forgetting:
    enabled: true
    strategy: utility_based
    threshold: 0.3
    parameters:
      recency_weight: 0.3    # How recent?
      relevance_weight: 0.5  # How relevant?
      frequency_weight: 0.2  # How often accessed?
```

**Strategies:**
- `none`: Keep everything
- `fifo`: First In, First Out
- `lru`: Least Recently Used
- `utility_based`: RIF scoring (Recency+Relevance+Frequency)
- `ebbinghaus`: Forgetting curve from psychology
- `threshold`: Score-based pruning

**Why Prune?**
- Prevent unbounded memory growth
- Remove low-value memories
- Speed up retrieval
- Reduce storage costs

---

## Complete Examples

### Example 1: Research Agent (Full-Featured)

See: `examples/memory_agent_hierarchical.usa.yaml`

**Features:**
- Hierarchical architecture (MemGPT style)
- All 5 memory types enabled
- Vector + Graph hybrid storage
- Agentic RAG retrieval
- Sleep-time consolidation
- Utility-based forgetting

**Use Case:** Long-running research assistant with unlimited memory

### Example 2: Personal Assistant (Structured)

See: `examples/memory_agent_structured.usa.yaml`

**Features:**
- Structured architecture (MIRIX style)
- Separate memory components
- Lightweight Chroma storage
- Simple but effective

**Use Case:** Personal productivity assistant

### Example 3: Simple Q&A (Minimal)

See: `examples/memory_agent_minimal.usa.yaml`

**Features:**
- Flat architecture (Simple RAG)
- Working + Semantic only
- FAISS vector store
- Passive RAG

**Use Case:** Basic question-answering chatbot

---

## Migration from v1 to v2

### v1 Memory (Old)

```yaml
apiVersion: usa/v1

capabilities:
  memory:
    type: vector      # Limited options
    scope: session
    provider: faiss
    config: {}
```

### v2 Memory (New)

```yaml
apiVersion: usa/v2

capabilities:
  memory:
    architecture: hierarchical
    
    # Explicit memory types
    working: {enabled: true, max_tokens: 8192}
    semantic: {enabled: true, storage: vector_db}
    episodic: {enabled: true, storage: vector_db}
    
    # Rich embeddings config
    embeddings:
      model: openai/text-embedding-3-small
      dimensions: 1536
    
    # Detailed storage
    storage:
      primary: faiss
      vector_db:
        provider: faiss
        collection: memories
    
    # Advanced operations
    operations:
      retrieval: {strategy: agentic_rag}
      consolidation: {strategy: periodic}
      forgetting: {enabled: false}
```

### Auto-Detection

The loader automatically detects version:

```python
# v1 agent (apiVersion: usa/v1)
agent_v1 = load_agent("old_agent.usa.yaml")
# → Uses types_v1

# v2 agent (apiVersion: usa/v2)
agent_v2 = load_agent("new_agent.usa.yaml")
# → Uses types_v2
```

---

## Testing & Validation

### Run Tests

```bash
cd /path/to/CharactersAgents
python examples/test_memory_v2.py
```

### Expected Output

```
✅ ALL TESTS PASSED!

🎉 uSA v2.0 with Memory System is working correctly!

📚 Example specifications:
   • memory_agent_hierarchical.usa.yaml
   • memory_agent_structured.usa.yaml  
   • memory_agent_minimal.usa.yaml
```

### Validation

```python
from usa_implementation.loader import load_agent

agent = load_agent("my_agent.usa.yaml")

# Validate
try:
    agent.validate()
    print("✅ Agent is valid!")
except ValueError as e:
    print(f"❌ Validation error: {e}")
```

---

## Production Deployment

### Framework Integration

#### CrewAI

```python
from usa_implementation.loader import load_agent
from crewai import Agent

# Load uSA spec
spec = load_agent("agent.usa.yaml")

# Create CrewAI agent
crewai_agent = Agent(
    role=spec.identity.role,
    goal=spec.identity.goal,
    backstory=spec.identity.backstory,
    # Use memory configuration from spec
    memory=create_crewai_memory(spec.capabilities.memory),
    verbose=True
)
```

#### Letta/MemGPT

```python
from usa_implementation.loader import load_agent
from letta import create_agent

spec = load_agent("agent.usa.yaml")

# Create Letta agent
letta_agent = create_agent(
    name=spec.metadata.name,
    # Use core memory blocks
    memory={
        "persona": spec.capabilities.memory.core.blocks[0].content,
        "human": spec.capabilities.memory.core.blocks[1].content
    },
    # Use storage configuration
    archival_storage=spec.capabilities.memory.storage.primary
)
```

#### LangChain

```python
from usa_implementation.loader import load_agent
from langchain.memory import VectorStoreMemory

spec = load_agent("agent.usa.yaml")

# Create LangChain memory
memory = VectorStoreMemory(
    vector_store=create_vector_store(
        spec.capabilities.memory.storage.vector_db
    ),
    memory_key="chat_history"
)
```

### Environment Variables

```bash
# Vector databases
export WEAVIATE_URL="https://..."
export WEAVIATE_API_KEY="..."
export PINECONE_API_KEY="..."

# Graph databases
export NEO4J_URI="bolt://..."
export NEO4J_USER="..."
export NEO4J_PASSWORD="..."

# Embedding models
export OPENAI_API_KEY="..."

# Cache
export REDIS_URL="redis://..."
```

---

## Best Practices

### 1. Choose the Right Architecture

| Architecture | Use When |
|--------------|----------|
| **Hierarchical** | Long-running personal assistants, unlimited conversations |
| **Structured** | Multi-domain agents, need isolation between memory types |
| **Flat** | Simple Q&A, document search, basic retrieval |

### 2. Configure Memory Types

**Minimal (Chatbot):**
- Working + Semantic only

**Standard (Assistant):**
- Working + Episodic + Semantic + Core

**Advanced (Stateful Agent):**
- All 5 types (Working + Episodic + Semantic + Procedural + Core)

### 3. Choose Storage

**Small Scale (<1K users):**
- Chroma or FAISS (embedded)
- No cache needed

**Medium Scale (1K-100K users):**
- Qdrant or Weaviate
- Redis cache

**Large Scale (100K+ users):**
- Pinecone or Weaviate (distributed)
- Redis cache
- PostgreSQL backup

### 4. Retrieval Strategy

**Simple:** `passive_rag` (traditional RAG)  
**Advanced:** `agentic_rag` (agent-controlled)  
**Production:** `agentic_rag` + `hybrid_search` + `reranking`

### 5. Memory Operations

**Development:** Disable consolidation and forgetting  
**Production:** Enable `sleep_time` consolidation + `utility_based` forgetting

---

## Troubleshooting

### Memory Not Loading

```python
# Check API version
agent = load_agent("agent.usa.yaml")
print(agent.api_version)  # Should be "usa/v2"

# Force v2 types
from usa_implementation.core import types_v2
agent = load_agent("agent.usa.yaml", type_module=types_v2)
```

### Vector DB Connection Issues

```yaml
# Check configuration
storage:
  vector_db:
    provider: weaviate
    config:
      url: ${WEAVIATE_URL}  # Environment variable
      api_key: ${WEAVIATE_API_KEY}

# Verify env vars are set
```

### Memory Growing Too Large

```yaml
# Enable forgetting
operations:
  forgetting:
    enabled: true
    strategy: utility_based
    threshold: 0.3  # Lower = more aggressive pruning
```

---

## Performance

### Memory Operation Costs

| Operation | Time | Cost |
|-----------|------|------|
| Working memory access | <1ms | Free (in-context) |
| Core memory read | <1ms | Free (in-context) |
| Vector search (1K memories) | 1-5ms | Storage cost |
| Vector search (1M memories) | 5-20ms | Storage cost |
| Graph traversal | 10-50ms | DB cost |
| Consolidation (async) | N/A | Background |

### Optimization Tips

1. **Use caching** (Redis) for frequently accessed memories
2. **Enable forgetting** to keep vector DB size manageable
3. **Use async consolidation** (sleep_time) to avoid blocking
4. **Batch embeddings** (larger batch_size)
5. **Choose right vector DB** (Qdrant for speed, Pinecone for scale)

---

## Resources

### Documentation

- **uSA v2 Types**: `usa_implementation/core/types_v2.py`
- **Loader**: `usa_implementation/loader.py`
- **Memory Research**: `AgentMemoryArchitectureResearch.md`
- **Quick Summary**: `AgentMemory_QuickSummary.md`

### Examples

- **Hierarchical**: `examples/memory_agent_hierarchical.usa.yaml`
- **Structured**: `examples/memory_agent_structured.usa.yaml`
- **Minimal**: `examples/memory_agent_minimal.usa.yaml`
- **Test Suite**: `examples/test_memory_v2.py`

### Research

Based on cutting-edge research:
- MemGPT/Letta (hierarchical memory)
- MIRIX (structured multi-type)
- GAM (dual-agent memory)
- H-MEM (hierarchical retrieval)
- Vector databases (semantic search)
- Utility-based forgetting (RIF scoring)

---

## What's Next?

### Planned Features

- **v2.1**: Pre-built framework adapters (CrewAI, Letta, LangChain)
- **v2.2**: Multi-modal memory (images, audio)
- **v2.3**: Distributed memory (multi-agent sharing)
- **v3.0**: Neurosymbolic memory (neural + symbolic)

### Community

Contribute:
1. Build framework adapters
2. Create agent templates
3. Improve documentation
4. Share use cases

---

**Uniform Semantic Agent v2.0**  
*Stateful agents with memory that learns and adapts*

🎉 **Memory System Complete!** 🎉

---

**Questions? Issues?**  
See documentation or examples for guidance.

**Last Updated:** December 28, 2025

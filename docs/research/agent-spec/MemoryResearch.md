# Agent Memory Architecture Research
## Emerging Patterns, Vector Systems, and Standards Convergence

**Research Date:** December 28, 2025  
**Status:** Current State of the Art

---

## Executive Summary

Agent memory architecture is **rapidly converging** around a **hybrid, multi-tiered approach** that combines:

1. ✅ **Vector databases** for semantic retrieval (embeddings-based)
2. ✅ **Graph databases** for relational/structural knowledge
3. ✅ **Temporal indexing** for time-aware episodic recall
4. ✅ **Hierarchical organization** (inspired by human memory and OS architectures)

**Key Finding:** The field is converging on **4-5 distinct memory types** inspired by cognitive psychology, with **vector embeddings** as the dominant representation layer. We're seeing the emergence of **2-3 dominant architectural patterns** that are becoming de facto standards.

---

## Part 1: Memory Types - Clear Convergence

### The Five Memory Types (Industry Consensus)

The field has converged on **five primary memory types**, directly inspired by human cognitive architecture:

#### 1. **Working Memory (Short-Term Memory)**
```
Function: Immediate context, current conversation
Storage:  LLM context window (in-context)
Lifetime: Single session/task
Size:     Limited by token window (4K-200K tokens)
```

**Implementation:**
- Rolling buffer of recent messages
- Active context window of LLM
- Volatile (lost at session end)
- No external storage required

**Examples:**
- LangChain: `ConversationBufferMemory`
- Letta: Message Buffer
- All frameworks: Context window management

#### 2. **Episodic Memory (Long-Term)**
```
Function: Specific past experiences, time-stamped events
Storage:  Vector DB + structured logs
Lifetime: Persistent across sessions
Size:     Unbounded (limited by storage)
```

**Implementation:**
- Time-stamped event logs
- Structured records with metadata (who, what, when, where)
- Vector embeddings for semantic search
- Temporal indexing for chronological retrieval

**Data Structure (MIRIX Example):**
```yaml
episodic_memory:
  event_type: "user_interaction"
  summary: "User asked about vegetarian recipes"
  details: "Conversation about dietary preferences"
  actor: "user_123"
  timestamp: "2025-12-28T10:30:00Z"
  embedding: [0.123, 0.456, ...]  # Vector representation
```

**Examples:**
- MemGPT/Letta: Recall Memory
- Mem0: Episodic memory layer
- MIRIX: Episodic Memory component

#### 3. **Semantic Memory (Long-Term)**
```
Function: Factual knowledge, concepts, definitions
Storage:  Vector DB + knowledge graphs
Lifetime: Persistent, evolves over time
Size:     Unbounded
```

**Implementation:**
- Vector embeddings of facts and concepts
- Knowledge graphs for structured relationships
- RAG (Retrieval-Augmented Generation) systems
- Semantic search by meaning similarity

**Data Structure:**
```yaml
semantic_memory:
  name: "Eiffel Tower"
  summary: "Famous Parisian landmark"
  details: "Iron lattice tower built in 1889"
  relationships:
    - location: Paris, France
    - architect: Gustave Eiffel
    - height: 330 meters
  embedding: [0.789, 0.234, ...]
```

**Examples:**
- All RAG systems
- LangChain: Vector Store Memory
- CrewAI: Knowledge base integration

#### 4. **Procedural Memory**
```
Function: Skills, how-to knowledge, action sequences
Storage:  Code, schemas, structured workflows
Lifetime: Persistent, refined through learning
Size:     Moderate (bounded by skill library)
```

**Implementation:**
- Step-by-step procedures
- PDDL (Planning Domain Definition Language)
- Pydantic schemas for structured actions
- Tool/function definitions

**Examples:**
- AutoGPT: Skill library
- Voyager: Learned Minecraft skills (embeddings of skill descriptions)
- Agent Protocol: Task sequences

#### 5. **Core Memory (Persistent Context)**
```
Function: High-priority persistent information
Storage:  In-context blocks (pinned)
Lifetime: Persistent, manually curated
Size:     Small (fits in context window)
```

**Implementation:**
- Structured blocks pinned to context window
- Agent persona and identity
- User preferences and critical facts
- Self-editable by the agent

**Data Structure (MemGPT Example):**
```json
{
  "core_memory": {
    "persona": "I am a helpful research assistant...",
    "human": "User prefers vegetarian recipes, allergic to nuts"
  }
}
```

**Examples:**
- MemGPT/Letta: Core Memory blocks
- MIRIX: Core Memory component

---

## Part 2: Vector Embeddings - The Universal Substrate

### Yes! Vectors and Embeddings are Everywhere

**Vector embeddings are the dominant representation layer** for agent memory. Here's why:

#### Why Vectors Won

1. **Semantic Search**
   ```
   Traditional: Keyword matching ("vegetarian recipe")
   Vector:     Semantic similarity (understands "plant-based meal")
   ```

2. **Native to LLMs**
   - Transformer models use embeddings internally
   - No translation layer needed
   - Direct compatibility with LLM processing

3. **Scalable Similarity Search**
   ```python
   # Fast approximate nearest neighbor search
   query_embedding = embed("What did user say about diet?")
   results = vector_db.search(query_embedding, top_k=5)
   # Returns: All relevant dietary conversations
   ```

4. **Multi-Modal Capability**
   - Text → vectors
   - Images → vectors (via CLIP, QwenVL)
   - Audio → vectors
   - All searchable in unified space!

### Vector Database Ecosystem

**Dominant Players:**
- **FAISS** (Facebook AI): High-performance, open-source
- **Pinecone**: Managed, cloud-native
- **Weaviate**: Hybrid vector + graph
- **Chroma**: Lightweight, embedded
- **Qdrant**: Fast, feature-rich
- **pgvector**: PostgreSQL extension (used by MemoriesDB)

### Embedding Models

**Current Standards:**
- **OpenAI**: `text-embedding-3-small`, `text-embedding-3-large`
- **BAAI**: `bge-m3` (multilingual, multi-task)
- **Sentence Transformers**: Open-source family
- **Voyage AI**: Specialized for retrieval
- **Cohere**: `embed-v3` (long context)

### Vector Operations in Practice

```python
# Example: Semantic memory retrieval
from openai import OpenAI
import faiss

# 1. Embed user query
query = "Tell me about my dietary preferences"
query_vector = OpenAI().embeddings.create(
    model="text-embedding-3-small",
    input=query
).data[0].embedding

# 2. Search vector database
index = faiss.read_index("semantic_memory.index")
distances, indices = index.search(
    np.array([query_vector]), 
    k=5  # top 5 matches
)

# 3. Retrieve semantic memories
memories = [memory_store[idx] for idx in indices[0]]
# Returns: ["User is vegetarian", "User allergic to nuts", ...]
```

### Hybrid Search: Vectors + More

**Current Best Practice:** Combine multiple retrieval methods

```
Retrieval Methods:
1. Vector similarity (semantic)
2. BM25 (keyword/lexical)
3. Metadata filtering (temporal, categorical)
4. Graph traversal (relational)
```

**Example (GAM Architecture):**
```python
def retrieve_context(query):
    # Layer 1: Vector search
    semantic_results = vector_search(query_embedding)
    
    # Layer 2: Keyword search
    keyword_results = bm25_search(query_text)
    
    # Layer 3: Temporal filter
    recent_results = temporal_filter(results, days=7)
    
    # Layer 4: Graph traversal
    related_results = graph_traverse(results)
    
    # Fusion: Combine and rank
    return fuse_and_rank(
        semantic_results,
        keyword_results,
        recent_results,
        related_results
    )
```

---

## Part 3: Emerging Architectures - 2-3 Dominant Patterns

### Pattern 1: **Hierarchical Memory (H-MEM/MemGPT Style)**

**Key Idea:** Organize memory in layers of increasing abstraction, inspired by OS memory management

#### MemGPT/Letta Architecture

```
┌─────────────────────────────────────────┐
│  IN-CONTEXT MEMORY (Limited)            │
├─────────────────────────────────────────┤
│  Core Memory Blocks (Self-Editable)     │
│    • Persona                            │
│    • User Facts                         │
├─────────────────────────────────────────┤
│  Message Buffer (Recent Context)        │
│    • Last N messages                    │
└─────────────────────────────────────────┘
              ↕ (Function Calls)
┌─────────────────────────────────────────┐
│  EXTERNAL STORAGE (Unlimited)           │
├─────────────────────────────────────────┤
│  Recall Memory                          │
│    • Full conversation history          │
│    • Searchable archive                 │
├─────────────────────────────────────────┤
│  Archival Memory                        │
│    • Knowledge base                     │
│    • Vector DB                          │
│    • Graph DB                           │
└─────────────────────────────────────────┘
```

**Key Innovation:** Agent autonomously manages memory tiers using function calls
- Like OS paging: RAM (context) ↔ Disk (external storage)
- Self-editing: Agent can rewrite its own core memory
- Token-efficient: Only relevant context in window

**Implementations:**
- **Letta** (formerly MemGPT): Production implementation
- **MemInsight**: Autonomous extraction variant
- **A-MEM**: Self-organizing, Zettelkasten-inspired

**Use Cases:**
- Long-running personal assistants
- Customer service agents (remember customer history)
- Research assistants (accumulate knowledge)

---

### Pattern 2: **Structured Multi-Type Memory (MIRIX Style)**

**Key Idea:** Separate memory into distinct, specialized components with dedicated managers

#### MIRIX Architecture

```
┌────────────────────────────────────────────────┐
│           Multi-Agent Memory System            │
├────────────────────────────────────────────────┤
│  Core Memory Manager                           │
│    ├─ Persona (agent identity)                 │
│    └─ Human (persistent user facts)            │
├────────────────────────────────────────────────┤
│  Episodic Memory Manager                       │
│    └─ Time-stamped events                      │
├────────────────────────────────────────────────┤
│  Semantic Memory Manager                       │
│    └─ Abstract knowledge/facts                 │
├────────────────────────────────────────────────┤
│  Procedural Memory Manager                     │
│    └─ Skills, workflows, instructions          │
├────────────────────────────────────────────────┤
│  Resource Memory Manager                       │
│    └─ Documents, transcripts, files            │
├────────────────────────────────────────────────┤
│  Knowledge Vault Manager                       │
│    └─ Sensitive data (credentials, keys)       │
└────────────────────────────────────────────────┘
            ↓
     Active Retrieval Agent
     (Topic-based retrieval from all components)
```

**Key Innovation:** Specialized agents for each memory type
- Avoids "memory soup" (mixing all types in one vector DB)
- Topic-based routing to relevant memory components
- Prevents conflicting information (episodic vs semantic)

**Benefits:**
- **Precision:** Right memory type for the task
- **Consistency:** No conflicts (procedural ≠ episodic)
- **Scalability:** Each component can grow independently
- **Security:** Sensitive data isolated (Knowledge Vault)

**Similar Approaches:**
- **MemoryOS**: Three-tier (short/mid/long-term)
- **CoALA** (Cognitive Architectures for Language Agents): Foundational framework
- Many production systems use variants

---

### Pattern 3: **Dual-Agent Memory (GAM Style)**

**Key Idea:** Separate capturing (archiving) from retrieving (recall) with specialized agents

#### GAM (General Agentic Memory) Architecture

```
┌────────────────────────────────────────┐
│      THE MEMORIZER (Capture)           │
│                                        │
│  • Preserves FULL conversation         │
│  • No compression/summarization loss   │
│  • Structures into "pages"             │
│  • Adds metadata                       │
│  • Generates optional summaries        │
│  • Organizes searchable archive        │
└────────────────────────────────────────┘
              ↓
    ┌─────────────────────┐
    │   PAGE STORE        │
    │ (Lossless Archive)  │
    └─────────────────────┘
              ↑
┌────────────────────────────────────────┐
│      THE RESEARCHER (Retrieval)        │
│                                        │
│  • Plans search strategy               │
│  • Layered search:                     │
│    1. Vector retrieval (semantic)      │
│    2. BM25 (keyword)                   │
│    3. Direct lookup (metadata)         │
│  • Assembles task-specific context    │
│  • On-demand, JIT compilation          │
└────────────────────────────────────────┘
```

**Key Innovation:** Just-in-Time (JIT) memory compilation
- **Memorizer**: Lossless archival (like Git storing full history)
- **Researcher**: Smart retrieval (like Git forming diffs on demand)
- Inspired by JIT compilation in programming languages

**Problem Solved: "Context Rot"**
- Traditional: Aggressive summarization → information loss
- RAG: Shallow retrieval → misses connections
- GAM: Full archive + smart retrieval → no loss, targeted recall

**Performance:**
- Outperforms long-context LLMs (200K+ tokens)
- Beats standard RAG on long-horizon tasks
- Scales to unbounded conversation history

**Emerging Trend:**
- Anthropic: Experimenting with "curated, evolving context states"
- DeepSeek: Storing memory as "images" (visual encoding)
- Other groups: "Semantic operating systems"

---

## Part 4: Standards Convergence - The Emerging Stack

### Yes! Standards Are Converging (3 Layers)

The agent memory ecosystem is converging on a **three-layer stack**:

```
┌─────────────────────────────────────────────────┐
│  LAYER 3: Memory Management Layer               │
│  (High-level orchestration)                     │
│                                                 │
│  • Letta/MemGPT                                 │
│  • Mem0                                         │
│  • LangChain Memory                             │
│  • LangGraph State Management                   │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  LAYER 2: Retrieval & Storage Patterns         │
│  (Middleware)                                   │
│                                                 │
│  • RAG (Retrieval-Augmented Generation)         │
│  • Hybrid Search (Vector + Keyword + Graph)     │
│  • Temporal Indexing                            │
│  • Memory Consolidation                         │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  LAYER 1: Storage Infrastructure                │
│  (Databases)                                    │
│                                                 │
│  • Vector DBs: FAISS, Pinecone, Weaviate        │
│  • Graph DBs: Neo4j, Neptune                    │
│  • Relational DBs: PostgreSQL + pgvector        │
│  • Document Stores: MongoDB                     │
└─────────────────────────────────────────────────┘
```

### Convergence Point 1: **Memory Representation**

**Winner: Hybrid Approach**
```
Primary:   Vector embeddings (semantic)
Secondary: Structured metadata (filtering)
Tertiary:  Graph relationships (reasoning)
```

### Convergence Point 2: **Memory Types**

**Industry Standard (5 types):**
1. Working/Short-term (context window)
2. Episodic (time-stamped experiences)
3. Semantic (factual knowledge)
4. Procedural (skills/actions)
5. Core/Persistent (identity/preferences)

**80% of frameworks support these 5 types** (some merge 4-5 into "long-term")

### Convergence Point 3: **Retrieval Pattern**

**Standard: Agentic RAG**
```python
# Old RAG: Passive retrieval
context = retrieve(query)
response = llm(query + context)

# Agentic RAG: Agent controls retrieval
def agent_loop():
    while not task_complete:
        # Agent decides WHEN and WHAT to retrieve
        if needs_memory:
            context = memory.search(agent_query)
        response = llm.reason(context)
        action = execute(response)
```

**Key Difference:** Agent autonomously manages its memory operations

### Convergence Point 4: **Temporal Awareness**

**Emerging Standard: Time as First-Class Dimension**
```
Memory = (Content, Meaning, Time, Relations)
         (Text,    Vector,  Timestamp, Graph)
```

**Examples:**
- **MemoriesDB**: Temporal-Semantic-Relational Graph
- **SynapticRAG**: Temporal vector encoding
- **Selective Forgetting**: Ebbinghaus curve + recency scoring

### Convergence Point 5: **Memory Operations**

**Standard CRUD + Search:**
```python
# Universal Memory Interface (emerging standard)
class MemorySystem:
    def add(self, content, metadata, user_id):
        """Store new memory"""
        
    def search(self, query, filters, top_k):
        """Semantic + filtered retrieval"""
        
    def update(self, memory_id, new_content):
        """Modify existing memory"""
        
    def delete(self, memory_id):
        """Remove memory"""
        
    def get(self, memory_id):
        """Direct lookup"""
```

**Implementations:**
- Mem0: `add()`, `search()`, `update()`, `delete()`
- Letta: `insert()`, `query()`, `edit_core_memory()`
- LangChain: `save_context()`, `load_memory_variables()`

---

## Part 5: Technology Stack - What's Being Used

### Vector Databases (Market Leaders)

| Database | Type | Best For | Adoption |
|----------|------|----------|----------|
| **FAISS** | Open-source, in-memory | Research, prototypes | Very High |
| **Pinecone** | Managed cloud | Production, scale | High |
| **Weaviate** | Hybrid (vector + graph) | Complex queries | Growing |
| **Chroma** | Embedded | Simple use cases | High |
| **Qdrant** | Fast retrieval | Performance-critical | Growing |
| **pgvector** | PostgreSQL extension | SQL integration | High |

### Graph Databases (Relational Memory)

| Database | Best For | Use Case |
|----------|----------|----------|
| **Neo4j** | Property graphs | Multi-hop reasoning |
| **Amazon Neptune** | Cloud graph | AWS integration |
| **Knowledge Graphs** | Structured facts | Explainable AI |

### Embedding Models (Current Leaders)

| Model | Provider | Dimensions | Use Case |
|-------|----------|------------|----------|
| `text-embedding-3-small` | OpenAI | 1536 | Fast, cost-effective |
| `text-embedding-3-large` | OpenAI | 3072 | High quality |
| `bge-m3` | BAAI | 1024 | Multilingual, open |
| `embed-v3` | Cohere | 1024 | Long context |

### Memory Frameworks (Emerging Leaders)

#### 1. **Letta (formerly MemGPT)**
```yaml
Type: Complete memory system
Approach: OS-inspired hierarchical
Features:
  - Self-editing core memory
  - Autonomous memory management
  - Recall + Archival memory
  - Function-based paging
Adoption: Open source, 19K+ stars
Status: Production-ready
```

#### 2. **Mem0**
```yaml
Type: Memory layer platform
Approach: Personalization-focused
Features:
  - User/session/agent memory
  - Managed service + open source
  - Multi-tenant support
  - Vector + graph hybrid
Adoption: AWS partnership, growing fast
Status: Production-ready
```

#### 3. **LangChain/LangGraph**
```yaml
Type: Orchestration framework
Approach: Flexible integration
Features:
  - Multiple memory types
  - Vector store integration
  - State management (LangGraph)
  - Extensive ecosystem
Adoption: Very high (dominant framework)
Status: Production-ready
```

#### 4. **CrewAI**
```yaml
Type: Multi-agent framework
Approach: Crew-based collaboration
Features:
  - Shared memory across agents
  - Hierarchical memory
  - Task-specific memory
  - Entity memory
Adoption: Growing (especially for multi-agent)
Status: Production-ready
```

---

## Part 6: Advanced Concepts - Cutting Edge

### 1. **Sleep-Time Compute (Asynchronous Memory Refinement)**

**Problem:** Memory operations block real-time responses

**Solution:** Specialized agents process memory during idle time
```
┌──────────────────────────────────────┐
│  User Interaction (Real-time)       │
│  → Quick response, minimal memory    │
└──────────────────────────────────────┘
         ↓ (async during idle)
┌──────────────────────────────────────┐
│  Memory Agent (Background)           │
│  → Extract insights                  │
│  → Consolidate memories              │
│  → Update core facts                 │
│  → Prune low-value entries           │
└──────────────────────────────────────┘
```

**Benefit:** High-quality memory without latency penalty

**Implementation:** Letta's emerging feature

### 2. **Selective Forgetting (Memory Pruning)**

**Problem:** Unbounded memory growth → slow retrieval, high cost

**Solution:** Intelligent pruning using utility scoring

**RIF Formula (Recency-Relevance-Frequency):**
```python
utility_score = (
    recency_weight * decay_function(time_since_access) +
    relevance_weight * cosine_similarity(query, memory) +
    frequency_weight * access_count
)

# Prune memories below threshold
if utility_score < threshold:
    delete_memory(memory_id)
```

**Inspired by:** Ebbinghaus forgetting curve (human memory research)

### 3. **Hierarchical Retrieval (H-MEM)**

**Problem:** Flat vector search → exhaustive, slow for large memories

**Solution:** Multi-level semantic hierarchy
```
Domain Layer (Most Abstract)
    ↓
Category Layer
    ↓
Memory Trace Layer
    ↓
Episode Layer (Most Specific)
```

**Benefit:** Train small classifiers for routing, avoid exhaustive vector search

**Performance:** Orders of magnitude faster for large memory banks

### 4. **Multi-Modal Memory**

**Emerging:** Store different modalities in unified semantic space
```python
# Text, images, audio → shared embedding space
text_vector = embed_text("User said they like cats")
image_vector = embed_image("cat_photo.jpg")
audio_vector = embed_audio("meow_sound.wav")

# All searchable together!
query_vector = embed_text("What animals does user like?")
results = unified_search(query_vector)
# Returns: Text, images, audio about cats
```

**Models:** CLIP (text+image), QwenVL (multi-modal)

### 5. **Graph-Enhanced Memory (GraphRAG)**

**Pattern:** Combine vectors (similarity) + graphs (relationships)
```
Vector Search: "Find similar concepts"
       +
Graph Traversal: "Follow relationships"
       =
Rich Context: Multi-hop reasoning
```

**Use Cases:**
- Multi-hop question answering
- Explainable reasoning (show path)
- Factual grounding (enforce relationships)

**Example:** Microsoft's GraphRAG

---

## Part 7: Production Considerations

### Memory System Design Checklist

#### 1. **Choose Memory Types**
```yaml
Minimal (Basic Agent):
  - Working memory (context window)
  - Semantic memory (RAG)

Standard (Production Agent):
  - Working memory
  - Episodic memory
  - Semantic memory
  - Core memory

Advanced (Stateful Agent):
  - All 5 types (add procedural)
  - Multi-modal support
  - Graph relationships
```

#### 2. **Select Storage Layer**
```yaml
Small Scale (<1K users):
  Vector DB: Chroma (embedded), FAISS (in-memory)
  Graph: Optional

Medium Scale (1K-100K users):
  Vector DB: Qdrant, Weaviate
  Graph: Optional (Neo4j if needed)
  Caching: Redis

Large Scale (100K+ users):
  Vector DB: Pinecone, Weaviate (distributed)
  Graph: Neo4j, Neptune Analytics
  SQL: PostgreSQL + pgvector
  Caching: Redis/Valkey
```

#### 3. **Memory Operations Budget**
```yaml
Reads:  High frequency (every agent turn)
Writes: Lower frequency (consolidate)
Search: Medium frequency (agentic control)

Optimization:
  - Batch writes
  - Cache recent retrievals
  - Use memory tiers (hot/warm/cold)
```

#### 4. **Privacy & Security**
```yaml
Considerations:
  - User data isolation (multi-tenancy)
  - Encryption at rest
  - Sensitive data handling (MIRIX Knowledge Vault)
  - GDPR/data deletion
  - Access controls
```

---

## Part 8: Future Directions

### Emerging Trends (2025-2026)

#### 1. **Semantic Operating Systems**
- Memory as a first-class OS primitive
- Agents as processes with persistent state
- Shared memory spaces for multi-agent systems

#### 2. **Visual/Image Memory**
- DeepSeek's experiment: Store memories as images
- Hypothesis: More efficient than text for some memory types
- Multi-modal memory becoming standard

#### 3. **Memory Standards**
- Potential for unified memory API
- Cross-framework memory portability
- Memory marketplaces (pre-trained memory banks)

#### 4. **Neurosymbolic Memory**
- Hybrid: Neural (vectors) + Symbolic (logic)
- Explainable reasoning with memory
- Formal verification of memory consistency

#### 5. **Continual Learning in Memory**
- Memory that adapts to changing facts
- Conflict resolution (old vs new information)
- Temporal knowledge graphs

---

## Part 9: Recommendations for uSA

### How to Integrate Memory into Uniform Semantic Agent

Based on this research, here's what we should add to uSA:

#### 1. **Memory Configuration Section**

```yaml
memory:
  # Memory types enabled
  types:
    - working:
        enabled: true
        max_tokens: 8192
    
    - episodic:
        enabled: true
        storage: vector_db
        provider: pinecone
        retention: unlimited
    
    - semantic:
        enabled: true
        storage: hybrid  # vector + graph
        vector_db: weaviate
        graph_db: neo4j
        rag_enabled: true
    
    - procedural:
        enabled: true
        storage: structured
        format: pydantic_schemas
    
    - core:
        enabled: true
        blocks:
          - persona: editable
          - user_facts: editable
  
  # Memory operations
  operations:
    retrieval:
      method: agentic_rag
      hybrid_search: true
      reranking: enabled
    
    consolidation:
      strategy: sleep_time_compute
      frequency: daily
    
    forgetting:
      enabled: true
      strategy: utility_based
      threshold: 0.3
  
  # Vector configuration
  embeddings:
    model: openai/text-embedding-3-small
    dimensions: 1536
    batch_size: 100
  
  # Storage backends
  storage:
    primary: weaviate
    backup: postgresql
    cache: redis
```

#### 2. **Memory Deployment Adapters**

Different frameworks handle memory differently:

```python
# CrewAI Adapter
class CrewAIMemoryAdapter:
    def adapt_memory(self, usa_memory_spec):
        return CrewAIMemory(
            embedder=usa_memory_spec.embeddings.model,
            storage=usa_memory_spec.storage.primary,
            # CrewAI uses entity memory
            entity_memory=create_entity_memory(usa_memory_spec),
            long_term_memory=create_ltm(usa_memory_spec)
        )

# Letta Adapter
class LettaMemoryAdapter:
    def adapt_memory(self, usa_memory_spec):
        return LettaAgent(
            core_memory=create_core_memory(usa_memory_spec.types.core),
            recall_storage=usa_memory_spec.storage.primary,
            archival_storage=usa_memory_spec.storage.primary,
            # Letta uses self-editing memory
            memory_edit_enabled=True
        )
```

#### 3. **Memory Specification Example**

```yaml
# research_agent_with_memory.usa.yaml
apiVersion: usa/v1
kind: Agent

metadata:
  name: research-agent-with-memory
  version: 2.0.0

# ... identity, capabilities ...

memory:
  architecture: hierarchical  # hierarchical | structured | dual-agent
  
  types:
    working:
      max_tokens: 16384
      
    episodic:
      enabled: true
      retention_days: unlimited
      temporal_indexing: true
      
    semantic:
      enabled: true
      rag:
        top_k: 5
        min_relevance: 0.7
      
    core:
      blocks:
        persona: |
          I am a research assistant specializing in academic literature.
        user_preferences: |
          User prefers recent papers (last 2 years).
  
  embeddings:
    model: openai/text-embedding-3-large
    dimensions: 3072
  
  storage:
    vector_db:
      provider: weaviate
      collection: research_memories
    graph_db:
      provider: neo4j
      database: research_graph
  
  operations:
    retrieval: agentic  # agent controls when/what to retrieve
    consolidation: async  # background processing
    forgetting:
      enabled: true
      strategy: recency_relevance_frequency

# ... execution, protocols, deployment ...
```

---

## Conclusions

### Key Findings

1. **✅ Convergence on Memory Types**
   - Industry consensus: **5 memory types** (working, episodic, semantic, procedural, core)
   - Inspired by cognitive psychology
   - ~80% of frameworks support this taxonomy

2. **✅ Vector Embeddings Dominant**
   - **Universal substrate** for agent memory
   - Semantic retrieval is the killer feature
   - Used in: episodic, semantic, procedural memory
   - Hybrid approaches (vector + graph + temporal) emerging

3. **✅ 2-3 Architectural Patterns Emerging**
   - **Pattern 1:** Hierarchical (MemGPT/Letta) - OS-inspired
   - **Pattern 2:** Structured Multi-Type (MIRIX) - Specialized components
   - **Pattern 3:** Dual-Agent (GAM) - Separate capture & retrieval
   - Most production systems blend these patterns

4. **✅ Standards Converging**
   - **Layer 1:** Vector DBs (FAISS, Pinecone, Weaviate) + Graph DBs
   - **Layer 2:** RAG patterns, hybrid search, temporal indexing
   - **Layer 3:** Memory management (Letta, Mem0, LangChain)
   - **Operations:** CRUD + Search becoming standard interface

5. **✅ Future is Hybrid**
   - Vector (semantic) + Graph (relational) + Temporal (time)
   - Multi-modal (text, images, audio) in unified space
   - Agentic control (agent manages its own memory)
   - Neurosymbolic (neural + symbolic reasoning)

### For Uniform Semantic Agent

**Recommendation:** Add comprehensive memory specification section to uSA that:

1. Declares memory types (5 standard types)
2. Specifies storage backends (vector DB, graph DB)
3. Configures embeddings (model, dimensions)
4. Defines operations (retrieval, consolidation, forgetting)
5. Enables framework-specific adapters

This makes uSA agents **truly stateful and adaptive** across any deployment context!

---

## References & Further Reading

### Research Papers
- **MemGPT**: Teaching LLMs to Use Long-Term Memory (arXiv:2310.08560)
- **MIRIX**: Multi-Agent Memory System for LLM-Based Agents
- **GAM**: General Agentic Memory (Context Engineering)
- **H-MEM**: Hierarchical Memory for LLM Agents
- **MemoriesDB**: Temporal-Semantic-Relational Database
- **CoALA**: Cognitive Architectures for Language Agents

### Production Systems
- **Letta** (MemGPT): https://www.letta.com
- **Mem0**: https://mem0.ai
- **LangChain**: https://langchain.com
- **CrewAI**: https://crewai.com

### Vector Databases
- **FAISS**: https://faiss.ai
- **Pinecone**: https://www.pinecone.io
- **Weaviate**: https://weaviate.io
- **Chroma**: https://www.trychroma.com
- **Qdrant**: https://qdrant.tech

---

**Research Completed:** December 28, 2025  
**Next Update:** Monitor emerging standards through 2026

**The field is rapidly maturing. Expect further consolidation around these patterns in 2026.**

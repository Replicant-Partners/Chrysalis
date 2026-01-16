# Agentic Memory Frameworks Research

**Date:** January 16, 2026
**Purpose:** Survey agentic memory systems similar to Letta for potential Chrysalis integration

---

## Executive Summary

Three major agentic memory paradigms have emerged:

| Framework | Approach | Stars | Key Innovation |
|-----------|----------|-------|----------------|
| **Mem0** | Universal memory layer | 45K | +26% accuracy vs OpenAI, graph memory |
| **Letta** | Memory-first agent | 15K | Persistent agent, skill learning |
| **Zep** | Memory service | 4K | Integrations, session management |

**Chrysalis differentiation:** Distributed multi-instance sync, Byzantine resistance, protocol morphing.

---

## Mem0 (mem0ai/mem0)

**Stars:** 45,569 | **YC:** S24 | **Language:** Python + TypeScript

### Key Stats
- **+26% accuracy** over OpenAI Memory on LOCOMO benchmark
- **91% faster** than full-context approaches
- **90% fewer tokens** than full-context

### Architecture

```
mem0/
├── memory/
│   ├── base.py           # Base memory interface
│   ├── graph_memory.py   # Graph-based memory
│   ├── kuzu_memory.py    # Kuzu graph DB backend
│   ├── memgraph_memory.py # Memgraph backend
│   └── storage.py        # Storage abstraction
├── graphs/               # Knowledge graph layer
├── embeddings/           # Embedding models
├── vector_stores/        # Vector DB integrations
├── llms/                 # LLM providers
├── reranker/             # Reranking layer
└── client/               # API client
```

### Memory Levels
- **User Memory:** Persistent across all sessions
- **Session Memory:** Conversation-specific
- **Agent Memory:** Agent-specific knowledge

### Graph Memory (KEY INNOVATION)

Mem0 supports **graph-based memory** with multiple backends:
- Kuzu (embedded graph DB)
- Memgraph (high-performance graph DB)
- Neo4j-compatible

This enables **relationship-aware memory** beyond simple vector similarity.

### Usage

```python
from mem0 import Memory

# Initialize
m = Memory()

# Add memory
m.add("I like tennis", user_id="alice")
m.add("My favorite color is blue", user_id="alice")

# Search
results = m.search("What are alice's preferences?", user_id="alice")

# Get all memories for user
memories = m.get_all(user_id="alice")
```

### OpenMemory (MCP Server!)

Mem0 includes **OpenMemory** - a full memory service with:
- API server (FastAPI)
- UI dashboard
- Docker deployment
- **MCP integration!**

### Alignment with Chrysalis

| Feature | Mem0 | Chrysalis |
|---------|------|-----------|
| Vector Memory | ✅ | ✅ |
| Graph Memory | ✅ (Kuzu, Memgraph) | ✅ (graph/) |
| User/Session/Agent levels | ✅ | ✅ (episodic/semantic) |
| Distributed | ❌ | ✅ |
| Byzantine Resistance | ❌ | ✅ |
| MCP Server | ✅ (OpenMemory) | ❌ |

**Extractable patterns:**
1. **Graph memory with Kuzu** - Lightweight embedded graph DB
2. **Reranker layer** - Improve retrieval quality
3. **MCP server** - OpenMemory could inspire Chrysalis MCP

---

## Letta (letta-ai/letta-code)

**Stars:** ~15K | **Previously:** MemGPT | **Language:** TypeScript

### Key Innovation

**Agent-first, not session-first:**
- Sessions are tied to persistent agents
- Agents learn and remember across sessions
- `/skill` command learns from trajectory

### Architecture

```
src/
├── agent/
│   ├── memory.ts        # Memory blocks
│   ├── skills.ts        # Skill management
│   └── subagents/       # Sub-agent orchestration
├── skills/              # Skill implementations
├── tools/               # Tool implementations
└── lsp/                 # Language Server Protocol
```

### Memory Blocks

```typescript
// Global (shared across projects)
GLOBAL_BLOCK_LABELS = ["persona", "human"]

// Project (local to directory)
PROJECT_BLOCK_LABELS = ["project", "skills", "loaded_skills"]
```

### Alignment with Chrysalis

| Feature | Letta | Chrysalis |
|---------|-------|-----------|
| Persistent Memory | ✅ | ✅ |
| Skill Learning | ✅ (/skill) | ✅ (SkillAccumulator) |
| Cross-Model | ✅ | ✅ (protocol morph) |
| Subagents | ✅ | ✅ |
| Distributed | ❌ | ✅ |
| Byzantine | ❌ | ✅ |

**Already analyzed in:** `LETTA_CODE_ANALYSIS_2026-01-16.md`

---

## Zep (getzep/zep)

**Stars:** 3,973 | **Focus:** Memory integrations

### Architecture

Zep provides memory-as-a-service with:
- Session management
- User memory
- Agent memory
- Integration with LangChain, LlamaIndex, etc.

### Key Features
- **Fact extraction:** Automatically extracts facts from conversations
- **Session summaries:** Compresses long conversations
- **Entity tracking:** Tracks entities mentioned in conversations

### Alignment with Chrysalis

| Feature | Zep | Chrysalis |
|---------|-----|-----------|
| Session Memory | ✅ | ✅ |
| Fact Extraction | ✅ | ❌ |
| Entity Tracking | ✅ | ❌ |
| LangChain Integration | ✅ | ❌ |

**Extractable patterns:**
1. **Fact extraction** - Could enhance Chrysalis semantic memory
2. **Entity tracking** - Track entities across conversations

---

## Other Notable Frameworks

### A-MEM (Agentic Memory)

Research paper implementing memory using Zettelkasten principles:
- Notes link to other notes
- Agentic organization (agent decides how to organize)
- Dynamic linking based on semantic similarity

### Memary

- Open-source memory system for agents
- Focus on conversation history
- Entity recognition

### Cognee

- Knowledge graph-based memory
- RAG integration
- Document processing

---

## Comparison Matrix

| Capability | Chrysalis | Mem0 | Letta | Zep |
|------------|-----------|------|-------|-----|
| **Vector Memory** | ✅ | ✅ | ❌ | ✅ |
| **Graph Memory** | ✅ | ✅ | ❌ | ❌ |
| **Episodic Memory** | ✅ | ✅ (User) | ✅ (Blocks) | ✅ |
| **Semantic Memory** | ✅ | ✅ | ✅ | ✅ |
| **Fact Extraction** | ❌ | ❌ | ❌ | ✅ |
| **Entity Tracking** | ❌ | ❌ | ❌ | ✅ |
| **Skill Learning** | ✅ | ❌ | ✅ | ❌ |
| **Distributed** | ✅ | ❌ | ❌ | ❌ |
| **Byzantine** | ✅ | ❌ | ❌ | ❌ |
| **MCP Server** | ❌ | ✅ | ❌ | ❌ |
| **Reranking** | ❌ | ✅ | ❌ | ❌ |

---

## Recommended Integrations for Chrysalis

### Priority 1: Mem0 as Remote Memory Backend (HIGH VALUE)

Instead of reimplementing, use Mem0 as a backend:

```typescript
// New: src/memory/backends/Mem0Backend.ts
class Mem0Backend implements MemoryBackend {
  private client: Mem0Client;

  add(content: string, metadata: MemoryMetadata): Promise<void>;
  search(query: string, userId?: string): Promise<Memory[]>;

  // Sync with Chrysalis distributed memory
  async syncToMemory(experiences: Experience[]): Promise<void> {
    for (const exp of experiences) {
      await this.client.add(exp.content, {
        user_id: exp.userId,
        metadata: exp.metadata
      });
    }
  }
}
```

**Benefit:** Leverage Mem0's benchmarked improvements (+26% accuracy).

### Priority 2: Graph Memory with Kuzu (MEDIUM VALUE)

Add Kuzu as embedded graph backend:

```typescript
// New: src/memory/graph/KuzuGraphMemory.ts
class KuzuGraphMemory implements GraphMemory {
  private db: kuzu.Database;

  async addNode(entity: Entity): Promise<string>;
  async addEdge(from: string, to: string, relation: string): Promise<void>;
  async query(cypher: string): Promise<QueryResult>;

  // Graph-aware memory retrieval
  async retrieveWithRelations(query: string): Promise<MemoryWithRelations> {
    const memories = await this.vectorSearch(query);
    const relations = await this.expandRelations(memories);
    return { memories, relations };
  }
}
```

**Benefit:** Relationship-aware memory beyond vector similarity.

### Priority 3: Fact Extraction (from Zep) (MEDIUM VALUE)

Extract facts automatically:

```typescript
// New: src/memory/extraction/FactExtractor.ts
class FactExtractor {
  async extractFacts(conversation: Message[]): Promise<Fact[]>;
  async extractEntities(text: string): Promise<Entity[]>;
  async linkEntities(entities: Entity[], graphDb: GraphMemory): Promise<void>;
}
```

### Priority 4: OpenMemory-style MCP Server (HIGH VALUE)

Create Chrysalis memory MCP server:

```typescript
// New: src/mcp-server/chrysalis-memory/
const mcpServer = new MCPServer({
  name: "chrysalis-memory",
  tools: [
    {
      name: "memory_add",
      description: "Add memory for user",
      handler: async (input) => chrysalisMemory.add(input.content, input.userId)
    },
    {
      name: "memory_search",
      description: "Search memories",
      handler: async (input) => chrysalisMemory.search(input.query)
    },
    {
      name: "memory_sync",
      description: "Sync with distributed instances",
      handler: async () => chrysalisMemory.syncAll()
    }
  ]
});
```

---

## Strategic Positioning

### Chrysalis Unique Value Proposition

While Mem0, Letta, and Zep focus on **single-instance memory**, Chrysalis provides:

1. **Distributed Memory Sync** - Multi-instance learning
2. **Byzantine Resistance** - Trust validation for distributed memories
3. **Protocol Morphing** - Cross-framework compatibility
4. **OODA Recording** - Decision loop tracking

### Chrysalis Memory Philosophy

> **"Memory is essential. The right memory model is unknown."**

**Key Architectural Decision:**
- **Beads + Fireproof + Nomic** = FIXED layers (our value-add, same for ALL agents)
- **Long-term Backend** = PLUGGABLE (Zep | Letta | Mem0)

This means:
1. Users choose their long-term memory backend based on needs
2. Our short/mid-term layers (Beads, Fireproof) wrap ANY backend
3. Nomic embeddings are shared across all configurations
4. Byzantine validation applies to ALL backends during sync

### Final Architecture

**Strategic Roles:**

| Component | Strategic Role | Why Critical |
|-----------|----------------|--------------|
| **Beads** | Short-term context buffer | Fast local access, TTL-based cleanup |
| **Fireproof** | **Durable local cache + CRDT sync buffer** | Local-first with CRDT merge, syncs to cloud |
| **Nomic** | Calibration + Offline fallback | Works when disconnected from primary services |
| **Long-term** | Remote persistent storage + multi-agent sync | Zep/Letta/Mem0 for durable cloud storage |

```
┌────────────────────────────────────────────────────────────────────────┐
│                    CHRYSALIS MEMORY ARCHITECTURE                        │
│                                                                        │
│  "Fireproof provides durable local CRDT storage,                       │
│   Long-term backends handle multi-agent synchronization"               │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─── FIXED CHRYSALIS LAYERS (per agent) ───────────────────────────┐ │
│  │                                                                   │ │
│  │  ┌───────────┐                                                   │ │
│  │  │   BEADS   │  Short-term context (TTL, max_items)              │ │
│  │  │ (local)   │  Feeds into Fireproof when important              │ │
│  │  └─────┬─────┘                                                   │ │
│  │        │ promotes (importance ≥ 0.7)                             │ │
│  │        ▼                                                         │ │
│  │  ┌───────────────────────────────────────────────────────────┐  │ │
│  │  │                    FIREPROOF (Local CRDT)                  │  │ │
│  │  │                                                            │  │ │
│  │  │  ★ DURABLE LOCAL CACHE + SYNC BUFFER ★                    │  │ │
│  │  │                                                            │  │ │
│  │  │  • Local-first (works offline)                             │  │ │
│  │  │  • CRDT merge for concurrent local operations              │  │ │
│  │  │  • Sync queue to long-term backend                         │  │ │
│  │  │  • Survives process restarts                               │  │ │
│  │  └───────────────────────┬───────────────────────────────────┘  │ │
│  │                          │                                      │ │
│  │        ┌─────────────────┼─────────────────┐                    │ │
│  │        │                 │                 │                    │ │
│  │        ▼                 ▼                 ▼                    │ │
│  │  ┌───────────┐    ┌───────────┐    ┌─────────────────────┐    │ │
│  │  │  NOMIC    │    │ BYZANTINE │    │  SYNC TO LONG-TERM  │    │ │
│  │  │ EMBEDDING │    │VALIDATION │    │  (when online)      │    │ │
│  │  │           │    │           │    │                     │    │ │
│  │  │ • Local   │    │ • >2/3    │    │  Push to cloud      │    │ │
│  │  │ • Offline │    │ • Trimmed │    │  Pull from cloud    │    │ │
│  │  │ • Backup  │    │   mean    │    │                     │    │ │
│  │  └───────────┘    └───────────┘    └─────────────────────┘    │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                   │                                    │
│                                   ▼ Sync via long-term backend         │
│  ┌─── PLUGGABLE LONG-TERM (multi-agent sync) ───────────────────────┐ │
│  │                                                                   │ │
│  │  ┌─────────┐    ┌─────────┐    ┌─────────┐                      │ │
│  │  │   ZEP   │    │  LETTA  │    │  MEM0   │                      │ │
│  │  │ (facts) │    │(blocks) │    │ (graph) │                      │ │
│  │  └─────────┘    └─────────┘    └─────────┘                      │ │
│  │                                                                   │ │
│  │  Multi-agent sync happens HERE (cloud-mediated)                  │ │
│  │  Each agent: pushes to cloud ←→ retrieves from cloud             │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### How Multi-Agent Sync Actually Works

**Current Implementation (Cloud-Mediated):**
```
Agent A ───push────▶┌─────────────────────┐◀────push─── Agent C
                    │   ZEP / LETTA / MEM0 │
Agent B ───push────▶│   (Cloud Backend)   │◀────push─── Agent D
                    └─────────────────────┘
                              │
                    All agents retrieve from here
                              │
                    ▼                    ▼
                Agent A              Agent B
              (retrieves)          (retrieves)

Agents sync THROUGH the cloud backend.
Fireproof is local cache per agent.
```

**Future Enhancement (Direct P2P via native Fireproof):**
```
Agent A ◀──CRDT──▶ Agent B
    ▲                 ▲
    │     direct      │
    │      sync       │
    ▼                 ▼
Agent C ◀──CRDT──▶ Agent D

Native Fireproof library supports peer-to-peer
Merkle-CRDT sync. Not yet implemented in our
Python emulation layer.
```

### Offline Resilience

1. **Disconnected from Zep/Letta/Mem0?** → Fireproof works locally, queues changes
2. **Disconnected from embedding service?** → Nomic runs locally as fallback
3. **Reconnected?** → Fireproof syncs queued changes to long-term backend

### Backend Selection Guide

| Backend | Best For | API Key Env Var |
|---------|----------|-----------------|
| **Zep** | Fact extraction, entity tracking, summaries | `ZEP_API_KEY` |
| **Letta** | Memory blocks, skill learning, agent persistence | `LETTA_API_KEY` |
| **Mem0** | Graph memory, +26% accuracy, reranking | `MEM0_API_KEY` |
| **Native** | Distributed sync, Byzantine validation, offline | (none) |

### Implementation Status

✅ **Zep** - Already integrated via `FireproofZepSync`
✅ **Letta** - `LettaLongTermBackend` created
✅ **Mem0** - `Mem0LongTermBackend` created
✅ **Beads** - `memory_system/beads.py` (unchanged)
✅ **Fireproof** - `memory_system/fireproof/` (unchanged)
✅ **Nomic** - `shared/embedding.py` (unchanged)

---

## Conclusion

The agentic memory landscape is mature with proven solutions:

1. **Mem0** - Best-in-class memory with benchmarked improvements
2. **Letta** - Memory-first agent philosophy
3. **Zep** - Integration-focused memory service

**Chrysalis should:**
- Leverage existing backends (Mem0) rather than reinvent
- Focus on unique distributed/Byzantine layer
- Expose via MCP for universal adoption

---

## Links

- [Mem0 GitHub](https://github.com/mem0ai/mem0)
- [Mem0 Docs](https://docs.mem0.ai)
- [Letta GitHub](https://github.com/letta-ai/letta-code)
- [Zep GitHub](https://github.com/getzep/zep)
- [Mem0 Research Paper](https://mem0.ai/research)

---

**Document Status:** Research Complete

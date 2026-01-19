# Chrysalis Memory System - Rust Core

High-performance CRDT-based memory system for autonomous agents.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Python Application                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              AgentMemory (High-Level API)               │    │
│  │  - learn(), recall(), update()                          │    │
│  │  - Async support, embedding integration                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              chrysalis_memory (Rust + PyO3)             │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │    │
│  │  │   CRDTs     │  │   Memory    │  │   Storage   │     │    │
│  │  │  GSet       │  │  Document   │  │   SQLite    │     │    │
│  │  │  ORSet      │  │  Collection │  │   WAL Mode  │     │    │
│  │  │  LWWRegister│  │  Embedding  │  │   Indexed   │     │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Features

- **CRDT Types**: GSet, ORSet, LWWRegister, VectorClock, GCounter
- **Memory Documents**: Full CRDT-aware document structure with merge semantics
- **SQLite Storage**: Persistent storage with WAL mode for high concurrency
- **Python Bindings**: PyO3-based bindings with full type hints
- **Async Support**: High-level Python wrapper with async/await

## Building

### Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install maturin (Python build tool for Rust extensions)
pip install maturin
```

### Development Build

```bash
cd memory_system/rust_core

# Build and install in development mode
maturin develop

# Or build a wheel
maturin build --release
```

### Production Build

```bash
# Build optimized wheel
maturin build --release

# Install the wheel
pip install target/wheels/chrysalis_memory-*.whl
```

## Usage

### Low-Level: Direct Rust Bindings

```python
from chrysalis_memory import (
    GSet, ORSet, LWWRegister,
    MemoryDocument, MemoryStorage
)

# CRDT operations
tags = GSet()
tags.add("important")
tags.add("learning")

other_tags = GSet()
other_tags.add("learning")
other_tags.add("crdt")

# Merge is commutative, associative, idempotent
merged = tags.merge(other_tags)
print(merged.elements())  # ['important', 'learning', 'crdt']

# Memory documents with CRDT semantics
memory = MemoryDocument(
    id="mem-1",
    content="Learning about distributed systems",
    memory_type="semantic",
    source_instance="agent-001"
)

memory.add_tag("distributed")
memory.set_importance(0.9, "agent-001")

# Persistent storage
storage = MemoryStorage("./data/memory.db", "agent-001")
storage.put(memory)

# Merge happens automatically on put
other_memory = MemoryDocument(
    id="mem-1",  # Same ID
    content="Learning about CRDT",
    source_instance="agent-002"
)
other_memory.add_tag("crdt")
storage.put(other_memory)  # CRDT merge

# Result has both tags, latest content
merged = storage.get("mem-1")
print(merged.get_tags())  # ['distributed', 'crdt']
```

### High-Level: AgentMemory API

```python
import asyncio
from chrysalis_memory import AgentMemory

async def main():
    async with AgentMemory("my-agent") as memory:
        # Learn something
        mem_id = await memory.learn(
            "The user prefers Python over JavaScript",
            importance=0.9,
            tags=["preference", "language"]
        )

        # Recall relevant memories
        results = await memory.recall(
            "What programming language does the user like?",
            k=5
        )

        for m in results:
            print(f"- {m.content} (importance={m.get_importance():.2f})")

asyncio.run(main())
```

### With Embeddings

```python
import httpx
from chrysalis_memory import AgentMemory

async def embed_with_ollama(text: str) -> list[float]:
    """Generate embedding using Ollama."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:11434/api/embeddings",
            json={"model": "nomic-embed-text", "prompt": text}
        )
        return response.json()["embedding"]

async def main():
    memory = AgentMemory("my-agent", embedding_fn=embed_with_ollama)
    await memory.start()

    try:
        # Learn with embedding
        await memory.learn("Python is great for AI")
        await memory.learn("Rust is fast and safe")
        await memory.learn("JavaScript runs in browsers")

        # Semantic search
        results = await memory.recall("best language for performance")
        for m in results:
            print(f"- {m.content}")
    finally:
        await memory.stop()

asyncio.run(main())
```

## CRDT Semantics

### GSet (Grow-Only Set)
- Elements can only be added, never removed
- Merge = set union
- Use for: memories, evidence, relationships

### ORSet (Observed-Remove Set)
- Add and remove supported
- Remove only affects observed tags
- Concurrent add+remove: add wins
- Use for: tags, metadata

### LWWRegister (Last-Writer-Wins)
- Single value with timestamp
- Highest timestamp wins
- Deterministic tie-breaking by writer ID
- Use for: content, importance, confidence

### Memory Document Merge Rules

| Field | CRDT Type | Merge Strategy |
|-------|-----------|----------------|
| content | LWWRegister | Latest timestamp wins |
| tags | ORSet | Union with remove support |
| related_memories | GSet | Accumulate (never delete) |
| parent_memories | GSet | Accumulate |
| evidence | GSet | Accumulate |
| importance | LWW + max | Take maximum value |
| confidence | LWW + max | Take maximum value |
| access_count | GCounter | Element-wise max |

## Benchmarks

Run benchmarks:

```bash
cargo bench
```

Typical performance (M1 MacBook):

| Operation | Latency (p50) | Throughput |
|-----------|---------------|------------|
| GSet merge (1000 elements) | 45µs | 22,000/s |
| MemoryDocument merge | 2µs | 500,000/s |
| Storage put | 1.5ms | 650/s |
| Storage get | 0.2ms | 5,000/s |
| Storage query (1000 docs) | 5ms | 200/s |

## Testing

```bash
# Rust tests
cargo test

# Python tests
pip install pytest pytest-asyncio
pytest tests/
```

## License

MIT

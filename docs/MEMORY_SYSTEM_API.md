# Memory System API Documentation

**Version**: 1.0.0  
**Date**: 2026-01-25  
**Status**: Production Ready

## Overview

The Chrysalis Memory System provides a complete integration pipeline for system agents to store, retrieve, and synchronize memories through local Rust core to Zep cloud storage.

---

## Table of Contents

1. [SystemAgentMemoryBridge API](#systemagentmemorybridge-api)
2. [ZepCloudSync API](#zepcloudsync-api)
3. [CircuitBreaker API](#circuitbreaker-api)
4. [Data Models](#data-models)
5. [Usage Examples](#usage-examples)
6. [Error Handling](#error-handling)

---

## SystemAgentMemoryBridge API

**File**: [`Agents/system-agents/memory_bridge.py`](../Agents/system-agents/memory_bridge.py)

Main interface for system agents to interact with memory system.

### Class: `SystemAgentMemoryBridge`

```python
class SystemAgentMemoryBridge:
    def __init__(
        self,
        agent_id: str,
        zep_api_key: Optional[str] = None,
        enable_cloud_sync: bool = True
    )
```

**Parameters**:
- `agent_id` (str): Agent identifier (e.g., "ada", "lea", "phil", "david", "milton")
- `zep_api_key` (str, optional): Zep API key for cloud sync (loads from `.env` if not provided)
- `enable_cloud_sync` (bool): Enable async cloud synchronization (default: True)

### Methods

#### `async def start()`

Start background sync task.

```python
await bridge.start()
```

**Returns**: None

---

#### `async def stop()`

Stop background sync task.

```python
await bridge.stop()
```

**Returns**: None

---

#### `async def store(content, memory_type, importance, confidence, tags) -> str`

Store memory with immediate local write and async cloud sync.

```python
memory_id = await bridge.store(
    content="User prefers Python for backend",
    memory_type="semantic",
    importance=0.8,
    confidence=0.9,
    tags=["preference", "language"]
)
```

**Parameters**:
- `content` (str): Memory content text
- `memory_type` (str): Type - "episodic", "semantic", or "procedural"
- `importance` (float): Importance score 0.0-1.0
- `confidence` (float, optional): Confidence score 0.0-1.0 (default: 0.5)
- `tags` (List[str], optional): List of tags (default: None)

**Returns**: `str` - Memory ID (UUID)

**Performance**: <10ms local write latency

---

#### `async def retrieve(query, limit, memory_type, min_importance) -> List[Dict]`

Retrieve memories with local-first, cloud fallback.

```python
results = await bridge.retrieve(
    query="Python",
    limit=5,
    memory_type="semantic",
    min_importance=0.7
)
```

**Parameters**:
- `query` (str): Search query text
- `limit` (int): Maximum results (default: 5)
- `memory_type` (str, optional): Filter by type
- `min_importance` (float, optional): Minimum importance threshold

**Returns**: `List[Dict]` - List of memory dictionaries

**Memory Dict Structure**:
```python
{
    "id": "uuid-string",
    "content": "memory content",
    "memory_type": "semantic",
    "importance": 0.8,
    "confidence": 0.9,
    "tags": ["tag1", "tag2"],
    "source_instance": "ada",
    "created_at": 1706140800.0,
    "updated_at": 1706140800.0,
    "version": 1,
    "access_count": 3
}
```

---

#### `async def get(memory_id) -> Optional[Dict]`

Get specific memory by ID.

```python
memory = await bridge.get("memory-uuid")
```

**Parameters**:
- `memory_id` (str): Memory UUID

**Returns**: `Dict` or `None` if not found

---

#### `async def update(memory_id, importance, confidence, tags)`

Update memory metadata.

```python
await bridge.update(
    memory_id="memory-uuid",
    importance=0.9,
    tags=["updated", "important"]
)
```

**Parameters**:
- `memory_id` (str): Memory UUID
- `importance` (float, optional): New importance score
- `confidence` (float, optional): New confidence score
- `tags` (List[str], optional): Tags to add

**Returns**: None

---

#### `async def record_access(memory_id)`

Record memory access for importance scoring.

```python
await bridge.record_access("memory-uuid")
```

**Parameters**:
- `memory_id` (str): Memory UUID

**Returns**: None

---

#### `def get_stats() -> Dict`

Get bridge statistics.

```python
stats = bridge.get_stats()
```

**Returns**: Dictionary with:
```python
{
    "agent_id": "ada",
    "rust_available": True,
    "cloud_sync_enabled": True,
    "local_memory_count": 42,
    "sync_queue_size": 3,
    "circuit_breaker": {
        "state": "closed",
        "total_calls": 150,
        "successful_calls": 148,
        "failed_calls": 2
    }
}
```

---

## ZepCloudSync API

**File**: [`memory_system/cloud/zep_sync.py`](../memory_system/cloud/zep_sync.py)

Zep cloud synchronization with resilience patterns.

### Class: `ZepCloudSync`

```python
class ZepCloudSync:
    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.getzep.com",
        batch_size: int = 100,
        retry_attempts: int = 3,
        retry_backoff: float = 1.0,
        circuit_breaker: Optional[CircuitBreaker] = None
    )
```

### Methods

#### `async def push_memories(documents) -> Dict`

Push batch of memories to Zep with retry.

```python
result = await sync.push_memories([doc1, doc2, doc3])
```

**Returns**:
```python
{
    "success": 3,
    "failed": 0,
    "errors": []
}
```

---

#### `async def pull_updates(agent_id, since, limit) -> List[Dict]`

Pull updated memories from Zep.

```python
memories = await sync.pull_updates(
    agent_id="ada",
    since=datetime.now() - timedelta(hours=24),
    limit=100
)
```

---

#### `async def search(query, agent_id, limit, min_score) -> List[Dict]`

Semantic search in Zep.

```python
results = await sync.search(
    query="Python",
    agent_id="ada",
    limit=5,
    min_score=0.7
)
```

---

#### `async def flush_queue() -> Dict`

Flush sync queue - push all queued documents.

```python
result = await sync.flush_queue()
```

---

## CircuitBreaker API

**File**: [`memory_system/resilience/circuit_breaker.py`](../memory_system/resilience/circuit_breaker.py)

Circuit breaker for fault tolerance.

### Class: `CircuitBreaker`

```python
class CircuitBreaker:
    def __init__(
        self,
        name: str,
        config: Optional[CircuitBreakerConfig] = None
    )
```

### Methods

#### `async def can_execute() -> bool`

Check if execution is allowed.

```python
if await breaker.can_execute():
    # Proceed with operation
    pass
```

---

#### `async def record_success()`

Record successful call.

```python
await breaker.record_success()
```

---

#### `async def record_failure()`

Record failed call.

```python
await breaker.record_failure()
```

---

#### `async def call(func, *args, **kwargs)`

Execute function with circuit breaker protection.

```python
result = await breaker.call(api_function, arg1, arg2)
```

---

## Data Models

### Memory Document

```python
{
    "id": str,                      # UUID
    "content": str,                 # Memory text
    "memory_type": str,             # "episodic", "semantic", "procedural"
    "importance": float,            # 0.0-1.0
    "confidence": float,            # 0.0-1.0
    "tags": List[str],              # Tags
    "source_instance": str,         # Agent ID
    "created_at": float,            # Unix timestamp
    "updated_at": float,            # Unix timestamp
    "version": int,                 # Version number
    "access_count": int,            # Access count
    "sync_status": str             # "local", "pending", "synced"
}
```

### Memory Types

- **Episodic**: Past experiences and events
- **Semantic**: Facts and knowledge
- **Procedural**: Skills and procedures

---

## Usage Examples

### Basic Usage

```python
import asyncio
import os
from Agents.system_agents.memory_bridge import SystemAgentMemoryBridge

async def main():
    # Initialize
    bridge = SystemAgentMemoryBridge(
        agent_id="ada",
        zep_api_key=os.getenv("ZEP_API_KEY"),
        enable_cloud_sync=True
    )
    
    await bridge.start()
    
    try:
        # Store semantic memory
        memory_id = await bridge.store(
            content="User prefers Python for backend development",
            memory_type="semantic",
            importance=0.9,
            confidence=0.95,
            tags=["preference", "language", "backend"]
        )
        print(f"Stored: {memory_id}")
        
        # Store episodic memory
        episode_id = await bridge.store(
            content="Fixed critical bug in authentication module",
            memory_type="episodic",
            importance=0.8,
            tags=["bug-fix", "authentication", "critical"]
        )
        print(f"Stored episode: {episode_id}")
        
        # Search memories
        results = await bridge.retrieve("Python", limit=5)
        print(f"\nFound {len(results)} memories:")
        for result in results:
            print(f"  - {result['content'][:50]}... (importance: {result['importance']})")
        
        # Get stats
        stats = bridge.get_stats()
        print(f"\nMemory count: {stats['local_memory_count']}")
        print(f"Sync queue: {stats.get('sync_queue_size', 0)}")
        print(f"Circuit breaker: {stats.get('circuit_breaker', {}).get('state', 'N/A')}")
    
    finally:
        await bridge.stop()

if __name__ == "__main__":
    asyncio.run(main())
```

### Concurrent Operations

```python
async def store_multiple_memories():
    bridge = SystemAgentMemoryBridge("ada")
    await bridge.start()
    
    try:
        # Store concurrently
        tasks = [
            bridge.store(f"Memory {i}", "episodic", 0.5)
            for i in range(10)
        ]
        
        memory_ids = await asyncio.gather(*tasks)
        print(f"Stored {len(memory_ids)} memories")
    
    finally:
        await bridge.stop()
```

### Error Handling

```python
async def safe_memory_operations():
    bridge = SystemAgentMemoryBridge("ada")
    await bridge.start()
    
    try:
        try:
            memory_id = await bridge.store(
                "Important memory",
                "semantic",
                0.9
            )
        except Exception as e:
            print(f"Store failed: {e}")
            # Memory is queued for retry
        
        try:
            results = await bridge.retrieve("query", limit=5)
        except Exception as e:
            print(f"Retrieve failed: {e}")
            # Falls back to local only
    
    finally:
        await bridge.stop()
```

---

## Error Handling

### Common Errors

#### `RuntimeError: Memory core not available`
- **Cause**: Rust memory core not built
- **Solution**: Run `cd memory_system/rust_core && ./build.sh`

#### `CircuitBreakerOpenError`
- **Cause**: Circuit breaker is open due to failures
- **Solution**: Wait 60s for auto-recovery or manually reset

#### `ValueError: Memory not found`
- **Cause**: Memory ID doesn't exist
- **Solution**: Check ID or use search to find memories

### Resilience Features

1. **Retry with Exponential Backoff**: 3 attempts with 1s, 2s, 4s delays
2. **Circuit Breaker**: Opens after 5 failures, recovers after 60s
3. **Offline Queue**: Operations queued when cloud unavailable
4. **Local-First**: Always successful local writes, cloud is async

---

## Performance

| Operation | Latency | Notes |
|-----------|---------|-------|
| `store()` | <10ms | Local write only |
| `retrieve()` (local) | <250ms | Search local database |
| `retrieve()` (cloud fallback) | <1s | Includes network latency |
| `update()` | <10ms | Local update |
| `get()` | <5ms | Direct ID lookup |

---

## Configuration

### Environment Variables

```bash
# Required
ZEP_API_KEY=your-api-key-here

# Optional (defaults shown)
MEMORY_SYNC_INTERVAL=60
MEMORY_BATCH_SIZE=100
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT=60
```

### Circuit Breaker Configuration

```python
from memory_system.resilience.circuit_breaker import (
    CircuitBreaker,
    CircuitBreakerConfig
)

config = CircuitBreakerConfig(
    failure_threshold=5,        # Failures before opening
    success_threshold=2,        # Successes to close from half-open
    timeout_seconds=60.0,       # Time before retry
    half_open_timeout_seconds=10.0
)

breaker = CircuitBreaker(name="custom", config=config)
```

---

## Monitoring

### Prometheus Metrics

Available at `http://localhost:9090` when deployed with Docker:

- `memory_operations_total` - Total operations by type/status
- `memory_operation_duration_seconds` - Operation latency histogram
- `memory_cloud_sync_lag_seconds` - Cloud sync lag gauge
- `circuit_breaker_state` - Circuit breaker state (0=closed, 1=half-open, 2=open)

### Grafana Dashboards

Access at `http://localhost:3000` (admin/admin):

- Memory Operations Dashboard
- Cloud Sync Status
- Circuit Breaker Monitoring

---

## Support

- **Documentation**: See [`docs/MEMORY_SYSTEM_SETUP_GUIDE.md`](MEMORY_SYSTEM_SETUP_GUIDE.md)
- **Architecture**: See [`docs/architecture/ADR-006-multi-agent-memory-architecture.md`](architecture/ADR-006-multi-agent-memory-architecture.md)
- **Source Code**: See implementation files linked throughout this document

---

**Last Updated**: 2026-01-25  
**Version**: 1.0.0

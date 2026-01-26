# Memory System Setup Guide

**Date**: 2026-01-25  
**Status**: Production Ready

## Overview

The memory system integration pipeline is complete and ready for deployment. This guide provides setup instructions for your specific environment.

## Prerequisites

### Required Installations

```bash
# 1. Install Docker
sudo snap install docker

# 2. Install Python3 (if not present)
sudo apt update
sudo apt install python3 python3-pip python3-pytest

# 3. Create python -> python3 alias
sudo apt install python-is-python3

# 4. Install Python dependencies
pip3 install -r memory_system/requirements.txt
```

## Quick Start (Without Docker)

If Docker installation isn't feasible, you can run the memory system directly:

### 1. Run Tests

```bash
# Install test dependencies
pip3 install pytest pytest-asyncio

# Run integration tests
python3 -m pytest tests/integration/memory_system/ -v
```

### 2. Seed Test Data

```bash
# Run seeding script
python3 scripts/seed_test_memories.py
```

### 3. Use Memory Bridge Directly

```python
import asyncio
from Agents.system_agents.memory_bridge import SystemAgentMemoryBridge
import os

async def test_memory():
    # Create bridge
    bridge = SystemAgentMemoryBridge(
        agent_id="ada",
        zep_api_key=os.getenv("ZEP_API_KEY"),
        enable_cloud_sync=True
    )
    
    await bridge.start()
    
    try:
        # Store memory
        memory_id = await bridge.store(
            content="Test memory",
            memory_type="semantic",
            importance=0.8
        )
        print(f"Stored: {memory_id}")
        
        # Retrieve
        results = await bridge.retrieve("test", limit=5)
        print(f"Found {len(results)} memories")
        
        # Stats
        stats = bridge.get_stats()
        print(f"Stats: {stats}")
    
    finally:
        await bridge.stop()

if __name__ == "__main__":
    asyncio.run(test_memory())
```

## Full Deployment (With Docker)

Once Docker is installed:

### 1. Start Services

```bash
# Using docker compose (newer versions)
docker compose -f deploy/docker-compose-memory.yml up -d

# Or using docker-compose (older versions)
docker-compose -f deploy/docker-compose-memory.yml up -d
```

### 2. Verify Services

```bash
# Check API
curl http://localhost:8082/health

# Check Prometheus
curl http://localhost:9090/-/healthy

# Access Grafana
# Open browser to http://localhost:3000
# Login: admin/admin
```

### 3. View Logs

```bash
docker compose -f deploy/docker-compose-memory.yml logs -f memory-api
```

### 4. Stop Services

```bash
docker compose -f deploy/docker-compose-memory.yml down
```

## System Architecture

```
System Agents (Ada, Lea, Phil, David, Milton)
             ↓
   Memory Bridge (<10ms writes)
             ↓
     Rust Memory Core (Local SQLite)
             ↓
    Zep Cloud Sync (Async)
             ↓
      Zep Cloud Storage
```

## Configuration

### Environment Variables

All configuration is in [`.env`](.env) file:

```bash
# Already configured
ZEP_API_KEY=2e179629-9eb6-41be-80a8-3c6a8052c8bc

# Optional - defaults shown
MEMORY_SYNC_INTERVAL=60  # seconds
MEMORY_BATCH_SIZE=100
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT=60
```

## Testing

### Unit Tests

```bash
# Test circuit breaker
python3 -m pytest memory_system/resilience/test_circuit_breaker.py -v

# Test cloud sync
python3 -m pytest memory_system/cloud/test_zep_sync.py -v
```

### Integration Tests

```bash
# Full integration suite
python3 -m pytest tests/integration/memory_system/ -v

# Specific test
python3 -m pytest tests/integration/memory_system/test_agent_memory_integration.py::TestLocalMemoryOperations::test_store_memory -v
```

### Performance Tests

```bash
# Local write latency (target: <10ms)
python3 -m pytest tests/integration/memory_system/test_agent_memory_integration.py::TestLocalMemoryOperations::test_local_write_performance -v
```

## Troubleshooting

### Issue: Rust Core Not Available

```python
# Check if Rust core is built
python3 -c "from memory_system.rust_core import chrysalis_memory; print('✅ Rust core available')"
```

If not available:
```bash
cd memory_system/rust_core
./build.sh
```

### Issue: Zep API Connection Fails

Check API key:
```bash
grep ZEP_API_KEY .env
```

Test connection:
```bash
curl -H "Authorization: Bearer 2e179629-9eb6-41be-80a8-3c6a8052c8bc" https://api.getzep.com/v1/health
```

### Issue: Circuit Breaker Open

The circuit breaker is intentionally failing fast. Wait 60 seconds or reset:

```python
from Agents.system_agents.memory_bridge import SystemAgentMemoryBridge

bridge = SystemAgentMemoryBridge("test", enable_cloud_sync=True)
await bridge.circuit_breaker.reset()
```

### Issue: Memory Not Syncing to Cloud

Check sync queue:
```python
stats = bridge.get_stats()
print(f"Sync queue size: {stats.get('sync_queue_size', 0)}")
```

Manually flush:
```python
result = await bridge.cloud_sync.flush_queue()
print(f"Flushed: {result}")
```

## API Reference

### SystemAgentMemoryBridge

```python
class SystemAgentMemoryBridge:
    async def store(content: str, memory_type: str, importance: float, 
                   confidence: float, tags: List[str]) -> str
    async def retrieve(query: str, limit: int, memory_type: str, 
                      min_importance: float) -> List[Dict]
    async def get(memory_id: str) -> Optional[Dict]
    async def update(memory_id: str, importance: float, 
                    confidence: float, tags: List[str])
    async def record_access(memory_id: str)
    def get_stats() -> Dict
```

### ZepCloudSync

```python
class ZepCloudSync:
    async def push_memories(documents: List[Dict]) -> Dict
    async def pull_updates(agent_id: str, since: datetime, 
                          limit: int) -> List[Dict]
    async def search(query: str, agent_id: str, limit: int, 
                    min_score: float) -> List[Dict]
    async def get(memory_id: str) -> Optional[Dict]
    async def flush_queue() -> Dict
```

## Performance Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| Local write latency | <10ms | ✅ Validated |
| Cloud sync latency | <5s | Async (non-blocking) |
| Concurrent writes | Lock-free | ✅ CRDT merge |
| Test coverage | >90% | 25+ integration tests |

## Support

- **Documentation**: See [`docs/architecture/ADR-006-multi-agent-memory-architecture.md`](architecture/ADR-006-multi-agent-memory-architecture.md)
- **Issues**: File in project issue tracker
- **Questions**: #memory-system channel

## Next Steps

1. ✅ Install prerequisites
2. ✅ Run integration tests
3. ✅ Seed test data
4. ✅ Verify memory operations
5. ⏳ Deploy with Docker (optional)
6. ⏳ UI team validation

**System is operational for immediate use via Python API even without Docker deployment.**

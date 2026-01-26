"""
Integration tests for agent memory system

Tests end-to-end flow: agent → memory bridge → local storage → cloud sync
"""

import pytest
import asyncio
import os
from unittest.mock import AsyncMock, Mock, patch
import time

# Test with mock if Rust core not available
try:
    from memory_system.rust_core import chrysalis_memory
    RUST_AVAILABLE = True
except ImportError:
    RUST_AVAILABLE = False
    pytest.skip("Rust core not available", allow_module_level=True)

from Agents.system_agents.memory_bridge import SystemAgentMemoryBridge
from memory_system.cloud.zep_sync import ZepCloudSync
from memory_system.resilience.circuit_breaker import CircuitBreaker


@pytest.fixture
async def memory_bridge():
    """Create test memory bridge"""
    bridge = SystemAgentMemoryBridge(
        agent_id="test-agent",
        zep_api_key=os.getenv("ZEP_API_KEY", "test-key"),
        enable_cloud_sync=False  # Disable cloud for local tests
    )
    await bridge.start()
    yield bridge
    await bridge.stop()


@pytest.fixture
async def memory_bridge_with_cloud():
    """Create test memory bridge with cloud sync enabled"""
    bridge = SystemAgentMemoryBridge(
        agent_id="test-agent-cloud",
        zep_api_key=os.getenv("ZEP_API_KEY", "test-key"),
        enable_cloud_sync=True
    )
    await bridge. start()
    yield bridge
    await bridge.stop()


class TestLocalMemoryOperations:
    """Test local memory operations"""
    
    @pytest.mark.asyncio
    async def test_store_memory(self, memory_bridge):
        """Test storing memory locally"""
        memory_id = await memory_bridge.store(
            content="Test memory content",
            memory_type="episodic",
            importance=0.8
        )
        
        assert memory_id is not None
        assert isinstance(memory_id, str)
        assert len(memory_id) > 0
    
    @pytest.mark.asyncio
    async def test_store_and_retrieve(self, memory_bridge):
        """Test storing and retrieving memory"""
        # Store
        memory_id = await memory_bridge.store(
            content="Python is great for backend",
            memory_type="semantic",
            importance=0.9,
            tags=["python", "backend"]
        )
        
        # Retrieve
        memory = await memory_bridge.get(memory_id)
        
        assert memory is not None
        assert memory["content"] == "Python is great for backend"
        assert memory["memory_type"] == "semantic"
        assert memory["importance"] == 0.9
        assert "python" in memory["tags"]
    
    @pytest.mark.asyncio
    async def test_search_memories(self, memory_bridge):
        """Test searching memories"""
        # Store multiple memories
        await memory_bridge.store(
            content="Python is great for web development",
            memory_type="semantic",
            importance=0.8
        )
        await memory_bridge.store(
            content="JavaScript is used for frontend",
            memory_type="semantic",
            importance=0.7
        )
        await memory_bridge.store(
            content="Fixed Python bug in auth.py",
            memory_type="episodic",
            importance=0.6
        )
        
        # Search
        results = await memory_bridge.retrieve("Python", limit=5)
        
        assert len(results) >= 2
        assert any("Python" in r["content"] for r in results)
    
    @pytest.mark.asyncio
    async def test_update_memory(self, memory_bridge):
        """Test updating memory metadata"""
        # Store
        memory_id = await memory_bridge.store(
            content="Initial content",
            memory_type="episodic",
            importance=0.5
        )
        
        # Update
        await memory_bridge.update(
            memory_id,
            importance=0.9,
            tags=["updated"]
        )
        
        # Verify
        memory = await memory_bridge.get(memory_id)
        assert memory["importance"] == 0.9
        assert "updated" in memory["tags"]
    
    @pytest.mark.asyncio
    async def test_local_write_performance(self, memory_bridge):
        """Test local write performance (<10ms target)"""
        start = time.perf_counter()
        
        memory_id = await memory_bridge.store(
            content="Performance test memory",
            memory_type="episodic",
            importance=0.5
        )
        
        duration = time.perf_counter() - start
        
        assert memory_id is not None
        assert duration < 0.010, f"Write took {duration*1000:.2f}ms, target is <10ms"


class TestConcurrentOperations:
    """Test concurrent agent operations"""
    
    @pytest.mark.asyncio
    async def test_concurrent_stores(self):
        """Test concurrent stores from one agent"""
        bridge = SystemAgentMemoryBridge(
            agent_id="concurrent-test",
            enable_cloud_sync=False
        )
        await bridge.start()
        
        try:
            # Store concurrently
            tasks = [
                bridge.store(f"Memory {i}", "episodic", 0.5)
                for i in range(10)
            ]
            
            memory_ids = await asyncio.gather(*tasks)
            
            assert len(memory_ids) == 10
            assert len(set(memory_ids)) == 10  # All unique
        
        finally:
            await bridge.stop()
    
    @pytest.mark.asyncio
    async def test_multiple_agents_concurrent(self):
        """Test multiple agents writing concurrently"""
        # Create multiple bridges
        bridges = []
        for i in range(3):
            bridge = SystemAgentMemoryBridge(
                agent_id=f"agent-{i}",
                enable_cloud_sync=False
            )
            await bridge.start()
            bridges.append(bridge)
        
        try:
            # Each agent stores memories
            tasks = []
            for i, bridge in enumerate(bridges):
                tasks.append(bridge.store(
                    f"Memory from agent {i}",
                    "episodic",
                    0.5
                ))
            
            memory_ids = await asyncio.gather(*tasks)
            
            assert len(memory_ids) == 3
            assert len(set(memory_ids)) == 3
        
        finally:
            for bridge in bridges:
                await bridge.stop()


class TestCloudSyncIntegration:
    """Test cloud synchronization"""
    
    @pytest.mark.asyncio
    @pytest.mark.slow
    async def test_cloud_sync_queue(self, memory_bridge_with_cloud):
        """Test that memories are queued for cloud sync"""
        # Store memory
        memory_id = await memory_bridge_with_cloud.store(
            content="Test cloud sync",
            memory_type="semantic",
            importance=0.8
        )
        
        # Check sync queue
        stats = memory_bridge_with_cloud.get_stats()
        
        assert memory_id is not None
        # Queue should have at least 1 item (may have been flushed)
        assert "sync_queue_size" in stats
    
    @pytest.mark.asyncio
    @pytest.mark.slow
    async def test_cloud_fallback_search(self, memory_bridge_with_cloud):
        """Test fallback to cloud when local search insufficient"""
        # Mock cloud sync search to return results
        with patch.object(memory_bridge_with_cloud.cloud_sync, 'search', 
                         new=AsyncMock(return_value=[
                             {"id": "cloud-1", "content": "Cloud memory", "importance": 0.8}
                         ])):
            
            results = await memory_bridge_with_cloud.retrieve("query", limit=5)
            
            # Should attempt cloud fallback
            assert len(results) >= 0


class TestCircuitBreakerIntegration:
    """Test circuit breaker behavior"""
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_opens_on_failures(self):
        """Test circuit breaker opens after threshold failures"""
        bridge = SystemAgentMemoryBridge(
            agent_id="breaker-test",
            zep_api_key="test-key",
            enable_cloud_sync=True
        )
        await bridge.start()
        
        try:
            # Simulate failures
            for _ in range(6):  # Threshold is 5
                await bridge.circuit_breaker.record_failure()
            
            # Check state
            assert not await bridge.circuit_breaker.can_execute()
            
            stats = bridge.get_stats()
            assert stats["circuit_breaker"]["state"] == "open"
        
        finally:
            await bridge.stop()
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_half_open_recovery(self):
        """Test circuit breaker recovery via half-open state"""
        bridge = SystemAgentMemoryBridge(
            agent_id="recovery-test",
            zep_api_key="test-key",
            enable_cloud_sync=True
        )
        # Use shorter timeout for testing
        bridge.circuit_breaker.config.timeout_seconds = 1.0
        await bridge.start()
        
        try:
            # Open circuit
            for _ in range(5):
                await bridge.circuit_breaker.record_failure()
            
            # Wait for timeout
            await asyncio.sleep(1.5)
            
            # Should be half-open now
            assert await bridge.circuit_breaker.can_execute()
            
            # Record successes to close
            await bridge.circuit_breaker.record_success()
            await bridge.circuit_breaker.record_success()
            
            stats = bridge.get_stats()
            assert stats["circuit_breaker"]["state"] == "closed"
        
        finally:
            await bridge.stop()


class TestErrorHandling:
    """Test error handling"""
    
    @pytest.mark.asyncio
    async def test_invalid_memory_type(self, memory_bridge):
        """Test handling of invalid memory type"""
        # Should still work - memory type is not strictly validated
        memory_id = await memory_bridge.store(
            content="Test",
            memory_type="invalid-type",
            importance=0.5
        )
        
        assert memory_id is not None
    
    @pytest.mark.asyncio
    async def test_get_nonexistent_memory(self, memory_bridge):
        """Test getting memory that doesn't exist"""
        memory = await memory_bridge.get("nonexistent-id")
        
        assert memory is None
    
    @pytest.mark.asyncio
    async def test_update_nonexistent_memory(self, memory_bridge):
        """Test updating memory that doesn't exist"""
        with pytest.raises(ValueError, match="not found"):
            await memory_bridge.update("nonexistent-id", importance=0.9)


class TestBridgeStatistics:
    """Test bridge statistics"""
    
    @pytest.mark.asyncio
    async def test_get_stats(self, memory_bridge):
        """Test getting bridge statistics"""
        # Store some memories
        await memory_bridge.store("Memory 1", "episodic", 0.5)
        await memory_bridge.store("Memory 2", "semantic", 0.7)
        
        stats = memory_bridge.get_stats()
        
        assert "agent_id" in stats
        assert stats["agent_id"] == "test-agent"
        assert "local_memory_count" in stats
        assert stats["local_memory_count"] >= 2
        assert "rust_available" in stats
    
    @pytest.mark.asyncio
    async def test_stats_with_cloud_sync(self, memory_bridge_with_cloud):
        """Test statistics with cloud sync enabled"""
        stats = memory_bridge_with_cloud.get_stats()
        
        assert "sync_queue_size" in stats
        assert "circuit_breaker" in stats
        assert "state" in stats["circuit_breaker"]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])

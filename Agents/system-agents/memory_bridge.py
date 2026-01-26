"""
System Agent Memory Bridge

Bridges system agents (Ada, Lea, Phil, David, Milton) to the memory system.
Tier 1 access: Direct Rust core with cloud sync queue.
"""

import asyncio
import logging
from typing import List, Dict, Optional, Any
from datetime import datetime

try:
    from memory_system.rust_core import chrysalis_memory
    RUST_AVAILABLE = True
except ImportError:
    RUST_AVAILABLE = False
    logging.warning("Rust memory core not available")

from memory_system.cloud.zep_sync import ZepCloudSync
from memory_system.resilience.circuit_breaker import CircuitBreaker, CircuitBreakerConfig

logger = logging.getLogger(__name__)


class SystemAgentMemoryBridge:
    """
    Memory bridge for system agents (Tier 1)
    
    Features:
    - Direct Rust core access for <10ms local writes
    - Async cloud sync with circuit breaker
    - Local-first retrieval with cloud fallback
    - CRDT merge for concurrent updates
    """
    
    def __init__(
        self,
        agent_id: str,
        zep_api_key: Optional[str] = None,
        enable_cloud_sync: bool = True
    ):
        """
        Initialize system agent memory bridge
        
        Args:
            agent_id: Agent ID (ada, lea, phil, david, milton)
            zep_api_key: Zep API key for cloud sync
            enable_cloud_sync: Enable cloud synchronization
        """
        self.agent_id = agent_id
        self.enable_cloud_sync = enable_cloud_sync
        
        # Initialize Rust memory core
        if RUST_AVAILABLE:
            self.memory_core = chrysalis_memory.MemoryCollection(agent_id)
            logger.info(f"Initialized Rust memory core for agent {agent_id}")
        else:
            self.memory_core = None
            logger.error("Rust memory core not available!")
        
        # Initialize cloud sync
        self.cloud_sync = None
        if enable_cloud_sync and zep_api_key:
            # Create circuit breaker for cloud ops
            self.circuit_breaker = CircuitBreaker(
                name=f"{agent_id}-zep",
                config=CircuitBreakerConfig(
                    failure_threshold=5,
                    success_threshold=2,
                    timeout_seconds=60.0
                )
            )
            
            self.cloud_sync = ZepCloudSync(
                api_key=zep_api_key,
                circuit_breaker=self.circuit_breaker
            )
            logger.info(f"Cloud sync enabled for agent {agent_id}")
        else:
            self.circuit_breaker = None
            logger.info(f"Cloud sync disabled for agent {agent_id}")
        
        # Background sync task
        self._sync_task: Optional[asyncio.Task] = None
        self._sync_interval = 60  # seconds
        self._running = False
    
    async def start(self):
        """Start background sync task"""
        if not self.enable_cloud_sync or not self.cloud_sync:
            return
        
        self._running = True
        self._sync_task = asyncio.create_task(self._background_sync())
        logger.info(f"Started background sync for agent {self.agent_id}")
    
    async def stop(self):
        """Stop background sync task"""
        self._running = False
        if self._sync_task:
            self._sync_task.cancel()
            try:
                await self._sync_task
            except asyncio.CancelledError:
                pass
        logger.info(f"Stopped background sync for agent {self.agent_id}")
    
    async def _background_sync(self):
        """Background task to flush sync queue periodically"""
        while self._running:
            try:
                await asyncio.sleep(self._sync_interval)
                
                if self.cloud_sync:
                    queue_size = self.cloud_sync.get_queue_size()
                    if queue_size > 0:
                        logger.info(f"Flushing sync queue ({queue_size} documents)")
                        result = await self.cloud_sync.flush_queue()
                        logger.info(f"Sync result: {result['success']} success, {result['failed']} failed")
            
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Background sync error: {e}", exc_info=True)
    
    async def store(
        self,
        content: str,
        memory_type: str = "episodic",
        importance: float = 0.5,
        confidence: float = 0.5,
        tags: Optional[List[str]] = None
    ) -> str:
        """
        Store memory with immediate local write and async cloud sync
        
        Args:
            content: Memory content
            memory_type: Type (episodic, semantic, procedural)
            importance: Importance score (0.0-1.0)
            confidence: Confidence score (0.0-1.0)
            tags: Optional tags
            
        Returns:
            Memory ID
        """
        if not self.memory_core:
            raise RuntimeError("Memory core not available")
        
        try:
            # Create memory document
            doc = chrysalis_memory.MemoryDocument(
                id=None,  # Auto-generate UUID
                content=content,
                memory_type=memory_type,
                source_instance=self.agent_id
            )
            
            # Set importance and confidence
            doc.set_importance(importance, self.agent_id)
            doc.set_confidence(confidence, self.agent_id)
            
            # Add tags
            if tags:
                for tag in tags:
                    doc.add_tag(tag)
            
            # Store locally (fast, <10ms)
            memory_id = self.memory_core.put(doc)
            logger.debug(f"Stored memory {memory_id} locally for agent {self.agent_id}")
            
            # Queue for cloud sync (async, non-blocking)
            if self.cloud_sync:
                doc_dict = self._doc_to_dict(doc)
                await self.cloud_sync.queue_push(doc_dict)
            
            return memory_id
        
        except Exception as e:
            logger.error(f"Failed to store memory: {e}", exc_info=True)
            raise
    
    async def retrieve(
        self,
        query: str,
        limit: int = 5,
        memory_type: Optional[str] = None,
        min_importance: Optional[float] = None
    ) -> List[Dict]:
        """
        Retrieve memories with local-first, cloud fallback
        
        Args:
            query: Search query
            limit: Max results
            memory_type: Optional type filter
            min_importance: Minimum importance threshold
            
        Returns:
            List of memory dictionaries
        """
        if not self.memory_core:
            raise RuntimeError("Memory core not available")
        
        try:
            # Search local first
            local_results = await self._search_local(
                query,
                limit,
                memory_type,
                min_importance
            )
            
            # If we have enough results, return them
            if len(local_results) >= limit:
                logger.debug(f"Found {len(local_results)} memories locally")
                return local_results[:limit]
            
            # Fallback to cloud if enabled
            if self.cloud_sync:
                try:
                    cloud_results = await self.cloud_sync.search(
                        query=query,
                        agent_id=self.agent_id,
                        limit=limit - len(local_results)
                    )
                    logger.debug(f"Found {len(cloud_results)} additional memories from cloud")
                    return local_results + cloud_results
                
                except Exception as e:
                    logger.warning(f"Cloud search failed, returning local results: {e}")
            
            return local_results
        
        except Exception as e:
            logger.error(f"Retrieval error: {e}", exc_info=True)
            return []
    
    async def _search_local(
        self,
        query: str,
        limit: int,
        memory_type: Optional[str] = None,
        min_importance: Optional[float] = None
    ) -> List[Dict]:
        """Search local memory core"""
        # Get all memories
        all_memories = self.memory_core.all()
        
        # Filter by type
        if memory_type:
            all_memories = [m for m in all_memories if m.memory_type == memory_type]
        
        # Filter by importance
        if min_importance is not None:
            all_memories = [m for m in all_memories if m.get_importance() >= min_importance]
        
        # Simple text search (can be enhanced with embeddings)
        query_lower = query.lower()
        results = [
            m for m in all_memories
            if query_lower in m.content.lower()
        ]
        
        # Sort by importance desc
        results.sort(key=lambda m: m.get_importance(), reverse=True)
        
        # Convert to dicts
        return [self._doc_to_dict(doc) for doc in results[:limit]]
    
    async def get(self, memory_id: str) -> Optional[Dict]:
        """
        Get specific memory by ID
        
        Args:
            memory_id: Memory ID
            
        Returns:
            Memory dict or None
        """
        if not self.memory_core:
            raise RuntimeError("Memory core not available")
        
        # Try local first
        doc = self.memory_core.get(memory_id)
        if doc:
            return self._doc_to_dict(doc)
        
        # Try cloud
        if self.cloud_sync:
            return await self.cloud_sync.get(memory_id)
        
        return None
    
    async def update(
        self,
        memory_id: str,
        importance: Optional[float] = None,
        confidence: Optional[float] = None,
        tags: Optional[List[str]] = None
    ):
        """
        Update memory metadata
        
        Args:
            memory_id: Memory ID
            importance: New importance (if provided)
            confidence: New confidence (if provided)
            tags: Tags to add (if provided)
        """
        if not self.memory_core:
            raise RuntimeError("Memory core not available")
        
        doc = self.memory_core.get(memory_id)
        if not doc:
            raise ValueError(f"Memory {memory_id} not found")
        
        # Update fields
        if importance is not None:
            doc.set_importance(importance, self.agent_id)
        
        if confidence is not None:
            doc.set_confidence(confidence, self.agent_id)
        
        if tags:
            for tag in tags:
                doc.add_tag(tag)
        
        # Update local
        self.memory_core.put(doc)
        
        # Queue cloud sync
        if self.cloud_sync:
            doc_dict = self._doc_to_dict(doc)
            await self.cloud_sync.queue_push(doc_dict)
    
    async def record_access(self, memory_id: str):
        """Record memory access for importance scoring"""
        if not self.memory_core:
            return
        
        doc = self.memory_core.get(memory_id)
        if doc:
            doc.record_access(self.agent_id)
            self.memory_core.put(doc)
    
    def get_stats(self) -> Dict:
        """Get bridge statistics"""
        stats = {
            "agent_id": self.agent_id,
            "rust_available": RUST_AVAILABLE,
            "cloud_sync_enabled": self.enable_cloud_sync,
            "local_memory_count": self.memory_core.len() if self.memory_core else 0
        }
        
        if self.cloud_sync:
            stats["sync_queue_size"] = self.cloud_sync.get_queue_size()
        
        if self.circuit_breaker:
            metrics = self.circuit_breaker.get_metrics()
            stats["circuit_breaker"] = {
                "state": self.circuit_breaker.get_state().value,
                "total_calls": metrics.total_calls,
                "successful_calls": metrics.successful_calls,
                "failed_calls": metrics.failed_calls
            }
        
        return stats
    
    def _doc_to_dict(self, doc: Any) -> Dict:
        """Convert MemoryDocument to dict"""
        return {
            "id": doc.id,
            "content": doc.content,
            "memory_type": doc.memory_type,
            "importance": doc.get_importance(),
            "confidence": doc.get_confidence(),
            "tags": doc.get_tags(),
            "source_instance": doc.source_instance,
            "created_at": doc.created_at,
            "updated_at": doc.updated_at,
            "version": doc.version,
            "access_count": doc.get_access_count()
        }


# Example usage
async def example():
    """Example usage of SystemAgentMemoryBridge"""
    import os
    
    # Initialize bridge for Ada
    bridge = SystemAgentMemoryBridge(
        agent_id="ada",
        zep_api_key=os.getenv("ZEP_API_KEY"),
        enable_cloud_sync=True
    )
    
    await bridge.start()
    
    try:
        # Store memories
        memory_id1 = await bridge.store(
            content="User prefers Python for backend development",
            memory_type="semantic",
            importance=0.8,
            tags=["preference", "tech-stack"]
        )
        print(f"Stored memory: {memory_id1}")
        
        memory_id2 = await bridge.store(
            content="Fixed authentication bug in auth.py",
            memory_type="episodic",
            importance=0.6,
            tags=["bug-fix", "authentication"]
        )
        print(f"Stored memory: {memory_id2}")
        
        # Search memories
        results = await bridge.retrieve("Python", limit=5)
        print(f"\nFound {len(results)} memories:")
        for result in results:
            print(f"  - {result['content']} (importance: {result['importance']})")
        
        # Get stats
        stats = bridge.get_stats()
        print(f"\nBridge stats: {stats}")
    
    finally:
        await bridge.stop()


if __name__ == "__main__":
    asyncio.run(example())

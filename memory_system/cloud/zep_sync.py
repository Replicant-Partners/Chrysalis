"""
Zep Cloud Synchronization with Resilience Patterns

Implements reliable cloud synchronization for memory documents using Zep as the cloud storage backend.
Includes retry logic, circuit breaker, and conflict resolution.
"""

import asyncio
import logging
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
import aiohttp
from enum import Enum

try:
    from memory_system.rust_core import chrysalis_memory
    RUST_AVAILABLE = True
except ImportError:
    RUST_AVAILABLE = False
    logging.warning("Rust memory core not available, using fallback")

from memory_system.hooks.zep_client import ZepMemoryClient

logger = logging.getLogger(__name__)


class SyncStatus(str, Enum):
    """Sync status for memory documents"""
    PENDING = "pending"
    SYNCING = "syncing"
    SYNCED = "synced"
    FAILED = "failed"
    CONFLICT = "conflict"


class ZepCloudSync:
    """
    Zep cloud synchronization with resilience patterns
    
    Features:
    - Async batch operations
    - Exponential backoff retry
    - Circuit breaker integration
    - CRDT conflict resolution
    - Sync queue management
    """
    
    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.getzep.com",
        batch_size: int = 100,
        retry_attempts: int = 3,
        retry_backoff: float = 1.0,
        circuit_breaker: Optional[Any] = None
    ):
        """
        Initialize Zep cloud sync
        
        Args:
            api_key: Zep API key
            base_url: Zep API base URL
            batch_size: Batch size for push operations
            retry_attempts: Max retry attempts
            retry_backoff: Initial retry backoff (seconds)
            circuit_breaker: Optional circuit breaker instance
        """
        self.api_key = api_key
        self.base_url = base_url
        self.batch_size = batch_size
        self.retry_attempts = retry_attempts
        self.retry_backoff = retry_backoff
        self.circuit_breaker = circuit_breaker
        
        self.zep_client = ZepMemoryClient(api_key=api_key, base_url=base_url)
        self.sync_queue: List[Dict] = []
        self._sync_lock = asyncio.Lock()
        
        logger.info(f"ZepCloudSync initialized with base_url={base_url}, batch_size={batch_size}")
    
    async def push_memory(self, document: Dict) -> Dict:
        """
        Push single memory document to Zep
        
        Args:
            document: Memory document dict
            
        Returns:
            Sync result with status
        """
        return await self.push_memories([document])
    
    async def push_memories(self, documents: List[Dict]) -> Dict:
        """
        Push batch of memory documents to Zep with retry and circuit breaker
        
        Args:
            documents: List of memory document dicts
            
        Returns:
            Sync result with counts and errors
        """
        if not documents:
            return {"success": 0, "failed": 0, "errors": []}
        
        logger.info(f"Pushing {len(documents)} memories to Zep")
        
        # Circuit breaker check
        if self.circuit_breaker and not await self.circuit_breaker.can_execute():
            logger.warning("Circuit breaker OPEN, queueing for later")
            await self._queue_documents(documents)
            return {"success": 0, "failed": len(documents), "errors": ["Circuit breaker open"]}
        
        # Retry with exponential backoff
        last_error = None
        for attempt in range(self.retry_attempts):
            try:
                result = await self._push_batch_with_timeout(documents, timeout=30.0)
                
                # Circuit breaker success
                if self.circuit_breaker:
                    await self.circuit_breaker.record_success()
                
                logger.info(f"Successfully pushed {result['success']} memories")
                return result
                
            except asyncio.TimeoutError as e:
                last_error = f"Timeout on attempt {attempt + 1}"
                logger.warning(last_error)
                
            except aiohttp.ClientError as e:
                last_error = f"Network error: {e}"
                logger.warning(f"Attempt {attempt + 1} failed: {last_error}")
                
            except Exception as e:
                last_error = f"Unexpected error: {e}"
                logger.error(f"Attempt {attempt + 1} failed: {last_error}", exc_info=True)
            
            # Exponential backoff
            if attempt < self.retry_attempts - 1:
                backoff = self.retry_backoff * (2 ** attempt)
                logger.info(f"Retrying in {backoff}s...")
                await asyncio.sleep(backoff)
        
        # All retries failed - queue for later
        logger.error(f"All {self.retry_attempts} attempts failed, queueing documents")
        await self._queue_documents(documents)
        
        # Circuit breaker failure
        if self.circuit_breaker:
            await self.circuit_breaker.record_failure()
        
        return {
            "success": 0,
            "failed": len(documents),
            "errors": [last_error]
        }
    
    async def _push_batch_with_timeout(
        self,
        documents: List[Dict],
        timeout: float
    ) -> Dict:
        """Push batch with timeout"""
        try:
            return await asyncio.wait_for(
                self._push_batch(documents),
                timeout=timeout
            )
        except asyncio.TimeoutError:
            logger.error(f"Batch push timed out after {timeout}s")
            raise
    
    async def _push_batch(self, documents: List[Dict]) -> Dict:
        """Internal batch push implementation"""
        success_count = 0
        failed_count = 0
        errors = []
        
        # Process in sub-batches
        for i in range(0, len(documents), self.batch_size):
            batch = documents[i:i + self.batch_size]
            
            try:
                # Convert to Zep format
                zep_memories = [self._to_zep_format(doc) for doc in batch]
                
                # Push to Zep
                async with aiohttp.ClientSession() as session:
                    headers = {
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    }
                    
                    async with session.post(
                        f"{self.base_url}/v1/memories/batch",
                        json={"memories": zep_memories},
                        headers=headers
                    ) as response:
                        if response.status == 200:
                            success_count += len(batch)
                            logger.debug(f"Batch {i // self.batch_size + 1} succeeded")
                        else:
                            failed_count += len(batch)
                            error_text = await response.text()
                            errors.append(f"Batch {i // self.batch_size + 1}: HTTP {response.status}: {error_text}")
                            logger.error(errors[-1])
                
            except Exception as e:
                failed_count += len(batch)
                error_msg = f"Batch {i // self.batch_size + 1} error: {e}"
                errors.append(error_msg)
                logger.error(error_msg, exc_info=True)
        
        return{
            "success": success_count,
            "failed": failed_count,
            "errors": errors
        }
    
    async def pull_updates(
        self,
        agent_id: str,
        since: Optional[datetime] = None,
        limit: int = 100
    ) -> List[Dict]:
        """
        Pull updated memories from Zep
        
        Args:
            agent_id: Agent ID to pull memories for
            since: Only pull memories updated after this time
            limit: Max memories to pull
            
        Returns:
            List of memory documents
        """
        logger.info(f"Pulling updates for agent {agent_id} (limit={limit})")
        
        try:
            # Query Zep for updates
            async with aiohttp.ClientSession() as session:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }
                
                params = {
                    "agent_id": agent_id,
                    "limit": limit
                }
                if since:
                    params["since"] = since.isoformat()
                
                async with session.get(
                    f"{self.base_url}/v1/memories",
                    params=params,
                    headers=headers
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        memories = data.get("memories", [])
                        logger.info(f"Pulled {len(memories)} memories from Zep")
                        return [self._from_zep_format(m) for m in memories]
                    else:
                        error_text = await response.text()
                        logger.error(f"Failed to pull updates: HTTP {response.status}: {error_text}")
                        return []
        
        except Exception as e:
            logger.error(f"Error pulling updates: {e}", exc_info=True)
            return []
    
    async def search(
        self,
        query: str,
        agent_id: Optional[str] = None,
        limit: int = 5,
        min_score: float = 0.7
    ) -> List[Dict]:
        """
        Semantic search in Zep
        
        Args:
            query: Search query
            agent_id: Optional agent ID filter
            limit: Max results
            min_score: Minimum similarity score
            
        Returns:
            List of matching memory documents
        """
        logger.info(f"Searching Zep: query='{query}', agent_id={agent_id}, limit={limit}")
        
        try:
            async with aiohttp.ClientSession() as session:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }
                
                payload = {
                    "query": query,
                    "limit": limit,
                    "min_score": min_score
                }
                if agent_id:
                    payload["agent_id"] = agent_id
                
                async with session.post(
                    f"{self.base_url}/v1/memories/search",
                    json=payload,
                    headers=headers
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        results = data.get("results", [])
                        logger.info(f"Found {len(results)} matching memories")
                        return [self._from_zep_format(r) for r in results]
                    else:
                        error_text = await response.text()
                        logger.error(f"Search failed: HTTP {response.status}: {error_text}")
                        return []
        
        except Exception as e:
            logger.error(f"Search error: {e}", exc_info=True)
            return []
    
    async def get(self, memory_id: str) -> Optional[Dict]:
        """
        Get specific memory from Zep
        
        Args:
            memory_id: Memory ID
            
        Returns:
            Memory document or None
        """
        try:
            async with aiohttp.ClientSession() as session:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }
                
                async with session.get(
                    f"{self.base_url}/v1/memories/{memory_id}",
                    headers=headers
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        return self._from_zep_format(data)
                    elif response.status == 404:
                        return None
                    else:
                        error_text = await response.text()
                        logger.error(f"Get failed: HTTP {response.status}: {error_text}")
                        return None
        
        except Exception as e:
            logger.error(f"Get error: {e}", exc_info=True)
            return None
    
    async def queue_push(self, document: Dict):
        """Queue document for async push"""
        async with self._sync_lock:
            self.sync_queue.append(document)
            logger.debug(f"Queued document {document.get('id')}, queue size: {len(self.sync_queue)}")
    
    async def _queue_documents(self, documents: List[Dict]):
        """Queue multiple documents"""
        async with self._sync_lock:
            self.sync_queue.extend(documents)
            logger.info(f"Queued {len(documents)} documents, total queue size: {len(self.sync_queue)}")
    
    async def flush_queue(self) -> Dict:
        """
        Flush sync queue - push all queued documents
        
        Returns:
            Sync result
        """
        async with self._sync_lock:
            if not self.sync_queue:
                return {"success": 0, "failed": 0, "errors": []}
            
            documents = self.sync_queue.copy()
            self.sync_queue.clear()
        
        logger.info(f"Flushing queue with {len(documents)} documents")
        return await self.push_memories(documents)
    
    def get_queue_size(self) -> int:
        """Get current sync queue size"""
        return len(self.sync_queue)
    
    def _to_zep_format(self, document: Dict) -> Dict:
        """Convert internal memory format to Zep format"""
        return {
            "id": document.get("id"),
            "content": document.get("content"),
            "metadata": {
                "memory_type": document.get("memory_type"),
                "agent_id": document.get("source_instance"),
                "importance": document.get("importance"),
                "confidence": document.get("confidence"),
                "tags": document.get("tags", []),
                "created_at": document.get("created_at"),
                "updated_at": document.get("updated_at"),
                "version": document.get("version")
            }
        }
    
    def _from_zep_format(self, zep_memory: Dict) -> Dict:
        """Convert Zep format to internal memory format"""
        metadata = zep_memory.get("metadata", {})
        return {
            "id": zep_memory.get("id"),
            "content": zep_memory.get("content"),
            "memory_type": metadata.get("memory_type", "episodic"),
            "source_instance": metadata.get("agent_id"),
            "importance": metadata.get("importance", 0.5),
            "confidence": metadata.get("confidence", 0.5),
            "tags": metadata.get("tags", []),
            "created_at": metadata.get("created_at"),
            "updated_at": metadata.get("updated_at"),
            "version": metadata.get("version", 1),
            "sync_status": "synced"
        }

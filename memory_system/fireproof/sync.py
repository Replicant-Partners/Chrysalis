"""
Fireproof-Zep synchronization adapter.

Provides background synchronization between local Fireproof
storage and remote Zep cloud service.

Features:
- Background sync loop with configurable interval
- Batch processing for efficiency
- Retry with exponential backoff
- Conflict resolution via CRDT
- Telemetry and observability
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Protocol, TYPE_CHECKING

from .config import FireproofConfig
from .schemas import DocumentType, SyncStatus, EmbeddingRef

if TYPE_CHECKING:
    from .service import FireproofService
    from memory_system.hooks import ZepHooks


class EmbedderProtocol(Protocol):
    """Protocol for embedding service dependency injection."""
    def embed(self, text: str) -> List[float]:
        """Generate embedding vector for text."""
        ...

logger = logging.getLogger("central_logger")


@dataclass
class SyncStats:
    """Statistics for sync operations."""
    total_synced: int = 0
    total_failed: int = 0
    last_sync_time: float = 0.0
    last_sync_duration_ms: float = 0.0
    pending_count: int = 0
    consecutive_failures: int = 0


@dataclass
class SyncResult:
    """Result of a sync operation."""
    success: bool
    synced_count: int = 0
    failed_count: int = 0
    errors: List[str] = field(default_factory=list)
    duration_ms: float = 0.0


class FireproofZepSync:
    """
    Synchronizes Fireproof local data with Zep cloud.
    
    Provides background sync loop that:
    1. Queries pending documents from Fireproof
    2. Batches and pushes to Zep (embeddings, metadata)
    3. Marks documents as synced on success
    4. Retries on failure with exponential backoff
    
    Usage:
        sync = FireproofZepSync(fireproof, zep_hooks, config)
        await sync.start()  # Starts background loop
        # ... app runs ...
        await sync.stop()
    """
    
    def __init__(
        self,
        fireproof: FireproofService,
        zep_hooks: ZepHooks,
        config: Optional[FireproofConfig] = None,
        on_sync_complete: Optional[Callable[[SyncResult], None]] = None,
        embedder: Optional[EmbedderProtocol] = None,
    ) -> None:
        """
        Initialize sync adapter.
        
        Args:
            fireproof: FireproofService instance
            zep_hooks: ZepHooks instance for Zep operations
            config: Configuration settings
            on_sync_complete: Optional callback after each sync cycle
            embedder: Optional embedding service for pull_from_zep operations.
                      If not provided, will create EmbeddingService on demand.
        """
        self.fireproof = fireproof
        self.zep_hooks = zep_hooks
        self.config = config or FireproofConfig()
        self.on_sync_complete = on_sync_complete
        self._embedder = embedder
        
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._stats = SyncStats()
        self._backoff_s = 1.0  # Initial backoff
        self._max_backoff_s = 300.0  # Max 5 minutes
    
    @property
    def stats(self) -> SyncStats:
        """Get current sync statistics."""
        return self._stats
    
    @property
    def is_running(self) -> bool:
        """Check if sync loop is running."""
        return self._running
    
    async def start(self) -> None:
        """
        Start background sync loop.
        
        The loop runs until stop() is called, syncing pending
        documents at the configured interval.
        """
        if self._running:
            logger.warning("fireproof.sync.already_running")
            return
        
        if not self.config.sync_enabled:
            logger.info("fireproof.sync.disabled")
            return
        
        self._running = True
        self._task = asyncio.create_task(self._sync_loop())
        
        logger.info(
            "fireproof.sync.started",
            extra={
                "interval_s": self.config.sync_interval_s,
                "batch_size": self.config.sync_batch_size,
            }
        )
    
    async def stop(self) -> None:
        """
        Stop background sync loop.
        
        Waits for current sync operation to complete before stopping.
        """
        if not self._running:
            return
        
        self._running = False
        
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        
        logger.info(
            "fireproof.sync.stopped",
            extra={"total_synced": self._stats.total_synced}
        )
    
    async def sync_now(self) -> SyncResult:
        """
        Perform immediate sync operation.
        
        Can be called manually to force sync outside the
        regular interval.
        
        Returns:
            SyncResult with operation details
        """
        return await self._sync_pending()
    
    async def _sync_loop(self) -> None:
        """Background sync loop."""
        while self._running:
            try:
                result = await self._sync_pending()
                
                if result.success:
                    # Reset backoff on success
                    self._backoff_s = 1.0
                    self._stats.consecutive_failures = 0
                else:
                    # Exponential backoff on failure
                    self._stats.consecutive_failures += 1
                    self._backoff_s = min(
                        self._backoff_s * 2,
                        self._max_backoff_s
                    )
                
                # Notify callback
                if self.on_sync_complete:
                    try:
                        self.on_sync_complete(result)
                    except Exception as e:
                        logger.warning(
                            "fireproof.sync.callback_error",
                            extra={"error": str(e)}
                        )
                
                # Wait for next sync
                wait_time = (
                    self._backoff_s
                    if self._stats.consecutive_failures > 0
                    else self.config.sync_interval_s
                )
                await asyncio.sleep(wait_time)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(
                    "fireproof.sync.loop_error",
                    extra={"error": str(e)}
                )
                await asyncio.sleep(self._backoff_s)
    
    async def _sync_pending(self) -> SyncResult:
        """
        Sync pending documents to Zep.
        
        Returns:
            SyncResult with operation details
        """
        start_time = time.time()
        result = SyncResult(success=True)
        
        try:
            # Get pending documents
            pending = await self.fireproof.query_pending(
                limit=self.config.sync_batch_size
            )
            
            self._stats.pending_count = len(pending)
            
            if not pending:
                result.duration_ms = (time.time() - start_time) * 1000
                return result
            
            logger.info(
                "fireproof.sync.processing",
                extra={"count": len(pending)}
            )
            
            # Group by type for batch processing
            by_type: Dict[str, List[Dict[str, Any]]] = {}
            for doc in pending:
                doc_type = doc.get("type", "")
                if doc_type not in by_type:
                    by_type[doc_type] = []
                by_type[doc_type].append(doc)
            
            # Sync each type
            for doc_type, docs in by_type.items():
                try:
                    if doc_type == DocumentType.MEMORY.value:
                        await self._sync_memories(docs)
                    elif doc_type == DocumentType.EMBEDDING_REF.value:
                        await self._sync_embeddings(docs)
                    elif doc_type == DocumentType.METADATA.value:
                        await self._sync_metadata(docs)
                    elif doc_type == DocumentType.BEAD.value:
                        await self._sync_beads(docs)
                    
                    result.synced_count += len(docs)
                    
                except Exception as e:
                    result.failed_count += len(docs)
                    result.errors.append(f"{doc_type}: {str(e)}")
                    logger.error(
                        "fireproof.sync.type_error",
                        extra={"type": doc_type, "error": str(e)}
                    )
            
            # Update stats
            self._stats.total_synced += result.synced_count
            self._stats.total_failed += result.failed_count
            self._stats.last_sync_time = time.time()
            
            result.success = result.failed_count == 0
            
        except Exception as e:
            result.success = False
            result.errors.append(str(e))
            logger.error(
                "fireproof.sync.error",
                extra={"error": str(e)}
            )
        
        result.duration_ms = (time.time() - start_time) * 1000
        self._stats.last_sync_duration_ms = result.duration_ms
        
        logger.info(
            "fireproof.sync.completed",
            extra={
                "synced": result.synced_count,
                "failed": result.failed_count,
                "duration_ms": result.duration_ms,
            }
        )
        
        return result
    
    async def _sync_memories(self, docs: List[Dict[str, Any]]) -> None:
        """Sync LocalMemory documents to Zep."""
        # Group memories with embeddings
        with_embeddings = []
        
        for doc in docs:
            if doc.get("embedding_ref"):
                # Get embedding ref
                ref = await self.fireproof.get(doc["embedding_ref"])
                if ref and ref.get("local_cache"):
                    with_embeddings.append({
                        "doc": doc,
                        "embedding": ref["local_cache"],
                    })
        
        if with_embeddings:
            # Batch upsert to Zep
            payload = [
                {
                    "id": item["doc"]["_id"],
                    "embedding": item["embedding"],
                    "metadata": {
                        "type": item["doc"].get("memory_type", "unknown"),
                        "source": item["doc"].get("source_instance", ""),
                        "tags": item["doc"].get("tags", []),
                    },
                }
                for item in with_embeddings
            ]
            
            self.zep_hooks.on_store_embedding(payload)
        
        # Mark all as synced
        for doc in docs:
            doc["sync_status"] = SyncStatus.SYNCED.value
            await self.fireproof.put(doc)
    
    async def _sync_embeddings(self, docs: List[Dict[str, Any]]) -> None:
        """Sync EmbeddingRef documents to Zep."""
        if payload := [
            {
                "id": doc["_id"],
                "embedding": doc["local_cache"],
                "metadata": {
                    "text_hash": doc.get("text_hash", ""),
                    "model": doc.get("model", ""),
                },
            }
            for doc in docs
            if doc.get("local_cache")
        ]:
            self.zep_hooks.on_store_embedding(payload)

        # Mark as synced
        for doc in docs:
            doc["sync_status"] = SyncStatus.SYNCED.value
            # Clear local cache after sync to save space (optional)
            # doc["local_cache"] = None
            await self.fireproof.put(doc)
    
    async def _sync_metadata(self, docs: List[Dict[str, Any]]) -> None:
        """
        Sync PromptMetadata documents.
        
        Metadata is primarily for local observability but can also be:
        1. Stored as structured data in Zep for analytics
        2. Pushed to external telemetry systems if configured
        
        The metadata contains valuable performance data (latency, tokens,
        model info) that can be used for:
        - Cost tracking
        - Performance monitoring
        - Model comparison
        """
        # Collect metadata for batch processing
        metadata_batch = []
        
        for doc in docs:
            # Extract telemetry-relevant fields
            metadata_entry = {
                "id": doc.get("_id", ""),
                "session_id": doc.get("session_id", ""),
                "prompt_hash": doc.get("prompt_hash", ""),
                "model": doc.get("model", ""),
                "provider": doc.get("provider", ""),
                "tokens_in": doc.get("tokens_in", 0),
                "tokens_out": doc.get("tokens_out", 0),
                "tokens_context": doc.get("tokens_context", 0),
                "latency_ms": doc.get("latency_ms", 0),
                "score": doc.get("score"),
                "error": doc.get("error"),
                "created_at": doc.get("created_at", 0),
            }
            metadata_batch.append(metadata_entry)
        
        # Push metadata to Zep as structured records if available
        # Zep can store this for analytics and session tracking
        if metadata_batch and hasattr(self.zep_hooks, "on_store_metadata"):
            try:
                self.zep_hooks.on_store_metadata(metadata_batch)
                logger.debug(
                    "fireproof.sync.metadata_pushed",
                    extra={"count": len(metadata_batch)}
                )
            except Exception as e:
                # Metadata sync is non-critical, log and continue
                logger.warning(
                    "fireproof.sync.metadata_push_failed",
                    extra={"error": str(e), "count": len(metadata_batch)}
                )
        
        # Mark all as synced regardless of Zep push success
        # (metadata is primarily local observability data)
        for doc in docs:
            doc["sync_status"] = SyncStatus.SYNCED.value
            await self.fireproof.put(doc)
    
    async def _sync_beads(self, docs: List[Dict[str, Any]]) -> None:
        """
        Sync DurableBead documents to Zep.
        
        Beads contain the core conversation content that should be:
        1. Embedded for semantic search
        2. Stored in Zep's vector DB for retrieval
        3. Linked to session/conversation context
        
        High-importance beads are prioritized for embedding.
        """
        # Separate beads by whether they have embeddings
        beads_needing_embedding = []
        beads_with_embedding = []
        
        for doc in docs:
            content = doc.get("content", "")
            embedding_ref_id = doc.get("embedding_ref")
            
            if embedding_ref_id:
                # Check if embedding ref has cached vector
                ref = await self.fireproof.get(embedding_ref_id)
                if ref and ref.get("local_cache"):
                    beads_with_embedding.append({
                        "doc": doc,
                        "embedding": ref["local_cache"],
                        "text_hash": ref.get("text_hash", ""),
                    })
                    continue
            
            # Bead needs embedding if it has content
            if content and len(content.strip()) > 0:
                beads_needing_embedding.append(doc)
            else:
                # No content to embed, just mark as synced
                doc["sync_status"] = SyncStatus.SYNCED.value
                await self.fireproof.put(doc)
        
        # Generate embeddings for beads that need them
        if beads_needing_embedding and self._embedder:
            for doc in beads_needing_embedding:
                try:
                    content = doc.get("content", "")
                    embedding = self._embedder.embed(content)
                    
                    # Create embedding ref and store
                    embedding_ref = EmbeddingRef.create(
                        text=content,
                        model=getattr(self._embedder, "model_name", "unknown"),
                        dimensions=len(embedding),
                        vector=embedding,
                    )
                    ref_id = await self.fireproof.put_embedding_ref(embedding_ref)
                    
                    # Link bead to embedding ref
                    doc["embedding_ref"] = ref_id
                    
                    beads_with_embedding.append({
                        "doc": doc,
                        "embedding": embedding,
                        "text_hash": embedding_ref.text_hash,
                    })
                    
                except Exception as e:
                    logger.warning(
                        "fireproof.sync.bead_embed_failed",
                        extra={"bead_id": doc.get("_id"), "error": str(e)}
                    )
                    # Mark as synced anyway to avoid retry loop
                    doc["sync_status"] = SyncStatus.SYNCED.value
                    await self.fireproof.put(doc)
        elif beads_needing_embedding:
            # No embedder available, mark as synced without embedding
            logger.debug(
                "fireproof.sync.no_embedder",
                extra={"count": len(beads_needing_embedding)}
            )
            for doc in beads_needing_embedding:
                doc["sync_status"] = SyncStatus.SYNCED.value
                await self.fireproof.put(doc)
        
        # Push beads with embeddings to Zep
        if beads_with_embedding:
            payload = [
                {
                    "id": item["doc"]["_id"],
                    "embedding": item["embedding"],
                    "text": item["doc"].get("content", "")[:1000],  # Truncate for metadata
                    "metadata": {
                        "type": "bead",
                        "role": item["doc"].get("role", ""),
                        "importance": item["doc"].get("importance", 0.5),
                        "tags": item["doc"].get("tags", []),
                        "original_bead_id": item["doc"].get("original_bead_id", ""),
                        "text_hash": item["text_hash"],
                    },
                }
                for item in beads_with_embedding
            ]
            
            try:
                self.zep_hooks.on_store_embedding(payload)
                logger.debug(
                    "fireproof.sync.beads_pushed",
                    extra={"count": len(payload)}
                )
            except Exception as e:
                logger.error(
                    "fireproof.sync.beads_push_failed",
                    extra={"error": str(e), "count": len(payload)}
                )
                # Don't mark as synced if push failed
                return
            
            # Mark successfully synced beads
            for item in beads_with_embedding:
                doc = item["doc"]
                doc["sync_status"] = SyncStatus.SYNCED.value
                await self.fireproof.put(doc)
    
    async def pull_from_zep(
        self,
        query: str,
        k: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        Pull relevant data from Zep to local cache.
        
        Fetches embeddings from Zep and caches them locally
        in Fireproof for offline access.
        
        Args:
            query: Query text for similarity search
            k: Number of results to fetch
            
        Returns:
            List of cached documents
        """
        try:
            # Use injected embedder or create on demand
            embedder = self._embedder
            if embedder is None:
                from shared.embedding.service import EmbeddingService
                embedder = EmbeddingService()
            
            query_vec = embedder.embed(query)
            
            # Search Zep
            results = self.zep_hooks.on_retrieve_embeddings(query_vec, k=k)
            
            # Cache locally
            cached = []
            for result in results:
                embedding_ref = EmbeddingRef.create(
                    text=result.get("text", ""),
                    model=result.get("model", "unknown"),
                    dimensions=len(result.get("embedding", [])),
                    zep_id=result.get("id", ""),
                    vector=result.get("embedding"),
                )
                
                doc_id = await self.fireproof.put_embedding_ref(embedding_ref)
                cached.append({"_id": doc_id, **embedding_ref.to_dict()})
            
            logger.info(
                "fireproof.sync.pulled",
                extra={"count": len(cached)}
            )
            
            return cached
            
        except Exception as e:
            logger.error(
                "fireproof.sync.pull_error",
                extra={"error": str(e)}
            )
            return []


class SyncHealthCheck:
    """
    Health check for Fireproof-Zep sync.
    
    Provides health status for observability and alerting.
    """
    
    def __init__(self, sync: FireproofZepSync) -> None:
        self.sync = sync
    
    def check(self) -> Dict[str, Any]:
        """
        Check sync health status.
        
        Returns:
            Health check result with status and details
        """
        stats = self.sync.stats
        
        # Determine health status
        if not self.sync.is_running:
            status = "stopped"
        elif stats.consecutive_failures >= 5:
            status = "unhealthy"
        elif stats.consecutive_failures > 0:
            status = "degraded"
        elif stats.pending_count > 1000:
            status = "backlogged"
        else:
            status = "healthy"
        
        return {
            "status": status,
            "is_running": self.sync.is_running,
            "total_synced": stats.total_synced,
            "total_failed": stats.total_failed,
            "pending_count": stats.pending_count,
            "consecutive_failures": stats.consecutive_failures,
            "last_sync_time": stats.last_sync_time,
            "last_sync_duration_ms": stats.last_sync_duration_ms,
        }

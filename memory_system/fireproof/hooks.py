"""
Fireproof integration hooks.

Provides hooks for capturing LLM prompt metadata and
integrating with the Beads promotion system.
"""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager, contextmanager
from dataclasses import dataclass, field
from typing import (
    Any,
    Awaitable,
    Callable,
    Dict,
    Generator,
    List,
    Optional,
    Protocol,
    TYPE_CHECKING,
    Union,
    runtime_checkable,
)

from .async_utils import run_async_safely, schedule_async
from .schemas import (
    DocumentType,
    DurableBead,
    PromptMetadata,
    EmbeddingRef,
    SyncStatus,
)

if TYPE_CHECKING:
    from .service import FireproofService
    from .config import FireproofConfig

logger = logging.getLogger("central_logger")


# =============================================================================
# Protocol Definitions for Hook Interfaces
# =============================================================================


@runtime_checkable
class PromotionHookProtocol(Protocol):
    """
    Protocol defining the interface for bead promotion hooks.
    
    Promotion hooks receive bead data when a bead's importance
    exceeds the promotion threshold and should persist the bead
    to durable storage.
    
    Implementations may be sync or async. The caller (BeadsService)
    is responsible for handling both cases appropriately.
    """
    
    def __call__(
        self, bead_data: Dict[str, Any]
    ) -> Union[Optional[str], Awaitable[Optional[str]]]:
        """
        Promote a bead to durable storage.
        
        Args:
            bead_data: Dictionary containing bead information:
                - bead_id or _id: Unique bead identifier
                - content: Text content of the bead
                - role: Origin role (user, assistant, tool)
                - importance: Float importance score (0.0-1.0)
                - span_refs: Optional list of span references
                - metadata: Optional metadata dictionary
                - timestamp: Creation timestamp
                
        Returns:
            str: Document ID in durable storage if promoted
            None: If bead was not promoted (importance below threshold)
            Awaitable[Optional[str]]: Async variant of the above
        """
        ...


@runtime_checkable
class AsyncPromotionHookProtocol(Protocol):
    """
    Protocol for async-only promotion hooks.
    
    Use this when you need to enforce async behavior.
    """
    
    async def __call__(self, bead_data: Dict[str, Any]) -> Optional[str]:
        """Async promotion hook that returns document ID or None."""
        ...


@runtime_checkable
class SyncPromotionHookProtocol(Protocol):
    """
    Protocol for sync-only promotion hooks.
    
    Use this when you need to enforce sync behavior.
    """
    
    def __call__(self, bead_data: Dict[str, Any]) -> Optional[str]:
        """Sync promotion hook that returns document ID or None."""
        ...


@runtime_checkable
class EmbeddingCacheProtocol(Protocol):
    """
    Protocol for embedding cache operations.
    
    Defines the interface for caching and retrieving embeddings.
    """
    
    async def cache_embedding(
        self,
        text: str,
        vector: List[float],
        model: str,
        zep_id: Optional[str] = None,
    ) -> str:
        """Cache an embedding and return document ID."""
        ...
    
    async def get_cached_embedding(self, text: str) -> Optional[List[float]]:
        """Get cached embedding for text, or None if not found."""
        ...


# Type alias for promotion hook callables
PromotionHookType = Callable[[Dict[str, Any]], Union[Optional[str], Awaitable[Optional[str]]]]


@dataclass
class RetrievalSourceInfo:
    """Information about a retrieval source used in prompt context."""
    source_type: str  # "bead", "fireproof", "zep"
    source_id: str
    score: float = 0.0
    content_preview: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.source_type,
            "id": self.source_id,
            "score": self.score,
            "preview": self.content_preview[:100] if self.content_preview else "",
        }


class PromptMetadataCapture:
    """
    Captures LLM prompt/response metadata to Fireproof.
    
    Provides context managers for capturing telemetry about
    LLM interactions, including:
    - Token usage
    - Latency
    - Retrieval sources used
    - Quality scores
    - Errors
    
    Usage:
        capture = PromptMetadataCapture(fireproof)
        
        async with capture.capture_async(
            session_id="session-123",
            model="claude-3-opus",
            retrieval_sources=sources
        ) as meta:
            response = await llm.generate(prompt)
            meta.tokens_out = count_tokens(response)
            meta.score = evaluate(response)
    """
    
    def __init__(
        self,
        fireproof: FireproofService,
        auto_save: bool = True,
    ) -> None:
        """
        Initialize metadata capture.
        
        Args:
            fireproof: FireproofService instance for storage
            auto_save: Automatically save metadata on context exit
        """
        self.fireproof = fireproof
        self.auto_save = auto_save
    
    @asynccontextmanager
    async def capture_async(
        self,
        session_id: str,
        model: str,
        provider: str = "",
        retrieval_sources: Optional[List[RetrievalSourceInfo]] = None,
        prompt_text: Optional[str] = None,
        prompt_version: str = "",
        tokens_in: int = 0,
        tokens_context: int = 0,
    ):
        """
        Async context manager for capturing prompt metadata.
        
        Args:
            session_id: Session/conversation ID
            model: LLM model name
            provider: LLM provider name
            retrieval_sources: Sources used in prompt context
            prompt_text: Optional prompt text (for hashing)
            prompt_version: Optional semantic version
            tokens_in: Input token count
            tokens_context: Context token count
            
        Yields:
            PromptMetadata instance for updating
        """
        meta = PromptMetadata(
            session_id=session_id,
            model=model,
            provider=provider,
            prompt_hash=PromptMetadata.hash_prompt(prompt_text) if prompt_text else "",
            prompt_version=prompt_version,
            tokens_in=tokens_in,
            tokens_context=tokens_context,
            retrieval_sources=[
                s.to_dict() for s in (retrieval_sources or [])
            ],
            sync_status=SyncStatus.PENDING.value,
        )
        
        start_time = time.time()
        error: Optional[str] = None
        
        try:
            yield meta
        except Exception as e:
            error = str(e)
            meta.error = error
            raise
        finally:
            # Complete metadata
            meta.completed_at = time.time()
            meta.latency_ms = (meta.completed_at - start_time) * 1000
            
            if error:
                meta.error = error
            
            # Save if auto_save enabled
            if self.auto_save:
                try:
                    await self.fireproof.put_metadata(meta)
                    logger.debug(
                        "fireproof.metadata.captured",
                        extra={
                            "session_id": session_id,
                            "model": model,
                            "latency_ms": meta.latency_ms,
                        }
                    )
                except Exception as save_error:
                    logger.warning(
                        "fireproof.metadata.save_error",
                        extra={"error": str(save_error)}
                    )
    
    @contextmanager
    def capture_sync(
        self,
        session_id: str,
        model: str,
        provider: str = "",
        retrieval_sources: Optional[List[RetrievalSourceInfo]] = None,
        prompt_text: Optional[str] = None,
        prompt_version: str = "",
        tokens_in: int = 0,
        tokens_context: int = 0,
    ) -> Generator[PromptMetadata, None, None]:
        """
        Synchronous context manager for capturing prompt metadata.
        
        Uses asyncio.create_task for async save operation.
        See capture_async for parameter documentation.
        """
        meta = PromptMetadata(
            session_id=session_id,
            model=model,
            provider=provider,
            prompt_hash=PromptMetadata.hash_prompt(prompt_text) if prompt_text else "",
            prompt_version=prompt_version,
            tokens_in=tokens_in,
            tokens_context=tokens_context,
            retrieval_sources=[
                s.to_dict() for s in (retrieval_sources or [])
            ],
            sync_status=SyncStatus.PENDING.value,
        )
        
        start_time = time.time()
        error: Optional[str] = None
        
        try:
            yield meta
        except Exception as e:
            error = str(e)
            meta.error = error
            raise
        finally:
            meta.completed_at = time.time()
            meta.latency_ms = (meta.completed_at - start_time) * 1000
            
            if error:
                meta.error = error
            
            if self.auto_save:
                # Schedule async save using safe async utilities
                schedule_async(self.fireproof.put_metadata(meta))
    
    async def get_session_stats(
        self,
        session_id: str,
        limit: int = 100,
    ) -> Dict[str, Any]:
        """
        Get aggregated statistics for a session.
        
        Args:
            session_id: Session ID to query
            limit: Max metadata records to consider
            
        Returns:
            Dict with session statistics
        """
        metadata = await self.fireproof.query_metadata(
            session_id=session_id,
            limit=limit,
        )
        
        if not metadata:
            return {
                "session_id": session_id,
                "interaction_count": 0,
            }
        
        # Calculate stats
        total_tokens_in = sum(m.get("tokens_in", 0) for m in metadata)
        total_tokens_out = sum(m.get("tokens_out", 0) for m in metadata)
        total_latency = sum(m.get("latency_ms", 0) for m in metadata)
        errors = [m for m in metadata if m.get("error")]
        scores = [m.get("score") for m in metadata if m.get("score") is not None]
        
        # Aggregate retrieval sources
        source_counts: Dict[str, int] = {}
        for m in metadata:
            for source in m.get("retrieval_sources", []):
                source_type = source.get("type", "unknown")
                source_counts[source_type] = source_counts.get(source_type, 0) + 1
        
        return {
            "session_id": session_id,
            "interaction_count": len(metadata),
            "total_tokens_in": total_tokens_in,
            "total_tokens_out": total_tokens_out,
            "total_tokens": total_tokens_in + total_tokens_out,
            "avg_latency_ms": total_latency / len(metadata) if metadata else 0,
            "error_count": len(errors),
            "error_rate": len(errors) / len(metadata) if metadata else 0,
            "avg_score": sum(scores) / len(scores) if scores else None,
            "retrieval_source_counts": source_counts,
            "models_used": list(set(m.get("model", "") for m in metadata)),
        }
    
    async def get_recent_errors(
        self,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Get recent metadata entries with errors.
        
        Args:
            limit: Max results
            
        Returns:
            List of metadata dicts with errors
        """
        # Query all recent metadata
        all_metadata = await self.fireproof.query("type", {
            "key": DocumentType.METADATA.value,
            "limit": limit * 2,  # Over-fetch to filter
            "descending": True,
        })
        
        # Filter to errors
        errors = [m for m in all_metadata if m.get("error")]
        return errors[:limit]
    
    async def get_low_scoring(
        self,
        threshold: float = 3.0,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Get metadata entries with low quality scores.
        
        Args:
            threshold: Score threshold (below this is considered low)
            limit: Max results
            
        Returns:
            List of low-scoring metadata dicts
        """
        all_metadata = await self.fireproof.query("type", {
            "key": DocumentType.METADATA.value,
            "limit": limit * 3,
            "descending": True,
        })
        
        low_scoring = [
            m for m in all_metadata
            if m.get("score") is not None and m["score"] < threshold
        ]
        return low_scoring[:limit]


class BeadPromotionHook:
    """
    Hook for promoting beads from BeadsService to Fireproof.
    
    High-importance beads are copied to Fireproof for
    durable storage that persists beyond the bead TTL.
    
    Usage:
        hook = BeadPromotionHook(fireproof, threshold=0.7)
        
        # Use as promotion hook in BeadsService
        beads = BeadsService(
            promotion_hook=hook.promote,
            promotion_threshold=0.7
        )
    """
    
    def __init__(
        self,
        fireproof: FireproofService,
        threshold: float = 0.7,
        async_mode: bool = True,
    ) -> None:
        """
        Initialize promotion hook.
        
        Args:
            fireproof: FireproofService instance
            threshold: Minimum importance for promotion
            async_mode: Promote asynchronously (non-blocking)
        """
        self.fireproof = fireproof
        self.threshold = threshold
        self.async_mode = async_mode
        self._promotion_count = 0
    
    @property
    def promotion_count(self) -> int:
        """Get count of promoted beads."""
        return self._promotion_count
    
    async def promote(self, bead_data: Dict[str, Any]) -> Optional[str]:
        """
        Promote a bead to Fireproof.
        
        Args:
            bead_data: Bead data dict with at least:
                - bead_id or _id
                - content
                - role
                - importance
                
        Returns:
            Fireproof document ID if promoted, None otherwise
        """
        importance = bead_data.get("importance", 0)
        
        if importance < self.threshold:
            return None
        
        # Create DurableBead
        durable = DurableBead.from_bead(
            bead_id=bead_data.get("bead_id") or bead_data.get("_id", ""),
            content=bead_data.get("content", ""),
            role=bead_data.get("role", "user"),
            importance=importance,
            span_refs=bead_data.get("span_refs", []),
            metadata=bead_data.get("metadata", {}),
        )
        
        doc_id = await self.fireproof.put_bead(durable)
        self._promotion_count += 1
        
        logger.debug(
            "fireproof.bead.promoted",
            extra={
                "bead_id": durable.original_bead_id,
                "doc_id": doc_id,
                "importance": importance,
            }
        )
        
        return doc_id
    
    def promote_sync(self, bead_data: Dict[str, Any]) -> Optional[str]:
        """
        Synchronous version of promote.
        
        Schedules async promotion if in async_mode, otherwise
        runs synchronously using safe async utilities.
        """
        if self.async_mode:
            # Fire-and-forget in async mode
            schedule_async(self.promote(bead_data))
            return None  # ID not available synchronously
        else:
            return run_async_safely(self.promote(bead_data))


class EmbeddingCacheHook:
    """
    Hook for caching embeddings in Fireproof.
    
    Caches embedding vectors locally for offline operation
    and reduced latency.
    """
    
    def __init__(
        self,
        fireproof: FireproofService,
        cache_threshold_bytes: int = 10240,
    ) -> None:
        """
        Initialize embedding cache hook.
        
        Args:
            fireproof: FireproofService instance
            cache_threshold_bytes: Max vector size to cache
        """
        self.fireproof = fireproof
        self.cache_threshold_bytes = cache_threshold_bytes
    
    async def cache_embedding(
        self,
        text: str,
        vector: List[float],
        model: str,
        zep_id: Optional[str] = None,
    ) -> str:
        """
        Cache an embedding in Fireproof.
        
        Args:
            text: Source text
            vector: Embedding vector
            model: Model name
            zep_id: Optional Zep vector ID
            
        Returns:
            Fireproof document ID
        """
        ref = EmbeddingRef.create(
            text=text,
            model=model,
            dimensions=len(vector),
            zep_id=zep_id,
            vector=vector,
            cache_threshold_bytes=self.cache_threshold_bytes,
        )
        
        return await self.fireproof.put_embedding_ref(ref)
    
    async def get_cached_embedding(
        self,
        text: str,
    ) -> Optional[List[float]]:
        """
        Get cached embedding for text.
        
        Args:
            text: Source text
            
        Returns:
            Cached vector or None if not found
        """
        text_hash = EmbeddingRef.hash_text(text)
        
        # Query by text hash
        results = await self.fireproof.query("type", {
            "key": DocumentType.EMBEDDING_REF.value,
            "filter": {"text_hash": text_hash},
            "limit": 1,
        })
        
        if results and results[0].get("local_cache"):
            return results[0]["local_cache"]
        
        return None


def create_promotion_hook(
    fireproof: FireproofService,
    config: FireproofConfig,
) -> Callable[[Dict[str, Any]], Union[Optional[str], Awaitable[Optional[str]]]]:
    """
    Factory function to create a promotion hook for BeadsService.
    
    Creates a BeadPromotionHook and returns its promote method,
    which can be used as the promotion_hook parameter in BeadsService.
    
    Args:
        fireproof: FireproofService instance for durable storage
        config: FireproofConfig with promotion settings
        
    Returns:
        Promotion hook callable compatible with BeadsService
        
    Example:
        hook = create_promotion_hook(fireproof, config)
        beads = BeadsService(promotion_hook=hook, promotion_threshold=0.7)
    """
    from .config import FireproofConfig as FPConfig  # Avoid circular import
    
    hook = BeadPromotionHook(
        fireproof=fireproof,
        threshold=config.promotion_threshold,
        async_mode=config.promotion_async if hasattr(config, 'promotion_async') else True,
    )
    return hook.promote

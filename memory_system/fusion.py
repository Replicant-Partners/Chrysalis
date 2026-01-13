from __future__ import annotations

import logging
from typing import Any, Dict, Iterable, List, Optional, TYPE_CHECKING

from memory_system.beads import BeadsService
from memory_system.hooks import ZepHooks
from memory_system.fireproof.async_utils import run_async_safely
from shared.embedding.service import EmbeddingService

if TYPE_CHECKING:
    from memory_system.fireproof import FireproofService
    from memory_system.fireproof.schemas import DurableBead, EmbeddingRef

logger = logging.getLogger("central_logger")


class FusionRetriever:
    """
    Local-first fusion retriever that combines:
    - Recent beads (short-term context)
    - Fireproof durable cache (hybrid tier) - NEW
    - Remote embedding search via Zep (optional)
    - Remote KG retrieval via Zep (optional)

    Minimal API:
    - ingest(): store bead locally, optionally upsert embedding to Zep
    - retrieve(): return beads + fireproof + remote embedding matches (+ KG if requested)
    
    With Fireproof integration:
    - High-importance beads are auto-promoted via BeadsService promotion hook
    - Fireproof provides durable local cache with offline fallback
    - Remote Zep failures fall back to Fireproof local search
    """

    def __init__(
        self,
        beads: BeadsService,
        embedder: Optional[EmbeddingService] = None,
        zep_hooks: Optional[ZepHooks] = None,
        fireproof: Optional[FireproofService] = None,
    ) -> None:
        """
        Initialize FusionRetriever.
        
        Args:
            beads: BeadsService for short-term context
            embedder: EmbeddingService for vector generation
            zep_hooks: ZepHooks for remote long-term storage
            fireproof: FireproofService for durable local cache (optional)
        """
        self.beads = beads
        self.embedder = embedder
        self.zep_hooks = zep_hooks
        self.fireproof = fireproof

    def ingest(
        self,
        content: str,
        role: str = "user",
        importance: float = 0.5,
        metadata: Optional[Dict[str, Any]] = None,
        span_refs: Optional[List[str]] = None,
        promote_to_fireproof: bool = False,
    ) -> Dict[str, Any]:
        """
        Ingest content into memory system.
        
        Args:
            content: Text content to store
            role: Origin role (user, assistant, tool)
            importance: Importance weighting (0.0-1.0)
            metadata: Optional metadata dict
            span_refs: Optional span references
            promote_to_fireproof: Force promotion to Fireproof regardless of importance
            
        Returns:
            Dict with bead_id, fireproof_id (if promoted), remote status
        """
        # Store in beads (may auto-promote via promotion_hook if importance >= threshold)
        bead_id = self.beads.append(
            content=content,
            role=role,
            importance=importance,
            span_refs=span_refs,
            metadata=metadata,
        )

        fireproof_id: Optional[str] = None
        remote = None
        
        # Force promotion to Fireproof if requested and enabled
        if (
            promote_to_fireproof
            and self.fireproof
            and self.fireproof.config.promotion_enabled
        ):
            from memory_system.fireproof.schemas import DurableBead  # noqa: F811
            
            durable = DurableBead.from_bead(
                bead_id=bead_id,
                content=content,
                role=role,
                importance=importance,
                span_refs=span_refs,
                metadata=metadata,
            )
            
            async def put_durable() -> str:
                return await self.fireproof.put_bead(durable)
            
            fireproof_id = run_async_safely(put_durable())
        
        # Upsert to Zep
        if self.embedder and self.zep_hooks:
            try:
                vec = self.embedder.embed(content)
                payload = [
                    {
                        "id": bead_id,
                        "embedding": vec,
                        "metadata": metadata or {},
                    }
                ]
                remote = self.zep_hooks.on_store_embedding(payload)
                
                # Cache embedding in Fireproof if available
                if self.fireproof and self.fireproof.config.local_vector_cache:
                    from memory_system.fireproof.schemas import EmbeddingRef
                    
                    ref = EmbeddingRef.create(
                        text=content,
                        model=getattr(self.embedder, 'model_name', "unknown"),
                        dimensions=len(vec),
                        zep_id=bead_id,
                        vector=vec,
                    )
                    
                    async def cache_ref() -> str:
                        return await self.fireproof.put_embedding_ref(ref)
                    
                    # Fire-and-forget cache operation with error logging
                    try:
                        run_async_safely(cache_ref())
                    except Exception as cache_exc:
                        logger.warning(
                            "fusion.ingest.cache_embedding_failed",
                            extra={"error": str(cache_exc)}
                        )
                        
            except Exception as exc:  # pylint: disable=broad-except
                logger.warning("fusion.ingest.remote_failed", extra={"error": str(exc)})

        return {"bead_id": bead_id, "fireproof_id": fireproof_id, "remote": remote}

    def retrieve(
        self,
        query: str,
        bead_limit: int = 5,
        fireproof_limit: int = 10,
        remote_k: int = 5,
        include_remote: bool = True,
        include_fireproof: bool = True,
        kg_node_ids: Optional[List[str]] = None,
        kg_predicates: Optional[Iterable[str]] = None,
        kg_hops: int = 1,
        min_importance: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Retrieve context from all memory tiers (synchronous version).
        
        .. warning::
            When called from an async context (inside an event loop),
            Fireproof queries will be skipped and return empty results.
            Use :meth:`retrieve_async` for full functionality in async code.
        
        Args:
            query: Query string for similarity search
            bead_limit: Max beads to return
            fireproof_limit: Max Fireproof documents to return
            remote_k: Max remote embeddings to return
            include_remote: Whether to query Zep
            include_fireproof: Whether to query Fireproof
            kg_node_ids: Optional KG node IDs for graph traversal
            kg_predicates: Optional KG predicates filter
            kg_hops: KG traversal hops
            min_importance: Optional minimum importance filter
            
        Returns:
            Dict with beads, fireproof, remote_embeddings, kg results, and
            async_context_warning (True if called from async context)
        """
        async_context_warning = False
        
        # 1. Short-term: Recent beads
        beads_recent = self.beads.recent(limit=bead_limit, min_importance=min_importance)
        
        # 2. Hybrid: Fireproof durable cache
        fireproof_results: List[Dict[str, Any]] = []
        if include_fireproof and self.fireproof:
            async def query_fireproof() -> List[Dict[str, Any]]:
                return await self.fireproof.query_beads(
                    limit=fireproof_limit,
                    min_importance=min_importance,
                )
            
            result = run_async_safely(query_fireproof())
            if result is None:
                async_context_warning = True
                logger.warning(
                    "fusion.retrieve.fireproof_skipped",
                    extra={"reason": "Called from async context. Use retrieve_async()."}
                )
            else:
                fireproof_results = result
        
        # 3. Long-term: Remote Zep (with Fireproof fallback)
        remote_matches: List[Dict[str, Any]] = []
        kg_result: Optional[Dict[str, Any]] = None
        used_fallback = False

        if include_remote and self.embedder and self.zep_hooks:
            try:
                qvec = self.embedder.embed(query)
                remote_matches = self.zep_hooks.on_retrieve_embeddings(qvec, k=remote_k)
            except Exception as exc:  # pylint: disable=broad-except
                logger.warning("fusion.retrieve.remote_failed", extra={"error": str(exc)})
                
                # Fallback: Use Fireproof local vector search
                if self.fireproof and self.fireproof.config.local_vector_cache:
                    qvec = self.embedder.embed(query)
                    
                    async def local_search() -> List[Dict[str, Any]]:
                        return await self.fireproof.local_similarity_search(
                            qvec, k=remote_k
                        )
                    
                    fallback_result = run_async_safely(local_search())
                    if fallback_result is not None:
                        remote_matches = fallback_result
                        used_fallback = True
                        logger.info("fusion.retrieve.used_fireproof_fallback")
                    elif not async_context_warning:
                        async_context_warning = True

        # 4. KG retrieval
        if self.zep_hooks and kg_node_ids:
            try:
                kg_result = self.zep_hooks.on_retrieve_kg(
                    node_ids=kg_node_ids, predicates=kg_predicates, hops=kg_hops
                )
            except Exception as exc:  # pylint: disable=broad-except
                logger.warning("fusion.retrieve.kg_failed", extra={"error": str(exc)})

        return {
            "beads": beads_recent,
            "fireproof": fireproof_results,
            "remote_embeddings": remote_matches,
            "kg": kg_result,
            "used_fallback": used_fallback,
            "async_context_warning": async_context_warning,
        }
    
    async def retrieve_async(
        self,
        query: str,
        bead_limit: int = 5,
        fireproof_limit: int = 10,
        remote_k: int = 5,
        include_remote: bool = True,
        include_fireproof: bool = True,
        kg_node_ids: Optional[List[str]] = None,
        kg_predicates: Optional[Iterable[str]] = None,
        kg_hops: int = 1,
        min_importance: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Async version of retrieve for better performance.
        
        See retrieve() for parameter documentation.
        """
        # 1. Short-term: Recent beads (sync operation)
        beads_recent = self.beads.recent(limit=bead_limit, min_importance=min_importance)
        
        # 2. Hybrid: Fireproof durable cache
        fireproof_results: List[Dict[str, Any]] = []
        if include_fireproof and self.fireproof:
            try:
                fireproof_results = await self.fireproof.query_beads(
                    limit=fireproof_limit,
                    min_importance=min_importance,
                )
            except Exception as exc:
                logger.warning("fusion.retrieve.fireproof_failed", extra={"error": str(exc)})
        
        # 3. Long-term: Remote Zep (with Fireproof fallback)
        remote_matches: List[Dict[str, Any]] = []
        kg_result: Optional[Dict[str, Any]] = None
        used_fallback = False

        if include_remote and self.embedder and self.zep_hooks:
            try:
                qvec = self.embedder.embed(query)
                remote_matches = self.zep_hooks.on_retrieve_embeddings(qvec, k=remote_k)
            except Exception as exc:
                logger.warning("fusion.retrieve.remote_failed", extra={"error": str(exc)})
                
                # Fallback to Fireproof
                if self.fireproof and self.fireproof.config.local_vector_cache:
                    try:
                        qvec = self.embedder.embed(query)
                        remote_matches = await self.fireproof.local_similarity_search(
                            qvec, k=remote_k
                        )
                        used_fallback = True
                        logger.info("fusion.retrieve.used_fireproof_fallback")
                    except Exception as fallback_exc:
                        logger.warning(
                            "fusion.retrieve.fallback_failed",
                            extra={"error": str(fallback_exc)}
                        )

        # 4. KG retrieval
        if self.zep_hooks and kg_node_ids:
            try:
                kg_result = self.zep_hooks.on_retrieve_kg(
                    node_ids=kg_node_ids, predicates=kg_predicates, hops=kg_hops
                )
            except Exception as exc:
                logger.warning("fusion.retrieve.kg_failed", extra={"error": str(exc)})

        return {
            "beads": beads_recent,
            "fireproof": fireproof_results,
            "remote_embeddings": remote_matches,
            "kg": kg_result,
            "used_fallback": used_fallback,
        }
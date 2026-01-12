from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from memory_system.beads import BeadsService
from memory_system.hooks import ZepHooks
from shared.embedding.service import EmbeddingService

logger = logging.getLogger("central_logger")


class FusionRetriever:
    """
    Local-first fusion retriever that combines:
    - Recent beads (short-term context)
    - Remote embedding search via Zep (optional)
    - (Future) KG results via Zep/Graph

    Minimal API:
    - ingest(): store bead locally, optionally upsert embedding to Zep
    - retrieve(): return recent beads + remote embedding matches
    """

    def __init__(
        self,
        beads: BeadsService,
        embedder: Optional[EmbeddingService] = None,
        zep_hooks: Optional[ZepHooks] = None,
    ) -> None:
        self.beads = beads
        self.embedder = embedder
        self.zep_hooks = zep_hooks

    def ingest(
        self,
        content: str,
        role: str = "user",
        importance: float = 0.5,
        metadata: Optional[Dict[str, Any]] = None,
        span_refs: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        bead_id = self.beads.append(
            content=content,
            role=role,
            importance=importance,
            span_refs=span_refs,
            metadata=metadata,
        )

        remote = None
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
            except Exception as exc:  # pylint: disable=broad-except
                logger.warning("fusion.ingest.remote_failed", extra={"error": str(exc)})

        return {"bead_id": bead_id, "remote": remote}

    def retrieve(
        self,
        query: str,
        bead_limit: int = 5,
        remote_k: int = 5,
        include_remote: bool = True,
    ) -> Dict[str, Any]:
        beads_recent = self.beads.recent(limit=bead_limit)
        remote_matches: List[Dict[str, Any]] = []

        if include_remote and self.embedder and self.zep_hooks:
            try:
                qvec = self.embedder.embed(query)
                remote_matches = self.zep_hooks.on_retrieve_embeddings(qvec, k=remote_k)
            except Exception as exc:  # pylint: disable=broad-except
                logger.warning("fusion.retrieve.remote_failed", extra={"error": str(exc)})

        return {
            "beads": beads_recent,
            "remote_embeddings": remote_matches,
        }
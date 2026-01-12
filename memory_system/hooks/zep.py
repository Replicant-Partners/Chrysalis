"""
Zep integration hooks.

Provides thin wrappers over ZepClient for vector and KG operations and emits
structured telemetry to the central logger.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Iterable, List, Optional

from .zep_client import ZepClient, ZepClientError

logger = logging.getLogger("central_logger")


class ZepHooks:
    """
    Hooks for Zep lifecycle events (store/retrieve/sync).
    Wraps ZepClient and provides structured logging.
    """

    def __init__(
        self,
        endpoint: Optional[str] = None,
        api_key: Optional[str] = None,
        project: Optional[str] = None,
        client: Optional[ZepClient] = None,
    ) -> None:
        """
        Initialize Zep hook handler.

        Args:
            endpoint: Zep service endpoint URL.
            api_key: Optional API key.
            project: Optional project name.
            client: Optional preconstructed ZepClient.
        """
        self.client = client or ZepClient(endpoint=endpoint, api_key=api_key, project=project)

    # -------- Vector operations --------
    def on_store_embedding(self, vectors: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Upsert embeddings into Zep vector index.

        Args:
            vectors: List of dicts with keys: id, embedding, metadata.
        """
        logger.info("zep.store_embedding.start", extra={"count": len(vectors)})
        try:
            self.client.upsert_embeddings(vectors)
            logger.info("zep.store_embedding.ok", extra={"count": len(vectors)})
            return {"status": "ok", "count": len(vectors)}
        except Exception as exc:  # broad catch to surface upstream
            logger.error("zep.store_embedding.error", extra={"error": str(exc)})
            raise

    def on_retrieve_embeddings(self, vector: List[float], k: int = 5) -> List[Dict[str, Any]]:
        """
        Query nearest neighbors for a vector.
        """
        logger.info("zep.retrieve_embeddings.start", extra={"k": k})
        try:
            matches = self.client.query_embeddings(vector, k=k)
            logger.info("zep.retrieve_embeddings.ok", extra={"count": len(matches)})
            return matches
        except Exception as exc:  # broad catch to surface upstream
            logger.error("zep.retrieve_embeddings.error", extra={"error": str(exc)})
            raise

    # -------- KG operations --------
    def on_store_kg(self, nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Upsert KG nodes/edges into Zep.
        """
        logger.info("zep.store_kg.start", extra={"nodes": len(nodes), "edges": len(edges)})
        try:
            self.client.upsert_kg(nodes, edges)
            logger.info("zep.store_kg.ok", extra={"nodes": len(nodes), "edges": len(edges)})
            return {"status": "ok", "nodes": len(nodes), "edges": len(edges)}
        except Exception as exc:  # broad catch to surface upstream
            logger.error("zep.store_kg.error", extra={"error": str(exc)})
            raise

    def on_retrieve_kg(
        self,
        node_ids: List[str],
        predicates: Optional[Iterable[str]] = None,
        hops: int = 1,
    ) -> Dict[str, Any]:
        """
        Query KG from Zep.
        """
        logger.info(
            "zep.retrieve_kg.start",
            extra={"node_ids": len(node_ids), "predicates": list(predicates) if predicates else None, "hops": hops},
        )
        try:
            result = self.client.query_kg(node_ids=node_ids, predicates=predicates, hops=hops)
            logger.info("zep.retrieve_kg.ok", extra={"node_ids": len(node_ids)})
            return result
        except Exception as exc:  # broad catch to surface upstream
            logger.error("zep.retrieve_kg.error", extra={"error": str(exc)})
            raise

    # -------- Sync hooks --------
    def on_sync(self, direction: str = "push", metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Hook invoked around sync operations.

        Args:
            direction: "push" or "pull".
            metadata: Optional sync metadata.
        """
        logger.info("zep.sync", extra={"direction": direction, "metadata": metadata or {}})
        return {"status": "ok", "direction": direction, "metadata": metadata or {}}
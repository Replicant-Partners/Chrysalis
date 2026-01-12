"""
Zep client for KG and vector operations.

Uses requests with simple retry/backoff. Assumes Zep project context is provided
(via env or constructor). Intended to be used by ZepHooks.
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Dict, Iterable, List, Optional

import requests
from requests import Response, Session

logger = logging.getLogger("central_logger")


class ZepClientError(Exception):
    """Base Zep client error."""


class ZepClient:
    def __init__(
        self,
        endpoint: Optional[str] = None,
        api_key: Optional[str] = None,
        project: Optional[str] = None,
        timeout: float = 15.0,
        retries: int = 3,
        backoff_seconds: float = 1.0,
        session: Optional[Session] = None,
    ) -> None:
        self.endpoint = (endpoint or os.getenv("ZEP_ENDPOINT") or "").rstrip("/")
        self.api_key = api_key or os.getenv("ZEP_API_KEY")
        self.project = project or os.getenv("ZEP_PROJECT") or "default"
        self.timeout = timeout
        self.retries = retries
        self.backoff_seconds = backoff_seconds
        self.session = session or requests.Session()

        if not self.endpoint:
            raise ZepClientError("Zep endpoint is required (ZEP_ENDPOINT)")

    # -------- vector operations --------
    def upsert_embeddings(self, vectors: List[Dict[str, Any]]) -> None:
        """
        Upsert embeddings into Zep vector index.

        Each vector should include id, embedding, metadata (dict).
        """
        payload = {"project": self.project, "vectors": vectors}
        self._post("/vectors/upsert", payload)

    def query_embeddings(self, vector: List[float], k: int = 5) -> List[Dict[str, Any]]:
        """
        Query nearest neighbors for a vector.
        """
        payload = {"project": self.project, "vector": vector, "k": k}
        resp = self._post("/vectors/query", payload)
        return resp.get("matches", [])

    # -------- KG operations --------
    def upsert_kg(self, nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> None:
        """
        Upsert KG nodes and edges.
        """
        payload = {"project": self.project, "nodes": nodes, "edges": edges}
        self._post("/kg/upsert", payload)

    def query_kg(
        self,
        node_ids: List[str],
        predicates: Optional[Iterable[str]] = None,
        hops: int = 1,
    ) -> Dict[str, Any]:
        """
        Query KG starting from node_ids up to N hops.
        """
        payload = {
            "project": self.project,
            "node_ids": node_ids,
            "predicates": list(predicates) if predicates else None,
            "hops": hops,
        }
        return self._post("/kg/query", payload)

    # -------- internal helpers --------
    def _headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _post(self, path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.endpoint}{path}"
        last_error: Optional[Exception] = None
        for attempt in range(1, self.retries + 1):
            try:
                resp: Response = self.session.post(
                    url,
                    headers=self._headers(),
                    data=json.dumps(payload),
                    timeout=self.timeout,
                )
                if resp.status_code >= 500:
                    raise ZepClientError(f"Zep server error {resp.status_code}: {resp.text}")
                if resp.status_code == 429:
                    raise ZepClientError(f"Zep rate limited: {resp.text}")
                if resp.status_code in (401, 403):
                    raise ZepClientError(f"Zep auth failed: {resp.text}")
                resp.raise_for_status()
                try:
                    return resp.json() if resp.content else {}
                except Exception:
                    return {}
            except Exception as exc:
                last_error = exc
                logger.warning(
                    "zep.post_retry",
                    extra={
                        "attempt": attempt,
                        "path": path,
                        "error": str(exc),
                        "project": self.project,
                    },
                )
                if attempt < self.retries:
                    time.sleep(self.backoff_seconds * attempt)
        raise ZepClientError(f"Zep request failed after retries: {last_error}")
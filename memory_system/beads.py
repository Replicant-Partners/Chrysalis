"""
Beads: short-term/context memory (append-only text blobs).

Implements a local sqlite-backed bead store with optional retention (max_items,
TTL) and optional blob offload hook. See docs/AGENTIC_MEMORY_DESIGN.md.

Now includes optional Fireproof promotion hook for durable storage of
high-importance beads beyond their TTL.
"""

from __future__ import annotations

import asyncio
import json
import logging
import sqlite3
import time
import uuid
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, Iterable, List, Optional, Union

from .fireproof.async_utils import run_async_safely, schedule_async

logger = logging.getLogger(__name__)

# Type for promotion hook - can be sync or async
PromotionHook = Callable[[Dict[str, Any]], Union[Optional[str], Awaitable[Optional[str]]]]


class BeadsService:
    """
    Short-term/context memory using "beads" (append-only text blobs).
    
    Now supports optional promotion of high-importance beads to
    Fireproof for durable storage beyond TTL.
    """

    def __init__(
        self,
        path: Optional[str] = None,
        max_items: Optional[int] = None,
        ttl_seconds: Optional[int] = None,
        blob_offload: Optional[Callable] = None,
        promotion_hook: Optional[PromotionHook] = None,
        promotion_threshold: float = 0.7,
        promotion_async: bool = True,
    ) -> None:
        """
        Initialize the beads store.

        Args:
            path: sqlite file path (defaults to in-memory).
            max_items: Optional cap on retained beads (oldest dropped).
            ttl_seconds: Optional time-to-live; beads older than this are pruned.
            blob_offload: Optional callable to offload large content; should return a URI.
            promotion_hook: Optional callable to promote high-importance beads to Fireproof.
            promotion_threshold: Minimum importance for promotion (0.0-1.0).
            promotion_async: Whether to promote asynchronously (non-blocking).
        """
        self.path = path or ":memory:"
        self.max_items = max_items
        self.ttl_seconds = ttl_seconds
        self.blob_offload = blob_offload
        self.promotion_hook = promotion_hook
        self.promotion_threshold = promotion_threshold
        self.promotion_async = promotion_async
        self._conn = self._get_conn()
        self._init_db()
        self._promotion_count = 0

    @property
    def promotion_count(self) -> int:
        """Get count of beads promoted to Fireproof."""
        return self._promotion_count

    def append(
        self,
        content: str,
        role: str = "user",
        importance: float = 0.5,
        span_refs: Optional[Iterable[str]] = None,
        blob_uri: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        ts: Optional[float] = None,
        skip_promotion: bool = False,
    ) -> str:
        """
        Append a bead (text turn/tool output).

        Args:
            content: Text to record.
            role: Origin role (e.g., user, assistant, tool).
            importance: Importance weighting (0.0-1.0).
            span_refs: Optional references to spans/ids.
            blob_uri: Optional URI if content is offloaded.
            metadata: Optional metadata dict.
            ts: Optional timestamp override (seconds).
            skip_promotion: Skip Fireproof promotion for this bead.
        Returns:
            bead_id
        """
        bead_id = str(uuid.uuid4())
        now = ts or time.time()

        # Offload if requested and no URI provided.
        if self.blob_offload and blob_uri is None:
            try:
                blob_uri = self.blob_offload(content)
            except Exception as exc:
                logger.warning("beads blob_offload failed", extra={"error": str(exc)})

        span_json = json.dumps(list(span_refs) if span_refs else [])
        meta_json = json.dumps(metadata or {})

        conn = self._conn
        conn.execute(
            """
            INSERT INTO beads (bead_id, ts, role, content, importance, span_refs, blob_uri, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (bead_id, now, role, content, importance, span_json, blob_uri, meta_json),
        )
        conn.commit()

        # Promote high-importance beads to Fireproof
        promoted = False
        if (
            not skip_promotion
            and self.promotion_hook
            and importance >= self.promotion_threshold
        ):
            bead_data = {
                "bead_id": bead_id,
                "content": content,
                "role": role,
                "importance": importance,
                "span_refs": list(span_refs) if span_refs else [],
                "blob_uri": blob_uri,
                "metadata": metadata or {},
                "ts": now,
            }
            self._promote_bead(bead_data)
            promoted = True

        pruned = self._prune()
        logger.info(
            "beads.append",
            extra={
                "bead_id": bead_id,
                "role": role,
                "content_len": len(content),
                "pruned": pruned,
                "promoted": promoted,
            },
        )
        return bead_id

    def _promote_bead(self, bead_data: Dict[str, Any]) -> None:
        """
        Promote a bead to Fireproof.
        
        Handles both sync and async promotion hooks using safe async utilities.
        """
        if not self.promotion_hook:
            return
        
        try:
            if self.promotion_async:
                # Fire-and-forget async promotion using safe utilities
                schedule_async(self._promote_bead_async(bead_data))
            else:
                # Synchronous promotion using safe utilities
                result = self.promotion_hook(bead_data)
                if asyncio.iscoroutine(result):
                    run_async_safely(result)
                self._promotion_count += 1
                
        except Exception as exc:
            logger.warning(
                "beads.promotion_failed",
                extra={"bead_id": bead_data.get("bead_id"), "error": str(exc)}
            )

    async def _promote_bead_async(self, bead_data: Dict[str, Any]) -> None:
        """Async promotion helper."""
        try:
            result = self.promotion_hook(bead_data)
            if asyncio.iscoroutine(result):
                await result
            self._promotion_count += 1
            logger.debug(
                "beads.promoted",
                extra={"bead_id": bead_data.get("bead_id")}
            )
        except Exception as exc:
            logger.warning(
                "beads.promotion_failed",
                extra={"bead_id": bead_data.get("bead_id"), "error": str(exc)}
            )

    def recent(
        self,
        limit: int = 20,
        min_importance: Optional[float] = None,
        role: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Fetch recent beads in reverse-chronological order.

        Args:
            limit: Maximum number of beads to return.
            min_importance: Optional importance filter.
            role: Optional role filter.

        Returns:
            List of bead dicts.
        """
        clauses = []
        params: List[Any] = []
        if min_importance is not None:
            clauses.append("importance >= ?")
            params.append(min_importance)
        if role:
            clauses.append("role = ?")
            params.append(role)
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        query = f"""
            SELECT bead_id, ts, role, content, importance, span_refs, blob_uri, metadata
            FROM beads
            {where}
            ORDER BY ts DESC
            LIMIT ?
        """
        params.append(limit)
        rows = self._conn.execute(query, params).fetchall()
        results: List[Dict[str, Any]] = [
            {
                "bead_id": row[0],
                "ts": row[1],
                "role": row[2],
                "content": row[3],
                "importance": row[4],
                "span_refs": json.loads(row[5]) if row[5] else [],
                "blob_uri": row[6],
                "metadata": json.loads(row[7]) if row[7] else {},
            }
            for row in rows
        ]
        return results

    def reset(self) -> None:
        """
        Clear all beads.
        """
        self._conn.execute("DELETE FROM beads")
        self._conn.commit()

    def _get_conn(self) -> sqlite3.Connection:
        return sqlite3.connect(self.path, check_same_thread=False)

    def _init_db(self) -> None:
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS beads (
                bead_id TEXT PRIMARY KEY,
                ts REAL NOT NULL,
                role TEXT,
                content TEXT,
                importance REAL,
                span_refs TEXT,
                blob_uri TEXT,
                metadata TEXT
            )
            """
        )
        self._conn.execute("CREATE INDEX IF NOT EXISTS idx_beads_ts ON beads(ts DESC)")
        self._conn.execute("CREATE INDEX IF NOT EXISTS idx_beads_role ON beads(role)")
        self._conn.execute("CREATE INDEX IF NOT EXISTS idx_beads_importance ON beads(importance)")
        self._conn.commit()

    def _prune(self) -> Dict[str, int]:
        """
        Apply retention (max_items, ttl) and return counts of pruned items.
        """
        pruned = {"ttl": 0, "max": 0}
        now = time.time()

        if self.ttl_seconds:
            cutoff = now - self.ttl_seconds
            cur = self._conn.execute("DELETE FROM beads WHERE ts < ?", (cutoff,))
            pruned["ttl"] = cur.rowcount or 0

        if self.max_items:
            cur = self._conn.execute("SELECT bead_id FROM beads ORDER BY ts DESC LIMIT -1 OFFSET ?", (self.max_items,))
            if old_ids := [row[0] for row in cur.fetchall()]:
                self._conn.executemany("DELETE FROM beads WHERE bead_id = ?", [(bid,) for bid in old_ids])
                pruned["max"] = len(old_ids)

        if pruned["ttl"] or pruned["max"]:
            self._conn.commit()
        return pruned
"""
Beads: short-term/context memory (append-only text blobs).

Implements a local sqlite-backed bead store with optional retention (max_items,
TTL) and optional blob offload hook. See docs/AGENTIC_MEMORY_DESIGN.md.
"""

from __future__ import annotations

import json
import logging
import sqlite3
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

logger = logging.getLogger(__name__)


class BeadsService:
    """
    Short-term/context memory using "beads" (append-only text blobs).
    """

    def __init__(
        self,
        path: Optional[str] = None,
        max_items: Optional[int] = None,
        ttl_seconds: Optional[int] = None,
        blob_offload: Optional[callable] = None,
    ) -> None:
        """
        Initialize the beads store.

        Args:
            path: sqlite file path (defaults to in-memory).
            max_items: Optional cap on retained beads (oldest dropped).
            ttl_seconds: Optional time-to-live; beads older than this are pruned.
            blob_offload: Optional callable to offload large content; should return a URI.
        """
        self.path = path or ":memory:"
        self.max_items = max_items
        self.ttl_seconds = ttl_seconds
        self.blob_offload = blob_offload
        self._conn = self._get_conn()
        self._init_db()

    def append(
        self,
        content: str,
        role: str = "user",
        importance: float = 0.5,
        span_refs: Optional[Iterable[str]] = None,
        blob_uri: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        ts: Optional[float] = None,
    ) -> str:
        """
        Append a bead (text turn/tool output).

        Args:
            content: Text to record.
            role: Origin role (e.g., user, assistant, tool).
            importance: Importance weighting.
            span_refs: Optional references to spans/ids.
            blob_uri: Optional URI if content is offloaded.
            metadata: Optional metadata dict.
            ts: Optional timestamp override (seconds).
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

        pruned = self._prune()
        logger.info(
            "beads.append",
            extra={
                "bead_id": bead_id,
                "role": role,
                "content_len": len(content),
                "pruned": pruned,
            },
        )
        return bead_id

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
        results: List[Dict[str, Any]] = []
        for row in rows:
            results.append(
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
            )
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
            old_ids = [row[0] for row in cur.fetchall()]
            if old_ids:
                self._conn.executemany("DELETE FROM beads WHERE bead_id = ?", [(bid,) for bid in old_ids])
                pruned["max"] = len(old_ids)

        if pruned["ttl"] or pruned["max"]:
            self._conn.commit()
        return pruned
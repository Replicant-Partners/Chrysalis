from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import os
import sqlite3
import json
import threading
import logging

logger = logging.getLogger(__name__)


@dataclass
class ToolCall:
    """Record of a single tool invocation with cost and performance metrics."""
    tool: str
    cost: float
    latency_ms: Optional[float]
    success: bool
    new_facts: int
    error: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class TelemetryRecorder:
    """
    Persistent telemetry recorder (SQLite).

    Thread-safe implementation with proper connection management.
    
    Tables:
      - telemetry: per-tool call metrics (timestamp, tool, cost, latency_ms, success, new_facts, error, meta)
      - eval_metrics: evaluation scores (timestamp, run_id, metric, score, meta)
    """

    def __init__(self, db_path: str = "./data/telemetry.db") -> None:
        os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)
        self.db_path = db_path
        self._local = threading.local()
        self._init_schema()
        self.calls: List[ToolCall] = []

    @property
    def _conn(self) -> sqlite3.Connection:
        """Thread-local connection for thread safety."""
        if not hasattr(self._local, "conn") or self._local.conn is None:
            self._local.conn = sqlite3.connect(self.db_path, check_same_thread=False)
            self._local.conn.row_factory = sqlite3.Row
        return self._local.conn

    def _init_schema(self) -> None:
        """Initialize database schema with both tables."""
        conn = self._conn
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS telemetry (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                tool TEXT NOT NULL,
                cost REAL,
                latency_ms REAL,
                success INTEGER,
                new_facts INTEGER,
                error TEXT,
                meta TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS eval_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                run_id TEXT NOT NULL,
                metric TEXT NOT NULL,
                score REAL,
                meta TEXT
            )
            """
        )
        # Add indexes for common queries
        conn.execute("CREATE INDEX IF NOT EXISTS idx_telemetry_tool ON telemetry(tool)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry(timestamp)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_eval_run_id ON eval_metrics(run_id)")
        conn.commit()

    def record(self, call: ToolCall) -> None:
        """Record a tool call to both in-memory list and persistent storage."""
        self.calls.append(call)
        try:
            self._conn.execute(
                """
                INSERT INTO telemetry (timestamp, tool, cost, latency_ms, success, new_facts, error, meta)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    call.timestamp.isoformat(),
                    call.tool,
                    call.cost,
                    call.latency_ms,
                    1 if call.success else 0,
                    call.new_facts,
                    call.error,
                    json.dumps(call.meta) if call.meta else None,
                ),
            )
            self._conn.commit()
        except sqlite3.Error as e:
            logger.warning("Failed to persist telemetry: %s", e)

    def summary(self) -> Dict[str, Any]:
        """Aggregate in-memory calls by tool."""
        summary: Dict[str, Dict[str, float]] = {}
        for call in self.calls:
            if call.tool not in summary:
                summary[call.tool] = {"cost": 0.0, "calls": 0, "success": 0, "new_facts": 0, "total_latency_ms": 0.0}
            summary[call.tool]["cost"] += call.cost
            summary[call.tool]["calls"] += 1
            summary[call.tool]["success"] += 1 if call.success else 0
            summary[call.tool]["new_facts"] += call.new_facts
            if call.latency_ms:
                summary[call.tool]["total_latency_ms"] += call.latency_ms
        # Calculate average latency
        for tool_stats in summary.values():
            if tool_stats["calls"] > 0:
                tool_stats["avg_latency_ms"] = tool_stats["total_latency_ms"] / tool_stats["calls"]
            del tool_stats["total_latency_ms"]
        return summary

    def export(self, path: str) -> None:
        """Export in-memory calls to JSONL for quick inspection."""
        with open(path, "w") as f:
            for call in self.calls:
                f.write(
                    json.dumps(
                        {
                            "tool": call.tool,
                            "cost": call.cost,
                            "latency_ms": call.latency_ms,
                            "success": call.success,
                            "new_facts": call.new_facts,
                            "error": call.error,
                            "meta": call.meta,
                            "timestamp": call.timestamp.isoformat(),
                        }
                    )
                    + "\n"
                )

    def record_eval(self, run_id: str, metrics: Dict[str, float], meta: Optional[Dict[str, Any]] = None) -> None:
        """
        Persist evaluation metrics (e.g., judge scores) to SQLite.
        
        Args:
            run_id: Unique identifier for this evaluation run
            metrics: Dict of metric_name -> score
            meta: Optional metadata (model, backend, etc.)
        """
        ts = datetime.now(timezone.utc).isoformat()
        try:
            for metric, score in metrics.items():
                self._conn.execute(
                    """
                    INSERT INTO eval_metrics (timestamp, run_id, metric, score, meta)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (ts, run_id, metric, score, json.dumps(meta) if meta else None),
                )
            self._conn.commit()
        except sqlite3.Error as e:
            logger.warning("Failed to persist eval metrics: %s", e)

    def get_recent_calls(self, limit: int = 100, tool: Optional[str] = None) -> List[Dict[str, Any]]:
        """Query recent telemetry records from persistent storage."""
        query = "SELECT * FROM telemetry"
        params: List[Any] = []
        if tool:
            query += " WHERE tool = ?"
            params.append(tool)
        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)
        
        cursor = self._conn.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]

    def get_eval_history(self, run_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        """Query evaluation history from persistent storage."""
        query = "SELECT * FROM eval_metrics"
        params: List[Any] = []
        if run_id:
            query += " WHERE run_id = ?"
            params.append(run_id)
        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)
        
        cursor = self._conn.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]

    def clear_session(self) -> None:
        """Clear in-memory calls (does not affect persistent storage)."""
        self.calls.clear()

    def close(self) -> None:
        """Close database connection."""
        if hasattr(self._local, "conn") and self._local.conn:
            self._local.conn.close()
            self._local.conn = None

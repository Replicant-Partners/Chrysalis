"""
Universal Adapter JSONL Logger

Writes structured run metadata to disk for later aggregation by agents.
"""

from __future__ import annotations
import json
import os
from pathlib import Path
from typing import Any, Mapping, Sequence
from datetime import datetime, timezone

LOG_DIR = Path(os.environ.get("UNIVERSAL_ADAPTER_LOG_DIR", "logs/universal_adapter"))
RUN_LOG = LOG_DIR / "adapter_runs.jsonl"


def _ensure_log_dir() -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _truncate(value: Any, max_len: int = 4000) -> Any:
    """Best-effort truncation to keep log lines bounded."""
    try:
        s = json.dumps(value)
        if len(s) > max_len:
            return json.loads(s[:max_len])
        return value
    except Exception:
        text = str(value)
        return text[:max_len] + ("…" if len(text) > max_len else "")


def log_run_event(event: Mapping[str, Any]) -> None:
    """
    Append a single run event to JSONL log.

    Errors are swallowed to avoid impacting execution.
    """
    try:
        _ensure_log_dir()
        payload = dict(event)
        payload["@timestamp"] = payload.get("@timestamp") or _iso_now()
        payload = {k: _truncate(v) for k, v in payload.items()}
        with RUN_LOG.open("a", encoding="utf-8") as f:
            f.write(json.dumps(payload, ensure_ascii=False))
            f.write("\n")
    except Exception:
        # Logging must not break execution
        return

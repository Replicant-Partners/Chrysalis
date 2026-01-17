"""
Universal Adapter JSONL Logger

Writes structured run metadata to disk for later aggregation by agents.
"""

from __future__ import annotations
import json
import hashlib
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


def _shrink(value: Any, *, max_len: int = 4000, max_items: int = 50, depth: int = 0) -> Any:
    """
    Best-effort payload shrinking to keep log lines bounded and avoid dumping vectors.

    - Long strings are truncated.
    - Numeric sequences (likely embeddings) are summarized with length+checksum.
    - Large containers are sampled to avoid blow-ups.
    """
    if depth > 3:
        return "<truncated-depth>"

    if value is None or isinstance(value, (bool, int, float)):
        return value

    if isinstance(value, str):
        return value if len(value) <= max_len else value[:max_len] + "…"

    if isinstance(value, Sequence) and not isinstance(value, (bytes, bytearray, str)):
        seq = list(value)
        if all(isinstance(x, (int, float)) for x in seq) and len(seq) > 10:
            checksum = hashlib.sha256(",".join(f"{v:.6f}" for v in seq).encode()).hexdigest()[:12]
            return {"type": "vector", "length": len(seq), "checksum": checksum}
        if len(seq) > max_items:
            sample = [_shrink(x, max_len=max_len, max_items=max_items, depth=depth + 1) for x in seq[:10]]
            return {"type": "list", "length": len(seq), "sample": sample}
        return [_shrink(x, max_len=max_len, max_items=max_items, depth=depth + 1) for x in seq]

    if isinstance(value, Mapping):
        items = list(value.items())
        if len(items) > max_items:
            items = items[:max_items]
        return {
            k: _shrink(v, max_len=max_len, max_items=max_items, depth=depth + 1)
            for k, v in items
        }

    try:
        # Fallback: ensure the serialized form stays under bounds
        s = str(value)
        return s if len(s) <= max_len else s[:max_len] + "…"
    except Exception:
        return "<unserializable>"


def log_run_event(event: Mapping[str, Any]) -> None:
    """
    Append a single run event to JSONL log.

    Errors are swallowed to avoid impacting execution.
    """
    try:
        _ensure_log_dir()
        payload = dict(event)
        payload["@timestamp"] = payload.get("@timestamp") or _iso_now()
        payload = {k: _shrink(v) for k, v in payload.items()}
        with RUN_LOG.open("a", encoding="utf-8") as f:
            f.write(json.dumps(payload, ensure_ascii=False))
            f.write("\n")
    except Exception:
        # Logging must not break execution
        return

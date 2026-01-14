"""
Telemetry reading and utility functions.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterator, Optional

from skill_builder.pipeline.models import TelemetryEvent

from .core import TelemetryWriter


def emit_structured(
    event_type: str,
    data: dict[str, Any] | None = None,
    telemetry: Optional[TelemetryWriter] = None,
) -> None:
    """Emit a structured telemetry event or print JSON.

    Keeps code changes minimal: when a TelemetryWriter is provided, write to
    telemetry.jsonl; otherwise, print JSONL to stdout for ad-hoc inspection.
    """
    payload = TelemetryEvent(event_type, data=data or {})
    if telemetry:
        telemetry.emit(payload)
        return
    print(payload.to_jsonl())


def _event_data(event: dict[str, Any]) -> dict[str, Any]:
    """Return event payload data for both nested and flattened schemas."""
    data = event.get("data")
    if isinstance(data, dict):
        return data
    return {k: v for k, v in event.items() if k not in {"event", "ts"}}


def read_telemetry(path: Path) -> Iterator[dict[str, Any]]:
    """Read telemetry JSONL file as event dictionaries.
    
    Useful for post-hoc analysis and debugging.
    """
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            if line := line.strip():
                yield json.loads(line)


def filter_events(events: Iterator[dict[str, Any]], event_type: str) -> Iterator[dict[str, Any]]:
    """Filter telemetry events by type prefix."""
    for event in events:
        if event.get("event", "").startswith(event_type):
            yield event


def summarize_run(path: Path) -> dict[str, Any]:
    """Generate summary statistics from a telemetry file.

    Useful for calibration and quality indicators.
    """
    events = list(read_telemetry(path))

    def get(e: dict[str, Any], key: str, default: Any = 0) -> Any:
        if key in e:
            return e.get(key, default)
        return _event_data(e).get(key, default)

    summary: dict[str, Any] = {
        "total_events": len(events),
        "has_start": any(e.get("event") == "run.start" for e in events),
        "has_done": any(e.get("event") == "run.done" for e in events),
        "has_error": any(e.get("event") == "run.error" for e in events),
        "query_count": sum(bool(e.get("event") == "search.query.done") for e in events),
        "total_hits": sum(get(e, "hits_total", 0) for e in events if e.get("event") == "search.query.done"),
        "total_kept": sum(get(e, "hits_kept", 0) for e in events if e.get("event") == "search.query.done"),
        "duration_ms": next((get(e, "duration_ms", 0.0) for e in events if e.get("event") == "run.done"), 0.0),
        "run_id": next((get(e, "run_id", None) for e in events if e.get("event") in {"run.start", "run.done", "run.error"}), None),
    }

    start_evt = next((e for e in events if e.get("event") == "run.start"), None)
    if start_evt:
        summary["spec_summary"] = _event_data(start_evt).get("spec_summary", {})

    query_events = [e for e in events if e.get("event") == "search.query.done"]
    if query_events:
        summary["avg_dedupe_ratio"] = sum(float(get(e, "dedupe_ratio", 0.0)) for e in query_events) / len(query_events)

    quality_events = [e for e in events if (e.get("event", "") or "").startswith("quality.")]
    if quality_events:
        avg_conf = [float(_event_data(e).get("avg_confidence", 0.0)) for e in quality_events if "avg_confidence" in _event_data(e)]
        if avg_conf:
            summary["avg_confidence"] = sum(avg_conf) / len(avg_conf)

    satisfaction_evt = next((e for e in events if (e.get("event") or "") == "user.outcome.satisfaction"), None)
    if satisfaction_evt:
        summary["user_satisfaction"] = float(_event_data(satisfaction_evt).get("satisfaction_score", 0.0) or 0.0)

    return summary

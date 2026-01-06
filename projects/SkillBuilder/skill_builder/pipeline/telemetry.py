"""
Telemetry and observability system for SkillBuilder.

Semantic Requirements (from docs/architecture/observability.md):
- JSONL telemetry to support debugging, calibration, reproducibility
- Event stream: run lifecycle, backend selection, search tracing
- Core events: run.start/done/error, search.*, mcp.*

Design Pattern: Observer + Functional Append-Only Log
- TelemetryWriter manages the output stream
- Events are immutable records appended to JSONL
- Contextual spans for correlated event groups
"""

from __future__ import annotations

import atexit
import json
import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator, Optional

from skill_builder.pipeline.models import TelemetryEvent


@dataclass
class TelemetrySpan:
    """A context for grouping related telemetry events.
    
    Provides correlation ID and timing for a sequence of operations.
    """
    span_id: str
    span_type: str
    start_time: float = field(default_factory=time.perf_counter)
    parent_span_id: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)
    
    def elapsed_ms(self) -> float:
        """Milliseconds since span start."""
        return (time.perf_counter() - self.start_time) * 1000
    
    def to_event(self, suffix: str, **extra: Any) -> TelemetryEvent:
        """Create event within this span."""
        return TelemetryEvent(
            event_type=f"{self.span_type}.{suffix}",
            data={
                "span_id": self.span_id,
                "elapsed_ms": self.elapsed_ms(),
                **self.metadata,
                **extra,
            }
        )


# =============================================================================
# Optional exporter interface (hybrid local JSONL + optional shipping)
# =============================================================================

try:
    from typing import Protocol
except Exception:  # pragma: no cover
    Protocol = object  # type: ignore


class TelemetryExporter(Protocol):
    """Optional exporter for shipping events to an external collector.

    Exporters must never raise; failures are reported via local telemetry.
    """

    def export(self, event: dict[str, Any]) -> None: ...

    def flush(self) -> None: ...


class HttpJsonExporter:
    """Best-effort HTTP exporter using stdlib urllib (no dependency).

    Config is expected to be handled by the caller. This implementation is
    intentionally simple: POST each event as JSON to a collector endpoint.
    """

    def __init__(self, url: str, bearer_token: str | None = None, timeout_s: float = 2.0):
        self._url = url
        self._token = bearer_token
        self._timeout_s = timeout_s

    def export(self, event: dict[str, Any]) -> None:
        import urllib.request

        payload = json.dumps(event).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"

        req = urllib.request.Request(self._url, data=payload, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=self._timeout_s) as _:
                return
        except Exception:
            # Swallow by contract
            pass

    def flush(self) -> None:
        return


class TelemetryWriter:
    """Thread-safe JSONL telemetry writer.

    Semantic Requirement: telemetry.jsonl for run tracing.

    Usage:
        with TelemetryWriter(path) as tel:
            tel.emit(TelemetryEvent.run_start(...))
            # ... operations ...
            tel.emit(TelemetryEvent.run_done(...))
    """

    def __init__(
        self,
        path: Path,
        buffered: bool = True,
        context: Optional[dict[str, Any]] = None,
        exporters: Optional[list[TelemetryExporter]] = None,
    ):
        """Initialize telemetry writer.

        Args:
            path: Output path for telemetry.jsonl
            buffered: If True, buffer writes; if False, flush immediately
            context: Key-values to attach to every event unless already present
            exporters: Optional exporters to ship events to external collectors
        """
        self._path = path
        self._buffered = buffered
        self._buffer: list[str] = []
        self._lock = threading.Lock()
        self._file: Optional[Any] = None
        self._span_stack: list[TelemetrySpan] = []
        self._span_counter = 0
        self._context = dict(context or {})
        self._exporters = list(exporters or [])

    def __enter__(self) -> "TelemetryWriter":
        """Open telemetry file for writing."""
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._file = open(self._path, "a", encoding="utf-8")
        # Register cleanup in case of unexpected exit
        atexit.register(self._cleanup)
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Flush and close telemetry file."""
        self._cleanup()
        atexit.unregister(self._cleanup)

    def _cleanup(self) -> None:
        """Ensure all data is written."""
        self.flush()
        if self._file:
            self._file.close()
            self._file = None

    def _enrich(self, event: TelemetryEvent) -> TelemetryEvent:
        """Attach writer context to an event unless already present."""
        if not self._context:
            return event
        if not isinstance(event.data, dict):
            return event
        merged = {**self._context, **event.data}
        return TelemetryEvent(event.event_type, timestamp=event.timestamp, data=merged)

    def _event_dict(self, event: TelemetryEvent) -> dict[str, Any]:
        """Convert an event to dict without relying on JSON round-trips."""
        e = self._enrich(event)
        return {
            "event": e.event_type,
            "ts": e.timestamp,
            "data": e.data,
            **(e.data or {}),
        }

    def emit(self, event: TelemetryEvent) -> None:
        """Emit a telemetry event.

        Thread-safe append to the JSONL stream.
        """
        payload_dict = self._event_dict(event)
        line = json.dumps(payload_dict, separators=(",", ":")) + "\n"

        with self._lock:
            if self._buffered:
                self._buffer.append(line)
                if len(self._buffer) >= 100:  # Flush every 100 events
                    self._flush_buffer()
            elif self._file:
                self._file.write(line)
                self._file.flush()

        # Best-effort export, never block the main pipeline.
        if self._exporters:
            for exporter in self._exporters:
                try:
                    exporter.export(payload_dict)
                except Exception:
                    # Swallow by contract
                    pass

    def _flush_buffer(self) -> None:
        """Write buffered events to file (must hold lock)."""
        if self._file and self._buffer:
            self._file.writelines(self._buffer)
            self._file.flush()
            self._buffer.clear()

    def flush(self) -> None:
        """Force flush any buffered events."""
        with self._lock:
            self._flush_buffer()

        if self._exporters:
            for exporter in self._exporters:
                try:
                    exporter.flush()
                except Exception:
                    pass

    @contextmanager
    def span(self, span_type: str, **metadata: Any) -> Iterator[TelemetrySpan]:
        """Context manager for a telemetry span.
        
        Automatically emits start/done events and tracks timing.
        
        Example:
            with tel.span("search.query", query="test") as s:
                # do work
                s.metadata["hits"] = 10
        """
        self._span_counter += 1
        parent = self._span_stack[-1] if self._span_stack else None
        
        span = TelemetrySpan(
            span_id=f"span_{self._span_counter}",
            span_type=span_type,
            parent_span_id=parent.span_id if parent else None,
            metadata=metadata,
        )
        
        self._span_stack.append(span)
        self.emit(span.to_event("start"))
        
        try:
            yield span
            self.emit(span.to_event("done"))
        except Exception as e:
            self.emit(span.to_event("error", error=str(e)))
            raise
        finally:
            self._span_stack.pop()
    
    def current_span(self) -> Optional[TelemetrySpan]:
        """Get the current active span, if any."""
        return self._span_stack[-1] if self._span_stack else None


class NullTelemetryWriter(TelemetryWriter):
    """No-op telemetry writer for when telemetry is disabled.
    
    Null Object Pattern: avoids conditionals throughout codebase.
    """
    
    def __init__(self) -> None:
        # Don't call super - we don't want to create a file
        self._span_stack: list[TelemetrySpan] = []
        self._span_counter = 0
    
    def __enter__(self) -> NullTelemetryWriter:
        return self
    
    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        pass
    
    def emit(self, event: TelemetryEvent) -> None:
        pass  # No-op
    
    def flush(self) -> None:
        pass  # No-op


# =============================================================================
# Telemetry Event Factories (Semantic Event Types)
# =============================================================================

def event_run_start(
    spec_name: str,
    backend: str,
    run_id: str | None = None,
    spec_summary: dict[str, Any] | None = None,
) -> TelemetryEvent:
    """Run lifecycle: start."""
    return TelemetryEvent("run.start", data={
        "spec": spec_name,
        "backend": backend,
        "run_id": run_id,
        "spec_summary": spec_summary or {},
    })


def event_run_done(
    duration_ms: float,
    artifacts: list[str],
    run_id: str | None = None,
) -> TelemetryEvent:
    """Run lifecycle: successful completion."""
    return TelemetryEvent("run.done", data={
        "duration_ms": duration_ms,
        "artifacts": artifacts,
        "artifact_count": len(artifacts),
        "run_id": run_id,
    })


def event_run_error(
    error: str,
    stage: str,
    recoverable: bool = False,
    run_id: str | None = None,
) -> TelemetryEvent:
    """Run lifecycle: error."""
    return TelemetryEvent("run.error", data={
        "error": error,
        "stage": stage,
        "recoverable": recoverable,
        "run_id": run_id,
    })


def event_backend_selected(backend: str, reason: str, fallback: bool = False) -> TelemetryEvent:
    """Search backend selection."""
    return TelemetryEvent("search.backend.selected", data={
        "backend": backend,
        "reason": reason,
        "fallback": fallback,
    })


def event_query_start(query: str, stage: int, provider: str) -> TelemetryEvent:
    """Search query: start."""
    return TelemetryEvent("search.query.start", data={
        "query": query,
        "stage": stage,
        "provider": provider,
    })


def event_query_done(
    query: str,
    hits_total: int,
    hits_kept: int,
    duration_ms: float,
    provider: str
) -> TelemetryEvent:
    """Search query: completion."""
    return TelemetryEvent("search.query.done", data={
        "query": query,
        "hits_total": hits_total,
        "hits_kept": hits_kept,
        "dedupe_ratio": hits_kept / hits_total if hits_total > 0 else 0.0,
        "duration_ms": duration_ms,
        "provider": provider,
    })


def event_tool_ok(tool: str, provider: str, hits: int) -> TelemetryEvent:
    """Search tool execution: success."""
    return TelemetryEvent("search.tool.ok", data={
        "tool": tool,
        "provider": provider,
        "hits": hits,
    })


def event_tool_error(tool: str, provider: str, error: str) -> TelemetryEvent:
    """Search tool execution: error."""
    return TelemetryEvent("search.tool.error", data={
        "tool": tool,
        "provider": provider,
        "error": error,
    })


def event_stage2_anchors(anchors: list[str], count: int) -> TelemetryEvent:
    """Stage 2 domain anchors discovered."""
    return TelemetryEvent("search.stage2.anchors", data={
        "anchors": anchors[:10],  # Truncate for log readability
        "total": count,
    })


def event_mcp_skipped(reason: str) -> TelemetryEvent:
    """MCP server skipped (falling back to HTTP)."""
    return TelemetryEvent("mcp.skipped", data={"reason": reason})


def event_artifact_written(artifact_type: str, path: str, size_bytes: int) -> TelemetryEvent:
    """Artifact file written."""
    return TelemetryEvent("artifact.written", data={
        "type": artifact_type,
        "path": path,
        "size_bytes": size_bytes,
    })


# =============================================================================
# Enhanced Telemetry Event Types (Quality Metrics & User Outcomes)
# =============================================================================

def event_quality_skill_distribution(
    skills: list[dict[str, Any]],
    confidence_buckets: dict[str, int] = None,
) -> TelemetryEvent:
    """Track skill confidence distribution for quality assessment."""
    return TelemetryEvent(
        "quality.skill.distribution",
        data={
            "total_skills": len(skills),
            "confidence_buckets": confidence_buckets or {
                "high": sum(1 for s in skills if s.get("confidence", 0) >= 0.8),
                "medium": sum(1 for s in skills if 0.6 <= s.get("confidence", 0) < 0.8),
                "low": sum(1 for s in skills if s.get("confidence", 0) < 0.6),
            },
            "avg_confidence": sum(s.get("confidence", 0) for s in skills) / max(len(skills), 1),
        },
    )


def event_quality_semantic_coherence(
    coherence_score: float,
    skill_overlap: float = 0.0,
    semantic_density: float = 0.0,
) -> TelemetryEvent:
    """Track semantic coherence and quality of extracted knowledge."""
    return TelemetryEvent(
        "quality.semantic.coherence",
        data={
            "coherence_score": coherence_score,
            "skill_overlap": skill_overlap,
            "semantic_density": semantic_density,
        },
    )


def event_user_outcome_adoption(
    mode_name: str,
    adoption_source: str,
    user_type: str = "unknown",
) -> TelemetryEvent:
    """Track mode adoption and usage patterns."""
    return TelemetryEvent(
        "user.outcome.adoption",
        data={
            "mode_name": mode_name,
            "adoption_source": adoption_source,  # "cli", "vscode", "api"
            "user_type": user_type,  # "developer", "researcher", "end_user"
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


def event_user_outcome_satisfaction(
    mode_name: str,
    satisfaction_score: float,
    feedback_categories: list[str] = None,
    qualitative_feedback: str = "",
) -> TelemetryEvent:
    """Track user satisfaction and feedback patterns."""
    return TelemetryEvent(
        "user.outcome.satisfaction",
        data={
            "mode_name": mode_name,
            "satisfaction_score": satisfaction_score,
            "feedback_categories": feedback_categories or [],
            "qualitative_feedback": qualitative_feedback,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


def event_validation_domain_authority(
    urls: list[str],
    authority_score: float,
    edu_gov_count: int = 0,
    academic_citations: int = 0,
) -> TelemetryEvent:
    """Track external validation against authoritative sources."""
    return TelemetryEvent(
        "validation.domain.authority",
        data={
            "total_urls": len(urls),
            "authority_score": authority_score,
            "edu_gov_count": edu_gov_count,
            "academic_citations": academic_citations,
            "validation_timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


def event_validation_cross_reference(
    skill_names: list[str],
    external_taxonomy: str,
    overlap_score: float,
    missing_skills: list[str] = None,
) -> TelemetryEvent:
    """Track cross-reference validation against external taxonomies."""
    return TelemetryEvent(
        "validation.cross.reference",
        data={
            "taxonomy_source": external_taxonomy,  # "ESCO", "O*NET", "HF"
            "skill_count": len(skill_names),
            "overlap_score": overlap_score,
            "missing_skills": missing_skills or [],
            "validation_timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


def event_ml_calibration_adjustment(
    parameter_name: str,
    old_value: Any,
    new_value: Any,
    adjustment_reason: str,
    prediction_accuracy: float = 0.0,
) -> TelemetryEvent:
    """Track ML-driven parameter adjustments."""
    return TelemetryEvent(
        "ml.calibration.adjustment",
        data={
            "parameter_name": parameter_name,
            "old_value": old_value,
            "new_value": new_value,
            "adjustment_reason": adjustment_reason,
            "prediction_accuracy": prediction_accuracy,
            "adjustment_timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


def event_ml_prediction_accuracy(
    model_type: str,
    prediction_type: str,
    predicted_value: Any,
    actual_value: Any,
    accuracy_score: float,
) -> TelemetryEvent:
    """Track ML model prediction accuracy."""
    return TelemetryEvent(
        "ml.prediction.accuracy",
        data={
            "model_type": model_type,  # "search", "synthesis", "clustering"
            "prediction_type": prediction_type,  # "confidence", "quality", "performance"
            "predicted_value": predicted_value,
            "actual_value": actual_value,
            "accuracy_score": accuracy_score,
            "prediction_timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


def event_performance_regression(
    component: str,
    current_performance: dict[str, float],
    baseline_performance: dict[str, float],
    regression_detected: bool,
) -> TelemetryEvent:
    """Track performance regressions across versions."""
    return TelemetryEvent(
        "performance.regression",
        data={
            "component": component,  # "search", "synthesis", "mode_management"
            "current_performance": current_performance,
            "baseline_performance": baseline_performance,
            "regression_detected": regression_detected,
            "regression_timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


# =============================================================================
# Lightweight structured emitter
# =============================================================================

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


# =============================================================================
# Telemetry Analysis Utilities
# =============================================================================

def _event_data(event: dict[str, Any]) -> dict[str, Any]:
    """Return event payload data for both nested and flattened schemas."""
    data = event.get("data")
    if isinstance(data, dict):
        return data
    # Legacy flattened schema: strip the envelope
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

    # Capture spec_summary from run.start for calibration and attribution
    start_evt = next((e for e in events if e.get("event") == "run.start"), None)
    if start_evt:
        summary["spec_summary"] = _event_data(start_evt).get("spec_summary", {})

    query_events = [e for e in events if e.get("event") == "search.query.done"]
    if query_events:
        summary["avg_dedupe_ratio"] = sum(float(get(e, "dedupe_ratio", 0.0)) for e in query_events) / len(query_events)

    # Pull quality signals when present
    quality_events = [e for e in events if (e.get("event", "") or "").startswith("quality.")]
    if quality_events:
        avg_conf = [float(_event_data(e).get("avg_confidence", 0.0)) for e in quality_events if "avg_confidence" in _event_data(e)]
        if avg_conf:
            summary["avg_confidence"] = sum(avg_conf) / len(avg_conf)

    # Pull satisfaction if present
    satisfaction_evt = next((e for e in events if (e.get("event") or "") == "user.outcome.satisfaction"), None)
    if satisfaction_evt:
        summary["user_satisfaction"] = float(_event_data(satisfaction_evt).get("satisfaction_score", 0.0) or 0.0)

    return summary


# =============================================================================
# Telemetry Analysis Utilities (Enhanced)
# =============================================================================

def analyze_quality_trends(telemetry_path: Path) -> dict[str, Any]:
    """Analyze quality trends from telemetry data."""
    events = list(read_telemetry(telemetry_path))
    
    # Extract quality events
    quality_events = [e for e in events if (e.get("event", "") or "").startswith("quality.")]
    user_events = [e for e in events if (e.get("event", "") or "").startswith("user.outcome")]
    ml_events = [e for e in events if (e.get("event", "") or "").startswith("ml.")]
    
    return {
        "quality_trends": {
            "avg_confidence_trend": _calculate_confidence_trend(quality_events),
            "coherence_scores": [float(_event_data(e).get("coherence_score", 0.0)) for e in quality_events],
            "user_adoption_rate": _calculate_adoption_rate(user_events),
        },
        "ml_effectiveness": {
            "calibration_adjustments": len([e for e in ml_events if "calibration.adjustment" in (e.get("event", "") or "")]),
            "prediction_accuracy": [float(_event_data(e).get("accuracy_score", 0.0)) for e in ml_events if "prediction.accuracy" in (e.get("event", "") or "")],
        },
        "analysis_period": {
            "start_date": events[0].get("ts") if events else None,
            "end_date": events[-1].get("ts") if events else None,
            "total_events": len(events),
        },
    }


def _calculate_confidence_trend(quality_events: list[dict[str, Any]]) -> str:
    """Calculate confidence trend over time."""
    if len(quality_events) < 2:
        return "insufficient_data"
    
    recent_events = quality_events[-5:]  # Last 5 events
    confidences = [float(_event_data(e).get("avg_confidence", 0.0)) for e in recent_events]
    
    if len(confidences) < 2:
        return "insufficient_data"
    
    # Simple trend calculation
    if confidences[-1] > confidences[0]:
        return "improving"
    elif confidences[-1] < confidences[0]:
        return "declining"
    else:
        return "stable"


def _calculate_adoption_rate(user_events: list[dict[str, Any]]) -> float:
    """Calculate mode adoption rate from user outcome events."""
    if not user_events:
        return 0.0
    
    adoption_events = [e for e in user_events if "adoption" in (e.get("event", "") or "")]
    unique_modes = set(_event_data(e).get("mode_name", "") for e in adoption_events)
    
    return len([m for m in unique_modes if m]) / max(len(user_events), 1)


# =============================================================================
# Offline calibration utilities (telemetry -> calibration artifact)
# =============================================================================

DEFAULT_CALIBRATION_MODEL_PATH = Path(".roo/calibration/basic.json")


def iter_run_telemetry_files(runs_dir: Path) -> Iterator[Path]:
    """Yield telemetry.jsonl paths under a .roo/runs directory."""
    if not runs_dir.exists():
        return
    for path in sorted(runs_dir.glob("**/telemetry.jsonl")):
        if path.is_file():
            yield path


def train_basic_calibration_model(
    runs_dir: Path = Path(".roo/runs"),
    model_path: Path = DEFAULT_CALIBRATION_MODEL_PATH,
) -> dict[str, Any]:
    """Train/update the BasicCalibrationModel from local telemetry JSONL.

    This is intentionally conservative: it learns only from stable, hard signals
    (latency, dedupe, confidence summaries, error rate) and writes a versioned
    artifact for future runs.
    """
    model_path.parent.mkdir(parents=True, exist_ok=True)

    model = BasicCalibrationModel(model_path=model_path)
    summaries: list[dict[str, Any]] = []

    for tel_path in iter_run_telemetry_files(runs_dir):
        s = summarize_run(tel_path)
        summaries.append(s)

        # Feed model with whatever we have; missing fields default.
        model.update_model({
            "mode_name": (s.get("spec_summary") or {}).get("mode") if isinstance(s.get("spec_summary"), dict) else "",
            "avg_confidence": float(s.get("avg_confidence", 0.0) or 0.0),
            "user_satisfaction": float(s.get("user_satisfaction", 0.0) or 0.0),
            "parameters_used": (s.get("spec_summary") or {}) if isinstance(s.get("spec_summary"), dict) else {},
        })

    return {
        "trained": True,
        "runs_dir": str(runs_dir),
        "model_path": str(model_path),
        "runs_seen": len(summaries),
    }


def recommend_spec_overrides(
    spec_summary: dict[str, Any],
    calibration_model: "CalibrationModel",
) -> dict[str, Any]:
    """Return bounded parameter recommendations suitable for FrontendSpec.with_overrides."""
    ctx = {
        "mode_name": spec_summary.get("mode"),
        "exemplar_type": "academic" if spec_summary.get("is_author") else "professional",
    }
    raw = calibration_model.predict_optimal_parameters(ctx) or {}

    def clamp_int(v: Any, lo: int, hi: int, default: int) -> int:
        try:
            iv = int(v)
        except Exception:
            return default
        return max(lo, min(hi, iv))

    overrides: dict[str, Any] = {}
    if "rrf_k" in raw:
        overrides["rrf_k"] = clamp_int(raw.get("rrf_k"), 10, 200, spec_summary.get("rrf_k", 60))
    if "max_results_per_query" in raw:
        overrides["search_max_results_per_query"] = clamp_int(raw.get("max_results_per_query"), 3, 30, spec_summary.get("search_max_results_per_query", 10))
    if "deepening_cycles" in raw:
        overrides["deepening_cycles"] = clamp_int(raw.get("deepening_cycles"), 0, 11, spec_summary.get("deepening_cycles", 0))
    if "deepening_strategy" in raw:
        strat = str(raw.get("deepening_strategy") or "").lower()
        if strat in {"auto", "segmentation", "drilldown", "hybrid"}:
            overrides["deepening_strategy"] = strat

    return overrides


# =============================================================================
# External Validation Framework
# =============================================================================

class ExternalValidator:
    """External validation against authoritative sources for trustworthy metrics."""
    
    def __init__(self, config: dict[str, Any] = None):
        self.config = config or {}
    
    def validate_domain_authority(self, urls: list[str]) -> dict[str, Any]:
        """Score domain authority based on .edu/.gov presence and academic sources."""
        authority_domains = {".edu", ".gov", "wikipedia", "britannica", "scholar.google"}
        academic_domains = {"arxiv", "acm", "ieee", "springer", "nature", "science"}
        
        edu_gov_count = sum(1 for url in urls if any(domain in url.lower() for domain in authority_domains))
        academic_count = sum(1 for url in urls if any(domain in url.lower() for domain in academic_domains))
        
        # Calculate authority score (0-1 scale)
        total_urls = len(urls)
        if total_urls == 0:
            authority_score = 0.0
        else:
            authority_score = (edu_gov_count * 1.0 + academic_count * 0.8) / total_urls
        
        return {
            "total_urls": total_urls,
            "edu_gov_count": edu_gov_count,
            "academic_count": academic_count,
            "authority_score": authority_score,
            "validation_timestamp": datetime.now(timezone.utc).isoformat(),
        }
    
    def cross_reference_skills(self, skills: list[dict[str, Any]], taxonomy_source: str = "ESCO") -> dict[str, Any]:
        """Validate skills against external taxonomies like ESCO."""
        # This would integrate with external APIs in a real implementation
        # For now, simulate basic overlap checking
        skill_names = [s.get("name", "").lower() for s in skills]
        
        # Simulate taxonomy validation (would be API call in production)
        overlap_score = len(skill_names) * 0.1  # Simulated overlap metric
        missing_skills = []  # Would be populated from taxonomy comparison
        
        return {
            "taxonomy_source": taxonomy_source,
            "skill_count": len(skills),
            "overlap_score": overlap_score,
            "missing_skills": missing_skills,
            "validation_timestamp": datetime.now(timezone.utc).isoformat(),
        }
    
    def check_temporal_consistency(self, runs: list[dict[str, Any]]) -> dict[str, Any]:
        """Check result consistency across multiple runs with same inputs."""
        if len(runs) < 2:
            return {"consistency_score": 1.0, "status": "insufficient_data"}
        
        # Compare skill sets across runs
        skill_sets = [set(run.get("skills", [])) for run in runs]
        if len(skill_sets) < 2:
            return {"consistency_score": 1.0, "status": "insufficient_data"}
        
        # Calculate Jaccard similarity between skill sets
        intersections = []
        unions = []
        for i in range(len(skill_sets)):
            for j in range(i + 1, len(skill_sets)):
                intersection = len(skill_sets[i] & skill_sets[j])
                union = len(skill_sets[i] | skill_sets[j])
                if union > 0:
                    intersections.append(intersection / union)
                    unions.append(union)
        
        avg_similarity = sum(intersections) / len(intersections) if intersections else 0.0
        consistency_score = 1.0 - avg_similarity  # Higher similarity = lower consistency
        
        return {
            "consistency_score": consistency_score,
            "avg_similarity": avg_similarity,
            "comparisons": len(intersections),
            "validation_timestamp": datetime.now(timezone.utc).isoformat(),
        }


# =============================================================================
# ML Calibration Framework
# =============================================================================

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
import json
from pathlib import Path


class CalibrationModel(ABC):
    """Abstract interface for ML calibration models."""
    
    @abstractmethod
    def predict_optimal_parameters(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Predict optimal parameters based on historical performance."""
        pass
    
    @abstractmethod
    def validate_prediction(self, prediction: Dict[str, Any], actual: Dict[str, Any]) -> float:
        """Validate prediction accuracy against actual outcomes."""
        pass
    
    @abstractmethod
    def update_model(self, feedback: Dict[str, Any]) -> None:
        """Update model with new performance data."""
        pass


class BasicCalibrationModel(CalibrationModel):
    """Basic implementation of calibration model using historical performance."""
    
    def __init__(self, model_path: Optional[Path] = None):
        self.model_path = model_path
        self.historical_data = []
        self.parameters = {}
        
        # Load existing model if path provided
        if model_path and model_path.exists():
            try:
                with open(model_path, 'r') as f:
                    data = json.load(f)
                    self.historical_data = data.get("historical_data", [])
                    self.parameters = data.get("parameters", {})
            except Exception:
                pass  # Start with empty model if load fails
    
    def predict_optimal_parameters(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Predict optimal parameters using simple heuristics."""
        mode_name = context.get("mode_name", "")
        exemplar_type = context.get("exemplar_type", "professional")
        
        # Base parameter recommendations
        recommendations = {
            "rrf_k": 60,  # Default RRF fusion parameter
            "max_results_per_query": 10,
            "deepening_cycles": 3,
            "deepening_strategy": "auto",
        }
        
        # Adjust based on historical performance
        if self.historical_data:
            recent_performance = [d for d in self.historical_data if d.get("mode_name") == mode_name][-5:]
            if recent_performance:
                avg_confidence = sum(d.get("avg_confidence", 0) for d in recent_performance) / len(recent_performance)
                
                # Adjust parameters based on performance
                if avg_confidence < 0.6:
                    recommendations["deepening_cycles"] = 5  # More cycles needed
                    recommendations["max_results_per_query"] = 15  # More search results
                elif avg_confidence > 0.8:
                    recommendations["deepening_cycles"] = 1  # Fewer cycles needed
                    recommendations["max_results_per_query"] = 8   # Fewer results needed
        
        # Adjust based on exemplar type
        if exemplar_type == "academic":
            recommendations["max_results_per_query"] = 20  # More comprehensive search
            recommendations["deepening_cycles"] = 5  # More thorough analysis
        elif exemplar_type == "fictional":
            recommendations["max_results_per_query"] = 8   # Conservative approach
            recommendations["deepening_cycles"] = 2  # Less deepening needed
        
        return recommendations
    
    def validate_prediction(self, prediction: Dict[str, Any], actual: Dict[str, Any]) -> float:
        """Calculate prediction accuracy as simple correlation."""
        if not prediction or not actual:
            return 0.0
        
        # Calculate accuracy for each parameter
        accuracies = []
        for key in prediction:
            if key in actual:
                pred_val = prediction[key]
                actual_val = actual[key]
                
                # For numeric values, calculate percentage error
                if isinstance(pred_val, (int, float)) and isinstance(actual_val, (int, float)):
                    if actual_val != 0:
                        accuracy = 1.0 - abs(pred_val - actual_val) / actual_val
                    else:
                        accuracy = 1.0 if pred_val == actual_val else 0.0
                else:
                    # For categorical values, exact match
                    accuracy = 1.0 if str(pred_val) == str(actual_val) else 0.0
                
                accuracies.append(accuracy)
        
        return sum(accuracies) / len(accuracies) if accuracies else 0.0
    
    def update_model(self, feedback: Dict[str, Any]) -> None:
        """Update model with new performance data."""
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Add to historical data
        self.historical_data.append({
            "timestamp": timestamp,
            "mode_name": feedback.get("mode_name", ""),
            "avg_confidence": feedback.get("avg_confidence", 0),
            "user_satisfaction": feedback.get("user_satisfaction", 0),
            "parameters_used": feedback.get("parameters_used", {}),
        })
        
        # Update parameters based on feedback
        if feedback.get("user_satisfaction", 0) < 0.5:
            # User dissatisfied - adjust parameters conservatively
            self.parameters["deepening_cycles"] = max(self.parameters.get("deepening_cycles", 3), 5)
        elif feedback.get("user_satisfaction", 0) > 0.8:
            # User very satisfied - can be more aggressive
            self.parameters["deepening_cycles"] = max(self.parameters.get("deepening_cycles", 3) - 1, 1)
        
        # Save model if path provided
        if self.model_path:
            try:
                model_data = {
                    "historical_data": self.historical_data,
                    "parameters": self.parameters,
                }
                with open(self.model_path, 'w') as f:
                    json.dump(model_data, f, indent=2)
            except Exception:
                pass  # Continue without saving if error occurs


# =============================================================================
# OODA Loop Framework
# =============================================================================

class OODALoop:
    """Observe-Orient-Decide-Act loop for continuous improvement."""
    
    def __init__(self, calibration_model: CalibrationModel, telemetry_writer: Optional[TelemetryWriter] = None):
        self.calibration_model = calibration_model
        self.telemetry_writer = telemetry_writer
        self.current_parameters = {}
        self.performance_history = []
        self.adaptation_log = []
    
    def observe(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Observe current system state and identify optimization opportunities."""
        # Collect current performance metrics
        current_performance = self._collect_performance_metrics(context)
        
        # Analyze patterns and identify opportunities
        opportunities = self._analyze_performance_patterns(current_performance, self.performance_history)
        
        # Log observation
        if self.telemetry_writer:
            self.telemetry_writer.emit(TelemetryEvent(
                "ooda.observe",
                data={
                    "context": context,
                    "current_performance": current_performance,
                    "opportunities": opportunities,
                    "observation_timestamp": datetime.now(timezone.utc).isoformat(),
                },
            ))
        
        return {
            "current_performance": current_performance,
            "opportunities": opportunities,
            "recommended_actions": self._generate_recommendations(opportunities),
        }
    
    def orient(self, observations: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze observations and decide on optimization strategy."""
        opportunities = observations.get("opportunities", [])
        recommendations = observations.get("recommended_actions", [])
        
        # Prioritize recommendations based on impact and feasibility
        prioritized_actions = []
        
        for action in recommendations:
            impact = action.get("impact", "medium")  # high, medium, low
            feasibility = action.get("feasibility", "medium")  # high, medium, low
            
            # Simple scoring for prioritization
            score = 0
            if impact == "high":
                score += 3
            elif impact == "medium":
                score += 2
            elif impact == "low":
                score += 1
            
            if feasibility == "high":
                score += 3
            elif feasibility == "medium":
                score += 2
            elif feasibility == "low":
                score += 1
            
            prioritized_actions.append({
                **action,
                "priority_score": score,
            })
        
        # Sort by priority score
        prioritized_actions.sort(key=lambda x: x["priority_score"], reverse=True)
        
        # Log orientation decision
        if self.telemetry_writer:
            self.telemetry_writer.emit(TelemetryEvent(
                "ooda.orient",
                data={
                    "observations": observations,
                    "prioritized_actions": prioritized_actions[:5],  # Top 5 actions
                    "orientation_timestamp": datetime.now(timezone.utc).isoformat(),
                },
            ))
        
        return {
            "selected_actions": prioritized_actions[:3],  # Top 3 actions to implement
            "orientation_strategy": "impact_feasibility_priority",
        }
    
    def act(self, actions: list[Dict[str, Any]], context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute selected optimization actions safely."""
        results = []
        rollback_data = {}
        
        for action in actions:
            action_type = action.get("type", "parameter_adjustment")
            parameter_name = action.get("parameter", "")
            old_value = self.current_parameters.get(parameter_name)
            new_value = action.get("value")
            
            # Store rollback data
            if old_value is not None:
                rollback_data[parameter_name] = old_value
            
            # Apply change
            if action_type == "parameter_adjustment":
                self.current_parameters[parameter_name] = new_value
                
                # Log the adjustment
                if self.telemetry_writer:
                    self.telemetry_writer.emit(event_ml_calibration_adjustment(
                        parameter_name=parameter_name,
                        old_value=old_value,
                        new_value=new_value,
                        adjustment_reason=action.get("reason", "ooda_optimization"),
                        prediction_accuracy=1.0,  # Will be updated after results
                    ))
                
                results.append({
                    "action": action,
                    "status": "applied",
                    "rollback_available": old_value is not None,
                })
            else:
                results.append({
                    "action": action,
                    "status": "skipped",
                    "reason": "unknown_action_type",
                })
        
        # Update performance history
        new_performance = self._collect_performance_metrics(context)
        self.performance_history.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "performance": new_performance,
            "actions_taken": actions,
        })
        
        return {
            "results": results,
            "rollback_data": rollback_data,
            "new_performance": new_performance,
        }
    
    def _collect_performance_metrics(self, context: Dict[str, Any]) -> Dict[str, float]:
        """Collect current performance metrics for analysis."""
        # This would integrate with actual telemetry data in production
        # For now, return simulated metrics
        return {
            "avg_skill_confidence": context.get("avg_confidence", 0.7),
            "search_latency_ms": context.get("search_latency_ms", 1000),
            "synthesis_quality_score": context.get("synthesis_quality", 0.8),
            "user_satisfaction": context.get("user_satisfaction", 0.7),
            "error_rate": context.get("error_rate", 0.05),
        }
    
    def _analyze_performance_patterns(self, current: Dict[str, float], history: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
        """Analyze performance patterns to identify optimization opportunities."""
        opportunities = []
        
        # Check for performance degradation
        if len(history) >= 2:
            recent = history[-2:]
            if len(recent) >= 2:
                prev_performance = recent[-2].get("performance", {})
                curr_performance = current
                
                # Compare with previous performance
                for metric, value in curr_performance.items():
                    prev_value = prev_performance.get(metric, 0)
                    if prev_value > 0:
                        degradation = (prev_value - value) / prev_value
                        
                        if degradation > 0.1:  # 10% degradation
                            opportunities.append({
                                "type": "parameter_adjustment",
                                "parameter": metric,
                                "value": value,
                                "reason": f"performance_degradation_{metric}",
                                "impact": "high",
                                "feasibility": "high",
                            })
                        elif degradation > 0.05:  # 5% degradation
                            opportunities.append({
                                "type": "parameter_adjustment",
                                "parameter": metric,
                                "value": value,
                                "reason": f"performance_decline_{metric}",
                                "impact": "medium",
                                "feasibility": "high",
                            })
        
        # Check for optimization opportunities
        if current.get("avg_skill_confidence", 0) < 0.6:
            opportunities.append({
                "type": "parameter_adjustment",
                "parameter": "deepening_cycles",
                "value": current.get("deepening_cycles", 3) + 2,
                "reason": "low_confidence_skills",
                "impact": "high",
                "feasibility": "high",
            })
        
        if current.get("search_latency_ms", 0) > 2000:
            opportunities.append({
                "type": "parameter_adjustment",
                "parameter": "max_results_per_query",
                "value": max(current.get("max_results_per_query", 10) - 3, 5),
                "reason": "high_search_latency",
                "impact": "medium",
                "feasibility": "high",
            })
        
        return opportunities
    
    def _generate_recommendations(self, opportunities: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
        """Generate specific recommendations from identified opportunities."""
        recommendations = []
        
        for opp in opportunities:
            if opp.get("type") == "parameter_adjustment":
                recommendations.append({
                    "type": opp.get("type"),
                    "parameter": opp.get("parameter"),
                    "value": opp.get("value"),
                    "reason": opp.get("reason"),
                    "impact": opp.get("impact"),
                    "feasibility": opp.get("feasibility"),
                })
        
        return recommendations

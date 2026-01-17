"""
Core telemetry classes: spans, writers, exporters.

Semantic Requirements (from docs/architecture/observability.md):
- JSONL telemetry to support debugging, calibration, reproducibility
- Event stream: run lifecycle, backend selection, search tracing
"""

from __future__ import annotations

import atexit
import json
import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any, Iterator, Optional

from skill_builder.pipeline.models import TelemetryEvent

try:
    from typing import Protocol
except Exception:  # pragma: no cover
    Protocol = object  # type: ignore

from pathlib import Path


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
        self._buffer_bytes: int = 0
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
        line_bytes = len(line.encode("utf-8"))

        with self._lock:
            if self._buffered:
                self._buffer.append(line)
                self._buffer_bytes += line_bytes
                if len(self._buffer) >= 100 or self._buffer_bytes >= 64 * 1024:
                    self._flush_buffer()
            elif self._file:
                self._file.write(line)
                self._file.flush()

        if self._exporters:
            for exporter in self._exporters:
                try:
                    exporter.export(payload_dict)
                except Exception:
                    pass

    def _flush_buffer(self) -> None:
        """Write buffered events to file (must hold lock)."""
        if self._file and self._buffer:
            self._file.writelines(self._buffer)
            self._file.flush()
            self._buffer.clear()
            self._buffer_bytes = 0

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
        self._span_stack: list[TelemetrySpan] = []
        self._span_counter = 0
    
    def __enter__(self) -> NullTelemetryWriter:
        return self
    
    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        pass
    
    def emit(self, event: TelemetryEvent) -> None:
        pass
    
    def flush(self) -> None:
        pass

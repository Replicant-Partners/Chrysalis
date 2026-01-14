"""
Telemetry event factory functions for run lifecycle and search tracing.
"""

from __future__ import annotations

from typing import Any

from skill_builder.pipeline.models import TelemetryEvent


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
        "anchors": anchors[:10],
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

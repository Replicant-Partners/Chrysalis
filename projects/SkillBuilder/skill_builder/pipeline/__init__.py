"""
SkillBuilder Pipeline Components.

This subpackage contains the core pipeline implementation:
- models: Data models (FrontendSpec, Exemplar, SearchHit, TelemetryEvent)
- search: Search backend abstraction and HTTP providers
- orchestrator: Two-stage research swarm coordination
- sanitizer: Security controls and prompt injection defense
- telemetry: Observability and structured logging
- artifacts: Output generators (semantic-map, citations, skills, etc.)
- transformer: Mode format conversion (KiloCode, Cursor)
- runner: Pipeline orchestration and execution
"""

from skill_builder.pipeline.models import (
    FrontendSpec,
    Exemplar,
    SearchHit,
    SearchResult,
    TelemetryEvent,
)
from skill_builder.pipeline.runner import run_pipeline
from skill_builder.pipeline.transformer import ModeTransformer

__all__ = [
    "FrontendSpec",
    "Exemplar",
    "SearchHit",
    "SearchResult",
    "TelemetryEvent",
    "run_pipeline",
    "ModeTransformer",
]

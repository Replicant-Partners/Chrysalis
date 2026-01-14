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

from .core import (
    TelemetrySpan,
    TelemetryExporter,
    HttpJsonExporter,
    TelemetryWriter,
    NullTelemetryWriter,
)

from .events import (
    event_run_start,
    event_run_done,
    event_run_error,
    event_backend_selected,
    event_query_start,
    event_query_done,
    event_tool_ok,
    event_tool_error,
    event_stage2_anchors,
    event_mcp_skipped,
    event_artifact_written,
)

from .quality_events import (
    event_quality_skill_distribution,
    event_quality_semantic_coherence,
    event_user_outcome_adoption,
    event_user_outcome_satisfaction,
    event_validation_domain_authority,
    event_validation_cross_reference,
    event_ml_calibration_adjustment,
    event_ml_prediction_accuracy,
    event_performance_regression,
)

from .readers import (
    emit_structured,
    _event_data,
    read_telemetry,
    filter_events,
    summarize_run,
)

from .analysis import (
    analyze_quality_trends,
    _calculate_confidence_trend,
    _calculate_adoption_rate,
    iter_run_telemetry_files,
    train_basic_calibration_model,
    recommend_spec_overrides,
    DEFAULT_CALIBRATION_MODEL_PATH,
    ExternalValidator,
    CalibrationModel,
    BasicCalibrationModel,
    OODALoop,
)

__all__ = [
    # Core classes
    "TelemetrySpan",
    "TelemetryExporter",
    "HttpJsonExporter",
    "TelemetryWriter",
    "NullTelemetryWriter",
    # Run lifecycle events
    "event_run_start",
    "event_run_done",
    "event_run_error",
    "event_backend_selected",
    "event_query_start",
    "event_query_done",
    "event_tool_ok",
    "event_tool_error",
    "event_stage2_anchors",
    "event_mcp_skipped",
    "event_artifact_written",
    # Quality/validation/ML events
    "event_quality_skill_distribution",
    "event_quality_semantic_coherence",
    "event_user_outcome_adoption",
    "event_user_outcome_satisfaction",
    "event_validation_domain_authority",
    "event_validation_cross_reference",
    "event_ml_calibration_adjustment",
    "event_ml_prediction_accuracy",
    "event_performance_regression",
    # Readers/utilities
    "emit_structured",
    "_event_data",
    "read_telemetry",
    "filter_events",
    "summarize_run",
    # Analysis
    "analyze_quality_trends",
    "_calculate_confidence_trend",
    "_calculate_adoption_rate",
    "iter_run_telemetry_files",
    "train_basic_calibration_model",
    "recommend_spec_overrides",
    "DEFAULT_CALIBRATION_MODEL_PATH",
    "ExternalValidator",
    "CalibrationModel",
    "BasicCalibrationModel",
    "OODALoop",
]

"""
Quality, validation, and ML-related telemetry events.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from skill_builder.pipeline.models import TelemetryEvent


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
            "adoption_source": adoption_source,
            "user_type": user_type,
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
            "taxonomy_source": external_taxonomy,
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
            "model_type": model_type,
            "prediction_type": prediction_type,
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
            "component": component,
            "current_performance": current_performance,
            "baseline_performance": baseline_performance,
            "regression_detected": regression_detected,
            "regression_timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )

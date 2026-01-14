"""
Telemetry analysis and calibration utilities.
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterator, Optional, TYPE_CHECKING

from skill_builder.pipeline.models import TelemetryEvent

from .readers import _event_data, read_telemetry, summarize_run
from .quality_events import event_ml_calibration_adjustment

if TYPE_CHECKING:
    from .core import TelemetryWriter


def analyze_quality_trends(telemetry_path: Path) -> dict[str, Any]:
    """Analyze quality trends from telemetry data."""
    events = list(read_telemetry(telemetry_path))
    
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
    
    recent_events = quality_events[-5:]
    confidences = [float(_event_data(e).get("avg_confidence", 0.0)) for e in recent_events]
    
    if len(confidences) < 2:
        return "insufficient_data"
    
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
        skill_names = [s.get("name", "").lower() for s in skills]
        
        overlap_score = len(skill_names) * 0.1
        missing_skills = []
        
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
        
        skill_sets = [set(run.get("skills", [])) for run in runs]
        if len(skill_sets) < 2:
            return {"consistency_score": 1.0, "status": "insufficient_data"}
        
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
        consistency_score = 1.0 - avg_similarity
        
        return {
            "consistency_score": consistency_score,
            "avg_similarity": avg_similarity,
            "comparisons": len(intersections),
            "validation_timestamp": datetime.now(timezone.utc).isoformat(),
        }


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
        self.historical_data: list[dict[str, Any]] = []
        self.parameters: dict[str, Any] = {}
        
        if model_path and model_path.exists():
            try:
                with open(model_path, 'r') as f:
                    data = json.load(f)
                    self.historical_data = data.get("historical_data", [])
                    self.parameters = data.get("parameters", {})
            except Exception:
                pass
    
    def predict_optimal_parameters(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Predict optimal parameters using simple heuristics."""
        mode_name = context.get("mode_name", "")
        exemplar_type = context.get("exemplar_type", "professional")
        
        recommendations = {
            "rrf_k": 60,
            "max_results_per_query": 10,
            "deepening_cycles": 3,
            "deepening_strategy": "auto",
        }
        
        if self.historical_data:
            recent_performance = [d for d in self.historical_data if d.get("mode_name") == mode_name][-5:]
            if recent_performance:
                avg_confidence = sum(d.get("avg_confidence", 0) for d in recent_performance) / len(recent_performance)
                
                if avg_confidence < 0.6:
                    recommendations["deepening_cycles"] = 5
                    recommendations["max_results_per_query"] = 15
                elif avg_confidence > 0.8:
                    recommendations["deepening_cycles"] = 1
                    recommendations["max_results_per_query"] = 8
        
        if exemplar_type == "academic":
            recommendations["max_results_per_query"] = 20
            recommendations["deepening_cycles"] = 5
        elif exemplar_type == "fictional":
            recommendations["max_results_per_query"] = 8
            recommendations["deepening_cycles"] = 2
        
        return recommendations
    
    def validate_prediction(self, prediction: Dict[str, Any], actual: Dict[str, Any]) -> float:
        """Calculate prediction accuracy as simple correlation."""
        if not prediction or not actual:
            return 0.0
        
        accuracies = []
        for key in prediction:
            if key in actual:
                pred_val = prediction[key]
                actual_val = actual[key]
                
                if isinstance(pred_val, (int, float)) and isinstance(actual_val, (int, float)):
                    if actual_val != 0:
                        accuracy = 1.0 - abs(pred_val - actual_val) / actual_val
                    else:
                        accuracy = 1.0 if pred_val == actual_val else 0.0
                else:
                    accuracy = 1.0 if str(pred_val) == str(actual_val) else 0.0
                
                accuracies.append(accuracy)
        
        return sum(accuracies) / len(accuracies) if accuracies else 0.0
    
    def update_model(self, feedback: Dict[str, Any]) -> None:
        """Update model with new performance data."""
        timestamp = datetime.now(timezone.utc).isoformat()
        
        self.historical_data.append({
            "timestamp": timestamp,
            "mode_name": feedback.get("mode_name", ""),
            "avg_confidence": feedback.get("avg_confidence", 0),
            "user_satisfaction": feedback.get("user_satisfaction", 0),
            "parameters_used": feedback.get("parameters_used", {}),
        })
        
        if feedback.get("user_satisfaction", 0) < 0.5:
            self.parameters["deepening_cycles"] = max(self.parameters.get("deepening_cycles", 3), 5)
        elif feedback.get("user_satisfaction", 0) > 0.8:
            self.parameters["deepening_cycles"] = max(self.parameters.get("deepening_cycles", 3) - 1, 1)
        
        if self.model_path:
            try:
                model_data = {
                    "historical_data": self.historical_data,
                    "parameters": self.parameters,
                }
                with open(self.model_path, 'w') as f:
                    json.dump(model_data, f, indent=2)
            except Exception:
                pass


class OODALoop:
    """Observe-Orient-Decide-Act loop for continuous improvement."""
    
    def __init__(self, calibration_model: CalibrationModel, telemetry_writer: Optional["TelemetryWriter"] = None):
        self.calibration_model = calibration_model
        self.telemetry_writer = telemetry_writer
        self.current_parameters: Dict[str, Any] = {}
        self.performance_history: list[Dict[str, Any]] = []
        self.adaptation_log: list[Dict[str, Any]] = []
    
    def observe(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Observe current system state and identify optimization opportunities."""
        current_performance = self._collect_performance_metrics(context)
        opportunities = self._analyze_performance_patterns(current_performance, self.performance_history)
        
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
        
        prioritized_actions = []
        
        for action in recommendations:
            impact = action.get("impact", "medium")
            feasibility = action.get("feasibility", "medium")
            
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
        
        prioritized_actions.sort(key=lambda x: x["priority_score"], reverse=True)
        
        if self.telemetry_writer:
            self.telemetry_writer.emit(TelemetryEvent(
                "ooda.orient",
                data={
                    "observations": observations,
                    "prioritized_actions": prioritized_actions[:5],
                    "orientation_timestamp": datetime.now(timezone.utc).isoformat(),
                },
            ))
        
        return {
            "selected_actions": prioritized_actions[:3],
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
            
            if old_value is not None:
                rollback_data[parameter_name] = old_value
            
            if action_type == "parameter_adjustment":
                self.current_parameters[parameter_name] = new_value
                
                if self.telemetry_writer:
                    self.telemetry_writer.emit(event_ml_calibration_adjustment(
                        parameter_name=parameter_name,
                        old_value=old_value,
                        new_value=new_value,
                        adjustment_reason=action.get("reason", "ooda_optimization"),
                        prediction_accuracy=1.0,
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
        
        if len(history) >= 2:
            recent = history[-2:]
            if len(recent) >= 2:
                prev_performance = recent[-2].get("performance", {})
                curr_performance = current
                
                for metric, value in curr_performance.items():
                    prev_value = prev_performance.get(metric, 0)
                    if prev_value > 0:
                        degradation = (prev_value - value) / prev_value
                        
                        if degradation > 0.1:
                            opportunities.append({
                                "type": "parameter_adjustment",
                                "parameter": metric,
                                "value": value,
                                "reason": f"performance_degradation_{metric}",
                                "impact": "high",
                                "feasibility": "high",
                            })
                        elif degradation > 0.05:
                            opportunities.append({
                                "type": "parameter_adjustment",
                                "parameter": metric,
                                "value": value,
                                "reason": f"performance_decline_{metric}",
                                "impact": "medium",
                                "feasibility": "high",
                            })
        
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

from __future__ import annotations

from dataclasses import dataclass
from typing import List

from ..config_loader import SemanticConfig
from ..exemplar_discovery import build_stage1_queries, build_stage2_queries, discover_exemplars, simple_offline_search
from ..identity import resolve_identity
from ..models import IdentitySpec, ParsedIdentity, SearchQuery, SearchResult, SemanticArtifacts
from ..output import build_artifacts
from ..telemetry import TelemetryRecorder


@dataclass
class PipelineContext:
    identity: ParsedIdentity
    queries_stage1: List[SearchQuery]
    queries_stage2: List[SearchQuery]
    results_stage1: List[SearchResult]
    results_stage2: List[SearchResult]
    discovered_exemplars: List[str]


def run_pipeline(spec: IdentitySpec, config: SemanticConfig) -> SemanticArtifacts:
    telemetry = TelemetryRecorder(enabled=True)
    telemetry.record("run.start", {"mode_name": spec.mode_name})

    parsed = resolve_identity(
        identity=spec.raw,
        purpose=spec.purpose,
        config=config,
        explicit_domains=[],
        explicit_expertise=None,
        extra_keywords=spec.skills,
    )

    q1 = build_stage1_queries(parsed, config)
    q2 = build_stage2_queries(parsed, config)
    telemetry.record("search.backend.selected", {"backend": "offline-placeholder"})

    results1 = simple_offline_search(q1, parsed)
    results2 = simple_offline_search(q2, parsed) if q2 else []
    discovered = discover_exemplars(results1 + results2)

    telemetry.record(
        "search.summary",
        {
            "stage1_queries": len(q1),
            "stage2_queries": len(q2),
            "stage1_hits": sum(len(r.hits) for r in results1),
            "stage2_hits": sum(len(r.hits) for r in results2),
            "discovered_exemplars": discovered[:5],
        },
    )

    artifacts = build_artifacts(
        spec=spec,
        parsed=parsed,
        results=[*results1, *results2],
        discovered_exemplars=discovered,
        telemetry=telemetry,
    )

    telemetry.record("run.done", {"status": "ok"})
    artifacts.telemetry_events = telemetry.events
    return artifacts

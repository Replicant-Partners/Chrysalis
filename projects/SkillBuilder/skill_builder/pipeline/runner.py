"""
Pipeline runner for SkillBuilder.

Semantic Requirements:
- Orchestrate the full mode-building pipeline
- Produce durable artifacts with telemetry
- Support both programmatic and CLI invocation

Design Pattern: Facade + Template Method + Bridge
- run_pipeline() is the primary entry point
- PipelineRunner encapsulates the execution workflow
- Bridge pattern used to delegate to Go (search) and Clojure (synthesis)
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional, Sequence
import uuid

import yaml

from skill_builder.pipeline.models import FrontendSpec, SkillCard, SemanticMapEntry, SearchHit, Citation, ResearchArtifacts, TelemetryEvent
from skill_builder.pipeline.mode_merge import ModeBatchMergeSpec, run_batch_mode_merge as _run_batch_mode_merge_core
from skill_builder.pipeline.external_bridge import run_go_search_swarm, run_clojure_synthesis
from skill_builder.pipeline.embeddings import EmbeddingService
from skill_builder.pipeline.kilocode import KilocodeManager
from skill_builder.pipeline.telemetry import (
    HttpJsonExporter,
    NullTelemetryWriter,
    TelemetryWriter,
    event_artifact_written,
    event_run_done,
    event_run_error,
    event_run_start,
    event_ml_calibration_adjustment,
    recommend_spec_overrides,
    DEFAULT_CALIBRATION_MODEL_PATH,
    BasicCalibrationModel,
)


@dataclass
class PipelineResult:
    """Result of a pipeline run.
    
    Contains all outputs and metadata for inspection.
    """
    success: bool
    spec: FrontendSpec
    artifacts: Optional[ResearchArtifacts] = None
    skills: tuple[SkillCard, ...] = field(default_factory=tuple)
    embeddings: tuple[list[float], ...] = field(default_factory=tuple)
    semantic_map: tuple[SemanticMapEntry, ...] = field(default_factory=tuple)
    written_files: tuple[Path, ...] = field(default_factory=tuple)
    error: Optional[str] = None
    duration_ms: float = 0.0
    
    @property
    def output_dir(self) -> Path:
        """Get the output directory for this run."""
        return self.spec.out_dir / self.spec.mode_name


class PipelineRunner:
    """Executes the SkillBuilder pipeline.
    
    Orchestrates:
    1. Go-based Search Swarm (Stage 1 & 2)
    2. Clojure-based Semantic Synthesis
    3. Artifact writing
    4. Telemetry throughout
    """
    
    def __init__(
        self,
        spec: FrontendSpec,
        telemetry_enabled: bool = True,
        run_id: str | None = None,
    ):
        self.spec = spec
        self.telemetry_enabled = telemetry_enabled
        self._telemetry: Optional[TelemetryWriter] = None
        self.kilocode = KilocodeManager(spec.kilocode_config_path)
        self.run_id = run_id or str(uuid.uuid4())
        self.embedder = EmbeddingService()
    
    def run(self) -> PipelineResult:
        """Execute the full pipeline.
        
        Returns PipelineResult with all outputs.
        """
        start_time = time.perf_counter()
        
        # Initialize telemetry
        telemetry_path = self.spec.get_output_path("telemetry.jsonl")
        telemetry_path.parent.mkdir(parents=True, exist_ok=True)
        
        exporters = []
        export_url = None
        try:
            import os
            export_url = os.environ.get("SKILLBUILDER_TELEMETRY_EXPORT_URL")
            export_token = os.environ.get("SKILLBUILDER_TELEMETRY_EXPORT_TOKEN")
            if export_url:
                exporters.append(HttpJsonExporter(export_url, bearer_token=export_token))
        except Exception:
            exporters = []
        
        if self.telemetry_enabled:
            self._telemetry = TelemetryWriter(
                telemetry_path,
                context={"run_id": self.run_id, "mode": self.spec.mode_name},
                exporters=exporters,
            )
        else:
            self._telemetry = NullTelemetryWriter()
        
        try:
            with self._telemetry:
                return self._run_pipeline(start_time)
        except Exception as e:
            return PipelineResult(
                success=False,
                spec=self.spec,
                error=str(e),
                duration_ms=(time.perf_counter() - start_time) * 1000,
            )
    
    def _run_pipeline(self, start_time: float) -> PipelineResult:
        """Internal pipeline execution with telemetry context."""
        assert self._telemetry is not None

        # Calibration: load offline artifact (if present) and apply bounded overrides
        if getattr(self.spec, "calibration_enabled", True):
            model_path = getattr(self.spec, "calibration_model_path", None) or DEFAULT_CALIBRATION_MODEL_PATH
            try:
                if model_path and Path(model_path).exists():
                    model = BasicCalibrationModel(model_path=Path(model_path))
                    overrides = recommend_spec_overrides(self.spec.telemetry_summary(), model)
                    if overrides:
                        before = self.spec
                        self.spec = self.spec.with_overrides(**overrides)
                        # Emit per-parameter adjustments (run_id injected by writer context)
                        for k, v in overrides.items():
                            old_val = getattr(before, k, None)
                            # `search_max_results_per_query` is stored under a different key in overrides
                            if k == "search_max_results_per_query":
                                old_val = getattr(before, "search_max_results_per_query", None)
                            self._telemetry.emit(event_ml_calibration_adjustment(
                                parameter_name=k,
                                old_value=old_val,
                                new_value=v,
                                adjustment_reason="offline_calibration_recommendation",
                                prediction_accuracy=0.0,
                            ))
            except Exception as e:
                self._telemetry.emit(TelemetryEvent(
                    event_type="ml.calibration.load_error",
                    data={"error": str(e), "model_path": str(model_path) if model_path else None},
                ))

        # Emit run start (after calibration so spec_summary reflects applied params)
        self._telemetry.emit(event_run_start(
            self.spec.mode_name,
            "go-swarm",
            run_id=self.run_id,
            spec_summary=self.spec.telemetry_summary(),
        ))

        try:
            # Load seeded modes if requested
            seeded_modes_data: list[dict] = []
            unmatched_seed_modes: list[str] = []
            if self.spec.seed_modes:
                seeded_modes_data, unmatched_seed_modes = self.kilocode.load_modes(list(self.spec.seed_modes))

                if unmatched_seed_modes:
                    # Record recoverable miss to keep operators aware without failing run
                    self._telemetry.emit(
                        TelemetryEvent(
                            event_type="kilocode.unmatched",
                            data={
                                "requested": list(self.spec.seed_modes),
                                "unmatched": unmatched_seed_modes,
                            },
                        )
                    )

            # Step 1: Run Go-based search swarm
            with self._telemetry.span("search.swarm", backend="go", enable_hybrid=self.spec.enable_hybrid):
                swarm_start = time.perf_counter()
                swarm_data = run_go_search_swarm(self.spec, telemetry=self._telemetry, run_id=self.run_id)
                swarm_duration_ms = (time.perf_counter() - swarm_start) * 1000
            
            self._telemetry.emit(TelemetryEvent(
                event_type="search.swarm.done",
                data={
                    "run_id": self.run_id,
                    "duration_ms": swarm_duration_ms,
                    "provider_hits": len(swarm_data.get("provider_hits", []) or []),
                },
            ))
            
            swarm_data["seeded_modes"] = seeded_modes_data

            # Convert Go output to ResearchArtifacts
            all_hits_raw = swarm_data.get("all_hits", [])
            
            if all_hits_raw is None:
                raise ValueError("Go search swarm returned None for all_hits")

            # Optionally fuse multi-provider results with RRF when hybrid is enabled or provider buckets exist
            provider_hits_raw = _extract_provider_hits(swarm_data, all_hits_raw)
            should_rrf = self.spec.enable_hybrid or len(provider_hits_raw) > 1

            if should_rrf and provider_hits_raw:
                rrf_start = time.perf_counter()
                fused_hits_raw = _rrf_fuse_hits(provider_hits_raw, k=self.spec.rrf_k)
                all_hits_source = fused_hits_raw
                self._telemetry.emit(TelemetryEvent(
                    event_type="search.rrf.fused",
                    data={
                        "run_id": self.run_id,
                        "k": self.spec.rrf_k,
                        "providers": [p for p, _ in provider_hits_raw],
                        "raw_counts": {p: len(h) for p, h in provider_hits_raw},
                        "fused_count": len(fused_hits_raw),
                        "duration_ms": (time.perf_counter() - rrf_start) * 1000,
                    },
                ))
            else:
                all_hits_source = all_hits_raw

            all_hits = [
                SearchHit(
                    title=h.get("title", ""),
                    url=h.get("url", ""),
                    snippet=h.get("snippet", ""),
                    score=h.get("score", 0.0),
                    domain=h.get("domain", ""),
                    provider=h.get("provider", ""),
                )
                for h in all_hits_source
            ]
            
            domain_anchors_raw = swarm_data.get("domain_anchors", [])
            
            if domain_anchors_raw is None:
                domain_anchors = tuple()
            else:
                domain_anchors = tuple(domain_anchors_raw)

            artifacts = ResearchArtifacts(
                all_hits=tuple(all_hits),
                domain_anchors=domain_anchors,
                citations=tuple(
                    Citation(
                        url=h.url,
                        title=h.title,
                        source_type="web",
                        relevance=h.snippet[:100],
                    )
                    for h in all_hits
                ),
            )

            # Step 2+: Deepening cycles with strategy selection and scoring
            cycles_requested = max(0, min(self.spec.deepening_cycles, 11))
            total_cycles = max(1, cycles_requested if cycles_requested > 0 else 1)
            prior_domains: set[str] = set(domain_anchors)
            prior_skills: set[str] = set()
            final_skills: tuple[SkillCard, ...] = tuple()
            final_map: tuple[SemanticMapEntry, ...] = tuple()
            written_files: list[Path] = []
            stop_reason: Optional[str] = None

            for cycle_idx in range(total_cycles):
                strategy = self._select_strategy(cycle_idx)
                self._telemetry.emit(TelemetryEvent(
                    event_type="deepening.strategy",
                    data={"cycle": cycle_idx + 1, "strategy": strategy, "requested_cycles": cycles_requested},
                ))

                cycle_start = time.perf_counter()
                with self._telemetry.span("synthesis", cycle=cycle_idx + 1, strategy=strategy):
                    synthesis_data = run_clojure_synthesis(
                        {**swarm_data, "strategy": strategy, "cycle": cycle_idx + 1, "run_id": self.run_id},
                        self.spec,
                        telemetry=self._telemetry,
                        run_id=self.run_id,
                    )
                
                if synthesis_data is None:
                    raise ValueError("Clojure synthesis returned None")

                skills_raw = synthesis_data.get("skills", []) or []
                skills = [
                    SkillCard(
                        name=s["name"],
                        description=s["description"],
                        triggers=tuple(s.get("triggers", [])),
                        artifacts=tuple(s.get("artifacts", [])),
                        constraints=tuple(s.get("constraints", [])),
                        evidence_urls=tuple(s.get("evidence_urls", [])),
                        confidence=s.get("confidence", 0.7),
                    )
                    for s in skills_raw
                ]

                semantic_map_raw = synthesis_data.get("semantic_map", []) or []
                semantic_map = [
                    SemanticMapEntry(
                        schema_type=e["schema_type"],
                        name=e["name"],
                        description=e["description"],
                        properties=e["properties"],
                        source_urls=tuple(e.get("source_urls", [])),
                    )
                    for e in semantic_map_raw
                ]

                # Scoring
                current_domains = prior_domains | {m.name.lower() for m in semantic_map}
                domain_gain = len(current_domains) - len(prior_domains)
                skill_names = {s.name.lower() for s in skills}
                skill_gain = len(skill_names - prior_skills)

                score = {
                    "strategy": strategy,
                    "cycle": cycle_idx + 1,
                    "domain_gain": domain_gain,
                    "skill_gain": skill_gain,
                    "duration_ms": (time.perf_counter() - cycle_start) * 1000,
                }
                self._telemetry.emit(TelemetryEvent(
                    event_type="deepening.score",
                    data=score,
                ))

                # Early stop if requested cycles > 0 but no progressive info
                if cycles_requested > 0 and cycle_idx + 1 < total_cycles:
                    if strategy == "segmentation" and domain_gain <= 0:
                        stop_reason = "segmentation-no-new-domains"
                        break
                    if strategy == "drilldown" and skill_gain <= 0:
                        stop_reason = "drilldown-no-new-skills"
                        break

                prior_domains = current_domains
                prior_skills |= skill_names
                final_skills = tuple(skills)
                final_embeddings = tuple(skill_embeddings)
                final_map = tuple(semantic_map)

            # Step 3: Write artifacts from last cycle
            out_dir = self.spec.out_dir / self.spec.mode_name
            out_dir.mkdir(parents=True, exist_ok=True)

            markdown_data = synthesis_data.get("markdown", {}) if 'synthesis_data' in locals() else {}

            for name, content in markdown_data.items():
                file_path = out_dir / f"{name.replace('_', '-')}.md"
                with open(file_path, "w") as f:
                    f.write(content)
                written_files.append(file_path)
                try:
                    size_bytes = file_path.stat().st_size
                except OSError:
                    size_bytes = 0
                self._telemetry.emit(event_artifact_written(
                    artifact_type=name,
                    path=str(file_path),
                    size_bytes=size_bytes,
                ))

            citations_path = out_dir / "citations.md"
            with open(citations_path, "w") as f:
                f.write("# Citations\n\n")
                for c in artifacts.citations:
                    f.write(f"{c.to_markdown()}\n")
            written_files.append(citations_path)
            try:
                citations_size = citations_path.stat().st_size
            except OSError:
                citations_size = 0
            self._telemetry.emit(event_artifact_written(
                artifact_type="citations",
                path=str(citations_path),
                size_bytes=citations_size,
            ))

            duration_ms = (time.perf_counter() - start_time) * 1000

            self._telemetry.emit(event_run_done(
                duration_ms=duration_ms,
                artifacts=[str(f.name) for f in written_files],
                run_id=self.run_id,
            ))

            return PipelineResult(
                success=True,
                spec=self.spec,
                artifacts=artifacts,
                skills=final_skills,
                embeddings=final_embeddings,
                semantic_map=final_map,
                written_files=tuple(written_files),
                duration_ms=duration_ms,
                error=stop_reason,
            )

        except Exception as e:
            duration_ms = (time.perf_counter() - start_time) * 1000

            self._telemetry.emit(event_run_error(
                error=str(e),
                stage="pipeline",
                run_id=self.run_id,
            ))

            return PipelineResult(
                success=False,
                spec=self.spec,
                error=str(e),
                duration_ms=duration_ms,
            )

    def _select_strategy(self, cycle_idx: int) -> str:
        """Select deepening strategy for a cycle.

        Strategies:
        - segmentation: semantic segmentation of seeds/map domains
        - drilldown: deepen established areas
        - hybrid/auto: alternate by cycle
        """
        strat = (self.spec.deepening_strategy or "auto").lower()
        if strat in {"segmentation", "drilldown"}:
            return strat
        # auto / hybrid: alternate starting with segmentation
        return "segmentation" if cycle_idx % 2 == 0 else "drilldown"


def run_pipeline(
    spec: FrontendSpec | Path | str,
    telemetry_enabled: bool = True,
    run_id: str | None = None,
) -> PipelineResult:
    """Main entry point for running the SkillBuilder pipeline."""
    # Load spec if path provided
    if isinstance(spec, (str, Path)):
        spec = FrontendSpec.from_yaml(Path(spec))
    
    runner = PipelineRunner(spec, telemetry_enabled=telemetry_enabled, run_id=run_id)
    return runner.run()


# =============================================================================
# Batch merge facade
# =============================================================================


def run_batch_mode_merge(spec: ModeBatchMergeSpec | dict | str | Path) -> dict[str, Any]:
    """Convenience wrapper to run batch mode merge via ModeBatchMergeSpec."""
    if isinstance(spec, (str, Path)):
        spec = ModeBatchMergeSpec(mode_folder=Path(spec), target_mode_count=50)
    elif isinstance(spec, dict):
        spec = ModeBatchMergeSpec(**spec)

    return _run_batch_mode_merge_core(spec)


# =============================================================================
# Hybrid Fusion Utilities
# =============================================================================

def _extract_provider_hits(
    swarm_data: dict[str, Any],
    all_hits_raw: Sequence[dict[str, Any]],
) -> list[tuple[str, list[dict[str, Any]]]]:
    """Extract provider-bucketed hits if available, else group by provider field.

    Supports two shapes:
    - swarm_data contains `provider_hits`: list of {provider|name|backend, hits|results}
    - fallback: group `all_hits_raw` by hit.provider
    """
    provider_hits: list[tuple[str, list[dict[str, Any]]]] = []

    raw_provider_hits = swarm_data.get("provider_hits")
    if isinstance(raw_provider_hits, list):
        for bucket in raw_provider_hits:
            provider = (
                bucket.get("provider")
                or bucket.get("name")
                or bucket.get("backend")
                or ""
            )
            hits = bucket.get("hits") or bucket.get("results") or []
            if provider and isinstance(hits, list) and hits:
                provider_hits.append((str(provider), hits))

    if provider_hits:
        return provider_hits

    grouped: dict[str, list[dict[str, Any]]] = {}
    for hit in all_hits_raw or []:
        provider = hit.get("provider") or "unknown"
        grouped.setdefault(str(provider), []).append(hit)

    return [(p, h) for p, h in grouped.items() if h]


def _rrf_fuse_hits(
    provider_hits: Sequence[tuple[str, Sequence[dict[str, Any]]]],
    k: int = 60,
) -> list[dict[str, Any]]:
    """Fuse ranked lists using Reciprocal Rank Fusion (RRF).

    score = sum(1 / (k + rank)) across providers; preserves first hit payload per URL.
    """
    fused: dict[str, dict[str, Any]] = {}

    for provider, hits in provider_hits:
        for rank, hit in enumerate(hits):
            url = hit.get("url") or f"{provider}-idx-{rank}"
            reciprocal = 1.0 / (k + rank + 1)
            if url not in fused:
                fused[url] = {
                    **hit,
                    "provider": hit.get("provider") or provider,
                    "score": float(reciprocal),
                }
            else:
                fused[url]["score"] = float(fused[url].get("score", 0.0) + reciprocal)

    fused_hits = list(fused.values())
    fused_hits.sort(key=lambda h: h.get("score", 0.0), reverse=True)
    return fused_hits


# =============================================================================
# Dry Run Support
# =============================================================================

def dry_run(spec: FrontendSpec | Path | str) -> dict:
    """Preview what the pipeline would do without executing searches."""
    if isinstance(spec, (str, Path)):
        spec = FrontendSpec.from_yaml(Path(spec))
    
    return {
        "mode_name": spec.mode_name,
        "purpose": spec.purpose,
        "exemplars": [e.name for e in spec.exemplars],
        "backend": "go-swarm",
        "providers": [p.value for p in spec.http_search_providers],
        "stage1_templates": list(spec.query_templates),
        "stage2_templates": list(spec.web_swarm_stage2_query_templates),
        "output_dir": str(spec.out_dir / spec.mode_name),
        "expected_outputs": [
            "semantic-map.md",
            "citations.md",
            "skills.md",
            "mode-reference.md",
            "generated-mode.md",
            "telemetry.jsonl",
        ],
    }

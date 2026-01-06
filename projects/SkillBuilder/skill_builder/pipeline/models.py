"""
Core data models for SkillBuilder pipeline.

Design Principles (aligned with Semantic Requirements):
- Immutable value objects using frozen dataclasses
- Clear separation between input specs, intermediate data, and output artifacts
- Type-safe with explicit optionals and defaults
- Schema.org alignment for semantic map structures

Pattern Language:
- Value Object: All models are immutable data carriers
- Builder: FrontendSpec.from_yaml() for construction from config
- Specification: SearchQuery encapsulates search criteria
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum, auto
from pathlib import Path
from typing import Any, Optional, Sequence

import yaml
from dotenv import load_dotenv

# Load environment variables from .env file
# Get project root by going up from models.py -> pipeline -> skill_builder -> project root
import os
project_root = Path(__file__).parent.parent.parent
dotenv_path = project_root / ".env"
load_dotenv(dotenv_path=dotenv_path)


class SearchBackend(Enum):
    """Search backend selection mode.
    
    Semantic Requirement: Backend flexibility with fallback.
    - HTTP: Fast path, direct API calls (Tavily, Brave)
    - MCP: Model Context Protocol stdio servers
    - AUTO: Try MCP, fallback to HTTP
    """
    HTTP = auto()
    MCP = auto()
    AUTO = auto()
    
    @classmethod
    def from_string(cls, value: str) -> SearchBackend:
        """Parse backend from YAML string."""
        mapping = {"http": cls.HTTP, "mcp": cls.MCP, "auto": cls.AUTO}
        return mapping.get(value.lower(), cls.AUTO)


class HTTPProvider(Enum):
    """Supported HTTP search providers."""
    TAVILY = "tavily"
    BRAVE = "brave"
    
    @classmethod
    def from_string(cls, value: str) -> Optional[HTTPProvider]:
        return next(
            (provider for provider in cls if provider.value == value.lower()), None
        )


@dataclass(frozen=True)
class Exemplar:
    """An exemplar person/entity used as research seed.
    
    Semantic Requirement: "person + a set of skills + a purpose"
    - name: The identifiable entity (noun)
    - url: Optional canonical reference
    - is_author: Hint for research query formation
    - salts: Characteristics/skills (adjectives/adverbs)
    """
    name: str
    url: Optional[str] = None
    is_author: bool = False
    salts: tuple[str, ...] = field(default_factory=tuple)
    
    def with_salts(self, salts: Sequence[str]) -> Exemplar:
        """Return new Exemplar with additional salts (immutable update)."""
        return Exemplar(
            name=self.name,
            url=self.url,
            is_author=self.is_author,
            salts=tuple(salts),
        )


@dataclass(frozen=True)
class SearchHit:
    """A single search result hit.
    
    Semantic Requirement: Preserve raw pointers for traceability.
    """
    title: str
    url: str
    snippet: str
    score: float = 0.0  # Provider-specific relevance score
    domain: str = ""    # Extracted domain for trust scoring
    provider: str = ""  # Which provider returned this hit
    
    def __post_init__(self) -> None:
        """Extract domain from URL if not provided."""
        if not self.domain and self.url:
            if match := re.match(r"https?://([^/]+)", self.url):
                object.__setattr__(self, "domain", match[1])


@dataclass(frozen=True)
class SearchResult:
    """Aggregated search results for a query.
    
    Includes metadata for calibration and debugging.
    """
    query: str
    hits: tuple[SearchHit, ...]
    provider: str
    raw_count: int  # Before deduplication
    duration_ms: float = 0.0
    error: Optional[str] = None
    
    @property
    def kept_count(self) -> int:
        """Number of hits kept after deduplication."""
        return len(self.hits)
    
    @property
    def dedupe_ratio(self) -> float:
        """Ratio of kept vs total hits (for calibration)."""
        return self.kept_count / self.raw_count if self.raw_count > 0 else 0.0


@dataclass
class ResearchArtifacts:
    """Intermediate artifacts from research stages.
    
    Semantic Requirement: Preserve artifacts for traceability.
    """
    stage1_results: tuple[SearchResult, ...] = field(default_factory=tuple)
    stage2_results: tuple[SearchResult, ...] = field(default_factory=tuple)
    all_hits: tuple[SearchHit, ...] = field(default_factory=tuple)
    inferred_skills: tuple[str, ...] = field(default_factory=tuple)
    domain_anchors: tuple[str, ...] = field(default_factory=tuple)
    citations: tuple[Citation, ...] = field(default_factory=tuple)
    
    @property
    def total_hits(self) -> int:
        return len(self.all_hits)
    
    @property
    def unique_domains(self) -> set[str]:
        return {h.domain for h in self.all_hits if h.domain}


@dataclass(frozen=True)
class TelemetryEvent:
    """Structured telemetry event for observability.
    
    Semantic Requirement: JSONL telemetry for debugging and calibration.
    Event types:
    - run.start, run.done, run.error
    - search.backend.selected
    - search.query.start, search.tool.ok, search.tool.error, search.query.done
    - search.stage2.anchors
    """
    event_type: str
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    data: dict[str, Any] = field(default_factory=dict)
    
    def to_jsonl(self) -> str:
        """Serialize to JSONL format.

        Backward compatible with both shapes:
        - legacy: {event, ts, <flattened data keys>}
        - new:     {event, ts, data: {...}, <flattened data keys>}

        Keeping both enables existing grep-style workflows while unblocking
        analysis code that expects an explicit `data` object.
        """
        payload: dict[str, Any] = {
            "event": self.event_type,
            "ts": self.timestamp,
            "data": self.data,
            **self.data,
        }
        return json.dumps(payload, separators=(",", ":"))
    
    @classmethod
    def run_start(cls, spec_name: str, backend: str) -> TelemetryEvent:
        return cls("run.start", data={"spec": spec_name, "backend": backend})
    
    @classmethod
    def run_done(cls, duration_ms: float, artifact_count: int) -> TelemetryEvent:
        return cls("run.done", data={"duration_ms": duration_ms, "artifacts": artifact_count})
    
    @classmethod
    def run_error(cls, error: str, stage: str) -> TelemetryEvent:
        return cls("run.error", data={"error": error, "stage": stage})
    
    @classmethod
    def backend_selected(cls, backend: str, reason: str) -> TelemetryEvent:
        return cls("search.backend.selected", data={"backend": backend, "reason": reason})
    
    @classmethod
    def query_start(cls, query: str, stage: int) -> TelemetryEvent:
        return cls("search.query.start", data={"query": query, "stage": stage})
    
    @classmethod
    def query_done(cls, query: str, hits: int, duration_ms: float) -> TelemetryEvent:
        return cls("search.query.done", data={"query": query, "hits": hits, "duration_ms": duration_ms})


@dataclass(frozen=True)
class SkillCard:
    """A capability extracted from research.
    
    Semantic Requirement: SKILL.md-inspired skill cards.
    Format: verb + object + constraint + artifact
    """
    name: str
    description: str
    triggers: tuple[str, ...] = field(default_factory=tuple)  # When to activate
    artifacts: tuple[str, ...] = field(default_factory=tuple)  # What is produced
    constraints: tuple[str, ...] = field(default_factory=tuple)  # Boundaries
    evidence_urls: tuple[str, ...] = field(default_factory=tuple)  # Source citations
    confidence: float = 0.7  # Epistemic marker (0.5-1.0)
    
    def to_yaml_block(self) -> str:
        """Render as YAML block for skills.md."""
        return yaml.dump({
            "skill": self.name,
            "description": self.description,
            "triggers": list(self.triggers),
            "artifacts": list(self.artifacts),
            "constraints": list(self.constraints),
            "evidence": list(self.evidence_urls),
            "confidence": self.confidence,
        }, default_flow_style=False, sort_keys=False)


@dataclass(frozen=True)
class Citation:
    """A citation/reference for traceability.
    
    Semantic Requirement: raw-ish pointers (citations.md).
    """
    url: str
    title: str
    source_type: str = "web"  # web, paper, book
    accessed: str = field(default_factory=lambda: datetime.now(timezone.utc).date().isoformat())
    relevance: str = ""  # Why this citation matters
    
    def to_markdown(self) -> str:
        """Render as markdown citation."""
        return f"- [{self.title}]({self.url}) ({self.source_type}, accessed {self.accessed})"


@dataclass(frozen=True)
class SemanticMapEntry:
    """Entry in the Schema.org-aligned semantic map.
    
    Semantic Requirement: Schema.org JSON-LD context for structured semantics.
    """
    schema_type: str  # Schema.org type (Person, Organization, etc.)
    name: str
    description: str
    properties: dict[str, Any] = field(default_factory=dict)
    source_urls: tuple[str, ...] = field(default_factory=tuple)
    
    def to_jsonld(self) -> dict[str, Any]:
        """Convert to JSON-LD format."""
        return {
            "@context": "https://schema.org",
            "@type": self.schema_type,
            "name": self.name,
            "description": self.description,
            **self.properties,
            "citation": [{"@type": "WebPage", "url": url} for url in self.source_urls],
        }


@dataclass(frozen=True)
class FrontendSpec:
    """Pipeline configuration specification.
    
    Semantic Requirement: Spec YAML as authoritative input.
    Maps directly to docs/architecture/data-models.md schema.
    """
    mode_name: str
    purpose: str
    skills: tuple[str, ...] = field(default_factory=tuple)
    use_cases: tuple[str, ...] = field(default_factory=tuple)
    exemplars: tuple[Exemplar, ...] = field(default_factory=tuple)
    
    # Search configuration
    web_search_backend: SearchBackend = SearchBackend.AUTO
    http_search_providers: tuple[HTTPProvider, ...] = field(
        default_factory=lambda: (HTTPProvider.TAVILY, HTTPProvider.BRAVE)
    )
    enable_hybrid: bool = False
    rrf_k: int = 60
    dense_backend: Optional[str] = None
    
    # Query templates for two-stage swarm
    query_templates: tuple[str, ...] = field(default_factory=lambda: (
        "{name} {field} expertise",
        "{name} methodology approach",
        "{name} key contributions",
    ))
    web_swarm_stage2_query_templates: tuple[str, ...] = field(default_factory=lambda: (
        "{field} standards bodies",
        "{field} professional societies",
        "{field} reference models frameworks",
        "{field} best practices taxonomy",
    ))
    
    # Budgets and limits
    max_budget_usd: float = 1.0
    search_max_results_per_query: int = 10
    semantic_map_reduce_enable: bool = False
    
    # Seeding and output configuration
    seed_modes: tuple[str, ...] = field(default_factory=tuple)
    deepening_cycles: int = 0  # Extra learning/deepening passes (max 11)
    deepening_strategy: str = "auto"  # auto | segmentation | drilldown | hybrid
    merge_strategy: str = "merge"  # "merge" or "separate"
    kilocode_config_path: Optional[Path] = None
    out_dir: Path = field(default_factory=lambda: Path("reports"))
    
    # Calibration / self-tuning
    calibration_enabled: bool = True
    calibration_model_path: Optional[Path] = None
    
    # Direct corpus injection
    corpus_text: Optional[str] = None
    
    @classmethod
    def from_yaml(cls, yaml_path: Path) -> FrontendSpec:
        """Load spec from YAML file.
        
        Builder pattern: constructs validated FrontendSpec from config.
        """
        with open(yaml_path) as f:
            raw = yaml.safe_load(f)
        
        exemplars = tuple(
            Exemplar(
                name=e["name"],
                url=e.get("url"),
                is_author=e.get("is_author", False),
                salts=tuple(e.get("salts", [])),
            )
            for e in raw.get("exemplars", [])
        )
        
        http_providers = tuple(
            p for p in (
                HTTPProvider.from_string(s)
                for s in raw.get("http_search_providers", ["tavily", "brave"])
            )
            if p is not None
        )
        
        # Get default values by creating a temporary instance
        #default_spec = cls()
        
        return cls(
            mode_name=raw.get("mode_name", Path(yaml_path).stem),
            purpose=raw.get("purpose", ""),
            skills=tuple(raw.get("skills", [])),
            use_cases=tuple(raw.get("use_cases", [])),
            exemplars=exemplars,
            web_search_backend=SearchBackend.from_string(
                raw.get("web_search_backend", "auto")
            ),
            http_search_providers=http_providers,
            enable_hybrid=bool(raw.get("enable_hybrid", False)),
            rrf_k=int(raw.get("rrf_k", 60)),
            dense_backend=raw.get("dense_backend"),
            query_templates=tuple(raw.get("query_templates", [])) or (
                "{name} {field} expertise",
                "{name} methodology approach",
                "{name} key contributions",
            ),
            web_swarm_stage2_query_templates=tuple(
                raw.get("web_swarm_stage2_query_templates", [])
            ) or (
                "{field} standards bodies",
                "{field} professional societies",
                "{field} reference models frameworks",
                "{field} best practices taxonomy",
            ),
            max_budget_usd=raw.get("max_budget_usd", 1.0),
            search_max_results_per_query=raw.get("search_max_results_per_query", 10),
            semantic_map_reduce_enable=raw.get("semantic_map_reduce_enable", False),
            seed_modes=tuple(raw.get("seed_modes", [])),
            deepening_cycles=max(0, min(int(raw.get("deepening_cycles", 0)), 11)),
            deepening_strategy=str(raw.get("deepening_strategy", "auto")),
            merge_strategy=str(raw.get("merge_strategy", "merge")),
            kilocode_config_path=Path(raw["kilocode_config_path"]) if "kilocode_config_path" in raw else None,
            out_dir=Path(raw.get("out_dir", "reports")),
            calibration_enabled=bool(raw.get("calibration_enabled", True)),
            calibration_model_path=Path(raw["calibration_model_path"]) if "calibration_model_path" in raw else None,
        )
    
    def with_overrides(self, **kwargs: Any) -> "FrontendSpec":
        """Return a new spec with selected fields overridden.
        
        Keeps FrontendSpec immutable while enabling calibration-driven tuning.
        Unknown fields are ignored for forward compatibility.
        """
        allowed = {
            "enable_hybrid",
            "rrf_k",
            "dense_backend",
            "search_max_results_per_query",
            "deepening_cycles",
            "deepening_strategy",
            "calibration_enabled",
            "calibration_model_path",
        }
        updates = {k: v for k, v in kwargs.items() if k in allowed}
        if not updates:
            return self
        return FrontendSpec(**{**self.__dict__, **updates})
    
    def get_output_path(self, filename: str) -> Path:
        """Get full path for an output artifact."""
        return self.out_dir / self.mode_name / filename

    def telemetry_summary(self) -> dict[str, Any]:
        """Lightweight summary for run.start events."""
        return {
            "mode": self.mode_name,
            "enable_hybrid": self.enable_hybrid,
            "rrf_k": self.rrf_k,
            "dense_backend": self.dense_backend,
            "providers": [p.value for p in self.http_search_providers],
            "search_max_results_per_query": self.search_max_results_per_query,
            "deepening_cycles": self.deepening_cycles,
            "deepening_strategy": self.deepening_strategy,
            "calibration_enabled": self.calibration_enabled,
            "calibration_model_path": str(self.calibration_model_path) if self.calibration_model_path else None,
        }

    def get_env_var(self, key: str) -> str:
        """Get environment variable value."""
        import os
        return os.environ.get(key, "")
    
    def get_api_keys(self) -> dict[str, str]:
        """Get all available API keys for search providers."""
        return {
            "tavily": self.get_env_var("TAVILY_API_KEY"),
            "brave": self.get_env_var("BRAVE_API_KEY"),
        }
    
    def has_any_api_key(self) -> bool:
        """Check if any API key is configured."""
        keys = self.get_api_keys()
        return any(key.strip() for key in keys.values())
    
    def get_available_providers(self) -> list[str]:
        """Get list of providers with configured API keys."""
        keys = self.get_api_keys()
        return [provider for provider, key in keys.items() if key.strip()]
    
    def check_dependencies(self) -> dict[str, bool]:
        """Check if all required dependencies are available."""
        import shutil
        return {
            "go_binary": Path("bin/search-swarm").exists(),
            "java_runtime": shutil.which("java") is not None,
            "clojure_uberjar": Path("semantic_synthesis/target/semantic-synthesis.jar").exists(),
            "any_api_keys": self.has_any_api_key(),
        }

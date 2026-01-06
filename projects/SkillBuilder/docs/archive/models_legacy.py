from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass(frozen=True)
class Exemplar:
    name: str
    url: Optional[str] = None
    is_author: bool = False


@dataclass(frozen=True)
class IdentitySpec:
    raw: str
    purpose: str
    skills: List[str]
    use_cases: List[str]
    exemplars: List[Exemplar]
    out_dir: Path
    mode_name: str


@dataclass(frozen=True)
class ParsedIdentity:
    raw: str
    normalized: str
    base_identity: str
    expertise_level: Optional[str]
    domains: List[str]
    keywords: List[str]


@dataclass
class SearchQuery:
    stage: int
    text: str
    exemplar: Optional[str] = None


@dataclass
class SearchHit:
    title: str
    url: Optional[str]
    snippet: str
    trust: float = 0.5


@dataclass
class SearchResult:
    query: SearchQuery
    hits: List[SearchHit]


@dataclass
class SemanticArtifacts:
    semantic_map_md: str
    citations_md: str
    skills_md: str
    reference_md: str
    mode_md: str
    telemetry_events: List[Dict[str, Any]] = field(default_factory=list)

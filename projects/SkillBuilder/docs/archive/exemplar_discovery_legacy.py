from __future__ import annotations

import re
from typing import Iterable, List

from .config_loader import SemanticConfig, get_template
from .models import ParsedIdentity, SearchHit, SearchQuery, SearchResult


_NAME_RE = re.compile(r"\b([A-Z][a-z]+(?:[-'][A-Za-z]+)?\s+[A-Z][a-z]+(?:[-'][A-Za-z]+)?)\b")
_BLOCK_TOKENS = {"University", "Inc", "LLC", "Ltd", "Corp"}


def build_stage1_queries(identity: ParsedIdentity, config: SemanticConfig) -> List[SearchQuery]:
    templates = get_template(config, "exemplar_discovery", "queries") or []
    out: List[SearchQuery] = []
    for tmpl in templates:
        try:
            q = tmpl.format(
                identity=identity.base_identity or identity.raw,
                domain=identity.domains[0] if identity.domains else "",
                expertise=identity.expertise_level or "",
            )
        except Exception:
            q = tmpl
        q = " ".join(str(q).split())
        if q:
            out.append(SearchQuery(stage=1, text=q))
    return out


def build_stage2_queries(identity: ParsedIdentity, config: SemanticConfig) -> List[SearchQuery]:
    templates = get_template(config, "stage2_anchors", "queries") or []
    keywords = ", ".join(identity.keywords[:6])
    out: List[SearchQuery] = []
    for tmpl in templates:
        try:
            q = tmpl.format(
                field=identity.domains[0] if identity.domains else identity.base_identity,
                keywords=keywords,
            )
        except Exception:
            q = tmpl
        q = " ".join(str(q).split())
        if q:
            out.append(SearchQuery(stage=2, text=q))
    return out


def _extract_names(blob: str) -> List[str]:
    out: List[str] = []
    for m in _NAME_RE.finditer(blob or ""):
        name = m.group(1).strip()
        if any(tok in name for tok in _BLOCK_TOKENS):
            continue
        if name not in out:
            out.append(name)
    return out


def simple_offline_search(queries: Iterable[SearchQuery], identity: ParsedIdentity) -> List[SearchResult]:
    results: List[SearchResult] = []
    fallback_hits = [
        SearchHit(
            title=f"{identity.base_identity} overview",
            url=None,
            snippet=f"Context about {identity.base_identity} focusing on {', '.join(identity.keywords[:4])}.",
            trust=0.6,
        )
    ]
    for q in queries:
        results.append(SearchResult(query=q, hits=list(fallback_hits)))
    return results


def discover_exemplars(results: Iterable[SearchResult], max_candidates: int = 5) -> List[str]:
    counts = {}
    for res in results:
        for hit in res.hits:
            for name in _extract_names(hit.snippet + " " + (hit.title or "")):
                counts[name] = counts.get(name, 0) + 1
    ranked = sorted(counts.items(), key=lambda x: (-x[1], x[0]))
    return [name for name, _ in ranked[:max_candidates]]

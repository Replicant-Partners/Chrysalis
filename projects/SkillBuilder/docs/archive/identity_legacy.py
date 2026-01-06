from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

from .config_loader import SemanticConfig
from .models import ParsedIdentity


_WORD_RE = re.compile(r"[A-Za-z][A-Za-z\-']+")


def _normalize(text: str) -> str:
    return " ".join(_WORD_RE.findall((text or "").lower()))


def _extract_expertise(expertise_cfg: Dict[str, Any], normalized: str) -> Tuple[Optional[str], str]:
    levels = expertise_cfg.get("levels")
    if not isinstance(levels, dict):
        return None, normalized

    for level_name, meta in levels.items():
        if not isinstance(level_name, str) or not isinstance(meta, dict):
            continue
        candidates: List[str] = [level_name]
        syn = meta.get("synonyms")
        if isinstance(syn, list):
            candidates.extend([s for s in syn if isinstance(s, str)])
        for cand in candidates:
            c_norm = _normalize(cand)
            if not c_norm:
                continue
            if re.search(rf"\b{re.escape(c_norm)}\b", normalized):
                cleaned = re.sub(rf"\b{re.escape(c_norm)}\b", " ", normalized).strip()
                cleaned = re.sub(r"\s+", " ", cleaned)
                return level_name, cleaned
    return None, normalized


def _infer_domains(domains_cfg: Dict[str, Any], normalized: str) -> List[str]:
    ranked: List[Tuple[str, int]] = []
    for domain, meta in domains_cfg.items():
        if not isinstance(domain, str) or not isinstance(meta, dict):
            continue
        score = 0
        kws = meta.get("keywords") if isinstance(meta.get("keywords"), list) else []
        for kw in kws:
            if not isinstance(kw, str):
                continue
            kw_norm = _normalize(kw)
            if kw_norm and re.search(rf"\b{re.escape(kw_norm)}\b", normalized):
                score += 1
        if score > 0:
            ranked.append((domain, score))
    ranked.sort(key=lambda x: (-x[1], x[0]))
    return [d for d, _ in ranked[:3]]


def resolve_identity(
    *,
    identity: str,
    purpose: str,
    config: SemanticConfig,
    explicit_domains: Optional[List[str]] = None,
    explicit_expertise: Optional[str] = None,
    extra_keywords: Optional[List[str]] = None,
) -> ParsedIdentity:
    normalized = _normalize(identity)
    expertise, cleaned = (
        (explicit_expertise.strip(), normalized)
        if explicit_expertise
        else _extract_expertise(config.expertise_levels, normalized)
    )

    domains: List[str] = []
    if explicit_domains:
        domains = [d.strip() for d in explicit_domains if isinstance(d, str) and d.strip()]
    if not domains:
        domains = _infer_domains(config.domains, normalized)

    keywords: List[str] = []
    if extra_keywords:
        keywords.extend([k.strip() for k in extra_keywords if isinstance(k, str) and k.strip()])
    keywords.extend(domains)
    if expertise:
        keywords.append(expertise)
    keywords.append(purpose)

    base_identity = cleaned if cleaned else normalized
    return ParsedIdentity(
        raw=identity,
        normalized=normalized,
        base_identity=base_identity,
        expertise_level=expertise,
        domains=list(dict.fromkeys([k for k in domains if k])),
        keywords=list(dict.fromkeys([k for k in keywords if k])),
    )

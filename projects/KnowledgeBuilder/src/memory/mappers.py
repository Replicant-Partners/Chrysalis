"""Mapping utilities to convert pipeline outputs into memory artifacts."""

from __future__ import annotations

from typing import Dict, List, Sequence

import numpy as np

from memory_system.ports import KnowledgeArtifact


def _normalize_embedding(value) -> Sequence[float]:
    if value is None:
        return []
    if isinstance(value, np.ndarray):
        return value.astype(float).tolist()
    if isinstance(value, (list, tuple)):
        return [float(v) for v in value]
    return []


def artifact_from_result(agent_id: str, result: Dict[str, object]) -> KnowledgeArtifact:
    entity: Dict[str, object] = result.get("entity", {})  # type: ignore[assignment]
    resolved: Dict[str, object] = result.get("resolved", {})  # type: ignore[assignment]
    attributes: Dict[str, object] = result.get("attributes", {})  # type: ignore[assignment]

    entity_id = str(entity.get("id") or resolved.get("schema_uri") or resolved.get("name") or "entity:unknown")
    entity_type = str(entity.get("type") or resolved.get("schema_type") or "Unknown")
    name = str(entity.get("name") or resolved.get("name") or entity_id)
    text = str(entity.get("text") or attributes.get("summary") or name)

    embedding = _normalize_embedding(result.get("embedding"))
    completeness = float(entity.get("completeness_score") or 0.0)
    quality = float(entity.get("quality_score") or 0.0)
    trust = float(entity.get("trust_score") or 0.0)

    source_metadata: Dict[str, object] = {
        "resolved": resolved,
        "sources": result.get("sources") or [],
        "merge_stats": result.get("merge_stats"),
        "extracted_facts": result.get("extracted_facts"),
        "enrichment_used": result.get("enrichment_used"),
    }

    return KnowledgeArtifact(
        agent_id=agent_id,
        entity_id=entity_id,
        entity_type=entity_type,
        name=name,
        text=text,
        attributes=attributes,
        embedding=embedding,
        completeness_score=completeness,
        quality_score=quality,
        trust_score=trust,
        source_metadata=source_metadata,
    )


def artifacts_from_results(agent_id: str, results: List[Dict[str, object]]) -> List[KnowledgeArtifact]:
    return [artifact_from_result(agent_id, result) for result in results or []]

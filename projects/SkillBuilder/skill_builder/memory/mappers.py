"""Mapping helpers for SkillBuilder memory persistence."""

from __future__ import annotations

import hashlib
from typing import Any, Dict, List, Sequence

from memory_system.ports import SkillArtifact


def _hash_skill_name(name: str) -> str:
    return hashlib.sha256(name.lower().encode("utf-8")).hexdigest()


def _normalize_embedding(embedding: Sequence[float] | None) -> List[float]:
    if not embedding:
        return []
    return [float(v) for v in embedding]


def _extract_semantic_map(entry: Dict[str, Any]) -> Dict[str, Any]:
    schema_type = entry.get("schema_type") or entry.get("schemaType")
    if not schema_type:
        return {}
    return {
        "@type": schema_type,
        "name": entry.get("name"),
        "description": entry.get("description"),
        "properties": entry.get("properties", {}),
        "source_urls": entry.get("source_urls") or entry.get("sourceUrls") or [],
    }


def _build_evidence(skill: Dict[str, Any]) -> Dict[str, Any]:
    acquired = skill.get("acquired_details", {}) or {}
    evidence_urls = skill.get("evidence_urls", []) or []
    return {
        "rationale": acquired.get("rationale"),
        "sources": evidence_urls,
        "provenance": acquired.get("provenance") or acquired.get("merge_source"),
    }


def _build_metrics(skill: Dict[str, Any]) -> Dict[str, float]:
    metrics: Dict[str, float] = {}
    confidence = skill.get("confidence")
    if isinstance(confidence, (int, float)):
        metrics["confidence"] = float(confidence)
    calibration = skill.get("calibration_score")
    if isinstance(calibration, (int, float)):
        metrics["calibration"] = float(calibration)
    merged_from = skill.get("merged_from")
    if isinstance(merged_from, (int, float)):
        metrics["merged_from"] = float(merged_from)
    return metrics


def skill_artifacts_from_result(
    agent_id: str,
    skills: Sequence[Dict[str, Any]],
    embeddings: Sequence[Sequence[float]] | None = None,
    semantic_map: Sequence[Dict[str, Any]] | None = None,
    occupation: str | None = None,
) -> List[SkillArtifact]:
    artifacts: List[SkillArtifact] = []
    embeddings = embeddings or []
    semantic_map_entries = {entry.get("name"): entry for entry in (semantic_map or [])}

    for index, skill in enumerate(skills or []):
        name = skill.get("name") or "Unnamed Skill"
        skill_id = skill.get("id") or _hash_skill_name(name)
        yaml_block = skill.get("yaml") or skill.get("yaml_block") or skill.get("yamlBlock")
        if not yaml_block and hasattr(skill, "to_yaml_block"):
            try:
                yaml_block = skill.to_yaml_block()  # type: ignore[attr-defined]
            except Exception:  # noqa: BLE001
                yaml_block = f"skill: {name}\ndescription: {skill.get('description')}"

        embedding = embeddings[index] if index < len(embeddings) else []
        semantic = _extract_semantic_map(semantic_map_entries.get(name) or {})

        artifacts.append(
            SkillArtifact(
                agent_id=agent_id,
                skill_id=str(skill_id),
                occupation=occupation or "",
                yaml_block=yaml_block or "",
                embedding=_normalize_embedding(embedding),
                semantic_map=semantic or None,
                evidence=_build_evidence(skill),
                metrics=_build_metrics(skill),
                source_metadata=skill.get("acquired_details", {}),
            )
        )

    return artifacts

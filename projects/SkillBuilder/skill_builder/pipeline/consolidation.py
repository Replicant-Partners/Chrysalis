"""Skill consolidation helpers for deterministic semantic merge."""

from __future__ import annotations

from typing import Sequence, Tuple

from skill_builder.pipeline.models import SkillCard
from skill_builder.pipeline.synthesis import semantic_map_reduce


def _skill_card_to_dict(card: SkillCard) -> dict[str, object]:
    return {
        "name": card.name,
        "description": card.description,
        "triggers": list(card.triggers),
        "artifacts": list(card.artifacts),
        "constraints": list(card.constraints),
        "evidence_urls": list(card.evidence_urls),
        "confidence": float(card.confidence),
    }


def _dict_to_skill_card(data: dict[str, object]) -> SkillCard:
    return SkillCard(
        name=str(data.get("name", "")),
        description=str(data.get("description", "")),
        triggers=tuple(data.get("triggers", []) or []),
        artifacts=tuple(data.get("artifacts", []) or []),
        constraints=tuple(data.get("constraints", []) or []),
        evidence_urls=tuple(data.get("evidence_urls", []) or []),
        confidence=float(data.get("confidence", 0.0) or 0.0),
    )


def consolidate_skill_cards(skills: Sequence[SkillCard]) -> Tuple[SkillCard, ...]:
    """Apply semantic_map_reduce to SkillCard sequences (LLM-free by default)."""

    if not skills:
        return tuple(skills)

    serialized = [_skill_card_to_dict(card) for card in skills]
    reduced = semantic_map_reduce(serialized, use_llm=False) or serialized

    consolidated = tuple(_dict_to_skill_card(item) for item in reduced)
    return consolidated

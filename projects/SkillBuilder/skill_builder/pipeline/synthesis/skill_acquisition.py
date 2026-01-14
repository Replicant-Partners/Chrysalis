"""
Skill acquisition and card generation functions.

Handles skill inference, card generation, and merging with seeded modes.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List

from .llm_client import _has_llm_api, _call_llm_api
from .skill_fetchers import SKILL_PATTERNS, is_valid_skill


def infer_skills(hits: List[Dict[str, Any]]) -> List[str]:
    """
    Extract skills from search hit titles and snippets.
    
    Uses regex patterns to identify skill mentions with validation.
    """
    skills = []
    seen = set()
    
    for hit in hits:
        text = f"{hit.get('title', '')} {hit.get('snippet', '')}"
        
        for pattern in SKILL_PATTERNS:
            for match in pattern.finditer(text):
                skill = match.group(1).strip().lower()
                if is_valid_skill(skill) and skill not in seen:
                    skills.append(skill)
                    seen.add(skill)
    
    return skills[:20]  # Limit to 20 skills


def generate_skill_card(
    skill: str,
    evidence: List[Dict[str, Any]],
    spec: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Generate a skill card with metadata.
    """
    confidence = min(0.9, 0.5 + 0.1 * len(evidence))
    purpose = spec.get("purpose", "the mode's purpose")
    
    return {
        "name": skill.title(),
        "description": f"Capability to apply principles of {skill}",
        "triggers": [
            f"When {skill} expertise is needed",
            f"When working on {skill}-related tasks",
        ],
        "artifacts": [
            f"{skill} analysis",
            f"{skill} recommendations",
        ],
        "constraints": [
            f"Must align with {purpose}",
        ],
        "evidence_urls": [h.get("url", "") for h in evidence[:5]],
        "confidence": confidence,
    }


def acquire_skill_details(
    skill: str,
    evidence: List[Dict[str, Any]],
    spec: Dict[str, Any],
    hf_skills: List[Dict[str, Any]] = None,
    anthropic_skills: List[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Acquire detailed skill card with rationale.
    
    Integrates with HuggingFace and Anthropic skills repositories as anchors.
    """
    base_card = generate_skill_card(skill, evidence, spec)
    
    hf_skills = hf_skills or []
    anthropic_skills = anthropic_skills or []
    
    # Check for HuggingFace skill match
    hf_match = None
    for hf in hf_skills:
        if skill.lower() in hf.get("name", "").lower():
            hf_match = hf
            break
    
    # Check for Anthropic skill match
    anthropic_match = None
    for ant in anthropic_skills:
        if skill.lower() in ant.get("name", "").lower():
            anthropic_match = ant
            break
    
    # Build rationale
    rationale_parts = [f"Acquired through analysis of {len(evidence)} sources"]
    if hf_match:
        rationale_parts.append("verified against HuggingFace skills repository")
    if anthropic_match:
        rationale_parts.append("aligned with Anthropic capabilities")
    rationale = ". ".join(rationale_parts) + "."
    
    # Merge capabilities
    advanced = [f"Deep expertise in {skill}"]
    if hf_match and "capabilities" in hf_match:
        advanced.extend(hf_match["capabilities"])
    if anthropic_match and "capabilities" in anthropic_match:
        advanced.extend(anthropic_match["capabilities"])
    
    base_card["acquired_details"] = {
        "rationale": rationale,
        "hf_reference": hf_match.get("url") if hf_match else None,
        "anthropic_aligned": anthropic_match is not None,
        "advanced_capabilities": list(set(advanced)),
        "suggested_workflows": [f"Standard {skill} workflow"],
    }
    
    return base_card


def merge_seeded_modes(
    skill_cards: List[Dict[str, Any]],
    seeded_modes: List[Dict[str, Any]],
    exemplar_name: str = "",
) -> List[Dict[str, Any]]:
    """
    Semantically merge skills from seeded Kilocode modes with new skills.
    
    Uses LLM analysis when available to:
    1. Identify overlapping capabilities
    2. Synthesize combined skills
    3. Resolve conflicts between seeded and new skills
    """
    from .mode_merging import _simple_merge, _llm_semantic_merge
    
    if not seeded_modes:
        return skill_cards
    
    # Extract seeded mode skills
    seeded_skills = []
    for mode in seeded_modes:
        if not mode:
            continue
        seeded_skills.append({
            "name": mode.get("name", "Unknown Mode"),
            "description": mode.get("roleDefinition", ""),
            "custom_instructions": mode.get("customInstructions", ""),
        })
    
    # If no LLM available, do simple merge with deduplication
    if not _has_llm_api():
        return _simple_merge(skill_cards, seeded_skills)

    # Use LLM for semantic merge
    return _llm_semantic_merge(skill_cards, seeded_skills, exemplar_name)

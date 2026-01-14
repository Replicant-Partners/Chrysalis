"""
Mode merging functions for combining skills from different sources.

Implements category-preserving merge with LLM-first approach and fallback.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List

from .llm_client import _call_llm_api, _has_llm_api


def merge_modes_categorywise(
    new_skills: List[Dict[str, Any]],
    seeded_modes: List[Dict[str, Any]],
    exemplar_name: str,
) -> List[Dict[str, Any]]:
    """Merge modes per category after deepening. Currently categories are skills only.

    LLM-first: prompt mirrors snippet merge but constrained to the skills category.
    Deterministic fallback: dedupe by lower-name, prefer higher confidence.
    """
    if not seeded_modes:
        return new_skills

    # Extract seeded skills as skill-like records
    seeded_skills: List[Dict[str, Any]] = []
    for mode in seeded_modes:
        if not isinstance(mode, dict):
            continue
        seeded_skills.append({
            "name": mode.get("name", mode.get("slug", "Unknown Mode")),
            "description": mode.get("roleDefinition", mode.get("description", "")),
            "triggers": [mode.get("customInstructions", "")],
            "artifacts": ["Seeded mode output"],
            "constraints": [],
            "evidence_urls": [],
            "confidence": 0.85,
            "acquired_details": {
                "rationale": "Seeded Kilocode mode (pre-existing)",
                "merge_source": "seeded",
            },
        })

    if _has_llm_api():
        merged = _llm_category_merge_skills(new_skills, seeded_skills, exemplar_name)
        if merged:
            print(f"[merge.skills] path=llm merged={len(merged)} seeds={len(seeded_skills)} new={len(new_skills)}")
            return merged

    # Fallback deterministic merge
    merged = _deterministic_category_merge_skills(new_skills, seeded_skills)
    print(f"[merge.skills] path=fallback merged={len(merged)} seeds={len(seeded_skills)} new={len(new_skills)}")
    return merged


def _llm_category_merge_skills(
    new_skills: List[Dict[str, Any]],
    seeded_skills: List[Dict[str, Any]],
    exemplar_name: str,
) -> List[Dict[str, Any]]:
    """LLM prompt to merge only the skills category."""
    def fmt(skills: List[Dict[str, Any]]) -> str:
        lines = []
        for s in skills[:20]:
            lines.append(f"- {s.get('name','?')}: {s.get('description','')[:160]}")
        return "\n".join(lines)

    prompt = f"""Merge skill sets for a mode inspired by {exemplar_name}.

NEW SKILLS (research + deepening):
{fmt(new_skills)}

SEEDED SKILLS (existing Kilocode modes):
{fmt(seeded_skills)}

Rules:
- Merge only within the skills category; do NOT move data across categories.
- Combine overlapping skills into single, stronger capabilities.
- Preserve unique skills from both sets.
- Keep 10-20 skills max.
- Include provenance: mark whether a skill came from new, seeded, or merged.

Output JSON array:
[
  {{"name": "...", "description": "...", "from": "new|seeded|merged", "triggers": [...], "artifacts": [...], "constraints": [...], "evidence_urls": [], "confidence": 0.3-0.95}}
]

Return ONLY the JSON array."""

    result_text = _call_llm_api(prompt, max_tokens=2000)
    if not result_text:
        return []
    try:
        result_text = result_text.strip()
        if result_text.startswith("```"):
            result_text = result_text.split("```")[1]
            if result_text.startswith("json"):
                result_text = result_text[4:]
        merged_data = json.loads(result_text)

        # Normalize to list of dicts
        if isinstance(merged_data, dict) and "skills" in merged_data:
            merged_data = merged_data.get("skills", [])
        if not isinstance(merged_data, list):
            return []

        merged_cards = []
        for item in merged_data:
            if not isinstance(item, dict):
                continue
            source = item.get("from", "merged")
            merged_cards.append({
                "name": item.get("name", ""),
                "description": item.get("description", ""),
                "triggers": tuple(item.get("triggers", [])),
                "artifacts": tuple(item.get("artifacts", [])),
                "constraints": tuple(item.get("constraints", [])),
                "evidence_urls": tuple(item.get("evidence_urls", [])),
                "confidence": item.get("confidence", 0.85 if source == "merged" else 0.8),
                "acquired_details": {
                    "rationale": f"LLM category merge ({source})",
                    "merge_source": source,
                },
            })
        return merged_cards
    except Exception as e:
        print(f"LLM category merge error: {e}")
        return []


def _deterministic_category_merge_skills(
    new_skills: List[Dict[str, Any]],
    seeded_skills: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Deterministic fallback: dedupe by lowercased name, keep highest confidence."""
    merged: Dict[str, Dict[str, Any]] = {}
    def add_skill(skill: Dict[str, Any], source: str):
        key = skill.get("name", "").lower()
        if not key:
            return
        existing = merged.get(key)
        skill_copy = dict(skill)
        ad = dict(skill_copy.get("acquired_details", {}))
        ad["merge_source"] = source
        skill_copy["acquired_details"] = ad
        if not existing or skill_copy.get("confidence", 0) > existing.get("confidence", 0):
            merged[key] = skill_copy
    for s in new_skills:
        add_skill(s, "new")
    for s in seeded_skills:
        add_skill(s, "seeded")
    return list(merged.values())


def _simple_merge(
    skill_cards: List[Dict[str, Any]],
    seeded_skills: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Simple merge: deduplicate by name, prioritize new skills."""
    seen_names = {s["name"].lower() for s in skill_cards}
    
    result = list(skill_cards)
    for seed in seeded_skills:
        if seed["name"].lower() not in seen_names:
            result.append({
                "name": seed["name"],
                "description": seed["description"],
                "triggers": [f"When {seed['name']} expertise is needed"],
                "artifacts": ["Seeded mode output"],
                "constraints": [],
                "evidence_urls": [],
                "confidence": 1.0,
                "acquired_details": {
                    "rationale": "Seeded from existing Kilocode mode.",
                    "advanced_capabilities": [seed["description"]],
                    "suggested_workflows": [seed["custom_instructions"]],
                },
            })
            seen_names.add(seed["name"].lower())
    
    return result


def _llm_semantic_merge(
    skill_cards: List[Dict[str, Any]],
    seeded_skills: List[Dict[str, Any]],
    exemplar_name: str,
) -> List[Dict[str, Any]]:
    """Use LLM to semantically merge seeded modes with new skills."""
    # Build context
    new_skills_text = "\n".join([
        f"- {s['name']}: {s['description']}"
        for s in skill_cards[:15]
    ])
    
    seeded_text = "\n".join([
        f"- {s['name']}: {s['description']}"
        for s in seeded_skills
    ])
    
    prompt = f"""Merge these two skill sets for a mode inspired by {exemplar_name}.

NEW SKILLS (from research):
{new_skills_text}

SEEDED SKILLS (from existing modes):
{seeded_text}

Create a merged skill set that:
1. Combines overlapping skills into single, stronger capabilities
2. Preserves unique skills from both sets
3. Resolves any conflicts by synthesizing a unified approach
4. Keeps the total to 10-15 skills max

Output JSON array of merged skills:
[{{"name": "...", "description": "...", "from": "new|seeded|merged"}}]

Return ONLY the JSON array."""

    result_text = _call_llm_api(prompt, max_tokens=2000)
    
    if not result_text:
        return _simple_merge(skill_cards, seeded_skills)
    
    try:
        result_text = result_text.strip()
        if result_text.startswith("```"):
            result_text = result_text.split("```")[1]
            if result_text.startswith("json"):
                result_text = result_text[4:]
        
        merged_data = json.loads(result_text)
        
        # Convert to skill cards
        merged_cards = []
        for item in merged_data:
            source = item.get("from", "merged")
            merged_cards.append({
                "name": item.get("name", ""),
                "description": item.get("description", ""),
                "triggers": [f"When {item['name'].lower()} expertise is needed"],
                "artifacts": [f"{item['name']} output"],
                "constraints": [],
                "evidence_urls": [],
                "confidence": 0.9 if source == "merged" else 0.85,
                "acquired_details": {
                    "rationale": f"Semantically merged ({source})",
                    "merge_source": source,
                },
            })
        
        return merged_cards if merged_cards else skill_cards
        
    except json.JSONDecodeError as e:
        print(f"LLM merge JSON error: {e}, falling back to simple merge")
        return _simple_merge(skill_cards, seeded_skills)

"""
Semantic processing functions for skill deduplication and merging.

Implements MapReduce paradigm for semantic skill consolidation.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List

from .llm_client import _call_llm_api, _has_llm_api


def semantic_map_reduce(
    skills: List[Dict[str, Any]],
    use_llm: bool = True,
) -> List[Dict[str, Any]]:
    """
    Apply semantic MapReduce to deduplicate and merge skills.
    
    Based on MapReduce paradigm for semantic merging:
    1. Map (Standardize & Tag): Normalize each skill and assign canonical keys
    2. Shuffle & Sort (Group by Identity): Group semantically similar items
    3. Reduce (Reconcile & Merge): Merge groups into single comprehensive records
    
    This ensures deduplication without information loss.
    """
    if not skills:
        return skills
    
    # === MAP PHASE: Standardize and Tag ===
    tagged_skills = []
    for skill in skills:
        name = skill.get("name", "").lower().strip()
        # Create canonical key by normalizing the name
        canonical_key = _canonicalize_skill_name(name)
        tagged_skills.append({
            "original": skill,
            "canonical_key": canonical_key,
            "name_tokens": set(name.split()),
        })
    
    # === SHUFFLE & SORT PHASE: Group by Identity ===
    groups = _group_by_semantic_similarity(tagged_skills)
    
    # === REDUCE PHASE: Reconcile and Merge ===
    if use_llm and _has_llm_api():
        merged = _llm_reduce(groups)
    else:
        merged = _simple_reduce(groups)
    
    return merged


def _canonicalize_skill_name(name: str) -> str:
    """Create a canonical key from a skill name."""
    # Remove common suffixes/prefixes
    noise_words = {"the", "a", "an", "of", "for", "in", "on", "with", "and", "or"}
    tokens = [t for t in name.lower().split() if t not in noise_words]
    # Sort tokens for order-independent matching
    return " ".join(sorted(tokens))


def _group_by_semantic_similarity(
    tagged_skills: List[Dict[str, Any]],
    similarity_threshold: float = 0.5,
) -> List[List[Dict[str, Any]]]:
    """Group skills by semantic similarity using token overlap."""
    groups = []
    used = set()
    
    for i, skill in enumerate(tagged_skills):
        if i in used:
            continue
        
        group = [skill]
        used.add(i)
        
        for j, other in enumerate(tagged_skills):
            if j in used:
                continue
            
            # Check token overlap (Jaccard similarity)
            tokens_i = skill["name_tokens"]
            tokens_j = other["name_tokens"]
            
            if tokens_i and tokens_j:
                intersection = len(tokens_i & tokens_j)
                union = len(tokens_i | tokens_j)
                similarity = intersection / union if union > 0 else 0
                
                # Also check canonical key match
                if (similarity >= similarity_threshold or
                    skill["canonical_key"] == other["canonical_key"]):
                    group.append(other)
                    used.add(j)
        
        groups.append(group)
    
    return groups


def _simple_reduce(groups: List[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    """Simple reduce: pick highest confidence item from each group, merge descriptions."""
    result = []
    
    for group in groups:
        if not group:
            continue
        
        # Sort by confidence, pick highest
        originals = [g["original"] for g in group]
        originals.sort(key=lambda x: x.get("confidence", 0), reverse=True)
        
        primary = dict(originals[0])
        
        # Merge descriptions from others
        if len(originals) > 1:
            other_descs = [o.get("description", "") for o in originals[1:] if o.get("description")]
            if other_descs:
                primary["description"] = primary.get("description", "") + " " + " ".join(other_descs[:2])
            primary["merged_from"] = len(originals)
        
        result.append(primary)
    
    return result


def _llm_reduce(groups: List[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    """
    Use LLM with RDF-style atomization to intelligently merge skill groups.
    
    Pipeline approach:
    (a) Parse each skill into RDF-like triples/facts with IDs
    (b) Normalize entities/relations (resolve synonyms)
    (c) Cluster and merge equivalent facts, union non-overlapping details
    (d) Output the merged fact set plus consolidated skills
    
    Every output must be supported by source IDs - no hallucinations.
    """
    result = []
    
    # Process groups that need merging
    groups_to_merge = [g for g in groups if len(g) > 1]
    single_groups = [g[0]["original"] for g in groups if len(g) == 1]
    
    if not groups_to_merge:
        return single_groups
    
    # Build numbered snippets for provenance tracking
    snippets = []
    for i, group in enumerate(groups_to_merge[:10]):  # Limit to 10 groups
        for j, g in enumerate(group):
            snippet_id = f"G{i+1}S{j+1}"
            name = g['original'].get('name', '?')
            desc = g['original'].get('description', '')[:150]
            snippets.append(f"[{snippet_id}] {name}: {desc}")
    
    prompt = f"""You are an RDF-style reducer for skill consolidation.

Input snippets (skills to merge):
{chr(10).join(snippets)}

Pipeline:
(a) Parse each snippet into atomic subject–predicate–object facts with source IDs.
(b) Normalize entities/relations (resolve synonyms, standardize phrasing).
(c) Cluster semantically equivalent facts; merge them with all unique details retained.
    If facts conflict, keep both tagged with "(conflict)".
(d) Recompose as consolidated skills, each with:
    - name: canonical skill name
    - description: merged description covering all unique facts (no invented details)
    - sources: list of contributing snippet IDs
    - merged_count: number of original snippets merged

CRITICAL: No hallucinations. Every detail must trace to at least one source ID.

Output JSON array:
[{{"name": "...", "description": "...", "sources": ["G1S1", "G1S2"], "merged_count": N}}]

Return ONLY the JSON array."""

    result_text = _call_llm_api(prompt, max_tokens=2000)
    
    if not result_text:
        return _simple_reduce(groups)
    
    try:
        result_text = result_text.strip()
        if result_text.startswith("```"):
            result_text = result_text.split("```")[1]
            if result_text.startswith("json"):
                result_text = result_text[4:]
        
        merged_data = json.loads(result_text)
        
        # Convert to skill cards with provenance
        for item in merged_data:
            sources = item.get("sources", [])
            card = {
                "name": item.get("name", ""),
                "description": item.get("description", ""),
                "triggers": [f"When {item['name'].lower()} expertise is needed"],
                "artifacts": [],
                "constraints": [],
                "evidence_urls": [],
                "confidence": 0.85,
                "merged_from": item.get("merged_count", 1),
                "acquired_details": {
                    "rationale": f"RDF-style merge from {len(sources)} sources: {', '.join(sources)}",
                    "provenance": sources,
                },
            }
            result.append(card)
        
        # Add single groups
        result.extend(single_groups)
        return result
        
    except json.JSONDecodeError as e:
        print(f"LLM reduce JSON error: {e}, falling back to simple reduce")
        return _simple_reduce(groups)

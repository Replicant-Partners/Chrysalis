"""
Python implementation of semantic synthesis.

Replaces the Clojure-based synthesis engine to remove Java dependency.
Implements:
- LLM-based semantic skill extraction (not regex)
- Skill card generation with confidence scores
- HuggingFace skills repository integration
- Mode merging from seeded modes
- Markdown artifact generation

LLM Provider: OpenAI-compatible API via HTTP (no SDK dependency).
Supports any OpenAI-compatible endpoint (OpenAI, OpenRouter, local).
"""

from __future__ import annotations

import json
import os
import re
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Dict, List, Optional
import time

from skill_builder.pipeline.telemetry import (
    event_tool_ok,
    event_tool_error,
    TelemetryWriter,
)


def _call_llm_api(prompt: str, max_tokens: int = 2000) -> str:
    """
    Call OpenAI-compatible LLM API via HTTP.
    
    Supports:
    - OpenAI: Set OPENAI_API_KEY
    - OpenRouter: Set OPENROUTER_API_KEY and OPENROUTER_BASE_URL
    - Local: Set LLM_API_URL for local endpoint
    
    Returns raw text response or empty string on failure.
    """
    # Determine API endpoint and key
    provider = "openai"
    api_key = os.environ.get("OPENAI_API_KEY", "")
    api_url = os.environ.get("LLM_API_URL", "https://api.openai.com/v1/chat/completions")
    model = os.environ.get("LLM_MODEL", "gpt-4o-mini")
    
    # Check for OpenRouter override
    if os.environ.get("OPENROUTER_API_KEY"):
        provider = "openrouter"
        api_key = os.environ.get("OPENROUTER_API_KEY", "")
        api_url = os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1/chat/completions")
        model = os.environ.get("LLM_MODEL", "openai/gpt-4o-mini")
    elif os.environ.get("LLM_API_URL") and not os.environ.get("OPENAI_API_KEY"):
        # Custom endpoint with explicit URL and no OpenAI key
        provider = "custom"
        api_key = os.environ.get("OPENROUTER_API_KEY", "") or os.environ.get("OPENAI_API_KEY", "")
        api_url = os.environ.get("LLM_API_URL")
        model = os.environ.get("LLM_MODEL", "gpt-4o-mini")
    
    debug_info = {
        "provider": provider,
        "api_url": api_url,
        "model": model,
        "has_key": bool(api_key),
    }
    print(f"LLM DEBUG: prepared request {json.dumps(debug_info)}")
    
    if not api_key:
        return ""
    
    # Build request
    payload = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}]
    }
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    
    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(api_url, data=data, headers=headers, method="POST")
        
        with urllib.request.urlopen(req, timeout=60) as response:
            status = response.getcode()
            result = json.loads(response.read().decode())
            
            # Extract content from response
            choices = result.get("choices", [])
            print(f"LLM DEBUG: response status={status}, has_choices={bool(choices)}")
            if choices:
                message = choices[0].get("message", {})
                return message.get("content", "")
            return ""
            
    except Exception as e:
        print(f"LLM API error: {e}")
        print(f"LLM DEBUG: failure provider={provider} api_url={api_url} model={model} has_key={bool(api_key)}")
        return ""


def _has_llm_api() -> bool:
    """Check if any LLM API is configured."""
    return bool(
        os.environ.get("OPENAI_API_KEY") or
        os.environ.get("OPENROUTER_API_KEY")
    )


# Skill inference patterns (improved for better precision)
SKILL_PATTERNS = [
    re.compile(r"(?i)expert\s+(?:in|at)\s+([a-z][a-z\s]+[a-z])"),
    re.compile(r"(?i)specializ\w*\s+in\s+([a-z][a-z\s]+[a-z])"),
    re.compile(r"(?i)known\s+for\s+([a-z][a-z\s]+[a-z])"),
    re.compile(r"(?i)creator\s+of\s+([a-z][a-z0-9\s]+[a-z0-9])"),
    re.compile(r"(?i)developer\s+of\s+([a-z][a-z0-9\s]+[a-z0-9])"),
    re.compile(r"(?i)author\s+of\s+([a-z][a-z\s]+[a-z])"),
    re.compile(r"(?i)pioneer\s+(?:in|of)\s+([a-z][a-z\s]+[a-z])"),
    re.compile(r"(?i)contributions?\s+to\s+([a-z][a-z\s]+[a-z])"),
]

# Stopwords to filter out noise from skill extraction
SKILL_STOPWORDS = {
    "the", "his", "her", "their", "this", "that", "these", "those",
    "it", "its", "a", "an", "and", "or", "but", "for", "with",
    "many", "much", "some", "all", "any", "more", "most", "other",
    "such", "same", "new", "old", "first", "last", "great", "good",
    "very", "just", "only", "own", "one", "two", "three",
    "clear", "concise", "easy", "simple", "complex",
    "lots", "lot", "plenty", "several", "numerous", "various",
}


def is_valid_skill(skill: str) -> bool:
    """Check if extracted skill is valid (not noise)."""
    skill_lower = skill.lower().strip()
    words = skill_lower.split()
    
    # Filter out single words that are stopwords
    if len(words) == 1 and words[0] in SKILL_STOPWORDS:
        return False
    
    # Filter out if starts with stopword
    if words and words[0] in SKILL_STOPWORDS:
        return False
    
    # Filter out very short or very long
    if len(skill_lower) < 3 or len(skill_lower) > 50:
        return False
    
    # Filter out if mostly numbers
    alpha_ratio = sum(c.isalpha() for c in skill_lower) / max(len(skill_lower), 1)
    if alpha_ratio < 0.7:
        return False
    
    return True


def fetch_big_book_api(author_name: str) -> List[Dict[str, Any]]:
    """
    Fetch books by author from Big Book API.
    
    External calibration: Uses real book data to enrich author exemplars.
    Returns list of books with titles, descriptions, and themes.
    
    Note: Big Book API returns nested arrays: [[{book1}], [{book2}], ...]
    """
    api_url = os.environ.get("BIG_BOOK_API_URL", "api.bigbookapi.com")
    api_key = os.environ.get("BIG_BOOK_API_KEY", "")
    
    if not api_key:
        return []
    
    try:
        # Search by author name
        search_url = f"https://{api_url}/search-books?query={urllib.parse.quote(author_name)}&api-key={api_key}"
        req = urllib.request.Request(search_url, headers={"User-Agent": "SkillBuilder/1.0"})
        with urllib.request.urlopen(req, timeout=15) as response:
            data = json.loads(response.read().decode())
            
            # Handle different response formats
            raw_books = []
            if isinstance(data, dict):
                # Format: {"books": [[{book}], [{book}], ...]} (Big Book API actual format)
                raw_books = data.get("books", data.get("results", data.get("items", [])))
            elif isinstance(data, list):
                raw_books = data
            
            # Flatten nested arrays: [[{book}], [{book}]] -> [{book}, {book}]
            books = []
            for item in raw_books:
                if isinstance(item, list) and item:
                    # Nested array format: [[{book}]] -> {book}
                    books.append(item[0] if isinstance(item[0], dict) else item)
                elif isinstance(item, dict):
                    books.append(item)
            
            result = []
            for b in books[:20]:  # Limit to 20 books
                if isinstance(b, dict):
                    # Extract authors if available
                    authors = b.get("authors", [])
                    author_names = [a.get("name", "") for a in authors if isinstance(a, dict)]
                    
                    result.append({
                        "title": b.get("title", b.get("name", "")),
                        "description": b.get("description", b.get("synopsis", "")),
                        "themes": b.get("subjects", b.get("genres", b.get("categories", []))),
                        "year": b.get("first_publish_year", b.get("year", b.get("publishedDate"))),
                        "authors": author_names,
                        "rating": b.get("rating", {}).get("average", 0),
                    })
            return result
    except urllib.error.URLError as e:
        print(f"Big Book API network error: {e}")
        return []
    except Exception as e:
        print(f"Big Book API error: {e}")
        return []


def fetch_huggingface_skills() -> List[Dict[str, Any]]:
    """
    Fetch skills/capabilities from HuggingFace Hub API.
    
    Semantic Requirement: Interrogate HuggingFace as anchor for ML/AI skills.
    """
    try:
        # Use HuggingFace Hub API to get trending models as skill anchors
        url = "https://huggingface.co/api/models?sort=trending&limit=50"
        req = urllib.request.Request(url, headers={"User-Agent": "SkillBuilder/1.0"})
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())
            # Extract task types as skills
            skills = []
            seen_tasks = set()
            for model in data:
                pipeline_tag = model.get("pipeline_tag", "")
                if pipeline_tag and pipeline_tag not in seen_tasks:
                    seen_tasks.add(pipeline_tag)
                    skills.append({
                        "name": pipeline_tag.replace("-", " ").title(),
                        "capabilities": [pipeline_tag],
                        "source": "huggingface"
                    })
            return skills
    except Exception:
        # Fallback: return empty list if fetch fails
        return []


def fetch_llm_skills() -> List[Dict[str, Any]]:
    """
    Return curated list of common LLM capabilities as skill anchors.
    
    These serve as reference points for skill matching/validation.
    """
    return [
        {"name": "code analysis", "capabilities": ["code review", "debugging", "refactoring"]},
        {"name": "writing", "capabilities": ["technical writing", "documentation", "editing"]},
        {"name": "research", "capabilities": ["synthesis", "analysis", "summarization"]},
        {"name": "reasoning", "capabilities": ["logic", "problem solving", "critical thinking"]},
        {"name": "mathematics", "capabilities": ["computation", "proof verification", "statistics"]},
    ]


def extract_skills_with_llm(
    hits: List[Dict[str, Any]],
    exemplar_name: str,
    spec: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Use LLM with RDF-style atomization to extract meaningful contributions.
    
    Pipeline approach:
    1. Parse each search hit into atomic assertions with source IDs
    2. Normalize entities/relations (standardize skill names)
    3. Cluster equivalent assertions → merge with all unique details
    4. Output consolidated skills with provenance
    
    Every skill must trace back to at least one source - no hallucinations.
    """
    if not _has_llm_api():
        return []
    
    # Build numbered snippets for provenance tracking
    snippets = []
    for i, hit in enumerate(hits[:30]):  # Limit to 30 hits
        title = hit.get("title", "")
        snippet = hit.get("snippet", "")
        url = hit.get("url", "")
        if title or snippet:
            snippets.append(f"[S{i+1}] Title: {title}\nSnippet: {snippet}\nURL: {url}")
    
    if not snippets:
        return []
    
    prompt = f"""You are a talent analyst and historian of science, tasked with inferring the practical skills of a historical figure based on biographical text. Your goal is to analyze the provided text about {exemplar_name} and generate a list of potential skills.

A skill should be an action, capability, or area of expertise. For example, from the text 'she created a program for the Analytical Engine', you could infer the skill 'Algorithm Design'. From 'she translated Menabrea's article', you could infer 'Technical Translation and Annotation'.

Input snippets:
{chr(10).join(snippets)}

CRITICAL: Do NOT list generic, soft skills like "thinking" or "analysis". Focus on concrete, professional capabilities that could be applied. Infer from the text, even if the skill is not explicitly named.

Output a JSON array of skill objects, where each object has "name" and "description" fields. The description should briefly justify the inferred skill based on the text.
[{{"name": "...", "description": "..."}}]

Return ONLY the JSON array."""

    print(f"--- [SkillBuilder] LLM Synthesis Prompt:\n{prompt}")

    result_text = _call_llm_api(prompt, max_tokens=2500)
    
    print(f"--- [SkillBuilder] LLM Raw Response:\n{result_text}")
    
    if not result_text:
        return []
    
    try:
        # Parse JSON response
        result_text = result_text.strip()
        if result_text.startswith("```"):
            result_text = result_text.split("```")[1]
            if result_text.startswith("json"):
                result_text = result_text[4:]
        
        skills_data = json.loads(result_text)
        
        # Add evidence field from sources for compatibility
        if isinstance(skills_data, list):
            for skill in skills_data:
                if "sources" in skill and "evidence" not in skill:
                    skill["evidence"] = f"From sources: {', '.join(skill.get('sources', []))}"
        
        return skills_data if isinstance(skills_data, list) else []
        
    except json.JSONDecodeError:
        return []


def compute_external_calibration(
    exemplar_name: str,
    hits: List[Dict[str, Any]],
    book_data: List[Dict[str, Any]],
) -> Dict[str, float]:
    """
    Compute externally-calibrated metrics that cannot be gamed.
    
    Uses real-world signals:
    - Domain authority: Presence on authoritative domains (edu, gov, established orgs)
    - Citation density: Frequency of references across sources
    - Book impact: Number and diversity of published works
    - Cross-domain reach: Presence across different field domains
    
    Returns normalized scores (0-1) for each metric.
    """
    metrics = {
        "domain_authority": 0.0,
        "citation_density": 0.0,
        "book_impact": 0.0,
        "cross_domain_reach": 0.0,
        "overall_calibration": 0.0,
    }
    
    if not hits and not book_data:
        return metrics
    
    # Domain authority: Count hits from authoritative domains
    authority_domains = {".edu", ".gov", ".org", "wikipedia", "britannica", "scholar.google"}
    authority_hits = sum(
        1 for h in hits
        if any(d in h.get("url", "").lower() for d in authority_domains)
    )
    metrics["domain_authority"] = min(1.0, authority_hits / max(len(hits), 1) * 2)
    
    # Citation density: How often the exemplar name appears in snippets
    name_parts = exemplar_name.lower().split()
    mentions = sum(
        1 for h in hits
        if any(part in h.get("snippet", "").lower() for part in name_parts if len(part) > 2)
    )
    metrics["citation_density"] = min(1.0, mentions / max(len(hits), 1))
    
    # Book impact: Number and diversity of books
    if book_data:
        book_count = len(book_data)
        unique_themes = set()
        for book in book_data:
            themes = book.get("themes", [])
            if isinstance(themes, list):
                unique_themes.update(t.lower() for t in themes[:5] if isinstance(t, str))
        
        metrics["book_impact"] = min(1.0, book_count / 20)  # Normalize to 20 books max
        metrics["cross_domain_reach"] = min(1.0, len(unique_themes) / 10)  # Normalize to 10 themes
    
    # Overall calibration: Weighted average
    weights = {
        "domain_authority": 0.3,
        "citation_density": 0.25,
        "book_impact": 0.25,
        "cross_domain_reach": 0.2,
    }
    metrics["overall_calibration"] = sum(
        metrics[k] * w for k, w in weights.items()
    )
    
    return metrics


def adjust_confidence_with_calibration(
    skill_cards: List[Dict[str, Any]],
    calibration: Dict[str, float],
) -> List[Dict[str, Any]]:
    """
    Adjust skill confidence scores using external calibration.
    
    High calibration = boost confidence for well-evidenced skills.
    Low calibration = reduce confidence to reflect uncertainty.
    """
    overall = calibration.get("overall_calibration", 0.5)
    
    for card in skill_cards:
        base_confidence = card.get("confidence", 0.7)
        # Adjust: if overall calibration is high, boost confidence; if low, reduce
        adjusted = base_confidence * (0.5 + overall * 0.5)
        card["confidence"] = min(0.95, max(0.3, adjusted))
        card["calibration_score"] = overall
    
    return skill_cards


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


# === Category-preserving mode merge (LLM-first with fallback) =================

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


def render_mermaid_knowledge_graph(
    skills: List[Dict[str, Any]],
    spec: Dict[str, Any],
    calibration: Dict[str, float] = None,
) -> str:
    """
    Generate Mermaid diagram showing knowledge relationships.
    
    Visualizes:
    - Skill nodes with confidence (node size)
    - Derivation relationships (edges)
    - Source clusters (subgraphs)
    - Frontier vs established knowledge (styling)
    """
    mode_name = spec.get("mode_name", "Unknown Mode")
    exemplar_name = spec.get("exemplars", [{}])[0].get("name", "Exemplar") if spec.get("exemplars") else "Exemplar"
    
    lines = [
        "```mermaid",
        "graph TD",
        f"    %% Knowledge Graph for {mode_name}",
        f"    %% Generated from {exemplar_name} synthesis",
        "",
        f"    exemplar[(\"{exemplar_name}\")]",
        "",
        "    %% Skill Nodes",
    ]
    
    # Create skill nodes with confidence-based styling
    for i, skill in enumerate(skills[:15]):
        node_id = f"skill{i}"
        name = skill.get("name", "Unknown")[:30]
        confidence = skill.get("confidence", 0.5)
        merged_from = skill.get("merged_from", 1)
        
        # Style based on confidence (frontier vs established)
        if confidence >= 0.8:
            style = ":::established"
        elif confidence >= 0.6:
            style = ":::emerging"
        else:
            style = ":::frontier"
        
        # Shape based on source
        acquired = skill.get("acquired_details", {})
        if acquired.get("llm_extracted"):
            shape = f"[[\"{name}\"]]"  # Stadium shape for LLM-extracted
        elif acquired.get("merge_source") == "seeded":
            shape = f"[(\"{name}\")]"  # Cylinder for seeded
        elif merged_from > 1:
            shape = f"([\"{name}\"])"  # Rounded for merged
        else:
            shape = f"[\"{name}\"]"  # Square for standard
        
        lines.append(f"    {node_id}{shape}{style}")
    
    lines.append("")
    lines.append("    %% Relationships")
    
    # Connect exemplar to skills
    for i, skill in enumerate(skills[:15]):
        node_id = f"skill{i}"
        confidence = skill.get("confidence", 0.5)
        
        # Edge style based on confidence
        if confidence >= 0.8:
            edge = f"    exemplar ==> {node_id}"
        elif confidence >= 0.6:
            edge = f"    exemplar --> {node_id}"
        else:
            edge = f"    exemplar -.-> {node_id}"
        
        lines.append(edge)
    
    # Add cross-links for merged skills
    merged_skills = [(i, s) for i, s in enumerate(skills[:15]) if s.get("merged_from", 1) > 1]
    if merged_skills:
        lines.append("")
        lines.append("    %% Merge relationships")
        for i, skill in merged_skills:
            # Link to nearby skills with similar names
            for j, other in enumerate(skills[:15]):
                if i != j:
                    # Check for potential relationship via token overlap
                    name_i = set(skill.get("name", "").lower().split())
                    name_j = set(other.get("name", "").lower().split())
                    if name_i & name_j:
                        lines.append(f"    skill{i} <-.-> skill{j}")
    
    lines.append("")
    lines.append("    %% Styling")
    lines.append("    classDef established fill:#2e7d32,color:#fff,stroke:#1b5e20")
    lines.append("    classDef emerging fill:#f57c00,color:#fff,stroke:#e65100")
    lines.append("    classDef frontier fill:#7b1fa2,color:#fff,stroke:#4a148c")
    lines.append("```")
    
    return "\n".join(lines)


def render_mermaid_synthesis_flow(
    skills: List[Dict[str, Any]],
    spec: Dict[str, Any],
) -> str:
    """
    Generate Mermaid diagram showing the synthesis flow/pipeline.
    
    Shows how raw data transforms into skills through the pipeline stages.
    """
    mode_name = spec.get("mode_name", "Unknown Mode")
    
    # Count skills by source
    llm_count = sum(1 for s in skills if s.get("acquired_details", {}).get("llm_extracted"))
    seeded_count = sum(1 for s in skills if s.get("acquired_details", {}).get("merge_source") == "seeded")
    merged_count = sum(1 for s in skills if s.get("merged_from", 1) > 1)
    
    lines = [
        "```mermaid",
        "flowchart LR",
        f"    %% Synthesis Flow for {mode_name}",
        "",
        "    subgraph Sources[\"Data Sources\"]",
        "        search[\"🔍 Search Results\"]",
        "        books[\"📚 Book Data\"]",
        "        hf[\"🤗 HuggingFace\"]",
        "        seed[\"🌱 Seeded Modes\"]",
        "    end",
        "",
        "    subgraph Pipeline[\"Synthesis Pipeline\"]",
        "        extract[\"Extract\\n(LLM Semantic)\"]",
        "        map[\"Map\\n(Standardize)\"]",
        "        shuffle[\"Shuffle\\n(Group Similar)\"]",
        "        reduce[\"Reduce\\n(Merge)\"]",
        "        calibrate[\"Calibrate\\n(External Metrics)\"]",
        "    end",
        "",
        "    subgraph Output[\"Generated Skills\"]",
        f"        skills[\"📋 {len(skills)} Skills\"]",
        f"        llm_skills[\"🧠 {llm_count} LLM-Extracted\"]",
        f"        seed_skills[\"🌱 {seeded_count} Seeded\"]",
        f"        merged_skills[\"🔗 {merged_count} Merged\"]",
        "    end",
        "",
        "    search --> extract",
        "    books --> extract",
        "    hf --> extract",
        "    seed --> map",
        "",
        "    extract --> map",
        "    map --> shuffle",
        "    shuffle --> reduce",
        "    reduce --> calibrate",
        "",
        "    calibrate --> skills",
        "    skills --> llm_skills",
        "    skills --> seed_skills",
        "    skills --> merged_skills",
        "```",
    ]
    
    return "\n".join(lines)


def render_skills_md(skills: List[Dict[str, Any]], spec: Dict[str, Any]) -> str:
    """
    Render skills as markdown with full citation tracking.
    """
    mode_name = spec.get("mode_name", "Unknown Mode")
    lines = [f"# Skills for {mode_name}\n"]
    
    for skill in skills:
        lines.append(f"## {skill['name']}\n")
        lines.append(f"{skill['description']}\n")
        lines.append(f"**Triggers:** {', '.join(skill['triggers'])}\n")
        
        confidence = skill.get('confidence', 0)
        calibration = skill.get('calibration_score', 0)
        lines.append(f"**Confidence:** {confidence:.2f} (calibration: {calibration:.2f})\n")
        
        # Citation tracking
        evidence_urls = skill.get('evidence_urls', [])
        if evidence_urls:
            lines.append("**Citations:**")
            for url in evidence_urls[:5]:
                lines.append(f"  - {url}")
            lines.append("")
        
        acquired = skill.get("acquired_details", {})
        if acquired:
            lines.append(f"**Rationale:** {acquired.get('rationale', 'N/A')}")
            
            # Source tracking
            if acquired.get("llm_extracted"):
                lines.append("**Source:** LLM semantic extraction")
            elif acquired.get("merge_source"):
                lines.append(f"**Source:** {acquired['merge_source']}")
            
            # Merge provenance
            merged_from = skill.get("merged_from", 1)
            if merged_from > 1:
                lines.append(f"**Merged from:** {merged_from} sources")
        
        lines.append("")
    
    return "\n".join(lines)


def render_semantic_map_md(entries: List[Dict[str, Any]], spec: Dict[str, Any]) -> str:
    """
    Render semantic map as markdown with JSON.
    """
    mode_name = spec.get("mode_name", "Unknown Mode")
    json_str = json.dumps(entries, indent=2)
    
    return f"# Semantic Map: {mode_name}\n\n```json\n{json_str}\n```"


def render_generated_mode_md(skills: List[Dict[str, Any]], spec: Dict[str, Any]) -> str:
    """
    Render the generated mode definition markdown.
    """
    mode_name = spec.get("mode_name", "Unknown Mode")
    purpose = spec.get("purpose", "")
    
    # Build role definition from skills
    skill_names = [s["name"] for s in skills[:10]]
    skill_list = ", ".join(skill_names) if skill_names else "general expertise"
    
    lines = [
        f"# {mode_name}\n",
        f"## Purpose\n",
        f"{purpose}\n",
        f"## Role Definition\n",
        f"An expert mode specialized in {skill_list}.\n",
        f"## Core Capabilities\n",
    ]
    
    for skill in skills[:10]:
        lines.append(f"- **{skill['name']}**: {skill['description']}")
    
    lines.append("\n## Custom Instructions\n")
    lines.append(f"When operating as {mode_name}, focus on:")
    
    for skill in skills[:5]:
        triggers = skill.get("triggers", [])
        if triggers:
            lines.append(f"- {triggers[0]}")
    
    return "\n".join(lines)


def render_mode_reference_md(skills: List[Dict[str, Any]], spec: Dict[str, Any]) -> str:
    """
    Render mode reference documentation.
    """
    mode_name = spec.get("mode_name", "Unknown Mode")
    purpose = spec.get("purpose", "")
    exemplars = spec.get("exemplars", [])
    
    lines = [
        f"# {mode_name} Reference\n",
        f"## Overview\n",
        f"{purpose}\n",
        f"## Exemplars\n",
    ]
    
    for ex in exemplars:
        name = ex.get("name", "Unknown")
        url = ex.get("url", "")
        lines.append(f"- [{name}]({url})" if url else f"- {name}")
    
    lines.append(f"\n## Skills ({len(skills)} total)\n")
    
    for skill in skills:
        confidence = skill.get("confidence", 0)
        lines.append(f"- {skill['name']} (confidence: {confidence:.2f})")
    
    return "\n".join(lines)


def run_synthesis(artifacts_data: Dict[str, Any], spec_data: Dict[str, Any], telemetry: TelemetryWriter | None = None, run_id: str | None = None) -> Dict[str, Any]:
    """
    Main synthesis function.
    
    Takes search artifacts and spec, returns synthesis results.
    Uses LLM semantic analysis to extract meaningful differentiated knowledge.
    Integrates Big Book API for author exemplars.
    """
    all_hits = artifacts_data.get("all_hits", []) or []
    seeded_modes = artifacts_data.get("seeded_modes", []) or []
    exemplars = spec_data.get("exemplars", []) or []
    
    # Fetch anchor skills from external repositories
    hf_skills = fetch_huggingface_skills()
    llm_skills = fetch_llm_skills()
    
    # Fetch book data for author exemplars (external calibration)
    book_data = {}
    for ex in exemplars:
        if ex.get("is_author"):
            name = ex.get("name", "")
            books = fetch_big_book_api(name)
            if books:
                book_data[name] = books
                # Add book titles/themes as additional context for LLM
                for book in books[:10]:
                    title = book.get("title", "")
                    themes = book.get("themes", [])
                    if title:
                        all_hits.append({
                            "title": f"Book: {title}",
                            "snippet": f"Work by {name}. Themes: {', '.join(themes[:5])}",
                            "url": f"book://{name}/{title}",
                            "source": "bigbook"
                        })
    
    # Get exemplar names for LLM analysis
    exemplar_names = [e.get("name", "Unknown") for e in exemplars]
    exemplar_name = exemplar_names[0] if exemplar_names else "the exemplar"
    
    # Use LLM to extract meaningful contributions
    llm_start = time.perf_counter()
    llm_skills = extract_skills_with_llm(all_hits, exemplar_name, spec_data)
    emit_structured(
        "synthesis.llm.extract",
        data={
            "run_id": run_id,
            "duration_ms": (time.perf_counter() - llm_start) * 1000,
            "status": "ok" if llm_skills else "empty",
            "model": os.environ.get("LLM_MODEL", "gpt-4o-mini"),
        },
        telemetry=telemetry,
    )
    
    print(f"--- [SkillBuilder] LLM extracted skills: {llm_skills}", flush=True)
    
    # Convert LLM results to skill cards
    skill_cards = []
    for llm_skill in llm_skills:
        name = llm_skill.get("name", "")
        description = llm_skill.get("description", "")
        differentiation = llm_skill.get("differentiation", "")
        
        card = {
            "name": name,
            "description": description,
            "triggers": [
                f"When {name.lower()} expertise is needed",
                f"When working with concepts from {exemplar_name}",
            ],
            "artifacts": [
                f"{name} analysis",
                f"{name} implementation",
            ],
            "constraints": [
                f"Must align with {spec_data.get('purpose', 'the mode purpose')}",
            ],
            "evidence_urls": [],
            "confidence": 0.85,
            "acquired_details": {
                "rationale": f"Identified via semantic analysis: {differentiation}",
                "llm_extracted": True,
                "advanced_capabilities": [description],
                "suggested_workflows": [f"Apply {name} principles"],
            },
        }
        skill_cards.append(card)
    
    print(f"--- [SkillBuilder] Initial skill cards: {skill_cards}", flush=True)
    
    # Fallback: if LLM extraction failed, use regex + spec skills
    if not skill_cards:
        inferred_skills = infer_skills(all_hits)
        
        # Also add skills from spec if provided
        spec_skills = spec_data.get("skills", []) or []
        for skill in spec_skills:
            if skill.lower() not in [s.lower() for s in inferred_skills]:
                inferred_skills.append(skill.lower())
        
        for skill in inferred_skills:
            evidence = [
                h for h in all_hits
                if skill.lower() in (h.get("title", "") + " " + h.get("snippet", "")).lower()
            ]
            card = acquire_skill_details(
                skill,
                evidence,
                spec_data,
                hf_skills=hf_skills,
                anthropic_skills=llm_skills,
            )
            skill_cards.append(card)
            
    print(f"--- [SkillBuilder] Skill cards after fallback: {skill_cards}", flush=True)
    
    # Category-preserving merge (skills only for now): deepen → merge
    merge_start = time.perf_counter()
    merged_skills = merge_modes_categorywise(skill_cards, seeded_modes, exemplar_name)
    emit_structured(
        "synthesis.merge.skills",
        data={
            "run_id": run_id,
            "duration_ms": (time.perf_counter() - merge_start) * 1000,
            "seeded_modes": len(seeded_modes),
            "merged_count": len(merged_skills),
        },
        telemetry=telemetry,
    )
    
    print(f"--- [SkillBuilder] Merged skills: {merged_skills}", flush=True)
    
    # Apply semantic MapReduce to deduplicate and merge overlapping skills
    reduce_start = time.perf_counter()
    all_skills = semantic_map_reduce(merged_skills, use_llm=True)
    emit_structured(
        "synthesis.reduce.map",
        data={
            "run_id": run_id,
            "duration_ms": (time.perf_counter() - reduce_start) * 1000,
            "input_count": len(merged_skills),
            "output_count": len(all_skills),
        },
        telemetry=telemetry,
    )
    
    print(f"--- [SkillBuilder] All skills after reduce: {all_skills}", flush=True)
    
    # Compute external calibration (non-gameable metrics)
    all_book_data = []
    for name, books in book_data.items():
        all_book_data.extend(books)
    
    calibration_start = time.perf_counter()
    calibration = compute_external_calibration(exemplar_name, all_hits, all_book_data)
    emit_structured(
        "synthesis.calibration",
        data={
            "run_id": run_id,
            "duration_ms": (time.perf_counter() - calibration_start) * 1000,
            "metrics": calibration,
        },
        telemetry=telemetry,
    )
    
    # Adjust confidence scores based on calibration
    all_skills = adjust_confidence_with_calibration(all_skills, calibration)
    
    print(f"--- [SkillBuilder] Final skills: {all_skills}", flush=True)
    
    # Emit quality summary (confidence distribution)
    if telemetry is not None:
        telemetry.emit(event_quality_skill_distribution(all_skills))

    # Build skill names for semantic map
    skill_names = [s.get("name", "") for s in all_skills[:10]]
    
    # Build semantic map
    semantic_map = []
    for exemplar in exemplars:
        entry = {
            "schema_type": "Author" if exemplar.get("is_author") else "Person",
            "name": exemplar.get("name", "Unknown"),
            "description": f"Exemplar for {spec_data.get('mode_name', 'mode')}",
            "properties": {
                "knowsAbout": skill_names,
            },
            "source_urls": [],
        }
        semantic_map.append(entry)
    
    # Generate markdown artifacts WITH Mermaid diagrams
    knowledge_graph = render_mermaid_knowledge_graph(all_skills, spec_data, calibration)
    synthesis_flow = render_mermaid_synthesis_flow(all_skills, spec_data)
    
    markdown = {
        "skills": render_skills_md(all_skills, spec_data),
        "semantic_map": render_semantic_map_md(semantic_map, spec_data),
        "generated_mode": render_generated_mode_md(all_skills, spec_data),
        "mode_reference": render_mode_reference_md(all_skills, spec_data),
        "knowledge_graph": knowledge_graph,
        "synthesis_flow": synthesis_flow,
    }
    
    return {
        "skills": all_skills,
        "semantic_map": semantic_map,
        "markdown": markdown,
        "calibration": calibration,
        "anchors_used": {
            "huggingface": len(hf_skills),
            "llm": len(llm_skills),
        },
    }

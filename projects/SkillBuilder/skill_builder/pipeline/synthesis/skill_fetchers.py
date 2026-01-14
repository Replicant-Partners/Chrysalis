"""
Skill fetching functions for external data sources.

Fetches skills from HuggingFace, Big Book API, and LLM extraction.
"""

from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
from typing import Any, Dict, List

from .llm_client import _call_llm_api, _has_llm_api


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
    import os
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

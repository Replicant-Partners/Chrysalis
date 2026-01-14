"""
Python implementation of semantic synthesis.

Replaces the Clojure-based synthesis engine to remove Java dependency.
Implements:
- LLM-based semantic skill extraction (not regex)
- Skill card generation with confidence scores
- HuggingFace skills repository integration
- Mode merging from seeded modes
- Markdown artifact generation

LLM Provider: Anthropic Claude Sonnet 4.5 (primary), OpenAI-compatible (fallback).
Supports Anthropic API directly or OpenAI-compatible endpoints via HTTP.

This module is now a facade that re-exports from the synthesis/ subpackage.
"""

from skill_builder.pipeline.synthesis import (
    SKILL_PATTERNS,
    SKILL_STOPWORDS,
    _call_anthropic_api,
    _call_llm_api,
    _call_openai_fallback,
    _canonicalize_skill_name,
    _deterministic_category_merge_skills,
    _group_by_semantic_similarity,
    _has_llm_api,
    _llm_category_merge_skills,
    _llm_reduce,
    _llm_semantic_merge,
    _simple_merge,
    _simple_reduce,
    acquire_skill_details,
    adjust_confidence_with_calibration,
    compute_external_calibration,
    extract_skills_with_llm,
    fetch_big_book_api,
    fetch_huggingface_skills,
    fetch_llm_skills,
    generate_skill_card,
    infer_skills,
    is_valid_skill,
    merge_modes_categorywise,
    merge_seeded_modes,
    render_generated_mode_md,
    render_mermaid_knowledge_graph,
    render_mermaid_synthesis_flow,
    render_mode_reference_md,
    render_semantic_map_md,
    render_skills_md,
    run_synthesis,
    semantic_map_reduce,
)

__all__ = [
    # LLM client
    "_call_anthropic_api",
    "_call_openai_fallback",
    "_call_llm_api",
    "_has_llm_api",
    # Skill fetchers
    "SKILL_PATTERNS",
    "SKILL_STOPWORDS",
    "is_valid_skill",
    "fetch_big_book_api",
    "fetch_huggingface_skills",
    "fetch_llm_skills",
    "extract_skills_with_llm",
    # Calibration
    "compute_external_calibration",
    "adjust_confidence_with_calibration",
    # Semantic processing
    "semantic_map_reduce",
    "_canonicalize_skill_name",
    "_group_by_semantic_similarity",
    "_simple_reduce",
    "_llm_reduce",
    # Skill acquisition
    "infer_skills",
    "generate_skill_card",
    "acquire_skill_details",
    "merge_seeded_modes",
    # Mode merging
    "merge_modes_categorywise",
    "_llm_category_merge_skills",
    "_deterministic_category_merge_skills",
    "_simple_merge",
    "_llm_semantic_merge",
    # Renderers
    "render_mermaid_knowledge_graph",
    "render_mermaid_synthesis_flow",
    "render_skills_md",
    "render_semantic_map_md",
    "render_generated_mode_md",
    "render_mode_reference_md",
    # Orchestrator
    "run_synthesis",
]

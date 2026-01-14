"""
Synthesis package for SkillBuilder.

This package contains all synthesis-related functionality decomposed into modules:
- llm_client: LLM API client functions (Anthropic/OpenAI)
- skill_fetchers: External skill fetching (HuggingFace, Big Book API, LLM extraction)
- calibration: External calibration metrics and confidence adjustment
- semantic_processing: MapReduce-style semantic deduplication
- skill_acquisition: Skill inference, card generation, seeded mode merging
- mode_merging: Category-preserving mode merging with LLM-first approach
- renderers: Mermaid diagrams and Markdown generation
- orchestrator: Main run_synthesis function
"""

from .calibration import (
    adjust_confidence_with_calibration,
    compute_external_calibration,
)
from .llm_client import (
    _call_anthropic_api,
    _call_llm_api,
    _call_openai_fallback,
    _has_llm_api,
)
from .mode_merging import (
    _deterministic_category_merge_skills,
    _llm_category_merge_skills,
    _llm_semantic_merge,
    _simple_merge,
    merge_modes_categorywise,
)
from .orchestrator import run_synthesis
from .renderers import (
    render_generated_mode_md,
    render_mermaid_knowledge_graph,
    render_mermaid_synthesis_flow,
    render_mode_reference_md,
    render_semantic_map_md,
    render_skills_md,
)
from .semantic_processing import (
    _canonicalize_skill_name,
    _group_by_semantic_similarity,
    _llm_reduce,
    _simple_reduce,
    semantic_map_reduce,
)
from .skill_acquisition import (
    acquire_skill_details,
    generate_skill_card,
    infer_skills,
    merge_seeded_modes,
)
from .skill_fetchers import (
    SKILL_PATTERNS,
    SKILL_STOPWORDS,
    extract_skills_with_llm,
    fetch_big_book_api,
    fetch_huggingface_skills,
    fetch_llm_skills,
    is_valid_skill,
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

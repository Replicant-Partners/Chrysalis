"""
Main synthesis orchestrator.

Contains the run_synthesis function that coordinates all synthesis operations.
"""

from __future__ import annotations

import os
import time
from typing import Any, Dict

from skill_builder.pipeline.telemetry import (
    TelemetryWriter,
    emit_structured,
    event_quality_skill_distribution,
)

from .calibration import adjust_confidence_with_calibration, compute_external_calibration
from .mode_merging import merge_modes_categorywise
from .renderers import (
    render_generated_mode_md,
    render_mermaid_knowledge_graph,
    render_mermaid_synthesis_flow,
    render_mode_reference_md,
    render_semantic_map_md,
    render_skills_md,
)
from .semantic_processing import semantic_map_reduce
from .skill_acquisition import acquire_skill_details, infer_skills
from .skill_fetchers import (
    extract_skills_with_llm,
    fetch_big_book_api,
    fetch_huggingface_skills,
    fetch_llm_skills,
)


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

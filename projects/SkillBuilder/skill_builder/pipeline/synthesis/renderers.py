"""
Rendering functions for synthesis output artifacts.

Generates Mermaid diagrams and Markdown documentation.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List


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

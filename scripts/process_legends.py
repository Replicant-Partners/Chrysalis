#!/usr/bin/env python3
"""
Process Replicants/Legends through SkillBuilder and KnowledgeBuilder pipelines.

Creates vector embeddings for each Legend agent and saves them to:
    Replicants/legends/Embeddings/

Usage:
    python scripts/process_legends.py [--legend <name>]
    
Options:
    --legend <name>  Process only the specified legend (e.g., "bob_ross")
    --dry-run        Show what would be processed without running
"""

import argparse
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime

# Add project roots to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "projects" / "KnowledgeBuilder"))
sys.path.insert(0, str(PROJECT_ROOT / "projects" / "SkillBuilder"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Paths
LEGENDS_DIR = PROJECT_ROOT / "Replicants" / "legends"
EMBEDDINGS_DIR = LEGENDS_DIR / "Embeddings"


def load_legend(legend_path: Path) -> Dict[str, Any]:
    """Load a legend JSON file."""
    with open(legend_path, "r") as f:
        return json.load(f)


def extract_legend_context(legend: Dict[str, Any]) -> str:
    """Extract key context from a legend for embedding."""
    parts = []
    
    # Name and designation
    name = legend.get("name", "Unknown")
    designation = legend.get("designation", "")
    parts.append(f"Name: {name}")
    if designation:
        parts.append(f"Designation: {designation}")
    
    # Bio
    bio = legend.get("bio", "")
    if bio:
        parts.append(f"Bio: {bio}")
    
    # Personality traits
    personality = legend.get("personality", {})
    if isinstance(personality, dict):
        core_traits = personality.get("core_traits", [])
        if core_traits:
            parts.append(f"Core Traits: {', '.join(core_traits)}")
        
        values = personality.get("values", [])
        if values:
            parts.append(f"Values: {', '.join(values)}")
        
        quirks = personality.get("quirks", [])
        if quirks and isinstance(quirks, list):
            parts.append(f"Quirks: {', '.join(quirks[:5])}")
    
    # Capabilities
    capabilities = legend.get("capabilities", {})
    if isinstance(capabilities, dict):
        primary = capabilities.get("primary", [])
        if primary:
            parts.append(f"Primary Capabilities: {', '.join(primary)}")
        secondary = capabilities.get("secondary", [])
        if secondary:
            parts.append(f"Secondary Capabilities: {', '.join(secondary[:5])}")
    
    # Signature phrases
    phrases = legend.get("signature_phrases", [])
    if phrases:
        parts.append(f"Signature Phrases: {'; '.join(phrases[:3])}")
    
    # Expertise (for technical legends like Bruce Schneier)
    expertise = legend.get("expertise", {})
    if isinstance(expertise, dict):
        for domain, details in list(expertise.items())[:3]:
            if isinstance(details, dict):
                specialties = details.get("specialties", [])
                if specialties:
                    parts.append(f"Expertise in {domain}: {', '.join(specialties[:3])}")
    
    return "\n".join(parts)


def process_legend_with_knowledge_builder(legend: Dict[str, Any], run_number: int) -> Dict[str, Any]:
    """Process a legend through KnowledgeBuilder pipeline."""
    try:
        from src.pipeline.simple_pipeline import SimplePipeline
        from src.utils.embeddings import EmbeddingService
        
        name = legend.get("name", "Unknown")
        context = extract_legend_context(legend)
        
        logger.info(f"  KnowledgeBuilder run {run_number} for {name}")
        
        # Create embedding service
        embedder = EmbeddingService()
        
        # Generate embedding from the context
        embedding = embedder.embed(context)
        
        # Try to collect additional knowledge if API keys are available
        collected_knowledge = {}
        try:
            pipeline = SimplePipeline()
            result = pipeline.collect_and_store(name, entity_type="Person")
            collected_knowledge = {
                "entity": result.get("entity", {}),
                "attributes": result.get("attributes", {}),
                "resolved": result.get("resolved", {}),
            }
        except Exception as e:
            logger.warning(f"    Could not collect additional knowledge: {e}")
        
        return {
            "source": "knowledge_builder",
            "run_number": run_number,
            "embedding": embedding,
            "embedding_dimensions": len(embedding),
            "collected_knowledge": collected_knowledge,
            "context_used": context[:500] + "..." if len(context) > 500 else context,
        }
    except ImportError as e:
        logger.error(f"    KnowledgeBuilder import failed: {e}")
        return {"source": "knowledge_builder", "run_number": run_number, "error": str(e)}
    except Exception as e:
        logger.error(f"    KnowledgeBuilder processing failed: {e}")
        return {"source": "knowledge_builder", "run_number": run_number, "error": str(e)}


def process_legend_with_skill_builder(legend: Dict[str, Any], run_number: int) -> Dict[str, Any]:
    """Process a legend through SkillBuilder pipeline."""
    try:
        from skill_builder.pipeline.models import FrontendSpec, Exemplar
        from skill_builder.pipeline.embeddings import EmbeddingService
        
        name = legend.get("name", "Unknown")
        designation = legend.get("designation", "")
        bio = legend.get("bio", "")
        
        # Extract salts (defining qualities) from personality
        salts = []
        personality = legend.get("personality", {})
        if isinstance(personality, dict):
            salts.extend(personality.get("core_traits", [])[:5])
            salts.extend(personality.get("values", [])[:3])
        
        # Also use capabilities as salts
        capabilities = legend.get("capabilities", {})
        if isinstance(capabilities, dict):
            salts.extend(capabilities.get("primary", [])[:3])
        
        logger.info(f"  SkillBuilder run {run_number} for {name}")
        
        # Create embedding service
        embedder = EmbeddingService()
        
        # Build skill context
        skill_context = f"Role Model: {name}\nDesignation: {designation}\n"
        skill_context += f"Purpose: {bio[:200]}...\n" if len(bio) > 200 else f"Purpose: {bio}\n"
        skill_context += f"Skills: {', '.join(salts)}"
        
        # Generate embedding
        embedding = embedder.embed(skill_context)
        
        # Generate skill-specific embeddings
        skill_embeddings = []
        for salt in salts[:5]:
            skill_text = f"Skill: {salt} - as demonstrated by {name}"
            skill_embedding = embedder.embed(skill_text)
            skill_embeddings.append({
                "skill_name": salt,
                "embedding": skill_embedding,
            })
        
        return {
            "source": "skill_builder",
            "run_number": run_number,
            "embedding": embedding,
            "embedding_dimensions": len(embedding),
            "skill_embeddings": skill_embeddings,
            "salts_used": salts,
            "context_used": skill_context[:500] + "..." if len(skill_context) > 500 else skill_context,
        }
    except ImportError as e:
        logger.error(f"    SkillBuilder import failed: {e}")
        return {"source": "skill_builder", "run_number": run_number, "error": str(e)}
    except Exception as e:
        logger.error(f"    SkillBuilder processing failed: {e}")
        return {"source": "skill_builder", "run_number": run_number, "error": str(e)}


def process_legend(legend_path: Path) -> Dict[str, Any]:
    """Process a single legend through both builders twice."""
    legend = load_legend(legend_path)
    name = legend.get("name", legend_path.stem)
    
    logger.info(f"Processing legend: {name}")
    
    results = {
        "name": name,
        "source_file": str(legend_path.name),
        "processed_at": datetime.now().isoformat(),
        "knowledge_builder_runs": [],
        "skill_builder_runs": [],
    }
    
    # Run through KnowledgeBuilder twice
    for run in [1, 2]:
        kb_result = process_legend_with_knowledge_builder(legend, run)
        results["knowledge_builder_runs"].append(kb_result)
    
    # Run through SkillBuilder twice
    for run in [1, 2]:
        sb_result = process_legend_with_skill_builder(legend, run)
        results["skill_builder_runs"].append(sb_result)
    
    return results


def save_embeddings(legend_name: str, results: Dict[str, Any]) -> Path:
    """Save embeddings to the Embeddings directory."""
    # Ensure directory exists
    EMBEDDINGS_DIR.mkdir(parents=True, exist_ok=True)
    
    # Clean filename
    safe_name = legend_name.lower().replace(" ", "_").replace(".", "").replace("-", "_")
    output_path = EMBEDDINGS_DIR / f"{safe_name}_embeddings.json"
    
    # Extract embeddings summary for smaller file
    summary = {
        "name": results["name"],
        "source_file": results["source_file"],
        "processed_at": results["processed_at"],
        "knowledge_builder": {
            "runs": len(results["knowledge_builder_runs"]),
            "embeddings": [
                {
                    "run": r["run_number"],
                    "dimensions": r.get("embedding_dimensions", 0),
                    "embedding": r.get("embedding", [])[:10] + ["..."] if r.get("embedding") else [],
                    "has_collected_knowledge": bool(r.get("collected_knowledge")),
                    "error": r.get("error"),
                }
                for r in results["knowledge_builder_runs"]
            ],
        },
        "skill_builder": {
            "runs": len(results["skill_builder_runs"]),
            "embeddings": [
                {
                    "run": r["run_number"],
                    "dimensions": r.get("embedding_dimensions", 0),
                    "embedding": r.get("embedding", [])[:10] + ["..."] if r.get("embedding") else [],
                    "skill_count": len(r.get("skill_embeddings", [])),
                    "salts_used": r.get("salts_used", []),
                    "error": r.get("error"),
                }
                for r in results["skill_builder_runs"]
            ],
        },
    }
    
    # Also save full embeddings in a separate file
    full_output_path = EMBEDDINGS_DIR / f"{safe_name}_embeddings_full.json"
    
    with open(output_path, "w") as f:
        json.dump(summary, f, indent=2)
    
    with open(full_output_path, "w") as f:
        json.dump(results, f, indent=2)
    
    logger.info(f"  Saved embeddings to: {output_path}")
    return output_path


def main():
    parser = argparse.ArgumentParser(description="Process Legends through Builder pipelines")
    parser.add_argument("--legend", type=str, help="Process only the specified legend")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be processed")
    args = parser.parse_args()
    
    # Find all legend files
    legend_files = sorted(LEGENDS_DIR.glob("*.json"))
    
    if args.legend:
        # Filter to specific legend
        legend_files = [f for f in legend_files if args.legend.lower() in f.stem.lower()]
        if not legend_files:
            logger.error(f"No legend found matching: {args.legend}")
            return 1
    
    logger.info(f"Found {len(legend_files)} legend files to process")
    
    if args.dry_run:
        logger.info("DRY RUN - Would process:")
        for f in legend_files:
            logger.info(f"  - {f.name}")
        return 0
    
    # Create embeddings directory
    EMBEDDINGS_DIR.mkdir(parents=True, exist_ok=True)
    logger.info(f"Embeddings will be saved to: {EMBEDDINGS_DIR}")
    
    # Process each legend
    processed = 0
    errors = 0
    
    for legend_file in legend_files:
        if legend_file.name == "README.md":
            continue
        
        try:
            results = process_legend(legend_file)
            save_embeddings(results["name"], results)
            processed += 1
        except Exception as e:
            logger.error(f"Failed to process {legend_file.name}: {e}")
            errors += 1
    
    # Summary
    logger.info("=" * 60)
    logger.info(f"Processing complete!")
    logger.info(f"  Processed: {processed} legends")
    logger.info(f"  Errors: {errors}")
    logger.info(f"  Output: {EMBEDDINGS_DIR}")
    
    return 0 if errors == 0 else 1


if __name__ == "__main__":
    sys.exit(main())

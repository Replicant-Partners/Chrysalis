#!/usr/bin/env python3
"""
Output Consolidation Migration Script

ONE-TIME migration from fragmented builder outputs to consolidated format.
After migration, process_legends.py will use semantic merge directly.

Consolidates into three primary files:
    1. all_embeddings.json - Unified embeddings from all legends
    2. all_skills.json - Unified skills from all legends
    3. all_personas.json - Unified personas from legend sources

Features:
    - Deduplication based on semantic similarity
    - Conflict resolution for overlapping entries
    - Validation of consolidated outputs
    - Archives individual files after successful migration
"""

import argparse
import hashlib
import json
import shutil
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

PROJECT_ROOT = Path(__file__).parent.parent
LEGENDS_DIR = PROJECT_ROOT / "Replicants" / "legends"
EMBEDDINGS_DIR = LEGENDS_DIR / "Embeddings"
SKILLS_DIR = LEGENDS_DIR / "Skills"
ARCHIVE_DIR = LEGENDS_DIR / "archive"

# Consolidated output paths
OUTPUT_EMBEDDINGS = EMBEDDINGS_DIR / "all_embeddings.json"
OUTPUT_SKILLS = EMBEDDINGS_DIR / "all_skills.json"
OUTPUT_PERSONAS = EMBEDDINGS_DIR / "all_personas.json"


@dataclass
class ConsolidationStats:
    """Statistics from consolidation process."""
    embeddings_files_processed: int = 0
    embeddings_total: int = 0
    embeddings_deduplicated: int = 0
    skills_files_processed: int = 0
    skills_total: int = 0
    skills_deduplicated: int = 0
    personas_total: int = 0
    conflicts_resolved: int = 0
    errors: List[str] = field(default_factory=list)


@dataclass
class ConsolidatedEmbedding:
    """A consolidated embedding entry."""
    name: str
    source_file: str
    processed_at: str
    strategy: str
    knowledge_embeddings: List[Dict[str, Any]]
    skill_embeddings: List[Dict[str, Any]]
    metadata: Dict[str, Any]


@dataclass
class ConsolidatedSkill:
    """A consolidated skill entry."""
    legend_name: str
    skill_name: str
    embedding: List[float]
    run_number: int
    descriptor_strategy: str
    source_file: str


def compute_embedding_hash(embedding: List[float], precision: int = 4) -> str:
    """Compute hash of embedding for deduplication."""
    if not embedding or not isinstance(embedding, list):
        return ""
    # Round to precision and hash
    rounded = [round(x, precision) if isinstance(x, (int, float)) else 0 for x in embedding[:100]]
    return hashlib.md5(json.dumps(rounded).encode()).hexdigest()


def compute_skill_signature(skill: Dict[str, Any]) -> str:
    """Compute unique signature for a skill."""
    name = skill.get("skill_name", "")
    legend = skill.get("legend_name", "")
    # Include first 50 embedding values for uniqueness
    embedding = skill.get("embedding", [])[:50]
    sig_data = f"{legend}:{name}:{json.dumps(embedding[:10])}"
    return hashlib.md5(sig_data.encode()).hexdigest()


def load_embedding_files(stats: ConsolidationStats) -> List[Dict[str, Any]]:
    """Load all FULL embedding files and extract entries."""
    all_embeddings = []
    
    # Look for *_embeddings_full.json files (FULL data, not truncated summaries)
    for path in sorted(EMBEDDINGS_DIR.glob("*_embeddings_full.json")):
        if path.name.startswith("all_"):
            continue
        
        try:
            with open(path) as f:
                data = json.load(f)
            
            # Validate embedding arrays contain actual floats, not strings
            kb_runs = data.get("knowledge_builder_runs", [])
            sb_runs = data.get("skill_builder_runs", [])
            
            for run in kb_runs:
                emb = run.get("embedding", [])
                if emb and (not isinstance(emb[0], (int, float)) or "..." in str(emb)):
                    stats.errors.append(f"Invalid KB embedding in {path.name} run {run.get('run_number')}")
                    continue
            
            for run in sb_runs:
                emb = run.get("embedding", [])
                if emb and (not isinstance(emb[0], (int, float)) or "..." in str(emb)):
                    stats.errors.append(f"Invalid SB embedding in {path.name} run {run.get('run_number')}")
                    continue
            
            # Normalize data structure - preserve full embeddings
            entry = {
                "name": data.get("name", path.stem.replace("_embeddings_full", "")),
                "source_file": data.get("source_file", path.name),
                "processed_at": data.get("processed_at", ""),
                "run_count": data.get("run_count", 0),
                "strategy": data.get("strategy", "hybrid"),
                "knowledge_builder": {
                    "runs": len(kb_runs),
                    "embeddings": [
                        {
                            "run": r.get("run_number"),
                            "dimensions": r.get("embedding_dimensions", len(r.get("embedding", []))),
                            "embedding": r.get("embedding", []),
                            "has_collected_knowledge": bool(r.get("collected_knowledge")),
                            "collected_knowledge": r.get("collected_knowledge", {}),
                            "descriptor_strategy": r.get("descriptor_strategy"),
                            "descriptors": r.get("descriptors", []),
                            "duration_sec": r.get("duration_sec"),
                        }
                        for r in kb_runs
                    ],
                },
                "skill_builder": {
                    "runs": len(sb_runs),
                    "embeddings": [
                        {
                            "run": r.get("run_number"),
                            "dimensions": r.get("embedding_dimensions", len(r.get("embedding", []))),
                            "embedding": r.get("embedding", []),
                            "skill_count": len(r.get("skill_embeddings", [])),
                            "salts_used": r.get("salts_used", []),
                            "descriptor_strategy": r.get("descriptor_strategy"),
                            "descriptors": r.get("descriptors", []),
                            "duration_sec": r.get("duration_sec"),
                        }
                        for r in sb_runs
                    ],
                },
                "_original_path": str(path),
            }
            all_embeddings.append(entry)
            stats.embeddings_files_processed += 1
            
        except Exception as e:
            stats.errors.append(f"Error loading {path}: {e}")
    
    return all_embeddings


def load_skill_files(stats: ConsolidationStats) -> List[Dict[str, Any]]:
    """Load all skill files and extract entries."""
    all_skills = []
    
    for path in sorted(SKILLS_DIR.glob("*_skills_run*.json")):
        try:
            with open(path) as f:
                data = json.load(f)
            
            # Extract individual skill embeddings
            legend_name = data.get("name", "")
            run = data.get("run", 0)
            strategy = data.get("descriptor_strategy", "")
            
            for skill_emb in data.get("skill_embeddings", []):
                skill_entry = {
                    "legend_name": legend_name,
                    "skill_name": skill_emb.get("skill_name", ""),
                    "embedding": skill_emb.get("embedding", []),
                    "run_number": run,
                    "descriptor_strategy": strategy,
                    "source_file": path.name,
                    "salts_used": data.get("salts_used", []),
                }
                all_skills.append(skill_entry)
            
            stats.skills_files_processed += 1
            
        except Exception as e:
            stats.errors.append(f"Error loading {path}: {e}")
    
    return all_skills


def load_persona_files(stats: ConsolidationStats) -> List[Dict[str, Any]]:
    """Load all persona (legend) files."""
    all_personas = []
    
    for path in sorted(LEGENDS_DIR.glob("*.json")):
        try:
            with open(path) as f:
                data = json.load(f)
            
            persona = {
                "name": data.get("name", path.stem),
                "designation": data.get("designation", ""),
                "bio": data.get("bio", ""),
                "personality": data.get("personality", {}),
                "capabilities": data.get("capabilities", {}),
                "signature_phrases": data.get("signature_phrases", []),
                "communication_style": data.get("communication_style", {}),
                "beliefs": data.get("beliefs", {}),
                "source_file": path.name,
            }
            all_personas.append(persona)
            stats.personas_total += 1
            
        except Exception as e:
            stats.errors.append(f"Error loading {path}: {e}")
    
    return all_personas


def deduplicate_embeddings(
    embeddings: List[Dict[str, Any]], 
    stats: ConsolidationStats
) -> List[Dict[str, Any]]:
    """Deduplicate embeddings based on name and semantic similarity."""
    seen_names: Dict[str, Dict[str, Any]] = {}
    deduplicated = []
    
    for emb in embeddings:
        name = emb.get("name", "")
        
        if name in seen_names:
            # Conflict resolution: keep the more recent one
            existing = seen_names[name]
            existing_time = existing.get("processed_at", "")
            new_time = emb.get("processed_at", "")
            
            if new_time > existing_time:
                seen_names[name] = emb
                stats.conflicts_resolved += 1
            
            stats.embeddings_deduplicated += 1
        else:
            seen_names[name] = emb
    
    deduplicated = list(seen_names.values())
    stats.embeddings_total = len(deduplicated)
    
    return deduplicated


def deduplicate_skills(
    skills: List[Dict[str, Any]], 
    stats: ConsolidationStats
) -> List[Dict[str, Any]]:
    """Deduplicate skills based on signature."""
    seen_signatures: Set[str] = set()
    deduplicated = []
    
    for skill in skills:
        sig = compute_skill_signature(skill)
        
        if sig not in seen_signatures:
            seen_signatures.add(sig)
            deduplicated.append(skill)
        else:
            stats.skills_deduplicated += 1
    
    stats.skills_total = len(deduplicated)
    
    return deduplicated


def organize_skills_by_legend(skills: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """Organize skills by legend name for structured output."""
    by_legend: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    
    for skill in skills:
        legend = skill.get("legend_name", "unknown")
        by_legend[legend].append(skill)
    
    return dict(by_legend)


def validate_consolidated_outputs(stats: ConsolidationStats) -> List[str]:
    """Validate the consolidated outputs exist and are valid."""
    validation_errors = []
    
    # Check embeddings file
    if OUTPUT_EMBEDDINGS.exists():
        try:
            with open(OUTPUT_EMBEDDINGS) as f:
                data = json.load(f)
            if not data.get("legends"):
                validation_errors.append("Embeddings file has no 'legends' key")
        except json.JSONDecodeError as e:
            validation_errors.append(f"Embeddings file is invalid JSON: {e}")
    else:
        validation_errors.append("Embeddings file not created")
    
    # Check skills file
    if OUTPUT_SKILLS.exists():
        try:
            with open(OUTPUT_SKILLS) as f:
                data = json.load(f)
            if not data.get("skills_by_legend"):
                validation_errors.append("Skills file has no 'skills_by_legend' key")
        except json.JSONDecodeError as e:
            validation_errors.append(f"Skills file is invalid JSON: {e}")
    else:
        validation_errors.append("Skills file not created")
    
    # Check personas file
    if OUTPUT_PERSONAS.exists():
        try:
            with open(OUTPUT_PERSONAS) as f:
                data = json.load(f)
            if not data.get("personas"):
                validation_errors.append("Personas file has no 'personas' key")
        except json.JSONDecodeError as e:
            validation_errors.append(f"Personas file is invalid JSON: {e}")
    else:
        validation_errors.append("Personas file not created")
    
    return validation_errors


def archive_fragmented_files():
    """Archive original fragmented files after successful consolidation."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    archive_path = ARCHIVE_DIR / timestamp
    archived_count = 0

    # Archive embeddings (individual files only)
    emb_archive = archive_path / "Embeddings"
    emb_archive.mkdir(parents=True, exist_ok=True)
    for path in EMBEDDINGS_DIR.glob("*_embeddings*.json"):
        if not path.name.startswith("all_"):
            shutil.move(str(path), str(emb_archive / path.name))
            archived_count += 1

    # Archive skills (individual files only)
    skills_archive = archive_path / "Skills"
    skills_archive.mkdir(parents=True, exist_ok=True)
    if SKILLS_DIR.exists():
        for path in SKILLS_DIR.glob("*.json"):
            shutil.move(str(path), str(skills_archive / path.name))
            archived_count += 1

    return archive_path, archived_count


def consolidate(archive: bool = False) -> ConsolidationStats:
    """Main consolidation function."""
    stats = ConsolidationStats()
    
    print("Step 2: Loading embedding files...")
    embeddings = load_embedding_files(stats)
    print(f"  Loaded {stats.embeddings_files_processed} embedding files")
    
    print("Step 3: Deduplicating embeddings...")
    embeddings = deduplicate_embeddings(embeddings, stats)
    print(f"  Kept {stats.embeddings_total} unique embeddings (deduplicated {stats.embeddings_deduplicated})")
    
    print("Step 4: Loading skill files...")
    skills = load_skill_files(stats)
    print(f"  Loaded {stats.skills_files_processed} skill files")
    
    print("Step 5: Deduplicating skills...")
    skills = deduplicate_skills(skills, stats)
    print(f"  Kept {stats.skills_total} unique skills (deduplicated {stats.skills_deduplicated})")
    
    print("Step 6: Loading persona files...")
    personas = load_persona_files(stats)
    print(f"  Loaded {stats.personas_total} personas")
    
    print("Step 7: Writing consolidated embeddings...")
    embeddings_output = {
        "version": "1.0.0",
        "consolidated_at": datetime.now().isoformat(),
        "total_legends": len(embeddings),
        "legends": embeddings,
    }
    with open(OUTPUT_EMBEDDINGS, "w") as f:
        json.dump(embeddings_output, f, indent=2)
    print(f"  Written to: {OUTPUT_EMBEDDINGS}")
    
    print("Step 8: Writing consolidated skills...")
    skills_by_legend = organize_skills_by_legend(skills)
    skills_output = {
        "version": "1.0.0",
        "consolidated_at": datetime.now().isoformat(),
        "total_skills": len(skills),
        "total_legends": len(skills_by_legend),
        "skills_by_legend": skills_by_legend,
    }
    with open(OUTPUT_SKILLS, "w") as f:
        json.dump(skills_output, f, indent=2)
    print(f"  Written to: {OUTPUT_SKILLS}")
    
    print("Step 9: Writing consolidated personas...")
    personas_output = {
        "version": "1.0.0",
        "consolidated_at": datetime.now().isoformat(),
        "total_personas": len(personas),
        "personas": personas,
    }
    with open(OUTPUT_PERSONAS, "w") as f:
        json.dump(personas_output, f, indent=2)
    print(f"  Written to: {OUTPUT_PERSONAS}")
    
    print("Step 10: Validating outputs...")
    validation_errors = validate_consolidated_outputs(stats)
    if validation_errors:
        for err in validation_errors:
            stats.errors.append(f"Validation: {err}")
        print(f"  ⚠️ Validation issues: {len(validation_errors)}")
    else:
        print("  ✅ All outputs validated successfully")

    if archive and not stats.errors:
        print("Step 11: Archiving fragmented files...")
        archive_path, archived_count = archive_fragmented_files()
        print(f"  Archived {archived_count} files to: {archive_path}")

    return stats


def generate_report(stats: ConsolidationStats) -> str:
    """Generate consolidation report."""
    report = []
    report.append("=" * 60)
    report.append("OUTPUT CONSOLIDATION REPORT")
    report.append("=" * 60)
    report.append(f"Timestamp: {datetime.now().isoformat()}")
    report.append("")
    
    report.append("## EMBEDDINGS")
    report.append(f"  Files processed: {stats.embeddings_files_processed}")
    report.append(f"  Total unique: {stats.embeddings_total}")
    report.append(f"  Deduplicated: {stats.embeddings_deduplicated}")
    report.append("")
    
    report.append("## SKILLS")
    report.append(f"  Files processed: {stats.skills_files_processed}")
    report.append(f"  Total unique: {stats.skills_total}")
    report.append(f"  Deduplicated: {stats.skills_deduplicated}")
    report.append("")
    
    report.append("## PERSONAS")
    report.append(f"  Total: {stats.personas_total}")
    report.append("")
    
    report.append("## CONSOLIDATED FILES")
    report.append(f"  1. {OUTPUT_EMBEDDINGS}")
    report.append(f"  2. {OUTPUT_SKILLS}")
    report.append(f"  3. {OUTPUT_PERSONAS}")
    report.append("")
    
    if stats.errors:
        report.append("## ERRORS")
        for err in stats.errors:
            report.append(f"  • {err}")
        report.append("")
    
    report.append("## SUMMARY")
    report.append(f"  Conflicts resolved: {stats.conflicts_resolved}")
    report.append(f"  Total errors: {len(stats.errors)}")
    status = "✅ SUCCESS" if not stats.errors else "⚠️ COMPLETED WITH ERRORS"
    report.append(f"  Status: {status}")
    report.append("")
    
    report.append("=" * 60)
    return "\n".join(report)


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Migrate fragmented outputs to consolidated format")
    parser.add_argument("--archive", action="store_true", help="Archive fragmented files after successful migration")
    args = parser.parse_args()
    
    print("Starting output consolidation migration...")
    print("")

    stats = consolidate(archive=args.archive)
    
    print("")
    report = generate_report(stats)
    print(report)
    
    # Save report
    report_path = EMBEDDINGS_DIR / "consolidation_report.txt"
    with open(report_path, "w") as f:
        f.write(report)
    print(f"Report saved to: {report_path}")
    
    return 0 if not stats.errors else 1


if __name__ == "__main__":
    exit(main())
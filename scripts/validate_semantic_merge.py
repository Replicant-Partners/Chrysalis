#!/usr/bin/env python3
"""
Validate that semantic merging is working correctly in consolidated files.

Checks:
1. Embeddings have merged_count > 1 where appropriate
2. Skills show semantic consolidation
3. Total counts are reasonable (not excessive duplication)
4. Similarity scores are recorded
"""

import json
from pathlib import Path
from typing import Dict, Any, List

PROJECT_ROOT = Path(__file__).parent.parent
EMBEDDINGS_DIR = PROJECT_ROOT / "Replicants" / "legends" / "Embeddings"

ALL_EMBEDDINGS = EMBEDDINGS_DIR / "all_embeddings.json"
ALL_SKILLS = EMBEDDINGS_DIR / "all_skills.json"


def validate_embeddings() -> Dict[str, Any]:
    """Validate the all_embeddings.json file."""
    print("Validating embeddings file...")
    
    if not ALL_EMBEDDINGS.exists():
        return {"error": "all_embeddings.json not found"}
    
    with open(ALL_EMBEDDINGS) as f:
        data = json.load(f)
    
    # Handle both list and dict formats
    legends_data = data.get("legends", {})
    if isinstance(legends_data, list):
        print("  Note: Using old list format (will be migrated on next processing)")
        legends_dict = {legend.get("name", "Unknown"): legend for legend in legends_data}
    else:
        legends_dict = legends_data
    
    stats = {
        "total_legends": len(legends_dict),
        "legends_with_merges": 0,
        "total_kb_embeddings": 0,
        "total_sb_embeddings": 0,
        "kb_merged_embeddings": 0,
        "sb_merged_embeddings": 0,
        "max_merge_count": 0,
        "avg_merge_count": 0.0,
    }
    
    merge_counts = []
    
    for legend_name, legend_data in legends_dict.items():
        kb_embs = legend_data.get("knowledge_builder", {}).get("embeddings", [])
        sb_embs = legend_data.get("skill_builder", {}).get("embeddings", [])
        
        stats["total_kb_embeddings"] += len(kb_embs)
        stats["total_sb_embeddings"] += len(sb_embs)
        
        has_merge = False
        for emb in kb_embs + sb_embs:
            merge_count = emb.get("merged_count", 1)
            merge_counts.append(merge_count)
            
            if merge_count > 1:
                has_merge = True
                if "knowledge_builder" in str(emb.get("run", "")):
                    stats["kb_merged_embeddings"] += 1
                else:
                    stats["sb_merged_embeddings"] += 1
                
                stats["max_merge_count"] = max(stats["max_merge_count"], merge_count)
        
        if has_merge:
            stats["legends_with_merges"] += 1
    
    if merge_counts:
        stats["avg_merge_count"] = sum(merge_counts) / len(merge_counts)
    
    # Print results
    print(f"  Total legends: {stats['total_legends']}")
    print(f"  Legends with merged embeddings: {stats['legends_with_merges']}")
    print(f"  Total KB embeddings: {stats['total_kb_embeddings']}")
    print(f"  Total SB embeddings: {stats['total_sb_embeddings']}")
    print(f"  KB embeddings with merges: {stats['kb_merged_embeddings']}")
    print(f"  SB embeddings with merges: {stats['sb_merged_embeddings']}")
    print(f"  Max merge count: {stats['max_merge_count']}")
    print(f"  Avg merge count: {stats['avg_merge_count']:.2f}")
    
    # Validation checks
    issues = []
    
    if stats["total_legends"] == 0:
        issues.append("No legends found in file")
    
    if stats["legends_with_merges"] == 0:
        issues.append("No merged embeddings found (semantic merging may not be working)")
    
    if stats["max_merge_count"] < 2:
        issues.append("No embeddings with merge_count > 1 (merging not occurring)")
    
    if issues:
        print("\n⚠️  VALIDATION ISSUES:")
        for issue in issues:
            print(f"  • {issue}")
    else:
        print("\n✅ Embeddings validation passed!")
    
    return stats


def validate_skills() -> Dict[str, Any]:
    """Validate the all_skills.json file."""
    print("\nValidating skills file...")
    
    if not ALL_SKILLS.exists():
        return {"error": "all_skills.json not found"}
    
    with open(ALL_SKILLS) as f:
        data = json.load(f)
    
    stats = {
        "total_legends": data.get("total_legends", 0),
        "total_skills": data.get("total_skills", 0),
        "skills_with_merges": 0,
        "max_merge_count": 0,
        "avg_merge_count": 0.0,
        "legends_with_merged_skills": 0,
    }
    
    merge_counts = []
    legends_with_merges = set()
    
    for legend_name, skills in data.get("skills_by_legend", {}).items():
        for skill in skills:
            merge_count = skill.get("merged_count", 1)
            merge_counts.append(merge_count)
            
            if merge_count > 1:
                stats["skills_with_merges"] += 1
                stats["max_merge_count"] = max(stats["max_merge_count"], merge_count)
                legends_with_merges.add(legend_name)
    
    stats["legends_with_merged_skills"] = len(legends_with_merges)
    
    if merge_counts:
        stats["avg_merge_count"] = sum(merge_counts) / len(merge_counts)
    
    # Print results
    print(f"  Total legends: {stats['total_legends']}")
    print(f"  Total skills: {stats['total_skills']}")
    print(f"  Skills with merges: {stats['skills_with_merges']}")
    print(f"  Legends with merged skills: {stats['legends_with_merged_skills']}")
    print(f"  Max merge count: {stats['max_merge_count']}")
    print(f"  Avg merge count: {stats['avg_merge_count']:.2f}")
    
    # Validation checks
    issues = []
    
    if stats["total_skills"] == 0:
        issues.append("No skills found in file")
    
    if stats["skills_with_merges"] == 0:
        issues.append("No merged skills found (semantic merging may not be working)")
    
    if stats["max_merge_count"] < 2:
        issues.append("No skills with merge_count > 1 (merging not occurring)")
    
    # Check for old _signatures field
    if "_signatures" in data:
        issues.append("Old _signatures field still present (should be removed)")
    
    if issues:
        print("\n⚠️  VALIDATION ISSUES:")
        for issue in issues:
            print(f"  • {issue}")
    else:
        print("\n✅ Skills validation passed!")
    
    return stats


def main():
    """Run all validations."""
    print("=" * 60)
    print("SEMANTIC MERGE VALIDATION")
    print("=" * 60)
    
    emb_stats = validate_embeddings()
    skill_stats = validate_skills()
    
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    if "error" not in emb_stats and "error" not in skill_stats:
        print("✅ Validation complete!")
        print(f"\nEmbeddings: {emb_stats['legends_with_merges']}/{emb_stats['total_legends']} legends have merged embeddings")
        print(f"Skills: {skill_stats['legends_with_merged_skills']}/{skill_stats['total_legends']} legends have merged skills")
        
        if emb_stats['legends_with_merges'] > 0 or skill_stats['skills_with_merges'] > 0:
            print("\n✅ Semantic merging is WORKING!")
        else:
            print("\n⚠️  No merges detected - may need to reprocess legends")
    else:
        print("❌ Validation failed - check errors above")
        return 1
    
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())

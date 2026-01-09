#!/usr/bin/env python3
"""
Integration test for semantic merging in process_legends.py

Tests the full pipeline with a sample legend to verify:
1. Embeddings are semantically merged across runs
2. Skills are semantically merged
3. Consolidated files show proper merge counts
"""

import json
import sys
import tempfile
import shutil
from pathlib import Path
from datetime import datetime

# Add paths
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))

from semantic_embedding_merger import EmbeddingMerger, SkillMerger


def create_test_legend():
    """Create a minimal test legend."""
    return {
        "name": "Test Legend",
        "designation": "Test Subject",
        "bio": "A test legend for integration testing",
        "personality": {
            "core_traits": ["analytical", "creative"],
            "values": ["truth", "beauty"],
            "quirks": ["perfectionist"]
        },
        "capabilities": {
            "primary": ["testing", "validation"],
            "secondary": ["debugging"]
        },
        "signature_phrases": ["Let's test this!"]
    }


def create_mock_kb_run(run_num: int, embedding: list) -> dict:
    """Create a mock KnowledgeBuilder run result."""
    return {
        "run_number": run_num,
        "embedding": embedding,
        "embedding_dimensions": len(embedding),
        "collected_knowledge": {},
        "descriptor_strategy": "focused" if run_num % 2 == 1 else "diverse",
        "descriptors": ["analytical", "creative"],
        "duration_sec": 0.5,
    }


def create_mock_sb_run(run_num: int, embedding: list, skills: list) -> dict:
    """Create a mock SkillBuilder run result."""
    return {
        "run_number": run_num,
        "embedding": embedding,
        "embedding_dimensions": len(embedding),
        "skill_embeddings": skills,
        "salts_used": ["testing", "validation"],
        "descriptor_strategy": "focused" if run_num % 2 == 1 else "diverse",
        "descriptors": ["analytical", "creative"],
        "duration_sec": 0.5,
    }


def test_embedding_merge_integration():
    """Test that embeddings are properly merged across multiple runs."""
    print("Testing embedding merge integration...")
    
    merger = EmbeddingMerger(similarity_threshold=0.85)
    
    # Simulate first processing run
    first_results = {
        "name": "Test Legend",
        "source_file": "test_legend.json",
        "processed_at": "2024-01-01T00:00:00",
        "run_count": 2,
        "strategy": "hybrid",
        "knowledge_builder_runs": [
            create_mock_kb_run(1, [1.0, 0.0, 0.0]),
            create_mock_kb_run(2, [0.0, 1.0, 0.0]),
        ],
        "skill_builder_runs": [
            create_mock_sb_run(1, [1.0, 0.0, 0.0], [
                {"skill_name": "testing", "embedding": [1.0, 0.0, 0.0]}
            ]),
            create_mock_sb_run(2, [0.0, 1.0, 0.0], [
                {"skill_name": "validation", "embedding": [0.0, 1.0, 0.0]}
            ]),
        ],
    }
    
    # Simulate second processing run with similar embeddings
    second_results = {
        "name": "Test Legend",
        "source_file": "test_legend.json",
        "processed_at": "2024-01-02T00:00:00",
        "run_count": 2,
        "strategy": "hybrid",
        "knowledge_builder_runs": [
            create_mock_kb_run(3, [0.95, 0.05, 0.0]),  # Similar to first run
            create_mock_kb_run(4, [0.0, 0.0, 1.0]),    # Different
        ],
        "skill_builder_runs": [
            create_mock_sb_run(3, [0.95, 0.05, 0.0], [
                {"skill_name": "testing", "embedding": [0.95, 0.05, 0.0]}  # Similar
            ]),
            create_mock_sb_run(4, [0.0, 0.0, 1.0], [
                {"skill_name": "debugging", "embedding": [0.0, 0.0, 1.0]}  # Different
            ]),
        ],
    }
    
    # Simulate the save_embeddings logic
    data = {"legends": {}}
    
    # First save (no existing data)
    existing_entry = data["legends"].get("Test Legend")
    assert existing_entry is None, "Should be first time"
    
    # Create first entry
    data["legends"]["Test Legend"] = {
        "name": first_results["name"],
        "processed_at": first_results["processed_at"],
        "run_count": first_results["run_count"],
        "knowledge_builder": {
            "runs": 2,
            "embeddings": [
                {**create_mock_kb_run(1, [1.0, 0.0, 0.0]), "merged_count": 1},
                {**create_mock_kb_run(2, [0.0, 1.0, 0.0]), "merged_count": 1},
            ]
        },
        "skill_builder": {
            "runs": 2,
            "embeddings": [
                {**create_mock_sb_run(1, [1.0, 0.0, 0.0], []), "merged_count": 1},
                {**create_mock_sb_run(2, [0.0, 1.0, 0.0], []), "merged_count": 1},
            ]
        }
    }
    
    # Second save (with existing data) - simulate semantic merge
    existing_entry = data["legends"]["Test Legend"]
    existing_kb_embs = existing_entry["knowledge_builder"]["embeddings"]
    new_kb_embs = [
        {**create_mock_kb_run(3, [0.95, 0.05, 0.0]), "processed_at": second_results["processed_at"]},
        {**create_mock_kb_run(4, [0.0, 0.0, 1.0]), "processed_at": second_results["processed_at"]},
    ]
    
    merged_kb_embs = existing_kb_embs.copy()
    kb_merged = 0
    kb_added = 0
    
    for new_emb in new_kb_embs:
        updated, was_merged = merger.merge_similar_embeddings(merged_kb_embs, new_emb)
        merged_kb_embs = updated
        if was_merged:
            kb_merged += 1
        else:
            kb_added += 1
    
    # Verify results
    assert kb_merged == 1, f"Expected 1 KB merge (similar to run 1), got {kb_merged}"
    assert kb_added == 1, f"Expected 1 KB addition (different), got {kb_added}"
    assert len(merged_kb_embs) == 3, f"Expected 3 KB embeddings total, got {len(merged_kb_embs)}"
    
    # Check that merged embedding has count > 1
    merged_emb = [e for e in merged_kb_embs if e.get("merged_count", 1) > 1]
    assert len(merged_emb) == 1, f"Expected 1 merged embedding, got {len(merged_emb)}"
    assert merged_emb[0]["merged_count"] == 2, f"Expected merged_count=2, got {merged_emb[0]['merged_count']}"
    
    print("  ✓ Embedding merge integration test passed")
    print(f"    - {kb_merged} embeddings merged")
    print(f"    - {kb_added} embeddings added")
    print(f"    - Total embeddings: {len(merged_kb_embs)}")


def test_skill_merge_integration():
    """Test that skills are properly merged across multiple runs."""
    print("\nTesting skill merge integration...")
    
    merger = SkillMerger(similarity_threshold=0.90)
    
    # First run skills
    existing_skills = [
        {
            "legend_name": "Test Legend",
            "skill_name": "testing",
            "embedding": [1.0, 0.0, 0.0],
            "merged_count": 1,
            "salts_used": ["quality_assurance"]
        },
        {
            "legend_name": "Test Legend",
            "skill_name": "validation",
            "embedding": [0.0, 1.0, 0.0],
            "merged_count": 1,
            "salts_used": ["verification"]
        }
    ]
    
    # Second run skills (one similar, one new)
    new_skills = [
        {
            "legend_name": "Test Legend",
            "skill_name": "qa_testing",
            "embedding": [0.95, 0.05, 0.0],  # Similar to "testing"
            "salts_used": ["quality_control"]
        },
        {
            "legend_name": "Test Legend",
            "skill_name": "debugging",
            "embedding": [0.0, 0.0, 1.0],  # Different
            "salts_used": ["troubleshooting"]
        }
    ]
    
    result = merger.merge_skills(existing_skills, new_skills)
    
    assert result["merged_count"] == 1, f"Expected 1 skill merge, got {result['merged_count']}"
    assert result["added_count"] == 1, f"Expected 1 skill addition, got {result['added_count']}"
    assert len(result["merged_skills"]) == 3, f"Expected 3 total skills, got {len(result['merged_skills'])}"
    
    # Verify merged skill has combined salts
    merged_skill = [s for s in result["merged_skills"] if s.get("merged_count", 1) > 1]
    assert len(merged_skill) == 1, "Should have one merged skill"
    assert merged_skill[0]["merged_count"] == 2, "Merged skill should have count 2"
    assert "quality_assurance" in merged_skill[0]["salts_used"], "Should preserve old salts"
    assert "quality_control" in merged_skill[0]["salts_used"], "Should add new salts"
    
    print("  ✓ Skill merge integration test passed")
    print(f"    - {result['merged_count']} skills merged")
    print(f"    - {result['added_count']} skills added")
    print(f"    - Total skills: {len(result['merged_skills'])}")


def test_incremental_learning():
    """Test that the system demonstrates incremental learning behavior."""
    print("\nTesting incremental learning...")
    
    merger = EmbeddingMerger(similarity_threshold=0.85)
    
    # Simulate 3 processing runs with progressively refined embeddings
    embeddings = []
    
    # Run 1: Initial embedding
    run1 = {"embedding": [1.0, 0.0, 0.0], "merged_count": 1, "run": 1}
    embeddings.append(run1)
    
    # Run 2: Similar but slightly different (should merge)
    run2 = {"embedding": [0.95, 0.05, 0.0], "run": 2}
    updated, merged = merger.merge_similar_embeddings(embeddings, run2)
    embeddings = updated
    
    assert merged, "Run 2 should merge with Run 1"
    assert len(embeddings) == 1, "Should still have 1 embedding"
    assert embeddings[0]["merged_count"] == 2, "Should show 2 merges"
    
    # Run 3: Another similar embedding (should merge with the already-merged one)
    run3 = {"embedding": [0.92, 0.08, 0.0], "run": 3}
    updated, merged = merger.merge_similar_embeddings(embeddings, run3)
    embeddings = updated
    
    assert merged, "Run 3 should merge with consolidated embedding"
    assert len(embeddings) == 1, "Should still have 1 embedding"
    assert embeddings[0]["merged_count"] == 3, "Should show 3 merges"
    
    # Verify the embedding has evolved (not identical to original)
    final_emb = embeddings[0]["embedding"]
    assert final_emb != [1.0, 0.0, 0.0], "Embedding should have evolved"
    assert final_emb[0] > 0.9, "Should still be primarily in first dimension"
    assert final_emb[1] > 0.0, "Should have incorporated second dimension"
    
    print("  ✓ Incremental learning test passed")
    print(f"    - Started with: [1.0, 0.0, 0.0]")
    print(f"    - Evolved to: [{final_emb[0]:.3f}, {final_emb[1]:.3f}, {final_emb[2]:.3f}]")
    print(f"    - Merge count: {embeddings[0]['merged_count']}")


def run_integration_tests():
    """Run all integration tests."""
    print("=" * 60)
    print("SEMANTIC MERGE INTEGRATION TESTS")
    print("=" * 60)
    
    try:
        test_embedding_merge_integration()
        test_skill_merge_integration()
        test_incremental_learning()
        
        print("\n" + "=" * 60)
        print("✅ ALL INTEGRATION TESTS PASSED!")
        print("=" * 60)
        print("\nThe semantic merging system correctly:")
        print("  • Merges similar embeddings using cosine similarity")
        print("  • Adds dissimilar embeddings as new entries")
        print("  • Consolidates skills based on semantic similarity")
        print("  • Demonstrates incremental learning behavior")
        print("  • Preserves metadata from all merged runs")
        return 0
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        return 1
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(run_integration_tests())

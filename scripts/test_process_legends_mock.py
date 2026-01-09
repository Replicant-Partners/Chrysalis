#!/usr/bin/env python3
"""
Mock test for process_legends.py semantic merging without requiring full pipeline.

Tests the save_embeddings and save_skill_artifacts functions directly.
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

# We'll mock the functions we need
import process_legends as pl


def test_save_embeddings_with_merge():
    """Test that save_embeddings properly merges similar embeddings."""
    print("Testing save_embeddings with semantic merge...")
    
    # Create temporary directory for test
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        
        # Override the paths
        original_embeddings = pl.ALL_EMBEDDINGS
        original_dir = pl.EMBEDDINGS_DIR
        
        pl.EMBEDDINGS_DIR = tmpdir
        pl.ALL_EMBEDDINGS = tmpdir / "all_embeddings.json"
        
        try:
            # First processing run
            results1 = {
                "name": "Test Legend",
                "source_file": "test.json",
                "processed_at": "2024-01-01T00:00:00",
                "run_count": 2,
                "strategy": "hybrid",
                "knowledge_builder_runs": [
                    {
                        "run_number": 1,
                        "embedding": [1.0, 0.0, 0.0],
                        "embedding_dimensions": 3,
                        "collected_knowledge": {},
                        "descriptor_strategy": "focused",
                        "descriptors": ["trait1"],
                        "duration_sec": 0.5,
                    },
                    {
                        "run_number": 2,
                        "embedding": [0.0, 1.0, 0.0],
                        "embedding_dimensions": 3,
                        "collected_knowledge": {},
                        "descriptor_strategy": "diverse",
                        "descriptors": ["trait2"],
                        "duration_sec": 0.5,
                    },
                ],
                "skill_builder_runs": [
                    {
                        "run_number": 1,
                        "embedding": [1.0, 0.0, 0.0],
                        "embedding_dimensions": 3,
                        "skill_embeddings": [],
                        "salts_used": ["skill1"],
                        "descriptor_strategy": "focused",
                        "descriptors": ["trait1"],
                        "duration_sec": 0.5,
                    },
                ],
            }
            
            # Save first run
            pl.save_embeddings("Test Legend", results1)
            
            # Verify file was created
            assert pl.ALL_EMBEDDINGS.exists(), "Embeddings file should be created"
            
            with open(pl.ALL_EMBEDDINGS) as f:
                data1 = json.load(f)
            
            assert "Test Legend" in data1["legends"], "Legend should be in file"
            assert data1["legends"]["Test Legend"]["knowledge_builder"]["runs"] == 2
            
            # Second processing run with similar embeddings
            results2 = {
                "name": "Test Legend",
                "source_file": "test.json",
                "processed_at": "2024-01-02T00:00:00",
                "run_count": 2,
                "strategy": "hybrid",
                "knowledge_builder_runs": [
                    {
                        "run_number": 3,
                        "embedding": [0.95, 0.05, 0.0],  # Similar to run 1
                        "embedding_dimensions": 3,
                        "collected_knowledge": {},
                        "descriptor_strategy": "focused",
                        "descriptors": ["trait1", "trait3"],
                        "duration_sec": 0.5,
                    },
                    {
                        "run_number": 4,
                        "embedding": [0.0, 0.0, 1.0],  # Different
                        "embedding_dimensions": 3,
                        "collected_knowledge": {},
                        "descriptor_strategy": "diverse",
                        "descriptors": ["trait4"],
                        "duration_sec": 0.5,
                    },
                ],
                "skill_builder_runs": [
                    {
                        "run_number": 2,
                        "embedding": [0.95, 0.05, 0.0],  # Similar to run 1
                        "embedding_dimensions": 3,
                        "skill_embeddings": [],
                        "salts_used": ["skill1"],
                        "descriptor_strategy": "diverse",
                        "descriptors": ["trait2"],
                        "duration_sec": 0.5,
                    },
                ],
            }
            
            # Save second run (should merge)
            pl.save_embeddings("Test Legend", results2)
            
            with open(pl.ALL_EMBEDDINGS) as f:
                data2 = json.load(f)
            
            # Verify merging occurred
            kb_embs = data2["legends"]["Test Legend"]["knowledge_builder"]["embeddings"]
            
            # Should have 3 embeddings total (1 merged, 2 new)
            assert len(kb_embs) == 3, f"Expected 3 KB embeddings, got {len(kb_embs)}"
            
            # At least one should have merged_count > 1
            merged_embs = [e for e in kb_embs if e.get("merged_count", 1) > 1]
            assert len(merged_embs) >= 1, f"Expected at least 1 merged embedding, got {len(merged_embs)}"
            
            # Check that merged embedding has evolved
            merged_emb = merged_embs[0]
            assert merged_emb["merged_count"] == 2, f"Expected merge_count=2, got {merged_emb['merged_count']}"
            assert "similarity_score" in merged_emb, "Should have similarity_score"
            assert merged_emb["similarity_score"] > 0.85, f"Similarity should be > 0.85, got {merged_emb['similarity_score']}"
            
            # Check descriptor merging
            assert "trait3" in merged_emb["descriptors"], "New descriptors should be merged"
            
            print("  ✓ Embeddings are properly merged")
            print(f"    - Total KB embeddings: {len(kb_embs)}")
            print(f"    - Merged embeddings: {len(merged_embs)}")
            print(f"    - Merge count: {merged_emb['merged_count']}")
            print(f"    - Similarity: {merged_emb['similarity_score']:.3f}")
            
        finally:
            # Restore original paths
            pl.ALL_EMBEDDINGS = original_embeddings
            pl.EMBEDDINGS_DIR = original_dir


def test_save_skills_with_merge():
    """Test that save_skill_artifacts properly merges similar skills."""
    print("\nTesting save_skill_artifacts with semantic merge...")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        
        # Override paths
        original_skills = pl.ALL_SKILLS
        original_dir = pl.EMBEDDINGS_DIR
        
        pl.EMBEDDINGS_DIR = tmpdir
        pl.ALL_SKILLS = tmpdir / "all_skills.json"
        
        try:
            # First run
            sb_runs1 = [
                {
                    "run_number": 1,
                    "skill_embeddings": [
                        {
                            "skill_name": "painting",
                            "embedding": [1.0, 0.0, 0.0],
                        },
                        {
                            "skill_name": "teaching",
                            "embedding": [0.0, 1.0, 0.0],
                        },
                    ],
                    "salts_used": ["art", "education"],
                    "descriptor_strategy": "focused",
                }
            ]
            
            pl.save_skill_artifacts("Test Legend", sb_runs1)
            
            with open(pl.ALL_SKILLS) as f:
                data1 = json.load(f)
            
            assert "Test Legend" in data1["skills_by_legend"]
            assert len(data1["skills_by_legend"]["Test Legend"]) == 2
            
            # Second run with similar skill
            sb_runs2 = [
                {
                    "run_number": 2,
                    "skill_embeddings": [
                        {
                            "skill_name": "artistic_painting",
                            "embedding": [0.95, 0.05, 0.0],  # Similar to "painting"
                        },
                        {
                            "skill_name": "music",
                            "embedding": [0.0, 0.0, 1.0],  # Different
                        },
                    ],
                    "salts_used": ["creativity", "performance"],
                    "descriptor_strategy": "diverse",
                }
            ]
            
            pl.save_skill_artifacts("Test Legend", sb_runs2)
            
            with open(pl.ALL_SKILLS) as f:
                data2 = json.load(f)
            
            skills = data2["skills_by_legend"]["Test Legend"]
            
            # Should have 3 skills (painting merged, teaching kept, music added)
            assert len(skills) == 3, f"Expected 3 skills, got {len(skills)}"
            
            # At least one should have merged_count > 1
            merged_skills = [s for s in skills if s.get("merged_count", 1) > 1]
            assert len(merged_skills) >= 1, f"Expected at least 1 merged skill, got {len(merged_skills)}"
            
            merged_skill = merged_skills[0]
            assert merged_skill["merged_count"] == 2, f"Expected merge_count=2, got {merged_skill['merged_count']}"
            assert "similarity_score" in merged_skill, "Should have similarity_score"
            
            # Check salts merging
            assert "art" in merged_skill["salts_used"] or "creativity" in merged_skill["salts_used"], "Salts should be merged"
            
            print("  ✓ Skills are properly merged")
            print(f"    - Total skills: {len(skills)}")
            print(f"    - Merged skills: {len(merged_skills)}")
            print(f"    - Merge count: {merged_skill['merged_count']}")
            print(f"    - Similarity: {merged_skill['similarity_score']:.3f}")
            
        finally:
            pl.ALL_SKILLS = original_skills
            pl.EMBEDDINGS_DIR = original_dir


def run_tests():
    """Run all mock tests."""
    print("=" * 60)
    print("PROCESS_LEGENDS SEMANTIC MERGE TESTS")
    print("=" * 60)
    
    try:
        test_save_embeddings_with_merge()
        test_save_skills_with_merge()
        
        print("\n" + "=" * 60)
        print("✅ ALL PROCESS_LEGENDS TESTS PASSED!")
        print("=" * 60)
        print("\nThe updated process_legends.py correctly:")
        print("  • Merges similar embeddings using cosine similarity")
        print("  • Merges similar skills based on embedding similarity")
        print("  • Preserves metadata from all merged runs")
        print("  • Tracks merge counts and similarity scores")
        print("  • Demonstrates incremental learning behavior")
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
    sys.exit(run_tests())

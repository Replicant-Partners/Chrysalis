#!/usr/bin/env python3
"""
Comprehensive test suite for semantic merging functionality.
"""

import json
import sys
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from semantic_embedding_merger import EmbeddingMerger, SkillMerger


def test_cosine_similarity():
    """Test cosine similarity calculation with various scenarios."""
    print("Testing cosine similarity...")
    merger = EmbeddingMerger()
    
    # Test 1: Identical vectors
    vec1 = [1.0, 0.0, 0.0]
    vec2 = [1.0, 0.0, 0.0]
    sim = merger.cosine_similarity(vec1, vec2)
    assert abs(sim - 1.0) < 0.001, f"Identical vectors should have similarity 1.0, got {sim}"
    print("  ✓ Identical vectors test passed")
    
    # Test 2: Orthogonal vectors
    vec3 = [1.0, 0.0, 0.0]
    vec4 = [0.0, 1.0, 0.0]
    sim = merger.cosine_similarity(vec3, vec4)
    assert abs(sim - 0.0) < 0.001, f"Orthogonal vectors should have similarity 0.0, got {sim}"
    print("  ✓ Orthogonal vectors test passed")
    
    # Test 3: Similar vectors
    vec5 = [1.0, 1.0, 0.0]
    vec6 = [1.0, 0.9, 0.1]
    sim = merger.cosine_similarity(vec5, vec6)
    assert 0.9 < sim < 1.0, f"Similar vectors should have high similarity, got {sim}"
    print("  ✓ Similar vectors test passed")
    
    # Test 4: Opposite vectors
    vec7 = [1.0, 0.0, 0.0]
    vec8 = [-1.0, 0.0, 0.0]
    sim = merger.cosine_similarity(vec7, vec8)
    assert abs(sim - (-1.0)) < 0.001, f"Opposite vectors should have similarity -1.0, got {sim}"
    print("  ✓ Opposite vectors test passed")
    
    # Test 5: Empty vectors
    vec9 = []
    vec10 = [1.0, 0.0]
    sim = merger.cosine_similarity(vec9, vec10)
    assert sim == 0.0, f"Empty vector should return 0.0, got {sim}"
    print("  ✓ Empty vectors test passed")
    
    # Test 6: Different dimensions
    vec11 = [1.0, 0.0]
    vec12 = [1.0, 0.0, 0.0]
    sim = merger.cosine_similarity(vec11, vec12)
    assert sim == 0.0, f"Different dimensions should return 0.0, got {sim}"
    print("  ✓ Different dimensions test passed")


def test_embedding_averaging():
    """Test embedding averaging with various weight configurations."""
    print("\nTesting embedding averaging...")
    merger = EmbeddingMerger()
    
    # Test 1: Equal weights
    emb1 = [1.0, 0.0, 0.0]
    emb2 = [0.0, 1.0, 0.0]
    avg = merger.average_embeddings([emb1, emb2])
    expected = [0.5, 0.5, 0.0]
    assert avg == expected, f"Expected {expected}, got {avg}"
    print("  ✓ Equal weights test passed")
    
    # Test 2: Custom weights (75/25)
    avg_weighted = merger.average_embeddings([emb1, emb2], weights=[0.75, 0.25])
    expected = [0.75, 0.25, 0.0]
    assert avg_weighted == expected, f"Expected {expected}, got {avg_weighted}"
    print("  ✓ Custom weights test passed")
    
    # Test 3: Three embeddings
    emb3 = [0.0, 0.0, 1.0]
    avg_three = merger.average_embeddings([emb1, emb2, emb3])
    expected = [1/3, 1/3, 1/3]
    for i in range(3):
        assert abs(avg_three[i] - expected[i]) < 0.001, f"Expected {expected}, got {avg_three}"
    print("  ✓ Three embeddings test passed")
    
    # Test 4: Weighted toward newer (60/40)
    avg_newer = merger.average_embeddings([emb1, emb2], weights=[0.4, 0.6])
    expected = [0.4, 0.6, 0.0]
    assert avg_newer == expected, f"Expected {expected}, got {avg_newer}"
    print("  ✓ Weighted toward newer test passed")
    
    # Test 5: Single embedding
    avg_single = merger.average_embeddings([emb1])
    assert avg_single == emb1, f"Single embedding should return itself, got {avg_single}"
    print("  ✓ Single embedding test passed")


def test_embedding_merging():
    """Test the full embedding merge logic."""
    print("\nTesting embedding merging...")
    
    # Test 1: Merge similar embeddings (above threshold)
    merger = EmbeddingMerger(similarity_threshold=0.85)
    existing = [
        {
            "embedding": [1.0, 0.0, 0.0],
            "merged_count": 1,
            "descriptors": ["trait1", "trait2"]
        }
    ]
    new = {
        "embedding": [0.95, 0.05, 0.0],
        "processed_at": "2024-01-01",
        "descriptors": ["trait2", "trait3"]
    }
    
    updated, was_merged = merger.merge_similar_embeddings(existing, new)
    assert was_merged, "Expected merge to occur for similar embeddings"
    assert len(updated) == 1, f"Expected 1 entry after merge, got {len(updated)}"
    assert updated[0]["merged_count"] == 2, f"Expected merged_count=2, got {updated[0]['merged_count']}"
    assert "trait3" in updated[0]["descriptors"], "New descriptors should be merged"
    print("  ✓ Similar embeddings merge test passed")
    
    # Test 2: Don't merge dissimilar embeddings (below threshold)
    existing2 = [
        {
            "embedding": [1.0, 0.0, 0.0],
            "merged_count": 1
        }
    ]
    new2 = {
        "embedding": [0.0, 0.0, 1.0],
        "processed_at": "2024-01-01"
    }
    
    updated2, was_merged2 = merger.merge_similar_embeddings(existing2, new2)
    assert not was_merged2, "Expected no merge for dissimilar embeddings"
    assert len(updated2) == 2, f"Expected 2 entries after no merge, got {len(updated2)}"
    assert updated2[1]["merged_count"] == 1, "New entry should have merged_count=1"
    print("  ✓ Dissimilar embeddings no-merge test passed")
    
    # Test 3: Multiple existing embeddings
    existing3 = [
        {"embedding": [1.0, 0.0, 0.0], "merged_count": 1},
        {"embedding": [0.0, 1.0, 0.0], "merged_count": 1},
    ]
    new3 = {
        "embedding": [0.0, 0.95, 0.05],
        "processed_at": "2024-01-01"
    }
    
    updated3, was_merged3 = merger.merge_similar_embeddings(existing3, new3)
    assert was_merged3, "Expected merge with second embedding"
    assert len(updated3) == 2, f"Expected 2 entries, got {len(updated3)}"
    assert updated3[1]["merged_count"] == 2, "Second entry should be merged"
    print("  ✓ Multiple existing embeddings test passed")


def test_skill_merging():
    """Test skill merging with semantic similarity."""
    print("\nTesting skill merging...")
    
    # Test 1: Merge similar skills
    merger = SkillMerger(similarity_threshold=0.90)
    existing = [
        {
            "skill_name": "programming",
            "embedding": [1.0, 0.0, 0.0],
            "merged_count": 1,
            "salts_used": ["coding", "software"]
        }
    ]
    
    new_similar = [
        {
            "skill_name": "coding",
            "embedding": [0.95, 0.05, 0.0],
            "salts_used": ["programming", "development"]
        }
    ]
    
    result = merger.merge_skills(existing, new_similar)
    assert result["merged_count"] == 1, f"Expected 1 merge, got {result['merged_count']}"
    assert result["added_count"] == 0, f"Expected 0 additions, got {result['added_count']}"
    assert len(result["merged_skills"]) == 1, f"Expected 1 skill, got {len(result['merged_skills'])}"
    assert result["merged_skills"][0]["merged_count"] == 2, "Merged skill should have count 2"
    assert "development" in result["merged_skills"][0]["salts_used"], "Salts should be merged"
    print("  ✓ Similar skills merge test passed")
    
    # Test 2: Add different skills
    new_different = [
        {
            "skill_name": "painting",
            "embedding": [0.0, 0.0, 1.0],
            "salts_used": ["art", "creativity"]
        }
    ]
    
    result2 = merger.merge_skills(existing, new_different)
    assert result2["merged_count"] == 0, f"Expected 0 merges, got {result2['merged_count']}"
    assert result2["added_count"] == 1, f"Expected 1 addition, got {result2['added_count']}"
    assert len(result2["merged_skills"]) == 2, f"Expected 2 skills, got {len(result2['merged_skills'])}"
    print("  ✓ Different skills add test passed")
    
    # Test 3: Multiple new skills
    new_multiple = [
        {
            "skill_name": "software_engineering",
            "embedding": [0.98, 0.02, 0.0],
            "salts_used": ["engineering"]
        },
        {
            "skill_name": "music",
            "embedding": [0.0, 1.0, 0.0],
            "salts_used": ["composition"]
        }
    ]
    
    result3 = merger.merge_skills(existing, new_multiple)
    assert result3["merged_count"] == 1, f"Expected 1 merge, got {result3['merged_count']}"
    assert result3["added_count"] == 1, f"Expected 1 addition, got {result3['added_count']}"
    assert len(result3["merged_skills"]) == 2, f"Expected 2 skills, got {len(result3['merged_skills'])}"
    print("  ✓ Multiple new skills test passed")
    
    # Test 4: Skip skills without embeddings
    new_no_embedding = [
        {
            "skill_name": "invalid",
            "embedding": [],
        }
    ]
    
    result4 = merger.merge_skills(existing, new_no_embedding)
    assert result4["skipped_count"] == 1, f"Expected 1 skip, got {result4['skipped_count']}"
    assert result4["merged_count"] == 0, "Should not merge empty embedding"
    assert result4["added_count"] == 0, "Should not add empty embedding"
    print("  ✓ Skip invalid skills test passed")


def test_threshold_sensitivity():
    """Test how different thresholds affect merging behavior."""
    print("\nTesting threshold sensitivity...")
    
    # Test with high threshold (0.95) - use vectors with lower similarity
    merger_high = EmbeddingMerger(similarity_threshold=0.95)
    existing = [{"embedding": [1.0, 0.0, 0.0], "merged_count": 1}]
    new = {"embedding": [0.7, 0.3, 0.0], "processed_at": "2024-01-01"}  # similarity ~0.92
    
    updated_high, merged_high = merger_high.merge_similar_embeddings(existing, new)
    assert not merged_high, "High threshold should prevent merge"
    assert len(updated_high) == 2, "Should add as separate entry"
    print("  ✓ High threshold test passed")
    
    # Test with low threshold (0.70)
    merger_low = EmbeddingMerger(similarity_threshold=0.70)
    existing2 = [{"embedding": [1.0, 0.0, 0.0], "merged_count": 1}]
    new2 = {"embedding": [0.8, 0.2, 0.0], "processed_at": "2024-01-01"}  # similarity ~0.97
    
    updated_low, merged_low = merger_low.merge_similar_embeddings(existing2, new2)
    assert merged_low, "Low threshold should allow merge"
    assert len(updated_low) == 1, "Should merge into single entry"
    print("  ✓ Low threshold test passed")


def run_all_tests():
    """Run all test suites."""
    print("=" * 60)
    print("SEMANTIC MERGE TEST SUITE")
    print("=" * 60)
    
    try:
        test_cosine_similarity()
        test_embedding_averaging()
        test_embedding_merging()
        test_skill_merging()
        test_threshold_sensitivity()
        
        print("\n" + "=" * 60)
        print("✅ ALL TESTS PASSED!")
        print("=" * 60)
        return 0
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(run_all_tests())

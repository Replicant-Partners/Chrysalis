#!/usr/bin/env python3
"""
Semantic Embedding Merger

Provides utilities for semantically merging embeddings and skills using:
- Cosine similarity comparison
- Weighted averaging of similar embeddings
- Incremental learning consolidation
"""

import math
from typing import List, Dict, Any, Tuple, Optional


class EmbeddingMerger:
    """Merge embeddings using semantic similarity."""
    
    def __init__(self, similarity_threshold: float = 0.85):
        """
        Args:
            similarity_threshold: Cosine similarity threshold for merging (0.85 = 85% similar)
        """
        self.similarity_threshold = similarity_threshold
    
    def cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """
        Calculate cosine similarity between two vectors.
        
        Args:
            vec1: First embedding vector
            vec2: Second embedding vector
            
        Returns:
            Cosine similarity score between 0 and 1
        """
        if not vec1 or not vec2:
            return 0.0
        
        # Issue #7 Fix: Log dimension mismatch for debugging
        if len(vec1) != len(vec2):
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(
                f"Dimension mismatch in cosine_similarity: "
                f"vec1={len(vec1)} dims, vec2={len(vec2)} dims"
            )
            return 0.0
        
        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        magnitude1 = math.sqrt(sum(a * a for a in vec1))
        magnitude2 = math.sqrt(sum(b * b for b in vec2))
        
        if magnitude1 == 0 or magnitude2 == 0:
            return 0.0
        
        return dot_product / (magnitude1 * magnitude2)
    
    def average_embeddings(
        self, 
        embeddings: List[List[float]], 
        weights: Optional[List[float]] = None
    ) -> List[float]:
        """
        Average multiple embeddings, optionally with weights.
        
        Args:
            embeddings: List of embedding vectors
            weights: Optional weights for each embedding (default: equal weights)
        
        Returns:
            Averaged embedding vector
        
        Raises:
            ValueError: If embeddings and weights lengths don't match
            TypeError: If embeddings or weights are not the expected types
        """
        if not embeddings:
            return []
        
        # Issue #12 Fix: Add type validation
        if not isinstance(embeddings, list):
            raise TypeError(f"embeddings must be a list, got {type(embeddings)}")
        
        if not all(isinstance(emb, list) for emb in embeddings):
            raise TypeError("All embeddings must be lists")
        
        if weights is None:
            weights = [1.0] * len(embeddings)
        
        if not isinstance(weights, list):
            raise TypeError(f"weights must be a list, got {type(weights)}")
        
        if len(embeddings) != len(weights):
            raise ValueError(
                f"Number of embeddings ({len(embeddings)}) must match "
                f"number of weights ({len(weights)})"
            )
        
        # Normalize weights
        total_weight = sum(weights)
        # Issue #8 Fix: Use epsilon for floating-point comparison
        if total_weight < 1e-10:  # More robust than == 0
            weights = [1.0] * len(embeddings)
            total_weight = len(embeddings)
        
        normalized_weights = [w / total_weight for w in weights]
        
        # Weighted average
        dim = len(embeddings[0])
        averaged = [0.0] * dim
        
        for emb, weight in zip(embeddings, normalized_weights):
            for i in range(dim):
                averaged[i] += emb[i] * weight
        
        return averaged
    
    def merge_similar_embeddings(
        self, 
        existing: List[Dict[str, Any]], 
        new: Dict[str, Any]
    ) -> Tuple[List[Dict[str, Any]], bool]:
        """
        Merge new embedding with existing embeddings if semantically similar.
        
        Args:
            existing: List of existing embedding entries
            new: New embedding entry to merge
        
        Returns:
            Tuple of (updated_embeddings, was_merged)
        """
        new_embedding = new.get("embedding", [])
        if not new_embedding:
            return existing, False
        
        # Find most similar existing embedding
        best_match_idx = -1
        best_similarity = 0.0
        
        for idx, entry in enumerate(existing):
            existing_emb = entry.get("embedding", [])
            if not existing_emb:
                continue
            
            similarity = self.cosine_similarity(new_embedding, existing_emb)
            if similarity > best_similarity:
                best_similarity = similarity
                best_match_idx = idx
        
        # If similar enough, merge by averaging
        if best_similarity >= self.similarity_threshold and best_match_idx >= 0:
            existing_entry = existing[best_match_idx]
            existing_emb = existing_entry["embedding"]
            
            # Weight newer embeddings slightly higher (60/40 split)
            # This allows the system to adapt to new information while preserving old knowledge
            merged_emb = self.average_embeddings(
                [existing_emb, new_embedding],
                weights=[0.4, 0.6]
            )
            
            # Update the entry
            existing[best_match_idx]["embedding"] = merged_emb
            existing[best_match_idx]["merged_count"] = existing_entry.get("merged_count", 1) + 1
            existing[best_match_idx]["last_merged_at"] = new.get("processed_at", "")
            existing[best_match_idx]["similarity_score"] = best_similarity
            
            # Preserve metadata from both old and new
            if "descriptors" in new:
                old_descriptors = set(existing_entry.get("descriptors", []))
                new_descriptors = set(new.get("descriptors", []))
                existing[best_match_idx]["descriptors"] = list(old_descriptors | new_descriptors)
            
            return existing, True
        else:
            # Not similar enough, add as new entry
            new["merged_count"] = 1
            existing.append(new)
            return existing, False


class SkillMerger:
    """Merge skills using semantic similarity of their embeddings."""
    
    def __init__(self, similarity_threshold: float = 0.90):
        """
        Args:
            similarity_threshold: Cosine similarity threshold for merging skills (0.90 = 90% similar)
        """
        self.embedding_merger = EmbeddingMerger(similarity_threshold)
    
    def merge_skills(
        self,
        existing_skills: List[Dict[str, Any]],
        new_skills: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Semantically merge new skills with existing skills.
        
        Args:
            existing_skills: List of existing skill entries
            new_skills: List of new skill entries to merge
        
        Returns:
            Dict with 'merged_skills', 'added_count', 'merged_count', 'skipped_count'
        """
        merged_skills = existing_skills.copy()
        added = 0
        merged = 0
        skipped = 0
        
        for new_skill in new_skills:
            new_emb = new_skill.get("embedding", [])
            if not new_emb:
                skipped += 1
                continue
            
            # Find semantically similar skill
            best_match_idx = -1
            best_similarity = 0.0
            
            for idx, existing_skill in enumerate(merged_skills):
                existing_emb = existing_skill.get("embedding", [])
                if not existing_emb:
                    continue
                
                similarity = self.embedding_merger.cosine_similarity(new_emb, existing_emb)
                if similarity > best_similarity:
                    best_similarity = similarity
                    best_match_idx = idx
            
            # Merge if similar enough
            if best_similarity >= self.embedding_merger.similarity_threshold and best_match_idx >= 0:
                # Average the embeddings
                existing_skill = merged_skills[best_match_idx]
                merged_emb = self.embedding_merger.average_embeddings(
                    [existing_skill["embedding"], new_emb],
                    weights=[0.4, 0.6]  # Favor newer
                )
                
                merged_skills[best_match_idx]["embedding"] = merged_emb
                merged_skills[best_match_idx]["merged_count"] = existing_skill.get("merged_count", 1) + 1
                merged_skills[best_match_idx]["similarity_score"] = best_similarity
                
                # Merge salts_used lists
                old_salts = set(existing_skill.get("salts_used", []))
                new_salts = set(new_skill.get("salts_used", []))
                merged_skills[best_match_idx]["salts_used"] = list(old_salts | new_salts)
                
                merged += 1
            else:
                # Add as new skill
                new_skill["merged_count"] = 1
                merged_skills.append(new_skill)
                added += 1
        
        return {
            "merged_skills": merged_skills,
            "added_count": added,
            "merged_count": merged,
            "skipped_count": skipped,
        }


def test_merger():
    """Quick self-test of merger functionality."""
    print("Testing EmbeddingMerger...")
    
    merger = EmbeddingMerger(similarity_threshold=0.85)
    
    # Test cosine similarity
    vec1 = [1.0, 0.0, 0.0]
    vec2 = [1.0, 0.0, 0.0]
    sim = merger.cosine_similarity(vec1, vec2)
    assert abs(sim - 1.0) < 0.001, f"Expected 1.0, got {sim}"
    print("  ✓ Cosine similarity test passed")
    
    # Test averaging
    emb1 = [1.0, 0.0, 0.0]
    emb2 = [0.0, 1.0, 0.0]
    avg = merger.average_embeddings([emb1, emb2])
    assert avg == [0.5, 0.5, 0.0], f"Expected [0.5, 0.5, 0.0], got {avg}"
    print("  ✓ Averaging test passed")
    
    # Test merging
    existing = [{"embedding": [1.0, 0.0, 0.0], "merged_count": 1}]
    new = {"embedding": [0.95, 0.05, 0.0], "processed_at": "2024-01-01"}
    updated, was_merged = merger.merge_similar_embeddings(existing, new)
    assert was_merged, "Expected merge to occur"
    assert updated[0]["merged_count"] == 2, f"Expected merged_count=2, got {updated[0]['merged_count']}"
    print("  ✓ Merge test passed")
    
    print("\nTesting SkillMerger...")
    skill_merger = SkillMerger(similarity_threshold=0.90)
    
    existing_skills = [
        {
            "skill_name": "programming",
            "embedding": [1.0, 0.0, 0.0],
            "merged_count": 1,
        }
    ]
    
    new_skills = [
        {
            "skill_name": "coding",
            "embedding": [0.95, 0.05, 0.0],
        }
    ]
    
    result = skill_merger.merge_skills(existing_skills, new_skills)
    assert result["merged_count"] == 1, f"Expected 1 merge, got {result['merged_count']}"
    assert result["added_count"] == 0, f"Expected 0 additions, got {result['added_count']}"
    print("  ✓ Skill merge test passed")
    
    print("\n✅ All tests passed!")


if __name__ == "__main__":
    test_merger()

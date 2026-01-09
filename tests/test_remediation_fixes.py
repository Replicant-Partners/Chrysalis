#!/usr/bin/env python3
"""
Comprehensive tests for code review remediation fixes.

Tests all P0 and P1 fixes to ensure they work correctly.
"""

import pytest
import time
import tempfile
import logging
from pathlib import Path
from filelock import FileLock, Timeout

# Add scripts to path
import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from semantic_embedding_merger import EmbeddingMerger, SkillMerger
from rate_limiter import RateLimiter, get_rate_limiter


class TestIssue1FileLockTimeouts:
    """Test Issue #1: File lock timeouts."""
    
    def test_file_lock_has_timeout(self):
        """Test that FileLock can be created with timeout."""
        with tempfile.NamedTemporaryFile() as f:
            lock = FileLock(f.name + ".lock", timeout=1)
            assert lock.timeout == 1
    
    def test_file_lock_timeout_triggers(self):
        """Test that file lock timeout actually triggers."""
        with tempfile.NamedTemporaryFile() as f:
            lock1 = FileLock(f.name + ".lock", timeout=1)
            lock2 = FileLock(f.name + ".lock", timeout=1)
            
            with lock1:
                # Second lock should timeout
                with pytest.raises(Timeout):
                    with lock2:
                        pass
    
    def test_file_lock_normal_operation(self):
        """Test that file lock works normally within timeout."""
        with tempfile.NamedTemporaryFile() as f:
            lock = FileLock(f.name + ".lock", timeout=5)
            
            # Should acquire and release without timeout
            with lock:
                assert lock.is_locked
            
            assert not lock.is_locked


class TestIssue3RateLimiting:
    """Test Issue #3: Rate limiting implementation."""
    
    def test_rate_limiter_initialization(self):
        """Test rate limiter initializes correctly."""
        limiter = RateLimiter(calls_per_minute=60, burst_size=120)
        assert limiter.calls_per_minute == 60
        assert limiter.burst_size == 120
        assert limiter.tokens == 120.0
    
    def test_rate_limiter_burst_behavior(self):
        """Test that burst traffic is allowed."""
        limiter = RateLimiter(calls_per_minute=120, burst_size=10)
        
        # Should allow 10 rapid calls without waiting
        start = time.time()
        for _ in range(10):
            wait_time = limiter.acquire()
            assert wait_time == 0.0
        elapsed = time.time() - start
        
        # Should complete in < 1 second
        assert elapsed < 1.0
    
    def test_rate_limiter_enforces_limit(self):
        """Test that rate limiting is enforced after burst."""
        limiter = RateLimiter(calls_per_minute=120, burst_size=5)
        
        # Exhaust burst
        for _ in range(5):
            limiter.acquire()
        
        # Next call should wait
        start = time.time()
        wait_time = limiter.acquire()
        elapsed = time.time() - start
        
        assert wait_time > 0
        assert elapsed >= wait_time * 0.9  # Allow 10% tolerance
    
    def test_rate_limiter_statistics(self):
        """Test that statistics are tracked correctly."""
        limiter = RateLimiter(calls_per_minute=60, burst_size=10)
        
        # Make some calls
        for _ in range(5):
            limiter.acquire()
        
        stats = limiter.get_stats()
        assert stats["total_calls"] == 5
        assert stats["current_tokens"] <= 10
    
    def test_get_rate_limiter_valid_provider(self):
        """Test getting rate limiter for valid providers."""
        voyage_limiter = get_rate_limiter("voyage")
        assert voyage_limiter is not None
        
        openai_limiter = get_rate_limiter("openai")
        assert openai_limiter is not None
        
        tavily_limiter = get_rate_limiter("tavily")
        assert tavily_limiter is not None
    
    def test_get_rate_limiter_invalid_provider(self):
        """Test that invalid provider raises error."""
        with pytest.raises(ValueError, match="Unknown provider"):
            get_rate_limiter("invalid_provider")
    
    def test_rate_limiter_reset_stats(self):
        """Test that statistics can be reset."""
        limiter = RateLimiter(calls_per_minute=60)
        
        limiter.acquire()
        limiter.acquire()
        
        assert limiter.get_stats()["total_calls"] == 2
        
        limiter.reset_stats()
        assert limiter.get_stats()["total_calls"] == 0


class TestIssue7DimensionMismatchLogging:
    """Test Issue #7: Dimension mismatch logging."""
    
    def test_dimension_mismatch_logs_warning(self, caplog):
        """Test that dimension mismatch logs a warning."""
        merger = EmbeddingMerger()
        
        vec1 = [1.0, 0.0]
        vec2 = [1.0, 0.0, 0.0]
        
        with caplog.at_level(logging.WARNING):
            result = merger.cosine_similarity(vec1, vec2)
        
        assert result == 0.0
        assert "Dimension mismatch" in caplog.text
        assert "vec1=2 dims" in caplog.text
        assert "vec2=3 dims" in caplog.text
    
    def test_matching_dimensions_no_warning(self, caplog):
        """Test that matching dimensions don't log warning."""
        merger = EmbeddingMerger()
        
        vec1 = [1.0, 0.0, 0.0]
        vec2 = [1.0, 0.0, 0.0]
        
        with caplog.at_level(logging.WARNING):
            result = merger.cosine_similarity(vec1, vec2)
        
        assert result == 1.0
        assert "Dimension mismatch" not in caplog.text


class TestIssue8EpsilonComparison:
    """Test Issue #8: Epsilon comparison for floats."""
    
    def test_zero_weight_handling(self):
        """Test that zero weights are handled with epsilon."""
        merger = EmbeddingMerger()
        
        emb1 = [1.0, 0.0, 0.0]
        emb2 = [0.0, 1.0, 0.0]
        
        # Zero weights should fall back to equal weights
        result = merger.average_embeddings([emb1, emb2], weights=[0.0, 0.0])
        
        # Should use equal weights (0.5, 0.5)
        assert result == [0.5, 0.5, 0.0]
    
    def test_near_zero_weight_handling(self):
        """Test that near-zero weights are handled correctly."""
        merger = EmbeddingMerger()
        
        emb1 = [1.0, 0.0, 0.0]
        emb2 = [0.0, 1.0, 0.0]
        
        # Very small weights (below epsilon)
        result = merger.average_embeddings([emb1, emb2], weights=[1e-11, 1e-11])
        
        # Should fall back to equal weights
        assert result == [0.5, 0.5, 0.0]
    
    def test_normal_weights_not_affected(self):
        """Test that normal weights still work correctly."""
        merger = EmbeddingMerger()
        
        emb1 = [1.0, 0.0, 0.0]
        emb2 = [0.0, 1.0, 0.0]
        
        result = merger.average_embeddings([emb1, emb2], weights=[0.75, 0.25])
        
        assert result == [0.75, 0.25, 0.0]


class TestIssue12TypeValidation:
    """Test Issue #12: Type validation."""
    
    def test_embeddings_must_be_list(self):
        """Test that embeddings must be a list."""
        merger = EmbeddingMerger()
        
        with pytest.raises(TypeError, match="embeddings must be a list"):
            merger.average_embeddings("not a list")
    
    def test_embeddings_elements_must_be_lists(self):
        """Test that embedding elements must be lists."""
        merger = EmbeddingMerger()
        
        with pytest.raises(TypeError, match="All embeddings must be lists"):
            merger.average_embeddings([1.0, 2.0, 3.0])  # Not a list of lists
    
    def test_weights_must_be_list(self):
        """Test that weights must be a list."""
        merger = EmbeddingMerger()
        
        emb = [[1.0, 0.0]]
        
        with pytest.raises(TypeError, match="weights must be a list"):
            merger.average_embeddings(emb, weights="not a list")
    
    def test_length_mismatch_clear_error(self):
        """Test that length mismatch gives clear error."""
        merger = EmbeddingMerger()
        
        emb1 = [1.0, 0.0]
        emb2 = [0.0, 1.0]
        
        with pytest.raises(ValueError, match="Number of embeddings.*must match"):
            merger.average_embeddings([emb1, emb2], weights=[1.0])
    
    def test_valid_inputs_work(self):
        """Test that valid inputs work correctly."""
        merger = EmbeddingMerger()
        
        emb1 = [1.0, 0.0]
        emb2 = [0.0, 1.0]
        
        # Should not raise any errors
        result = merger.average_embeddings([emb1, emb2], weights=[0.5, 0.5])
        assert result == [0.5, 0.5]


class TestEdgeCases:
    """Test edge cases for all fixes."""
    
    def test_empty_embeddings_list(self):
        """Test handling of empty embeddings list."""
        merger = EmbeddingMerger()
        result = merger.average_embeddings([])
        assert result == []
    
    def test_single_embedding(self):
        """Test averaging single embedding."""
        merger = EmbeddingMerger()
        emb = [1.0, 2.0, 3.0]
        result = merger.average_embeddings([emb])
        assert result == emb
    
    def test_zero_vectors(self):
        """Test cosine similarity with zero vectors."""
        merger = EmbeddingMerger()
        vec1 = [0.0, 0.0, 0.0]
        vec2 = [1.0, 0.0, 0.0]
        result = merger.cosine_similarity(vec1, vec2)
        assert result == 0.0
    
    def test_orthogonal_vectors(self):
        """Test cosine similarity with orthogonal vectors."""
        merger = EmbeddingMerger()
        vec1 = [1.0, 0.0, 0.0]
        vec2 = [0.0, 1.0, 0.0]
        result = merger.cosine_similarity(vec1, vec2)
        assert abs(result) < 0.001  # Should be ~0
    
    def test_identical_vectors(self):
        """Test cosine similarity with identical vectors."""
        merger = EmbeddingMerger()
        vec = [1.0, 2.0, 3.0]
        result = merger.cosine_similarity(vec, vec)
        assert abs(result - 1.0) < 0.001  # Should be ~1


class TestIntegration:
    """Integration tests for all fixes working together."""
    
    def test_embedding_merger_with_type_validation(self):
        """Test that type validation works in merge flow."""
        merger = EmbeddingMerger()
        
        existing = [{"embedding": [1.0, 0.0], "merged_count": 1}]
        new = {"embedding": [0.9, 0.1]}
        
        # Should work without errors
        result, was_merged = merger.merge_similar_embeddings(existing, new)
        assert len(result) >= 1
    
    def test_skill_merger_with_all_fixes(self):
        """Test skill merger with all fixes applied."""
        merger = SkillMerger(similarity_threshold=0.90)
        
        existing = [{
            "skill_name": "test",
            "embedding": [1.0, 0.0],
            "merged_count": 1
        }]
        
        new = [{
            "skill_name": "test2",
            "embedding": [0.95, 0.05]
        }]
        
        result = merger.merge_skills(existing, new)
        assert "merged_skills" in result
        assert "added_count" in result
        assert "merged_count" in result


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

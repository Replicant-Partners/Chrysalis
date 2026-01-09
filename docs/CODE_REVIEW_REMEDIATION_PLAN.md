# Code Review Remediation Plan

**Date**: January 9, 2026  
**Based On**: CODE_REVIEW_CHRYSALIS_2026-01-09.md  
**Status**: Implementation In Progress  

---

## EXECUTIVE SUMMARY

This document provides a comprehensive remediation plan for all findings from the Chrysalis code review. While no critical issues were found, we have identified 12 minor recommendations and 6 refactoring opportunities that will improve system robustness, maintainability, and scalability.

**Risk Assessment**: LOW (No critical or high-severity issues)  
**Estimated Effort**: 16-20 hours  
**Recommended Timeline**: 2 sprints (2 weeks)  

---

## SECTION 1: DEFICIENCY ANALYSIS & CATEGORIZATION

### 1.1 Security Vulnerabilities (Priority: HIGH)

#### Issue #1: Missing File Lock Timeouts
- **Severity**: MEDIUM
- **Location**: `scripts/process_legends.py:658, 730, 780`
- **Impact**: Process could hang indefinitely if lock is held by crashed process
- **Risk**: System availability - could cause processing pipeline to stall
- **Technical Debt**: LOW (easy fix, high value)
- **Affected Components**: All file consolidation operations
- **User Impact**: Processing failures, manual intervention required

**Justification**: While not a security vulnerability in the traditional sense, this affects system reliability and could be exploited in a denial-of-service scenario.

#### Issue #2: Path Traversal Protection Missing
- **Severity**: LOW
- **Location**: `scripts/process_legends.py:145`
- **Impact**: Defense-in-depth measure; paths are from glob but additional validation improves security posture
- **Risk**: Data integrity - potential for unauthorized file access
- **Technical Debt**: LOW (easy fix, good practice)
- **Affected Components**: Legend file loading
- **User Impact**: None (preventive measure)

**Justification**: Low severity because paths are already constrained by glob, but defense-in-depth is a security best practice.

### 1.2 Performance Bottlenecks (Priority: MEDIUM)

#### Issue #3: No Explicit Rate Limiting
- **Severity**: MEDIUM
- **Location**: `scripts/process_legends.py` (API calls throughout)
- **Impact**: Could hit API rate limits, causing failures
- **Risk**: System reliability - processing failures at scale
- **Technical Debt**: MEDIUM (moderate implementation, high value at scale)
- **Affected Components**: All external API calls (Voyage AI, OpenAI, Tavily)
- **User Impact**: Processing failures, increased costs from retries

**Justification**: Current sequential processing provides implicit rate limiting, but explicit control is needed for production scale.

#### Issue #4: Linear Search for Similarity Matching
- **Severity**: LOW (at current scale)
- **Location**: `scripts/semantic_embedding_merger.py:110-125`
- **Impact**: O(n*m) complexity for merging; acceptable for <100 items
- **Risk**: Performance degradation at scale (>1000 legends)
- **Technical Debt**: MEDIUM (future scalability concern)
- **Affected Components**: Semantic merging operations
- **User Impact**: Slow processing times at scale

**Justification**: Not a current bottleneck but will become one at scale. Document for future optimization.

### 1.3 Architectural Flaws (Priority: LOW)

#### Issue #5: Long Methods (>50 lines)
- **Severity**: LOW
- **Location**: `scripts/process_legends.py:400-480, 580-720`
- **Impact**: Reduced maintainability, harder to test
- **Risk**: Maintainability - increased bug introduction risk
- **Technical Debt**: MEDIUM (refactoring effort vs. benefit)
- **Affected Components**: Legend processing pipeline
- **User Impact**: None (internal code quality)

**Justification**: Code works correctly but violates single responsibility principle. Refactoring improves long-term maintainability.

#### Issue #6: Duplicate Merge Logic
- **Severity**: LOW
- **Location**: `scripts/process_legends.py:680-720` (KB and SB merging)
- **Impact**: Code duplication, maintenance burden
- **Risk**: Maintainability - bug fixes must be applied twice
- **Technical Debt**: LOW (easy to extract common function)
- **Affected Components**: Embedding consolidation
- **User Impact**: None (internal code quality)

### 1.4 Maintainability Concerns (Priority: LOW)

#### Issue #7: Silent Dimension Mismatch
- **Severity**: LOW
- **Location**: `scripts/semantic_embedding_merger.py:42`
- **Impact**: Debugging difficulty when vectors don't match
- **Risk**: Operational - harder to diagnose issues
- **Technical Debt**: LOW (add logging)
- **Affected Components**: Cosine similarity calculation
- **User Impact**: Delayed issue resolution

#### Issue #8: Floating-Point Comparison
- **Severity**: LOW
- **Location**: `scripts/semantic_embedding_merger.py:72`
- **Impact**: Potential edge case with exact zero
- **Risk**: Correctness - rare edge case
- **Technical Debt**: LOW (use epsilon)
- **Affected Components**: Weight normalization
- **User Impact**: None (extremely rare edge case)

#### Issue #9: Test Coverage Gaps
- **Severity**: MEDIUM
- **Location**: All test files
- **Impact**: Reduced confidence in changes, potential bugs
- **Risk**: Quality - undetected regressions
- **Technical Debt**: HIGH (comprehensive testing needed)
- **Affected Components**: All code
- **User Impact**: Potential bugs in production

**Justification**: 60% coverage is acceptable but 80%+ is industry standard for production systems.

#### Issue #10: Inconsistent Logging Format
- **Severity**: LOW
- **Location**: Throughout codebase
- **Impact**: Harder to parse logs, reduced observability
- **Risk**: Operational - slower incident response
- **Technical Debt**: MEDIUM (structured logging migration)
- **Affected Components**: All logging statements
- **User Impact**: Slower issue resolution

#### Issue #11: No Pytest Configuration
- **Severity**: LOW
- **Location**: Project root (missing `pytest.ini`)
- **Impact**: Inconsistent test execution, no coverage tracking
- **Risk**: Quality - testing gaps
- **Technical Debt**: LOW (easy to add)
- **Affected Components**: Test infrastructure
- **User Impact**: None (internal tooling)

#### Issue #12: Missing Type Validation
- **Severity**: LOW
- **Location**: `scripts/semantic_embedding_merger.py:65-75`
- **Impact**: Runtime errors if wrong types passed
- **Risk**: Correctness - potential crashes
- **Technical Debt**: LOW (add validation)
- **Affected Components**: Embedding averaging
- **User Impact**: Potential processing failures

---

## SECTION 2: RISK MATRIX & PRIORITIZATION

### 2.1 Risk Assessment Matrix

| Issue | Severity | Impact | Likelihood | Risk Score | Priority |
|-------|----------|--------|------------|------------|----------|
| #1 File Lock Timeouts | MEDIUM | HIGH | MEDIUM | 6 | P0 (Critical Path) |
| #2 Path Traversal | LOW | LOW | LOW | 1 | P2 (Defense in Depth) |
| #3 Rate Limiting | MEDIUM | HIGH | MEDIUM | 6 | P0 (Critical Path) |
| #9 Test Coverage | MEDIUM | HIGH | HIGH | 9 | P0 (Quality Gate) |
| #7 Silent Errors | LOW | MEDIUM | MEDIUM | 3 | P1 (Quick Win) |
| #8 Float Comparison | LOW | LOW | LOW | 1 | P1 (Quick Win) |
| #11 Pytest Config | LOW | MEDIUM | HIGH | 3 | P1 (Quick Win) |
| #12 Type Validation | LOW | MEDIUM | LOW | 2 | P1 (Quick Win) |
| #10 Structured Logging | LOW | MEDIUM | MEDIUM | 3 | P2 (Future) |
| #5 Long Methods | LOW | LOW | LOW | 1 | P3 (Refactoring) |
| #6 Duplicate Logic | LOW | LOW | LOW | 1 | P3 (Refactoring) |
| #4 Linear Search | LOW | LOW | LOW | 1 | P4 (Future Scale) |

**Risk Score Calculation**: Severity (1-3) × Impact (1-3) × Likelihood (1-3)

### 2.2 Priority Definitions

- **P0 (Critical Path)**: Must fix before production deployment
- **P1 (Quick Wins)**: Low effort, high value - fix in current sprint
- **P2 (Defense in Depth)**: Important but not blocking - next sprint
- **P3 (Refactoring)**: Technical debt - address when touching code
- **P4 (Future Scale)**: Document for future optimization

### 2.3 Dependency Analysis

```
Phase 1 (P0 - Critical Path)
├── Issue #1: File Lock Timeouts (no dependencies)
├── Issue #3: Rate Limiting (no dependencies)
└── Issue #9: Test Coverage
    ├── Depends on: #11 (Pytest Config)
    └── Enables: All other testing

Phase 2 (P1 - Quick Wins)
├── Issue #11: Pytest Config (enables #9)
├── Issue #7: Silent Errors (no dependencies)
├── Issue #8: Float Comparison (no dependencies)
└── Issue #12: Type Validation (no dependencies)

Phase 3 (P2 - Defense in Depth)
├── Issue #2: Path Traversal (no dependencies)
└── Issue #10: Structured Logging (no dependencies)

Phase 4 (P3 - Refactoring)
├── Issue #5: Long Methods (no dependencies)
└── Issue #6: Duplicate Logic (no dependencies)

Phase 5 (P4 - Future)
└── Issue #4: Linear Search (requires architecture change)
```

---

## SECTION 3: PHASED REMEDIATION ROADMAP

### Phase 1: Critical Path Fixes (Week 1, Days 1-3)

**Objective**: Address all P0 issues to ensure production readiness

**Estimated Effort**: 12 hours

#### Task 1.1: Add File Lock Timeouts (2 hours)
- **Files**: `scripts/process_legends.py`
- **Lines**: 658, 730, 780
- **Implementation**: Add `timeout=300` parameter to all FileLock instances
- **Testing**: Verify timeout behavior with mock locked files
- **Acceptance Criteria**: 
  - All FileLock calls have explicit timeouts
  - Timeout exceptions are caught and logged
  - Process fails gracefully on timeout

#### Task 1.2: Implement Rate Limiting (4 hours)
- **Files**: `scripts/process_legends.py`, new `scripts/rate_limiter.py`
- **Implementation**: Create RateLimiter class with token bucket algorithm
- **Testing**: Unit tests for rate limiter, integration tests for API calls
- **Acceptance Criteria**:
  - Rate limiter respects configured limits (60 calls/minute default)
  - Backoff strategy implemented for rate limit errors
  - Metrics logged for rate limit hits

#### Task 1.3: Setup Pytest Infrastructure (2 hours)
- **Files**: `pytest.ini`, `.coveragerc`
- **Implementation**: Configure pytest with coverage tracking
- **Testing**: Run existing tests with new configuration
- **Acceptance Criteria**:
  - Pytest runs all tests successfully
  - Coverage report generated
  - CI/CD integration ready

#### Task 1.4: Expand Test Coverage (4 hours)
- **Files**: `tests/test_semantic_merge.py`, `tests/test_process_legends.py`
- **Implementation**: Add tests for edge cases, error paths
- **Testing**: Achieve >80% coverage on critical paths
- **Acceptance Criteria**:
  - Coverage >80% on `semantic_embedding_merger.py`
  - Coverage >70% on `process_legends.py`
  - All edge cases tested

### Phase 2: Quick Wins (Week 1, Days 4-5)

**Objective**: Address low-effort, high-value improvements

**Estimated Effort**: 4 hours

#### Task 2.1: Add Dimension Mismatch Logging (30 min)
- **Files**: `scripts/semantic_embedding_merger.py:42`
- **Implementation**: Add logger.warning for dimension mismatches
- **Testing**: Unit test with mismatched vectors
- **Acceptance Criteria**: Warning logged with vector dimensions

#### Task 2.2: Use Epsilon for Float Comparison (30 min)
- **Files**: `scripts/semantic_embedding_merger.py:72`
- **Implementation**: Replace `== 0` with `< 1e-10`
- **Testing**: Unit test with edge case values
- **Acceptance Criteria**: Handles floating-point edge cases correctly

#### Task 2.3: Add Type Validation (1 hour)
- **Files**: `scripts/semantic_embedding_merger.py:65-75`
- **Implementation**: Add isinstance checks and raise TypeError
- **Testing**: Unit tests with invalid types
- **Acceptance Criteria**: Clear error messages for type mismatches

### Phase 3: Defense in Depth (Week 2, Days 1-2)

**Objective**: Strengthen security posture and observability

**Estimated Effort**: 6 hours

#### Task 3.1: Add Path Traversal Validation (1 hour)
- **Files**: `scripts/process_legends.py:145`
- **Implementation**: Add `is_relative_to()` check
- **Testing**: Unit tests with malicious paths
- **Acceptance Criteria**: Rejects paths outside LEGENDS_DIR

#### Task 3.2: Implement Structured Logging (5 hours)
- **Files**: All Python files with logging
- **Implementation**: Migrate to structlog with JSON output
- **Testing**: Verify log format and parsing
- **Acceptance Criteria**:
  - All logs in structured JSON format
  - Log aggregation tools can parse logs
  - Performance impact <5%

### Phase 4: Refactoring (Week 2, Days 3-5)

**Objective**: Improve code maintainability

**Estimated Effort**: 8 hours

#### Task 4.1: Extract Long Methods (4 hours)
- **Files**: `scripts/process_legends.py`
- **Implementation**: Extract helper methods from long functions
- **Testing**: Ensure all tests still pass
- **Acceptance Criteria**:
  - No methods >50 lines
  - Each method has single responsibility
  - Test coverage maintained

#### Task 4.2: Eliminate Duplicate Merge Logic (2 hours)
- **Files**: `scripts/process_legends.py:680-720`
- **Implementation**: Extract common `merge_embedding_list()` function
- **Testing**: Ensure KB and SB merging still works
- **Acceptance Criteria**:
  - Single merge function used by both KB and SB
  - No code duplication
  - Test coverage maintained

#### Task 4.3: Document Future Optimizations (2 hours)
- **Files**: `docs/FUTURE_OPTIMIZATIONS.md`
- **Implementation**: Document FAISS indexing approach for scale
- **Testing**: N/A (documentation only)
- **Acceptance Criteria**:
  - Clear migration path documented
  - Performance benchmarks defined
  - Trigger points identified (>1000 legends)

---

## SECTION 4: IMPLEMENTATION DETAILS

### 4.1 Issue #1: File Lock Timeouts

**Current Code** (`scripts/process_legends.py:658`):
```python
lock = FileLock(str(ALL_EMBEDDINGS) + ".lock")
```

**Fixed Code**:
```python
lock = FileLock(str(ALL_EMBEDDINGS) + ".lock", timeout=300)  # 5 minutes
```

**Rationale**: 5-minute timeout balances between allowing long operations and detecting deadlocks. Most operations complete in <30 seconds.

**Trade-offs**: 
- Longer timeout = more patient but slower failure detection
- Shorter timeout = faster failure but may interrupt legitimate operations
- 5 minutes chosen based on observed processing times (max 2 minutes per legend)

**Testing Strategy**:
```python
def test_file_lock_timeout():
    """Test that file lock times out appropriately."""
    from filelock import FileLock, Timeout
    import tempfile
    
    with tempfile.NamedTemporaryFile() as f:
        lock1 = FileLock(f.name + ".lock", timeout=1)
        lock2 = FileLock(f.name + ".lock", timeout=1)
        
        with lock1:
            with pytest.raises(Timeout):
                with lock2:
                    pass  # Should timeout
```

### 4.2 Issue #3: Rate Limiting

**New File**: `scripts/rate_limiter.py`

```python
#!/usr/bin/env python3
"""
Rate Limiter for API Calls

Implements token bucket algorithm to prevent hitting API rate limits.
"""

import time
from datetime import datetime, timedelta
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    Token bucket rate limiter.
    
    Allows burst traffic up to bucket size, then enforces steady rate.
    """
    
    def __init__(
        self,
        calls_per_minute: int = 60,
        burst_size: Optional[int] = None
    ):
        """
        Initialize rate limiter.
        
        Args:
            calls_per_minute: Maximum sustained rate
            burst_size: Maximum burst (default: 2x sustained rate)
        """
        self.calls_per_minute = calls_per_minute
        self.burst_size = burst_size or (calls_per_minute * 2)
        self.tokens = self.burst_size
        self.last_update = datetime.now()
        self.total_calls = 0
        self.total_waits = 0
        self.total_wait_time = 0.0
    
    def acquire(self, tokens: int = 1) -> float:
        """
        Acquire tokens, waiting if necessary.
        
        Args:
            tokens: Number of tokens to acquire
        
        Returns:
            Time waited in seconds
        """
        self._refill_tokens()
        
        if self.tokens >= tokens:
            self.tokens -= tokens
            self.total_calls += 1
            return 0.0
        
        # Need to wait
        tokens_needed = tokens - self.tokens
        wait_time = (tokens_needed / self.calls_per_minute) * 60.0
        
        logger.info(
            f"Rate limit: waiting {wait_time:.2f}s "
            f"(tokens needed: {tokens_needed}, available: {self.tokens})"
        )
        
        time.sleep(wait_time)
        self._refill_tokens()
        self.tokens -= tokens
        
        self.total_calls += 1
        self.total_waits += 1
        self.total_wait_time += wait_time
        
        return wait_time
    
    def _refill_tokens(self):
        """Refill tokens based on elapsed time."""
        now = datetime.now()
        elapsed = (now - self.last_update).total_seconds()
        
        # Add tokens based on elapsed time
        new_tokens = (elapsed / 60.0) * self.calls_per_minute
        self.tokens = min(self.burst_size, self.tokens + new_tokens)
        self.last_update = now
    
    def get_stats(self) -> dict:
        """Get rate limiter statistics."""
        return {
            "total_calls": self.total_calls,
            "total_waits": self.total_waits,
            "total_wait_time": self.total_wait_time,
            "average_wait": (
                self.total_wait_time / self.total_waits
                if self.total_waits > 0
                else 0.0
            ),
            "current_tokens": self.tokens,
        }
```

**Integration** (`scripts/process_legends.py`):
```python
from rate_limiter import RateLimiter

# Initialize rate limiters (at module level)
VOYAGE_RATE_LIMITER = RateLimiter(calls_per_minute=60)
OPENAI_RATE_LIMITER = RateLimiter(calls_per_minute=60)
TAVILY_RATE_LIMITER = RateLimiter(calls_per_minute=60)

def process_legend_with_knowledge_builder(...):
    # Before API call
    VOYAGE_RATE_LIMITER.acquire()  # or OPENAI_RATE_LIMITER
    
    # Make API call
    embedding = embedder.embed(context)
    
    # ... rest of function
```

**Rationale**: Token bucket allows burst traffic while enforcing long-term rate limits. More flexible than simple time-based limiting.

**Trade-offs**:
- Token bucket vs. leaky bucket: Token bucket allows bursts, better for batch processing
- Per-provider vs. global: Per-provider allows full utilization of each API
- 60 calls/minute default: Conservative, can be increased based on API tier

### 4.3 Issue #9: Test Coverage

**New File**: `pytest.ini`

```ini
[pytest]
testpaths = tests scripts
python_files = test_*.py
python_classes = Test*
python_functions = test_*

addopts = 
    --verbose
    --strict-markers
    --cov=scripts
    --cov=projects/KnowledgeBuilder/src
    --cov-report=html:htmlcov
    --cov-report=term-missing:skip-covered
    --cov-report=xml
    --cov-fail-under=80
    -ra

markers =
    slow: marks tests as slow (deselect with '-m "not slow"')
    integration: marks tests as integration tests
    unit: marks tests as unit tests

[coverage:run]
source = scripts,projects/KnowledgeBuilder/src
omit = 
    */tests/*
    */test_*.py
    */__pycache__/*
    */venv/*

[coverage:report]
precision = 2
show_missing = True
skip_covered = False

[coverage:html]
directory = htmlcov
```

**New File**: `.coveragerc`

```ini
[run]
branch = True
source = scripts,projects/KnowledgeBuilder/src

[report]
exclude_lines =
    pragma: no cover
    def __repr__
    raise AssertionError
    raise NotImplementedError
    if __name__ == .__main__.:
    if TYPE_CHECKING:
    @abstractmethod
```

**Expanded Tests** (`tests/test_semantic_merge_comprehensive.py`):

```python
#!/usr/bin/env python3
"""
Comprehensive tests for semantic merging functionality.

Achieves >80% coverage on semantic_embedding_merger.py
"""

import pytest
import math
from scripts.semantic_embedding_merger import EmbeddingMerger, SkillMerger


class TestEmbeddingMergerEdgeCases:
    """Test edge cases for EmbeddingMerger."""
    
    def test_cosine_similarity_empty_vectors(self):
        """Test cosine similarity with empty vectors."""
        merger = EmbeddingMerger()
        assert merger.cosine_similarity([], []) == 0.0
    
    def test_cosine_similarity_mismatched_dimensions(self):
        """Test cosine similarity with mismatched dimensions."""
        merger = EmbeddingMerger()
        vec1 = [1.0, 0.0]
        vec2 = [1.0, 0.0, 0.0]
        assert merger.cosine_similarity(vec1, vec2) == 0.0
    
    def test_cosine_similarity_zero_vectors(self):
        """Test cosine similarity with zero vectors."""
        merger = EmbeddingMerger()
        vec1 = [0.0, 0.0, 0.0]
        vec2 = [1.0, 0.0, 0.0]
        assert merger.cosine_similarity(vec1, vec2) == 0.0
    
    def test_cosine_similarity_identical(self):
        """Test cosine similarity with identical vectors."""
        merger = EmbeddingMerger()
        vec = [1.0, 2.0, 3.0]
        sim = merger.cosine_similarity(vec, vec)
        assert abs(sim - 1.0) < 0.001
    
    def test_cosine_similarity_orthogonal(self):
        """Test cosine similarity with orthogonal vectors."""
        merger = EmbeddingMerger()
        vec1 = [1.0, 0.0, 0.0]
        vec2 = [0.0, 1.0, 0.0]
        sim = merger.cosine_similarity(vec1, vec2)
        assert abs(sim) < 0.001
    
    def test_average_embeddings_empty(self):
        """Test averaging with empty list."""
        merger = EmbeddingMerger()
        assert merger.average_embeddings([]) == []
    
    def test_average_embeddings_single(self):
        """Test averaging with single embedding."""
        merger = EmbeddingMerger()
        emb = [1.0, 2.0, 3.0]
        result = merger.average_embeddings([emb])
        assert result == emb
    
    def test_average_embeddings_equal_weights(self):
        """Test averaging with equal weights."""
        merger = EmbeddingMerger()
        emb1 = [1.0, 0.0, 0.0]
        emb2 = [0.0, 1.0, 0.0]
        result = merger.average_embeddings([emb1, emb2])
        assert result == [0.5, 0.5, 0.0]
    
    def test_average_embeddings_custom_weights(self):
        """Test averaging with custom weights."""
        merger = EmbeddingMerger()
        emb1 = [1.0, 0.0, 0.0]
        emb2 = [0.0, 1.0, 0.0]
        result = merger.average_embeddings([emb1, emb2], weights=[0.75, 0.25])
        assert result == [0.75, 0.25, 0.0]
    
    def test_average_embeddings_zero_weights(self):
        """Test averaging with zero total weight."""
        merger = EmbeddingMerger()
        emb1 = [1.0, 0.0, 0.0]
        emb2 = [0.0, 1.0, 0.0]
        result = merger.average_embeddings([emb1, emb2], weights=[0.0, 0.0])
        # Should fall back to equal weights
        assert result == [0.5, 0.5, 0.0]
    
    def test_average_embeddings_mismatched_weights(self):
        """Test averaging with mismatched weight count."""
        merger = EmbeddingMerger()
        emb1 = [1.0, 0.0, 0.0]
        emb2 = [0.0, 1.0, 0.0]
        with pytest.raises(ValueError):
            merger.average_embeddings([emb1, emb2], weights=[1.0])
    
    def test_merge_similar_embeddings_no_embedding(self):
        """Test merging when new entry has no embedding."""
        merger = EmbeddingMerger()
        existing = [{"embedding": [1.0, 0.0, 0.0], "merged_count": 1}]
        new = {"embedding": []}
        result, was_merged = merger.merge_similar_embeddings(existing, new)
        assert not was_merged
        assert len(result) == 1
    
    def test_merge_similar_embeddings_below_threshold(self):
        """Test merging when similarity below threshold."""
        merger = EmbeddingMerger(similarity_threshold=0.95)
        existing = [{"embedding": [1.0, 0.0, 0.0], "merged_count": 1}]
        new = {"embedding": [0.0, 1.0, 0.0], "processed_at": "2024-01-01"}
        result, was_merged = merger.merge_similar_embeddings(existing, new)
        assert not was_merged
        assert len(result) == 2
    
    def test_merge_similar_embeddings_above_threshold(self):
        """Test merging when similarity above threshold."""
        merger = EmbeddingMerger(similarity_threshold=0.85)
        existing = [{"embedding": [1.0, 0.0, 0.0], "merged_count": 1}]
        new = {"embedding": [0.95, 0.05, 0.0], "processed_at": "2024-01-01"}
        result, was_merged = merger.merge_similar_embeddings(existing, new)
        assert was_merged
        assert len(result) == 1
        assert result[0]["merged_count"] == 2
    
    def test_merge_similar_embeddings_preserves_metadata(self):
        """Test that merging preserves and combines metadata."""
        merger = EmbeddingMerger(similarity_threshold=0.85)
        existing = [{
            "embedding": [1.0, 0.0, 0.0],
            "merged_count": 1,
            "descriptors": ["old"]
        }]
        new = {
            "embedding": [0.95, 0.05, 0.0],
            "processed_at": "2024-01-01",
            "descriptors": ["new"]
        }
        result, was_merged = merger.merge_similar_embeddings(existing, new)
        assert was_merged
        assert set(result[0]["descriptors"]) == {"old", "new"}


class TestSkillMergerEdgeCases:
    """Test edge cases for SkillMerger."""
    
    def test_merge_skills_empty_lists(self):
        """Test merging with empty lists."""
        merger = SkillMerger()
        result = merger.merge_skills([], [])
        assert result["merged_skills"] == []
        assert result["added_count"] == 0
        assert result["merged_count"] == 0
    
    def test_merge_skills_no_embeddings(self):
        """Test merging skills without embeddings."""
        merger = SkillMerger()
        existing = [{"skill_name": "test", "embedding": []}]
        new = [{"skill_name": "test2", "embedding": []}]
        result = merger.merge_skills(existing, new)
        assert result["skipped_count"] == 1
    
    def test_merge_skills_similar(self):
        """Test merging similar skills."""
        merger = SkillMerger(similarity_threshold=0.90)
        existing = [{
            "skill_name": "programming",
            "embedding": [1.0, 0.0, 0.0],
            "merged_count": 1
        }]
        new = [{
            "skill_name": "coding",
            "embedding": [0.95, 0.05, 0.0]
        }]
        result = merger.merge_skills(existing, new)
        assert result["merged_count"] == 1
        assert result["added_count"] == 0
        assert len(result["merged_skills"]) == 1
    
    def test_merge_skills_different(self):
        """Test merging different skills."""
        merger = SkillMerger(similarity_threshold=0.90)
        existing = [{
            "skill_name": "programming",
            "embedding": [1.0, 0.0, 0.0],
            "merged_count": 1
        }]
        new = [{
            "skill_name": "painting",
            "embedding": [0.0, 0.0, 1.0]
        }]
        result = merger.merge_skills(existing, new)
        assert result["merged_count"] == 0
        assert result["added_count"] == 1
        assert len(result["merged_skills"]) == 2
    
    def test_merge_skills_combines_salts(self):
        """

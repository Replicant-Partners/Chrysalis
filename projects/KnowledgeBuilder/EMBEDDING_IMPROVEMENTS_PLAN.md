# Embedding Service Improvements - Implementation Plan

## Overview

This plan addresses HIGH and MEDIUM priority improvements identified during code review:
- **HIGH**: Code duplication elimination, Telemetry integration
- **MEDIUM**: Enhanced logging, Provider abstraction, Dimension validation

### Important Note: Existing Embedding Service

There is an existing `memory_system/embedding/service.py` that provides embedding functionality. This implementation plan focuses on:
1. **KnowledgeBuilder** and **SkillBuilder** projects specifically
2. Their duplicated `EmbeddingService` implementations
3. Integration with their respective telemetry systems (TelemetryRecorder and TelemetryWriter)

**Coordination Required:**
The existing `memory_system/embedding/service.py` has a different design:
- Async/await interface (vs sync for KnowledgeBuilder/SkillBuilder)
- Different providers (Ollama, Sentence Transformers vs Voyage, OpenAI, Deterministic)
- Includes caching (vs no caching in current implementations)
- Different return types (EmbeddingResult vs List[float])

**Decision Required:**
1. **Option A (Recommended)**: Create `shared/embedding/` as planned for KnowledgeBuilder/SkillBuilder use case
   - Maintains synchronous API required by these projects
   - Focuses on Voyage/OpenAI providers they need
   - Can add memory_system integration later if needed

2. **Option B**: Enhance `memory_system/embedding/` to support both async and sync
   - More complex but single source of truth
   - Requires refactoring both systems

3. **Option C**: Create adapter layer
   - Keep both systems separate
   - Add adapters for interoperability

**For this implementation plan, we proceed with Option A**, but should coordinate with memory_system team to avoid future conflicts.

## Success Criteria

- ✅ Single source of truth for embedding service (no duplication)
- ✅ All embedding operations emit telemetry events
- ✅ Structured logging with context and error classification
- ✅ Provider abstraction using Strategy pattern
- ✅ Runtime dimension validation with alerts
- ✅ Zero breaking changes to existing code
- ✅ All existing tests pass + new tests added

---

## Phase 1: Foundation & Shared Library (Week 1)

### Goal
Create shared embedding library structure and migrate common code.

### Tasks

#### 1.1 Create Shared Library Structure
```
shared/
  embedding/
    __init__.py
    service.py           # Core EmbeddingService
    providers/
      __init__.py
      base.py           # EmbeddingProvider ABC
      voyage.py         # VoyageProvider implementation
      openai.py         # OpenAIProvider implementation
      deterministic.py  # DeterministicProvider implementation
    telemetry.py        # Telemetry integration helpers
    exceptions.py       # Custom exceptions
    __version__.py      # Version tracking
```

**Files to create:**
- `shared/embedding/__init__.py` - Public API exports
- `shared/embedding/exceptions.py` - Custom exceptions
- `shared/embedding/providers/base.py` - Abstract base class
- `shared/embedding/telemetry.py` - Telemetry adapter

**Acceptance Criteria:**
- Directory structure created
- All files have proper docstrings
- Type hints throughout
- Basic imports work

---

#### 1.2 Extract Provider Abstractions
**File**: `shared/embedding/providers/base.py`

Create abstract base class:
```python
from abc import ABC, abstractmethod
from typing import List, Optional

class EmbeddingProvider(ABC):
    """Abstract base for embedding providers."""

    @abstractmethod
    def embed(self, text: str) -> List[float]:
        """Generate embedding for text."""
        pass

    @abstractmethod
    def get_dimensions(self) -> int:
        """Get embedding dimensions."""
        pass

    @abstractmethod
    def get_provider_name(self) -> str:
        """Get provider identifier."""
        pass

    @abstractmethod
    def estimate_cost(self, text: str) -> float:
        """Estimate API cost (USD)."""
        pass

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Optional batch embedding (defaults to sequential)."""
        return [self.embed(text) for text in texts]
```

**File**: `shared/embedding/providers/voyage.py`

Extract Voyage implementation:
- Move Voyage SDK logic
- Move Voyage HTTP fallback
- Implement EmbeddingProvider interface

**File**: `shared/embedding/providers/openai.py`

Extract OpenAI implementation:
- Move OpenAI client logic
- Implement EmbeddingProvider interface

**File**: `shared/embedding/providers/deterministic.py`

Extract deterministic implementation:
- Move hash-based embedding logic
- Implement EmbeddingProvider interface

**Acceptance Criteria:**
- All providers implement EmbeddingProvider
- Unit tests for each provider pass
- Providers are independently testable
- No shared state between providers

---

#### 1.3 Create Telemetry Adapter
**File**: `shared/embedding/telemetry.py`

Create adapter that works with both telemetry systems:

```python
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import time

# Type aliases for telemetry systems
TelemetryWriter = Any  # SkillBuilder's TelemetryWriter
TelemetryRecorder = Any  # KnowledgeBuilder's TelemetryRecorder

class EmbeddingTelemetry:
    """Adapter for embedding service telemetry."""

    def __init__(
        self,
        telemetry_writer: Optional[TelemetryWriter] = None,
        telemetry_recorder: Optional[TelemetryRecorder] = None,
    ):
        self._writer = telemetry_writer
        self._recorder = telemetry_recorder

    def record_success(
        self,
        provider: str,
        dimensions: int,
        latency_ms: float,
        text_length: int,
        cost: float,
        model: str,
    ):
        """Record successful embedding generation."""
        # Emit to SkillBuilder JSONL format
        if self._writer:
            from skill_builder.pipeline.models import TelemetryEvent
            self._writer.emit(TelemetryEvent(
                event_type="embedding.success",
                data={
                    "provider": provider,
                    "model": model,
                    "dimensions": dimensions,
                    "latency_ms": latency_ms,
                    "text_length": text_length,
                    "cost": cost,
                }
            ))

        # Emit to KnowledgeBuilder SQLite format
        if self._recorder:
            from src.utils.telemetry import ToolCall
            self._recorder.record(ToolCall(
                tool="embedding.success",
                cost=cost,
                latency_ms=latency_ms,
                success=True,
                meta={
                    "provider": provider,
                    "model": model,
                    "dimensions": dimensions,
                    "text_length": text_length,
                }
            ))

    def record_error(
        self,
        provider: str,
        error_type: str,
        latency_ms: float,
        text_length: int,
        error_message: str,
    ):
        """Record embedding generation error."""
        # Similar implementation for errors...

    def record_dimension_mismatch(
        self,
        provider: str,
        expected_dimensions: int,
        actual_dimensions: int,
        model: str,
    ):
        """Record dimension mismatch warning."""
        # Implementation...
```

**Acceptance Criteria:**
- Works with both telemetry systems
- Handles missing telemetry gracefully
- Thread-safe
- Unit tests pass

---

#### 1.4 Extract Core EmbeddingService
**File**: `shared/embedding/service.py`

Refactor EmbeddingService to:
1. Use provider abstractions (Strategy pattern)
2. Integrate telemetry adapter
3. Add dimension validation
4. Add enhanced logging
5. Support both telemetry systems

Key methods:
- `__init__()` - Initialize with provider selection
- `embed()` - Main embedding method with telemetry
- `embed_batch()` - Batch embedding support
- `get_provider_info()` - Provider metadata
- `_create_provider()` - Factory method
- `_classify_error()` - Error classification

**Acceptance Criteria:**
- All existing functionality preserved
- New features (telemetry, validation) added
- Backward compatible API
- Comprehensive unit tests

---

#### 1.5 Create Custom Exceptions
**File**: `shared/embedding/exceptions.py`

```python
class EmbeddingError(Exception):
    """Base exception for embedding errors."""
    pass

class EmbeddingProviderError(EmbeddingError):
    """Provider-specific error."""
    pass

class EmbeddingDimensionMismatchError(EmbeddingError):
    """Dimension mismatch error."""
    pass

class EmbeddingRateLimitError(EmbeddingProviderError):
    """Rate limit error."""
    pass

class EmbeddingAuthenticationError(EmbeddingProviderError):
    """Authentication error."""
    pass
```

**Acceptance Criteria:**
- Exception hierarchy defined
- Proper error messages
- Can be imported and used

---

### Testing Phase 1

**Test Coverage Requirements:**
- Unit tests for each provider (voyage, openai, deterministic)
- Unit tests for EmbeddingService with all providers
- Integration tests with telemetry systems
- Dimension validation tests
- Error classification tests
- Backward compatibility tests

**Test Files:**
- `shared/embedding/tests/test_providers.py`
- `shared/embedding/tests/test_service.py`
- `shared/embedding/tests/test_telemetry.py`
- `shared/embedding/tests/test_exceptions.py`

**Acceptance Criteria:**
- 90%+ test coverage
- All tests pass
- No regressions

---

## Phase 2: Enhanced Logging & Error Classification (Week 1-2)

### Goal
Add structured logging with context and error classification.

### Tasks

#### 2.1 Add Structured Logging
**Update**: `shared/embedding/service.py`

Add logging with:
- Context (provider, model, dimensions, text_hash)
- Latency tracking
- Error classification
- Dimension validation warnings

```python
import logging
import hashlib
from typing import Dict, Any

logger = logging.getLogger(__name__)

class EmbeddingService:
    def embed(self, text: str) -> List[float]:
        """Generate embedding with enhanced logging."""
        log_context = self._build_log_context(text)
        logger.info("Generating embedding", extra=log_context)

        start_time = time.perf_counter()

        try:
            embedding = self._provider_impl.embed(text)
            elapsed_ms = (time.perf_counter() - start_time) * 1000

            # Dimension validation
            self._validate_dimensions(embedding, log_context)

            logger.info(
                f"Embedding generated successfully in {elapsed_ms:.2f}ms",
                extra={**log_context, "latency_ms": elapsed_ms}
            )

            # Telemetry
            if self._telemetry:
                cost = self._provider_impl.estimate_cost(text)
                self._telemetry.record_success(
                    provider=self._provider_impl.get_provider_name(),
                    dimensions=len(embedding),
                    latency_ms=elapsed_ms,
                    text_length=len(text),
                    cost=cost,
                    model=self.model,
                )

            return embedding

        except Exception as exc:
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            error_class = self._classify_error(exc)

            logger.error(
                f"Embedding generation failed: {error_class}",
                exc_info=True,
                extra={**log_context, "error_type": error_class, "latency_ms": elapsed_ms}
            )

            # Telemetry
            if self._telemetry:
                self._telemetry.record_error(
                    provider=self._provider_impl.get_provider_name(),
                    error_type=error_class,
                    latency_ms=elapsed_ms,
                    text_length=len(text),
                    error_message=str(exc),
                )

            raise

    def _build_log_context(self, text: str) -> Dict[str, Any]:
        """Build structured log context."""
        return {
            "provider": self._provider_impl.get_provider_name(),
            "model": self.model,
            "dimensions": self._provider_impl.get_dimensions(),
            "text_length": len(text),
            "text_hash": hashlib.sha256(text.encode()).hexdigest()[:8],
        }

    def _classify_error(self, exc: Exception) -> str:
        """Classify error for observability."""
        exc_str = str(exc).lower()
        if "timeout" in exc_str or "timed out" in exc_str:
            return "timeout"
        elif "rate limit" in exc_str or "429" in exc_str:
            return "rate_limit"
        elif "unauthorized" in exc_str or "401" in exc_str or "403" in exc_str:
            return "authentication"
        elif "quota" in exc_str or "insufficient" in exc_str:
            return "quota_exceeded"
        elif "network" in exc_str or "connection" in exc_str:
            return "network_error"
        else:
            return "unknown_error"

    def _validate_dimensions(self, embedding: List[float], log_context: Dict[str, Any]):
        """Validate embedding dimensions."""
        expected = self._provider_impl.get_dimensions()
        actual = len(embedding)

        if actual != expected:
            logger.warning(
                f"Dimension mismatch: expected {expected}, got {actual}",
                extra={**log_context, "expected_dimensions": expected, "actual_dimensions": actual}
            )

            if self._telemetry:
                self._telemetry.record_dimension_mismatch(
                    provider=self._provider_impl.get_provider_name(),
                    expected_dimensions=expected,
                    actual_dimensions=actual,
                    model=self.model,
                )

            # Optionally raise for strict mode
            if os.getenv("EMBEDDING_STRICT_DIMENSIONS", "false").lower() == "true":
                raise EmbeddingDimensionMismatchError(
                    f"Dimension mismatch: expected {expected}, got {actual}"
                )
```

**Acceptance Criteria:**
- All embedding operations log with context
- Errors are classified correctly
- Dimension mismatches are logged and telemetried
- Log format is consistent and parseable

---

#### 2.2 Add Error Classification Tests
**File**: `shared/embedding/tests/test_error_classification.py`

Test various error scenarios:
- Timeout errors
- Rate limit errors (429)
- Authentication errors (401, 403)
- Network errors
- Unknown errors

**Acceptance Criteria:**
- All error types classified correctly
- Classification is stable (same error = same classification)

---

## Phase 3: Integration & Migration (Week 2)

### Goal
Migrate KnowledgeBuilder and SkillBuilder to use shared library.

### Tasks

#### 3.1 Update KnowledgeBuilder
**Update**: `projects/KnowledgeBuilder/src/utils/embeddings.py`

Replace with:
```python
# Re-export from shared library for backward compatibility
from shared.embedding.service import EmbeddingService
from shared.embedding import EmbeddingTelemetry
from shared.embedding.exceptions import *

__all__ = ['EmbeddingService', 'EmbeddingTelemetry']
```

**Update**: `projects/KnowledgeBuilder/src/pipeline/simple_pipeline.py`

Add telemetry integration:
```python
from shared.embedding import EmbeddingService, EmbeddingTelemetry
from src.utils.telemetry import TelemetryRecorder

class SimplePipeline:
    def __init__(self, ...):
        # Existing code...

        # Initialize telemetry for embeddings
        telemetry = EmbeddingTelemetry(telemetry_recorder=self.cache._telemetry)
        self.embedder = EmbeddingService(telemetry=telemetry) or EmbeddingService()
```

**Acceptance Criteria:**
- All existing code continues to work
- Telemetry is emitted for embedding operations
- No breaking changes

---

#### 3.2 Update SkillBuilder
**Update**: `projects/SkillBuilder/skill_builder/pipeline/embeddings.py`

Similar approach:
```python
# Re-export from shared library
from shared.embedding.service import EmbeddingService
from shared.embedding import EmbeddingTelemetry
from shared.embedding.exceptions import *

__all__ = ['EmbeddingService', 'EmbeddingTelemetry']
```

**Update**: `projects/SkillBuilder/skill_builder/pipeline/runner.py`

Add telemetry integration:
```python
from shared.embedding import EmbeddingService, EmbeddingTelemetry

class PipelineRunner:
    def __init__(self, ...):
        # Existing code...

        # Initialize telemetry for embeddings
        telemetry = EmbeddingTelemetry(telemetry_writer=self._telemetry) if self._telemetry else None
        self.embedder = EmbeddingService(telemetry=telemetry) or EmbeddingService()
```

**Acceptance Criteria:**
- All existing code continues to work
- Telemetry is emitted for embedding operations
- No breaking changes

---

#### 3.3 Update Tests
Update both projects' tests to:
1. Use shared library imports
2. Test telemetry integration
3. Test new logging features
4. Test dimension validation

**Files to update:**
- `projects/KnowledgeBuilder/tests/test_embeddings.py`
- `projects/SkillBuilder/tests/test_embeddings.py` (if exists)
- Integration tests for both projects

**Acceptance Criteria:**
- All existing tests pass
- New tests for telemetry pass
- Integration tests verify telemetry emission

---

#### 3.4 Update Documentation
Update documentation to reflect:
1. Shared library usage
2. Telemetry integration
3. New logging features
4. Error classification
5. Dimension validation

**Files to update:**
- `projects/KnowledgeBuilder/README.md`
- `projects/SkillBuilder/README.md`
- `shared/embedding/README.md` (new)

**Acceptance Criteria:**
- Documentation is accurate
- Examples are provided
- Migration guide is included

---

## Phase 4: Validation & Cleanup (Week 2-3)

### Goal
Validate improvements and remove old code.

### Tasks

#### 4.1 Integration Testing
Run comprehensive integration tests:
- End-to-end KnowledgeBuilder pipeline with telemetry
- End-to-end SkillBuilder pipeline with telemetry
- Verify telemetry events are emitted
- Verify logs are structured correctly
- Verify dimension validation works
- Performance benchmarks (no regression)

**Test Scenarios:**
1. Successful embedding generation
2. Provider fallback scenarios
3. Error scenarios (timeout, rate limit, auth)
4. Dimension mismatch scenarios
5. Batch embedding (if implemented)
6. Telemetry emission verification

**Acceptance Criteria:**
- All integration tests pass
- Telemetry data is collected correctly
- No performance regressions (< 5% overhead)
- Logs are structured and parseable

---

#### 4.2 Remove Duplicate Code
After validation:
1. Remove old `EmbeddingService` from KnowledgeBuilder
2. Remove old `EmbeddingService` from SkillBuilder
3. Update imports to use shared library
4. Remove unused helper functions

**Files to remove:**
- Keep wrapper files for backward compatibility, but mark as deprecated

**Acceptance Criteria:**
- No duplicate code remains
- All imports work correctly
- Deprecation warnings are clear

---

#### 4.3 Performance Validation
Benchmark embedding operations:
- Compare before/after latency
- Measure telemetry overhead
- Verify no memory leaks
- Check thread safety

**Acceptance Criteria:**
- < 5% latency overhead
- < 10MB memory overhead
- Thread-safe operations
- No memory leaks

---

## Risk Mitigation

### Risk 1: Breaking Changes
**Mitigation:**
- Maintain backward compatible API
- Gradual migration with feature flags
- Comprehensive test coverage
- Rollback plan ready

### Risk 2: Telemetry Performance Impact
**Mitigation:**
- Make telemetry optional
- Use async/background emission where possible
- Benchmark overhead
- Provide disable flag

### Risk 3: Provider Abstraction Complexity
**Mitigation:**
- Keep abstractions simple
- Extensive documentation
- Clear examples
- Gradual refactoring

### Risk 4: Integration Issues
**Mitigation:**
- Thorough integration testing
- Staged rollout
- Monitor telemetry in production
- Quick rollback capability

---

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1 | Week 1 | Shared library structure, Provider abstractions, Telemetry adapter |
| Phase 2 | Week 1-2 | Enhanced logging, Error classification, Dimension validation |
| Phase 3 | Week 2 | KnowledgeBuilder migration, SkillBuilder migration, Test updates |
| Phase 4 | Week 2-3 | Integration testing, Cleanup, Documentation |

**Total Estimated Time: 2-3 weeks**

---

## Success Metrics

### Code Quality
- ✅ Zero code duplication between projects
- ✅ 90%+ test coverage for shared library
- ✅ All existing tests pass
- ✅ No breaking changes

### Observability
- ✅ 100% of embedding operations emit telemetry
- ✅ Structured logging with context
- ✅ Error classification accuracy > 95%
- ✅ Dimension mismatches detected and logged

### Performance
- ✅ < 5% latency overhead
- ✅ < 10MB memory overhead
- ✅ No performance regressions

### Adoption
- ✅ Both projects use shared library
- ✅ Documentation complete
- ✅ Migration guide available

---

## Next Steps

1. **Review and approve plan** - Stakeholder review
2. **Set up development branch** - Create feature branch
3. **Begin Phase 1** - Start with shared library structure
4. **Daily standups** - Track progress and blockers
5. **Weekly reviews** - Validate milestones

---

## Appendix: Quick Reference

### New Imports (after migration)
```python
# KnowledgeBuilder
from shared.embedding import EmbeddingService, EmbeddingTelemetry
from shared.embedding.exceptions import EmbeddingError

# SkillBuilder
from shared.embedding import EmbeddingService, EmbeddingTelemetry
from shared.embedding.exceptions import EmbeddingError
```

### Telemetry Events Emitted
- `embedding.success` - Successful embedding
- `embedding.error` - Embedding failure
- `embedding.dimension_mismatch` - Dimension validation warning
- `embedding.provider.selected` - Provider selection (on init)

### Environment Variables
- `EMBEDDING_PROVIDER` - Force provider (voyage, openai, deterministic)
- `EMBEDDING_STRICT_DIMENSIONS` - Raise error on dimension mismatch (true/false)
- `VOYAGE_API_KEY` - Voyage AI API key
- `OPENAI_API_KEY` - OpenAI API key

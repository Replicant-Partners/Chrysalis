# Embedding Service Improvements - Recommendations

## Executive Summary

During code review, several opportunities for improvement were identified in the embedding service implementations for both KnowledgeBuilder and SkillBuilder. These focus on observability, code maintainability, and operational excellence.

---

## 1. Code Duplication (HIGH PRIORITY)

### Issue
Both `KnowledgeBuilder/src/utils/embeddings.py` and `SkillBuilder/skill_builder/pipeline/embeddings.py` contain nearly identical `EmbeddingService` implementations (~214 lines duplicated).

### Impact
- Bugs must be fixed in two places
- Feature additions require duplicate work
- Risk of divergence between implementations
- Testing overhead

### Recommendation
**Create a shared embedding service library:**

```
shared/
  embedding/
    __init__.py
    service.py      # Core EmbeddingService
    providers/      # Provider abstractions
      __init__.py
      voyage.py
      openai.py
      deterministic.py
    telemetry.py    # Telemetry integration
```

**Migration Strategy:**
1. Extract common implementation to `shared/embedding/service.py`
2. Update both projects to import from shared location
3. Maintain backward compatibility during transition
4. Deprecate old files after migration

**Benefits:**
- Single source of truth
- Easier maintenance
- Consistent behavior across projects
- Better test coverage

---

## 2. Missing Telemetry Integration (HIGH PRIORITY)

### Issue
The embedding service generates embeddings but doesn't emit telemetry events for:
- API call latency
- Success/failure rates
- Provider usage statistics
- Cost tracking
- Dimension mismatches
- Rate limiting events

### Current State
- KnowledgeBuilder has `TelemetryRecorder` (SQLite-based)
- SkillBuilder has `TelemetryWriter` (JSONL-based)
- Embedding service uses neither

### Recommendation

**Add telemetry hooks to EmbeddingService:**

```python
class EmbeddingService:
    def __init__(
        self,
        telemetry_writer: Optional[TelemetryWriter] = None,
        telemetry_recorder: Optional[TelemetryRecorder] = None,
        ...
    ):
        self._telemetry_writer = telemetry_writer
        self._telemetry_recorder = telemetry_recorder

    def embed(self, text: str) -> List[float]:
        """Generate embedding with telemetry."""
        start_time = time.perf_counter()
        provider_used = None
        error = None
        dimensions = None

        try:
            # ... existing embedding logic ...
            embedding = self._embed_with_provider(text)
            provider_used = self._provider
            dimensions = len(embedding)
            elapsed_ms = (time.perf_counter() - start_time) * 1000

            # Emit success telemetry
            self._emit_telemetry(
                event_type="embedding.success",
                provider=provider_used,
                dimensions=dimensions,
                latency_ms=elapsed_ms,
                text_length=len(text),
                cost=self._estimate_cost(text, provider_used),
            )
            return embedding

        except Exception as exc:
            error = str(exc)
            elapsed_ms = (time.perf_counter() - start_time) * 1000

            # Emit failure telemetry
            self._emit_telemetry(
                event_type="embedding.error",
                provider=self._provider,
                error_type=self._classify_error(exc),
                latency_ms=elapsed_ms,
                text_length=len(text),
            )
            raise

    def _emit_telemetry(self, event_type: str, **data):
        """Emit telemetry to both systems if available."""
        # For SkillBuilder JSONL format
        if self._telemetry_writer:
            event = TelemetryEvent(
                event_type=event_type,
                data=data
            )
            self._telemetry_writer.emit(event)

        # For KnowledgeBuilder SQLite format
        if self._telemetry_recorder:
            # Convert to ToolCall format
            self._telemetry_recorder.record(ToolCall(
                tool=f"embedding.{event_type}",
                cost=data.get("cost", 0.0),
                latency_ms=data.get("latency_ms"),
                success=event_type.endswith(".success"),
                error=data.get("error"),
                meta=data
            ))
```

**Telemetry Events to Emit:**
- `embedding.success` - Successful embedding generation
- `embedding.error` - Embedding generation failure
- `embedding.provider.selected` - Provider selection (initialization)
- `embedding.fallback` - Provider fallback occurred
- `embedding.dimension_mismatch` - Dimension mismatch detected
- `embedding.rate_limited` - Rate limiting applied

**Benefits:**
- Track embedding API costs
- Monitor latency trends
- Identify provider issues
- Debug dimension mismatches
- Analyze usage patterns

---

## 3. Enhanced Logging (MEDIUM PRIORITY)

### Issue
Current logging lacks structured context and important details:
- No latency logging
- No dimension information in logs
- Generic error messages without context
- No provider selection rationale logging

### Recommendation

**Add structured logging with context:**

```python
def embed(self, text: str) -> List[float]:
    """Generate embedding with enhanced logging."""
    log_context = {
        "provider": self._provider,
        "model": self.model,
        "dimensions": self.dimensions,
        "text_length": len(text),
        "text_hash": hashlib.sha256(text.encode()).hexdigest()[:8],  # Privacy-safe
    }

    logger.info(
        "Generating embedding",
        extra=log_context
    )

    start_time = time.perf_counter()

    try:
        embedding = self._embed_with_provider(text)
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        actual_dims = len(embedding)

        if actual_dims != self.dimensions:
            logger.warning(
                f"Dimension mismatch: expected {self.dimensions}, got {actual_dims}",
                extra={**log_context, "actual_dimensions": actual_dims}
            )

        logger.info(
            f"Embedding generated successfully in {elapsed_ms:.2f}ms",
            extra={**log_context, "latency_ms": elapsed_ms, "actual_dimensions": actual_dims}
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
        raise

def _classify_error(self, exc: Exception) -> str:
    """Classify error for better observability."""
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
```

**Benefits:**
- Better debugging with context
- Easier log analysis
- Error classification for metrics
- Privacy-safe text hashing

---

## 4. Provider Abstraction (MEDIUM PRIORITY)

### Issue
The `embed()` method uses nested if statements for provider selection, making it hard to extend or test.

### Recommendation

**Refactor to Strategy Pattern:**

```python
from abc import ABC, abstractmethod

class EmbeddingProvider(ABC):
    """Abstract base class for embedding providers."""

    @abstractmethod
    def embed(self, text: str) -> List[float]:
        """Generate embedding for text."""
        pass

    @abstractmethod
    def get_dimensions(self) -> int:
        """Get embedding dimensions."""
        pass

    @abstractmethod
    def estimate_cost(self, text: str) -> float:
        """Estimate API cost for embedding."""
        pass

class VoyageProvider(EmbeddingProvider):
    def __init__(self, client, model: str, dimensions: int):
        self._client = client
        self._model = model
        self._dimensions = dimensions

    def embed(self, text: str) -> List[float]:
        result = self._client.embed([text], model=self._model)
        return result.embeddings[0]

    def get_dimensions(self) -> int:
        return self._dimensions

    def estimate_cost(self, text: str) -> float:
        # Voyage pricing: $0.0001 per 1K tokens (approx)
        tokens = len(text.split()) * 1.3  # Rough estimate
        return (tokens / 1000) * 0.0001

class OpenAIProvider(EmbeddingProvider):
    # Similar implementation...

class DeterministicProvider(EmbeddingProvider):
    # Similar implementation...

class EmbeddingService:
    def __init__(self, ...):
        # ... existing init ...
        self._provider_impl = self._create_provider()

    def _create_provider(self) -> EmbeddingProvider:
        """Factory method to create appropriate provider."""
        if self._provider == "deterministic":
            return DeterministicProvider(self.dimensions)
        elif self._provider == "voyage" and self._voyage_client:
            return VoyageProvider(self._voyage_client, self.model, self.dimensions)
        # ... etc

    def embed(self, text: str) -> List[float]:
        """Simplified embed method."""
        return self._provider_impl.embed(text)
```

**Benefits:**
- Cleaner code structure
- Easier to test individual providers
- Easier to add new providers
- Better separation of concerns

---

## 5. Cost Tracking (LOW PRIORITY)

### Issue
No cost estimation or tracking for embedding API calls.

### Recommendation

**Add cost estimation methods:**

```python
def estimate_embedding_cost(self, text: str) -> float:
    """Estimate cost for embedding generation."""
    if self._provider == "voyage":
        # Voyage AI pricing
        tokens = len(text.split()) * 1.3
        return (tokens / 1000) * 0.0001
    elif self._provider == "openai":
        # OpenAI pricing for text-embedding-3-large
        tokens = len(text.split()) * 1.3
        return (tokens / 1000) * 0.00013
    else:
        return 0.0  # Deterministic is free

def get_cost_summary(self) -> Dict[str, float]:
    """Get cost summary if telemetry is available."""
    if self._telemetry_recorder:
        summary = self._telemetry_recorder.summary()
        return {
            tool: stats["cost"]
            for tool, stats in summary.items()
            if tool.startswith("embedding.")
        }
    return {}
```

---

## 6. Dimension Consistency Validation (MEDIUM PRIORITY)

### Issue
When embeddings are generated, there's no runtime validation that dimensions match expectations, leading to silent failures.

### Recommendation

**Add dimension validation:**

```python
def embed(self, text: str) -> List[float]:
    """Generate embedding with dimension validation."""
    embedding = self._embed_with_provider(text)

    expected_dims = self._provider_impl.get_dimensions()
    actual_dims = len(embedding)

    if actual_dims != expected_dims:
        error_msg = (
            f"Dimension mismatch: expected {expected_dims} dimensions "
            f"from {self._provider} ({self.model}), got {actual_dims}. "
            f"This may indicate a provider configuration issue."
        )
        logger.error(error_msg, extra={
            "provider": self._provider,
            "model": self.model,
            "expected_dimensions": expected_dims,
            "actual_dimensions": actual_dims,
        })

        # Emit telemetry
        self._emit_telemetry(
            event_type="embedding.dimension_mismatch",
            provider=self._provider,
            expected_dimensions=expected_dims,
            actual_dimensions=actual_dims,
        )

        # Optionally raise or return with warning
        raise ValueError(error_msg)

    return embedding
```

---

## 7. Batch Embedding Support (LOW PRIORITY)

### Issue
Embedding service only supports single text embedding, but many use cases benefit from batch processing.

### Recommendation

**Add batch embedding method:**

```python
def embed_batch(self, texts: List[str]) -> List[List[float]]:
    """Generate embeddings for multiple texts efficiently."""
    if self._provider == "voyage" and self._voyage_client:
        # Voyage supports batch
        result = self._voyage_client.embed(texts, model=self.model)
        return result.embeddings
    elif self._provider == "openai" and self._openai_client:
        # OpenAI supports batch
        resp = self._openai_client.embeddings.create(
            model=self.fallback_model,
            input=texts,
            dimensions=self.fallback_dimensions
        )
        return [item.embedding for item in resp.data]
    else:
        # Fallback to sequential for deterministic
        return [self.embed(text) for text in texts]
```

---

## Implementation Priority

1. **HIGH**: Code duplication elimination (shared library)
2. **HIGH**: Telemetry integration
3. **MEDIUM**: Enhanced logging
4. **MEDIUM**: Dimension validation
5. **MEDIUM**: Provider abstraction refactoring
6. **LOW**: Cost tracking
7. **LOW**: Batch embedding support

---

## Testing Recommendations

For each improvement:
1. Add unit tests for new functionality
2. Add integration tests with telemetry systems
3. Add performance tests for batch operations
4. Test error classification accuracy
5. Verify dimension validation catches mismatches

---

## Migration Notes

- All improvements should maintain backward compatibility
- Use feature flags for gradual rollout
- Update both KnowledgeBuilder and SkillBuilder simultaneously when sharing code
- Document breaking changes clearly

"""
Custom exceptions for embedding service.
"""


class EmbeddingError(Exception):
    """Base exception for embedding errors."""
    pass


class EmbeddingProviderError(EmbeddingError):
    """Provider-specific error."""
    pass


class EmbeddingDimensionMismatchError(EmbeddingError):
    """Dimension mismatch error."""
    
    def __init__(self, expected: int, actual: int, provider: str, model: str):
        self.expected = expected
        self.actual = actual
        self.provider = provider
        self.model = model
        super().__init__(
            f"Dimension mismatch: expected {expected} dimensions from {provider} ({model}), got {actual}"
        )


class EmbeddingRateLimitError(EmbeddingProviderError):
    """Rate limit error."""
    pass


class EmbeddingAuthenticationError(EmbeddingProviderError):
    """Authentication error."""
    pass


class EmbeddingTimeoutError(EmbeddingProviderError):
    """Timeout error."""
    pass


class EmbeddingNetworkError(EmbeddingProviderError):
    """Network error."""
    pass


class EmbeddingQuotaExceededError(EmbeddingProviderError):
    """Quota exceeded error."""
    pass

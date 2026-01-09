"""
Shared embedding service for KnowledgeBuilder and SkillBuilder.

Provides unified embedding functionality with:
- Provider abstraction (Strategy pattern)
- Telemetry integration
- Enhanced logging with error classification
- Dimension validation
- Batch processing support

Public API:
    from shared.embedding import EmbeddingService, EmbeddingTelemetry
    from shared.embedding.exceptions import EmbeddingError
"""

from .service import EmbeddingService
from .telemetry import EmbeddingTelemetry
from .exceptions import (
    EmbeddingError,
    EmbeddingProviderError,
    EmbeddingDimensionMismatchError,
    EmbeddingRateLimitError,
    EmbeddingAuthenticationError,
)

__version__ = "1.0.0"

__all__ = [
    "EmbeddingService",
    "EmbeddingTelemetry",
    "EmbeddingError",
    "EmbeddingProviderError",
    "EmbeddingDimensionMismatchError",
    "EmbeddingRateLimitError",
    "EmbeddingAuthenticationError",
]

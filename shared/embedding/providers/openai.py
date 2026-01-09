"""
OpenAI embedding provider implementation.
"""

import logging
import os
from typing import List, Optional

from ..exceptions import (
    EmbeddingAuthenticationError,
    EmbeddingNetworkError,
    EmbeddingQuotaExceededError,
    EmbeddingRateLimitError,
    EmbeddingTimeoutError,
    EmbeddingProviderError,
)
from .base import EmbeddingProvider

logger = logging.getLogger(__name__)

# Try to import OpenAI SDK
_OPENAI_AVAILABLE = False
try:
    from openai import OpenAI
    _OPENAI_AVAILABLE = True
except ImportError:
    OpenAI = None  # type: ignore


class OpenAIProvider(EmbeddingProvider):
    """OpenAI embedding provider.
    
    Uses OpenAI's text-embedding-3-large model.
    """
    
    DEFAULT_MODEL = "text-embedding-3-large"
    DEFAULT_DIMENSIONS = 3072
    
    # Cost estimates (per 1K tokens)
    COST_PER_1K_TOKENS = 0.00013  # USD
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = DEFAULT_MODEL,
        dimensions: int = DEFAULT_DIMENSIONS,
    ):
        """Initialize OpenAI provider.
        
        Args:
            api_key: OpenAI API key (defaults to OPENAI_API_KEY env var)
            model: Model name (default: text-embedding-3-large)
            dimensions: Embedding dimensions (default: 3072)
        """
        if not _OPENAI_AVAILABLE:
            raise ImportError("OpenAI SDK not available. Install with: pip install openai")
        
        self._api_key = api_key or os.getenv("OPENAI_API_KEY") or os.getenv("GPT_API_KEY")
        if not self._api_key:
            raise ValueError("OpenAI API key required (set OPENAI_API_KEY or GPT_API_KEY)")
        
        self._model = model
        self._dimensions = dimensions
        
        try:
            self._client = OpenAI(api_key=self._api_key)
            logger.info(f"OpenAI provider initialized: {model} ({dimensions} dimensions)")
        except Exception as e:
            logger.error(f"OpenAI client initialization failed: {e}")
            raise EmbeddingProviderError(f"Failed to initialize OpenAI client: {e}") from e
    
    def embed(self, text: str) -> List[float]:
        """Generate embedding using OpenAI API."""
        try:
            resp = self._client.embeddings.create(
                model=self._model,
                input=text,
                dimensions=self._dimensions
            )
            embedding = resp.data[0].embedding
            
            # Validate dimensions
            if len(embedding) != self._dimensions:
                logger.warning(
                    f"OpenAI returned {len(embedding)} dimensions, expected {self._dimensions}"
                )
            
            return embedding
            
        except Exception as exc:
            error_class = self._classify_error(exc)
            logger.warning(f"OpenAI embedding failed ({error_class}): {exc}")
            raise error_class(f"OpenAI embedding failed: {exc}") from exc
    
    def _classify_error(self, exc: Exception) -> type[EmbeddingProviderError]:
        """Classify exception type."""
        exc_str = str(exc).lower()
        
        if "401" in exc_str or "unauthorized" in exc_str:
            return EmbeddingAuthenticationError
        elif "403" in exc_str or "forbidden" in exc_str:
            return EmbeddingAuthenticationError
        elif "429" in exc_str or "rate limit" in exc_str:
            return EmbeddingRateLimitError
        elif "timeout" in exc_str or "timed out" in exc_str:
            return EmbeddingTimeoutError
        elif "quota" in exc_str or "insufficient" in exc_str:
            return EmbeddingQuotaExceededError
        elif "network" in exc_str or "connection" in exc_str:
            return EmbeddingNetworkError
        else:
            return EmbeddingProviderError
    
    def get_dimensions(self) -> int:
        """Get embedding dimensions."""
        return self._dimensions
    
    def get_provider_name(self) -> str:
        """Get provider identifier."""
        return "openai"
    
    def get_model_name(self) -> str:
        """Get model name."""
        return self._model
    
    def estimate_cost(self, text: str) -> float:
        """Estimate API cost in USD.
        
        Rough estimate: ~1.3 tokens per word, cost per 1K tokens.
        """
        # Rough token estimation: ~1.3 tokens per word
        words = len(text.split())
        tokens = words * 1.3
        cost = (tokens / 1000) * self.COST_PER_1K_TOKENS
        return max(cost, 0.0)  # Ensure non-negative

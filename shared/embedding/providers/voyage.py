"""
Voyage AI embedding provider implementation.
"""

import json
import logging
import os
import urllib.request
import urllib.error
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

# Try to import Voyage AI SDK
_VOYAGE_AVAILABLE = False
try:
    import voyageai
    _VOYAGE_AVAILABLE = True
except ImportError:
    voyageai = None  # type: ignore


def _call_voyage_http(text: str, api_key: str, model: str = "voyage-3") -> Optional[List[float]]:
    """HTTP fallback for Voyage AI without SDK."""
    url = "https://api.voyageai.com/v1/embeddings"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    data = {
        "model": model,
        "input": [text]
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers=headers,
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            result = json.loads(response.read().decode("utf-8"))
            return result["data"][0]["embedding"]
    except Exception as e:
        logger.warning(f"Voyage HTTP call failed: {e}")
        return None


class VoyageProvider(EmbeddingProvider):
    """Voyage AI embedding provider.
    
    Uses Voyage AI's voyage-3 model with SDK or HTTP fallback.
    """
    
    DEFAULT_MODEL = "voyage-3"
    DEFAULT_DIMENSIONS = 1024
    
    # Cost estimates (per 1K tokens)
    COST_PER_1K_TOKENS = 0.0001  # USD (approximate)
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = DEFAULT_MODEL,
        dimensions: int = DEFAULT_DIMENSIONS,
        use_sdk: bool = True,
    ):
        """Initialize Voyage provider.
        
        Args:
            api_key: Voyage API key (defaults to VOYAGE_API_KEY env var)
            model: Model name (default: voyage-3)
            dimensions: Embedding dimensions (default: 1024)
            use_sdk: Whether to use SDK if available (default: True)
        """
        self._api_key = api_key or os.getenv("VOYAGE_API_KEY")
        if not self._api_key:
            raise ValueError("Voyage API key required (set VOYAGE_API_KEY)")
        
        self._model = model
        self._dimensions = dimensions
        self._use_sdk = use_sdk and _VOYAGE_AVAILABLE
        self._client = None
        self._use_http = False
        
        # Try SDK first if available and requested
        if self._use_sdk and voyageai:
            try:
                self._client = voyageai.Client(api_key=self._api_key)
                logger.info(f"Voyage provider initialized with SDK: {model} ({dimensions} dimensions)")
            except Exception as e:
                logger.warning(f"Voyage SDK initialization failed, falling back to HTTP: {e}")
                self._use_sdk = False
                self._use_http = True
        else:
            # Use HTTP fallback
            self._use_http = True
            logger.info(f"Voyage provider initialized with HTTP: {model} ({dimensions} dimensions)")
    
    def embed(self, text: str) -> List[float]:
        """Generate embedding using Voyage AI.
        
        Tries SDK first, falls back to HTTP if SDK fails.
        """
        # Try SDK if available
        if self._use_sdk and self._client:
            try:
                result = self._client.embed([text], model=self._model)
                embedding = result.embeddings[0]
                
                # Validate dimensions
                if len(embedding) != self._dimensions:
                    logger.warning(
                        f"Voyage returned {len(embedding)} dimensions, expected {self._dimensions}"
                    )
                
                return embedding
                
            except Exception as exc:
                logger.warning(f"Voyage SDK embedding failed, trying HTTP fallback: {exc}")
                # Fall through to HTTP fallback
        
        # HTTP fallback
        if self._use_http or not self._use_sdk:
            result = _call_voyage_http(text, self._api_key, self._model)
            if result is not None:
                # Validate dimensions
                if len(result) != self._dimensions:
                    logger.warning(
                        f"Voyage HTTP returned {len(result)} dimensions, expected {self._dimensions}"
                    )
                return result
            else:
                error_class = self._classify_error_from_context()
                raise error_class("Voyage HTTP embedding failed")
        
        # Both methods failed
        raise EmbeddingProviderError("Voyage embedding failed: both SDK and HTTP methods failed")
    
    def _classify_error_from_context(self) -> type[EmbeddingProviderError]:
        """Classify error based on context (placeholder - would need more info)."""
        return EmbeddingProviderError
    
    def get_dimensions(self) -> int:
        """Get embedding dimensions."""
        return self._dimensions
    
    def get_provider_name(self) -> str:
        """Get provider identifier."""
        return "voyage"
    
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
    
    def is_available(self) -> bool:
        """Check if provider is available."""
        return self._client is not None or self._use_http

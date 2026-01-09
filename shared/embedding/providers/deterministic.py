"""
Deterministic embedding provider for testing and offline use.

Generates reproducible embeddings based on text hash.
"""

import hashlib
from typing import List

import numpy as np

from .base import EmbeddingProvider


class DeterministicProvider(EmbeddingProvider):
    """Deterministic hash-based embedding provider.
    
    Generates reproducible embeddings for testing and offline use.
    Uses SHA256 hash of text to seed random number generator.
    """
    
    def __init__(self, dimensions: int = 1024):
        """Initialize deterministic provider.
        
        Args:
            dimensions: Embedding dimensions (default: 1024)
        """
        self._dimensions = dimensions
        self._model_name = "deterministic"
    
    def embed(self, text: str) -> List[float]:
        """Generate deterministic embedding from text hash."""
        h = hashlib.sha256(text.encode("utf-8")).hexdigest()
        seed = int(h[:8], 16)
        rng = np.random.default_rng(seed)
        vec = rng.random(self._dimensions, dtype=np.float32)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec.tolist()
    
    def get_dimensions(self) -> int:
        """Get embedding dimensions."""
        return self._dimensions
    
    def get_provider_name(self) -> str:
        """Get provider identifier."""
        return "deterministic"
    
    def get_model_name(self) -> str:
        """Get model name."""
        return self._model_name
    
    def estimate_cost(self, text: str) -> float:
        """Estimate cost (always 0.0 for deterministic provider)."""
        return 0.0

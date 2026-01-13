"""
Embedding provider implementations.

Provider Priority (OpenAI-first):
1. OpenAI (primary)
2. Nomic (fallback)
3. Deterministic (tests/offline)

Note: Voyage provider was deprecated due to dimension incompatibilities
with the rest of the system. OpenAI is now the primary provider.
"""

from .base import EmbeddingProvider
from .openai import OpenAIProvider
from .nomic import NomicProvider
from .deterministic import DeterministicProvider

__all__ = [
    "EmbeddingProvider",
    "OpenAIProvider",
    "NomicProvider",
    "DeterministicProvider",
]

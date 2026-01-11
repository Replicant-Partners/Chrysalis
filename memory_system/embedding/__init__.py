"""
Memory System Embedding Module.

Unified embedding service with multiple provider support.

Components:
- EmbeddingService: Multi-provider embedding with caching
- EmbeddingServiceSingleton: Thread-safe singleton per provider
- EmbeddingCache: Persistent embedding cache

Providers:
- Voyage AI (primary, recommended)
- OpenAI API (fallback)
- Ollama (local)
- Sentence Transformers (local)

Usage:
    # Recommended: Use singleton for cache consistency
    from memory_system.embedding import get_embedding_service
    
    service = get_embedding_service("voyage")
    vector = await service.embed("Hello world")
    
    # Same provider returns same instance (singleton)
    service2 = get_embedding_service("voyage")
    assert service is service2  # True - same instance
    
    # Direct instantiation (not recommended for production)
    from memory_system.embedding import EmbeddingService
    service = EmbeddingService(provider="ollama", model="nomic-embed-text")
    
    # Batch embedding
    vectors = await service.embed_batch(["text1", "text2", "text3"])
    
    # With caching
    service = EmbeddingService(cache_path=Path("./cache/embeddings.db"))

Design Pattern:
    Singleton pattern (Gang of Four, 1994) ensures single instance per provider
    to prevent cache fragmentation and redundant API calls.
    
    @see docs/DESIGN_PATTERN_ANALYSIS.md - Section 2.2
"""

from .service import EmbeddingService, EmbeddingResult
from .cache import EmbeddingCache
from .singleton import (
    EmbeddingServiceSingleton,
    get_embedding_service,
    get_voyage_service,
    get_openai_service,
    get_ollama_service,
)

__all__ = [
    # Core service (direct instantiation)
    "EmbeddingService",
    "EmbeddingResult",
    "EmbeddingCache",
    # Singleton pattern (recommended)
    "EmbeddingServiceSingleton",
    "get_embedding_service",
    "get_voyage_service",
    "get_openai_service",
    "get_ollama_service",
]

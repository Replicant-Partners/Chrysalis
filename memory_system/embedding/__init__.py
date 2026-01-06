"""
Memory System Embedding Module.

Unified embedding service with multiple provider support.

Components:
- EmbeddingService: Multi-provider embedding with caching
- EmbeddingCache: Persistent embedding cache

Providers:
- Ollama (local)
- OpenAI API
- Sentence Transformers (local)
- Hugging Face API

Usage:
    from memory_system.embedding import EmbeddingService
    
    service = EmbeddingService(provider="ollama", model="nomic-embed-text")
    
    # Single embedding
    vector = await service.embed("Hello world")
    
    # Batch embedding
    vectors = await service.embed_batch(["text1", "text2", "text3"])
    
    # With caching
    service = EmbeddingService(cache_path=Path("./cache/embeddings.db"))
"""

from .service import EmbeddingService, EmbeddingResult
from .cache import EmbeddingCache

__all__ = [
    "EmbeddingService",
    "EmbeddingResult",
    "EmbeddingCache",
]

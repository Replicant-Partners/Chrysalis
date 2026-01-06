"""
Embedding Service - Multi-provider embedding generation.

Unified interface for multiple embedding providers:
- Ollama (local)
- OpenAI API
- Sentence Transformers (local)
- Hugging Face API

Ported from Ludwig's embedding_service.py with enhancements.
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from .cache import EmbeddingCache

logger = logging.getLogger(__name__)

# Conditional imports
try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False
    httpx = None

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    SentenceTransformer = None


class EmbeddingProvider(Enum):
    """Embedding provider types."""
    OLLAMA = "ollama"
    OPENAI = "openai"
    SENTENCE_TRANSFORMERS = "sentence_transformers"
    HUGGINGFACE = "huggingface"


@dataclass
class EmbeddingResult:
    """Result of embedding operation."""
    
    success: bool
    vectors: List[List[float]] = field(default_factory=list)
    model: str = ""
    dimensions: int = 0
    error: Optional[str] = None
    
    # Stats
    elapsed_ms: float = 0.0
    cache_hits: int = 0
    computed: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "success": self.success,
            "vectors_count": len(self.vectors),
            "model": self.model,
            "dimensions": self.dimensions,
            "error": self.error,
            "elapsed_ms": self.elapsed_ms,
            "cache_hits": self.cache_hits,
            "computed": self.computed,
        }


class EmbeddingProviderBase(ABC):
    """Abstract base for embedding providers."""
    
    @abstractmethod
    async def embed(self, text: str) -> List[float]:
        """Generate embedding for single text."""
        pass
    
    @abstractmethod
    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for batch of texts."""
        pass
    
    @property
    @abstractmethod
    def dimensions(self) -> int:
        """Get embedding dimensions."""
        pass


class OllamaProvider(EmbeddingProviderBase):
    """Ollama local embedding provider."""
    
    DEFAULT_MODEL = "nomic-embed-text"
    DEFAULT_URL = "http://localhost:11434"
    
    def __init__(
        self,
        model: str = DEFAULT_MODEL,
        base_url: str = DEFAULT_URL,
        timeout: float = 30.0,
    ):
        self.model = model
        self.base_url = base_url
        self.timeout = timeout
        self._dimensions: Optional[int] = None
    
    async def embed(self, text: str) -> List[float]:
        """Generate embedding for single text."""
        vectors = await self.embed_batch([text])
        return vectors[0] if vectors else []
    
    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for batch of texts."""
        if not HTTPX_AVAILABLE:
            raise RuntimeError("httpx not installed")
        
        vectors = []
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for text in texts:
                response = await client.post(
                    f"{self.base_url}/api/embeddings",
                    json={"model": self.model, "prompt": text},
                )
                
                if response.status_code == 200:
                    data = response.json()
                    embedding = data.get("embedding", [])
                    vectors.append(embedding)
                    
                    if self._dimensions is None and embedding:
                        self._dimensions = len(embedding)
                else:
                    logger.error(f"Ollama embed failed: {response.status_code}")
                    vectors.append([])
        
        return vectors
    
    @property
    def dimensions(self) -> int:
        """Get embedding dimensions."""
        return self._dimensions or 768


class OpenAIProvider(EmbeddingProviderBase):
    """OpenAI API embedding provider."""
    
    DEFAULT_MODEL = "text-embedding-3-small"
    DEFAULT_URL = "https://api.openai.com/v1"
    
    DIMENSIONS = {
        "text-embedding-3-small": 1536,
        "text-embedding-3-large": 3072,
        "text-embedding-ada-002": 1536,
    }
    
    def __init__(
        self,
        api_key: str,
        model: str = DEFAULT_MODEL,
        base_url: str = DEFAULT_URL,
        timeout: float = 30.0,
    ):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url
        self.timeout = timeout
    
    async def embed(self, text: str) -> List[float]:
        """Generate embedding for single text."""
        vectors = await self.embed_batch([text])
        return vectors[0] if vectors else []
    
    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for batch of texts."""
        if not HTTPX_AVAILABLE:
            raise RuntimeError("httpx not installed")
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/embeddings",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"model": self.model, "input": texts},
            )
            
            if response.status_code == 200:
                data = response.json()
                embeddings = data.get("data", [])
                return [e.get("embedding", []) for e in embeddings]
            else:
                logger.error(f"OpenAI embed failed: {response.status_code}")
                return [[] for _ in texts]
    
    @property
    def dimensions(self) -> int:
        """Get embedding dimensions."""
        return self.DIMENSIONS.get(self.model, 1536)


class SentenceTransformersProvider(EmbeddingProviderBase):
    """Local sentence-transformers provider."""
    
    DEFAULT_MODEL = "all-MiniLM-L6-v2"
    
    def __init__(self, model: str = DEFAULT_MODEL):
        if not SENTENCE_TRANSFORMERS_AVAILABLE:
            raise RuntimeError("sentence-transformers not installed")
        
        self.model_name = model
        self._model = SentenceTransformer(model)
        self._dimensions = self._model.get_sentence_embedding_dimension()
    
    async def embed(self, text: str) -> List[float]:
        """Generate embedding for single text."""
        # Run in executor to avoid blocking
        loop = asyncio.get_event_loop()
        embedding = await loop.run_in_executor(
            None, 
            lambda: self._model.encode(text).tolist()
        )
        return embedding
    
    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for batch of texts."""
        loop = asyncio.get_event_loop()
        embeddings = await loop.run_in_executor(
            None,
            lambda: self._model.encode(texts).tolist()
        )
        return embeddings
    
    @property
    def dimensions(self) -> int:
        """Get embedding dimensions."""
        return self._dimensions


class EmbeddingService:
    """
    Unified embedding service with multiple providers.
    
    Features:
    - Multiple provider backends
    - Automatic provider fallback
    - Persistent caching
    - Batch processing
    - Async/await interface
    
    Usage:
        # With Ollama (local)
        service = EmbeddingService(provider="ollama")
        vector = await service.embed("Hello world")
        
        # With OpenAI
        service = EmbeddingService(
            provider="openai",
            api_key="sk-..."
        )
        
        # With caching
        service = EmbeddingService(
            provider="ollama",
            cache_path=Path("./cache/embeddings.db")
        )
        
        # Batch embedding
        vectors = await service.embed_batch(["text1", "text2"])
    """
    
    def __init__(
        self,
        provider: Union[str, EmbeddingProvider] = EmbeddingProvider.OLLAMA,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        cache_path: Optional[Path] = None,
        timeout: float = 30.0,
    ):
        """
        Initialize embedding service.
        
        Args:
            provider: Embedding provider type
            model: Model name (provider-specific)
            api_key: API key (for cloud providers)
            base_url: Override base URL
            cache_path: Path for persistent cache
            timeout: Request timeout
        """
        if isinstance(provider, str):
            provider = EmbeddingProvider(provider)
        
        self.provider_type = provider
        self.model = model
        
        # Initialize provider
        self._provider = self._create_provider(
            provider, model, api_key, base_url, timeout
        )
        
        # Initialize cache
        self._cache = EmbeddingCache(cache_path) if cache_path else None
    
    def _create_provider(
        self,
        provider: EmbeddingProvider,
        model: Optional[str],
        api_key: Optional[str],
        base_url: Optional[str],
        timeout: float,
    ) -> EmbeddingProviderBase:
        """Create provider instance."""
        if provider == EmbeddingProvider.OLLAMA:
            return OllamaProvider(
                model=model or OllamaProvider.DEFAULT_MODEL,
                base_url=base_url or OllamaProvider.DEFAULT_URL,
                timeout=timeout,
            )
        
        elif provider == EmbeddingProvider.OPENAI:
            if not api_key:
                raise ValueError("OpenAI provider requires api_key")
            return OpenAIProvider(
                api_key=api_key,
                model=model or OpenAIProvider.DEFAULT_MODEL,
                base_url=base_url or OpenAIProvider.DEFAULT_URL,
                timeout=timeout,
            )
        
        elif provider == EmbeddingProvider.SENTENCE_TRANSFORMERS:
            return SentenceTransformersProvider(
                model=model or SentenceTransformersProvider.DEFAULT_MODEL
            )
        
        else:
            raise ValueError(f"Unsupported provider: {provider}")
    
    @property
    def dimensions(self) -> int:
        """Get embedding dimensions."""
        return self._provider.dimensions
    
    async def embed(self, text: str) -> List[float]:
        """
        Generate embedding for text.
        
        Args:
            text: Text to embed
            
        Returns:
            Embedding vector
        """
        result = await self.embed_batch([text])
        return result[0] if result else []
    
    async def embed_batch(
        self, 
        texts: List[str],
        show_progress: bool = False,
    ) -> List[List[float]]:
        """
        Generate embeddings for batch of texts.
        
        Args:
            texts: List of texts to embed
            show_progress: Show progress indicator
            
        Returns:
            List of embedding vectors
        """
        if not texts:
            return []
        
        import time
        start = time.perf_counter()
        
        cache_model = self.model or self.provider_type.value
        
        # Check cache
        if self._cache:
            cached, missing = self._cache.get_batch(texts, cache_model)
        else:
            cached = {}
            missing = texts.copy()
        
        # Compute missing embeddings
        computed = {}
        if missing:
            try:
                vectors = await self._provider.embed_batch(missing)
                for text, vector in zip(missing, vectors):
                    computed[text] = vector
                
                # Update cache
                if self._cache and computed:
                    self._cache.set_batch(computed, cache_model)
                    
            except Exception as e:
                logger.error(f"Embedding failed: {e}")
                for text in missing:
                    computed[text] = []
        
        # Combine results in original order
        result = []
        for text in texts:
            if text in cached:
                result.append(cached[text])
            else:
                result.append(computed.get(text, []))
        
        elapsed = (time.perf_counter() - start) * 1000
        logger.debug(
            f"Embedded {len(texts)} texts in {elapsed:.0f}ms "
            f"(cached: {len(cached)}, computed: {len(computed)})"
        )
        
        return result
    
    async def embed_with_result(
        self, 
        texts: Union[str, List[str]]
    ) -> EmbeddingResult:
        """
        Generate embeddings with detailed result.
        
        Args:
            texts: Text or list of texts
            
        Returns:
            EmbeddingResult with vectors and stats
        """
        import time
        start = time.perf_counter()
        
        if isinstance(texts, str):
            texts = [texts]
        
        cache_model = self.model or self.provider_type.value
        
        # Check cache
        if self._cache:
            cached, missing = self._cache.get_batch(texts, cache_model)
        else:
            cached = {}
            missing = texts.copy()
        
        # Compute missing
        computed = {}
        error = None
        
        if missing:
            try:
                vectors = await self._provider.embed_batch(missing)
                for text, vector in zip(missing, vectors):
                    computed[text] = vector
                
                if self._cache and computed:
                    self._cache.set_batch(computed, cache_model)
                    
            except Exception as e:
                error = str(e)
                for text in missing:
                    computed[text] = []
        
        # Combine results
        result_vectors = []
        for text in texts:
            if text in cached:
                result_vectors.append(cached[text])
            else:
                result_vectors.append(computed.get(text, []))
        
        elapsed = (time.perf_counter() - start) * 1000
        
        return EmbeddingResult(
            success=error is None,
            vectors=result_vectors,
            model=cache_model,
            dimensions=self.dimensions,
            error=error,
            elapsed_ms=elapsed,
            cache_hits=len(cached),
            computed=len(computed),
        )
    
    def get_cache_stats(self) -> Optional[Dict]:
        """Get cache statistics."""
        if self._cache:
            return self._cache.get_stats()
        return None
    
    def clear_cache(self) -> int:
        """Clear embedding cache."""
        if self._cache:
            return self._cache.clear()
        return 0
    
    def close(self) -> None:
        """Close service and save cache."""
        if self._cache:
            self._cache.close()

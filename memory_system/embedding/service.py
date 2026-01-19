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
    """Ollama local embedding provider.

    Supports various embedding models including:
    - nomic-embed-text (768 dims) - recommended for general use
    - mxbai-embed-large (1024 dims) - higher quality
    - all-minilm (384 dims) - faster, smaller
    - snowflake-arctic-embed (1024 dims) - good for retrieval
    """

    DEFAULT_MODEL = "nomic-embed-text"
    DEFAULT_URL = "http://localhost:11434"

    # Known model dimensions for local models
    MODEL_DIMENSIONS = {
        "nomic-embed-text": 768,
        "nomic-embed-text:latest": 768,
        "nomic-embed-text:v1.5": 768,
        "mxbai-embed-large": 1024,
        "all-minilm": 384,
        "all-minilm:l6-v2": 384,
        "snowflake-arctic-embed": 1024,
        "bge-m3": 1024,
        "bge-large": 1024,
    }

    def __init__(
        self,
        model: str = DEFAULT_MODEL,
        base_url: str = DEFAULT_URL,
        timeout: float = 30.0,
        task_type: Optional[str] = None,  # For Nomic: "search_document", "search_query", "clustering", "classification"
    ):
        self.model = model
        self.base_url = base_url
        self.timeout = timeout
        self.task_type = task_type
        self._dimensions: Optional[int] = self.MODEL_DIMENSIONS.get(model)

    def _format_prompt(self, text: str, is_query: bool = False) -> str:
        """Format prompt with task prefix for Nomic models."""
        # Nomic models benefit from task-specific prefixes
        if "nomic" in self.model.lower():
            if self.task_type == "search_query" or is_query:
                return f"search_query: {text}"
            elif self.task_type == "search_document":
                return f"search_document: {text}"
            elif self.task_type == "clustering":
                return f"clustering: {text}"
            elif self.task_type == "classification":
                return f"classification: {text}"
        return text

    async def embed(self, text: str) -> List[float]:
        """Generate embedding for single text."""
        vectors = await self.embed_batch([text])
        return vectors[0] if vectors else []

    async def embed_query(self, text: str) -> List[float]:
        """Generate embedding for a search query (optimized for retrieval)."""
        if not HTTPX_AVAILABLE:
            raise RuntimeError("httpx not installed")

        prompt = self._format_prompt(text, is_query=True)

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/api/embeddings",
                json={"model": self.model, "prompt": prompt},
            )

            if response.status_code == 200:
                data = response.json()
                return data.get("embedding", [])
            else:
                logger.error(f"Ollama embed_query failed: {response.status_code}")
                return []

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for batch of texts."""
        if not HTTPX_AVAILABLE:
            raise RuntimeError("httpx not installed")

        vectors = []

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for text in texts:
                prompt = self._format_prompt(text)
                response = await client.post(
                    f"{self.base_url}/api/embeddings",
                    json={"model": self.model, "prompt": prompt},
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


class HuggingFaceProvider(EmbeddingProviderBase):
    """HuggingFace Inference API embedding provider."""

    DEFAULT_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
    DEFAULT_URL = "https://api-inference.huggingface.co/pipeline/feature-extraction"

    # Common embedding model dimensions
    DIMENSIONS = {
        "sentence-transformers/all-MiniLM-L6-v2": 384,
        "sentence-transformers/all-mpnet-base-v2": 768,
        "BAAI/bge-small-en-v1.5": 384,
        "BAAI/bge-base-en-v1.5": 768,
        "BAAI/bge-large-en-v1.5": 1024,
        "nomic-ai/nomic-embed-text-v1": 768,
        "nomic-ai/nomic-embed-text-v1.5": 768,
        "thenlper/gte-small": 384,
        "thenlper/gte-base": 768,
        "thenlper/gte-large": 1024,
        "Alibaba-NLP/gte-Qwen2-1.5B-instruct": 1536,
    }

    def __init__(
        self,
        api_key: str,
        model: str = DEFAULT_MODEL,
        base_url: Optional[str] = None,
        timeout: float = 30.0,
    ):
        if not HTTPX_AVAILABLE:
            raise RuntimeError("httpx not installed")

        self.api_key = api_key
        self.model = model
        self.base_url = base_url or self.DEFAULT_URL
        self.timeout = timeout
        self._dimensions: Optional[int] = self.DIMENSIONS.get(model)

    async def embed(self, text: str) -> List[float]:
        """Generate embedding for single text."""
        vectors = await self.embed_batch([text])
        return vectors[0] if vectors else []

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for batch of texts."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            # HuggingFace feature-extraction pipeline
            response = await client.post(
                f"{self.base_url}/{self.model}",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"inputs": texts, "options": {"wait_for_model": True}},
            )

            if response.status_code == 200:
                data = response.json()
                # HF returns nested arrays for batch; handle different output formats
                if isinstance(data, list):
                    embeddings = []
                    for item in data:
                        if isinstance(item, list):
                            # Could be [batch][tokens][dims] or [batch][dims]
                            if item and isinstance(item[0], list):
                                # Mean pool over tokens
                                pooled = [sum(t[i] for t in item) / len(item)
                                         for i in range(len(item[0]))]
                                embeddings.append(pooled)
                            else:
                                embeddings.append(item)
                        else:
                            embeddings.append([])

                    # Auto-detect dimensions
                    if self._dimensions is None and embeddings and embeddings[0]:
                        self._dimensions = len(embeddings[0])

                    return embeddings
                else:
                    logger.error(f"HuggingFace unexpected response format: {type(data)}")
                    return [[] for _ in texts]
            else:
                logger.error(f"HuggingFace embed failed: {response.status_code} - {response.text}")
                return [[] for _ in texts]

    @property
    def dimensions(self) -> int:
        """Get embedding dimensions."""
        return self._dimensions or 768  # Default assumption


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

        elif provider == EmbeddingProvider.HUGGINGFACE:
            if not api_key:
                raise ValueError("HuggingFace provider requires api_key")
            return HuggingFaceProvider(
                api_key=api_key,
                model=model or HuggingFaceProvider.DEFAULT_MODEL,
                base_url=base_url,
                timeout=timeout,
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

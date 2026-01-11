"""
Singleton Embedding Service - Thread-safe singleton pattern implementation.

Enforces single instance per provider to ensure cache consistency and
prevent redundant API calls.

Design Pattern: Singleton (Gang of Four, 1994)
- Ensures a class has only one instance per provider
- Provides global point of access
- Thread-safe implementation with locks

@see Design Patterns: Elements of Reusable Object-Oriented Software
     Gamma, Helm, Johnson, Vlissides (1994), Chapter: Singleton Pattern
@see docs/DESIGN_PATTERN_ANALYSIS.md - Section 2.2: Inconsistent Singleton Management

Usage:
    # Get singleton instance (creates if not exists)
    service = EmbeddingServiceSingleton.get_instance("voyage")
    
    # Same provider returns same instance
    service2 = EmbeddingServiceSingleton.get_instance("voyage")
    assert service is service2  # True
    
    # Different provider returns different instance
    service3 = EmbeddingServiceSingleton.get_instance("openai")
    assert service is not service3  # True
    
    # Reset for testing
    EmbeddingServiceSingleton.reset_instances()
"""

import logging
import os
import threading
from pathlib import Path
from typing import Dict, List, Optional, Union

from .service import EmbeddingService, EmbeddingProvider, EmbeddingResult

logger = logging.getLogger(__name__)


class EmbeddingServiceSingleton:
    """
    Singleton wrapper for EmbeddingService.
    
    Ensures single instance per provider type to:
    - Prevent cache fragmentation
    - Avoid redundant API calls
    - Share resources efficiently
    
    Thread-safe implementation using double-checked locking pattern.
    
    Attributes:
        _instances: Registry of singleton instances per provider
        _lock: Thread lock for instance creation
    """
    
    # Class-level registry of instances
    _instances: Dict[str, 'EmbeddingServiceSingleton'] = {}
    _lock: threading.Lock = threading.Lock()
    
    def __init__(
        self,
        provider: Union[str, EmbeddingProvider],
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        cache_path: Optional[Path] = None,
        timeout: float = 30.0,
    ):
        """
        Initialize singleton instance.
        
        Note: Use get_instance() instead of direct construction.
        Direct construction is allowed for testing but not recommended.
        
        Args:
            provider: Embedding provider type
            model: Model name (provider-specific)
            api_key: API key (for cloud providers)
            base_url: Override base URL
            cache_path: Path for persistent cache
            timeout: Request timeout
        """
        self._service = EmbeddingService(
            provider=provider,
            model=model,
            api_key=api_key,
            base_url=base_url,
            cache_path=cache_path,
            timeout=timeout,
        )
        self._provider_key = self._make_key(provider, model)
        self._initialized = True
        
        logger.info(f"EmbeddingServiceSingleton created for provider: {self._provider_key}")
    
    @staticmethod
    def _make_key(provider: Union[str, EmbeddingProvider], model: Optional[str] = None) -> str:
        """Create unique key for provider+model combination."""
        if isinstance(provider, EmbeddingProvider):
            provider = provider.value
        return f"{provider}:{model or 'default'}"
    
    @classmethod
    def get_instance(
        cls,
        provider: Union[str, EmbeddingProvider] = "voyage",
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        cache_path: Optional[Path] = None,
        timeout: float = 30.0,
        auto_configure: bool = True,
    ) -> 'EmbeddingServiceSingleton':
        """
        Get singleton instance for provider.
        
        Thread-safe implementation using double-checked locking.
        
        Args:
            provider: Embedding provider type
            model: Model name (provider-specific)
            api_key: API key (for cloud providers)
            base_url: Override base URL
            cache_path: Path for persistent cache
            timeout: Request timeout
            auto_configure: Auto-configure from environment variables
            
        Returns:
            Singleton instance for the provider
            
        Example:
            # First call creates instance
            service = EmbeddingServiceSingleton.get_instance("voyage")
            
            # Subsequent calls return same instance
            service2 = EmbeddingServiceSingleton.get_instance("voyage")
            assert service is service2
        """
        key = cls._make_key(provider, model)
        
        # First check without lock (fast path)
        if key in cls._instances:
            return cls._instances[key]
        
        # Acquire lock for instance creation
        with cls._lock:
            # Double-check after acquiring lock
            if key in cls._instances:
                return cls._instances[key]
            
            # Auto-configure from environment if enabled
            if auto_configure:
                api_key, base_url, cache_path = cls._auto_configure(
                    provider, api_key, base_url, cache_path
                )
            
            # Create new instance
            instance = cls(
                provider=provider,
                model=model,
                api_key=api_key,
                base_url=base_url,
                cache_path=cache_path,
                timeout=timeout,
            )
            
            cls._instances[key] = instance
            logger.info(f"Registered singleton for: {key}")
            
            return instance
    
    @classmethod
    def _auto_configure(
        cls,
        provider: Union[str, EmbeddingProvider],
        api_key: Optional[str],
        base_url: Optional[str],
        cache_path: Optional[Path],
    ) -> tuple:
        """Auto-configure from environment variables."""
        if isinstance(provider, EmbeddingProvider):
            provider_str = provider.value
        else:
            provider_str = provider
        
        # API key from environment
        if api_key is None:
            env_key_map = {
                "voyage": "VOYAGE_API_KEY",
                "openai": "OPENAI_API_KEY",
                "anthropic": "ANTHROPIC_API_KEY",
            }
            env_key = env_key_map.get(provider_str)
            if env_key:
                api_key = os.environ.get(env_key)
        
        # Base URL from environment
        if base_url is None:
            env_url_map = {
                "voyage": "VOYAGE_BASE_URL",
                "openai": "OPENAI_BASE_URL",
                "ollama": "OLLAMA_BASE_URL",
            }
            env_url = env_url_map.get(provider_str)
            if env_url:
                base_url = os.environ.get(env_url)
        
        # Cache path from environment
        if cache_path is None:
            cache_env = os.environ.get("EMBEDDING_CACHE_PATH")
            if cache_env:
                cache_path = Path(cache_env)
        
        return api_key, base_url, cache_path
    
    @classmethod
    def has_instance(cls, provider: Union[str, EmbeddingProvider], model: Optional[str] = None) -> bool:
        """Check if singleton instance exists for provider."""
        key = cls._make_key(provider, model)
        return key in cls._instances
    
    @classmethod
    def get_all_instances(cls) -> Dict[str, 'EmbeddingServiceSingleton']:
        """Get all registered singleton instances."""
        return dict(cls._instances)
    
    @classmethod
    def reset_instances(cls) -> None:
        """
        Reset all singleton instances.
        
        WARNING: Only use for testing. In production, instances should
        persist for the lifetime of the application.
        """
        with cls._lock:
            # Close all services
            for key, instance in cls._instances.items():
                try:
                    instance._service.close()
                    logger.info(f"Closed singleton: {key}")
                except Exception as e:
                    logger.warning(f"Error closing singleton {key}: {e}")
            
            cls._instances.clear()
            logger.info("All singleton instances reset")
    
    @classmethod
    def reset_instance(cls, provider: Union[str, EmbeddingProvider], model: Optional[str] = None) -> bool:
        """
        Reset specific singleton instance.
        
        Args:
            provider: Provider to reset
            model: Model to reset
            
        Returns:
            True if instance was reset, False if not found
        """
        key = cls._make_key(provider, model)
        
        with cls._lock:
            if key in cls._instances:
                try:
                    cls._instances[key]._service.close()
                except Exception as e:
                    logger.warning(f"Error closing singleton {key}: {e}")
                
                del cls._instances[key]
                logger.info(f"Reset singleton: {key}")
                return True
            
            return False
    
    # Delegate methods to underlying service
    
    @property
    def dimensions(self) -> int:
        """Get embedding dimensions."""
        return self._service.dimensions
    
    @property
    def provider_key(self) -> str:
        """Get provider key for this instance."""
        return self._provider_key
    
    async def embed(self, text: str) -> List[float]:
        """
        Generate embedding for text.
        
        Args:
            text: Text to embed
            
        Returns:
            Embedding vector
        """
        return await self._service.embed(text)
    
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
        return await self._service.embed_batch(texts, show_progress)
    
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
        return await self._service.embed_with_result(texts)
    
    def get_cache_stats(self) -> Optional[Dict]:
        """Get cache statistics."""
        return self._service.get_cache_stats()
    
    def clear_cache(self) -> int:
        """Clear embedding cache."""
        return self._service.clear_cache()
    
    def close(self) -> None:
        """Close service and save cache."""
        self._service.close()


# Convenience function for getting default instance
def get_embedding_service(
    provider: Union[str, EmbeddingProvider] = "voyage",
    model: Optional[str] = None,
    **kwargs
) -> EmbeddingServiceSingleton:
    """
    Get embedding service singleton instance.
    
    Convenience function that wraps EmbeddingServiceSingleton.get_instance().
    
    Args:
        provider: Embedding provider type
        model: Model name
        **kwargs: Additional arguments passed to get_instance()
        
    Returns:
        Singleton embedding service instance
        
    Example:
        service = get_embedding_service("voyage")
        vector = await service.embed("Hello world")
    """
    return EmbeddingServiceSingleton.get_instance(provider, model, **kwargs)


# Provider-specific convenience functions

def get_voyage_service(model: str = "voyage-3", **kwargs) -> EmbeddingServiceSingleton:
    """Get Voyage AI embedding service singleton."""
    return EmbeddingServiceSingleton.get_instance("voyage", model, **kwargs)


def get_openai_service(model: str = "text-embedding-3-small", **kwargs) -> EmbeddingServiceSingleton:
    """Get OpenAI embedding service singleton."""
    return EmbeddingServiceSingleton.get_instance("openai", model, **kwargs)


def get_ollama_service(model: str = "nomic-embed-text", **kwargs) -> EmbeddingServiceSingleton:
    """Get Ollama embedding service singleton."""
    return EmbeddingServiceSingleton.get_instance("ollama", model, **kwargs)

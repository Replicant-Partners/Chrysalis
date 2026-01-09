"""
Abstract base class for embedding providers.
"""

from abc import ABC, abstractmethod
from typing import List


class EmbeddingProvider(ABC):
    """Abstract base class for embedding providers.
    
    All embedding providers must implement this interface.
    """
    
    @abstractmethod
    def embed(self, text: str) -> List[float]:
        """Generate embedding for text.
        
        Args:
            text: Text to embed
            
        Returns:
            Embedding vector as list of floats
            
        Raises:
            EmbeddingProviderError: If embedding generation fails
        """
        pass
    
    @abstractmethod
    def get_dimensions(self) -> int:
        """Get embedding dimensions.
        
        Returns:
            Number of dimensions in embedding vectors
        """
        pass
    
    @abstractmethod
    def get_provider_name(self) -> str:
        """Get provider identifier.
        
        Returns:
            Provider name (e.g., "voyage", "openai", "deterministic")
        """
        pass
    
    @abstractmethod
    def get_model_name(self) -> str:
        """Get model name.
        
        Returns:
            Model identifier (e.g., "voyage-3", "text-embedding-3-large")
        """
        pass
    
    @abstractmethod
    def estimate_cost(self, text: str) -> float:
        """Estimate API cost in USD.
        
        Args:
            text: Text to estimate cost for
            
        Returns:
            Estimated cost in USD (0.0 for free providers)
        """
        pass
    
    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts.
        
        Default implementation uses sequential processing.
        Providers can override for batch optimization.
        
        Args:
            texts: List of texts to embed
            
        Returns:
            List of embedding vectors
        """
        return [self.embed(text) for text in texts]
    
    def is_available(self) -> bool:
        """Check if provider is available and ready.
        
        Returns:
            True if provider can generate embeddings
        """
        return True

"""
Tests for EmbeddingServiceSingleton.

Validates singleton pattern implementation:
- Single instance per provider
- Thread safety
- Auto-configuration from environment
- Reset functionality for testing

@see Design Patterns: Elements of Reusable Object-Oriented Software
     Gamma, Helm, Johnson, Vlissides (1994), Chapter: Singleton Pattern
"""

import os
import pytest
import threading
from unittest.mock import patch, MagicMock

# Import the singleton module
from memory_system.embedding.singleton import (
    EmbeddingServiceSingleton,
    get_embedding_service,
    get_voyage_service,
    get_openai_service,
    get_ollama_service,
)


class TestEmbeddingServiceSingleton:
    """Test suite for EmbeddingServiceSingleton."""
    
    def setup_method(self):
        """Reset singleton instances before each test."""
        EmbeddingServiceSingleton.reset_instances()
    
    def teardown_method(self):
        """Clean up after each test."""
        EmbeddingServiceSingleton.reset_instances()
    
    def test_singleton_same_provider_returns_same_instance(self):
        """Same provider should return same instance."""
        # Mock the underlying service to avoid actual API calls
        with patch('memory_system.embedding.singleton.EmbeddingService'):
            service1 = EmbeddingServiceSingleton.get_instance("ollama")
            service2 = EmbeddingServiceSingleton.get_instance("ollama")
            
            assert service1 is service2, "Same provider should return same instance"
    
    def test_singleton_different_providers_return_different_instances(self):
        """Different providers should return different instances."""
        with patch('memory_system.embedding.singleton.EmbeddingService'):
            service_ollama = EmbeddingServiceSingleton.get_instance("ollama")
            service_openai = EmbeddingServiceSingleton.get_instance(
                "openai", 
                api_key="test-key"
            )
            
            assert service_ollama is not service_openai, \
                "Different providers should return different instances"
    
    def test_singleton_same_provider_different_models_return_different_instances(self):
        """Same provider with different models should return different instances."""
        with patch('memory_system.embedding.singleton.EmbeddingService'):
            service1 = EmbeddingServiceSingleton.get_instance("ollama", model="model-a")
            service2 = EmbeddingServiceSingleton.get_instance("ollama", model="model-b")
            
            assert service1 is not service2, \
                "Same provider with different models should return different instances"
    
    def test_has_instance(self):
        """Test has_instance method."""
        with patch('memory_system.embedding.singleton.EmbeddingService'):
            assert not EmbeddingServiceSingleton.has_instance("ollama")
            
            EmbeddingServiceSingleton.get_instance("ollama")
            
            assert EmbeddingServiceSingleton.has_instance("ollama")
            assert not EmbeddingServiceSingleton.has_instance("openai")
    
    def test_get_all_instances(self):
        """Test get_all_instances method."""
        with patch('memory_system.embedding.singleton.EmbeddingService'):
            assert len(EmbeddingServiceSingleton.get_all_instances()) == 0
            
            EmbeddingServiceSingleton.get_instance("ollama")
            EmbeddingServiceSingleton.get_instance("openai", api_key="test")
            
            instances = EmbeddingServiceSingleton.get_all_instances()
            assert len(instances) == 2
    
    def test_reset_instances(self):
        """Test reset_instances clears all instances."""
        with patch('memory_system.embedding.singleton.EmbeddingService'):
            EmbeddingServiceSingleton.get_instance("ollama")
            EmbeddingServiceSingleton.get_instance("openai", api_key="test")
            
            assert len(EmbeddingServiceSingleton.get_all_instances()) == 2
            
            EmbeddingServiceSingleton.reset_instances()
            
            assert len(EmbeddingServiceSingleton.get_all_instances()) == 0
    
    def test_reset_specific_instance(self):
        """Test reset_instance for specific provider."""
        with patch('memory_system.embedding.singleton.EmbeddingService'):
            EmbeddingServiceSingleton.get_instance("ollama")
            EmbeddingServiceSingleton.get_instance("openai", api_key="test")
            
            result = EmbeddingServiceSingleton.reset_instance("ollama")
            
            assert result is True
            assert not EmbeddingServiceSingleton.has_instance("ollama")
            assert EmbeddingServiceSingleton.has_instance("openai")
    
    def test_reset_nonexistent_instance(self):
        """Test reset_instance for nonexistent provider returns False."""
        result = EmbeddingServiceSingleton.reset_instance("nonexistent")
        assert result is False
    
    def test_thread_safety(self):
        """Test thread-safe singleton creation."""
        with patch('memory_system.embedding.singleton.EmbeddingService'):
            instances = []
            errors = []

            def get_instance():
                try:
                    instance = EmbeddingServiceSingleton.get_instance("ollama")
                    instances.append(instance)
                except Exception as e:
                    errors.append(e)

            # Create multiple threads trying to get the same instance
            threads = [threading.Thread(target=get_instance) for _ in range(10)]

            for t in threads:
                t.start()

            for t in threads:
                t.join()

            # All threads should get the same instance
            assert not errors, f"Errors occurred: {errors}"
            assert len(instances) == 10
            assert all(inst is instances[0] for inst in instances), \
                    "All threads should get the same instance"
    
    def test_auto_configure_from_environment(self):
        """Test auto-configuration from environment variables."""
        with patch('memory_system.embedding.singleton.EmbeddingService') as mock_service:
            with patch.dict(os.environ, {
                'VOYAGE_API_KEY': 'test-voyage-key',
                'EMBEDDING_CACHE_PATH': '/tmp/test-cache'
            }):
                EmbeddingServiceSingleton.get_instance("voyage", auto_configure=True)
                
                # Verify the service was created with the env var values
                mock_service.assert_called_once()
                call_kwargs = mock_service.call_args[1]
                assert call_kwargs.get('api_key') == 'test-voyage-key'
    
    def test_provider_key_generation(self):
        """Test provider key generation."""
        key1 = EmbeddingServiceSingleton._make_key("voyage", None)
        key2 = EmbeddingServiceSingleton._make_key("voyage", "voyage-3")
        key3 = EmbeddingServiceSingleton._make_key("openai", "text-embedding-3-small")
        
        assert key1 == "voyage:default"
        assert key2 == "voyage:voyage-3"
        assert key3 == "openai:text-embedding-3-small"


class TestConvenienceFunctions:
    """Test convenience functions for getting singleton instances."""
    
    def setup_method(self):
        """Reset singleton instances before each test."""
        EmbeddingServiceSingleton.reset_instances()
    
    def teardown_method(self):
        """Clean up after each test."""
        EmbeddingServiceSingleton.reset_instances()
    
    def test_get_embedding_service(self):
        """Test get_embedding_service convenience function."""
        with patch('memory_system.embedding.singleton.EmbeddingService'):
            service = get_embedding_service("ollama")
            
            assert isinstance(service, EmbeddingServiceSingleton)
            assert EmbeddingServiceSingleton.has_instance("ollama")
    
    def test_get_voyage_service(self):
        """Test get_voyage_service convenience function."""
        with patch('memory_system.embedding.singleton.EmbeddingService'):
            with patch.dict(os.environ, {'VOYAGE_API_KEY': 'test-key'}):
                service = get_voyage_service()
                
                assert isinstance(service, EmbeddingServiceSingleton)
                assert service.provider_key == "voyage:voyage-3"
    
    def test_get_openai_service(self):
        """Test get_openai_service convenience function."""
        with patch('memory_system.embedding.singleton.EmbeddingService'):
            with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key'}):
                service = get_openai_service()
                
                assert isinstance(service, EmbeddingServiceSingleton)
                assert service.provider_key == "openai:text-embedding-3-small"
    
    def test_get_ollama_service(self):
        """Test get_ollama_service convenience function."""
        with patch('memory_system.embedding.singleton.EmbeddingService'):
            service = get_ollama_service()
            
            assert isinstance(service, EmbeddingServiceSingleton)
            assert service.provider_key == "ollama:nomic-embed-text"


class TestSingletonDelegation:
    """Test that singleton properly delegates to underlying service."""
    
    def setup_method(self):
        """Reset singleton instances before each test."""
        EmbeddingServiceSingleton.reset_instances()
    
    def teardown_method(self):
        """Clean up after each test."""
        EmbeddingServiceSingleton.reset_instances()
    
    def test_dimensions_delegation(self):
        """Test dimensions property delegation."""
        with patch('memory_system.embedding.singleton.EmbeddingService') as mock_service:
            mock_instance = MagicMock()
            mock_instance.dimensions = 1536
            mock_service.return_value = mock_instance
            
            singleton = EmbeddingServiceSingleton.get_instance("ollama")
            
            assert singleton.dimensions == 1536
    
    def test_get_cache_stats_delegation(self):
        """Test get_cache_stats delegation."""
        with patch('memory_system.embedding.singleton.EmbeddingService') as mock_service:
            mock_instance = MagicMock()
            mock_instance.get_cache_stats.return_value = {"hits": 10, "misses": 5}
            mock_service.return_value = mock_instance
            
            singleton = EmbeddingServiceSingleton.get_instance("ollama")
            stats = singleton.get_cache_stats()
            
            assert stats == {"hits": 10, "misses": 5}
            mock_instance.get_cache_stats.assert_called_once()
    
    def test_clear_cache_delegation(self):
        """Test clear_cache delegation."""
        with patch('memory_system.embedding.singleton.EmbeddingService') as mock_service:
            mock_instance = MagicMock()
            mock_instance.clear_cache.return_value = 15
            mock_service.return_value = mock_instance
            
            singleton = EmbeddingServiceSingleton.get_instance("ollama")
            cleared = singleton.clear_cache()
            
            assert cleared == 15
            mock_instance.clear_cache.assert_called_once()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

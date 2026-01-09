"""
Tests for embedding providers.
"""
import os
import pytest
from unittest.mock import Mock, patch

from shared.embedding.providers.deterministic import DeterministicProvider
from shared.embedding.providers.openai import OpenAIProvider
from shared.embedding.providers.voyage import VoyageProvider
from shared.embedding.exceptions import EmbeddingError


class TestDeterministicProvider:
    """Test deterministic provider."""

    def test_deterministic_embedding(self):
        """Test deterministic embedding generation."""
        provider = DeterministicProvider(dimensions=10)
        emb1 = provider.embed("test text")

        assert isinstance(emb1, list)
        assert len(emb1) == 10
        assert all(isinstance(x, float) for x in emb1)

        # Should be reproducible
        emb2 = provider.embed("test text")
        assert emb1 == emb2

    def test_deterministic_embeddings_normalized(self):
        """Test that deterministic embeddings are normalized."""
        provider = DeterministicProvider(dimensions=10)
        emb = provider.embed("test")

        # Check normalization (magnitude should be ~1.0)
        magnitude = sum(x * x for x in emb) ** 0.5
        assert abs(magnitude - 1.0) < 0.01

    def test_different_texts_different_embeddings(self):
        """Test that different texts produce different embeddings."""
        provider = DeterministicProvider(dimensions=10)
        emb1 = provider.embed("text one")
        emb2 = provider.embed("text two")

        assert emb1 != emb2

    def test_get_dimensions(self):
        """Test dimension getter."""
        provider = DeterministicProvider(dimensions=1024)
        assert provider.get_dimensions() == 1024

    def test_get_provider_name(self):
        """Test provider name."""
        provider = DeterministicProvider()
        assert provider.get_provider_name() == "deterministic"

    def test_estimate_cost(self):
        """Test cost estimation (should be 0.0 for deterministic)."""
        provider = DeterministicProvider()
        assert provider.estimate_cost("test") == 0.0

    def test_embed_batch(self):
        """Test batch embedding."""
        provider = DeterministicProvider(dimensions=10)
        texts = ["text one", "text two", "text three"]
        embeddings = provider.embed_batch(texts)

        assert len(embeddings) == 3
        assert all(len(emb) == 10 for emb in embeddings)


class TestOpenAIProvider:
    """Test OpenAI provider."""

    def test_openai_provider_requires_api_key(self):
        """Test that OpenAI provider requires API key."""
        with patch.dict(os.environ, {"OPENAI_API_KEY": "", "GPT_API_KEY": ""}, clear=True):
            with pytest.raises(ValueError, match="OpenAI API key required"):
                OpenAIProvider()

    @patch('shared.embedding.providers.openai._OPENAI_AVAILABLE', True)
    @patch('shared.embedding.providers.openai.OpenAI')
    def test_openai_provider_initialization(self, mock_openai_class):
        """Test OpenAI provider initialization."""
        mock_client = Mock()
        mock_openai_class.return_value = mock_client

        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}):
            provider = OpenAIProvider(api_key="test-key")

            assert provider.get_provider_name() == "openai"
            assert provider.get_dimensions() == 3072
            assert provider.get_model_name() == "text-embedding-3-large"

    @patch('shared.embedding.providers.openai._OPENAI_AVAILABLE', True)
    @patch('shared.embedding.providers.openai.OpenAI')
    def test_openai_embed_success(self, mock_openai_class):
        """Test successful OpenAI embedding."""
        mock_client = Mock()
        mock_response = Mock()
        mock_response.data = [Mock(embedding=[0.1] * 3072)]
        mock_client.embeddings.create.return_value = mock_response
        mock_openai_class.return_value = mock_client

        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}):
            provider = OpenAIProvider(api_key="test-key")
            embedding = provider.embed("test text")

            assert len(embedding) == 3072
            mock_client.embeddings.create.assert_called_once()

    def test_openai_not_available_raises_error(self):
        """Test that missing OpenAI SDK raises error."""
        with patch('shared.embedding.providers.openai._OPENAI_AVAILABLE', False):
            with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}):
                with pytest.raises(ImportError, match="OpenAI SDK not available"):
                    OpenAIProvider(api_key="test-key")

    def test_estimate_cost(self):
        """Test cost estimation."""
        with patch('shared.embedding.providers.openai._OPENAI_AVAILABLE', True):
            with patch('shared.embedding.providers.openai.OpenAI'):
                with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}):
                    provider = OpenAIProvider(api_key="test-key")
                    cost = provider.estimate_cost("test text with multiple words")
                    assert cost >= 0.0


class TestVoyageProvider:
    """Test Voyage provider."""

    def test_voyage_provider_requires_api_key(self):
        """Test that Voyage provider requires API key."""
        with patch.dict(os.environ, {"VOYAGE_API_KEY": ""}, clear=True):
            with pytest.raises(ValueError, match="Voyage API key required"):
                VoyageProvider()

    @patch('shared.embedding.providers.voyage._VOYAGE_AVAILABLE', True)
    @patch('shared.embedding.providers.voyage.voyageai.Client')
    def test_voyage_sdk_initialization(self, mock_voyage_client_class):
        """Test Voyage SDK initialization."""
        mock_client = Mock()
        mock_voyage_client_class.return_value = mock_client

        with patch.dict(os.environ, {"VOYAGE_API_KEY": "test-key"}):
            provider = VoyageProvider(api_key="test-key", use_sdk=True)

            assert provider.get_provider_name() == "voyage"
            assert provider.get_dimensions() == 1024
            assert provider.get_model_name() == "voyage-3"

    @patch('shared.embedding.providers.voyage._VOYAGE_AVAILABLE', False)
    def test_voyage_http_fallback(self):
        """Test Voyage HTTP fallback when SDK not available."""
        with patch.dict(os.environ, {"VOYAGE_API_KEY": "test-key"}):
            provider = VoyageProvider(api_key="test-key", use_sdk=False)
            assert provider.get_provider_name() == "voyage"

    @patch('shared.embedding.providers.voyage._VOYAGE_AVAILABLE', True)
    @patch('shared.embedding.providers.voyage.voyageai.Client')
    def test_voyage_embed_success(self, mock_voyage_client_class):
        """Test successful Voyage embedding."""
        mock_client = Mock()
        mock_result = Mock()
        mock_result.embeddings = [[0.1] * 1024]
        mock_client.embed.return_value = mock_result
        mock_voyage_client_class.return_value = mock_client

        with patch.dict(os.environ, {"VOYAGE_API_KEY": "test-key"}):
            provider = VoyageProvider(api_key="test-key", use_sdk=True)
            embedding = provider.embed("test text")

            assert len(embedding) == 1024
            mock_client.embed.assert_called_once()

    def test_estimate_cost(self):
        """Test cost estimation."""
        with patch.dict(os.environ, {"VOYAGE_API_KEY": "test-key"}):
            provider = VoyageProvider(api_key="test-key", use_sdk=False)
            cost = provider.estimate_cost("test text")
            assert cost >= 0.0

"""
Tests for core EmbeddingService.

Note: Default dimensions changed to 3072 (OpenAI text-embedding-3-large).
Voyage provider was deprecated.
"""
import os
import pytest
from unittest.mock import Mock, patch

from shared.embedding import EmbeddingService, EmbeddingTelemetry
from shared.embedding.exceptions import EmbeddingError, EmbeddingDimensionMismatchError
from shared.embedding.providers.deterministic import DeterministicProvider


class TestEmbeddingServiceInitialization:
    """Test EmbeddingService initialization."""

    def test_deterministic_provider_forced(self):
        """Test that deterministic provider can be forced."""
        with patch.dict(os.environ, {"EMBEDDING_PROVIDER": "deterministic"}):
            service = EmbeddingService()
            info = service.get_provider_info()
            assert info["provider"] == "deterministic"
            # Dimensions use the default (3072) which deterministic inherits
            assert service.dimensions == 3072

    def test_deterministic_via_forced_provider_param(self):
        """Test forcing deterministic via parameter."""
        service = EmbeddingService(forced_provider="deterministic")
        info = service.get_provider_info()
        assert info["provider"] == "deterministic"

    def test_deterministic_custom_dimensions(self):
        """Test that custom dimensions work with deterministic provider."""
        service = EmbeddingService(dimensions=1024, forced_provider="deterministic")
        info = service.get_provider_info()
        assert info["provider"] == "deterministic"
        assert service.dimensions == 1024

    def test_deterministic_is_always_available(self):
        """Test that deterministic provider is always available as fallback."""
        with patch.dict(os.environ, {
            "OPENAI_API_KEY": "",
            "GPT_API_KEY": "",
            "NOMIC_API_KEY": "",
            "EMBEDDING_PROVIDER": ""
        }, clear=True):
            # Should fall back to deterministic, not raise
            service = EmbeddingService()
            info = service.get_provider_info()
            assert info["provider"] == "deterministic"


class TestEmbeddingServiceEmbed:
    """Test embedding generation."""

    def test_deterministic_embedding(self):
        """Test deterministic embedding generation."""
        with patch.dict(os.environ, {"EMBEDDING_PROVIDER": "deterministic"}):
            service = EmbeddingService(dimensions=10)
            embedding = service.embed("test text")

            assert isinstance(embedding, list)
            assert len(embedding) == 10
            assert all(isinstance(x, float) for x in embedding)

    def test_dimension_consistency(self):
        """Test that embeddings have consistent dimensions."""
        with patch.dict(os.environ, {"EMBEDDING_PROVIDER": "deterministic"}):
            service = EmbeddingService(dimensions=1024)

            emb1 = service.embed("text one")
            emb2 = service.embed("text two")
            emb3 = service.embed("text three")

            assert len(emb1) == len(emb2) == len(emb3) == 1024

    def test_embed_batch(self):
        """Test batch embedding."""
        with patch.dict(os.environ, {"EMBEDDING_PROVIDER": "deterministic"}):
            service = EmbeddingService(dimensions=10)
            texts = ["text one", "text two", "text three"]
            embeddings = service.embed_batch(texts)

            assert len(embeddings) == 3
            assert all(len(emb) == 10 for emb in embeddings)

    def test_dimension_validation_warning(self):
        """Test that dimension mismatches are logged but don't raise by default."""
        with patch.dict(os.environ, {"EMBEDDING_PROVIDER": "deterministic"}):
            service = EmbeddingService(dimensions=10)

            # Mock provider to return wrong dimensions
            mock_provider = Mock(spec=DeterministicProvider)
            mock_provider.embed.return_value = [0.1] * 15  # Wrong dimensions
            mock_provider.get_dimensions.return_value = 10
            mock_provider.get_provider_name.return_value = "deterministic"
            mock_provider.get_model_name.return_value = "deterministic"
            mock_provider.estimate_cost.return_value = 0.0
            service._primary_provider = mock_provider

            # Should log warning but not raise
            embedding = service.embed("test")
            assert len(embedding) == 15  # Returns what provider gave

    def test_dimension_validation_strict_mode(self):
        """Test that strict mode raises error on dimension mismatch."""
        with patch.dict(os.environ, {
            "EMBEDDING_PROVIDER": "deterministic",
            "EMBEDDING_STRICT_DIMENSIONS": "true"
        }):
            service = EmbeddingService(dimensions=10)
            # Clear fallbacks so we get the expected error
            service._fallback_providers = []

            # Mock provider to return wrong dimensions
            mock_provider = Mock(spec=DeterministicProvider)
            mock_provider.embed.return_value = [0.1] * 15  # Wrong dimensions
            mock_provider.get_dimensions.return_value = 10
            mock_provider.get_provider_name.return_value = "deterministic"
            mock_provider.get_model_name.return_value = "deterministic"
            mock_provider.estimate_cost.return_value = 0.0
            service._primary_provider = mock_provider

            # Should raise EmbeddingError wrapping EmbeddingDimensionMismatchError
            with pytest.raises(EmbeddingError):
                service.embed("test")


class TestEmbeddingServiceTelemetry:
    """Test telemetry integration."""

    def test_telemetry_record_success(self):
        """Test that telemetry records successful embeddings."""
        mock_telemetry = Mock(spec=EmbeddingTelemetry)

        with patch.dict(os.environ, {"EMBEDDING_PROVIDER": "deterministic"}):
            service = EmbeddingService(telemetry=mock_telemetry)
            service.embed("test text")

            # Verify telemetry was called
            assert mock_telemetry.record_success.called
            call_args = mock_telemetry.record_success.call_args[1]
            assert "provider" in call_args
            assert "dimensions" in call_args
            assert "latency_ms" in call_args

    def test_telemetry_record_error(self):
        """Test that telemetry records errors."""
        mock_telemetry = Mock(spec=EmbeddingTelemetry)
        mock_provider = Mock()
        mock_provider.embed.side_effect = Exception("Test error")
        mock_provider.get_provider_name.return_value = "test"
        mock_provider.get_model_name.return_value = "test-model"
        mock_provider.estimate_cost.return_value = 0.0

        with patch.dict(os.environ, {"EMBEDDING_PROVIDER": "deterministic"}):
            service = EmbeddingService(telemetry=mock_telemetry)
            service._primary_provider = mock_provider
            service._fallback_providers = []  # No fallbacks

            with pytest.raises(EmbeddingError):
                service.embed("test")

            # Verify telemetry was called
            assert mock_telemetry.record_error.called


class TestEmbeddingServiceProviderInfo:
    """Test provider info method."""

    def test_provider_info_deterministic(self):
        """Test provider info for deterministic."""
        with patch.dict(os.environ, {"EMBEDDING_PROVIDER": "deterministic"}):
            service = EmbeddingService()
            info = service.get_provider_info()

            assert info["provider"] == "deterministic"
            assert info["model"] == "deterministic"
            # Default dimensions is now 3072 (OpenAI default)
            assert info["dimensions"] == 3072
            assert info["has_deterministic"] is True

    def test_provider_info_custom_dimensions(self):
        """Test provider info with custom dimensions."""
        with patch.dict(os.environ, {"EMBEDDING_PROVIDER": "deterministic"}):
            service = EmbeddingService(dimensions=1024)
            info = service.get_provider_info()

            assert info["provider"] == "deterministic"
            assert info["dimensions"] == 1024

    def test_estimate_cost(self):
        """Test cost estimation."""
        with patch.dict(os.environ, {"EMBEDDING_PROVIDER": "deterministic"}):
            service = EmbeddingService()
            cost = service.estimate_cost("test text")
            assert cost == 0.0  # Deterministic is free

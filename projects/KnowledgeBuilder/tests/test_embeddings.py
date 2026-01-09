"""
Tests for KnowledgeBuilder embedding service.

Tests API calls, fallback mechanisms, and dimension handling.
"""
import os
import pytest
import tempfile
from unittest.mock import Mock, patch, MagicMock, PropertyMock
import sys
from pathlib import Path

# Add parent directory to path
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.utils.embeddings import EmbeddingService


class TestEmbeddingServiceInitialization:
    """Test EmbeddingService initialization and provider selection."""

    def test_deterministic_provider_forced(self):
        """Test that deterministic provider can be forced via env var."""
        with patch.dict(os.environ, {"EMBEDDING_PROVIDER": "deterministic"}):
            service = EmbeddingService()
            assert service._provider == "deterministic"
            assert service.dimensions == 1024  # Default Voyage dimensions

    def test_voyage_provider_with_api_key(self):
        """Test that Voyage provider is selected when API key is present."""
        # Test with HTTP fallback (simpler - doesn't require SDK)
        with patch.dict(os.environ, {"VOYAGE_API_KEY": "test-key"}, clear=False):
            with patch('src.utils.embeddings._VOYAGE_AVAILABLE', False):
                # When SDK is not available, should use HTTP fallback
                service = EmbeddingService()
                # Should try to use Voyage HTTP
                assert service._provider == "voyage_http"

    def test_openai_fallback_when_voyage_unavailable(self):
        """Test that OpenAI is used as fallback when Voyage is unavailable."""
        with patch.dict(os.environ, {
            "OPENAI_API_KEY": "test-key",
            "VOYAGE_API_KEY": ""
        }, clear=False):
            with patch('src.utils.embeddings._OPENAI_AVAILABLE', True):
                with patch('src.utils.embeddings.OpenAI') as mock_openai:
                    mock_client_instance = Mock()
                    mock_openai.return_value = mock_client_instance
                    service = EmbeddingService()
                    # Should fallback to OpenAI
                    assert service._provider == "openai"
                    assert service.dimensions == 3072  # OpenAI dimensions
                    assert service.model == "text-embedding-3-large"

    def test_no_provider_raises_error(self):
        """Test that RuntimeError is raised when no provider is available."""
        with patch.dict(os.environ, {
            "VOYAGE_API_KEY": "",
            "OPENAI_API_KEY": "",
            "EMBEDDING_PROVIDER": ""
        }, clear=False):
            with pytest.raises(RuntimeError, match="No embedding provider available"):
                EmbeddingService()


class TestEmbeddingServiceEmbed:
    """Test embedding generation."""

    def test_deterministic_embedding(self):
        """Test that deterministic embeddings are generated correctly."""
        with patch.dict(os.environ, {"EMBEDDING_PROVIDER": "deterministic"}):
            service = EmbeddingService(dimensions=10)
            embedding = service.embed("test text")

            assert isinstance(embedding, list)
            assert len(embedding) == 10
            assert all(isinstance(x, float) for x in embedding)

            # Deterministic embeddings should be reproducible
            embedding2 = service.embed("test text")
            assert embedding == embedding2

    def test_deterministic_embeddings_normalized(self):
        """Test that deterministic embeddings are normalized."""
        with patch.dict(os.environ, {"EMBEDDING_PROVIDER": "deterministic"}):
            service = EmbeddingService(dimensions=10)
            embedding = service.embed("test text")

            # Check normalization (magnitude should be ~1.0)
            magnitude = sum(x * x for x in embedding) ** 0.5
            assert abs(magnitude - 1.0) < 0.01

    def test_different_texts_different_embeddings(self):
        """Test that different texts produce different embeddings."""
        with patch.dict(os.environ, {"EMBEDDING_PROVIDER": "deterministic"}):
            service = EmbeddingService(dimensions=10)
            emb1 = service.embed("text one")
            emb2 = service.embed("text two")

            assert emb1 != emb2

    def test_voyage_sdk_embed_success(self):
        """Test successful Voyage SDK embedding."""
        mock_client = Mock()
        mock_result = Mock()
        mock_result.embeddings = [[0.1] * 1024]  # 1024-dim embedding
        mock_client.embed.return_value = mock_result

        # Create service with deterministic first, then manually set to voyage
        with patch.dict(os.environ, {"EMBEDDING_PROVIDER": "deterministic"}):
            service = EmbeddingService()
            # Manually override to simulate Voyage SDK provider
            service._voyage_client = mock_client
            service._provider = "voyage"
            service._openai_client = None

            embedding = service.embed("test")
            assert len(embedding) == 1024
            mock_client.embed.assert_called_once()

    @patch('src.utils.embeddings._call_voyage_http')
    def test_voyage_http_fallback(self, mock_http_call):
        """Test Voyage HTTP fallback when SDK fails."""
        mock_http_call.return_value = [0.2] * 1024

        with patch.dict(os.environ, {"VOYAGE_API_KEY": "test-key"}):
            service = EmbeddingService()
            service._provider = "voyage_http"
            service._voyage_api_key = "test-key"

            embedding = service.embed("test")
            assert len(embedding) == 1024
            mock_http_call.assert_called_once()

    @patch('src.utils.embeddings._call_voyage_http')
    def test_voyage_http_failure_falls_back_to_openai(self, mock_http_call):
        """Test that Voyage HTTP failure falls back to OpenAI."""
        mock_http_call.return_value = None  # HTTP call fails

        mock_openai_client = Mock()
        mock_response = Mock()
        mock_response.data = [Mock(embedding=[0.3] * 3072)]
        mock_openai_client.embeddings.create.return_value = mock_response

        with patch.dict(os.environ, {"VOYAGE_API_KEY": "test-key", "OPENAI_API_KEY": "test-key"}):
            with patch('src.utils.embeddings._OPENAI_AVAILABLE', True):
                with patch('src.utils.embeddings.OpenAI', return_value=mock_openai_client):
                    service = EmbeddingService()
                    service._provider = "voyage_http"
                    service._voyage_api_key = "test-key"
                    service._openai_client = mock_openai_client

                    embedding = service.embed("test")
                    assert len(embedding) == 3072
                    mock_openai_client.embeddings.create.assert_called_once()

    def test_openai_failure_raises_error(self):
        """Test that OpenAI failure raises RuntimeError (no silent fallback to deterministic)."""
        mock_openai_client = Mock()
        mock_openai_client.embeddings.create.side_effect = Exception("API error")

        # Create service with deterministic provider first, then manually set to OpenAI
        with patch.dict(os.environ, {"EMBEDDING_PROVIDER": "deterministic"}):
            service = EmbeddingService()
            # Manually override to simulate OpenAI provider
            service._provider = "openai"
            service._openai_client = mock_openai_client
            service._voyage_client = None

            with pytest.raises(RuntimeError, match="Embedding failed after provider attempts"):
                service.embed("test")

    def test_all_providers_fail_raises_error(self):
        """Test that RuntimeError is raised when all providers fail."""
        mock_voyage_client = Mock()
        mock_voyage_client.embed.side_effect = Exception("Voyage error")

        mock_openai_client = Mock()
        mock_openai_client.embeddings.create.side_effect = Exception("OpenAI error")

        with patch.dict(os.environ, {"VOYAGE_API_KEY": "test-key", "OPENAI_API_KEY": "test-key"}):
            service = EmbeddingService()
            service._provider = "voyage"
            service._voyage_client = mock_voyage_client
            service._openai_client = mock_openai_client

            with pytest.raises(RuntimeError, match="Embedding failed after provider attempts"):
                service.embed("test")


class TestEmbeddingServiceProviderInfo:
    """Test provider info method."""

    def test_provider_info_deterministic(self):
        """Test provider info for deterministic provider."""
        with patch.dict(os.environ, {"EMBEDDING_PROVIDER": "deterministic"}):
            service = EmbeddingService()
            info = service.get_provider_info()

            assert info["provider"] == "deterministic"
            assert info["model"] == "voyage-3"
            assert info["dimensions"] == 1024
            assert info["has_voyage"] is False
            assert info["has_openai"] is False

    def test_provider_info_voyage(self):
        """Test provider info for Voyage provider."""
        # Use deterministic provider and manually set to voyage for testing
        with patch.dict(os.environ, {"EMBEDDING_PROVIDER": "deterministic"}):
            service = EmbeddingService()
            # Manually set to voyage mode for testing
            service._provider = "voyage"
            service._voyage_client = Mock()
            info = service.get_provider_info()
            assert info["provider"] == "voyage"
            assert info["has_voyage"] is True


class TestEmbeddingServiceDimensions:
    """Test dimension handling across different providers."""

    def test_voyage_dimensions(self):
        """Test that Voyage uses correct dimensions."""
        with patch.dict(os.environ, {"EMBEDDING_PROVIDER": "deterministic"}):
            service = EmbeddingService(dimensions=1024)
            embedding = service.embed("test")
            assert len(embedding) == 1024

    def test_openai_dimensions(self):
        """Test that OpenAI uses correct dimensions."""
        with patch.dict(os.environ, {"EMBEDDING_PROVIDER": "deterministic"}):
            # Simulate OpenAI dimensions
            service = EmbeddingService(dimensions=3072, fallback_dimensions=3072)
            service._provider = "deterministic"
            embedding = service.embed("test")
            assert len(embedding) == 3072

    def test_dimension_consistency(self):
        """Test that embeddings from same provider have consistent dimensions."""
        with patch.dict(os.environ, {"EMBEDDING_PROVIDER": "deterministic"}):
            service = EmbeddingService(dimensions=1024)

            emb1 = service.embed("text one")
            emb2 = service.embed("text two")
            emb3 = service.embed("text three")

            assert len(emb1) == len(emb2) == len(emb3) == 1024


class TestEmbeddingServiceIntegration:
    """Integration tests with SimplePipeline."""

    def test_pipeline_uses_correct_dimensions(self, tmp_path):
        """Test that SimplePipeline initializes LanceDB with correct dimensions."""
        pytest.importorskip("lancedb")

        with patch.dict(os.environ, {"EMBEDDING_PROVIDER": "deterministic"}):
            from src.pipeline.simple_pipeline import SimplePipeline

            pipeline = SimplePipeline()

            # Check that embedder dimensions match
            assert pipeline.embedder.dimensions == 1024

            # Test embedding generation
            embedding = pipeline.embedder.embed("test entity")
            assert len(embedding) == 1024

    def test_pipeline_embeds_entity(self, tmp_path):
        """Test that pipeline can embed an entity successfully."""
        pytest.importorskip("lancedb")

        with patch.dict(os.environ, {"EMBEDDING_PROVIDER": "deterministic"}):
            from src.pipeline.simple_pipeline import SimplePipeline
            from src.storage.lancedb_client import LanceDBClient

            # Create temporary LanceDB
            lancedb_path = tmp_path / "test_lancedb"
            lancedb_path.mkdir()

            embedder = EmbeddingService(dimensions=10)  # Small for testing
            lance_client = LanceDBClient(
                uri=str(lancedb_path),
                vector_dim=10,
                table_name="test_entities"
            )

            pipeline = SimplePipeline(
                embedding_service=embedder,
                lancedb_client=lance_client
            )

            # Mock collector to return test data
            with patch.object(pipeline.collector, 'collect') as mock_collect:
                mock_collect.return_value = {
                    "attributes": {"summary": "Test entity description"},
                    "confidence": 0.9
                }

                result = pipeline.collect_and_store("Test Entity", "Person")

                assert "embedding" in result
                assert len(result["embedding"]) == 10
                assert "entity" in result


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

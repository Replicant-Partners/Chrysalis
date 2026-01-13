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
        """Deterministic mode should be honored via env var."""
        with patch.dict(os.environ, {"EMBEDDING_PROVIDER": "deterministic"}):
            service = EmbeddingService()
            assert service._provider == "deterministic"
            # Default dimensions now follow the OpenAI primary (3072)
            assert service.dimensions == 3072

    def test_default_dimensions_match_primary_model(self):
        """Even without overrides, deterministic fallback should inherit 3072 dims."""
        with patch.dict(os.environ, {"EMBEDDING_PROVIDER": "deterministic"}, clear=False):
            service = EmbeddingService()
            assert service.dimensions == 3072

    def test_provider_mapping_handles_nomic(self):
        """Wrapper should translate shared provider info to legacy _provider values."""
        with patch.dict(os.environ, {"EMBEDDING_PROVIDER": "deterministic"}):
            service = EmbeddingService()
            # Simulate a nomic provider being selected downstream
            service._nomic_provider = Mock()
            with patch.object(service, 'get_provider_info', return_value={"provider": "nomic"}):
                # Re-run mapping logic
                service.__init__()
                assert service._provider == "nomic"


class TestEmbeddingServiceEmbed:
    """Test deterministic embedding generation (the only mode exercised in CI)."""

    def test_deterministic_embedding(self):
        with patch.dict(os.environ, {"EMBEDDING_PROVIDER": "deterministic"}):
            service = EmbeddingService(dimensions=12)
            embedding = service.embed("test text")

            assert isinstance(embedding, list)
            assert len(embedding) == 12
            assert all(isinstance(x, float) for x in embedding)
            assert service._provider == "deterministic"

            # Deterministic embeddings should be reproducible
            embedding2 = service.embed("test text")
            assert embedding == embedding2

    def test_deterministic_embeddings_normalized(self):
        with patch.dict(os.environ, {"EMBEDDING_PROVIDER": "deterministic"}):
            service = EmbeddingService(dimensions=16)
            embedding = service.embed("test text")

            magnitude = sum(x * x for x in embedding) ** 0.5
            assert abs(magnitude - 1.0) < 0.01

    def test_different_texts_different_embeddings(self):
        with patch.dict(os.environ, {"EMBEDDING_PROVIDER": "deterministic"}):
            service = EmbeddingService(dimensions=20)
            emb1 = service.embed("text one")
            emb2 = service.embed("text two")

            assert emb1 != emb2


class TestEmbeddingServiceProviderInfo:
    """Test provider info method."""

    def test_provider_info_deterministic(self):
        with patch.dict(os.environ, {"EMBEDDING_PROVIDER": "deterministic"}):
            service = EmbeddingService()
            info = service.get_provider_info()

            assert info["provider"] == "deterministic"
            assert info["model"] == "text-embedding-3-large"
            assert info["dimensions"] == 3072
            assert info.get("has_openai") is False


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

"""
Tests for Fireproof integration.

Tests cover:
- FireproofService CRUD operations
- Document schemas and validation
- CRDT merge behavior
- Beads promotion hook
- Zep sync adapter
- Metadata capture
- FusionRetriever integration
"""

import asyncio
import pytest
import pytest_asyncio
import time
from typing import Any, Dict, List, Optional
from unittest.mock import AsyncMock, MagicMock, patch

from memory_system.fireproof.config import FireproofConfig
from memory_system.fireproof.service import FireproofService
from memory_system.fireproof.schemas import (
    DocumentType,
    DurableBead,
    EmbeddingRef,
    LocalMemory,
    PromptMetadata,
    SyncStatus,
    migrate_document,
    validate_document,
)
from memory_system.fireproof.hooks import (
    BeadPromotionHook,
    EmbeddingCacheHook,
    PromptMetadataCapture,
    RetrievalSourceInfo,
)
from memory_system.fireproof.sync import FireproofZepSync, SyncResult


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def config():
    """Test configuration with in-memory storage."""
    return FireproofConfig.for_testing()


@pytest_asyncio.fixture
async def fireproof(config):
    """Initialized FireproofService instance."""
    service = FireproofService(config=config)
    await service.initialize()
    yield service
    await service.close()


@pytest.fixture
def mock_zep_hooks():
    """Mock ZepHooks for testing sync."""
    mock = MagicMock()
    mock.on_store_embedding = MagicMock(return_value={"status": "ok"})
    mock.on_retrieve_embeddings = MagicMock(return_value=[])
    return mock


# ============================================================================
# Schema Tests
# ============================================================================

class TestSchemas:
    """Tests for document schemas."""
    
    def test_durable_bead_from_bead(self):
        """Test creating DurableBead from bead data."""
        bead = DurableBead.from_bead(
            bead_id="test-123",
            content="Hello world",
            role="user",
            importance=0.8,
            span_refs=["span-1"],
            metadata={"key": "value"},
        )
        
        assert bead.original_bead_id == "test-123"
        assert bead.content == "Hello world"
        assert bead.role == "user"
        assert bead.importance == 0.8
        assert bead.type == DocumentType.BEAD.value
        # Promoted beads default to PENDING for sync to Zep
        assert bead.sync_status == SyncStatus.PENDING.value
    
    def test_durable_bead_from_bead_with_sync_status(self):
        """Test creating DurableBead with explicit sync_status."""
        bead = DurableBead.from_bead(
            bead_id="test-local",
            content="Local only",
            sync_status=SyncStatus.LOCAL.value,
        )
        
        assert bead.sync_status == SyncStatus.LOCAL.value
    
    def test_local_memory_access_count(self):
        """Test LocalMemory access tracking."""
        memory = LocalMemory(content="Test memory")
        assert memory.access_count == 0
        
        memory.record_access()
        assert memory.access_count == 1
        assert memory.last_accessed > 0
    
    def test_prompt_metadata_hash(self):
        """Test prompt hash generation."""
        hash1 = PromptMetadata.hash_prompt("Hello world")
        hash2 = PromptMetadata.hash_prompt("Hello world")
        hash3 = PromptMetadata.hash_prompt("Different text")
        
        assert hash1 == hash2
        assert hash1 != hash3
        assert len(hash1) == 16
    
    def test_prompt_metadata_complete(self):
        """Test completing prompt metadata."""
        meta = PromptMetadata(session_id="session-1", model="test-model")
        time.sleep(0.01)  # Small delay
        
        meta.complete(tokens_out=100, score=4.5)
        
        assert meta.tokens_out == 100
        assert meta.score == 4.5
        assert meta.completed_at > meta.created_at
        assert meta.latency_ms > 0
        assert meta.sync_status == SyncStatus.PENDING.value
    
    def test_embedding_ref_cache_small_vector(self):
        """Test embedding caching for small vectors."""
        small_vector = [0.1] * 100  # 800 bytes (< 10KB threshold)
        
        ref = EmbeddingRef.create(
            text="Test text",
            model="test-model",
            dimensions=100,
            vector=small_vector,
        )
        
        assert ref.local_cache == small_vector
    
    def test_embedding_ref_no_cache_large_vector(self):
        """Test embedding not cached for large vectors."""
        large_vector = [0.1] * 2000  # 16KB (> 10KB threshold)
        
        ref = EmbeddingRef.create(
            text="Test text",
            model="test-model",
            dimensions=2000,
            vector=large_vector,
            cache_threshold_bytes=10240,
        )
        
        assert ref.local_cache is None
    
    def test_validate_document_valid(self):
        """Test document validation with valid document."""
        doc = {
            "_id": "test-id",
            "type": "bead",
            "created_at": time.time(),
        }
        assert validate_document(doc) is True
    
    def test_validate_document_missing_field(self):
        """Test document validation with missing field."""
        doc = {"_id": "test-id", "created_at": time.time()}
        
        with pytest.raises(ValueError, match="Missing required field"):
            validate_document(doc)
    
    def test_migrate_document(self):
        """Test document migration."""
        old_doc = {"_id": "test", "content": "hello", "created_at": time.time()}
        
        migrated = migrate_document(old_doc)
        
        assert migrated["type"] == DocumentType.BEAD.value
        assert migrated["sync_status"] == SyncStatus.LOCAL.value
        assert "version" in migrated


# ============================================================================
# FireproofService Tests
# ============================================================================

class TestFireproofService:
    """Tests for FireproofService."""
    
    @pytest.mark.asyncio
    async def test_put_and_get(self, fireproof):
        """Test basic put and get operations."""
        doc = {
            "type": "bead",
            "content": "Test content",
            "importance": 0.8,
        }
        
        doc_id = await fireproof.put(doc)
        assert doc_id is not None
        
        retrieved = await fireproof.get(doc_id)
        assert retrieved is not None
        assert retrieved["content"] == "Test content"
        assert retrieved["importance"] == 0.8
    
    @pytest.mark.asyncio
    async def test_delete(self, fireproof):
        """Test document deletion."""
        doc = {"type": "bead", "content": "To delete"}
        doc_id = await fireproof.put(doc)
        
        deleted = await fireproof.delete(doc_id)
        assert deleted is True
        
        retrieved = await fireproof.get(doc_id)
        assert retrieved is None
    
    @pytest.mark.asyncio
    async def test_query_by_type(self, fireproof):
        """Test querying documents by type."""
        # Insert multiple documents
        await fireproof.put({"type": "bead", "content": "Bead 1"})
        await fireproof.put({"type": "bead", "content": "Bead 2"})
        await fireproof.put({"type": "memory", "content": "Memory 1"})
        
        # Query beads
        beads = await fireproof.query("type", {"key": "bead"})
        assert len(beads) == 2
        
        # Query memories
        memories = await fireproof.query("type", {"key": "memory"})
        assert len(memories) == 1
    
    @pytest.mark.asyncio
    async def test_query_descending(self, fireproof):
        """Test querying with descending order."""
        # Insert with specific timestamps
        await fireproof.put({"type": "bead", "content": "First", "created_at": 100})
        await fireproof.put({"type": "bead", "content": "Second", "created_at": 200})
        await fireproof.put({"type": "bead", "content": "Third", "created_at": 300})
        
        # Query descending
        results = await fireproof.query("created_at", {"descending": True, "limit": 3})
        
        assert len(results) == 3
        assert results[0]["content"] == "Third"
        assert results[2]["content"] == "First"
    
    @pytest.mark.asyncio
    async def test_query_pending(self, fireproof):
        """Test querying pending documents."""
        await fireproof.put({"type": "bead", "content": "Pending", "sync_status": "pending"})
        await fireproof.put({"type": "bead", "content": "Synced", "sync_status": "synced"})
        
        pending = await fireproof.query_pending()
        
        # All new documents start as pending
        assert len(pending) >= 1
    
    @pytest.mark.asyncio
    async def test_count(self, fireproof):
        """Test document counting."""
        initial_count = await fireproof.count()
        
        await fireproof.put({"type": "bead", "content": "Doc 1"})
        await fireproof.put({"type": "bead", "content": "Doc 2"})
        
        new_count = await fireproof.count()
        assert new_count == initial_count + 2
        
        # Count by type
        bead_count = await fireproof.count(doc_type="bead")
        assert bead_count == 2
    
    @pytest.mark.asyncio
    async def test_crdt_merge_arrays(self, fireproof):
        """Test CRDT merge for array fields."""
        # Create initial document
        doc_id = await fireproof.put({
            "type": "bead",
            "content": "Test",
            "tags": ["tag1", "tag2"],
        })
        
        # Update with overlapping tags
        await fireproof.put({
            "_id": doc_id,
            "type": "bead",
            "content": "Test",
            "tags": ["tag2", "tag3"],
        })
        
        merged = await fireproof.get(doc_id)
        
        # Arrays should be unioned
        assert set(merged["tags"]) == {"tag1", "tag2", "tag3"}
    
    @pytest.mark.asyncio
    async def test_crdt_merge_counters(self, fireproof):
        """Test CRDT merge for counter fields."""
        doc_id = await fireproof.put({
            "type": "memory",
            "content": "Test",
            "access_count": 5,
        })
        
        # Update with different count
        await fireproof.put({
            "_id": doc_id,
            "type": "memory",
            "content": "Test",
            "access_count": 10,
        })
        
        merged = await fireproof.get(doc_id)
        
        # Counter should take max
        assert merged["access_count"] == 10
    
    @pytest.mark.asyncio
    async def test_put_bead_typed(self, fireproof):
        """Test typed bead storage."""
        bead = DurableBead.from_bead(
            bead_id="original-123",
            content="Test bead",
            role="assistant",
            importance=0.9,
        )
        
        doc_id = await fireproof.put_bead(bead)
        retrieved = await fireproof.get(doc_id)
        
        assert retrieved["original_bead_id"] == "original-123"
        assert retrieved["role"] == "assistant"
    
    @pytest.mark.asyncio
    async def test_query_beads(self, fireproof):
        """Test querying beads with importance filter."""
        await fireproof.put_bead(DurableBead.from_bead("b1", "Low", "user", 0.3))
        await fireproof.put_bead(DurableBead.from_bead("b2", "High", "user", 0.8))
        await fireproof.put_bead(DurableBead.from_bead("b3", "Medium", "user", 0.5))
        
        # Query with min importance
        high_importance = await fireproof.query_beads(limit=10, min_importance=0.7)
        
        assert len(high_importance) == 1
        assert high_importance[0]["content"] == "High"
    
    @pytest.mark.asyncio
    async def test_export_import(self, fireproof):
        """Test export and import functionality."""
        # Add documents
        await fireproof.put({"type": "bead", "content": "Doc 1"})
        await fireproof.put({"type": "bead", "content": "Doc 2"})
        
        # Export
        exported = await fireproof.export_all()
        assert len(exported) == 2
        
        # Create new service and import
        new_config = FireproofConfig.for_testing()
        new_service = FireproofService(config=new_config)
        await new_service.initialize()
        
        imported_count = await new_service.import_documents(exported)
        assert imported_count == 2
        
        # Verify
        count = await new_service.count()
        assert count == 2
        
        await new_service.close()


# ============================================================================
# Hooks Tests
# ============================================================================

class TestPromptMetadataCapture:
    """Tests for PromptMetadataCapture hook."""
    
    @pytest.mark.asyncio
    async def test_capture_async_success(self, fireproof):
        """Test async metadata capture on success."""
        capture = PromptMetadataCapture(fireproof)
        
        async with capture.capture_async(
            session_id="session-1",
            model="test-model",
            tokens_in=100,
        ) as meta:
            meta.tokens_out = 50
            meta.score = 4.0
        
        # Verify saved
        results = await fireproof.query_metadata(session_id="session-1")
        assert len(results) == 1
        assert results[0]["tokens_out"] == 50
        assert results[0]["latency_ms"] > 0
    
    @pytest.mark.asyncio
    async def test_capture_async_error(self, fireproof):
        """Test async metadata capture on error."""
        capture = PromptMetadataCapture(fireproof)
        
        with pytest.raises(ValueError):
            async with capture.capture_async(
                session_id="session-error",
                model="test-model",
            ) as meta:
                raise ValueError("Test error")
        
        # Verify error captured
        results = await fireproof.query_metadata(session_id="session-error")
        assert len(results) == 1
        assert results[0]["error"] == "Test error"
    
    @pytest.mark.asyncio
    async def test_get_session_stats(self, fireproof):
        """Test session statistics aggregation."""
        capture = PromptMetadataCapture(fireproof)
        
        # Create multiple interactions
        for i in range(3):
            meta = PromptMetadata(
                session_id="stats-session",
                model="test-model",
                tokens_in=100,
                tokens_out=50 * (i + 1),
                score=float(i + 3),
            )
            await fireproof.put_metadata(meta)
        
        stats = await capture.get_session_stats("stats-session")
        
        assert stats["interaction_count"] == 3
        assert stats["total_tokens_in"] == 300
        assert stats["avg_score"] == 4.0  # (3 + 4 + 5) / 3


class TestBeadPromotionHook:
    """Tests for BeadPromotionHook."""
    
    @pytest.mark.asyncio
    async def test_promote_high_importance(self, fireproof):
        """Test promoting high-importance bead."""
        hook = BeadPromotionHook(fireproof, threshold=0.7, async_mode=False)
        
        bead_data = {
            "bead_id": "test-bead",
            "content": "Important content",
            "role": "assistant",
            "importance": 0.9,
        }
        
        doc_id = await hook.promote(bead_data)
        
        assert doc_id is not None
        assert hook.promotion_count == 1
        
        # Verify stored
        doc = await fireproof.get(doc_id)
        assert doc["content"] == "Important content"
    
    @pytest.mark.asyncio
    async def test_skip_low_importance(self, fireproof):
        """Test skipping low-importance bead."""
        hook = BeadPromotionHook(fireproof, threshold=0.7)
        
        bead_data = {
            "bead_id": "test-bead",
            "content": "Low importance",
            "importance": 0.5,
        }
        
        doc_id = await hook.promote(bead_data)
        
        assert doc_id is None
        assert hook.promotion_count == 0


class TestEmbeddingCacheHook:
    """Tests for EmbeddingCacheHook."""
    
    @pytest.mark.asyncio
    async def test_cache_and_retrieve_embedding(self, fireproof):
        """Test caching and retrieving embedding."""
        hook = EmbeddingCacheHook(fireproof)
        
        text = "Test embedding text"
        vector = [0.1, 0.2, 0.3, 0.4, 0.5]
        
        doc_id = await hook.cache_embedding(
            text=text,
            vector=vector,
            model="test-model",
        )
        
        assert doc_id is not None
        
        # Retrieve
        cached = await hook.get_cached_embedding(text)
        assert cached == vector


# ============================================================================
# Sync Tests
# ============================================================================

class TestFireproofZepSync:
    """Tests for Fireproof-Zep synchronization."""
    
    @pytest.mark.asyncio
    async def test_sync_pending_documents(self, fireproof, mock_zep_hooks):
        """Test syncing pending documents."""
        # Add pending document
        await fireproof.put({
            "type": "memory",
            "content": "Test memory",
            "sync_status": "pending",
        })
        
        # Create sync adapter
        config = FireproofConfig(sync_enabled=True, sync_gateway="http://test")
        sync = FireproofZepSync(fireproof, mock_zep_hooks, config)
        
        # Sync
        result = await sync.sync_now()
        
        assert result.success
        assert result.synced_count >= 1
    
    @pytest.mark.asyncio
    async def test_sync_stats_tracking(self, fireproof, mock_zep_hooks):
        """Test sync statistics tracking."""
        config = FireproofConfig(sync_enabled=True, sync_gateway="http://test")
        sync = FireproofZepSync(fireproof, mock_zep_hooks, config)
        
        # Initial stats
        assert sync.stats.total_synced == 0
        
        # Add and sync
        await fireproof.put({"type": "bead", "content": "Test"})
        await sync.sync_now()
        
        # Check stats updated
        assert sync.stats.last_sync_time > 0
        assert sync.stats.last_sync_duration_ms > 0


# ============================================================================
# Integration Tests
# ============================================================================

class TestBeadsServiceIntegration:
    """Tests for BeadsService with Fireproof promotion."""
    
    @pytest.mark.asyncio
    async def test_beads_promotion_hook_integration(self, fireproof):
        """Test BeadsService with Fireproof promotion hook."""
        from memory_system.beads import BeadsService
        from memory_system.fireproof.hooks import BeadPromotionHook
        
        hook = BeadPromotionHook(fireproof, threshold=0.7, async_mode=False)
        
        beads = BeadsService(
            path=":memory:",
            promotion_hook=hook.promote,
            promotion_threshold=0.7,
            promotion_async=False,
        )
        
        # Add low importance bead
        beads.append("Low importance", importance=0.5)
        
        # Add high importance bead
        beads.append("High importance", importance=0.9)
        
        # Small delay for async operations
        await asyncio.sleep(0.1)
        
        # Check promotion count
        # Note: sync vs async timing may vary
        fp_beads = await fireproof.query_beads(limit=10)
        assert len(fp_beads) >= 1


class TestFusionRetrieverIntegration:
    """Tests for FusionRetriever with Fireproof."""
    
    @pytest.mark.asyncio
    async def test_fusion_retrieve_with_fireproof(self, fireproof):
        """Test FusionRetriever retrieve with Fireproof tier."""
        from memory_system.beads import BeadsService
        from memory_system.fusion import FusionRetriever
        
        beads = BeadsService(path=":memory:")
        fusion = FusionRetriever(
            beads=beads,
            fireproof=fireproof,
        )
        
        # Add data to both tiers
        beads.append("Recent bead content", importance=0.5)
        
        await fireproof.put_bead(DurableBead.from_bead(
            "fp-1", "Durable content", "assistant", 0.9
        ))
        
        # Retrieve
        result = await fusion.retrieve_async("test query")
        
        assert "beads" in result
        assert "fireproof" in result
        assert len(result["beads"]) >= 1
        assert len(result["fireproof"]) >= 1
    
    @pytest.mark.asyncio
    async def test_fusion_ingest_with_promotion(self, fireproof):
        """Test FusionRetriever ingest with Fireproof promotion."""
        from memory_system.beads import BeadsService
        from memory_system.fusion import FusionRetriever
        
        beads = BeadsService(path=":memory:")
        fusion = FusionRetriever(
            beads=beads,
            fireproof=fireproof,
        )
        
        # Ingest with promotion
        result = fusion.ingest(
            content="Important content",
            importance=0.9,
            promote_to_fireproof=True,
        )
        
        assert "bead_id" in result
        
        # Small delay for async save
        await asyncio.sleep(0.1)
        
        # Check Fireproof
        fp_docs = await fireproof.query_beads(limit=10)
        assert len(fp_docs) >= 1


# ============================================================================
# Config Tests
# ============================================================================

class TestFireproofConfig:
    """Tests for FireproofConfig."""
    
    def test_for_testing_config(self):
        """Test testing configuration."""
        config = FireproofConfig.for_testing()
        
        assert config.enabled is True
        assert config.sync_enabled is False
        assert config.db_path == ":memory:"
    
    def test_minimal_config(self):
        """Test minimal configuration."""
        config = FireproofConfig.minimal()
        
        assert config.enabled is True
        assert config.promotion_enabled is False
        assert config.metadata_capture is False
    
    def test_validation_invalid_threshold(self):
        """Test config validation with invalid threshold."""
        config = FireproofConfig(promotion_threshold=1.5)
        
        with pytest.raises(ValueError, match="promotion_threshold"):
            config.validate()
    
    def test_validation_sync_without_gateway(self):
        """Test config validation - sync without gateway."""
        config = FireproofConfig(sync_enabled=True, sync_gateway=None)
        
        with pytest.raises(ValueError, match="sync_gateway"):
            config.validate()


# ============================================================================
# Security Tests
# ============================================================================

class TestSecurity:
    """Tests for security measures."""
    
    @pytest.mark.asyncio
    async def test_query_field_validation(self, fireproof):
        """Test that invalid field names are rejected."""
        # Valid field - should work
        await fireproof.query("type", {"key": "bead"})
        
        # Invalid field - should raise ValueError
        with pytest.raises(ValueError, match="Invalid field name"):
            await fireproof.query("'; DROP TABLE documents; --", {"key": "test"})
    
    @pytest.mark.asyncio
    async def test_query_filter_field_validation(self, fireproof):
        """Test that invalid filter field names are rejected."""
        with pytest.raises(ValueError, match="Invalid field name"):
            await fireproof.query("type", {
                "key": "bead",
                "filter": {"malicious_field": "value"}
            })


# ============================================================================
# Offline Fallback Tests
# ============================================================================

class TestOfflineFallback:
    """Tests for offline fallback functionality."""
    
    @pytest.mark.asyncio
    async def test_fusion_retriever_zep_fallback(self, fireproof):
        """Test FusionRetriever falls back to Fireproof when Zep fails."""
        from memory_system.beads import BeadsService
        from memory_system.fusion import FusionRetriever
        
        # Create Fireproof config with local vector cache enabled
        config = FireproofConfig.for_testing()
        config.local_vector_cache = True
        
        # Create new fireproof service with cache enabled
        fp_service = FireproofService(config=config)
        await fp_service.initialize()
        
        beads = BeadsService(path=":memory:")
        
        # Mock embedder that returns fixed vector
        mock_embedder = MagicMock()
        mock_embedder.embed = MagicMock(return_value=[0.1, 0.2, 0.3, 0.4, 0.5])
        mock_embedder.model_name = "test-model"
        
        # Mock Zep hooks that fail
        mock_zep = MagicMock()
        mock_zep.on_retrieve_embeddings = MagicMock(
            side_effect=Exception("Zep unavailable")
        )
        
        fusion = FusionRetriever(
            beads=beads,
            embedder=mock_embedder,
            zep_hooks=mock_zep,
            fireproof=fp_service,
        )
        
        # Cache some embeddings locally
        await fp_service.store_embedding(
            doc_id="test-doc-1",
            text_hash="hash1",
            vector=[0.1, 0.2, 0.3, 0.4, 0.5],
            model="test-model",
        )
        await fp_service.put({
            "type": "bead",
            "content": "Test fallback content",
            "_id": "test-doc-1",
        })
        
        # Retrieve should fall back to Fireproof
        result = await fusion.retrieve_async("test query")
        
        assert result["used_fallback"] is True
        
        await fp_service.close()
    
    @pytest.mark.asyncio
    async def test_retrieve_async_context_warning(self, fireproof):
        """Test that sync retrieve warns when called from async context."""
        from memory_system.beads import BeadsService
        from memory_system.fusion import FusionRetriever
        
        beads = BeadsService(path=":memory:")
        fusion = FusionRetriever(beads=beads, fireproof=fireproof)
        
        # Call sync method from async context
        result = fusion.retrieve("test query")
        
        # Should have warning flag
        assert result.get("async_context_warning") is True


# ============================================================================
# AgentMemoryFactory Integration Tests
# ============================================================================

class TestAgentMemoryFactory:
    """Tests for AgentMemoryFactory integration pathway.
    
    These tests validate the complete path from AgentMemoryConfig
    through AgentMemoryFactory to working FusionRetriever instances.
    """
    
    @pytest.mark.asyncio
    async def test_create_from_config_beads_only(self):
        """Test creating services with BeadsService only (minimal config)."""
        from memory_system.agent_adapter import AgentMemoryConfig, AgentMemoryFactory

        config = AgentMemoryConfig(
            agent_id="test-agent-v1",
            agent_name="test-agent",
            bead_capacity=25,
            fireproof_enabled=False,
        )

        factory = AgentMemoryFactory()
        services = await factory.create_from_config(config)

        try:
            assert services.beads is not None
            assert services.fireproof is None
            assert services.fusion is not None

            # Test beads service works
            services.beads.append("Test content", importance=0.5)
            assert list(services.beads.recent())

            # Test fusion retrieval works
            result = await services.fusion.retrieve_async("test query")
            assert "beads" in result
        finally:
            await services.close()
    
    @pytest.mark.asyncio
    async def test_create_from_config_with_fireproof(self):
        """Test creating services with Fireproof enabled."""
        from memory_system.agent_adapter import AgentMemoryConfig, AgentMemoryFactory
        from memory_system.fireproof.config import FireproofConfig
        
        fp_config = FireproofConfig.for_testing()
        
        config = AgentMemoryConfig(
            agent_id="fp-agent-v1",
            agent_name="fp-agent",
            bead_capacity=30,
            fireproof_enabled=True,
            fireproof_config=fp_config,
        )
        
        factory = AgentMemoryFactory()
        services = await factory.create_from_config(config)
        
        try:
            assert services.beads is not None
            assert services.fireproof is not None
            assert services.fusion is not None
            
            # Test Fireproof is initialized and functional
            doc_id = await services.fireproof.put({
                "type": "bead",
                "content": "Test content",
            })
            assert doc_id is not None
            
            # Test fusion includes Fireproof in retrieval
            result = await services.fusion.retrieve_async("test")
            assert "fireproof" in result
        finally:
            await services.close()
    
    @pytest.mark.asyncio
    async def test_promotion_hook_wiring(self):
        """Test that promotion hook is correctly wired when Fireproof enabled."""
        from memory_system.agent_adapter import AgentMemoryConfig, AgentMemoryFactory
        from memory_system.fireproof.config import FireproofConfig
        
        fp_config = FireproofConfig.for_testing()
        fp_config.promotion_enabled = True
        fp_config.promotion_threshold = 0.7
        
        config = AgentMemoryConfig(
            agent_id="hook-test-v1",
            agent_name="hook-test",
            bead_capacity=20,
            fireproof_enabled=True,
            fireproof_config=fp_config,
        )
        
        factory = AgentMemoryFactory()
        services = await factory.create_from_config(config)
        
        try:
            # Verify promotion hook is attached to beads
            assert services.beads.promotion_hook is not None
            
            # Add high-importance bead - should trigger promotion
            services.beads.append(
                "High importance content for promotion",
                importance=0.95,
            )
            
            # Allow async promotion to complete
            await asyncio.sleep(0.2)
            
            # Check Fireproof received the promoted bead
            beads = await services.fireproof.query_beads(limit=10)
            assert len(beads) >= 1
            assert any("promotion" in b.get("content", "") for b in beads)
        finally:
            await services.close()
    
    @pytest.mark.asyncio
    async def test_agent_memory_context_lifecycle(self):
        """Test AgentMemoryContext lifecycle management."""
        from memory_system.agent_adapter import AgentMemoryConfig, AgentMemoryContext, AgentMemoryFactory
        from memory_system.fireproof.config import FireproofConfig
        from unittest.mock import MagicMock
        
        # Create mock AgentSpec
        mock_spec = MagicMock()
        mock_spec.metadata.name = "lifecycle-agent"
        mock_spec.metadata.version = "1.0"
        mock_spec.capabilities.memory = None  # Use defaults
        
        fp_config = FireproofConfig.for_testing()
        override = AgentMemoryConfig(
            agent_id="lifecycle-v1",
            agent_name="lifecycle-agent",
            fireproof_enabled=True,
            fireproof_config=fp_config,
        )
        
        context = AgentMemoryContext(
            spec=mock_spec,
            config_override=override,
        )
        
        # Test not initialized
        assert not context.is_initialized
        
        # Initialize
        services = await context.initialize()
        assert context.is_initialized
        assert services.beads is not None
        assert services.fireproof is not None
        
        # Test convenience properties
        assert context.beads is services.beads
        assert context.fireproof is services.fireproof
        assert context.fusion is services.fusion
        
        # Shutdown
        await context.shutdown()
        assert not context.is_initialized
    
    @pytest.mark.asyncio
    async def test_agent_memory_context_as_context_manager(self):
        """Test AgentMemoryContext as async context manager."""
        from memory_system.agent_adapter import AgentMemoryConfig, AgentMemoryContext
        from memory_system.fireproof.config import FireproofConfig
        from unittest.mock import MagicMock
        
        mock_spec = MagicMock()
        mock_spec.metadata.name = "ctx-manager-agent"
        mock_spec.metadata.version = "1.0"
        mock_spec.capabilities.memory = None
        
        override = AgentMemoryConfig(
            agent_id="ctx-v1",
            agent_name="ctx-manager-agent",
            fireproof_enabled=True,
            fireproof_config=FireproofConfig.for_testing(),
        )
        
        async with AgentMemoryContext(mock_spec, config_override=override) as context:
            assert context.is_initialized
            
            # Use the services
            context.beads.append("Test via context manager", importance=0.6)
            result = await context.fusion.retrieve_async("test")
            assert "beads" in result
        
        # Should be shut down after exiting context
        assert not context.is_initialized
    
    def test_create_minimal_memory_beads_only(self):
        """Test create_minimal_memory_sync utility without Fireproof."""
        from memory_system.agent_adapter import create_minimal_memory_sync
        
        # Use the sync version for beads-only (no Fireproof)
        fusion = create_minimal_memory_sync(
            agent_id="minimal-agent",
            bead_capacity=15,
        )
        
        assert fusion is not None
        
        # Test basic operation
        result = fusion.ingest("Test minimal content", importance=0.5)
        assert "bead_id" in result
        
        # Sync retrieve
        retrieved = fusion.retrieve("test")
        assert "beads" in retrieved
    
    @pytest.mark.asyncio
    async def test_create_minimal_memory_with_fireproof(self):
        """Test create_minimal_memory utility with Fireproof enabled."""
        from memory_system.agent_adapter import create_minimal_memory
        
        # Use async version which auto-initializes Fireproof
        fusion = await create_minimal_memory(
            agent_id="minimal-fp-agent",
            bead_capacity=20,
            enable_fireproof=True,
        )
        
        assert fusion is not None
        assert fusion.fireproof is not None
        
        try:
            # Test ingest with promotion
            result = fusion.ingest(
                "High importance for promotion",
                importance=0.95,
                promote_to_fireproof=True,
            )
            assert "bead_id" in result
            
            # Allow promotion
            await asyncio.sleep(0.2)
            
            # Check retrieval includes Fireproof
            retrieved = await fusion.retrieve_async("test")
            assert "fireproof" in retrieved
        finally:
            await fusion.fireproof.close()


# ============================================================================
# Run tests
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])

"""
Fireproof integration for Chrysalis memory system.

Provides a local-first, CRDT-friendly document store that bridges
BeadsService (short-term) and Zep (long-term) memory layers.

Usage:
    from memory_system.fireproof import FireproofService, FireproofConfig
    
    service = FireproofService(config=FireproofConfig(db_name="chrysalis"))
    await service.initialize()
    
    # Store a document
    doc_id = await service.put({"type": "bead", "content": "hello"})
    
    # Query documents
    results = await service.query("type", {"key": "bead", "limit": 10})
    
    # Bead promotion hook for BeadsService
    from memory_system.fireproof import BeadPromotionHook
    hook = BeadPromotionHook(service, threshold=0.7)

See Also:
    - :doc:`/docs/FIREPROOF_INTEGRATION_PROPOSAL` for architecture details
    - :mod:`memory_system.crdt_merge` for CRDT pattern reference
"""

from .schemas import (
    FireproofDocument,
    DurableBead,
    LocalMemory,
    PromptMetadata,
    EmbeddingRef,
    SyncStatus,
    DocumentType,
)
from .config import FireproofConfig
from .service import FireproofService
from .sync import FireproofZepSync, SyncResult, SyncStats, SyncHealthCheck
from .hooks import (
    PromptMetadataCapture,
    BeadPromotionHook,
    EmbeddingCacheHook,
    RetrievalSourceInfo,
    create_promotion_hook,
    # Protocol types
    PromotionHookProtocol,
    AsyncPromotionHookProtocol,
    SyncPromotionHookProtocol,
    EmbeddingCacheProtocol,
    PromotionHookType,
)

__all__ = [
    # Schemas
    "FireproofDocument",
    "DurableBead",
    "LocalMemory",
    "PromptMetadata",
    "EmbeddingRef",
    "SyncStatus",
    "DocumentType",
    # Config
    "FireproofConfig",
    # Service
    "FireproofService",
    # Sync
    "FireproofZepSync",
    "SyncResult",
    "SyncStats",
    "SyncHealthCheck",
    # Hooks
    "PromptMetadataCapture",
    "BeadPromotionHook",
    "EmbeddingCacheHook",
    "RetrievalSourceInfo",
    "create_promotion_hook",
    # Protocols (for type checking)
    "PromotionHookProtocol",
    "AsyncPromotionHookProtocol",
    "SyncPromotionHookProtocol",
    "EmbeddingCacheProtocol",
    "PromotionHookType",
]

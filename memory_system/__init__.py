"""
Chrysalis Memory System

A high-performance, CRDT-based memory system for autonomous agents.

The memory system provides:
- **Rust Core**: High-performance CRDT types (GSet, ORSet, LWWRegister)
- **Memory Documents**: Full CRDT-aware document structure with automatic merging
- **SQLite Storage**: Persistent storage with WAL mode for high concurrency
- **Agent Memory**: High-level async API for learning and recall
- **Embedding Support**: Integration with Ollama, HuggingFace, and other providers

Quick Start:
    >>> from memory_system import AgentMemory
    >>>
    >>> async with AgentMemory("my-agent") as memory:
    ...     await memory.learn("Python is great for AI", importance=0.9)
    ...     results = await memory.recall("What language is good for AI?")

Low-Level API:
    >>> from memory_system import MemoryDocument, MemoryStorage
    >>>
    >>> storage = MemoryStorage("./data/memory.db", "agent-001")
    >>> mem = MemoryDocument(content="Hello world", source_instance="agent-001")
    >>> storage.put(mem)

CRDT Types:
    >>> from memory_system import GSet, ORSet, LWWRegister
    >>>
    >>> # Grow-only set (memories never deleted)
    >>> memories = GSet()
    >>> memories.add("memory-1")
    >>>
    >>> # OR-Set (add/remove with CRDT semantics)
    >>> tags = ORSet("agent-001")
    >>> tags.add("important")
    >>>
    >>> # Last-Writer-Wins register
    >>> value = LWWRegister()
    >>> value.set("current", 1.0, "agent-001")
"""

from __future__ import annotations

__version__ = "0.1.0"

# Try to import from Rust core first
try:
    from chrysalis_memory import (
        # CRDT types
        GSet,
        ORSet,
        LWWRegister,
        LWWNumericRegister,
        GCounter,
        VectorClock,
        # Memory types
        MemoryType,
        SyncStatus,
        MemoryDocument,
        EmbeddingDocument,
        MemoryCollection,
        MemoryStorage,
        # High-level API
        AgentMemory,
        AgentMemoryConfig,
        SyncManager,
        # Utility
        RUST_AVAILABLE,
    )

    _BACKEND = "rust"

except ImportError:
    # Fall back to pure Python implementation
    from .crdt_merge import (
        GSet,
        ORSet,
        LWWRegister,
    )
    from .fireproof.service import FireproofService as MemoryStorage
    from .fireproof.schemas import MemoryDocument

    # Stubs for types not in Python implementation
    LWWNumericRegister = None
    GCounter = None
    VectorClock = None
    MemoryType = None
    SyncStatus = None
    EmbeddingDocument = None
    MemoryCollection = None
    AgentMemory = None
    AgentMemoryConfig = None
    SyncManager = None
    RUST_AVAILABLE = False

    _BACKEND = "python"

# Import Python-only components
try:
    from .beads import BeadsService
except ImportError:
    BeadsService = None

# Import unified exception hierarchy
from .exceptions import (
    MemoryError,
    StorageError,
    ConnectionError as MemoryConnectionError,  # Avoid shadowing builtin
    ValidationError,
    RetrievalError,
    EmbeddingError,
    SyncError,
    GossipError,
    ByzantineError,
    CircuitBreakerError,
    RetryExhaustedError,
    ExternalServiceError,
    ZepError,
    FireproofError,
    ConfigurationError,
)

try:
    from .embedding.service import EmbeddingService, EmbeddingProvider
except ImportError:
    EmbeddingService = None
    EmbeddingProvider = None

__all__ = [
    # Version
    "__version__",
    "_BACKEND",
    "RUST_AVAILABLE",
    # CRDT types
    "GSet",
    "ORSet",
    "LWWRegister",
    "LWWNumericRegister",
    "GCounter",
    "VectorClock",
    # Memory types
    "MemoryType",
    "SyncStatus",
    "MemoryDocument",
    "EmbeddingDocument",
    "MemoryCollection",
    "MemoryStorage",
    # High-level API
    "AgentMemory",
    "AgentMemoryConfig",
    "SyncManager",
    # Python components
    "BeadsService",
    "EmbeddingService",
    "EmbeddingProvider",
    # Exceptions (unified hierarchy)
    "MemoryError",
    "StorageError",
    "MemoryConnectionError",
    "ValidationError",
    "RetrievalError",
    "EmbeddingError",
    "SyncError",
    "GossipError",
    "ByzantineError",
    "CircuitBreakerError",
    "RetryExhaustedError",
    "ExternalServiceError",
    "ZepError",
    "FireproofError",
    "ConfigurationError",
]


def get_backend_info() -> dict:
    """Get information about the memory system backend."""
    return {
        "backend": _BACKEND,
        "rust_available": RUST_AVAILABLE if RUST_AVAILABLE is not None else False,
        "version": __version__,
        "features": {
            "crdt": True,
            "storage": True,
            "embeddings": True,
            "sync": _BACKEND == "rust",
            "agent_memory": _BACKEND == "rust",
        }
    }

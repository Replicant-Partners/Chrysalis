"""
Chrysalis Memory System - Python Interface

High-performance CRDT-based memory system for autonomous agents,
powered by a Rust core with Python bindings.

Example:
    >>> from chrysalis_memory import MemoryDocument, MemoryStorage, AgentMemory
    >>>
    >>> # Low-level: Direct Rust bindings
    >>> storage = MemoryStorage("./data/memory.db", "agent-001")
    >>> memory = MemoryDocument(
    ...     id="mem-1",
    ...     content="The user prefers Python",
    ...     memory_type="semantic",
    ...     source_instance="agent-001"
    ... )
    >>> storage.put(memory)
    >>>
    >>> # High-level: Python wrapper with async support
    >>> async with AgentMemory("agent-001") as mem:
    ...     await mem.learn("Python is great", importance=0.9)
    ...     results = await mem.recall("What language?")
"""

from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, AsyncIterator, Callable, Dict, List, Optional, Union

# Import Rust bindings (compiled by maturin)
try:
    from chrysalis_memory.chrysalis_memory import (
        GSet,
        ORSet,
        LWWRegister,
        LWWNumericRegister,
        GCounter,
        VectorClock,
        MemoryType,
        SyncStatus,
        MemoryDocument,
        EmbeddingDocument,
        MemoryCollection,
        MemoryStorage,
    )
    RUST_AVAILABLE = True
except ImportError:
    # Fallback for when Rust extension isn't built
    RUST_AVAILABLE = False

    # Provide stub classes for development/testing
    class GSet:
        """Stub GSet when Rust core not available"""
        def __init__(self):
            self._elements = set()
        def add(self, element: str): self._elements.add(element)
        def contains(self, element: str) -> bool: return element in self._elements
        def elements(self) -> List[str]: return list(self._elements)
        def merge(self, other: 'GSet') -> 'GSet':
            result = GSet()
            result._elements = self._elements | other._elements
            return result

    class ORSet:
        """Stub ORSet when Rust core not available"""
        def __init__(self, instance_id: Optional[str] = None):
            self._elements: Dict[str, set] = {}
            self._counter = 0
            self._instance = instance_id or "stub"
        def add(self, element: str) -> str:
            self._counter += 1
            tag = f"{self._instance}:{self._counter}"
            if element not in self._elements:
                self._elements[element] = set()
            self._elements[element].add(tag)
            return tag
        def remove(self, element: str, observed_tags: List[str]):
            if element in self._elements:
                for tag in observed_tags:
                    self._elements[element].discard(tag)
                if not self._elements[element]:
                    del self._elements[element]
        def elements(self) -> List[str]: return list(self._elements.keys())

    class LWWRegister:
        """Stub LWWRegister when Rust core not available"""
        def __init__(self, value=None, timestamp=None, writer=None):
            self._value = value
            self._timestamp = timestamp or 0.0
            self._writer = writer or ""
        def set(self, value: str, timestamp: float, writer: str):
            self._value = value
            self._timestamp = timestamp
            self._writer = writer
        def get(self) -> Optional[str]: return self._value
        def merge(self, other: 'LWWRegister') -> 'LWWRegister':
            if self._timestamp >= other._timestamp:
                return self
            return other

    class MemoryDocument:
        """Stub MemoryDocument when Rust core not available"""
        def __init__(self, id=None, content=None, memory_type=None, source_instance=None):
            import uuid
            import time
            self.id = id or str(uuid.uuid4())
            self.content = content or ""
            self.memory_type = memory_type or "episodic"
            self.source_instance = source_instance or "unknown"
            self._tags = GSet()
            self._importance = 0.5
            self._confidence = 0.5
            self.created_at = time.time()
            self.updated_at = time.time()
            self.version = 1
        def add_tag(self, tag: str): self._tags.add(tag)
        def get_tags(self) -> List[str]: return self._tags.elements()
        def set_importance(self, value: float, writer: str): self._importance = value
        def get_importance(self) -> float: return self._importance
        def set_confidence(self, value: float, writer: str): self._confidence = value
        def get_confidence(self) -> float: return self._confidence

    class MemoryStorage:
        """Stub MemoryStorage when Rust core not available"""
        def __init__(self, path=None, instance_id=None):
            self._memories: Dict[str, MemoryDocument] = {}
            self._instance = instance_id or "stub"
        def put(self, memory: MemoryDocument) -> str:
            self._memories[memory.id] = memory
            return memory.id
        def get(self, id: str) -> Optional[MemoryDocument]:
            return self._memories.get(id)
        def all(self) -> List[MemoryDocument]:
            return list(self._memories.values())
        def count(self) -> int:
            return len(self._memories)

    MemoryCollection = None
    EmbeddingDocument = None
    LWWNumericRegister = None
    GCounter = None
    VectorClock = None
    MemoryType = None
    SyncStatus = None


__all__ = [
    # Rust CRDT types
    "GSet",
    "ORSet",
    "LWWRegister",
    "LWWNumericRegister",
    "GCounter",
    "VectorClock",
    # Rust memory types
    "MemoryType",
    "SyncStatus",
    "MemoryDocument",
    "EmbeddingDocument",
    "MemoryCollection",
    "MemoryStorage",
    # Python high-level APIs
    "AgentMemory",
    "AgentMemoryConfig",
    "SyncManager",
    # Utility
    "RUST_AVAILABLE",
]

__version__ = "0.1.0"


@dataclass
class AgentMemoryConfig:
    """Configuration for AgentMemory."""

    agent_id: str
    agent_name: str = ""

    # Storage
    db_path: Optional[str] = None

    # Sync
    sync_enabled: bool = True
    sync_gateway: str = "ws://localhost:4444"
    sync_interval_s: int = 60
    sync_batch_size: int = 100

    # Memory promotion
    promotion_enabled: bool = True
    promotion_threshold: float = 0.7

    # Embedding
    embedding_provider: str = "ollama"
    embedding_model: str = "nomic-embed-text"
    embedding_base_url: str = "http://localhost:11434"

    @classmethod
    def from_env(cls, agent_id: str) -> "AgentMemoryConfig":
        """Load configuration from environment variables."""
        return cls(
            agent_id=agent_id,
            agent_name=os.getenv("AGENT_NAME", agent_id),
            db_path=os.getenv("FIREPROOF_DB_PATH"),
            sync_enabled=os.getenv("FIREPROOF_SYNC_ENABLED", "true").lower() == "true",
            sync_gateway=os.getenv("FIREPROOF_SYNC_GATEWAY", "ws://localhost:4444"),
            sync_interval_s=int(os.getenv("FIREPROOF_SYNC_INTERVAL", "60")),
            sync_batch_size=int(os.getenv("FIREPROOF_SYNC_BATCH_SIZE", "100")),
            promotion_enabled=os.getenv("FIREPROOF_PROMOTION_ENABLED", "true").lower() == "true",
            promotion_threshold=float(os.getenv("FIREPROOF_PROMOTION_THRESHOLD", "0.7")),
            embedding_provider=os.getenv("EMBEDDING_PROVIDER", "ollama"),
            embedding_model=os.getenv("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text"),
            embedding_base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
        )


class SyncManager:
    """Manages synchronization with the central Chrysalis hub."""

    def __init__(
        self,
        storage: MemoryStorage,
        gateway_url: str,
        instance_id: str,
        batch_size: int = 100,
    ):
        self.storage = storage
        self.gateway_url = gateway_url
        self.instance_id = instance_id
        self.batch_size = batch_size
        self._running = False
        self._task: Optional[asyncio.Task] = None

    async def start(self, interval_s: int = 60):
        """Start background sync loop."""
        self._running = True
        self._task = asyncio.create_task(self._sync_loop(interval_s))

    async def stop(self):
        """Stop background sync."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _sync_loop(self, interval_s: int):
        """Background sync loop."""
        while self._running:
            try:
                await self.sync()
            except Exception as e:
                # Log error but continue
                print(f"Sync error: {e}")

            await asyncio.sleep(interval_s)

    async def sync(self) -> int:
        """Perform one sync cycle."""
        # Get pending items
        pending = self.storage.get_pending_sync(self.batch_size)

        if not pending:
            return 0

        # TODO: Implement actual WebSocket sync to gateway
        # For now, just mark as synced
        doc_ids = [item[1] for item in pending]
        return self.storage.mark_synced(doc_ids)

    async def push(self, memories: List[MemoryDocument]) -> int:
        """Push memories to gateway immediately."""
        # TODO: Implement WebSocket push
        return len(memories)

    async def pull(self, query: str, k: int = 10) -> List[MemoryDocument]:
        """Pull relevant memories from gateway."""
        # TODO: Implement WebSocket pull
        return []


class AgentMemory:
    """
    High-level interface for agent memory with async support.

    Example:
        >>> async with AgentMemory("agent-001") as memory:
        ...     # Learn something
        ...     mem_id = await memory.learn(
        ...         "The user prefers concise explanations",
        ...         importance=0.9,
        ...         tags=["preference", "style"]
        ...     )
        ...
        ...     # Recall relevant memories
        ...     results = await memory.recall("How should I explain?", k=5)
        ...     for m in results:
        ...         print(f"- {m.content} (conf={m.get_confidence():.2f})")
    """

    def __init__(
        self,
        agent_id: str,
        config: Optional[AgentMemoryConfig] = None,
        embedding_fn: Optional[Callable[[str], List[float]]] = None,
    ):
        self.config = config or AgentMemoryConfig.from_env(agent_id)
        self.agent_id = self.config.agent_id

        # Determine storage path
        db_path = self.config.db_path
        if db_path is None:
            data_dir = Path("./data")
            data_dir.mkdir(parents=True, exist_ok=True)
            db_path = str(data_dir / f"{self.agent_id}_memory.db")

        # Initialize storage
        self.storage = MemoryStorage(db_path, self.agent_id)

        # Sync manager
        self.sync_manager: Optional[SyncManager] = None
        if self.config.sync_enabled:
            self.sync_manager = SyncManager(
                storage=self.storage,
                gateway_url=self.config.sync_gateway,
                instance_id=self.agent_id,
                batch_size=self.config.sync_batch_size,
            )

        # Embedding function
        self._embedding_fn = embedding_fn
        self._embedding_cache: Dict[str, List[float]] = {}

    async def __aenter__(self) -> "AgentMemory":
        """Async context manager entry."""
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.stop()

    async def start(self):
        """Initialize and start background services."""
        if self.sync_manager:
            await self.sync_manager.start(self.config.sync_interval_s)

    async def stop(self):
        """Stop background services."""
        if self.sync_manager:
            await self.sync_manager.stop()

    async def learn(
        self,
        content: str,
        importance: float = 0.5,
        confidence: float = 0.8,
        memory_type: str = "episodic",
        tags: Optional[List[str]] = None,
        related: Optional[List[str]] = None,
        evidence: Optional[List[str]] = None,
    ) -> str:
        """
        Learn something new.

        Args:
            content: The content to remember
            importance: How important (0.0-1.0)
            confidence: How confident (0.0-1.0)
            memory_type: episodic, semantic, procedural, working
            tags: Optional tags for classification
            related: Optional related memory IDs
            evidence: Optional evidence references

        Returns:
            Memory ID
        """
        # Create memory document
        memory = MemoryDocument(
            content=content,
            memory_type=memory_type,
            source_instance=self.agent_id,
        )

        # Set importance and confidence
        memory.set_importance(importance, self.agent_id)
        memory.set_confidence(confidence, self.agent_id)

        # Add tags
        if tags:
            for tag in tags:
                memory.add_tag(tag)

        # Add relationships
        if related:
            for rel_id in related:
                memory.add_related(rel_id)

        # Add evidence
        if evidence:
            for ev in evidence:
                memory.add_evidence(ev)

        # Generate embedding if function provided
        if self._embedding_fn:
            try:
                embedding = await self._get_embedding(content)
                if RUST_AVAILABLE and EmbeddingDocument is not None:
                    emb_doc = EmbeddingDocument(
                        content,
                        embedding,
                        self.config.embedding_model,
                    )
                    self.storage.put_embedding(emb_doc)
                    memory.embedding_ref = emb_doc.id
            except Exception as e:
                # Log but continue without embedding
                print(f"Embedding error: {e}")

        # Store
        mem_id = self.storage.put(memory)

        return mem_id

    async def recall(
        self,
        query: str,
        k: int = 5,
        memory_type: Optional[str] = None,
        min_importance: Optional[float] = None,
        tags: Optional[List[str]] = None,
    ) -> List[MemoryDocument]:
        """
        Recall relevant memories.

        Args:
            query: Search query
            k: Number of results
            memory_type: Filter by type
            min_importance: Minimum importance threshold
            tags: Filter by tags

        Returns:
            List of relevant memories
        """
        # Get all memories that match filters
        if memory_type:
            memories = self.storage.query_by_type(memory_type)
        elif min_importance:
            memories = self.storage.query_by_importance(min_importance)
        elif tags:
            # Intersection of tag queries
            memories = []
            for tag in tags:
                tag_memories = self.storage.query_by_tag(tag)
                if not memories:
                    memories = tag_memories
                else:
                    memory_ids = {m.id for m in memories}
                    memories = [m for m in tag_memories if m.id in memory_ids]
        else:
            memories = self.storage.all()

        # If we have embedding function, score by similarity
        if self._embedding_fn and memories:
            query_embedding = await self._get_embedding(query)

            scored_memories = []
            for memory in memories:
                # Try to get memory's embedding
                if memory.embedding_ref:
                    emb_doc = self.storage.get_embedding_by_hash(memory.content_hash)
                    if emb_doc:
                        similarity = self._cosine_similarity(
                            query_embedding,
                            emb_doc.get_vector()
                        )
                        scored_memories.append((memory, similarity))
                        continue

                # Fallback: simple text matching score
                score = self._text_match_score(query, memory.content)
                scored_memories.append((memory, score))

            # Sort by score and return top k
            scored_memories.sort(key=lambda x: x[1], reverse=True)
            return [m for m, _ in scored_memories[:k]]

        # Without embeddings, return most recent/important
        memories.sort(
            key=lambda m: (m.get_importance(), m.updated_at),
            reverse=True
        )
        return memories[:k]

    async def get(self, memory_id: str) -> Optional[MemoryDocument]:
        """Get a specific memory by ID."""
        return self.storage.get(memory_id)

    async def update(
        self,
        memory_id: str,
        content: Optional[str] = None,
        importance: Optional[float] = None,
        confidence: Optional[float] = None,
        tags_add: Optional[List[str]] = None,
        tags_remove: Optional[List[str]] = None,
    ) -> Optional[MemoryDocument]:
        """
        Update an existing memory.

        Uses CRDT semantics - changes merge with existing state.
        """
        memory = self.storage.get(memory_id)
        if not memory:
            return None

        if content:
            memory.set_content(content, self.agent_id)

        if importance is not None:
            memory.set_importance(importance, self.agent_id)

        if confidence is not None:
            memory.set_confidence(confidence, self.agent_id)

        if tags_add:
            for tag in tags_add:
                memory.add_tag(tag)

        if tags_remove:
            for tag in tags_remove:
                memory.remove_tag(tag)

        self.storage.put(memory)
        return memory

    async def record_access(self, memory_id: str) -> bool:
        """Record that a memory was accessed (for importance tracking)."""
        memory = self.storage.get(memory_id)
        if not memory:
            return False

        memory.record_access(self.agent_id)
        self.storage.put(memory)
        return True

    def count(self) -> int:
        """Get total memory count."""
        return self.storage.count()

    def recent(self, limit: int = 10) -> List[MemoryDocument]:
        """Get most recent memories."""
        return self.storage.recent(limit)

    async def sync_now(self) -> int:
        """Force immediate sync with gateway."""
        if self.sync_manager:
            return await self.sync_manager.sync()
        return 0

    async def _get_embedding(self, text: str) -> List[float]:
        """Get embedding for text, using cache."""
        if text in self._embedding_cache:
            return self._embedding_cache[text]

        if self._embedding_fn:
            if asyncio.iscoroutinefunction(self._embedding_fn):
                embedding = await self._embedding_fn(text)
            else:
                embedding = self._embedding_fn(text)

            self._embedding_cache[text] = embedding
            return embedding

        return []

    @staticmethod
    def _cosine_similarity(a: List[float], b: List[float]) -> float:
        """Compute cosine similarity between two vectors."""
        if len(a) != len(b) or not a:
            return 0.0

        dot = sum(x * y for x, y in zip(a, b))
        norm_a = sum(x * x for x in a) ** 0.5
        norm_b = sum(x * x for x in b) ** 0.5

        if norm_a == 0 or norm_b == 0:
            return 0.0

        return dot / (norm_a * norm_b)

    @staticmethod
    def _text_match_score(query: str, content: str) -> float:
        """Simple text matching score."""
        query_words = set(query.lower().split())
        content_words = set(content.lower().split())

        if not query_words:
            return 0.0

        overlap = len(query_words & content_words)
        return overlap / len(query_words)


# Convenience function for quick memory access
@asynccontextmanager
async def agent_memory(
    agent_id: str,
    **kwargs
) -> AsyncIterator[AgentMemory]:
    """
    Context manager for agent memory.

    Example:
        >>> async with agent_memory("my-agent") as mem:
        ...     await mem.learn("Hello world")
    """
    memory = AgentMemory(agent_id, **kwargs)
    await memory.start()
    try:
        yield memory
    finally:
        await memory.stop()

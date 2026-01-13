"""
Fireproof document schemas for Chrysalis memory system.

Defines the data models for documents stored in Fireproof:
- DurableBead: Promoted beads from short-term memory
- LocalMemory: Memory entries for local persistence
- PromptMetadata: LLM prompt/response telemetry
- EmbeddingRef: References to embeddings stored in Zep
"""

from __future__ import annotations

import hashlib
import time
import uuid
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any, Dict, List, Optional, TypedDict


class SyncStatus(str, Enum):
    """Synchronization status for documents."""
    LOCAL = "local"        # Created locally, never synced
    PENDING = "pending"    # Modified, waiting for sync
    SYNCED = "synced"      # Successfully synced to remote


class DocumentType(str, Enum):
    """Document types stored in Fireproof."""
    BEAD = "bead"
    MEMORY = "memory"
    METADATA = "metadata"
    EMBEDDING_REF = "embedding_ref"


@dataclass
class FireproofDocument:
    """
    Base document class for all Fireproof documents.
    
    All documents share common fields for identification,
    timestamps, versioning, and sync status tracking.
    
    Note: sync_status defaults to PENDING (not LOCAL) because new
    documents should be queued for sync. Use LOCAL only for documents
    that should never be synced.
    """
    _id: str = field(default_factory=lambda: str(uuid.uuid4()))
    type: str = ""
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    sync_status: str = SyncStatus.PENDING.value
    version: int = 1
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage."""
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> FireproofDocument:
        """Create from dictionary."""
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})
    
    def mark_pending(self) -> None:
        """Mark document as pending sync."""
        self.sync_status = SyncStatus.PENDING.value
        self.updated_at = time.time()
        self.version += 1
    
    def mark_synced(self) -> None:
        """Mark document as synced."""
        self.sync_status = SyncStatus.SYNCED.value


@dataclass
class DurableBead(FireproofDocument):
    """
    Durable bead promoted from BeadsService.
    
    High-importance beads are promoted from the ephemeral
    BeadsService to Fireproof for cross-session persistence.
    """
    type: str = DocumentType.BEAD.value
    content: str = ""
    role: str = "user"  # user, assistant, tool, system
    importance: float = 0.5
    span_refs: List[str] = field(default_factory=list)
    original_bead_id: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @classmethod
    def from_bead(
        cls,
        bead_id: str,
        content: str,
        role: str = "user",
        importance: float = 0.5,
        span_refs: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        sync_status: Optional[str] = None,
    ) -> DurableBead:
        """
        Create a DurableBead from BeadsService bead data.
        
        Args:
            bead_id: Original bead ID from BeadsService
            content: Bead content text
            role: Origin role (user, assistant, tool, system)
            importance: Importance weighting (0.0-1.0)
            span_refs: Optional references to spans/ids
            metadata: Optional metadata dict
            sync_status: Sync status override. Defaults to PENDING for sync.
        """
        bead = cls(
            original_bead_id=bead_id,
            content=content,
            role=role,
            importance=importance,
            span_refs=span_refs or [],
            metadata=metadata or {},
        )
        if sync_status is not None:
            bead.sync_status = sync_status
        return bead


@dataclass
class LocalMemory(FireproofDocument):
    """
    Memory entry for local persistence.
    
    Stores episodic, semantic, or working memories locally
    with optional embedding references for vector search.
    """
    type: str = DocumentType.MEMORY.value
    content: str = ""
    memory_type: str = "episodic"  # episodic, semantic, working
    embedding_ref: Optional[str] = None  # ID to embedding in Zep
    confidence: float = 1.0
    tags: List[str] = field(default_factory=list)
    source_instance: str = ""
    access_count: int = 0
    last_accessed: float = field(default_factory=time.time)
    related_memories: List[str] = field(default_factory=list)
    
    def record_access(self) -> None:
        """Record an access to this memory."""
        self.access_count += 1
        self.last_accessed = time.time()


class RetrievalSource(TypedDict):
    """Source information for retrieval provenance."""
    type: str  # bead, fireproof, zep
    id: str
    score: float


@dataclass
class PromptMetadata(FireproofDocument):
    """
    LLM prompt/response metadata for observability.
    
    Captures telemetry about LLM interactions including
    token usage, latency, retrieval sources, and quality scores.
    """
    type: str = DocumentType.METADATA.value
    
    # Request context
    session_id: str = ""
    conversation_turn: int = 0
    prompt_hash: str = ""  # SHA-256 of system prompt
    prompt_version: str = ""
    
    # Model info
    model: str = ""
    provider: str = ""
    
    # Token usage
    tokens_in: int = 0
    tokens_out: int = 0
    tokens_context: int = 0  # Tokens from memory retrieval
    
    # Performance
    latency_ms: float = 0.0
    retrieval_latency_ms: float = 0.0
    
    # Retrieval provenance
    retrieval_sources: List[Dict[str, Any]] = field(default_factory=list)
    
    # Quality metrics
    score: Optional[float] = None
    feedback: Optional[str] = None  # positive, negative
    
    # Error tracking
    error: Optional[str] = None
    retry_count: int = 0
    
    # Completion timestamp
    completed_at: float = 0.0
    
    @staticmethod
    def hash_prompt(prompt: str) -> str:
        """Generate SHA-256 hash of prompt text."""
        return hashlib.sha256(prompt.encode()).hexdigest()[:16]
    
    def complete(
        self,
        tokens_out: int = 0,
        error: Optional[str] = None,
        score: Optional[float] = None,
    ) -> None:
        """Mark the prompt as completed with results."""
        self.completed_at = time.time()
        self.latency_ms = (self.completed_at - self.created_at) * 1000
        self.tokens_out = tokens_out
        self.error = error
        self.score = score
        self.mark_pending()


@dataclass
class EmbeddingRef(FireproofDocument):
    """
    Reference to embedding stored in Zep.
    
    Stores metadata about embeddings with optional local
    caching of small vectors for offline operation.
    """
    type: str = DocumentType.EMBEDDING_REF.value
    text_hash: str = ""  # Hash of embedded text
    zep_id: str = ""  # Reference to Zep vector
    model: str = ""
    dimensions: int = 0
    source_text: str = ""  # Original text (truncated for storage)
    local_cache: Optional[List[float]] = None  # Optional local cache
    
    @staticmethod
    def hash_text(text: str) -> str:
        """Generate hash for text content."""
        return hashlib.sha256(text.encode()).hexdigest()[:32]
    
    @classmethod
    def create(
        cls,
        text: str,
        model: str,
        dimensions: int,
        zep_id: Optional[str] = None,
        vector: Optional[List[float]] = None,
        cache_threshold_bytes: int = 10240,  # 10KB
    ) -> EmbeddingRef:
        """
        Create an EmbeddingRef for text.
        
        Args:
            text: The embedded text
            model: Embedding model name
            dimensions: Vector dimensions
            zep_id: Optional Zep vector ID
            vector: Optional embedding vector
            cache_threshold_bytes: Max vector size to cache locally
        """
        ref = cls(
            text_hash=cls.hash_text(text),
            zep_id=zep_id or "",
            model=model,
            dimensions=dimensions,
            source_text=text[:500],  # Truncate for storage
        )
        
        # Cache vector locally if small enough
        if vector:
            vector_size = len(vector) * 8  # 8 bytes per float64
            if vector_size <= cache_threshold_bytes:
                ref.local_cache = vector
        
        return ref


# Schema version for migrations
SCHEMA_VERSION = 1


def validate_document(doc: Dict[str, Any]) -> bool:
    """
    Validate a document against schema requirements.
    
    Returns True if valid, raises ValueError if invalid.
    """
    required_fields = ["_id", "type", "created_at"]
    
    for field_name in required_fields:
        if field_name not in doc:
            raise ValueError(f"Missing required field: {field_name}")
    
    valid_types = [t.value for t in DocumentType]
    if doc.get("type") not in valid_types:
        raise ValueError(f"Invalid document type: {doc.get('type')}")
    
    return True


def migrate_document(doc: Dict[str, Any]) -> Dict[str, Any]:
    """
    Migrate a document to the current schema version.
    
    Applies necessary transformations for documents from
    older schema versions.
    """
    current_version = doc.get("version", 0)
    
    if current_version < SCHEMA_VERSION:
        # Migration from version 0 to 1
        if "type" not in doc:
            doc["type"] = DocumentType.BEAD.value
        if "sync_status" not in doc:
            doc["sync_status"] = SyncStatus.LOCAL.value
        if "version" not in doc:
            doc["version"] = SCHEMA_VERSION
        if "updated_at" not in doc:
            doc["updated_at"] = doc.get("created_at", time.time())
    
    return doc

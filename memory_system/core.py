"""
Core memory abstractions and interfaces
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Protocol
from datetime import datetime
import uuid
from .sanitization import MemorySanitizer


@dataclass
class MemoryEntry:
    """A single memory entry"""
    id: str
    content: str
    memory_type: str  # "working", "episodic", "semantic", "core"
    timestamp: datetime
    metadata: Dict[str, Any] = field(default_factory=dict)
    embedding: Optional[List[float]] = None
    
    @classmethod
    def create(cls, content: str, memory_type: str, metadata: Optional[Dict[str, Any]] = None):
        """Create a new memory entry"""
        return cls(
            id=str(uuid.uuid4()),
            content=content,
            memory_type=memory_type,
            timestamp=datetime.now(),
            metadata=metadata or {},
            embedding=None
        )


@dataclass
class RetrievalResult:
    """Result from memory retrieval"""
    entries: List[MemoryEntry]
    scores: List[float]
    metadata: Dict[str, Any] = field(default_factory=dict)


class MemoryStore(Protocol):
    """
    Protocol for memory storage backends.
    
    Implementations must support filtering by memory type to enable
    separate episodic (experiences) and semantic (facts) memory retrieval.
    """
    
    def store(self, entry: MemoryEntry) -> None:
        """Store a memory entry"""
        ...
    
    def retrieve(
        self, 
        query: str, 
        limit: int = 5,
        memory_type: Optional[str] = None,
        memory_types: Optional[List[str]] = None
    ) -> RetrievalResult:
        """
        Retrieve relevant memories by similarity search.
        
        Args:
            query: Search query text
            limit: Maximum number of results
            memory_type: Filter to single type (e.g., "episodic", "semantic")
            memory_types: Filter to multiple types (e.g., ["episodic", "semantic"])
        """
        ...
    
    def get_by_id(self, entry_id: str) -> Optional[MemoryEntry]:
        """Get specific memory by ID"""
        ...
    
    def list_recent(self, limit: int = 10) -> List[MemoryEntry]:
        """List recent memories"""
        ...
    
    def delete(self, entry_id: str) -> bool:
        """Delete a memory entry"""
        ...
    
    def count(self) -> int:
        """Return total number of stored memories"""
        ...


@dataclass
class MemoryConfig:
    """Configuration for memory system"""
    # Embeddings
    embedding_model: str = "openai/text-embedding-3-small"
    embedding_dimensions: int = 1536
    
    # Storage
    vector_store_type: str = "chroma"  # or "faiss"
    storage_path: str = "./memory_data"
    
    # Working memory
    working_memory_size: int = 10
    
    # Retrieval
    default_retrieval_limit: int = 5
    similarity_threshold: float = 0.7
    
    # API keys (from environment)
    openai_api_key: Optional[str] = None


class Memory:
    """
    Main memory interface for agents
    
    Provides unified access to different memory types:
    - Working Memory: Recent context (in-memory buffer)
    - Episodic Memory: Past experiences (vector store)
    - Semantic Memory: Knowledge/facts (vector store)
    - Core Memory: Persistent context (structured blocks)
    """
    
    def __init__(self, config: MemoryConfig):
        self.config = config
        self._working_memory: List[MemoryEntry] = []
        self._core_memory: Dict[str, str] = {}
        self._vector_store: Optional[MemoryStore] = None
        self._embedding_provider = None
        self._initialized = False
    
    def initialize(self):
        """Initialize storage backends and connections"""
        from .embeddings import OpenAIEmbeddings
        from .stores import ChromaVectorStore
        
        # Initialize embeddings
        self._embedding_provider = OpenAIEmbeddings(
            model=self.config.embedding_model,
            api_key=self.config.openai_api_key
        )
        
        # Initialize vector store
        self._vector_store = ChromaVectorStore(
            collection_name="agent_memory",
            persist_directory=self.config.storage_path,
            embedding_function=self._embedding_provider.embed
        )
        
        self._initialized = True
    
    def _ensure_initialized(self):
        """Ensure memory system is initialized"""
        if not self._initialized:
            self.initialize()
    
    # Working Memory (recent context)
    def add_to_working_memory(self, content: str, metadata: Optional[Dict] = None) -> MemoryEntry:
        """Add to working memory (recent context buffer)"""
        entry = MemoryEntry.create(content, "working", metadata)
        self._working_memory.append(entry)
        
        # Keep only recent items
        if len(self._working_memory) > self.config.working_memory_size:
            self._working_memory.pop(0)
        
        return entry
    
    def get_working_memory(self) -> List[MemoryEntry]:
        """Get current working memory context"""
        return self._working_memory.copy()
    
    def clear_working_memory(self):
        """Clear working memory"""
        self._working_memory.clear()
    
    # Core Memory (persistent blocks)
    def set_core_memory(self, key: str, value: str):
        """Set a core memory block (e.g., persona, user_facts)"""
        self._core_memory[key] = value
    
    def get_core_memory(self, key: str) -> Optional[str]:
        """Get a core memory block"""
        return self._core_memory.get(key)
    
    def get_all_core_memory(self) -> Dict[str, str]:
        """Get all core memory blocks"""
        return self._core_memory.copy()
    
    def update_core_memory(self, key: str, value: str) -> bool:
        """Update core memory block"""
        if key in self._core_memory:
            self._core_memory[key] = value
            return True
        return False
    
    # Episodic Memory (experiences)
    def add_episodic(self, content: str, metadata: Optional[Dict] = None) -> MemoryEntry:
        """Add an episodic memory (experience/event)"""
        self._ensure_initialized()
        
        # Sanitize content and metadata
        sanitized_content, detected_pii = MemorySanitizer.sanitize(content)
        sanitized_metadata = metadata
        if metadata:
            sanitized_metadata, meta_detected = MemorySanitizer.validate_metadata(metadata)
            detected_pii.extend(meta_detected)
            
        # Record PII detection in metadata
        if detected_pii:
            if not sanitized_metadata:
                sanitized_metadata = {}
            sanitized_metadata["_pii_detected"] = list(set(detected_pii))
            sanitized_metadata["_sanitized"] = True

        entry = MemoryEntry.create(sanitized_content, "episodic", sanitized_metadata)
        
        # Generate embedding from sanitized content to prevent PII leakage
        entry.embedding = self._embedding_provider.embed(sanitized_content)
        
        # Store in vector database
        if self._vector_store:
            self._vector_store.store(entry)
        
        return entry
    
    def search_episodic(self, query: str, limit: int = 5) -> RetrievalResult:
        """Search episodic memories"""
        self._ensure_initialized()
        return self._vector_store.retrieve(query, limit=limit, memory_type="episodic")
    
    # Semantic Memory (knowledge/facts)
    def add_semantic(self, content: str, metadata: Optional[Dict] = None) -> MemoryEntry:
        """Add semantic memory (fact/knowledge)"""
        self._ensure_initialized()
        
        # Sanitize content and metadata
        sanitized_content, detected_pii = MemorySanitizer.sanitize(content)
        sanitized_metadata = metadata
        if metadata:
            sanitized_metadata, meta_detected = MemorySanitizer.validate_metadata(metadata)
            detected_pii.extend(meta_detected)
            
        # Record PII detection in metadata
        if detected_pii:
            if not sanitized_metadata:
                sanitized_metadata = {}
            sanitized_metadata["_pii_detected"] = list(set(detected_pii))
            sanitized_metadata["_sanitized"] = True

        entry = MemoryEntry.create(sanitized_content, "semantic", sanitized_metadata)
        
        # Generate embedding from sanitized content to prevent PII leakage
        entry.embedding = self._embedding_provider.embed(sanitized_content)
        
        # Store in vector database
        if self._vector_store:
            self._vector_store.store(entry)
        
        return entry
    
    def search_semantic(self, query: str, limit: int = 5) -> RetrievalResult:
        """Search semantic memories"""
        self._ensure_initialized()
        return self._vector_store.retrieve(query, limit=limit, memory_type="semantic")
    
    # Unified search
    def search(self, query: str, memory_types: Optional[List[str]] = None, limit: int = 5) -> RetrievalResult:
        """
        Search across memory types
        
        Args:
            query: Search query
            memory_types: Types to search (None = all except working)
            limit: Max results
        """
        self._ensure_initialized()
        
        if memory_types is None:
            memory_types = ["episodic", "semantic"]
        
        return self._vector_store.retrieve(query, limit=limit, memory_types=memory_types)
    
    # Context assembly
    def get_context(self, query: Optional[str] = None, include_working: bool = True) -> str:
        """
        Assemble context for LLM
        
        Returns formatted context string combining:
        - Core memory (always)
        - Working memory (if include_working)
        - Retrieved relevant memories (if query provided)
        """
        context_parts = []
        
        # Core memory
        if self._core_memory:
            context_parts.append("=== Core Memory ===")
            for key, value in self._core_memory.items():
                context_parts.append(f"{key}: {value}")
            context_parts.append("")
        
        # Working memory
        if include_working and self._working_memory:
            context_parts.append("=== Recent Context ===")
            for entry in self._working_memory[-5:]:  # Last 5
                context_parts.append(f"- {entry.content}")
            context_parts.append("")
        
        # Retrieved memories
        if query:
            self._ensure_initialized()
            results = self.search(query, limit=3)
            if results.entries:
                context_parts.append("=== Relevant Memories ===")
                for entry in results.entries:
                    context_parts.append(f"- [{entry.memory_type}] {entry.content}")
                context_parts.append("")
        
        return "\n".join(context_parts)
    
    # Statistics
    def get_stats(self) -> Dict[str, Any]:
        """Get memory system statistics"""
        self._ensure_initialized()
        
        return {
            "working_memory_size": len(self._working_memory),
            "core_memory_blocks": len(self._core_memory),
            "vector_store_count": self._vector_store.count() if hasattr(self._vector_store, 'count') else None,
            "config": {
                "embedding_model": self.config.embedding_model,
                "vector_store_type": self.config.vector_store_type,
            }
        }

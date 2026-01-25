"""
Storage backends for different memory types
"""
from typing import List, Dict, Any, Optional, Callable
from datetime import datetime
import json
import os

from .core import MemoryEntry, RetrievalResult


class WorkingMemory:
    """
    Working memory implementation (in-memory buffer)
    Holds recent context, not persisted
    """
    
    def __init__(self, max_size: int = 10):
        self.max_size = max_size
        self.buffer: List[MemoryEntry] = []
    
    def add(self, entry: MemoryEntry):
        """Add entry to working memory"""
        self.buffer.append(entry)
        
        # Keep only recent entries
        if len(self.buffer) > self.max_size:
            self.buffer.pop(0)
    
    def get_all(self) -> List[MemoryEntry]:
        """Get all working memory entries"""
        return self.buffer.copy()
    
    def get_recent(self, n: int) -> List[MemoryEntry]:
        """Get N most recent entries"""
        return self.buffer[-n:] if len(self.buffer) >= n else self.buffer.copy()
    
    def clear(self):
        """Clear working memory"""
        self.buffer.clear()


class CoreMemory:
    """
    Core memory implementation (persistent blocks)
    Holds agent persona, user facts, critical context
    """
    
    def __init__(self, persist_path: Optional[str] = None):
        self.blocks: Dict[str, str] = {}
        self.persist_path = persist_path
        
        if persist_path and os.path.exists(persist_path):
            self.load()
    
    def set(self, key: str, value: str):
        """Set a core memory block"""
        self.blocks[key] = value
        if self.persist_path:
            self.save()
    
    def get(self, key: str) -> Optional[str]:
        """Get a core memory block"""
        return self.blocks.get(key)
    
    def get_all(self) -> Dict[str, str]:
        """Get all core memory blocks"""
        return self.blocks.copy()
    
    def update(self, key: str, value: str) -> bool:
        """Update existing block"""
        if key in self.blocks:
            self.blocks[key] = value
            if self.persist_path:
                self.save()
            return True
        return False
    
    def delete(self, key: str) -> bool:
        """Delete a block"""
        if key in self.blocks:
            del self.blocks[key]
            if self.persist_path:
                self.save()
            return True
        return False
    
    def save(self):
        """Persist to disk"""
        if self.persist_path:
            os.makedirs(os.path.dirname(self.persist_path), exist_ok=True)
            with open(self.persist_path, 'w') as f:
                json.dump(self.blocks, f, indent=2)
    
    def load(self):
        """Load from disk"""
        if self.persist_path and os.path.exists(self.persist_path):
            with open(self.persist_path, 'r') as f:
                self.blocks = json.load(f)


class VectorStore:
    """
    Base class for vector stores.
    
    Implements the MemoryStore protocol for vector-based memory retrieval.
    """
    
    def store(self, entry: MemoryEntry):
        """Store a memory entry with its embedding"""
        raise NotImplementedError
    
    def retrieve(
        self, 
        query: str, 
        limit: int = 5,
        memory_type: Optional[str] = None,
        memory_types: Optional[List[str]] = None,
        **kwargs
    ) -> RetrievalResult:
        """Retrieve relevant memories by similarity search"""
        raise NotImplementedError
    
    def get_by_id(self, entry_id: str) -> Optional[MemoryEntry]:
        """Get specific memory by ID"""
        raise NotImplementedError
    
    def list_recent(self, limit: int = 10) -> List[MemoryEntry]:
        """List recent memories (default: returns empty, override in subclass)"""
        return []
    
    def delete(self, entry_id: str) -> bool:
        """Delete a memory entry"""
        raise NotImplementedError
    
    def count(self) -> int:
        """Count total memories"""
        raise NotImplementedError


class ChromaVectorStore(VectorStore):
    """
    Chroma vector database implementation
    Lightweight, embedded vector database
    """
    
    def __init__(
        self,
        collection_name: str = "agent_memory",
        persist_directory: str = "./chroma_data",
        embedding_function: Optional[Callable] = None
    ):
        try:
            import chromadb
            from chromadb.config import Settings
        except ImportError as e:
            raise ImportError(
                "chromadb required. Install with: pip install chromadb"
            ) from e

        self.collection_name = collection_name
        self.persist_directory = persist_directory
        self.embedding_function = embedding_function

        # Initialize Chroma client
        self.client = chromadb.Client(Settings(
            persist_directory=persist_directory,
            anonymized_telemetry=False
        ))

        # Get or create collection
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"description": "Agent memory storage"}
        )
    
    def store(self, entry: MemoryEntry):
        """Store memory entry in Chroma"""
        if not entry.embedding:
            if self.embedding_function:
                entry.embedding = self.embedding_function(entry.content)
            else:
                raise ValueError("Entry must have embedding or embedding_function must be provided")
        
        # Store in Chroma
        self.collection.add(
            ids=[entry.id],
            embeddings=[entry.embedding],
            documents=[entry.content],
            metadatas=[{
                "memory_type": entry.memory_type,
                "timestamp": entry.timestamp.isoformat(),
                **entry.metadata
            }]
        )
    
    def retrieve(
        self,
        query: str,
        limit: int = 5,
        memory_type: Optional[str] = None,
        memory_types: Optional[List[str]] = None,
        **kwargs
    ) -> RetrievalResult:
        """Retrieve relevant memories"""
        # Generate query embedding
        if not self.embedding_function:
            raise ValueError("Embedding function required for retrieval")
        
        query_embedding = self.embedding_function(query)
        
        # Build filter
        where = None
        if memory_type:
            where = {"memory_type": memory_type}
        elif memory_types:
            where = {"memory_type": {"$in": memory_types}}
        
        # Query Chroma
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=limit,
            where=where
        )
        
        # Parse results
        entries = []
        scores = []
        
        if results['ids'] and results['ids'][0]:
            for i, entry_id in enumerate(results['ids'][0]):
                metadata = results['metadatas'][0][i]
                
                entry = MemoryEntry(
                    id=entry_id,
                    content=results['documents'][0][i],
                    memory_type=metadata.get('memory_type', 'unknown'),
                    timestamp=datetime.fromisoformat(metadata.get('timestamp', datetime.now().isoformat())),
                    metadata={k: v for k, v in metadata.items() if k not in ['memory_type', 'timestamp']},
                    embedding=results.get('embeddings', [[]])[0][i] if results.get('embeddings') else None
                )
                
                entries.append(entry)
                scores.append(results['distances'][0][i] if results.get('distances') else 0.0)
        
        return RetrievalResult(
            entries=entries,
            scores=scores,
            metadata={"query": query, "limit": limit}
        )
    
    def get_by_id(self, entry_id: str) -> Optional[MemoryEntry]:
        """Get specific memory by ID"""
        results = self.collection.get(ids=[entry_id])
        
        if results['ids']:
            metadata = results['metadatas'][0]
            return MemoryEntry(
                id=entry_id,
                content=results['documents'][0],
                memory_type=metadata.get('memory_type', 'unknown'),
                timestamp=datetime.fromisoformat(metadata.get('timestamp', datetime.now().isoformat())),
                metadata={k: v for k, v in metadata.items() if k not in ['memory_type', 'timestamp']}
            )
        
        return None
    
    def count(self) -> int:
        """Count total memories"""
        return self.collection.count()
    
    def delete(self, entry_id: str) -> bool:
        """Delete a memory"""
        try:
            self.collection.delete(ids=[entry_id])
            return True
        except Exception:
            return False


class FAISSVectorStore(VectorStore):
    """
    FAISS vector database implementation
    High-performance similarity search
    """
    
    def __init__(
        self,
        dimension: int = 1536,
        persist_directory: str = "./faiss_data",
        embedding_function: Optional[Callable] = None
    ):
        try:
            import faiss
            import numpy as np
        except ImportError as e:
            raise ImportError(
                "faiss-cpu required. Install with: pip install faiss-cpu"
            ) from e

        self.dimension = dimension
        self.persist_directory = persist_directory
        self.embedding_function = embedding_function

        # Initialize FAISS index
        self.index = faiss.IndexFlatL2(dimension)

        # Metadata store (FAISS doesn't store metadata natively)
        self.metadata_store: Dict[int, MemoryEntry] = {}
        self.id_to_index: Dict[str, int] = {}
        self.next_index = 0

        # Load if exists
        os.makedirs(persist_directory, exist_ok=True)
        self._load_index()
    
    def store(self, entry: MemoryEntry):
        """Store memory entry in FAISS"""
        import numpy as np
        
        if not entry.embedding:
            if self.embedding_function:
                entry.embedding = self.embedding_function(entry.content)
            else:
                raise ValueError("Entry must have embedding")
        
        # Add to FAISS index
        embedding_array = np.array([entry.embedding], dtype=np.float32)
        self.index.add(embedding_array)
        
        # Store metadata
        self.metadata_store[self.next_index] = entry
        self.id_to_index[entry.id] = self.next_index
        self.next_index += 1
        
        # Persist
        self._save_index()
    
    def retrieve(
        self,
        query: str,
        limit: int = 5,
        memory_type: Optional[str] = None,
        memory_types: Optional[List[str]] = None,
        **kwargs
    ) -> RetrievalResult:
        """Retrieve relevant memories"""
        import numpy as np
        
        if not self.embedding_function:
            raise ValueError("Embedding function required")
        
        # Generate query embedding
        query_embedding = self.embedding_function(query)
        query_array = np.array([query_embedding], dtype=np.float32)
        
        # Search FAISS
        distances, indices = self.index.search(query_array, min(limit * 2, self.index.ntotal))
        
        # Filter and format results
        entries = []
        scores = []
        
        for dist, idx in zip(distances[0], indices[0]):
            if idx == -1:  # No more results
                break
            
            entry = self.metadata_store.get(int(idx))
            if not entry:
                continue
            
            # Filter by memory type
            if memory_type and entry.memory_type != memory_type:
                continue
            if memory_types and entry.memory_type not in memory_types:
                continue
            
            entries.append(entry)
            scores.append(float(dist))
            
            if len(entries) >= limit:
                break
        
        return RetrievalResult(
            entries=entries,
            scores=scores,
            metadata={"query": query, "limit": limit}
        )
    
    def get_by_id(self, entry_id: str) -> Optional[MemoryEntry]:
        """Get specific memory by ID"""
        idx = self.id_to_index.get(entry_id)
        return self.metadata_store.get(idx) if idx is not None else None
    
    def count(self) -> int:
        """Count total memories"""
        return self.index.ntotal
    
    def delete(self, entry_id: str) -> bool:
        """Delete a memory (FAISS doesn't support deletion, mark as deleted)"""
        idx = self.id_to_index.get(entry_id)
        if idx is not None and idx in self.metadata_store:
            del self.metadata_store[idx]
            del self.id_to_index[entry_id]
            return True
        return False
    
    def _save_index(self):
        """Save FAISS index and metadata"""
        import faiss
        
        # Save FAISS index
        index_path = os.path.join(self.persist_directory, "faiss.index")
        faiss.write_index(self.index, index_path)
        
        # Save metadata
        metadata_path = os.path.join(self.persist_directory, "metadata.json")
        metadata = {
            "entries": {
                str(idx): {
                    "id": entry.id,
                    "content": entry.content,
                    "memory_type": entry.memory_type,
                    "timestamp": entry.timestamp.isoformat(),
                    "metadata": entry.metadata
                }
                for idx, entry in self.metadata_store.items()
            },
            "id_to_index": self.id_to_index,
            "next_index": self.next_index
        }
        
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f)
    
    def _load_index(self):
        """Load FAISS index and metadata"""
        import faiss
        
        index_path = os.path.join(self.persist_directory, "faiss.index")
        metadata_path = os.path.join(self.persist_directory, "metadata.json")
        
        if os.path.exists(index_path) and os.path.exists(metadata_path):
            # Load FAISS index
            self.index = faiss.read_index(index_path)
            
            # Load metadata
            with open(metadata_path, 'r') as f:
                data = json.load(f)
            
            # Restore metadata store
            for idx_str, entry_data in data['entries'].items():
                idx = int(idx_str)
                self.metadata_store[idx] = MemoryEntry(
                    id=entry_data['id'],
                    content=entry_data['content'],
                    memory_type=entry_data['memory_type'],
                    timestamp=datetime.fromisoformat(entry_data['timestamp']),
                    metadata=entry_data['metadata']
                )
            
            self.id_to_index = data['id_to_index']
            self.next_index = data['next_index']


# Durable job/event stores (pilot)
try:
    from .job_store import JobStore, EventStore, JobRecord, JobEvent
except Exception:  # pragma: no cover - optional import to avoid runtime issues
    JobStore = None  # type: ignore
    EventStore = None  # type: ignore
    JobRecord = None  # type: ignore
    JobEvent = None  # type: ignore
"""
FireproofService: Local-first document store with CRDT support.

Implements a SQLite-backed document store that emulates Fireproof's
core capabilities:
- Document CRUD operations
- Index-based queries
- CRDT merge for conflict resolution
- Sync status tracking
- Optional local vector caching

This implementation can be replaced with native Fireproof bindings
when available for Python.
"""

from __future__ import annotations

import asyncio
import json
import logging
import sqlite3
import time
import uuid
from typing import Any, Callable, Dict, List, Optional, Tuple

from .config import FireproofConfig
from .schemas import (
    DocumentType,
    DurableBead,
    EmbeddingRef,
    FireproofDocument,
    LocalMemory,
    PromptMetadata,
    SyncStatus,
    migrate_document,
    validate_document,
)

logger = logging.getLogger("central_logger")


class FireproofService:
    """
    Local-first document store with CRDT support.
    
    Provides a Fireproof-compatible API backed by SQLite for
    Python environments. Supports document storage, indexed
    queries, and CRDT-based conflict resolution.
    
    Usage:
        service = FireproofService(config=FireproofConfig())
        await service.initialize()
        
        doc_id = await service.put({"type": "bead", "content": "hello"})
        doc = await service.get(doc_id)
        results = await service.query("type", {"key": "bead"})
    """
    
    def __init__(
        self,
        config: Optional[FireproofConfig] = None,
    ) -> None:
        """
        Initialize FireproofService.
        
        Args:
            config: Configuration settings. Uses defaults if not provided.
        """
        self.config = config or FireproofConfig()
        self._conn: Optional[sqlite3.Connection] = None
        self._initialized = False
        self._subscriptions: Dict[str, List[Callable]] = {}
        self._lock = asyncio.Lock()
        self._db_lock = asyncio.Lock()  # Lock for database write operations
    
    async def initialize(self) -> None:
        """
        Initialize the database connection and schema.
        
        Must be called before using other methods.
        """
        if self._initialized:
            return
        
        async with self._lock:
            if self._initialized:
                return
            
            self._conn = self._create_connection()
            self._init_schema()
            self._initialized = True
            
            logger.info(
                "fireproof.initialized",
                extra={
                    "db_name": self.config.db_name,
                    "db_path": self.config.db_path,
                }
            )
    
    def _create_connection(self) -> sqlite3.Connection:
        """Create SQLite connection."""
        db_path = self.config.db_path or ":memory:"
        conn = sqlite3.connect(db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn
    
    def _init_schema(self) -> None:
        """Initialize database schema."""
        assert self._conn is not None
        
        # Main documents table
        self._conn.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                _id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                data JSON NOT NULL,
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL,
                sync_status TEXT DEFAULT 'local',
                version INTEGER DEFAULT 1
            )
        """)
        
        # Indexes for common query patterns
        self._conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_docs_type ON documents(type)"
        )
        self._conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_docs_created ON documents(created_at DESC)"
        )
        self._conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_docs_sync ON documents(sync_status)"
        )
        self._conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_docs_updated ON documents(updated_at DESC)"
        )
        
        # Vector cache table (optional)
        self._conn.execute("""
            CREATE TABLE IF NOT EXISTS vector_cache (
                _id TEXT PRIMARY KEY,
                text_hash TEXT NOT NULL,
                vector BLOB,
                dimensions INTEGER,
                model TEXT,
                created_at REAL NOT NULL,
                FOREIGN KEY (_id) REFERENCES documents(_id) ON DELETE CASCADE
            )
        """)
        self._conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_vector_hash ON vector_cache(text_hash)"
        )
        
        self._conn.commit()
    
    def _ensure_initialized(self) -> None:
        """Ensure service is initialized."""
        if not self._initialized:
            raise RuntimeError("FireproofService not initialized. Call initialize() first.")
    
    async def put(self, doc: Dict[str, Any]) -> str:
        """
        Store or update a document.
        
        If the document has an _id that exists, it will be merged
        using CRDT semantics. Otherwise, a new document is created.
        
        Args:
            doc: Document data. Must include 'type' field.
            
        Returns:
            Document ID
            
        Note:
            This operation is thread-safe via asyncio.Lock.
        """
        self._ensure_initialized()
        assert self._conn is not None
        
        # Generate ID if not provided
        if "_id" not in doc:
            doc["_id"] = str(uuid.uuid4())
        
        doc_id = doc["_id"]
        now = time.time()
        
        # Set timestamps
        if "created_at" not in doc:
            doc["created_at"] = now
        doc["updated_at"] = now
        
        # Set sync status
        if "sync_status" not in doc:
            doc["sync_status"] = SyncStatus.PENDING.value
        
        # Validate document
        doc = migrate_document(doc)
        validate_document(doc)
        
        # Check for existing document
        existing = await self.get(doc_id)
        
        if existing and self.config.crdt_merge_enabled:
            # CRDT merge
            doc = self._crdt_merge(existing, doc)
        
        # Store document with lock for thread safety
        async with self._db_lock:
            self._conn.execute(
                """
                INSERT OR REPLACE INTO documents (_id, type, data, created_at, updated_at, sync_status, version)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    doc_id,
                    doc.get("type", ""),
                    json.dumps(doc),
                    doc.get("created_at", now),
                    doc.get("updated_at", now),
                    doc.get("sync_status", SyncStatus.PENDING.value),
                    doc.get("version", 1),
                )
            )
            self._conn.commit()
        
        # Notify subscribers
        await self._notify_subscribers(doc.get("type", ""), [doc])
        
        logger.debug(
            "fireproof.put",
            extra={"doc_id": doc_id, "type": doc.get("type")}
        )
        
        return doc_id
    
    async def get(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve a document by ID.
        
        Args:
            doc_id: Document ID
            
        Returns:
            Document data or None if not found
        """
        self._ensure_initialized()
        assert self._conn is not None
        
        cursor = self._conn.execute(
            "SELECT data FROM documents WHERE _id = ?",
            (doc_id,)
        )
        row = cursor.fetchone()
        
        if row:
            return json.loads(row["data"])
        return None
    
    async def delete(self, doc_id: str) -> bool:
        """
        Delete a document by ID.
        
        Args:
            doc_id: Document ID
            
        Returns:
            True if deleted, False if not found
            
        Note:
            This operation is thread-safe via asyncio.Lock.
        """
        self._ensure_initialized()
        assert self._conn is not None
        
        async with self._db_lock:
            cursor = self._conn.execute(
                "DELETE FROM documents WHERE _id = ?",
                (doc_id,)
            )
            self._conn.commit()
        
        deleted = cursor.rowcount > 0
        
        if deleted:
            logger.debug("fireproof.delete", extra={"doc_id": doc_id})
        
        return deleted
    
    # Allowlist of valid field names for queries to prevent SQL injection
    _VALID_QUERY_FIELDS = frozenset({
        "_id", "type", "created_at", "updated_at", "sync_status", "version",
        "content", "role", "importance", "tags", "original_bead_id",
        "memory_type", "embedding_ref", "confidence", "source_instance",
        "access_count", "last_accessed", "session_id", "conversation_turn",
        "prompt_hash", "prompt_version", "model", "provider", "tokens_in",
        "tokens_out", "tokens_context", "latency_ms", "score", "error",
        "text_hash", "zep_id", "dimensions",
    })
    
    def _validate_field_name(self, field: str) -> str:
        """
        Validate field name against allowlist to prevent SQL injection.
        
        Args:
            field: Field name to validate
            
        Returns:
            Validated field name
            
        Raises:
            ValueError: If field name is not in allowlist
        """
        if field not in self._VALID_QUERY_FIELDS:
            raise ValueError(
                f"Invalid field name '{field}'. "
                f"Allowed fields: {sorted(self._VALID_QUERY_FIELDS)}"
            )
        return field
    
    async def query(
        self,
        index: str,
        options: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Query documents by index.
        
        Args:
            index: Field name to query (e.g., "type", "_id", "sync_status")
            options: Query options:
                - key: Exact value to match
                - keys: List of values to match (OR)
                - range: Dict with gte, gt, lte, lt bounds
                - limit: Maximum results (default 100)
                - descending: Sort descending (default False)
                - filter: Additional filter dict
                
        Returns:
            List of matching documents
            
        Raises:
            ValueError: If index or filter field names are invalid
        """
        self._ensure_initialized()
        assert self._conn is not None
        
        # Validate index field name
        index = self._validate_field_name(index)
        
        options = options or {}
        limit = options.get("limit", 100)
        descending = options.get("descending", False)
        key = options.get("key")
        keys = options.get("keys")
        range_opts = options.get("range", {})
        extra_filter = options.get("filter", {})
        
        # Validate extra filter field names
        for field in extra_filter.keys():
            self._validate_field_name(field)
        
        # Build query
        sql = "SELECT data FROM documents WHERE 1=1"
        params: List[Any] = []
        
        # Index filter
        if key is not None:
            sql += f" AND json_extract(data, '$.{index}') = ?"
            params.append(key)
        elif keys:
            placeholders = ",".join("?" * len(keys))
            sql += f" AND json_extract(data, '$.{index}') IN ({placeholders})"
            params.extend(keys)
        
        # Range filter
        if "gte" in range_opts:
            sql += f" AND json_extract(data, '$.{index}') >= ?"
            params.append(range_opts["gte"])
        if "gt" in range_opts:
            sql += f" AND json_extract(data, '$.{index}') > ?"
            params.append(range_opts["gt"])
        if "lte" in range_opts:
            sql += f" AND json_extract(data, '$.{index}') <= ?"
            params.append(range_opts["lte"])
        if "lt" in range_opts:
            sql += f" AND json_extract(data, '$.{index}') < ?"
            params.append(range_opts["lt"])
        
        # Extra filters
        for field, value in extra_filter.items():
            sql += f" AND json_extract(data, '$.{field}') = ?"
            params.append(value)
        
        # Ordering
        order = "DESC" if descending else "ASC"
        if index == "_id":
            sql += f" ORDER BY _id {order}"
        elif index == "created_at":
            sql += f" ORDER BY created_at {order}"
        else:
            sql += f" ORDER BY json_extract(data, '$.{index}') {order}"
        
        # Limit
        sql += " LIMIT ?"
        params.append(limit)
        
        cursor = self._conn.execute(sql, params)
        rows = cursor.fetchall()
        
        results = [json.loads(row["data"]) for row in rows]
        
        logger.debug(
            "fireproof.query",
            extra={"index": index, "count": len(results)}
        )
        
        return results
    
    async def query_pending(self, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Query documents pending sync.
        
        Args:
            limit: Maximum results
            
        Returns:
            List of pending documents
        """
        return await self.query("sync_status", {
            "key": SyncStatus.PENDING.value,
            "limit": limit,
        })
    
    async def count(self, doc_type: Optional[str] = None) -> int:
        """
        Count documents.
        
        Args:
            doc_type: Optional type filter
            
        Returns:
            Document count
        """
        self._ensure_initialized()
        assert self._conn is not None
        
        if doc_type:
            cursor = self._conn.execute(
                "SELECT COUNT(*) FROM documents WHERE type = ?",
                (doc_type,)
            )
        else:
            cursor = self._conn.execute("SELECT COUNT(*) FROM documents")
        
        return cursor.fetchone()[0]
    
    async def local_similarity_search(
        self,
        query_vector: List[float],
        k: int = 5,
        doc_type: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Search locally cached embeddings by similarity.
        
        Uses brute-force cosine similarity on cached vectors.
        For production, use Zep's ANN search instead.
        
        Args:
            query_vector: Query embedding vector
            k: Number of results
            doc_type: Optional document type filter
            
        Returns:
            List of documents sorted by similarity
        """
        self._ensure_initialized()
        assert self._conn is not None
        
        if not self.config.local_vector_cache:
            return []
        
        # Get all cached vectors
        sql = """
            SELECT d.data, v.vector
            FROM documents d
            JOIN vector_cache v ON d._id = v._id
            WHERE v.vector IS NOT NULL
        """
        params: List[Any] = []
        
        if doc_type:
            sql += " AND d.type = ?"
            params.append(doc_type)
        
        cursor = self._conn.execute(sql, params)
        rows = cursor.fetchall()
        
        if not rows:
            return []
        
        # Calculate similarities
        import struct
        
        def cosine_similarity(v1: List[float], v2: List[float]) -> float:
            """Calculate cosine similarity between two vectors."""
            dot = sum(a * b for a, b in zip(v1, v2))
            norm1 = sum(a * a for a in v1) ** 0.5
            norm2 = sum(b * b for b in v2) ** 0.5
            if norm1 == 0 or norm2 == 0:
                return 0.0
            return dot / (norm1 * norm2)
        
        results: List[Tuple[float, Dict[str, Any]]] = []
        
        for row in rows:
            doc = json.loads(row["data"])
            vector_blob = row["vector"]
            
            if vector_blob:
                # Decode vector from blob
                vector = list(struct.unpack(f"{len(vector_blob)//8}d", vector_blob))
                similarity = cosine_similarity(query_vector, vector)
                results.append((similarity, doc))
        
        # Sort by similarity descending
        results.sort(key=lambda x: x[0], reverse=True)
        
        return [doc for _, doc in results[:k]]
    
    async def store_embedding(
        self,
        doc_id: str,
        text_hash: str,
        vector: List[float],
        model: str,
    ) -> None:
        """
        Store an embedding vector in local cache.
        
        Args:
            doc_id: Document ID
            text_hash: Hash of embedded text
            vector: Embedding vector
            model: Model name
            
        Note:
            This operation is thread-safe via asyncio.Lock.
        """
        self._ensure_initialized()
        assert self._conn is not None
        
        if not self.config.local_vector_cache:
            return
        
        import struct
        vector_blob = struct.pack(f"{len(vector)}d", *vector)
        
        async with self._db_lock:
            self._conn.execute(
                """
                INSERT OR REPLACE INTO vector_cache (_id, text_hash, vector, dimensions, model, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (doc_id, text_hash, vector_blob, len(vector), model, time.time())
            )
            self._conn.commit()
    
    def subscribe(
        self,
        doc_type: str,
        callback: Callable[[List[Dict[str, Any]]], None],
    ) -> Callable[[], None]:
        """
        Subscribe to document changes.
        
        Args:
            doc_type: Document type to watch
            callback: Function called with changed documents
            
        Returns:
            Unsubscribe function
        """
        if doc_type not in self._subscriptions:
            self._subscriptions[doc_type] = []
        
        self._subscriptions[doc_type].append(callback)
        
        def unsubscribe() -> None:
            if doc_type in self._subscriptions:
                self._subscriptions[doc_type].remove(callback)
        
        return unsubscribe
    
    async def _notify_subscribers(
        self,
        doc_type: str,
        docs: List[Dict[str, Any]],
    ) -> None:
        """Notify subscribers of document changes."""
        if doc_type in self._subscriptions:
            for callback in self._subscriptions[doc_type]:
                try:
                    callback(docs)
                except Exception as e:
                    logger.warning(
                        "fireproof.subscriber_error",
                        extra={"type": doc_type, "error": str(e)}
                    )
    
    def _crdt_merge(
        self,
        existing: Dict[str, Any],
        incoming: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        CRDT merge two documents.
        
        Uses last-writer-wins for scalar fields and union for arrays.
        
        Args:
            existing: Existing document
            incoming: Incoming document
            
        Returns:
            Merged document
        """
        merged = existing.copy()
        
        for key, value in incoming.items():
            if key == "_id":
                continue  # Don't merge ID
            
            existing_value = existing.get(key)
            
            if existing_value is None:
                # New field
                merged[key] = value
            elif isinstance(value, list) and isinstance(existing_value, list):
                # Array: union with deduplication
                merged[key] = list(set(existing_value + value))
            elif key in ("version", "access_count"):
                # Counters: take max
                merged[key] = max(existing_value, value)
            elif key in ("importance", "confidence", "score"):
                # Scores: take max (or could use weighted average)
                if value is not None and existing_value is not None:
                    merged[key] = max(existing_value, value)
                elif value is not None:
                    merged[key] = value
            elif key == "updated_at":
                # Timestamp: take latest
                merged[key] = max(existing_value, value)
            elif key == "sync_status":
                # Sync status: pending wins over synced
                if value == SyncStatus.PENDING.value:
                    merged[key] = value
            else:
                # Scalar: last-writer-wins based on updated_at
                if incoming.get("updated_at", 0) >= existing.get("updated_at", 0):
                    merged[key] = value
        
        # Increment version
        merged["version"] = merged.get("version", 0) + 1
        
        return merged
    
    async def prune(self) -> Dict[str, int]:
        """
        Prune old documents based on TTL and max_documents.
        
        Returns:
            Dict with counts of pruned documents by reason
            
        Note:
            This operation is thread-safe via asyncio.Lock.
        """
        self._ensure_initialized()
        assert self._conn is not None
        
        pruned = {"ttl": 0, "max": 0}
        now = time.time()
        
        async with self._db_lock:
            # TTL pruning
            if self.config.ttl_seconds:
                cutoff = now - self.config.ttl_seconds
                cursor = self._conn.execute(
                    "DELETE FROM documents WHERE created_at < ? AND sync_status = ?",
                    (cutoff, SyncStatus.SYNCED.value)  # Only prune synced docs
                )
                pruned["ttl"] = cursor.rowcount or 0
            
            # Max documents pruning - get count outside lock to avoid deadlock
            count = await self.count()
            if self.config.max_documents and count > self.config.max_documents:
                excess = count - self.config.max_documents
                # Delete oldest synced documents
                cursor = self._conn.execute(
                    """
                    DELETE FROM documents WHERE _id IN (
                        SELECT _id FROM documents
                        WHERE sync_status = ?
                        ORDER BY created_at ASC
                        LIMIT ?
                    )
                    """,
                    (SyncStatus.SYNCED.value, excess)
                )
                pruned["max"] = cursor.rowcount or 0
            
            if pruned["ttl"] or pruned["max"]:
                self._conn.commit()
        
        if pruned["ttl"] or pruned["max"]:
            logger.info("fireproof.pruned", extra=pruned)
        
        return pruned
    
    async def export_all(self) -> List[Dict[str, Any]]:
        """
        Export all documents for backup.
        
        Returns:
            List of all documents
        """
        self._ensure_initialized()
        assert self._conn is not None
        
        cursor = self._conn.execute("SELECT data FROM documents")
        return [json.loads(row["data"]) for row in cursor.fetchall()]
    
    async def import_documents(
        self,
        docs: List[Dict[str, Any]],
        mark_pending: bool = True,
    ) -> int:
        """
        Import documents from backup.
        
        Args:
            docs: List of documents to import
            mark_pending: Mark imported docs as pending sync
            
        Returns:
            Number of documents imported
        """
        count = 0
        for doc in docs:
            if mark_pending:
                doc["sync_status"] = SyncStatus.PENDING.value
            await self.put(doc)
            count += 1
        
        logger.info("fireproof.imported", extra={"count": count})
        return count
    
    async def close(self) -> None:
        """Close database connection."""
        if self._conn:
            self._conn.close()
            self._conn = None
            self._initialized = False
            logger.info("fireproof.closed")
    
    # Typed document helpers
    
    async def put_bead(self, bead: DurableBead) -> str:
        """Store a DurableBead document."""
        return await self.put(bead.to_dict())
    
    async def put_memory(self, memory: LocalMemory) -> str:
        """Store a LocalMemory document."""
        return await self.put(memory.to_dict())
    
    async def put_metadata(self, metadata: PromptMetadata) -> str:
        """Store a PromptMetadata document."""
        return await self.put(metadata.to_dict())
    
    async def put_embedding_ref(self, ref: EmbeddingRef) -> str:
        """Store an EmbeddingRef document."""
        doc_id = await self.put(ref.to_dict())
        
        # Cache vector if present
        if ref.local_cache and self.config.local_vector_cache:
            await self.store_embedding(
                doc_id,
                ref.text_hash,
                ref.local_cache,
                ref.model,
            )
        
        return doc_id
    
    async def query_beads(
        self,
        limit: int = 10,
        min_importance: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """
        Query DurableBead documents.
        
        Args:
            limit: Maximum number of results
            min_importance: Optional minimum importance filter (uses SQL for efficiency)
            
        Returns:
            List of DurableBead documents sorted by created_at descending
        """
        self._ensure_initialized()
        assert self._conn is not None
        
        # Build optimized SQL query with importance filter in WHERE clause
        sql = """
            SELECT data FROM documents
            WHERE type = ?
        """
        params: List[Any] = [DocumentType.BEAD.value]
        
        # Apply min_importance filter directly in SQL for efficiency
        if min_importance is not None:
            sql += " AND json_extract(data, '$.importance') >= ?"
            params.append(min_importance)
        
        sql += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        
        cursor = self._conn.execute(sql, params)
        rows = cursor.fetchall()
        
        results = [json.loads(row["data"]) for row in rows]
        
        logger.debug(
            "fireproof.query_beads",
            extra={"count": len(results), "min_importance": min_importance}
        )
        
        return results
    
    async def query_metadata(
        self,
        session_id: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """Query PromptMetadata documents."""
        options: Dict[str, Any] = {
            "key": DocumentType.METADATA.value,
            "limit": limit,
            "descending": True,
        }
        
        if session_id:
            options["filter"] = {"session_id": session_id}
        
        return await self.query("type", options)

"""
Embedding Cache - Persistent embedding storage.

SQLite-backed cache for embeddings with TTL and LRU eviction.
"""

import hashlib
import json
import logging
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


class EmbeddingCache:
    """
    Persistent embedding cache using SQLite.
    
    Features:
    - Content-addressed storage (hash-based)
    - TTL-based expiration
    - LRU eviction when full
    - Model-specific caching
    - Statistics tracking
    
    Usage:
        cache = EmbeddingCache(Path("./cache/embeddings.db"))
        
        # Get or compute embedding
        vector = cache.get("hello world", model="nomic-embed-text")
        if vector is None:
            vector = compute_embedding("hello world")
            cache.set("hello world", vector, model="nomic-embed-text")
    """
    
    DEFAULT_TTL_DAYS = 30
    DEFAULT_MAX_SIZE = 100_000
    
    def __init__(
        self,
        cache_path: Optional[Path] = None,
        ttl_days: int = DEFAULT_TTL_DAYS,
        max_entries: int = DEFAULT_MAX_SIZE,
    ):
        """
        Initialize embedding cache.
        
        Args:
            cache_path: Path to SQLite database (None for memory-only)
            ttl_days: Time-to-live in days
            max_entries: Maximum cache entries before eviction
        """
        self.ttl_days = ttl_days
        self.max_entries = max_entries
        
        if cache_path:
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            self._conn = sqlite3.connect(str(cache_path), check_same_thread=False)
        else:
            self._conn = sqlite3.connect(":memory:", check_same_thread=False)
        
        self._conn.row_factory = sqlite3.Row
        self._init_schema()
        
        # Track stats
        self._hits = 0
        self._misses = 0
    
    def _init_schema(self) -> None:
        """Initialize database schema."""
        cursor = self._conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS embeddings (
                content_hash TEXT NOT NULL,
                model TEXT NOT NULL,
                vector BLOB NOT NULL,
                dimensions INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                last_accessed TEXT NOT NULL,
                access_count INTEGER DEFAULT 1,
                PRIMARY KEY (content_hash, model)
            )
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_expires_at 
            ON embeddings(expires_at)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_last_accessed 
            ON embeddings(last_accessed)
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS cache_stats (
                id INTEGER PRIMARY KEY,
                total_hits INTEGER DEFAULT 0,
                total_misses INTEGER DEFAULT 0,
                total_evictions INTEGER DEFAULT 0,
                last_cleanup TEXT
            )
        """)
        
        # Initialize stats row
        cursor.execute("""
            INSERT OR IGNORE INTO cache_stats (id, total_hits, total_misses)
            VALUES (1, 0, 0)
        """)
        
        self._conn.commit()
    
    def _hash_content(self, content: str) -> str:
        """Generate content hash."""
        return hashlib.sha256(content.encode()).hexdigest()
    
    def get(
        self, 
        content: str, 
        model: str = "default"
    ) -> Optional[List[float]]:
        """
        Get cached embedding.
        
        Args:
            content: Text content
            model: Model name
            
        Returns:
            Embedding vector or None if not found
        """
        content_hash = self._hash_content(content)
        now = datetime.now().isoformat()
        
        cursor = self._conn.cursor()
        cursor.execute("""
            SELECT vector, expires_at FROM embeddings
            WHERE content_hash = ? AND model = ?
        """, (content_hash, model))
        
        row = cursor.fetchone()
        
        if row is None:
            self._misses += 1
            return None
        
        # Check expiration
        if row["expires_at"] < now:
            self._misses += 1
            cursor.execute("""
                DELETE FROM embeddings
                WHERE content_hash = ? AND model = ?
            """, (content_hash, model))
            self._conn.commit()
            return None
        
        # Update access time
        cursor.execute("""
            UPDATE embeddings
            SET last_accessed = ?, access_count = access_count + 1
            WHERE content_hash = ? AND model = ?
        """, (now, content_hash, model))
        self._conn.commit()
        
        self._hits += 1
        return json.loads(row["vector"])
    
    def set(
        self,
        content: str,
        vector: List[float],
        model: str = "default",
    ) -> None:
        """
        Cache an embedding.
        
        Args:
            content: Text content
            vector: Embedding vector
            model: Model name
        """
        content_hash = self._hash_content(content)
        now = datetime.now()
        expires = now + timedelta(days=self.ttl_days)
        
        cursor = self._conn.cursor()
        
        # Check cache size
        cursor.execute("SELECT COUNT(*) as count FROM embeddings")
        count = cursor.fetchone()["count"]
        
        if count >= self.max_entries:
            self._evict_lru()
        
        # Insert or update
        cursor.execute("""
            INSERT OR REPLACE INTO embeddings
            (content_hash, model, vector, dimensions, created_at, expires_at, last_accessed)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            content_hash,
            model,
            json.dumps(vector),
            len(vector),
            now.isoformat(),
            expires.isoformat(),
            now.isoformat(),
        ))
        
        self._conn.commit()
    
    def get_batch(
        self,
        contents: List[str],
        model: str = "default",
    ) -> Tuple[Dict[str, List[float]], List[str]]:
        """
        Get batch of cached embeddings.
        
        Args:
            contents: List of text contents
            model: Model name
            
        Returns:
            (found_embeddings, missing_contents)
        """
        found = {}
        missing = []
        
        for content in contents:
            vector = self.get(content, model)
            if vector is not None:
                found[content] = vector
            else:
                missing.append(content)
        
        return found, missing
    
    def set_batch(
        self,
        embeddings: Dict[str, List[float]],
        model: str = "default",
    ) -> None:
        """
        Cache batch of embeddings.
        
        Args:
            embeddings: Dict mapping content to vector
            model: Model name
        """
        for content, vector in embeddings.items():
            self.set(content, vector, model)
    
    def _evict_lru(self, count: int = 100) -> int:
        """
        Evict least recently used entries.
        
        Args:
            count: Number of entries to evict
            
        Returns:
            Number of entries evicted
        """
        cursor = self._conn.cursor()
        
        cursor.execute("""
            DELETE FROM embeddings
            WHERE rowid IN (
                SELECT rowid FROM embeddings
                ORDER BY last_accessed ASC
                LIMIT ?
            )
        """, (count,))
        
        evicted = cursor.rowcount
        self._conn.commit()
        
        # Update stats
        cursor.execute("""
            UPDATE cache_stats
            SET total_evictions = total_evictions + ?
            WHERE id = 1
        """, (evicted,))
        self._conn.commit()
        
        return evicted
    
    def cleanup_expired(self) -> int:
        """
        Remove expired entries.
        
        Returns:
            Number of entries removed
        """
        now = datetime.now().isoformat()
        
        cursor = self._conn.cursor()
        cursor.execute("""
            DELETE FROM embeddings
            WHERE expires_at < ?
        """, (now,))
        
        removed = cursor.rowcount
        
        cursor.execute("""
            UPDATE cache_stats
            SET last_cleanup = ?
            WHERE id = 1
        """, (now,))
        
        self._conn.commit()
        return removed
    
    def get_stats(self) -> Dict:
        """Get cache statistics."""
        cursor = self._conn.cursor()
        
        cursor.execute("SELECT COUNT(*) as count FROM embeddings")
        entry_count = cursor.fetchone()["count"]
        
        cursor.execute("""
            SELECT total_hits, total_misses, total_evictions, last_cleanup
            FROM cache_stats WHERE id = 1
        """)
        stats_row = cursor.fetchone()
        
        # Get model distribution
        cursor.execute("""
            SELECT model, COUNT(*) as count
            FROM embeddings
            GROUP BY model
        """)
        models = {row["model"]: row["count"] for row in cursor.fetchall()}
        
        total_hits = (stats_row["total_hits"] or 0) + self._hits
        total_misses = (stats_row["total_misses"] or 0) + self._misses
        
        hit_rate = total_hits / (total_hits + total_misses) if (total_hits + total_misses) > 0 else 0
        
        return {
            "entries": entry_count,
            "max_entries": self.max_entries,
            "fill_ratio": entry_count / self.max_entries if self.max_entries > 0 else 0,
            "ttl_days": self.ttl_days,
            "session_hits": self._hits,
            "session_misses": self._misses,
            "total_hits": total_hits,
            "total_misses": total_misses,
            "total_evictions": stats_row["total_evictions"] or 0,
            "hit_rate": hit_rate,
            "last_cleanup": stats_row["last_cleanup"],
            "models": models,
        }
    
    def clear(self, model: Optional[str] = None) -> int:
        """
        Clear cache entries.
        
        Args:
            model: If specified, only clear entries for this model
            
        Returns:
            Number of entries cleared
        """
        cursor = self._conn.cursor()
        
        if model:
            cursor.execute("DELETE FROM embeddings WHERE model = ?", (model,))
        else:
            cursor.execute("DELETE FROM embeddings")
        
        cleared = cursor.rowcount
        self._conn.commit()
        return cleared
    
    def save_session_stats(self) -> None:
        """Save session statistics to database."""
        cursor = self._conn.cursor()
        cursor.execute("""
            UPDATE cache_stats
            SET total_hits = total_hits + ?,
                total_misses = total_misses + ?
            WHERE id = 1
        """, (self._hits, self._misses))
        self._conn.commit()
        
        self._hits = 0
        self._misses = 0
    
    def close(self) -> None:
        """Close cache connection."""
        self.save_session_stats()
        self._conn.close()

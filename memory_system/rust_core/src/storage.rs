//! Storage backend for persistent memory
//!
//! Provides SQLite-based storage with CRDT-aware operations.

use crate::memory::{EmbeddingDocument, MemoryDocument, MemoryCollection};
use pyo3::prelude::*;
use rusqlite::{params, Connection, Result as SqliteResult};
use std::path::Path;
use std::sync::{Arc, Mutex};

/// Storage error types
#[derive(Debug)]
pub enum StorageError {
    Database(String),
    Serialization(String),
    NotFound(String),
    Conflict(String),
}

impl std::fmt::Display for StorageError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StorageError::Database(msg) => write!(f, "Database error: {}", msg),
            StorageError::Serialization(msg) => write!(f, "Serialization error: {}", msg),
            StorageError::NotFound(msg) => write!(f, "Not found: {}", msg),
            StorageError::Conflict(msg) => write!(f, "Conflict: {}", msg),
        }
    }
}

impl std::error::Error for StorageError {}

impl From<rusqlite::Error> for StorageError {
    fn from(err: rusqlite::Error) -> Self {
        StorageError::Database(err.to_string())
    }
}

impl From<serde_json::Error> for StorageError {
    fn from(err: serde_json::Error) -> Self {
        StorageError::Serialization(err.to_string())
    }
}

/// SQLite-based storage backend
#[pyclass]
pub struct MemoryStorage {
    conn: Arc<Mutex<Connection>>,
    instance_id: String,
}

impl MemoryStorage {
    fn init_schema(conn: &Connection) -> SqliteResult<()> {
        conn.execute_batch(
            r#"
            -- Main memories table
            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                data JSON NOT NULL,
                content_hash TEXT NOT NULL,
                memory_type TEXT NOT NULL,
                importance REAL NOT NULL,
                confidence REAL NOT NULL,
                access_count INTEGER NOT NULL,
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL,
                version INTEGER NOT NULL,
                sync_status TEXT NOT NULL DEFAULT 'local'
            );

            -- Indexes for common queries
            CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(memory_type);
            CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC);
            CREATE INDEX IF NOT EXISTS idx_memories_updated ON memories(updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_memories_sync ON memories(sync_status);
            CREATE INDEX IF NOT EXISTS idx_memories_hash ON memories(content_hash);

            -- Embeddings table
            CREATE TABLE IF NOT EXISTS embeddings (
                id TEXT PRIMARY KEY,
                text_hash TEXT NOT NULL UNIQUE,
                vector BLOB NOT NULL,
                dimensions INTEGER NOT NULL,
                model TEXT NOT NULL,
                created_at REAL NOT NULL,
                sync_status TEXT NOT NULL DEFAULT 'local'
            );

            CREATE INDEX IF NOT EXISTS idx_embeddings_hash ON embeddings(text_hash);
            CREATE INDEX IF NOT EXISTS idx_embeddings_model ON embeddings(model);

            -- Tags index (for fast tag queries)
            CREATE TABLE IF NOT EXISTS memory_tags (
                memory_id TEXT NOT NULL,
                tag TEXT NOT NULL,
                PRIMARY KEY (memory_id, tag),
                FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_tags_tag ON memory_tags(tag);

            -- Sync queue for pending operations
            CREATE TABLE IF NOT EXISTS sync_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                doc_type TEXT NOT NULL,
                doc_id TEXT NOT NULL,
                operation TEXT NOT NULL,
                data JSON,
                created_at REAL NOT NULL,
                attempts INTEGER DEFAULT 0,
                last_attempt REAL
            );

            CREATE INDEX IF NOT EXISTS idx_sync_queue_type ON sync_queue(doc_type, operation);
            "#,
        )?;

        Ok(())
    }
}

#[pymethods]
impl MemoryStorage {
    /// Create a new storage instance
    #[new]
    #[pyo3(signature = (path=None, instance_id=None))]
    pub fn new(path: Option<String>, instance_id: Option<String>) -> PyResult<Self> {
        let db_path = path.unwrap_or_else(|| ":memory:".to_string());

        let conn = if db_path == ":memory:" {
            Connection::open_in_memory()
        } else {
            // Create parent directories if needed
            if let Some(parent) = Path::new(&db_path).parent() {
                std::fs::create_dir_all(parent).ok();
            }
            Connection::open(&db_path)
        }
        .map_err(|e| pyo3::exceptions::PyIOError::new_err(e.to_string()))?;

        // Enable WAL mode for better concurrency
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")
            .ok();

        Self::init_schema(&conn)
            .map_err(|e| pyo3::exceptions::PyIOError::new_err(e.to_string()))?;

        Ok(MemoryStorage {
            conn: Arc::new(Mutex::new(conn)),
            instance_id: instance_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
        })
    }

    /// Store or merge a memory document
    pub fn put(&self, memory: &MemoryDocument) -> PyResult<String> {
        let conn = self.conn.lock().unwrap();

        // Check if exists
        let existing: Option<String> = conn
            .query_row(
                "SELECT data FROM memories WHERE id = ?",
                params![&memory.id],
                |row| row.get(0),
            )
            .ok();

        let final_memory = if let Some(existing_json) = existing {
            // Merge with existing
            let existing_doc: MemoryDocument = serde_json::from_str(&existing_json)
                .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
            existing_doc.merge(memory)
        } else {
            memory.clone()
        };

        let json = serde_json::to_string(&final_memory)
            .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;

        conn.execute(
            r#"
            INSERT OR REPLACE INTO memories
            (id, data, content_hash, memory_type, importance, confidence,
             access_count, created_at, updated_at, version, sync_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
            params![
                &final_memory.id,
                &json,
                &final_memory.content_hash,
                &final_memory.memory_type,
                final_memory.get_importance(),
                final_memory.get_confidence(),
                final_memory.get_access_count() as i64,
                final_memory.created_at,
                final_memory.updated_at,
                final_memory.version as i64,
                &final_memory.sync_status,
            ],
        )
        .map_err(|e| pyo3::exceptions::PyIOError::new_err(e.to_string()))?;

        // Update tags index
        conn.execute("DELETE FROM memory_tags WHERE memory_id = ?", params![&final_memory.id])
            .ok();

        for tag in final_memory.get_tags() {
            conn.execute(
                "INSERT OR IGNORE INTO memory_tags (memory_id, tag) VALUES (?, ?)",
                params![&final_memory.id, &tag],
            )
            .ok();
        }

        // Queue for sync
        conn.execute(
            "INSERT INTO sync_queue (doc_type, doc_id, operation, data, created_at) VALUES (?, ?, ?, ?, ?)",
            params![
                "memory",
                &final_memory.id,
                "upsert",
                &json,
                final_memory.updated_at,
            ],
        )
        .ok();

        Ok(final_memory.id.clone())
    }

    /// Get a memory by ID
    pub fn get(&self, id: &str) -> PyResult<Option<MemoryDocument>> {
        let conn = self.conn.lock().unwrap();

        let result: Option<String> = conn
            .query_row(
                "SELECT data FROM memories WHERE id = ?",
                params![id],
                |row| row.get(0),
            )
            .ok();

        match result {
            Some(json) => {
                let memory: MemoryDocument = serde_json::from_str(&json)
                    .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
                Ok(Some(memory))
            }
            None => Ok(None),
        }
    }

    /// Get all memories
    pub fn all(&self) -> PyResult<Vec<MemoryDocument>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT data FROM memories ORDER BY updated_at DESC")
            .map_err(|e| pyo3::exceptions::PyIOError::new_err(e.to_string()))?;

        let memories: Vec<MemoryDocument> = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| pyo3::exceptions::PyIOError::new_err(e.to_string()))?
            .filter_map(|r| r.ok())
            .filter_map(|json| serde_json::from_str(&json).ok())
            .collect();

        Ok(memories)
    }

    /// Get memory count
    pub fn count(&self) -> PyResult<usize> {
        let conn = self.conn.lock().unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM memories", [], |row| row.get(0))
            .map_err(|e| pyo3::exceptions::PyIOError::new_err(e.to_string()))?;
        Ok(count as usize)
    }

    /// Query by type
    pub fn query_by_type(&self, memory_type: &str) -> PyResult<Vec<MemoryDocument>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT data FROM memories WHERE memory_type = ? ORDER BY updated_at DESC")
            .map_err(|e| pyo3::exceptions::PyIOError::new_err(e.to_string()))?;

        let memories: Vec<MemoryDocument> = stmt
            .query_map(params![memory_type], |row| row.get::<_, String>(0))
            .map_err(|e| pyo3::exceptions::PyIOError::new_err(e.to_string()))?
            .filter_map(|r| r.ok())
            .filter_map(|json| serde_json::from_str(&json).ok())
            .collect();

        Ok(memories)
    }

    /// Query by minimum importance
    pub fn query_by_importance(&self, min_importance: f64) -> PyResult<Vec<MemoryDocument>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT data FROM memories WHERE importance >= ? ORDER BY importance DESC")
            .map_err(|e| pyo3::exceptions::PyIOError::new_err(e.to_string()))?;

        let memories: Vec<MemoryDocument> = stmt
            .query_map(params![min_importance], |row| row.get::<_, String>(0))
            .map_err(|e| pyo3::exceptions::PyIOError::new_err(e.to_string()))?
            .filter_map(|r| r.ok())
            .filter_map(|json| serde_json::from_str(&json).ok())
            .collect();

        Ok(memories)
    }

    /// Query by tag
    pub fn query_by_tag(&self, tag: &str) -> PyResult<Vec<MemoryDocument>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                r#"
                SELECT m.data FROM memories m
                JOIN memory_tags t ON m.id = t.memory_id
                WHERE t.tag = ?
                ORDER BY m.updated_at DESC
                "#,
            )
            .map_err(|e| pyo3::exceptions::PyIOError::new_err(e.to_string()))?;

        let memories: Vec<MemoryDocument> = stmt
            .query_map(params![tag], |row| row.get::<_, String>(0))
            .map_err(|e| pyo3::exceptions::PyIOError::new_err(e.to_string()))?
            .filter_map(|r| r.ok())
            .filter_map(|json| serde_json::from_str(&json).ok())
            .collect();

        Ok(memories)
    }

    /// Get recent memories
    pub fn recent(&self, limit: usize) -> PyResult<Vec<MemoryDocument>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT data FROM memories ORDER BY updated_at DESC LIMIT ?")
            .map_err(|e| pyo3::exceptions::PyIOError::new_err(e.to_string()))?;

        let memories: Vec<MemoryDocument> = stmt
            .query_map(params![limit as i64], |row| row.get::<_, String>(0))
            .map_err(|e| pyo3::exceptions::PyIOError::new_err(e.to_string()))?
            .filter_map(|r| r.ok())
            .filter_map(|json| serde_json::from_str(&json).ok())
            .collect();

        Ok(memories)
    }

    /// Store an embedding
    pub fn put_embedding(&self, embedding: &EmbeddingDocument) -> PyResult<String> {
        let conn = self.conn.lock().unwrap();

        // Convert vector to bytes
        let vector_bytes: Vec<u8> = embedding
            .vector
            .iter()
            .flat_map(|f| f.to_le_bytes())
            .collect();

        conn.execute(
            r#"
            INSERT OR REPLACE INTO embeddings
            (id, text_hash, vector, dimensions, model, created_at, sync_status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            "#,
            params![
                &embedding.id,
                &embedding.text_hash,
                &vector_bytes,
                embedding.dimensions as i64,
                &embedding.model,
                embedding.created_at,
                &embedding.sync_status,
            ],
        )
        .map_err(|e| pyo3::exceptions::PyIOError::new_err(e.to_string()))?;

        Ok(embedding.id.clone())
    }

    /// Get embedding by text hash
    pub fn get_embedding_by_hash(&self, text_hash: &str) -> PyResult<Option<EmbeddingDocument>> {
        let conn = self.conn.lock().unwrap();

        let result: Option<(String, Vec<u8>, i64, String, f64, String)> = conn
            .query_row(
                "SELECT id, vector, dimensions, model, created_at, sync_status FROM embeddings WHERE text_hash = ?",
                params![text_hash],
                |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                        row.get(5)?,
                    ))
                },
            )
            .ok();

        match result {
            Some((id, vector_bytes, dimensions, model, created_at, sync_status)) => {
                // Convert bytes back to f32 vector
                let vector: Vec<f32> = vector_bytes
                    .chunks_exact(4)
                    .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
                    .collect();

                Ok(Some(EmbeddingDocument {
                    id,
                    text_hash: text_hash.to_string(),
                    vector,
                    dimensions: dimensions as usize,
                    model,
                    created_at,
                    sync_status,
                }))
            }
            None => Ok(None),
        }
    }

    /// Get pending sync items
    pub fn get_pending_sync(&self, limit: usize) -> PyResult<Vec<(String, String, String)>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                "SELECT doc_type, doc_id, data FROM sync_queue ORDER BY created_at ASC LIMIT ?",
            )
            .map_err(|e| pyo3::exceptions::PyIOError::new_err(e.to_string()))?;

        let items: Vec<(String, String, String)> = stmt
            .query_map(params![limit as i64], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?))
            })
            .map_err(|e| pyo3::exceptions::PyIOError::new_err(e.to_string()))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(items)
    }

    /// Mark items as synced
    pub fn mark_synced(&self, doc_ids: Vec<String>) -> PyResult<usize> {
        let conn = self.conn.lock().unwrap();
        let mut count = 0;

        for id in &doc_ids {
            // Update memory sync status
            conn.execute(
                "UPDATE memories SET sync_status = 'synced' WHERE id = ?",
                params![id],
            )
            .ok();

            // Remove from queue
            let deleted = conn
                .execute("DELETE FROM sync_queue WHERE doc_id = ?", params![id])
                .unwrap_or(0);

            count += deleted;
        }

        Ok(count)
    }

    /// Merge a collection into storage
    pub fn merge_collection(&self, collection: &MemoryCollection) -> PyResult<usize> {
        let mut count = 0;
        for memory in collection.all() {
            self.put(&memory)?;
            count += 1;
        }
        Ok(count)
    }

    /// Export all as collection
    pub fn export_collection(&self) -> PyResult<MemoryCollection> {
        let mut collection = MemoryCollection::new(Some(self.instance_id.clone()));
        for memory in self.all()? {
            collection.put(memory);
        }
        Ok(collection)
    }

    /// Close the database connection
    pub fn close(&self) -> PyResult<()> {
        // Connection will be closed when dropped
        Ok(())
    }

    fn __repr__(&self) -> PyResult<String> {
        Ok(format!(
            "MemoryStorage(count={}, instance={})",
            self.count()?,
            self.instance_id
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_storage_put_get() {
        let storage = MemoryStorage::new(None, Some("test".to_string())).unwrap();

        let memory = MemoryDocument::new(
            Some("test-1".to_string()),
            Some("Test content".to_string()),
            Some("episodic".to_string()),
            Some("test".to_string()),
        );

        storage.put(&memory).unwrap();

        let retrieved = storage.get("test-1").unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().content, "Test content");
    }

    #[test]
    fn test_storage_merge() {
        let storage = MemoryStorage::new(None, Some("test".to_string())).unwrap();

        let mut m1 = MemoryDocument::new(
            Some("merge-test".to_string()),
            Some("Version 1".to_string()),
            None,
            Some("agent-a".to_string()),
        );
        m1.add_tag("tag1".to_string());
        storage.put(&m1).unwrap();

        let mut m2 = MemoryDocument::new(
            Some("merge-test".to_string()),
            Some("Version 2".to_string()),
            None,
            Some("agent-b".to_string()),
        );
        m2.add_tag("tag2".to_string());
        m2.set_importance(0.9, "agent-b".to_string());
        storage.put(&m2).unwrap();

        let merged = storage.get("merge-test").unwrap().unwrap();

        // Should have both tags
        let tags = merged.get_tags();
        assert!(tags.contains(&"tag1".to_string()));
        assert!(tags.contains(&"tag2".to_string()));

        // Should have max importance
        assert!(merged.get_importance() >= 0.9);
    }
}

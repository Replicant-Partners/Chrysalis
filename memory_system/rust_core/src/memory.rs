//! Memory document types and merge logic
//!
//! Defines the core memory structures and CRDT-based merging.

use crate::crdt::{GCounter, GSet, LWWNumericRegister, ORSet, VectorClock};
use pyo3::prelude::*;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

/// Memory document types
#[pyclass(eq, eq_int)]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum MemoryType {
    Episodic,
    Semantic,
    Procedural,
    Working,
}

#[pymethods]
impl MemoryType {
    #[staticmethod]
    pub fn from_str(s: &str) -> Option<MemoryType> {
        match s.to_lowercase().as_str() {
            "episodic" => Some(MemoryType::Episodic),
            "semantic" => Some(MemoryType::Semantic),
            "procedural" => Some(MemoryType::Procedural),
            "working" => Some(MemoryType::Working),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            MemoryType::Episodic => "episodic",
            MemoryType::Semantic => "semantic",
            MemoryType::Procedural => "procedural",
            MemoryType::Working => "working",
        }
    }
}

/// Sync status for documents
#[pyclass(eq, eq_int)]
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum SyncStatus {
    Local,
    Pending,
    Synced,
    Conflict,
}

#[pymethods]
impl SyncStatus {
    #[staticmethod]
    pub fn from_str(s: &str) -> Option<SyncStatus> {
        match s.to_lowercase().as_str() {
            "local" => Some(SyncStatus::Local),
            "pending" => Some(SyncStatus::Pending),
            "synced" => Some(SyncStatus::Synced),
            "conflict" => Some(SyncStatus::Conflict),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            SyncStatus::Local => "local",
            SyncStatus::Pending => "pending",
            SyncStatus::Synced => "synced",
            SyncStatus::Conflict => "conflict",
        }
    }
}

/// Core Memory Document
///
/// Represents a single memory entry with full CRDT support.
#[pyclass]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MemoryDocument {
    // Identity
    #[pyo3(get, set)]
    pub id: String,

    // Content (LWW) - use get only, custom setter below
    #[pyo3(get)]
    pub content: String,
    #[pyo3(get)]
    pub content_hash: String,

    // Classification
    #[pyo3(get, set)]
    pub memory_type: String,

    // Tags (OR-Set for add/remove)
    tags: ORSet,

    // Relationships (G-Set - only accumulate)
    related_memories: GSet,
    parent_memories: GSet,
    evidence: GSet,

    // Importance/Confidence (LWW with max semantics)
    importance: LWWNumericRegister,
    confidence: LWWNumericRegister,

    // Access tracking (G-Counter)
    access_count: GCounter,

    // Embedding reference
    #[pyo3(get, set)]
    pub embedding_ref: Option<String>,

    // Provenance
    #[pyo3(get, set)]
    pub source_instance: String,
    #[pyo3(get, set)]
    pub created_at: f64,
    #[pyo3(get, set)]
    pub updated_at: f64,

    // CRDT metadata
    #[pyo3(get, set)]
    pub version: u64,
    #[pyo3(get, set)]
    pub sync_status: String,

    // Vector clock for causality
    vector_clock: VectorClock,
}

#[pymethods]
impl MemoryDocument {
    #[new]
    #[pyo3(signature = (id=None, content=None, memory_type=None, source_instance=None))]
    pub fn new(
        id: Option<String>,
        content: Option<String>,
        memory_type: Option<String>,
        source_instance: Option<String>,
    ) -> Self {
        let now = current_timestamp();
        let content_str = content.unwrap_or_default();
        let content_hash = hash_content(&content_str);
        let instance = source_instance.unwrap_or_else(|| "unknown".to_string());

        MemoryDocument {
            id: id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
            content: content_str,
            content_hash,
            memory_type: memory_type.unwrap_or_else(|| "episodic".to_string()),
            tags: ORSet::new(Some(instance.clone())),
            related_memories: GSet::new(),
            parent_memories: GSet::new(),
            evidence: GSet::new(),
            importance: LWWNumericRegister::new(Some(0.5), Some(now), Some(instance.clone()), Some(true)),
            confidence: LWWNumericRegister::new(Some(0.5), Some(now), Some(instance.clone()), Some(true)),
            access_count: GCounter::new(),
            embedding_ref: None,
            source_instance: instance,
            created_at: now,
            updated_at: now,
            version: 1,
            sync_status: "local".to_string(),
            vector_clock: VectorClock::new(),
        }
    }

    /// Set content and update hash
    pub fn set_content(&mut self, content: String, writer: String) {
        self.content = content.clone();
        self.content_hash = hash_content(&content);
        self.updated_at = current_timestamp();
        self.vector_clock.tick(writer);
    }

    /// Add a tag
    pub fn add_tag(&mut self, tag: String) -> String {
        self.tags.add(tag)
    }

    /// Remove a tag
    pub fn remove_tag(&mut self, tag: &str) {
        let observed = self.tags.get_tags(tag);
        self.tags.remove(tag, observed);
    }

    /// Get all tags
    pub fn get_tags(&self) -> Vec<String> {
        self.tags.elements()
    }

    /// Add related memory
    pub fn add_related(&mut self, memory_id: String) {
        self.related_memories.add(memory_id);
    }

    /// Get related memories
    pub fn get_related(&self) -> Vec<String> {
        self.related_memories.elements()
    }

    /// Add parent memory
    pub fn add_parent(&mut self, memory_id: String) {
        self.parent_memories.add(memory_id);
    }

    /// Get parent memories
    pub fn get_parents(&self) -> Vec<String> {
        self.parent_memories.elements()
    }

    /// Add evidence
    pub fn add_evidence(&mut self, evidence: String) {
        self.evidence.add(evidence);
    }

    /// Get evidence
    pub fn get_evidence(&self) -> Vec<String> {
        self.evidence.elements()
    }

    /// Set importance (with max semantics)
    pub fn set_importance(&mut self, value: f64, writer: String) {
        let now = current_timestamp();
        self.importance.set(value, now, writer.clone());
        self.updated_at = now;
        self.vector_clock.tick(writer);
    }

    /// Get importance
    pub fn get_importance(&self) -> f64 {
        self.importance.get()
    }

    /// Set confidence (with max semantics)
    pub fn set_confidence(&mut self, value: f64, writer: String) {
        let now = current_timestamp();
        self.confidence.set(value, now, writer.clone());
        self.updated_at = now;
        self.vector_clock.tick(writer);
    }

    /// Get confidence
    pub fn get_confidence(&self) -> f64 {
        self.confidence.get()
    }

    /// Increment access count
    pub fn record_access(&mut self, instance_id: String) {
        self.access_count.increment(instance_id);
    }

    /// Get access count
    pub fn get_access_count(&self) -> u64 {
        self.access_count.value()
    }

    /// Get vector clock as dict
    pub fn get_vector_clock(&self) -> HashMap<String, u64> {
        self.vector_clock.to_dict()
    }

    /// Tick vector clock
    pub fn tick_clock(&mut self, instance_id: String) -> u64 {
        self.vector_clock.tick(instance_id)
    }

    /// Merge with another MemoryDocument (CRDT merge)
    ///
    /// Guarantees:
    /// - Content uses LWW (latest timestamp wins)
    /// - Tags use OR-Set (union with remove support)
    /// - Related/parent/evidence use G-Set (union, accumulate)
    /// - Importance/confidence use max semantics
    /// - Access count uses G-Counter (element-wise max)
    pub fn merge(&self, other: &MemoryDocument) -> MemoryDocument {
        let mut result = self.clone();

        // LWW for content (latest wins)
        if other.updated_at > self.updated_at {
            result.content = other.content.clone();
            result.content_hash = other.content_hash.clone();
            result.memory_type = other.memory_type.clone();
            result.embedding_ref = other.embedding_ref.clone();
        }

        // OR-Set merge for tags
        result.tags.merge_into(&other.tags);

        // G-Set merge for relationships (accumulate)
        result.related_memories.merge_into(&other.related_memories);
        result.parent_memories.merge_into(&other.parent_memories);
        result.evidence.merge_into(&other.evidence);

        // Max semantics for scores
        result.importance = self.importance.merge(&other.importance);
        result.confidence = self.confidence.merge(&other.confidence);

        // G-Counter merge for access count
        result.access_count.merge_into(&other.access_count);

        // Vector clock merge
        result.vector_clock.merge_into(&other.vector_clock);

        // Metadata
        result.updated_at = self.updated_at.max(other.updated_at);
        result.version = self.version.max(other.version) + 1;

        // Keep earliest created_at
        result.created_at = self.created_at.min(other.created_at);

        result
    }

    /// Merge in place
    pub fn merge_into(&mut self, other: &MemoryDocument) {
        // LWW for content
        if other.updated_at > self.updated_at {
            self.content = other.content.clone();
            self.content_hash = other.content_hash.clone();
            self.memory_type = other.memory_type.clone();
            self.embedding_ref = other.embedding_ref.clone();
        }

        // CRDT merges
        self.tags.merge_into(&other.tags);
        self.related_memories.merge_into(&other.related_memories);
        self.parent_memories.merge_into(&other.parent_memories);
        self.evidence.merge_into(&other.evidence);
        self.importance = self.importance.merge(&other.importance);
        self.confidence = self.confidence.merge(&other.confidence);
        self.access_count.merge_into(&other.access_count);
        self.vector_clock.merge_into(&other.vector_clock);

        // Metadata
        self.updated_at = self.updated_at.max(other.updated_at);
        self.version = self.version.max(other.version) + 1;
        self.created_at = self.created_at.min(other.created_at);
    }

    /// Serialize to JSON
    pub fn to_json(&self) -> PyResult<String> {
        serde_json::to_string(self)
            .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))
    }

    /// Deserialize from JSON
    #[staticmethod]
    pub fn from_json(json: &str) -> PyResult<MemoryDocument> {
        serde_json::from_str(json)
            .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))
    }

    fn __repr__(&self) -> String {
        format!(
            "MemoryDocument(id={}, type={}, importance={:.2}, confidence={:.2}, tags={}, version={})",
            self.id,
            self.memory_type,
            self.get_importance(),
            self.get_confidence(),
            self.get_tags().len(),
            self.version
        )
    }
}

/// Embedding Document
///
/// Stores vector embeddings with content addressing.
#[pyclass]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EmbeddingDocument {
    #[pyo3(get, set)]
    pub id: String,
    #[pyo3(get, set)]
    pub text_hash: String,
    #[pyo3(get)]
    pub vector: Vec<f32>,
    #[pyo3(get, set)]
    pub dimensions: usize,
    #[pyo3(get, set)]
    pub model: String,
    #[pyo3(get, set)]
    pub created_at: f64,
    #[pyo3(get, set)]
    pub sync_status: String,
}

#[pymethods]
impl EmbeddingDocument {
    #[new]
    #[pyo3(signature = (text, vector, model))]
    pub fn new(text: &str, vector: Vec<f32>, model: String) -> Self {
        let text_hash = hash_content(text);
        let dimensions = vector.len();

        EmbeddingDocument {
            id: uuid::Uuid::new_v4().to_string(),
            text_hash,
            vector,
            dimensions,
            model,
            created_at: current_timestamp(),
            sync_status: "local".to_string(),
        }
    }

    /// Set vector
    pub fn set_vector(&mut self, vector: Vec<f32>) {
        self.dimensions = vector.len();
        self.vector = vector;
    }

    /// Get vector as list
    pub fn get_vector(&self) -> Vec<f32> {
        self.vector.clone()
    }

    /// Compute cosine similarity with another vector
    pub fn cosine_similarity(&self, other: Vec<f32>) -> f64 {
        if self.vector.len() != other.len() {
            return 0.0;
        }

        let dot: f32 = self.vector.iter().zip(other.iter()).map(|(a, b)| a * b).sum();
        let norm_a: f32 = self.vector.iter().map(|x| x * x).sum::<f32>().sqrt();
        let norm_b: f32 = other.iter().map(|x| x * x).sum::<f32>().sqrt();

        if norm_a == 0.0 || norm_b == 0.0 {
            0.0
        } else {
            (dot / (norm_a * norm_b)) as f64
        }
    }

    fn __repr__(&self) -> String {
        format!(
            "EmbeddingDocument(id={}, dims={}, model={})",
            self.id, self.dimensions, self.model
        )
    }
}

/// Memory Collection
///
/// A collection of memories with CRDT-based accretion.
#[pyclass]
#[derive(Clone, Debug, Default)]
pub struct MemoryCollection {
    memories: HashMap<String, MemoryDocument>,
    instance_id: String,
}

#[pymethods]
impl MemoryCollection {
    #[new]
    #[pyo3(signature = (instance_id=None))]
    pub fn new(instance_id: Option<String>) -> Self {
        MemoryCollection {
            memories: HashMap::new(),
            instance_id: instance_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
        }
    }

    /// Add or merge a memory
    pub fn put(&mut self, memory: MemoryDocument) -> String {
        let id = memory.id.clone();

        if let Some(existing) = self.memories.get_mut(&id) {
            existing.merge_into(&memory);
        } else {
            self.memories.insert(id.clone(), memory);
        }

        id
    }

    /// Get a memory by ID
    pub fn get(&self, id: &str) -> Option<MemoryDocument> {
        self.memories.get(id).cloned()
    }

    /// Get all memories
    pub fn all(&self) -> Vec<MemoryDocument> {
        self.memories.values().cloned().collect()
    }

    /// Get memory count
    pub fn len(&self) -> usize {
        self.memories.len()
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.memories.is_empty()
    }

    /// Get all memory IDs
    pub fn ids(&self) -> Vec<String> {
        self.memories.keys().cloned().collect()
    }

    /// Merge with another collection (CRDT accretion)
    ///
    /// Guarantees:
    /// - All memories from both collections preserved
    /// - Duplicate IDs merged using MemoryDocument.merge()
    /// - Result is superset of both inputs
    pub fn merge(&self, other: &MemoryCollection) -> MemoryCollection {
        let mut result = self.clone();

        for (id, memory) in &other.memories {
            if let Some(existing) = result.memories.get_mut(id) {
                existing.merge_into(memory);
            } else {
                result.memories.insert(id.clone(), memory.clone());
            }
        }

        result
    }

    /// Merge in place
    pub fn merge_into(&mut self, other: &MemoryCollection) {
        for (id, memory) in &other.memories {
            if let Some(existing) = self.memories.get_mut(id) {
                existing.merge_into(memory);
            } else {
                self.memories.insert(id.clone(), memory.clone());
            }
        }
    }

    /// Query memories by type
    pub fn query_by_type(&self, memory_type: &str) -> Vec<MemoryDocument> {
        self.memories
            .values()
            .filter(|m| m.memory_type == memory_type)
            .cloned()
            .collect()
    }

    /// Query memories by minimum importance
    pub fn query_by_importance(&self, min_importance: f64) -> Vec<MemoryDocument> {
        self.memories
            .values()
            .filter(|m| m.get_importance() >= min_importance)
            .cloned()
            .collect()
    }

    /// Query memories by tag
    pub fn query_by_tag(&self, tag: &str) -> Vec<MemoryDocument> {
        self.memories
            .values()
            .filter(|m| m.get_tags().contains(&tag.to_string()))
            .cloned()
            .collect()
    }

    /// Get most recent memories
    pub fn recent(&self, limit: usize) -> Vec<MemoryDocument> {
        let mut memories: Vec<_> = self.memories.values().cloned().collect();
        memories.sort_by(|a, b| b.updated_at.partial_cmp(&a.updated_at).unwrap());
        memories.truncate(limit);
        memories
    }

    /// Get most important memories
    pub fn most_important(&self, limit: usize) -> Vec<MemoryDocument> {
        let mut memories: Vec<_> = self.memories.values().cloned().collect();
        memories.sort_by(|a, b| {
            b.get_importance()
                .partial_cmp(&a.get_importance())
                .unwrap()
        });
        memories.truncate(limit);
        memories
    }

    fn __repr__(&self) -> String {
        format!("MemoryCollection(len={}, instance={})", self.len(), self.instance_id)
    }
}

// Helper functions

fn current_timestamp() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs_f64())
        .unwrap_or(0.0)
}

fn hash_content(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    hex::encode(hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_memory_merge_preserves_all() {
        let mut m1 = MemoryDocument::new(
            Some("mem-1".to_string()),
            Some("Hello".to_string()),
            Some("episodic".to_string()),
            Some("agent-a".to_string()),
        );
        m1.add_tag("tag1".to_string());
        m1.add_related("rel-1".to_string());

        let mut m2 = MemoryDocument::new(
            Some("mem-1".to_string()),
            Some("Hello World".to_string()),
            Some("episodic".to_string()),
            Some("agent-b".to_string()),
        );
        m2.add_tag("tag2".to_string());
        m2.add_related("rel-2".to_string());
        m2.set_importance(0.9, "agent-b".to_string());

        let merged = m1.merge(&m2);

        // Tags should accumulate (OR-Set union)
        assert!(merged.get_tags().contains(&"tag1".to_string()));
        assert!(merged.get_tags().contains(&"tag2".to_string()));

        // Related should accumulate (G-Set union)
        assert!(merged.get_related().contains(&"rel-1".to_string()));
        assert!(merged.get_related().contains(&"rel-2".to_string()));

        // Importance should be max
        assert!(merged.get_importance() >= 0.9);
    }

    #[test]
    fn test_collection_accretion() {
        let mut c1 = MemoryCollection::new(Some("agent-a".to_string()));
        let mut c2 = MemoryCollection::new(Some("agent-b".to_string()));

        c1.put(MemoryDocument::new(
            Some("m1".to_string()),
            Some("Memory 1".to_string()),
            None,
            None,
        ));
        c1.put(MemoryDocument::new(
            Some("m2".to_string()),
            Some("Memory 2".to_string()),
            None,
            None,
        ));

        c2.put(MemoryDocument::new(
            Some("m2".to_string()),
            Some("Memory 2 updated".to_string()),
            None,
            None,
        ));
        c2.put(MemoryDocument::new(
            Some("m3".to_string()),
            Some("Memory 3".to_string()),
            None,
            None,
        ));

        let merged = c1.merge(&c2);

        // Should have all 3 memories
        assert_eq!(merged.len(), 3);
        assert!(merged.get("m1").is_some());
        assert!(merged.get("m2").is_some());
        assert!(merged.get("m3").is_some());
    }
}

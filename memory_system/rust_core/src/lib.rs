//! Chrysalis Memory System - Rust Core
//!
//! High-performance CRDT-based memory system for autonomous agents.
//!
//! # Architecture
//!
//! This crate provides the core memory infrastructure:
//!
//! - **CRDT Types** (`crdt`): GSet, ORSet, LWWRegister for conflict-free replication
//! - **Memory Documents** (`memory`): MemoryDocument, EmbeddingDocument with full CRDT support
//! - **Storage** (`storage`): SQLite-backed persistent storage
//!
//! # Python Integration
//!
//! All types are exposed to Python via PyO3:
//!
//! ```python
//! from chrysalis_memory import (
//!     GSet, ORSet, LWWRegister, VectorClock,
//!     MemoryDocument, MemoryCollection, EmbeddingDocument,
//!     MemoryStorage
//! )
//!
//! # Create a memory
//! memory = MemoryDocument(
//!     id="mem-1",
//!     content="The user prefers concise explanations",
//!     memory_type="semantic",
//!     source_instance="agent-001"
//! )
//!
//! # Add metadata
//! memory.add_tag("preference")
//! memory.set_importance(0.9, "agent-001")
//!
//! # Store persistently
//! storage = MemoryStorage("./data/memory.db", "agent-001")
//! storage.put(memory)
//!
//! # Merge with another memory (CRDT semantics)
//! other_memory = storage.get("mem-1")
//! merged = memory.merge(other_memory)
//! ```
//!
//! # CRDT Guarantees
//!
//! - **G-Set**: Grow-only, elements never deleted
//! - **OR-Set**: Add/remove with conflict resolution
//! - **LWW-Register**: Latest timestamp wins
//! - **Merge**: Commutative, associative, idempotent

pub mod crdt;
pub mod memory;
pub mod storage;

use pyo3::prelude::*;

/// Initialize the Python module
#[pymodule]
fn chrysalis_memory(m: &Bound<'_, PyModule>) -> PyResult<()> {
    // CRDT types
    m.add_class::<crdt::GSet>()?;
    m.add_class::<crdt::ORSet>()?;
    m.add_class::<crdt::LWWRegister>()?;
    m.add_class::<crdt::LWWNumericRegister>()?;
    m.add_class::<crdt::GCounter>()?;
    m.add_class::<crdt::VectorClock>()?;

    // Memory types
    m.add_class::<memory::MemoryType>()?;
    m.add_class::<memory::SyncStatus>()?;
    m.add_class::<memory::MemoryDocument>()?;
    m.add_class::<memory::EmbeddingDocument>()?;
    m.add_class::<memory::MemoryCollection>()?;

    // Storage
    m.add_class::<storage::MemoryStorage>()?;

    // Module info
    m.add("__version__", "0.1.0")?;
    m.add("__doc__", "Chrysalis Memory System - High-performance CRDT-based memory for autonomous agents")?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_full_workflow() {
        // Create storage
        let storage = storage::MemoryStorage::new(None, Some("test-agent".to_string())).unwrap();

        // Create and store a memory
        let mut mem1 = memory::MemoryDocument::new(
            Some("workflow-test".to_string()),
            Some("Learning about CRDT".to_string()),
            Some("semantic".to_string()),
            Some("test-agent".to_string()),
        );
        mem1.add_tag("crdt".to_string());
        mem1.add_tag("learning".to_string());
        mem1.set_importance(0.8, "test-agent".to_string());

        storage.put(&mem1).unwrap();

        // Create another memory to merge
        let mut mem2 = memory::MemoryDocument::new(
            Some("workflow-test".to_string()),
            Some("Learning about CRDT and distributed systems".to_string()),
            Some("semantic".to_string()),
            Some("other-agent".to_string()),
        );
        mem2.add_tag("distributed".to_string());
        mem2.set_importance(0.9, "other-agent".to_string());
        mem2.add_evidence("paper-1".to_string());

        storage.put(&mem2).unwrap();

        // Retrieve and verify merge
        let merged = storage.get("workflow-test").unwrap().unwrap();

        // Tags should accumulate
        let tags = merged.get_tags();
        assert!(tags.contains(&"crdt".to_string()));
        assert!(tags.contains(&"learning".to_string()));
        assert!(tags.contains(&"distributed".to_string()));

        // Importance should be max
        assert!(merged.get_importance() >= 0.9);

        // Evidence should accumulate
        assert!(merged.get_evidence().contains(&"paper-1".to_string()));
    }
}

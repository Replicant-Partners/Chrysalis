//! Agent Memory Adapter
//!
//! Rust implementation of the memory adapter that interfaces with the
//! Chrysalis memory system. Provides methods for storing, retrieving,
//! and searching agent memories.
//!
//! Ported from TypeScript AgentMemoryAdapter.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

// =============================================================================
// Memory Entry Types
// =============================================================================

/// Memory entry representing a single unit of agent memory
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MemoryEntry {
    pub id: String,
    pub content: String,
    pub timestamp: u64,
    pub agent_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub importance: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memory_type: Option<MemoryType>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
}

/// Types of memory for categorization
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MemoryType {
    Episodic,
    Semantic,
    Procedural,
    Reflection,
    Goal,
    Constraint,
    Observation,
    Thought,
    Action,
    Feedback,
}

impl Default for MemoryType {
    fn default() -> Self {
        MemoryType::Episodic
    }
}

/// Search request for memory queries
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MemorySearchRequest {
    pub agent_id: String,
    pub query: String,
    #[serde(default = "default_limit")]
    pub limit: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memory_types: Option<Vec<MemoryType>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_importance: Option<f32>,
}

fn default_limit() -> usize {
    10
}

/// Memory store request
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MemoryStoreRequest {
    pub agent_id: String,
    pub content: String,
    #[serde(default = "default_role")]
    pub role: String,
    #[serde(default = "default_importance")]
    pub importance: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memory_type: Option<MemoryType>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
}

fn default_role() -> String {
    "assistant".to_string()
}

fn default_importance() -> f32 {
    0.5
}

/// Health check response
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct HealthResponse {
    pub status: String,
    pub beads_count: usize,
    pub rust_available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_agents: Option<Vec<String>>,
}

// =============================================================================
// Memory Adapter Errors
// =============================================================================

/// Errors that can occur in memory operations
#[derive(Debug)]
pub enum MemoryError {
    ConnectionError(String),
    SerializationError(String),
    NotFound(String),
    StorageError(String),
    ValidationError(String),
}

impl std::fmt::Display for MemoryError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MemoryError::ConnectionError(msg) => write!(f, "Connection error: {}", msg),
            MemoryError::SerializationError(msg) => write!(f, "Serialization error: {}", msg),
            MemoryError::NotFound(msg) => write!(f, "Not found: {}", msg),
            MemoryError::StorageError(msg) => write!(f, "Storage error: {}", msg),
            MemoryError::ValidationError(msg) => write!(f, "Validation error: {}", msg),
        }
    }
}

impl std::error::Error for MemoryError {}

pub type MemoryResult<T> = Result<T, MemoryError>;

// =============================================================================
// Agent Memory Adapter
// =============================================================================

/// Agent Memory Adapter trait - defines the interface for memory operations
pub trait AgentMemoryAdapter: Send + Sync {
    /// Store a new memory entry
    fn store(&self, request: MemoryStoreRequest) -> MemoryResult<MemoryEntry>;

    /// Retrieve memories by query (semantic search)
    fn retrieve(&self, request: MemorySearchRequest) -> MemoryResult<Vec<MemoryEntry>>;

    /// Get recent memories
    fn recent(&self, agent_id: &str, limit: usize) -> MemoryResult<Vec<MemoryEntry>>;

    /// Get a specific memory by ID
    fn get(&self, id: &str) -> MemoryResult<Option<MemoryEntry>>;

    /// Delete a memory by ID
    fn delete(&self, id: &str) -> MemoryResult<()>;

    /// Health check
    fn health(&self) -> MemoryResult<HealthResponse>;

    /// Search episodic memories
    fn search_episodic(&self, agent_id: &str, query: &str, limit: usize) -> MemoryResult<Vec<MemoryEntry>>;

    /// Search semantic memories
    fn search_semantic(&self, agent_id: &str, query: &str, limit: usize) -> MemoryResult<Vec<MemoryEntry>>;

    /// Search procedural memories (skills)
    fn search_skills(&self, agent_id: &str, query: &str, limit: usize) -> MemoryResult<Vec<MemoryEntry>>;
}

// =============================================================================
// HTTP Memory Client
// =============================================================================

/// HTTP-based memory client that connects to the Python memory API
pub struct HttpMemoryClient {
    base_url: String,
    client: reqwest::blocking::Client,
}

impl HttpMemoryClient {
    /// Create a new HTTP memory client
    pub fn new(base_url: &str) -> Self {
        HttpMemoryClient {
            base_url: base_url.to_string(),
            client: reqwest::blocking::Client::new(),
        }
    }

    /// Create with default URL (localhost:8082)
    pub fn default() -> Self {
        Self::new("http://localhost:8082")
    }

    /// Internal API call helper
    fn api_call<T: serde::de::DeserializeOwned, R: Serialize>(
        &self,
        method: &str,
        path: &str,
        body: Option<&R>,
    ) -> MemoryResult<T> {
        let url = format!("{}{}", self.base_url, path);

        let request = match method {
            "GET" => self.client.get(&url),
            "POST" => {
                let mut req = self.client.post(&url);
                if let Some(b) = body {
                    req = req.json(b);
                }
                req
            }
            "DELETE" => self.client.delete(&url),
            _ => return Err(MemoryError::ValidationError(format!("Unknown method: {}", method))),
        };

        let response = request
            .header("Content-Type", "application/json")
            .send()
            .map_err(|e| MemoryError::ConnectionError(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().unwrap_or_default();
            return Err(MemoryError::StorageError(format!("API error {}: {}", status, text)));
        }

        response
            .json::<T>()
            .map_err(|e| MemoryError::SerializationError(e.to_string()))
    }
}

impl AgentMemoryAdapter for HttpMemoryClient {
    fn store(&self, request: MemoryStoreRequest) -> MemoryResult<MemoryEntry> {
        self.api_call("POST", "/memories", Some(&request))
    }

    fn retrieve(&self, request: MemorySearchRequest) -> MemoryResult<Vec<MemoryEntry>> {
        self.api_call("POST", "/memories/search", Some(&request))
    }

    fn recent(&self, agent_id: &str, limit: usize) -> MemoryResult<Vec<MemoryEntry>> {
        let path = format!("/memories?agent_id={}&limit={}", agent_id, limit);
        self.api_call::<Vec<MemoryEntry>, ()>("GET", &path, None)
    }

    fn get(&self, id: &str) -> MemoryResult<Option<MemoryEntry>> {
        let path = format!("/memories/{}", id);
        match self.api_call::<MemoryEntry, ()>("GET", &path, None) {
            Ok(entry) => Ok(Some(entry)),
            Err(MemoryError::StorageError(msg)) if msg.contains("404") => Ok(None),
            Err(e) => Err(e),
        }
    }

    fn delete(&self, id: &str) -> MemoryResult<()> {
        let path = format!("/memories/{}", id);
        self.api_call::<serde_json::Value, ()>("DELETE", &path, None)?;
        Ok(())
    }

    fn health(&self) -> MemoryResult<HealthResponse> {
        self.api_call::<HealthResponse, ()>("GET", "/health", None)
    }

    fn search_episodic(&self, agent_id: &str, query: &str, limit: usize) -> MemoryResult<Vec<MemoryEntry>> {
        let request = MemorySearchRequest {
            agent_id: agent_id.to_string(),
            query: query.to_string(),
            limit,
            memory_types: Some(vec![MemoryType::Episodic]),
            tags: None,
            min_importance: None,
        };
        self.retrieve(request)
    }

    fn search_semantic(&self, agent_id: &str, query: &str, limit: usize) -> MemoryResult<Vec<MemoryEntry>> {
        let request = MemorySearchRequest {
            agent_id: agent_id.to_string(),
            query: query.to_string(),
            limit,
            memory_types: Some(vec![MemoryType::Semantic]),
            tags: None,
            min_importance: None,
        };
        self.retrieve(request)
    }

    fn search_skills(&self, agent_id: &str, query: &str, limit: usize) -> MemoryResult<Vec<MemoryEntry>> {
        let request = MemorySearchRequest {
            agent_id: agent_id.to_string(),
            query: query.to_string(),
            limit,
            memory_types: Some(vec![MemoryType::Procedural]),
            tags: Some(vec!["skill".to_string()]),
            min_importance: None,
        };
        self.retrieve(request)
    }
}

// =============================================================================
// In-Memory Adapter (for testing and offline use)
// =============================================================================

/// In-memory adapter for testing and offline use
pub struct InMemoryAdapter {
    memories: std::sync::RwLock<HashMap<String, MemoryEntry>>,
}

impl InMemoryAdapter {
    pub fn new() -> Self {
        InMemoryAdapter {
            memories: std::sync::RwLock::new(HashMap::new()),
        }
    }

    fn now_millis() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
    }
}

impl Default for InMemoryAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl AgentMemoryAdapter for InMemoryAdapter {
    fn store(&self, request: MemoryStoreRequest) -> MemoryResult<MemoryEntry> {
        let id = Uuid::new_v4().to_string();
        let entry = MemoryEntry {
            id: id.clone(),
            content: request.content,
            timestamp: Self::now_millis(),
            agent_id: request.agent_id,
            role: Some(request.role),
            importance: Some(request.importance),
            metadata: request.metadata,
            memory_type: request.memory_type,
            tags: request.tags,
        };

        let mut memories = self.memories.write().unwrap();
        memories.insert(id, entry.clone());
        Ok(entry)
    }

    fn retrieve(&self, request: MemorySearchRequest) -> MemoryResult<Vec<MemoryEntry>> {
        let memories = self.memories.read().unwrap();
        let query_lower = request.query.to_lowercase();

        let mut results: Vec<_> = memories
            .values()
            .filter(|m| {
                // Filter by agent_id
                if m.agent_id != request.agent_id {
                    return false;
                }

                // Filter by memory type if specified
                if let Some(types) = &request.memory_types {
                    if let Some(mem_type) = &m.memory_type {
                        if !types.contains(mem_type) {
                            return false;
                        }
                    }
                }

                // Filter by minimum importance
                if let Some(min_imp) = request.min_importance {
                    if let Some(imp) = m.importance {
                        if imp < min_imp {
                            return false;
                        }
                    }
                }

                // Simple text search (would be semantic search in production)
                m.content.to_lowercase().contains(&query_lower)
            })
            .cloned()
            .collect();

        // Sort by importance descending, then by timestamp descending
        results.sort_by(|a, b| {
            let imp_cmp = b.importance.unwrap_or(0.5)
                .partial_cmp(&a.importance.unwrap_or(0.5))
                .unwrap();
            if imp_cmp != std::cmp::Ordering::Equal {
                return imp_cmp;
            }
            b.timestamp.cmp(&a.timestamp)
        });

        results.truncate(request.limit);
        Ok(results)
    }

    fn recent(&self, agent_id: &str, limit: usize) -> MemoryResult<Vec<MemoryEntry>> {
        let memories = self.memories.read().unwrap();

        let mut results: Vec<_> = memories
            .values()
            .filter(|m| m.agent_id == agent_id)
            .cloned()
            .collect();

        // Sort by timestamp descending
        results.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        results.truncate(limit);
        Ok(results)
    }

    fn get(&self, id: &str) -> MemoryResult<Option<MemoryEntry>> {
        let memories = self.memories.read().unwrap();
        Ok(memories.get(id).cloned())
    }

    fn delete(&self, id: &str) -> MemoryResult<()> {
        let mut memories = self.memories.write().unwrap();
        memories.remove(id);
        Ok(())
    }

    fn health(&self) -> MemoryResult<HealthResponse> {
        let memories = self.memories.read().unwrap();
        Ok(HealthResponse {
            status: "ok".to_string(),
            beads_count: memories.len(),
            rust_available: true,
            active_agents: Some(
                memories.values()
                    .map(|m| m.agent_id.clone())
                    .collect::<std::collections::HashSet<_>>()
                    .into_iter()
                    .collect()
            ),
        })
    }

    fn search_episodic(&self, agent_id: &str, query: &str, limit: usize) -> MemoryResult<Vec<MemoryEntry>> {
        let request = MemorySearchRequest {
            agent_id: agent_id.to_string(),
            query: query.to_string(),
            limit,
            memory_types: Some(vec![MemoryType::Episodic]),
            tags: None,
            min_importance: None,
        };
        self.retrieve(request)
    }

    fn search_semantic(&self, agent_id: &str, query: &str, limit: usize) -> MemoryResult<Vec<MemoryEntry>> {
        let request = MemorySearchRequest {
            agent_id: agent_id.to_string(),
            query: query.to_string(),
            limit,
            memory_types: Some(vec![MemoryType::Semantic]),
            tags: None,
            min_importance: None,
        };
        self.retrieve(request)
    }

    fn search_skills(&self, agent_id: &str, query: &str, limit: usize) -> MemoryResult<Vec<MemoryEntry>> {
        let request = MemorySearchRequest {
            agent_id: agent_id.to_string(),
            query: query.to_string(),
            limit,
            memory_types: Some(vec![MemoryType::Procedural]),
            tags: Some(vec!["skill".to_string()]),
            min_importance: None,
        };
        self.retrieve(request)
    }
}

// =============================================================================
// Factory Function
// =============================================================================

/// Create a memory adapter based on configuration
pub fn create_memory_adapter(base_url: Option<&str>) -> Box<dyn AgentMemoryAdapter> {
    match base_url {
        Some(url) => Box::new(HttpMemoryClient::new(url)),
        None => {
            // Try default URL, fall back to in-memory
            let client = HttpMemoryClient::default();
            match client.health() {
                Ok(_) => Box::new(client),
                Err(_) => {
                    log::warn!("Memory API not available, using in-memory adapter");
                    Box::new(InMemoryAdapter::new())
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_in_memory_store_and_retrieve() {
        let adapter = InMemoryAdapter::new();

        let store_req = MemoryStoreRequest {
            agent_id: "test-agent".to_string(),
            content: "Test memory content about rust programming".to_string(),
            role: "assistant".to_string(),
            importance: 0.8,
            metadata: None,
            memory_type: Some(MemoryType::Episodic),
            tags: Some(vec!["test".to_string()]),
        };

        let stored = adapter.store(store_req).unwrap();
        assert!(!stored.id.is_empty());
        assert_eq!(stored.content, "Test memory content about rust programming");

        // Retrieve by query
        let search_req = MemorySearchRequest {
            agent_id: "test-agent".to_string(),
            query: "rust".to_string(),
            limit: 10,
            memory_types: None,
            tags: None,
            min_importance: None,
        };

        let results = adapter.retrieve(search_req).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, stored.id);
    }

    #[test]
    fn test_in_memory_recent() {
        let adapter = InMemoryAdapter::new();

        // Store multiple memories
        for i in 0..5 {
            let store_req = MemoryStoreRequest {
                agent_id: "test-agent".to_string(),
                content: format!("Memory {}", i),
                role: "assistant".to_string(),
                importance: 0.5,
                metadata: None,
                memory_type: None,
                tags: None,
            };
            adapter.store(store_req).unwrap();
        }

        let recent = adapter.recent("test-agent", 3).unwrap();
        assert_eq!(recent.len(), 3);
    }

    #[test]
    fn test_in_memory_delete() {
        let adapter = InMemoryAdapter::new();

        let store_req = MemoryStoreRequest {
            agent_id: "test-agent".to_string(),
            content: "To be deleted".to_string(),
            role: "assistant".to_string(),
            importance: 0.5,
            metadata: None,
            memory_type: None,
            tags: None,
        };

        let stored = adapter.store(store_req).unwrap();
        let id = stored.id.clone();

        // Verify it exists
        assert!(adapter.get(&id).unwrap().is_some());

        // Delete it
        adapter.delete(&id).unwrap();

        // Verify it's gone
        assert!(adapter.get(&id).unwrap().is_none());
    }
}

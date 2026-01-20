//! Cursor IDE Adapter
//!
//! Rust implementation of the adapter for integrating with the Cursor IDE.
//! Allows system agents to leverage the Cursor AI agent as an LLM resource.
//!
//! Ported from TypeScript CursorAdapter.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;
use chrono::Utc;

// =============================================================================
// Types
// =============================================================================

/// Cursor API request
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CursorRequest {
    pub prompt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<CursorContext>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<CursorOptions>,
}

/// Context for Cursor requests
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CursorContext {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub files: Option<Vec<FileContext>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub selection: Option<SelectionContext>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conversation_history: Option<Vec<ConversationTurn>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_path: Option<String>,
}

/// File context information
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileContext {
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_active: Option<bool>,
}

/// Selection context
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SelectionContext {
    pub file_path: String,
    pub start_line: u32,
    pub end_line: u32,
    pub content: String,
}

/// Conversation turn
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConversationTurn {
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
}

/// Cursor options
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CursorOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop_sequences: Option<Vec<String>>,
}

/// Cursor API response
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CursorResponse {
    pub id: String,
    pub content: String,
    pub model: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finish_reason: Option<String>,
    pub usage: UsageStats,
    pub timestamp: String,
}

/// Tool call from Cursor
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: serde_json::Value,
}

/// Usage statistics
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UsageStats {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

/// Cursor adapter configuration
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CursorAdapterConfig {
    pub base_url: String,
    pub port: u16,
    pub host: String,
    pub persona: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeout_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_retries: Option<u32>,
}

impl Default for CursorAdapterConfig {
    fn default() -> Self {
        CursorAdapterConfig {
            base_url: "http://localhost:3001".to_string(),
            port: 3001,
            host: "localhost".to_string(),
            persona: "Cursor Agent".to_string(),
            timeout_ms: Some(30000),
            max_retries: Some(3),
        }
    }
}

// =============================================================================
// Errors
// =============================================================================

/// Cursor adapter errors
#[derive(Debug)]
pub enum CursorError {
    ConnectionError(String),
    TimeoutError(String),
    ResponseError(String),
    SerializationError(String),
    NotAvailable(String),
}

impl std::fmt::Display for CursorError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CursorError::ConnectionError(msg) => write!(f, "Connection error: {}", msg),
            CursorError::TimeoutError(msg) => write!(f, "Timeout: {}", msg),
            CursorError::ResponseError(msg) => write!(f, "Response error: {}", msg),
            CursorError::SerializationError(msg) => write!(f, "Serialization error: {}", msg),
            CursorError::NotAvailable(msg) => write!(f, "Cursor not available: {}", msg),
        }
    }
}

impl std::error::Error for CursorError {}

pub type CursorResult<T> = Result<T, CursorError>;

// =============================================================================
// Cursor Adapter
// =============================================================================

/// Adapter for communicating with Cursor IDE
pub struct CursorAdapter {
    config: CursorAdapterConfig,
    client: reqwest::Client,
    request_cache: Arc<RwLock<HashMap<String, CursorResponse>>>,
    is_available: Arc<RwLock<bool>>,
    stats: Arc<RwLock<AdapterStats>>,
}

/// Adapter statistics
#[derive(Debug, Clone, Default)]
pub struct AdapterStats {
    pub total_requests: u64,
    pub successful_requests: u64,
    pub failed_requests: u64,
    pub total_tokens_used: u64,
    pub average_latency_ms: f64,
}

impl CursorAdapter {
    /// Create a new Cursor adapter with the given configuration
    pub fn new(config: CursorAdapterConfig) -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_millis(
                config.timeout_ms.unwrap_or(30000),
            ))
            .build()
            .expect("Failed to build HTTP client");

        CursorAdapter {
            config,
            client,
            request_cache: Arc::new(RwLock::new(HashMap::new())),
            is_available: Arc::new(RwLock::new(false)),
            stats: Arc::new(RwLock::new(AdapterStats::default())),
        }
    }

    /// Create with default configuration
    pub fn default_config() -> Self {
        Self::new(CursorAdapterConfig::default())
    }

    /// Create from environment variables
    pub fn from_env() -> Self {
        let config = CursorAdapterConfig {
            base_url: std::env::var("CURSOR_ADAPTER_BASE_URL")
                .unwrap_or_else(|_| "http://localhost:3001".to_string()),
            port: std::env::var("CURSOR_ADAPTER_PORT")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(3001),
            host: std::env::var("CURSOR_ADAPTER_HOST")
                .unwrap_or_else(|_| "localhost".to_string()),
            persona: std::env::var("CURSOR_AGENT_PERSONA")
                .unwrap_or_else(|_| "Cursor Agent".to_string()),
            timeout_ms: std::env::var("CURSOR_ADAPTER_TIMEOUT_MS")
                .ok()
                .and_then(|s| s.parse().ok()),
            max_retries: std::env::var("CURSOR_ADAPTER_MAX_RETRIES")
                .ok()
                .and_then(|s| s.parse().ok()),
        };
        Self::new(config)
    }

    /// Check if Cursor is available
    pub async fn check_availability(&self) -> bool {
        let url = format!("{}/health", self.config.base_url);

        match self.client.get(&url).send().await {
            Ok(response) => {
                let available = response.status().is_success();
                let mut is_available = self.is_available.write().await;
                *is_available = available;
                available
            }
            Err(_) => {
                let mut is_available = self.is_available.write().await;
                *is_available = false;
                false
            }
        }
    }

    /// Get current availability status (cached)
    pub async fn is_available(&self) -> bool {
        *self.is_available.read().await
    }

    /// Send a request to Cursor
    pub async fn send_request(&self, request: CursorRequest) -> CursorResult<CursorResponse> {
        let start_time = std::time::Instant::now();

        // Update stats
        {
            let mut stats = self.stats.write().await;
            stats.total_requests += 1;
        }

        // Check cache first
        let cache_key = self.compute_cache_key(&request);
        {
            let cache = self.request_cache.read().await;
            if let Some(cached) = cache.get(&cache_key) {
                return Ok(cached.clone());
            }
        }

        // Make request
        let url = format!("{}/chat", self.config.base_url);
        let response = self
            .client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| CursorError::ConnectionError(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();

            let mut stats = self.stats.write().await;
            stats.failed_requests += 1;

            return Err(CursorError::ResponseError(format!(
                "HTTP {}: {}",
                status, text
            )));
        }

        let cursor_response: CursorResponse = response
            .json()
            .await
            .map_err(|e| CursorError::SerializationError(e.to_string()))?;

        // Update stats
        {
            let mut stats = self.stats.write().await;
            stats.successful_requests += 1;
            stats.total_tokens_used += cursor_response.usage.total_tokens as u64;

            let latency = start_time.elapsed().as_millis() as f64;
            let total = stats.total_requests as f64;
            stats.average_latency_ms =
                (stats.average_latency_ms * (total - 1.0) + latency) / total;
        }

        // Cache the response
        {
            let mut cache = self.request_cache.write().await;
            cache.insert(cache_key, cursor_response.clone());
        }

        Ok(cursor_response)
    }

    /// Simple completion request
    pub async fn complete(&self, prompt: &str) -> CursorResult<String> {
        let request = CursorRequest {
            prompt: prompt.to_string(),
            context: None,
            options: None,
        };

        let response = self.send_request(request).await?;
        Ok(response.content)
    }

    /// Completion with context
    pub async fn complete_with_context(
        &self,
        prompt: &str,
        files: Vec<FileContext>,
        conversation_history: Option<Vec<ConversationTurn>>,
    ) -> CursorResult<CursorResponse> {
        let request = CursorRequest {
            prompt: prompt.to_string(),
            context: Some(CursorContext {
                files: Some(files),
                selection: None,
                conversation_history,
                workspace_path: None,
            }),
            options: None,
        };

        self.send_request(request).await
    }

    /// Code-focused request
    pub async fn code_request(
        &self,
        prompt: &str,
        file_path: &str,
        file_content: &str,
        language: &str,
    ) -> CursorResult<CursorResponse> {
        let files = vec![FileContext {
            path: file_path.to_string(),
            content: Some(file_content.to_string()),
            language: Some(language.to_string()),
            is_active: Some(true),
        }];

        let request = CursorRequest {
            prompt: prompt.to_string(),
            context: Some(CursorContext {
                files: Some(files),
                selection: None,
                conversation_history: None,
                workspace_path: None,
            }),
            options: Some(CursorOptions {
                temperature: Some(0.2), // Lower temperature for code
                max_tokens: Some(4096),
                stream: Some(false),
                stop_sequences: None,
            }),
        };

        self.send_request(request).await
    }

    /// Get adapter statistics
    pub async fn get_stats(&self) -> AdapterStats {
        self.stats.read().await.clone()
    }

    /// Clear the request cache
    pub async fn clear_cache(&self) {
        let mut cache = self.request_cache.write().await;
        cache.clear();
    }

    /// Compute a cache key for a request
    fn compute_cache_key(&self, request: &CursorRequest) -> String {
        use std::hash::{Hash, Hasher};
        use std::collections::hash_map::DefaultHasher;

        let mut hasher = DefaultHasher::new();
        request.prompt.hash(&mut hasher);

        // Include relevant context in hash
        if let Some(ctx) = &request.context {
            if let Some(files) = &ctx.files {
                for file in files {
                    file.path.hash(&mut hasher);
                    if let Some(content) = &file.content {
                        content.hash(&mut hasher);
                    }
                }
            }
        }

        format!("{:x}", hasher.finish())
    }
}

// =============================================================================
// Synchronous Client (for non-async contexts)
// =============================================================================

/// Synchronous Cursor client using blocking HTTP
pub struct CursorSyncClient {
    config: CursorAdapterConfig,
    client: reqwest::blocking::Client,
}

impl CursorSyncClient {
    /// Create a new synchronous client
    pub fn new(config: CursorAdapterConfig) -> Self {
        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_millis(
                config.timeout_ms.unwrap_or(30000),
            ))
            .build()
            .expect("Failed to build HTTP client");

        CursorSyncClient { config, client }
    }

    /// Create with default configuration
    pub fn default_config() -> Self {
        Self::new(CursorAdapterConfig::default())
    }

    /// Check availability synchronously
    pub fn check_availability(&self) -> bool {
        let url = format!("{}/health", self.config.base_url);
        self.client.get(&url).send().map(|r| r.status().is_success()).unwrap_or(false)
    }

    /// Send request synchronously
    pub fn send_request(&self, request: CursorRequest) -> CursorResult<CursorResponse> {
        let url = format!("{}/chat", self.config.base_url);

        let response = self
            .client
            .post(&url)
            .json(&request)
            .send()
            .map_err(|e| CursorError::ConnectionError(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().unwrap_or_default();
            return Err(CursorError::ResponseError(format!("HTTP {}: {}", status, text)));
        }

        response
            .json()
            .map_err(|e| CursorError::SerializationError(e.to_string()))
    }

    /// Simple completion
    pub fn complete(&self, prompt: &str) -> CursorResult<String> {
        let request = CursorRequest {
            prompt: prompt.to_string(),
            context: None,
            options: None,
        };

        let response = self.send_request(request)?;
        Ok(response.content)
    }
}

// =============================================================================
// Mock Client (for testing)
// =============================================================================

/// Mock Cursor client for testing
pub struct MockCursorClient {
    responses: HashMap<String, CursorResponse>,
    default_response: CursorResponse,
}

impl MockCursorClient {
    /// Create a new mock client
    pub fn new() -> Self {
        MockCursorClient {
            responses: HashMap::new(),
            default_response: CursorResponse {
                id: Uuid::new_v4().to_string(),
                content: "Mock response from Cursor".to_string(),
                model: "cursor-mock".to_string(),
                tool_calls: None,
                finish_reason: Some("stop".to_string()),
                usage: UsageStats {
                    prompt_tokens: 10,
                    completion_tokens: 20,
                    total_tokens: 30,
                },
                timestamp: Utc::now().to_rfc3339(),
            },
        }
    }

    /// Add a canned response for a specific prompt
    pub fn add_response(&mut self, prompt: &str, response: CursorResponse) {
        self.responses.insert(prompt.to_string(), response);
    }

    /// Set the default response
    pub fn set_default_response(&mut self, response: CursorResponse) {
        self.default_response = response;
    }

    /// Get response for a prompt
    pub fn complete(&self, prompt: &str) -> CursorResponse {
        self.responses
            .get(prompt)
            .cloned()
            .unwrap_or_else(|| self.default_response.clone())
    }
}

impl Default for MockCursorClient {
    fn default() -> Self {
        Self::new()
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_default() {
        let config = CursorAdapterConfig::default();
        assert_eq!(config.base_url, "http://localhost:3001");
        assert_eq!(config.port, 3001);
        assert_eq!(config.persona, "Cursor Agent");
    }

    #[test]
    fn test_mock_client() {
        let mut mock = MockCursorClient::new();

        // Test default response
        let response = mock.complete("test prompt");
        assert_eq!(response.model, "cursor-mock");

        // Add custom response
        mock.add_response("custom", CursorResponse {
            id: "custom-id".to_string(),
            content: "Custom response".to_string(),
            model: "custom-model".to_string(),
            tool_calls: None,
            finish_reason: Some("stop".to_string()),
            usage: UsageStats {
                prompt_tokens: 5,
                completion_tokens: 10,
                total_tokens: 15,
            },
            timestamp: Utc::now().to_rfc3339(),
        });

        let response = mock.complete("custom");
        assert_eq!(response.content, "Custom response");
    }

    #[test]
    fn test_request_serialization() {
        let request = CursorRequest {
            prompt: "Explain this code".to_string(),
            context: Some(CursorContext {
                files: Some(vec![FileContext {
                    path: "src/main.rs".to_string(),
                    content: Some("fn main() {}".to_string()),
                    language: Some("rust".to_string()),
                    is_active: Some(true),
                }]),
                selection: None,
                conversation_history: None,
                workspace_path: Some("/home/user/project".to_string()),
            }),
            options: Some(CursorOptions {
                temperature: Some(0.7),
                max_tokens: Some(1000),
                stream: Some(false),
                stop_sequences: None,
            }),
        };

        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("Explain this code"));
        assert!(json.contains("src/main.rs"));
    }
}

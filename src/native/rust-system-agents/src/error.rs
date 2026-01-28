//! Unified Error Types for Chrysalis System Agents
//!
//! Provides structured error handling with thiserror for all system agent operations.
//!
//! Pattern: Error hierarchy with thiserror derive macros.
//! See: docs/DESIGN_PATTERNS.md
//!
//! # Usage
//! ```rust,ignore
//! use chrysalis_system_agents::error::{SystemAgentError, Result};
//!
//! fn process_request(data: &str) -> Result<Response> {
//!     let parsed: serde_json::Value = serde_json::from_str(data)
//!         .map_err(|e| SystemAgentError::Parse(e.to_string()))?;
//!     Ok(transform(parsed))
//! }
//! ```

use thiserror::Error;

/// Convenience type alias for Results with SystemAgentError
pub type Result<T> = std::result::Result<T, SystemAgentError>;

/// Unified error type for all system agent operations.
///
/// All errors in the system-agents crate should use this type
/// for consistent error handling and reporting.
#[derive(Error, Debug)]
pub enum SystemAgentError {
    // =========================================================================
    // Gateway Errors
    // =========================================================================
    
    /// Network error during HTTP communication
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),
    
    /// Authentication failed (401)
    #[error("Authentication failed: {message}")]
    Unauthorized { message: String },
    
    /// Rate limit exceeded (429)
    #[error("Rate limit exceeded, retry after: {retry_after_secs:?}s")]
    RateLimited { retry_after_secs: Option<u64> },
    
    /// API returned an error response
    #[error("API error ({status}): {message}")]
    Api { status: u16, message: String },
    
    /// Request timeout
    #[error("Request timed out after {timeout_secs}s")]
    Timeout { timeout_secs: u64 },
    
    // =========================================================================
    // Agent Errors
    // =========================================================================
    
    /// Agent not found
    #[error("Agent not found: {agent_id}")]
    AgentNotFound { agent_id: String },
    
    /// Agent initialization failed
    #[error("Agent initialization failed: {reason}")]
    AgentInitFailed { reason: String },
    
    /// Agent arbitration failed (no suitable agent)
    #[error("Agent arbitration failed: {reason}")]
    ArbitrationFailed { reason: String },
    
    /// Agent execution failed
    #[error("Agent execution failed: {reason}")]
    ExecutionFailed { reason: String },
    
    // =========================================================================
    // Configuration Errors
    // =========================================================================
    
    /// Configuration file not found
    #[error("Config file not found: {path}")]
    ConfigNotFound { path: String },
    
    /// Configuration parse error
    #[error("Config parse error: {message}")]
    ConfigParse { message: String },
    
    /// Configuration validation failed
    #[error("Config validation failed: {field}: {message}")]
    ConfigValidation { field: String, message: String },
    
    // =========================================================================
    // Knowledge Graph Errors
    // =========================================================================
    
    /// Knowledge graph parse error
    #[error("Knowledge graph parse error: {message}")]
    GraphParse { message: String },
    
    /// Knowledge graph not found
    #[error("Knowledge graph not found: {name}")]
    GraphNotFound { name: String },
    
    /// Reasoning context error
    #[error("Reasoning context error: {message}")]
    ReasoningError { message: String },
    
    // =========================================================================
    // Memory Adapter Errors
    // =========================================================================
    
    /// Memory service unavailable
    #[error("Memory service unavailable: {endpoint}")]
    MemoryUnavailable { endpoint: String },
    
    /// Memory operation failed
    #[error("Memory operation failed: {operation}: {reason}")]
    MemoryOperation { operation: String, reason: String },
    
    // =========================================================================
    // Metrics Errors
    // =========================================================================
    
    /// Metrics creation failed
    #[error("Metrics creation failed: {message}")]
    MetricsCreation { message: String },
    
    /// Metrics encoding failed
    #[error("Metrics encoding failed: {message}")]
    MetricsEncoding { message: String },
    
    // =========================================================================
    // Canvas Bridge Errors
    // =========================================================================
    
    /// Canvas not found
    #[error("Canvas not found: {canvas_id}")]
    CanvasNotFound { canvas_id: String },
    
    /// Canvas binding error
    #[error("Canvas binding error: {message}")]
    CanvasBinding { message: String },
    
    // =========================================================================
    // Generic Errors
    // =========================================================================
    
    /// Parse error (JSON, YAML, etc.)
    #[error("Parse error: {0}")]
    Parse(String),
    
    /// Serialization error
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    
    /// IO error
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    /// Internal error (should not happen)
    #[error("Internal error: {0}")]
    Internal(String),
}

impl SystemAgentError {
    /// Create an unauthorized error
    pub fn unauthorized(message: impl Into<String>) -> Self {
        Self::Unauthorized { message: message.into() }
    }
    
    /// Create a rate limited error
    pub fn rate_limited(retry_after: Option<u64>) -> Self {
        Self::RateLimited { retry_after_secs: retry_after }
    }
    
    /// Create an API error from status code and message
    pub fn api(status: u16, message: impl Into<String>) -> Self {
        Self::Api { status, message: message.into() }
    }
    
    /// Create an agent not found error
    pub fn agent_not_found(agent_id: impl Into<String>) -> Self {
        Self::AgentNotFound { agent_id: agent_id.into() }
    }
    
    /// Create a config validation error
    pub fn config_validation(field: impl Into<String>, message: impl Into<String>) -> Self {
        Self::ConfigValidation { 
            field: field.into(), 
            message: message.into() 
        }
    }
    
    /// Check if error is retryable
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            Self::Network(_) 
            | Self::RateLimited { .. } 
            | Self::Timeout { .. }
            | Self::MemoryUnavailable { .. }
        )
    }
    
    /// Get HTTP status code if applicable
    pub fn status_code(&self) -> Option<u16> {
        match self {
            Self::Unauthorized { .. } => Some(401),
            Self::RateLimited { .. } => Some(429),
            Self::Api { status, .. } => Some(*status),
            Self::AgentNotFound { .. } => Some(404),
            Self::CanvasNotFound { .. } => Some(404),
            Self::GraphNotFound { .. } => Some(404),
            _ => None,
        }
    }
}

// =========================================================================
// Conversion Implementations
// =========================================================================

impl From<&str> for SystemAgentError {
    fn from(s: &str) -> Self {
        Self::Internal(s.to_string())
    }
}

impl From<String> for SystemAgentError {
    fn from(s: String) -> Self {
        Self::Internal(s)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_error_display() {
        let err = SystemAgentError::unauthorized("Invalid token");
        assert_eq!(err.to_string(), "Authentication failed: Invalid token");
    }
    
    #[test]
    fn test_retryable_errors() {
        assert!(SystemAgentError::rate_limited(Some(30)).is_retryable());
        assert!(SystemAgentError::Timeout { timeout_secs: 30 }.is_retryable());
        assert!(!SystemAgentError::unauthorized("test").is_retryable());
    }
    
    #[test]
    fn test_status_codes() {
        assert_eq!(SystemAgentError::unauthorized("test").status_code(), Some(401));
        assert_eq!(SystemAgentError::rate_limited(None).status_code(), Some(429));
        assert_eq!(SystemAgentError::api(500, "error").status_code(), Some(500));
    }
}

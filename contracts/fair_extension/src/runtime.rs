//! # Extension Runtime Interface
//!
//! Defines the runtime contract that all extensions must implement.
//! This is the code-level interface for how extensions plug into Chrysalis.

use serde::{Deserialize, Serialize};
use std::collections::HashSet;

/// Health status levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum HealthLevel {
    Healthy,
    Degraded,
    Unhealthy,
}

/// Health check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthStatus {
    pub level: HealthLevel,
    pub message: String,
    pub check_duration_ms: u64,
}

impl HealthStatus {
    pub fn healthy(message: &str) -> Self {
        Self {
            level: HealthLevel::Healthy,
            message: message.to_string(),
            check_duration_ms: 0,
        }
    }

    pub fn degraded(message: &str) -> Self {
        Self {
            level: HealthLevel::Degraded,
            message: message.to_string(),
            check_duration_ms: 0,
        }
    }

    pub fn unhealthy(message: &str) -> Self {
        Self {
            level: HealthLevel::Unhealthy,
            message: message.to_string(),
            check_duration_ms: 0,
        }
    }
}

/// Configuration passed to extensions during initialization
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ExtensionConfig {
    pub debug: bool,
    pub timeout_init_ms: u64,
    pub timeout_operation_ms: u64,
    pub timeout_shutdown_ms: u64,
    pub metadata: std::collections::HashMap<String, String>,
}

/// Log level
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

/// Logging configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogConfig {
    pub level: LogLevel,
    pub structured: bool,
    pub namespace: String,
}

/// Metric type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MetricType {
    Counter,
    Gauge,
    Histogram,
}

/// Metric definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricDefinition {
    pub name: String,
    pub metric_type: MetricType,
    pub description: String,
    pub labels: Vec<String>,
}

/// The runtime contract all extensions must implement.
///
/// This trait defines lifecycle, capabilities, and observability
/// requirements for extensions.
pub trait ExtensionRuntime: Send + Sync {
    /// Unique extension identifier
    /// Format: namespace:category:name
    fn extension_id(&self) -> &str;

    /// Extension category
    fn category(&self) -> crate::extension::ExtensionCategory;

    /// Initialize with configuration.
    /// Must complete within timeout, must be idempotent.
    fn initialize(&mut self, config: ExtensionConfig) -> Result<(), ExtensionError>;

    /// Graceful shutdown with cleanup.
    /// Must release all resources.
    fn dispose(&mut self) -> Result<(), ExtensionError>;

    /// Health check. Must complete within 1 second.
    fn health(&self) -> HealthStatus;

    /// Capabilities this extension provides
    fn capabilities(&self) -> HashSet<String>;

    /// Capabilities this extension requires from others
    fn dependencies(&self) -> HashSet<String>;

    /// Metric definitions for observability
    fn metrics(&self) -> Vec<MetricDefinition>;

    /// Logging configuration
    fn log_config(&self) -> LogConfig;
}

/// Errors that can occur during extension operations
#[derive(Debug, thiserror::Error)]
pub enum ExtensionError {
    #[error("Initialization failed: {0}")]
    InitializationFailed(String),

    #[error("Operation timed out after {0}ms")]
    Timeout(u64),

    #[error("Configuration invalid: {0}")]
    InvalidConfig(String),

    #[error("Dependency not satisfied: {0}")]
    DependencyMissing(String),

    #[error("Extension error: {0}")]
    Other(String),
}

/// Registration result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistrationResult {
    pub success: bool,
    pub extension_id: String,
    pub message: String,
    pub warnings: Vec<String>,
}

/// Validate extension ID format
pub fn validate_extension_id(id: &str) -> bool {
    let parts: Vec<&str> = id.split(':').collect();
    if parts.len() != 3 {
        return false;
    }

    let pattern = regex::Regex::new(r"^[a-z][a-z0-9-]*$").unwrap();
    parts.iter().all(|part| pattern.is_match(part))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_extension_ids() {
        assert!(validate_extension_id("chrysalis:memory:fireproof"));
        assert!(validate_extension_id("community:ledger:hedera"));
        assert!(validate_extension_id("myorg:ide:cursor"));
    }

    #[test]
    fn invalid_extension_ids() {
        assert!(!validate_extension_id("invalid"));
        assert!(!validate_extension_id("too:many:parts:here"));
        assert!(!validate_extension_id("Invalid:Case:Here"));
        assert!(!validate_extension_id("123:starts:number"));
    }
}

//! Adapter traits
//!
//! Core traits for protocol adapters

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

/// Universal message (placeholder)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UniversalMessage {
    pub message_id: String,
    // TODO: Add fields from TypeScript UniversalMessage
}

/// Protocol-specific message (placeholder)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolMessage {
    // TODO: Add fields
}

/// Conversion options
#[derive(Debug, Clone, Default)]
pub struct ConversionOptions {
    // TODO: Add options from TypeScript
}

/// Validation result
#[derive(Debug, Clone)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
}

/// Protocol capability
#[derive(Debug, Clone)]
pub struct ProtocolCapability {
    // TODO: Add fields
}

/// Adapter health status
#[derive(Debug, Clone)]
pub struct AdapterHealth {
    pub status: HealthStatus,
    pub latency_ms: Option<f64>,
    pub error_rate: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HealthStatus {
    Healthy,
    Degraded,
    Unhealthy,
}

/// Adapter errors
#[derive(Debug, thiserror::Error)]
pub enum AdapterError {
    #[error("Translation failed: {0}")]
    TranslationError(String),

    #[error("Validation failed: {0}")]
    ValidationError(String),

    #[error("Protocol error: {0}")]
    ProtocolError(String),
}

/// Unified adapter trait
///
/// All protocol adapters must implement this trait
#[async_trait]
pub trait UnifiedAdapter: Send + Sync {
    /// Translate message to protocol-specific format
    async fn translate(
        &self,
        message: UniversalMessage,
        options: ConversionOptions,
    ) -> Result<ProtocolMessage, AdapterError>;

    /// Validate protocol message
    async fn validate(
        &self,
        message: &ProtocolMessage,
    ) -> Result<ValidationResult, AdapterError>;

    /// Get adapter capabilities
    fn capabilities(&self) -> &ProtocolCapability;

    /// Check adapter health
    async fn health(&self) -> AdapterHealth;
}

/// Protocol-specific adapter trait
#[async_trait]
pub trait ProtocolAdapter: UnifiedAdapter {
    /// Get protocol identifier
    fn protocol(&self) -> &str;

    /// Get protocol version
    fn version(&self) -> &str;
}

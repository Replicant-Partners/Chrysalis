//! Semantic Agent types
//!
//! Core agent representation operating in semantic/meaning space.
//! Supports multiple implementation types, experience synchronization,
//! and protocol capabilities.

use serde::{Deserialize, Serialize};

/// Schema version for agent serialization
pub const SCHEMA_VERSION: &str = "2.0.0";

/// Agent implementation types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentImplementationType {
    Mcp,
    MultiAgent,
    Orchestrated,
}

/// Semantic Agent V2
///
/// The canonical agent representation in Chrysalis.
/// Agents operate agentically in semantic/meaning space.
///
/// Key capabilities:
/// - Multiple implementation types (MCP, Multi-Agent, Orchestrated)
/// - Experience synchronization across instances
/// - Instance tracking and lifecycle management
/// - Multi-protocol support (MCP, A2A, Agent Protocol)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SemanticAgent {
    pub schema_version: String,
    // TODO: Add all fields from TypeScript
    // Reference: src/core/UniformSemanticAgentV2.ts
}

impl SemanticAgent {
    /// Create a new semantic agent
    pub fn new() -> Self {
        Self {
            schema_version: SCHEMA_VERSION.to_string(),
        }
    }

    /// Parse agent from JSON string
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }

    /// Serialize agent to JSON string
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }

    /// Validate agent schema
    pub fn validate(&self) -> Result<(), ValidationError> {
        // TODO: Implement validation logic
        Ok(())
    }
}

impl Default for SemanticAgent {
    fn default() -> Self {
        Self::new()
    }
}

/// Validation errors
#[derive(Debug, thiserror::Error)]
pub enum ValidationError {
    #[error("Invalid schema version: {0}")]
    InvalidSchemaVersion(String),

    #[error("Missing required field: {0}")]
    MissingField(String),

    #[error("Invalid field value: {field} = {value}")]
    InvalidValue { field: String, value: String },
}

// Legacy type alias for backward compatibility
pub type UniformSemanticAgentV2 = SemanticAgent;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_agent() {
        let agent = SemanticAgent::new();
        assert_eq!(agent.schema_version, SCHEMA_VERSION);
    }

    #[test]
    fn test_json_roundtrip() {
        let agent = SemanticAgent::new();
        let json = agent.to_json().unwrap();
        let parsed = SemanticAgent::from_json(&json).unwrap();
        assert_eq!(agent.schema_version, parsed.schema_version);
    }

    #[test]
    fn test_legacy_alias() {
        // Verify UniformSemanticAgentV2 alias still works
        let agent: UniformSemanticAgentV2 = SemanticAgent::new();
        assert_eq!(agent.schema_version, SCHEMA_VERSION);
    }
}

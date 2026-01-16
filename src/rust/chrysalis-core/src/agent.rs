//! Core agent types
//!
//! This module defines the `UniformSemanticAgentV2` type and related structures.

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

/// Uniform Semantic Agent V2
///
/// The canonical agent representation in Chrysalis, supporting:
/// - Multiple implementation types
/// - Experience synchronization
/// - Instance tracking
/// - Protocol capabilities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UniformSemanticAgentV2 {
    pub schema_version: String,
    // TODO: Add all fields from TypeScript UniformSemanticAgentV2
    // See: /home/mdz-axolotl/Documents/GitClones/Chrysalis/src/core/UniformSemanticAgentV2.ts
}

impl UniformSemanticAgentV2 {
    /// Create a new agent with default values
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

impl Default for UniformSemanticAgentV2 {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_agent() {
        let agent = UniformSemanticAgentV2::new();
        assert_eq!(agent.schema_version, SCHEMA_VERSION);
    }

    #[test]
    fn test_json_roundtrip() {
        let agent = UniformSemanticAgentV2::new();
        let json = agent.to_json().unwrap();
        let parsed = UniformSemanticAgentV2::from_json(&json).unwrap();
        assert_eq!(agent.schema_version, parsed.schema_version);
    }
}

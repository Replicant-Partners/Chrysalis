//! Semantic Agent types
//!
//! Core agent representation operating in semantic/meaning space.
//! Supports multiple implementation types, experience synchronization,
//! and protocol capabilities.

use serde::{Deserialize, Serialize};
use super::component_types::*;
use super::types::*;

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
    pub identity: Identity,
    pub personality: Personality,
    pub communication: Communication,
    pub capabilities: Capabilities,
    pub knowledge: Knowledge,
    pub memory: Memory,
    pub beliefs: Beliefs,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub training: Option<Training>,

    pub instances: Instances,
    pub experience_sync: ExperienceSyncConfig,
    pub protocols: Protocols,
    pub execution: Execution,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub deployment: Option<Deployment>,

    pub metadata: Metadata,
}

impl SemanticAgent {
    pub fn new(id: String, name: String, designation: String) -> Self {
        let now = chrono::Utc::now().to_rfc3339();

        Self {
            schema_version: SCHEMA_VERSION.to_string(),
            identity: Identity {
                id: id.clone(),
                name,
                designation,
                bio: Bio::Single(String::new()),
                fingerprint: String::new(),
                created: now.clone(),
                version: "1.0.0".to_string(),
            },
            personality: Personality {
                core_traits: Vec::new(),
                values: Vec::new(),
                quirks: Vec::new(),
                fears: None,
                aspirations: None,
                emotional_ranges: None,
            },
            communication: Communication {
                style: std::collections::HashMap::from([("all".to_string(), Vec::new())]),
                signature_phrases: None,
                voice: None,
            },
            capabilities: Capabilities {
                primary: Vec::new(),
                secondary: Vec::new(),
                domains: Vec::new(),
                tools: None,
                learned_skills: None,
            },
            knowledge: Knowledge {
                facts: Vec::new(),
                topics: Vec::new(),
                expertise: Vec::new(),
                sources: None,
                lore: None,
                accumulated_knowledge: None,
            },
            memory: Memory {
                memory_type: MemoryType::Hybrid,
                provider: "default".to_string(),
                settings: std::collections::HashMap::new(),
                collections: None,
            },
            beliefs: Beliefs {
                who: Vec::new(),
                what: Vec::new(),
                why: Vec::new(),
                how: Vec::new(),
                where_: None,
                when: None,
                huh: None,
            },
            training: None,
            instances: Instances {
                active: Vec::new(),
                terminated: Vec::new(),
            },
            experience_sync: ExperienceSyncConfig {
                enabled: false,
                default_protocol: SyncProtocol::Streaming,
                transport: None,
                streaming: None,
                lumped: None,
                check_in: None,
                merge_strategy: MergeStrategy {
                    conflict_resolution: ConflictResolution::LatestWins,
                    memory_deduplication: true,
                    skill_aggregation: SkillAggregation::Max,
                    knowledge_verification_threshold: 0.7,
                },
            },
            protocols: Protocols {
                mcp: None,
                a2a: None,
                agent_protocol: None,
            },
            execution: Execution {
                llm: LlmConfig {
                    provider: "anthropic".to_string(),
                    model: "claude-sonnet-4.5".to_string(),
                    temperature: 0.7,
                    max_tokens: 4096,
                    parameters: None,
                },
                runtime: RuntimeConfig {
                    timeout: 300000,
                    max_iterations: 25,
                    retry_policy: None,
                    error_handling: "graceful".to_string(),
                },
            },
            deployment: None,
            metadata: Metadata {
                version: "1.0.0".to_string(),
                schema_version: SCHEMA_VERSION.to_string(),
                created: now.clone(),
                updated: now,
                author: None,
                tags: None,
                source_framework: None,
                evolution: None,
            },
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

    pub fn to_json_pretty(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string_pretty(self)
    }

    pub fn validate(&self) -> super::validation::ValidationReport {
        super::validation::validate_agent(self)
    }
}

impl Default for SemanticAgent {
    fn default() -> Self {
        Self::new(
            uuid::Uuid::new_v4().to_string(),
            "Unnamed Agent".to_string(),
            "Generic Agent".to_string(),
        )
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
        let agent = SemanticAgent::new(
            "test-001".to_string(),
            "Test Agent".to_string(),
            "Testing".to_string(),
        );
        assert_eq!(agent.schema_version, SCHEMA_VERSION);
        assert_eq!(agent.identity.id, "test-001");
    }

    #[test]
    fn test_json_roundtrip() {
        let agent = SemanticAgent::default();
        let json = agent.to_json().unwrap();
        let parsed = SemanticAgent::from_json(&json).unwrap();
        assert_eq!(agent.identity.id, parsed.identity.id);
    }

    #[test]
    fn test_legacy_alias() {
        let agent: UniformSemanticAgentV2 = SemanticAgent::default();
        assert_eq!(agent.schema_version, SCHEMA_VERSION);
    }
}

//! Component type definitions for SemanticAgent

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use super::types::*;

// ============================================================================
// Bio (Union Type)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Bio {
    Single(String),
    Multiple(Vec<String>),
}

// ============================================================================
// Identity
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Identity {
    pub id: String,
    pub name: String,
    pub designation: String,
    pub bio: Bio,
    pub fingerprint: String,
    pub created: String,
    pub version: String,
}

// ============================================================================
// Personality
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmotionalRange {
    pub triggers: Vec<String>,
    pub expressions: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voice: Option<VoiceModulation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceModulation {
    pub speed: f64,
    pub pitch: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Personality {
    pub core_traits: Vec<String>,
    pub values: Vec<String>,
    pub quirks: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fears: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub aspirations: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub emotional_ranges: Option<HashMap<String, EmotionalRange>>,
}

// ============================================================================
// Communication
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub speaker: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub characteristics: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub speed: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pitch: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Communication {
    pub style: HashMap<String, Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signature_phrases: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voice: Option<VoiceConfig>,
}

// ============================================================================
// Capabilities
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Capabilities {
    pub primary: Vec<String>,
    pub secondary: Vec<String>,
    pub domains: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<ToolDefinition>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub learned_skills: Option<Vec<Skill>>,
}

// ============================================================================
// Knowledge
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Knowledge {
    pub facts: Vec<String>,
    pub topics: Vec<String>,
    pub expertise: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sources: Option<Vec<serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lore: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub accumulated_knowledge: Option<Vec<AccumulatedKnowledge>>,
}

// ============================================================================
// Memory
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShortTermMemoryConfig {
    pub retention: String,
    pub max_size: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LongTermMemoryConfig {
    pub storage: String,
    pub embedding_model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryCollections {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub short_term: Option<ShortTermMemoryConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub long_term: Option<LongTermMemoryConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub episodic: Option<Vec<Episode>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub semantic: Option<Vec<Concept>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Memory {
    #[serde(rename = "type")]
    pub memory_type: MemoryType,
    pub provider: String,
    pub settings: HashMap<String, serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub collections: Option<MemoryCollections>,
}

// ============================================================================
// Beliefs
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Beliefs {
    pub who: Vec<Belief>,
    pub what: Vec<Belief>,
    pub why: Vec<Belief>,
    pub how: Vec<Belief>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "where")]
    pub where_: Option<Vec<Belief>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub when: Option<Vec<Belief>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub huh: Option<Vec<Belief>>,
}

// ============================================================================
// Training
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Training {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conversations: Option<Vec<serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub demonstrations: Option<Vec<serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub feedback: Option<Vec<serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub accumulated_examples: Option<Vec<AccumulatedExample>>,
}

// ============================================================================
// Instances
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Instances {
    pub active: Vec<InstanceMetadata>,
    pub terminated: Vec<InstanceMetadata>,
}

// ============================================================================
// Execution
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmConfig {
    pub provider: String,
    pub model: String,
    pub temperature: f64,
    pub max_tokens: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parameters: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryPolicy {
    pub max_attempts: u32,
    pub backoff: String,
    pub initial_delay: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeConfig {
    pub timeout: u64,
    pub max_iterations: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retry_policy: Option<RetryPolicy>,
    pub error_handling: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Execution {
    pub llm: LlmConfig,
    pub runtime: RuntimeConfig,
}

// ============================================================================
// Deployment
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Deployment {
    pub preferred_contexts: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scaling: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub environment: Option<HashMap<String, serde_json::Value>>,
}

// ============================================================================
// Metadata
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvolutionMetadata {
    pub total_deployments: u32,
    pub total_syncs: u32,
    pub total_skills_learned: u32,
    pub total_knowledge_acquired: u32,
    pub total_conversations: u32,
    pub last_evolution: String,
    pub evolution_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Metadata {
    pub version: String,
    pub schema_version: String,
    pub created: String,
    pub updated: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_framework: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub evolution: Option<EvolutionMetadata>,
}

// ============================================================================
// Experience Sync Configuration
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExperienceSyncConfig {
    pub enabled: bool,
    pub default_protocol: SyncProtocol,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transport: Option<ExperienceTransportConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub streaming: Option<StreamingSyncConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lumped: Option<LumpedSyncConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub check_in: Option<CheckInSyncConfig>,
    pub merge_strategy: MergeStrategy,
}

// ============================================================================
// Protocols
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpProtocolConfig {
    pub enabled: bool,
    pub role: ProtocolRole,
    pub servers: Vec<McpServer>,
    pub tools: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct A2aProtocolConfig {
    pub enabled: bool,
    pub role: ProtocolRole,
    pub endpoint: String,
    pub agent_card: AgentCard,
    pub authentication: AuthConfig,
    pub peers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentProtocolConfig {
    pub enabled: bool,
    pub endpoint: String,
    pub capabilities: Vec<String>,
    pub task_types: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Protocols {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mcp: Option<McpProtocolConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub a2a: Option<A2aProtocolConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_protocol: Option<AgentProtocolConfig>,
}

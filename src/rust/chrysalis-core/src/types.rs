//! Supporting types for SemanticAgent
//!
//! All enum and struct types used in the agent schema

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// Core Enumerations
// ============================================================================

/// Sync protocol types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SyncProtocol {
    Streaming,
    Lumped,
    CheckIn,
}

/// Experience transport types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExperienceTransportType {
    Https,
    Websocket,
    Mcp,
}

/// Instance status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InstanceStatus {
    Running,
    Idle,
    Syncing,
    Terminated,
}

/// OODA interrogative fields
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Hash)]
#[serde(rename_all = "snake_case")]
pub enum OODAField {
    Who,
    What,
    When,
    Where,
    Why,
    How,
    Huh,
}

/// Interaction types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InteractionType {
    Conversation,
    ToolUse,
    Decision,
    Collaboration,
}

/// Tool protocol types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ToolProtocol {
    Mcp,
    Native,
    Api,
}

/// Belief privacy levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum BeliefPrivacy {
    Public,
    Private,
}

/// Conflict resolution strategies
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConflictResolution {
    LatestWins,
    WeightedMerge,
    ManualReview,
}

/// Skill aggregation strategies
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SkillAggregation {
    Max,
    Average,
    Weighted,
}

/// Health status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HealthStatus {
    Healthy,
    Degraded,
    Unhealthy,
}

/// Memory storage types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MemoryType {
    Vector,
    Graph,
    Hybrid,
}

/// Protocol role
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProtocolRole {
    Client,
    Server,
    Both,
}

/// Authentication types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuthType {
    Oauth2,
    Jwt,
    Apikey,
}

/// Event types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EventType {
    Memory,
    Skill,
    Knowledge,
    Characteristic,
    Interaction,
}

// ============================================================================
// OODA Loop Types
// ============================================================================

/// OODA step - one entry per interrogative field
pub type OODAStep = HashMap<OODAField, Vec<String>>;

/// OODA interrogatives (Observe, Orient, Decide, Act)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OODAInterrogatives {
    pub observe: OODAStep,
    pub orient: OODAStep,
    pub decide: OODAStep,
    pub act: OODAStep,
}

// ============================================================================
// Episode and Interaction Types
// ============================================================================

/// Interaction within an episode
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Interaction {
    pub interaction_id: String,
    pub timestamp: String,
    #[serde(rename = "type")]
    pub interaction_type: InteractionType,
    pub participants: Vec<String>,
    pub content: String,
    pub result: String,
    pub effectiveness: f64,
}

/// Episode - specific experience instance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Episode {
    pub episode_id: String,
    pub timestamp: String,
    pub source_instance: String,
    pub duration: u64, // milliseconds
    pub context: HashMap<String, serde_json::Value>,
    pub interactions: Vec<Interaction>,
    pub outcome: String,
    pub lessons_learned: Vec<String>,
    pub skills_practiced: Vec<String>,
    pub effectiveness_rating: f64, // 0.0 - 1.0
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ooda: Option<OODAInterrogatives>,
}

/// Concept - semantic knowledge unit
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Concept {
    pub concept_id: String,
    pub name: String,
    pub definition: String,
    pub related_concepts: Vec<String>,
    pub confidence: f64,
    pub sources: Vec<String>,
    pub usage_count: u32,
    pub last_used: String,
}

/// Belief with evolution tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Belief {
    pub content: String,
    pub conviction: f64,
    pub privacy: BeliefPrivacy,
    pub source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub revision_history: Option<Vec<BeliefRevision>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BeliefRevision {
    pub timestamp: String,
    pub previous_conviction: f64,
    pub reason: String,
    pub source_instance: String,
}

// ============================================================================
// Tool and Skill Types
// ============================================================================

/// Tool definition with usage statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    pub name: String,
    pub protocol: ToolProtocol,
    pub config: HashMap<String, serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage_stats: Option<ToolUsageStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolUsageStats {
    pub total_invocations: u32,
    pub success_rate: f64,
    pub average_latency_ms: f64,
    pub last_used: String,
    pub preferred_contexts: Vec<String>,
}

/// Skill with learning tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    pub skill_id: String,
    pub name: String,
    pub category: String,
    pub proficiency: f64, // 0.0 - 1.0
    pub acquired: String,
    pub source_instances: Vec<String>,
    pub learning_curve: Vec<LearningCurvePoint>,
    pub usage: SkillUsage,
    pub prerequisites: Vec<String>,
    pub enables: Vec<String>,
    pub synergies: Vec<SkillSynergy>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LearningCurvePoint {
    pub timestamp: String,
    pub proficiency: f64,
    pub event: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillUsage {
    pub total_invocations: u32,
    pub success_rate: f64,
    pub contexts: Vec<String>,
    pub last_used: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillSynergy {
    pub skill_id: String,
    pub synergy_strength: f64,
}

/// Accumulated knowledge entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccumulatedKnowledge {
    pub knowledge_id: String,
    pub content: String,
    pub confidence: f64,
    pub source_instance: String,
    pub acquired: String,
    pub verification_count: u32,
}

/// Accumulated training example
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccumulatedExample {
    pub example_id: String,
    pub input: String,
    pub output: String,
    pub context: HashMap<String, serde_json::Value>,
    pub source_instance: String,
    pub timestamp: String,
    pub effectiveness_rating: f64,
}

// ============================================================================
// Instance Management Types
// ============================================================================

/// Instance metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstanceMetadata {
    pub instance_id: String,
    #[serde(rename = "type")]
    pub instance_type: super::agent::AgentImplementationType,
    pub framework: String,
    pub deployment_context: String,
    pub created: String,
    pub last_sync: String,
    pub status: InstanceStatus,
    pub sync_protocol: SyncProtocol,
    pub endpoint: String,
    pub health: InstanceHealth,
    pub statistics: InstanceStatistics,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transport: Option<ExperienceTransportConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstanceHealth {
    pub status: HealthStatus,
    pub last_heartbeat: String,
    pub error_rate: f64,
    pub sync_lag: u64, // milliseconds
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstanceStatistics {
    pub total_syncs: u32,
    pub memories_contributed: u32,
    pub skills_learned: u32,
    pub knowledge_acquired: u32,
    pub conversations_handled: u32,
}

// ============================================================================
// Transport Configuration Types
// ============================================================================

/// Experience transport configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExperienceTransportConfig {
    #[serde(rename = "type")]
    pub transport_type: ExperienceTransportType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub https: Option<HttpsTransportConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub websocket: Option<WebSocketTransportConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mcp: Option<McpTransportConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpsTransportConfig {
    pub endpoint: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auth_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub headers: Option<HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub verify_tls: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebSocketTransportConfig {
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub protocols: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpTransportConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub server: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_name: Option<String>,
}

// ============================================================================
// Experience Sync Configuration Types
// ============================================================================

/// Streaming sync configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamingSyncConfig {
    pub enabled: bool,
    pub interval_ms: u64,
    pub batch_size: u32,
    pub priority_threshold: f64,
}

/// Lumped sync configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LumpedSyncConfig {
    pub enabled: bool,
    pub batch_interval: String, // e.g., "1h", "6h", "24h"
    pub max_batch_size: u32,
    pub compression: bool,
}

/// Check-in sync configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckInSyncConfig {
    pub enabled: bool,
    pub schedule: String, // cron expression
    pub include_full_state: bool,
}

/// Merge strategy configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeStrategy {
    pub conflict_resolution: ConflictResolution,
    pub memory_deduplication: bool,
    pub skill_aggregation: SkillAggregation,
    pub knowledge_verification_threshold: f64,
}

// ============================================================================
// Protocol Configuration Types
// ============================================================================

/// MCP server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServer {
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    pub env: HashMap<String, String>,
}

/// Agent card for A2A protocol
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentCard {
    pub name: String,
    pub version: String,
    pub protocol_version: String,
    pub capabilities: Vec<String>,
    pub skills: Vec<AgentCardSkill>,
    pub endpoint: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentCardSkill {
    pub name: String,
    pub description: String,
}

/// Authentication configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConfig {
    #[serde(rename = "type")]
    pub auth_type: AuthType,
    pub config: HashMap<String, serde_json::Value>,
}

// ============================================================================
// Experience Event Types
// ============================================================================

/// Experience event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExperienceEvent {
    pub event_id: String,
    pub timestamp: String,
    pub source_instance: String,
    pub event_type: EventType,
    pub priority: f64, // 0.0 - 1.0
    pub data: HashMap<String, serde_json::Value>,
    pub context: EventContext,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventContext {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub task_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conversation_id: Option<String>,
    pub trigger: String,
    pub environment: HashMap<String, serde_json::Value>,
}

/// Experience batch for lumped sync
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExperienceBatch {
    pub batch_id: String,
    pub instance_id: String,
    pub timestamp_start: String,
    pub timestamp_end: String,
    pub event_count: u32,
    pub events: BatchEvents,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchEvents {
    pub memories: Vec<serde_json::Value>,
    pub skills: Vec<Skill>,
    pub knowledge: Vec<serde_json::Value>,
    pub interactions: Vec<Interaction>,
    pub stats: HashMap<String, serde_json::Value>,
}

/// Sync result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    pub instance_id: String,
    pub sync_timestamp: String,
    pub events_synced: u32,
    pub memories_added: u32,
    pub skills_updated: u32,
    pub knowledge_acquired: u32,
    pub characteristics_refined: u32,
    pub conflicts_detected: u32,
    pub conflicts_resolved: u32,
    pub conflicts_queued: u32,
    pub next_sync: String,
    pub backlog_size: u32,
}

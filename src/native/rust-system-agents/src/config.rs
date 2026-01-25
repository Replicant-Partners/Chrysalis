//! System agent configuration types and loader
//!
//! This module provides comprehensive configuration types for system agents,
//! including model configuration, memory settings, behavior definitions,
//! and SCM (Structured Conversation Management) policies.
//!
//! Ported from TypeScript SystemAgentLoader to Rust.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

// =============================================================================
// Evaluation Dimensions
// =============================================================================

/// Evaluation dimension configuration
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EvaluationDimension {
    pub weight: f32,
    pub description: String,
}

/// Output schema field definition
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SchemaField {
    #[serde(rename = "type")]
    pub field_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub items: Option<Box<SchemaField>>,
}

/// Output schema configuration
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OutputSchema {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scorecard: Option<HashMap<String, SchemaField>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub risk_score: Option<SchemaField>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recommendations: Option<SchemaField>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub requires_human_review: Option<SchemaField>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confidence: Option<SchemaField>,
}

// =============================================================================
// Model Configuration
// =============================================================================

/// Model provider configuration
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModelProvider {
    pub provider: String,
    pub model: String,
    pub use_cases: Vec<String>,
}

/// Full model configuration for an agent
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModelConfig {
    pub model_tier: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub primary_model: Option<ModelProvider>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub local_model: Option<ModelProvider>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cursor_model: Option<ModelProvider>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fallback_model: Option<ModelProvider>,
    pub context_window: u32,
    pub default_temperature: f32,
    pub latency_budget_ms: u32,
    #[serde(rename = "_note", skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

// =============================================================================
// Memory Configuration
// =============================================================================

/// Memory scope configuration
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MemoryScope {
    pub description: String,
    pub retention_days: u32,
    pub promotion_threshold: f32,
}

/// Beads service configuration
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BeadsServiceConfig {
    pub max_items: u32,
    pub ttl_seconds: u32,
    pub promotion_enabled: bool,
}

/// Fireproof service configuration
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FireproofServiceConfig {
    pub db_name: String,
    pub promotion_enabled: bool,
    pub local_vector_cache: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sync_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sync_gateway: Option<String>,
}

/// Zep hooks configuration
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ZepHooksConfig {
    pub enabled: bool,
    pub sync_interval: u32,
}

/// Memory integration configuration
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MemoryIntegration {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub beads_service: Option<BeadsServiceConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fireproof_service: Option<FireproofServiceConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub zep_hooks: Option<ZepHooksConfig>,
}

/// Full memory configuration for an agent
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MemoryConfig {
    pub access: String,
    pub namespace: String,
    pub scopes: HashMap<String, MemoryScope>,
    pub integration: MemoryIntegration,
}

// =============================================================================
// Telemetry Configuration
// =============================================================================

/// Telemetry configuration
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TelemetryConfig {
    pub level: String,
    pub metrics: Vec<String>,
    pub sampling: f32,
}

// =============================================================================
// Interaction States
// =============================================================================

/// Interaction state configuration
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InteractionState {
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeout: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub triggers: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dnd_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dnd_expiry_hours: Option<u32>,
}

// =============================================================================
// Escalation Rules
// =============================================================================

/// Risk threshold configuration
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RiskThreshold {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max: Option<f32>,
}

/// Escalation rules configuration
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EscalationRules {
    pub risk_thresholds: HashMap<String, RiskThreshold>,
    pub critical_bypass_threshold: f32,
    pub conflict_resolution: String,
}

// =============================================================================
// Collaborator Configuration
// =============================================================================

/// Collaborator relationship definition
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Collaborator {
    pub relationship: String,
    pub handoff: String,
}

// =============================================================================
// Behavior Configuration
// =============================================================================

/// Job schedule configuration
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct JobSchedule {
    #[serde(rename = "type")]
    pub schedule_type: String,
    pub value: String,
}

/// Scheduled job configuration
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ScheduledJob {
    pub job_id: String,
    pub description: String,
    pub schedule: JobSchedule,
    pub priority: String,
    pub timeout_seconds: u32,
    pub enabled: bool,
}

/// Trigger condition configuration
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TriggerCondition {
    #[serde(rename = "type")]
    pub condition_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub event_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metric_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub threshold: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comparator: Option<String>,
}

/// Conversation trigger configuration
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ConversationTrigger {
    pub trigger_id: String,
    pub condition: TriggerCondition,
    pub enabled: bool,
}

/// Text variation with weight
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TextVariation {
    pub text: String,
    pub weight: f32,
}

/// Conversation opener configuration
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ConversationOpener {
    pub opener_id: String,
    pub trigger_refs: Vec<String>,
    pub variations: Vec<TextVariation>,
}

/// Idiom configuration
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Idiom {
    pub idiom_id: String,
    pub category: String,
    pub variations: Vec<TextVariation>,
}

/// Full behavior configuration
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BehaviorConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub jobs: Option<Vec<ScheduledJob>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conversation_triggers: Option<Vec<ConversationTrigger>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub openers: Option<Vec<ConversationOpener>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub idioms: Option<Vec<Idiom>>,
}

// =============================================================================
// SCM Policy Configuration
// =============================================================================

/// Initiative policy
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InitiativePolicy {
    pub mode: String,
    pub cooldown_ms: u32,
    pub proactive_triggers: Vec<String>,
    #[serde(rename = "max_messages_10min")]
    pub max_messages_10min: u32,
}

/// Turn-taking policy
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TurnTakingPolicy {
    pub priority: f32,
    pub yield_to: Vec<String>,
    pub interrupt_threshold: f32,
}

/// Coaching policy
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CoachingPolicy {
    pub style: String,
    pub verbosity: String,
    pub question_frequency: f32,
}

/// Creativity policy
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CreativityPolicy {
    pub temperature_range: [f32; 2],
    pub metaphor_allowed: bool,
    pub humor_level: f32,
}

/// Coordination policy
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CoordinationPolicy {
    pub complement_tags: Vec<String>,
    pub conflict_resolution: String,
    pub max_agents_per_turn: u32,
}

/// Repair policy
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RepairPolicy {
    pub misunderstanding_detection: bool,
    pub correction_style: String,
    pub escalation_threshold: f32,
}

/// Full SCM (Structured Conversation Management) policy
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SCMPolicy {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub initiative: Option<InitiativePolicy>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub turn_taking: Option<TurnTakingPolicy>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub coaching: Option<CoachingPolicy>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub creativity: Option<CreativityPolicy>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub coordination: Option<CoordinationPolicy>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repair: Option<RepairPolicy>,
}

// =============================================================================
// Full Agent Configuration
// =============================================================================

/// Complete system agent configuration
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SystemAgentConfig {
    #[serde(rename = "$schema", skip_serializing_if = "Option::is_none")]
    pub schema: Option<String>,
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub full_name: Option<String>,
    pub role: String,
    pub description: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub persona_source: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub evaluation_dimensions: Option<HashMap<String, EvaluationDimension>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_schema: Option<OutputSchema>,

    pub model_config: ModelConfig,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_tools: Option<Vec<String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub memory_config: Option<MemoryConfig>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub telemetry_config: Option<TelemetryConfig>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub interaction_states: Option<HashMap<String, InteractionState>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub escalation_rules: Option<EscalationRules>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub dependencies: Option<Vec<String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub collaborators: Option<HashMap<String, Collaborator>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompt_set_id: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub behavior: Option<BehaviorConfig>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub scm_policy: Option<SCMPolicy>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_updated: Option<String>,
}

// =============================================================================
// Agent Loader
// =============================================================================

/// Result type for agent loading operations
pub type LoadResult<T> = Result<T, AgentLoadError>;

/// Errors that can occur when loading agents
#[derive(Debug)]
pub enum AgentLoadError {
    IoError(std::io::Error),
    ParseError(serde_json::Error),
    ValidationError(String),
    NotFound(String),
}

impl std::fmt::Display for AgentLoadError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AgentLoadError::IoError(e) => write!(f, "IO error: {}", e),
            AgentLoadError::ParseError(e) => write!(f, "Parse error: {}", e),
            AgentLoadError::ValidationError(msg) => write!(f, "Validation error: {}", msg),
            AgentLoadError::NotFound(path) => write!(f, "Agent config not found: {}", path),
        }
    }
}

impl std::error::Error for AgentLoadError {}

impl From<std::io::Error> for AgentLoadError {
    fn from(err: std::io::Error) -> Self {
        AgentLoadError::IoError(err)
    }
}

impl From<serde_json::Error> for AgentLoadError {
    fn from(err: serde_json::Error) -> Self {
        AgentLoadError::ParseError(err)
    }
}

/// System agent loader - loads and manages agent configurations
pub struct SystemAgentLoader {
    config_dir: PathBuf,
    agents: HashMap<String, SystemAgentConfig>,
    prompts: HashMap<String, serde_json::Value>,
}

impl SystemAgentLoader {
    /// Create a new loader with the given configuration directory
    pub fn new(config_dir: impl AsRef<Path>) -> Self {
        SystemAgentLoader {
            config_dir: config_dir.as_ref().to_path_buf(),
            agents: HashMap::new(),
            prompts: HashMap::new(),
        }
    }

    /// Load a single agent configuration by ID
    pub fn load_agent(&mut self, agent_id: &str) -> LoadResult<&SystemAgentConfig> {
        let config_path = self.config_dir.join(format!("{}_config.json", agent_id));

        if !config_path.exists() {
            // Try alternative naming (e.g., "Milton" with capital)
            let alt_path = self.config_dir.join(format!("{}_config.json", capitalize(agent_id)));
            if alt_path.exists() {
                return self.load_agent_from_path(&alt_path, agent_id);
            }
            return Err(AgentLoadError::NotFound(config_path.display().to_string()));
        }

        self.load_agent_from_path(&config_path, agent_id)
    }

    /// Load agent from a specific path
    fn load_agent_from_path(&mut self, path: &Path, agent_id: &str) -> LoadResult<&SystemAgentConfig> {
        let content = fs::read_to_string(path)?;
        let config: SystemAgentConfig = serde_json::from_str(&content)?;

        // Validate the configuration
        self.validate_config(&config)?;

        // Load associated prompts if available
        if let Some(prompt_set_id) = &config.prompt_set_id {
            self.load_prompts(prompt_set_id)?;
        }

        self.agents.insert(agent_id.to_string(), config);
        Ok(self.agents.get(agent_id).unwrap())
    }

    /// Load all system agents
    pub fn load_all(&mut self) -> LoadResult<Vec<&SystemAgentConfig>> {
        let agent_ids = ["ada", "lea", "phil", "david", "milton"];

        // First pass: load all agents by reading files directly
        for agent_id in agent_ids {
            if self.agents.contains_key(agent_id) {
                continue;
            }
            
            let config_path = self.config_dir.join(format!("{}_config.json", agent_id));
            let path_to_use = if config_path.exists() {
                config_path
            } else {
                let alt_path = self.config_dir.join(format!("{}_config.json", capitalize(agent_id)));
                if alt_path.exists() {
                    alt_path
                } else {
                    continue; // Agent not found, skip
                }
            };
            
            match fs::read_to_string(&path_to_use) {
                Ok(content) => {
                    match serde_json::from_str::<SystemAgentConfig>(&content) {
                        Ok(config) => {
                            self.agents.insert(agent_id.to_string(), config);
                        }
                        Err(_) => continue,
                    }
                }
                Err(_) => continue,
            }
        }

        // Return references to the loaded agents
        Ok(self.agents.values().collect())
    }

    /// Get a loaded agent by ID
    pub fn get_agent(&self, agent_id: &str) -> Option<&SystemAgentConfig> {
        self.agents.get(agent_id)
    }

    /// Get all loaded agents
    pub fn get_all_agents(&self) -> Vec<&SystemAgentConfig> {
        self.agents.values().collect()
    }

    /// Get agent IDs
    pub fn get_agent_ids(&self) -> Vec<&str> {
        self.agents.keys().map(|s| s.as_str()).collect()
    }

    /// Load prompts for an agent
    fn load_prompts(&mut self, prompt_set_id: &str) -> LoadResult<()> {
        let prompts_path = self.config_dir
            .join("prompts")
            .join(format!("{}.json", prompt_set_id));

        if prompts_path.exists() {
            let content = fs::read_to_string(prompts_path)?;
            let prompts: serde_json::Value = serde_json::from_str(&content)?;
            self.prompts.insert(prompt_set_id.to_string(), prompts);
        }

        Ok(())
    }

    /// Get prompts for an agent
    pub fn get_prompts(&self, prompt_set_id: &str) -> Option<&serde_json::Value> {
        self.prompts.get(prompt_set_id)
    }

    /// Validate an agent configuration
    fn validate_config(&self, config: &SystemAgentConfig) -> LoadResult<()> {
        // Validate required fields
        if config.id.is_empty() {
            return Err(AgentLoadError::ValidationError("Agent ID is required".to_string()));
        }

        if config.name.is_empty() {
            return Err(AgentLoadError::ValidationError("Agent name is required".to_string()));
        }

        // Validate model config
        if config.model_config.context_window == 0 {
            return Err(AgentLoadError::ValidationError("Context window must be > 0".to_string()));
        }

        // Validate evaluation dimensions weights sum to ~1.0
        if let Some(dims) = &config.evaluation_dimensions {
            let total_weight: f32 = dims.values().map(|d| d.weight).sum();
            if (total_weight - 1.0).abs() > 0.01 {
                // Warning, not error - dimensions should sum to 1.0
                log::warn!(
                    "Agent {} evaluation dimensions weights sum to {}, expected 1.0",
                    config.id,
                    total_weight
                );
            }
        }

        Ok(())
    }

    /// Get the model configuration for a specific use case
    pub fn get_model_for_use_case(&self, agent_id: &str, use_case: &str) -> Option<&ModelProvider> {
        let config = self.agents.get(agent_id)?;
        let model_config = &config.model_config;

        // Check primary model first
        if let Some(primary) = &model_config.primary_model {
            if primary.use_cases.iter().any(|u| u == use_case) {
                return Some(primary);
            }
        }

        // Check cursor model
        if let Some(cursor) = &model_config.cursor_model {
            if cursor.use_cases.iter().any(|u| u == use_case) {
                return Some(cursor);
            }
        }

        // Check local model
        if let Some(local) = &model_config.local_model {
            if local.use_cases.iter().any(|u| u == use_case) {
                return Some(local);
            }
        }

        // Fallback
        model_config.fallback_model.as_ref()
    }

    /// Get the SCM coordination policy for an agent
    pub fn get_coordination_policy(&self, agent_id: &str) -> Option<&CoordinationPolicy> {
        self.agents.get(agent_id)?.scm_policy.as_ref()?.coordination.as_ref()
    }

    /// Get complement tags for an agent (used in arbitration)
    pub fn get_complement_tags(&self, agent_id: &str) -> Option<Vec<String>> {
        self.get_coordination_policy(agent_id)
            .map(|p| p.complement_tags.clone())
    }

    /// Get the turn-taking priority for an agent
    pub fn get_turn_priority(&self, agent_id: &str) -> f32 {
        self.agents.get(agent_id)
            .and_then(|c| c.scm_policy.as_ref())
            .and_then(|p| p.turn_taking.as_ref())
            .map(|t| t.priority)
            .unwrap_or(0.5)
    }
}

/// Capitalize the first letter of a string
fn capitalize(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_model_config() {
        let json = r#"{
            "modelTier": "hybrid",
            "primaryModel": {
                "provider": "openrouter",
                "model": "thudm/glm-4-9b-chat",
                "useCases": ["pattern_matching", "quick_classification"]
            },
            "contextWindow": 32768,
            "defaultTemperature": 0.2,
            "latencyBudgetMs": 15000
        }"#;

        let config: ModelConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.model_tier, "hybrid");
        assert_eq!(config.context_window, 32768);
        assert!(config.primary_model.is_some());
    }

    #[test]
    fn test_parse_scm_policy() {
        let json = r#"{
            "initiative": {
                "mode": "can_interject",
                "cooldownMs": 30000,
                "proactiveTriggers": ["architecture_change"],
                "max_messages_10min": 5
            },
            "turnTaking": {
                "priority": 0.75,
                "yieldTo": ["human", "coordinator"],
                "interruptThreshold": 0.85
            }
        }"#;

        let policy: SCMPolicy = serde_json::from_str(json).unwrap();
        assert!(policy.initiative.is_some());
        assert_eq!(policy.initiative.as_ref().unwrap().mode, "can_interject");
        assert_eq!(policy.turn_taking.as_ref().unwrap().priority, 0.75);
    }

    #[test]
    fn test_capitalize() {
        assert_eq!(capitalize("milton"), "Milton");
        assert_eq!(capitalize("ada"), "Ada");
        assert_eq!(capitalize(""), "");
    }
}

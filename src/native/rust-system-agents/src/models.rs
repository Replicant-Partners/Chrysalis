//! Data models for the system agents service
//!
//! This module defines the core data structures used by the system agents
//! service, including agent definitions, conversation history, and routing
//! information.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// System agent definition
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SystemAgent {
    pub id: String,
    pub name: String,
    pub role: String,
    pub description: String,
    #[serde(rename = "isActive")]
    pub is_active: bool,
    #[serde(rename = "supportedModels", skip_serializing_if = "Option::is_none")]
    pub supported_models: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capabilities: Option<Vec<String>>,
}

/// Conversation thread
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ConversationThread {
    pub id: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    pub messages: Vec<ConversationMessage>,
    #[serde(rename = "agentContext", skip_serializing_if = "Option::is_none")]
    pub agent_context: Option<AgentContext>,
}

/// Conversation message
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ConversationMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "agentId", skip_serializing_if = "Option::is_none")]
    pub agent_id: Option<String>,
    #[serde(rename = "toolCalls", skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<serde_json::Value>>,
    #[serde(rename = "toolCallId", skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

/// Agent context information
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AgentContext {
    #[serde(rename = "currentAgent")]
    pub current_agent: String,
    #[serde(rename = "routingHistory")]
    pub routing_history: Vec<RoutingEvent>,
    #[serde(rename = "conversationState")]
    pub conversation_state: HashMap<String, serde_json::Value>,
}

/// Routing event in the SCM pipeline
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RoutingEvent {
    #[serde(rename = "fromAgent")]
    pub from_agent: String,
    #[serde(rename = "toAgent")]
    pub to_agent: String,
    #[serde(rename = "reason")]
    pub reason: String,
    #[serde(rename = "timestamp")]
    pub timestamp: String,
}

/// Agent routing decision
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RoutingDecision {
    #[serde(rename = "targetAgent")]
    pub target_agent: String,
    #[serde(rename = "confidence")]
    pub confidence: f32,
    #[serde(rename = "reasoning")]
    pub reasoning: String,
    #[serde(rename = "suggestedAgents")]
    pub suggested_agents: Vec<SuggestedAgent>,
}

/// Suggested agent in routing
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SuggestedAgent {
    #[serde(rename = "agentId")]
    pub agent_id: String,
    #[serde(rename = "confidence")]
    pub confidence: f32,
    #[serde(rename = "reasoning")]
    pub reasoning: String,
}

/// Agent response
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AgentResponse {
    #[serde(rename = "agentId")]
    pub agent_id: String,
    #[serde(rename = "response")]
    pub response: String,
    #[serde(rename = "confidence")]
    pub confidence: Option<f32>,
    #[serde(rename = "toolCalls", skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<serde_json::Value>>,
    #[serde(rename = "metadata", skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Conversation history entry
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ConversationHistoryEntry {
    #[serde(rename = "threadId")]
    pub thread_id: String,
    #[serde(rename = "message")]
    pub message: String,
    #[serde(rename = "agentId")]
    pub agent_id: String,
    #[serde(rename = "timestamp")]
    pub timestamp: String,
    #[serde(rename = "responseTimeMs")]
    pub response_time_ms: u64,
}

/// SCM Gate result
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SCMGateResult {
    #[serde(rename = "shouldSpeak")]
    pub should_speak: bool,
    #[serde(rename = "confidence")]
    pub confidence: f32,
    #[serde(rename = "intentType", skip_serializing_if = "Option::is_none")]
    pub intent_type: Option<String>,
    #[serde(rename = "priority", skip_serializing_if = "Option::is_none")]
    pub priority: Option<f32>,
    #[serde(rename = "targetTurnId", skip_serializing_if = "Option::is_none")]
    pub target_turn_id: Option<String>,
    #[serde(rename = "reasons")]
    pub reasons: Vec<String>,
}

/// Arbiter candidate for agent selection
#[derive(Debug, Clone)]
pub struct ArbiterCandidate {
    pub agent_id: String,
    pub gate: SCMGateResult,
    pub complement_tags: Option<Vec<String>>,
}

/// Candidate ranking result
#[derive(Debug, Clone)]
pub struct CandidateRanking {
    pub agent_id: String,
    pub score: f32,
    pub gate_output: SCMGateResult,
    pub diversity_bonus: f32,
}

/// Arbiter metrics
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ArbiterMetrics {
    #[serde(rename = "totalArbitrations")]
    pub total_arbitrations: u64,
    #[serde(rename = "agentsSelected")]
    pub agents_selected: HashMap<String, u64>,
    #[serde(rename = "pileOnPrevented")]
    pub pile_on_prevented: u64,
    #[serde(rename = "diversityBonusApplied")]
    pub diversity_bonus_applied: u64,
    #[serde(rename = "budgetEnforcements")]
    pub budget_enforcements: u64,
    #[serde(rename = "lastArbitrationMs")]
    pub last_arbitration_ms: u64,
}
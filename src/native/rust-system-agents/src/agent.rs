//! System agent operations and management
//!
//! This module provides functionality for managing system agents,
//! including routing logic, conversation history, and agent coordination.

// Allow dead_code for fields that are stored but not yet consumed
#![allow(dead_code)]

use crate::models::{ConversationHistoryEntry, ConversationMessage, ConversationThread, RoutingDecision, SystemAgent, SCMGateResult, ArbiterCandidate, CandidateRanking, ArbiterMetrics};
use crate::gateway::GatewayClient;
use chrono::Utc;
use std::collections::{HashMap, HashSet};
use uuid::Uuid;
use std::time::Instant;

/// Agent manager for handling system agent operations
#[derive(Debug)]
pub struct AgentManager {
    agents: HashMap<String, SystemAgent>,
    conversation_history: HashMap<String, Vec<ConversationHistoryEntry>>,
    turn_history: HashMap<String, Vec<u64>>, // agent_id -> timestamps
    metrics: ArbiterMetrics,
    round_robin_index: usize,
}

impl AgentManager {
    /// Create a new agent manager with default system agents
    pub fn new() -> Self {
        let mut agents = HashMap::new();
        
        // Define default system agents
        let default_agents = vec![
            SystemAgent {
                id: "ada".to_string(),
                name: "Ada".to_string(),
                role: "Architecture Agent".to_string(),
                description: "System architect and design pattern expert".to_string(),
                is_active: true,
                supported_models: Some(vec!["gpt-4".to_string(), "claude-3".to_string()]),
                capabilities: Some(vec!["system-design".to_string(), "pattern-analysis".to_string()]),
            },
            SystemAgent {
                id: "lea".to_string(),
                name: "Lea".to_string(),
                role: "Learning Agent".to_string(),
                description: "Continuous learning and adaptation expert".to_string(),
                is_active: true,
                supported_models: Some(vec!["gpt-4".to_string(), "claude-3".to_string()]),
                capabilities: Some(vec!["learning".to_string(), "adaptation".to_string()]),
            },
            SystemAgent {
                id: "phil".to_string(),
                name: "Phil".to_string(),
                role: "Philosophy Agent".to_string(),
                description: "Reasoning and epistemology expert".to_string(),
                is_active: true,
                supported_models: Some(vec!["gpt-4".to_string(), "claude-3".to_string()]),
                capabilities: Some(vec!["reasoning".to_string(), "epistemology".to_string()]),
            },
            SystemAgent {
                id: "david".to_string(),
                name: "David".to_string(),
                role: "Devil's Advocate Agent".to_string(),
                description: "Critical thinking and bias detection expert".to_string(),
                is_active: true,
                supported_models: Some(vec!["gpt-4".to_string(), "claude-3".to_string()]),
                capabilities: Some(vec!["critical-thinking".to_string(), "bias-detection".to_string()]),
            },
        ];
        
        for agent in default_agents {
            agents.insert(agent.id.clone(), agent);
        }
        
        Self {
            agents,
            conversation_history: HashMap::new(),
            turn_history: HashMap::new(),
            metrics: ArbiterMetrics {
                total_arbitrations: 0,
                agents_selected: HashMap::new(),
                pile_on_prevented: 0,
                diversity_bonus_applied: 0,
                budget_enforcements: 0,
                last_arbitration_ms: 0,
            },
            round_robin_index: 0,
        }
    }
    
    /// Get a list of all system agents
    pub fn list_agents(&self) -> Vec<&SystemAgent> {
        self.agents.values().collect()
    }
    
    /// Get a specific agent by ID
    pub fn get_agent(&self, agent_id: &str) -> Option<&SystemAgent> {
        self.agents.get(agent_id)
    }
    
    /// Create a new conversation thread
    pub fn create_conversation_thread(&self) -> ConversationThread {
        let thread_id = Uuid::new_v4().to_string();
        let timestamp = Utc::now().to_rfc3339();
        
        ConversationThread {
            id: thread_id,
            created_at: timestamp.clone(),
            updated_at: timestamp,
            messages: vec![],
            agent_context: None,
        }
    }
    
    /// Add a message to a conversation thread
    pub fn add_message_to_thread(
        &mut self,
        thread: &mut ConversationThread,
        role: &str,
        content: &str,
        agent_id: Option<String>,
    ) -> Result<(), String> {
        let message_id = Uuid::new_v4().to_string();
        let timestamp = Utc::now().to_rfc3339();
        
        let message = ConversationMessage {
            id: message_id,
            role: role.to_string(),
            content: content.to_string(),
            created_at: timestamp.clone(),
            agent_id,
            tool_calls: None,
            tool_call_id: None,
        };
        
        thread.messages.push(message);
        thread.updated_at = timestamp;
        
        Ok(())
    }
    
    /// Calculate diversity bonus based on complement tags
    fn calculate_diversity_bonus(
        &self,
        candidate: &ArbiterCandidate,
        selected_tags: &HashSet<String>,
        diversity_weight: f32,
    ) -> f32 {
        // Use if-let to safely handle Option without unwrap()
        let tags = match &candidate.complement_tags {
            Some(tags) if !tags.is_empty() => tags,
            _ => return 0.0,
        };
        
        let new_tags: Vec<&String> = tags.iter().filter(|t| !selected_tags.contains(*t)).collect();
        (new_tags.len() as f32 / tags.len() as f32) * diversity_weight
    }
    
    /// Rank candidates by score (priority * confidence) with optional diversity bonus
    fn rank_candidates(&mut self, candidates: Vec<ArbiterCandidate>, strategy: &str, diversity_weight: f32) -> Vec<CandidateRanking> {
        // Filter to only candidates who should speak
        let eligible: Vec<&ArbiterCandidate> = candidates.iter().filter(|c| c.gate.should_speak).collect();
        
        if eligible.is_empty() {
            return vec![];
        }
        
        // Calculate initial scores
        let mut rankings: Vec<CandidateRanking> = eligible.iter().map(|candidate| {
            let score = candidate.gate.priority.unwrap_or(0.5) * candidate.gate.confidence;
            CandidateRanking {
                agent_id: candidate.agent_id.clone(),
                score,
                gate_output: candidate.gate.clone(),
                diversity_bonus: 0.0,
            }
        }).collect();
        
        // Apply diversity bonus for priority_then_diversity strategy
        if strategy == "priority_then_diversity" {
            let mut selected_tags = HashSet::new();
            
            // Sort by initial score (handle NaN gracefully)
            rankings.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
            
            // Apply diversity bonus iteratively
            for ranking in &mut rankings {
                if let Some(candidate) = candidates.iter().find(|c| c.agent_id == ranking.agent_id) {
                    ranking.diversity_bonus = self.calculate_diversity_bonus(candidate, &selected_tags, diversity_weight);
                    ranking.score += ranking.diversity_bonus;
                    
                    if ranking.diversity_bonus > 0.0 {
                        self.metrics.diversity_bonus_applied += 1;
                    }
                    
                    // Add this candidate's tags to selected set
                    if let Some(tags) = &candidate.complement_tags {
                        for tag in tags {
                            selected_tags.insert(tag.clone());
                        }
                    }
                }
            }
        }
        
        // Final sort by score (handle NaN gracefully)
        rankings.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        
        // Round-robin override
        if strategy == "round_robin" && !rankings.is_empty() {
            let len = rankings.len();
            let rotated = rankings[self.round_robin_index % len..].to_vec();
            // In a real implementation, we would update round_robin_index here
            return rotated;
        }
        
        rankings
    }
    
    /// Select winners from ranked candidates
    fn select_winners(&mut self, candidates: Vec<ArbiterCandidate>, max_agents_per_turn: usize, global_turn_budget: usize) -> (Vec<CandidateRanking>, Vec<CandidateRanking>, bool, String) {
        self.metrics.total_arbitrations += 1;
        
        let ranked = self.rank_candidates(candidates, "priority_then_diversity", 0.15);
        
        if ranked.is_empty() {
            return (vec![], vec![], false, "no_eligible_candidates".to_string());
        }
        
        // Check global turn budget
        let recent_turns = self.get_recent_turns(60000); // Last minute
        if recent_turns >= global_turn_budget {
            self.metrics.budget_enforcements += 1;
            return (vec![], ranked, true, "global_turn_budget_exceeded".to_string());
        }
        
        // Select up to max_agents_per_turn winners
        let winners_count = std::cmp::min(max_agents_per_turn, ranked.len());
        let winners = ranked[..winners_count].to_vec();
        let losers = if winners_count < ranked.len() {
            ranked[winners_count..].to_vec()
        } else {
            vec![]
        };
        
        // Track pile-on prevention
        let pile_on_prevented = !losers.is_empty();
        if pile_on_prevented {
            self.metrics.pile_on_prevented += 1;
        }
        
        // Update selection metrics
        for winner in &winners {
            let count = self.metrics.agents_selected.entry(winner.agent_id.clone()).or_insert(0);
            *count += 1;
        }
        
        let arbitration_reason = if pile_on_prevented {
            format!("selected_top_{}_of_{}", winners_count, ranked.len())
        } else {
            "all_eligible_selected".to_string()
        };
        
        (winners, losers, pile_on_prevented, arbitration_reason)
    }
    
    /// Get number of turns in the time window
    fn get_recent_turns(&self, window_ms: u64) -> usize {
        let cutoff = chrono::Utc::now().timestamp_millis() as u64 - window_ms;
        self.turn_history.values().map(|timestamps| {
            timestamps.iter().filter(|&&t| t > cutoff).count()
        }).sum()
    }
    
    /// Evaluate gate result for an agent (simplified implementation)
    fn evaluate_gate(&self, agent_id: &str, message: &str, current_agent: Option<&str>) -> SCMGateResult {
        let mut should_speak = false;
        let mut confidence = 0.5;
        let mut priority = 0.5;
        let mut reasons = Vec::new();
        
        // Check if addressed to this agent via targetAgent parameter
        if let Some(target) = current_agent {
            if target == agent_id {
                should_speak = true;
                confidence = 0.8;
                priority = 0.7;
                reasons.push("addressed_to_me".to_string());
            }
        }
        
        let lower_message = message.to_lowercase();
        
        // Check if agent's name is mentioned in the message
        let agent_name = agent_id;
        
        if lower_message.contains(agent_name) {
            should_speak = true;
            confidence = 0.85;
            priority = 0.9;
            reasons.push("name_mentioned_in_message".to_string());
        }
        
        // Check for keywords in message
        match agent_id {
            "ada" if lower_message.contains("design") || lower_message.contains("architecture") || lower_message.contains("pattern") => {
                should_speak = true;
                confidence = 0.7;
                priority = 0.8;
                reasons.push("design_keywords_detected".to_string());
            },
            "lea" if lower_message.contains("learn") || lower_message.contains("adapt") || lower_message.contains("improve") => {
                should_speak = true;
                confidence = 0.7;
                priority = 0.6;
                reasons.push("learning_keywords_detected".to_string());
            },
            "phil" if lower_message.contains("reason") || lower_message.contains("think") || lower_message.contains("logic") => {
                should_speak = true;
                confidence = 0.7;
                priority = 0.6;
                reasons.push("reasoning_keywords_detected".to_string());
            },
            "david" if lower_message.contains("critic") || lower_message.contains("bias") || lower_message.contains("review") => {
                should_speak = true;
                confidence = 0.7;
                priority = 0.6;
                reasons.push("critical_thinking_keywords_detected".to_string());
            },
            "milton" if lower_message.contains("ops") || lower_message.contains("telemetry") || lower_message.contains("maintenance") => {
                should_speak = true;
                confidence = 0.7;
                priority = 0.6;
                reasons.push("ops_keywords_detected".to_string());
            },
            _ => {}
        }
        
        // Check cooldown
        if let Some(timestamps) = self.turn_history.get(agent_id) {
            if let Some(&last_spoke) = timestamps.last() {
                let elapsed = chrono::Utc::now().timestamp_millis() as u64 - last_spoke;
                if elapsed < 5000 { // 5 second cooldown
                    should_speak = false;
                    confidence = 0.1;
                    reasons.push("cooldown_active".to_string());
                }
            }
        }
        
        SCMGateResult {
            should_speak,
            confidence,
            intent_type: None,
            priority: Some(priority),
            target_turn_id: None,
            reasons,
        }
    }
    
    /// Record that an agent responded
    fn record_turn(&mut self, agent_id: &str) {
        let timestamp = chrono::Utc::now().timestamp_millis() as u64;
        self.turn_history.entry(agent_id.to_string()).or_default().push(timestamp);
        
        // Keep only last 100 turns to prevent memory growth
        if let Some(history) = self.turn_history.get_mut(agent_id) {
            if history.len() > 100 {
                history.drain(0..history.len()-100);
            }
        }
    }
    
    /// Route a message through the SCM pipeline with sophisticated agent arbitration
    pub async fn route_message_with_arbitration(
        &mut self,
        message: &str,
        current_agent: Option<&str>,
        gateway_client: &GatewayClient,
    ) -> Result<Vec<serde_json::Value>, String> {
        let start_time = Instant::now();
        
        // Build candidates for arbitration
        let mut candidates = Vec::new();
        
        // For each agent, evaluate gate result
        for agent_id in self.agents.keys() {
            let gate_result = self.evaluate_gate(agent_id, message, current_agent);
            
            // Get complement tags from coordination policy (simplified)
            let complement_tags = match agent_id.as_str() {
                "ada" => Some(vec!["system-design".to_string(), "pattern-analysis".to_string()]),
                "lea" => Some(vec!["learning".to_string(), "adaptation".to_string()]),
                "phil" => Some(vec!["reasoning".to_string(), "epistemology".to_string()]),
                "david" => Some(vec!["critical-thinking".to_string(), "bias-detection".to_string()]),
                _ => None,
            };
            
            candidates.push(ArbiterCandidate {
                agent_id: agent_id.clone(),
                gate: gate_result,
                complement_tags,
            });
        }
        
        // Apply arbitration
        let (winners, _losers, _pile_on_prevented, _arbitration_reason) = 
            self.select_winners(candidates, 2, 5); // max 2 agents per turn, 5 global budget
        
        // Generate responses from winning agents
        let mut responses = Vec::new();
        
        for winner in &winners {
            // Record the turn
            self.record_turn(&winner.agent_id);
            
            // Get agent details
            if let Some(agent) = self.agents.get(&winner.agent_id) {
                // Build prompt for the agent
                let prompt = format!("You are {}, {}. {}.\n\nUser message: {}", 
                    agent.name, agent.role, agent.description, message);
                
                // Try to get response from gateway, fallback to error message if unavailable
                let (response_text, is_fallback, error_message) = match self.get_agent_response_from_gateway(gateway_client, agent, &prompt).await {
                    Ok(response) => (response, false, None),
                    Err(e) => {
                        // Log the error for debugging
                        log::warn!(
                            "Gateway call failed for agent '{}': {}. Using fallback response.",
                            agent.id, e
                        );
                        (
                            format!("[Gateway unavailable] {} ({}) cannot respond at this time. Error: {}", 
                                agent.name, agent.role, e),
                            true,
                            Some(e)
                        )
                    }
                };
                
                let mut response_json = serde_json::json!({
                    "agent_id": winner.agent_id,
                    "response": response_text,
                    "confidence": winner.score,
                    "latency_ms": start_time.elapsed().as_millis() as u64,
                });
                
                // Add error metadata if fallback was used
                if is_fallback {
                    if let Some(obj) = response_json.as_object_mut() {
                        obj.insert("fallback".to_string(), serde_json::json!(true));
                        if let Some(err) = error_message {
                            obj.insert("error".to_string(), serde_json::json!(err));
                        }
                    }
                }
                
                responses.push(response_json);
            }
        }
        
        self.metrics.last_arbitration_ms = start_time.elapsed().as_millis() as u64;
        
        Ok(responses)
    }
    
    /// Get agent response from the gateway
    async fn get_agent_response_from_gateway(
        &self,
        gateway_client: &GatewayClient,
        agent: &SystemAgent,
        prompt: &str,
    ) -> Result<String, String> {
        // Build chat completion request
        let request = crate::gateway::ChatCompletionRequest {
            agent_id: Some(agent.id.clone()),
            model: "gpt-4".to_string(), // Default model - gateway will route based on agent config
            messages: vec![crate::gateway::ChatMessage {
                role: "user".to_string(),
                content: prompt.to_string(),
                name: None,
                tool_call_id: None,
                tool_calls: None,
            }],
            temperature: Some(0.7),
            max_tokens: Some(500),
            stream: None,
            stop: None,
            tool_choice: None,
            tools: None,
        };
        
        // Send request to gateway
        match gateway_client.chat_completion(&request).await {
            Ok(response) => {
                // Go gateway returns content directly
                Ok(response.content)
            }
            Err(e) => {
                Err(format!("Gateway error: {:?}", e))
            }
        }
    }
    
    /// Route a message through the SCM pipeline (simplified version for API compatibility)
    pub fn route_message(
        &self,
        message: &str,
        _current_agent: Option<&str>,
    ) -> Result<RoutingDecision, String> {
        // Simple routing logic based on message content
        // In a real implementation, this would be more sophisticated
        let target_agent = if message.contains("design") || message.contains("architecture") {
            "ada"
        } else if message.contains("learn") || message.contains("adapt") {
            "lea"
        } else if message.contains("reason") || message.contains("think") {
            "phil"
        } else if message.contains("critic") || message.contains("bias") {
            "david"
        } else {
            // Default to Ada for general questions
            "ada"
        };
        
        let confidence = 0.8;
        let reasoning = format!("Routed to {} based on keyword matching", target_agent);
        
        let suggested_agents = self.agents
            .keys()
            .filter(|&id| id != target_agent)
            .take(2)
            .map(|id| crate::models::SuggestedAgent {
                agent_id: id.clone(),
                confidence: 0.3,
                reasoning: "Alternative agent option".to_string(),
            })
            .collect();
        
        Ok(RoutingDecision {
            target_agent: target_agent.to_string(),
            confidence,
            reasoning,
            suggested_agents,
        })
    }
    
    /// Record a conversation history entry
    pub fn record_conversation_history(
        &mut self,
        thread_id: &str,
        message: &str,
        agent_id: &str,
        response_time_ms: u64,
    ) {
        let timestamp = Utc::now().to_rfc3339();
        
        let entry = ConversationHistoryEntry {
            thread_id: thread_id.to_string(),
            message: message.to_string(),
            agent_id: agent_id.to_string(),
            timestamp,
            response_time_ms,
        };
        
        self.conversation_history
            .entry(thread_id.to_string())
            .or_default()
            .push(entry);
    }
    
    /// Get conversation history for a thread
    pub fn get_conversation_history(&self, thread_id: &str) -> Option<&Vec<ConversationHistoryEntry>> {
        self.conversation_history.get(thread_id)
    }
    
    /// Get arbiter metrics
    pub fn get_metrics(&self) -> &ArbiterMetrics {
        &self.metrics
    }
}

impl Default for AgentManager {
    fn default() -> Self {
        Self::new()
    }
}
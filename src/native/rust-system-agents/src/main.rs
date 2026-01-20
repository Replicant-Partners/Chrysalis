//! Chrysalis System Agents Service
//!
//! A high-performance Rust implementation of the system agents service
//! that replaces the TypeScript implementation while maintaining full
//! API compatibility with existing clients.
//!
//! This service provides:
//! - System agent management (Ada, Lea, Phil, David, Milton)
//! - SCM (Structured Conversation Management) pipeline with arbitration
//! - Canvas-chat bridging for UI integration
//! - Memory adapter for agent memory persistence
//! - Cursor IDE adapter for LLM resource access
//! - Agent configuration loading from JSON

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::{net::SocketAddr, sync::Arc};
use tokio::net::TcpListener;

// Core modules
mod agent;
mod gateway;
mod metrics;
mod models;

// Ported from TypeScript
pub mod config;           // SystemAgentLoader - agent configuration loading
pub mod memory_adapter;   // AgentMemoryAdapter - memory system interface
pub mod canvas_bridge;    // CanvasChatBridge - canvas/chat UI bridge
pub mod cursor_adapter;   // CursorAdapter - Cursor IDE integration
pub mod quality;          // Quality evaluation and code review tools

use crate::{gateway::GatewayClient, metrics::Metrics};

// Re-export commonly used types
pub use config::{SystemAgentConfig, SystemAgentLoader, ModelConfig, SCMPolicy};
pub use memory_adapter::{AgentMemoryAdapter, MemoryEntry, MemoryType, create_memory_adapter};
pub use canvas_bridge::{CanvasChatBridge, CanvasType, BridgeMessage};
pub use cursor_adapter::{CursorAdapter, CursorRequest, CursorResponse};
pub use quality::{EvaluationEngine, EvaluationResult, Scorecard, CodeReviewer, CodeReviewResult};

/// Application state shared across handlers
#[derive(Clone)]
struct AppState {
    gateway_client: GatewayClient,
    metrics: Arc<Metrics>,
}

/// Health check response
#[derive(Serialize)]
struct HealthResponse {
    status: String,
    initialized: bool,
    agents: Vec<&'static str>,
    metrics: serde_json::Value,
    timestamp: String,
}

/// Chat request body
#[derive(Deserialize)]
struct ChatRequest {
    message: String,
    #[serde(rename = "threadId")]
    thread_id: Option<String>,
    #[serde(rename = "targetAgent")]
    target_agent: Option<String>,
    metadata: Option<serde_json::Value>,
}

/// Chat response data
#[derive(Serialize)]
struct ChatResponseData {
    #[serde(rename = "threadId")]
    thread_id: String,
    responses: Vec<serde_json::Value>,
    #[serde(rename = "totalLatencyMs")]
    total_latency_ms: u64,
    #[serde(rename = "respondingAgents")]
    responding_agents: Vec<String>,
}

/// API response wrapper
#[derive(Serialize)]
struct ApiResponse<T> {
    success: bool,
    data: Option<T>,
    error: Option<String>,
    meta: serde_json::Value,
}

impl<T> ApiResponse<T> {
    fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
            meta: serde_json::json!({
                "timestamp": chrono::Utc::now().to_rfc3339(),
                "version": "v1"
            }),
        }
    }

    fn error(message: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(message),
            meta: serde_json::json!({
                "timestamp": chrono::Utc::now().to_rfc3339(),
                "version": "v1"
            }),
        }
    }
}

/// Main application error type
#[derive(thiserror::Error, Debug)]
enum AppError {
    #[error("Gateway error: {0}")]
    GatewayError(String),
    #[error("Invalid request: {0}")]
    InvalidRequest(String),
    #[error("Internal server error: {0}")]
    InternalError(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            AppError::InvalidRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::GatewayError(msg) => (StatusCode::BAD_GATEWAY, msg),
            AppError::InternalError(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg),
        };

        let body = Json(ApiResponse::<()>::error(error_message));
        (status, body).into_response()
    }
}

/// Health check endpoint
async fn health_check(State(state): State<AppState>) -> Result<Json<ApiResponse<HealthResponse>>, AppError> {
    // Create agent manager to get metrics
    let agent_manager = crate::agent::AgentManager::new();
    let arbiter_metrics = agent_manager.get_metrics();

    let response = HealthResponse {
        status: "healthy".to_string(),
        initialized: true,
        agents: vec!["ada", "lea", "phil", "david"],
        metrics: serde_json::json!({
            "totalRoutes": arbiter_metrics.total_arbitrations,
            "averageLatencyMs": arbiter_metrics.last_arbitration_ms,
            "pileOnPrevented": arbiter_metrics.pile_on_prevented,
            "diversityBonusApplied": arbiter_metrics.diversity_bonus_applied,
        }),
        timestamp: chrono::Utc::now().to_rfc3339(),
    };

    Ok(Json(ApiResponse::success(response)))
}

/// Chat endpoint
async fn chat(
    State(state): State<AppState>,
    Json(request): Json<ChatRequest>,
) -> Result<Json<ApiResponse<ChatResponseData>>, AppError> {
    if request.message.is_empty() {
        return Err(AppError::InvalidRequest("message field is required and must be a string".to_string()));
    }

    // Build chat message (simplified for this example)
    let thread_id = request.thread_id.unwrap_or_else(|| "default".to_string());

    // Create agent manager for routing
    let mut agent_manager = crate::agent::AgentManager::new();

    // Route through SCM pipeline with arbitration
    let start_time = std::time::Instant::now();
    let responses = agent_manager
        .route_message_with_arbitration(&request.message, request.target_agent.as_deref(), &state.gateway_client)
        .await
        .map_err(|e| AppError::InternalError(format!("Routing failed: {}", e)))?;

    let responding_agents: Vec<String> = responses
        .iter()
        .filter_map(|r| r.get("agent_id").and_then(|v| v.as_str().map(|s| s.to_string())))
        .collect();

    let response_data = ChatResponseData {
        thread_id,
        responses,
        total_latency_ms: start_time.elapsed().as_millis() as u64,
        responding_agents,
    };

    Ok(Json(ApiResponse::success(response_data)))
}

/// List agents endpoint
async fn list_agents(State(_state): State<AppState>) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let agents = serde_json::json!({
        "agents": [
            {
                "id": "ada",
                "name": "Ada",
                "role": "Architecture Agent",
                "description": "System architect and design pattern expert",
                "isActive": true,
            },
            {
                "id": "lea",
                "name": "Lea",
                "role": "Learning Agent",
                "description": "Continuous learning and adaptation expert",
                "isActive": true,
            },
            {
                "id": "phil",
                "name": "Phil",
                "role": "Philosophy Agent",
                "description": "Reasoning and epistemology expert",
                "isActive": true,
            },
            {
                "id": "david",
                "name": "David",
                "role": "Devil's Advocate Agent",
                "description": "Critical thinking and bias detection expert",
                "isActive": true,
            }
        ],
        "count": 4,
    });

    Ok(Json(ApiResponse::success(agents)))
}

/// Agent detail endpoint
async fn agent_detail(
    State(_state): State<AppState>,
    Path(agent_id): Path<String>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let valid_agents = ["ada", "lea", "phil", "david"];
    if !valid_agents.contains(&agent_id.as_str()) {
        return Err(AppError::InvalidRequest(format!("Agent '{}' not found", agent_id)));
    }

    let agent = serde_json::json!({
        "id": agent_id,
        "name": match agent_id.as_str() {
            "ada" => "Ada",
            "lea" => "Lea",
            "phil" => "Phil",
            "david" => "David",
            _ => &agent_id,
        },
        "role": match agent_id.as_str() {
            "ada" => "Architecture Agent",
            "lea" => "Learning Agent",
            "phil" => "Philosophy Agent",
            "david" => "Devil's Advocate Agent",
            _ => "System Agent",
        },
        "description": match agent_id.as_str() {
            "ada" => "System architect and design pattern expert",
            "lea" => "Continuous learning and adaptation expert",
            "phil" => "Reasoning and epistemology expert",
            "david" => "Critical thinking and bias detection expert",
            _ => "System agent",
        },
    });

    Ok(Json(ApiResponse::success(agent)))
}

/// Metrics endpoint
async fn get_metrics(
    State(_state): State<AppState>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    // Create agent manager to get metrics
    let agent_manager = crate::agent::AgentManager::new();
    let arbiter_metrics = agent_manager.get_metrics();

    let metrics = serde_json::json!({
        "scm": {
            "totalArbitrations": arbiter_metrics.total_arbitrations,
            "agentsSelected": arbiter_metrics.agents_selected,
            "pileOnPrevented": arbiter_metrics.pile_on_prevented,
            "diversityBonusApplied": arbiter_metrics.diversity_bonus_applied,
            "budgetEnforcements": arbiter_metrics.budget_enforcements,
            "lastArbitrationMs": arbiter_metrics.last_arbitration_ms,
        },
        "timestamp": chrono::Utc::now().to_rfc3339(),
    });

    Ok(Json(ApiResponse::success(metrics)))
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    // Parse environment variables
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "3200".to_string()).parse()?;
    let host = std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let gateway_url = std::env::var("GATEWAY_BASE_URL").unwrap_or_else(|_| "http://localhost:8080".to_string());
    let gateway_token = std::env::var("GATEWAY_AUTH_TOKEN").ok();

    // Initialize components
    let gateway_client = GatewayClient::new(&gateway_url, gateway_token);
    let metrics = Arc::new(Metrics::new());

    // Create app state
    let state = AppState {
        gateway_client,
        metrics,
    };

    // Build router
    let app = Router::new()
        .route("/api/v1/system-agents/health", get(health_check))
        .route("/api/v1/system-agents/chat", post(chat))
        .route("/api/v1/system-agents/agents", get(list_agents))
        .route("/api/v1/system-agents/agents/:agent_id", get(agent_detail))
        .route("/api/v1/system-agents/metrics", get(get_metrics))
        .with_state(state);

    // Run server
    let addr: SocketAddr = format!("{}:{}", host, port).parse()?;
    println!("Starting System Agent API server on {}", addr);
    println!("Endpoints:");
    println!("  POST /api/v1/system-agents/chat - Send message to agents");
    println!("  GET  /api/v1/system-agents/agents - List agents");
    println!("  GET  /api/v1/system-agents/agents/:id - Agent details");
    println!("  GET  /api/v1/system-agents/metrics - System metrics");

    let listener = TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
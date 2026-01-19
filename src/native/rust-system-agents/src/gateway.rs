//! Gateway client for communicating with the Go LLM Gateway
//!
//! This module provides a Rust client implementation that maintains full
//! API compatibility with the existing Go LLM Gateway, allowing for seamless
//! replacement of the TypeScript system agents service.

use reqwest::{Client, ClientBuilder};
use serde::{Deserialize, Serialize};
use std::time::Duration;

/// Configuration for the gateway client
#[derive(Debug, Clone)]
pub struct GatewayConfig {
    pub base_url: String,
    pub auth_token: Option<String>,
    pub timeout: Duration,
}

impl Default for GatewayConfig {
    fn default() -> Self {
        Self {
            base_url: "http://localhost:8080".to_string(),
            auth_token: None,
            timeout: Duration::from_secs(30),
        }
    }
}

/// Gateway client for communicating with the LLM Gateway
#[derive(Debug, Clone)]
pub struct GatewayClient {
    client: Client,
    config: GatewayConfig,
}

impl GatewayClient {
    /// Create a new gateway client with the specified configuration
    pub fn new(base_url: &str, auth_token: Option<String>) -> Self {
        let config = GatewayConfig {
            base_url: base_url.to_string(),
            auth_token,
            timeout: Duration::from_secs(30),
        };

        let mut client_builder = ClientBuilder::new()
            .timeout(config.timeout)
            .user_agent("chrysalis-system-agents/0.1.0");

        // Add default headers
        if let Some(token) = &config.auth_token {
            client_builder = client_builder.default_headers({
                let mut headers = reqwest::header::HeaderMap::new();
                headers.insert(
                    reqwest::header::AUTHORIZATION,
                    format!("Bearer {}", token)
                        .parse()
                        .expect("Valid authorization header"),
                );
                headers
            });
        }

        let client = client_builder
            .build()
            .expect("Failed to build HTTP client");

        Self { client, config }
    }

    /// Get the base URL for the gateway
    pub fn base_url(&self) -> &str {
        &self.config.base_url
    }

    /// Send a chat completion request to the gateway
    pub async fn chat_completion(
        &self,
        request: &ChatCompletionRequest,
    ) -> Result<ChatCompletionResponse, GatewayError> {
        let url = format!("{}/api/v1/chat/completions", self.config.base_url);
        
        let response = self
            .client
            .post(&url)
            .json(request)
            .send()
            .await
            .map_err(|e| GatewayError::NetworkError(e.to_string()))?;

        if response.status().is_success() {
            let chat_response = response
                .json::<ChatCompletionResponse>()
                .await
                .map_err(|e| GatewayError::ParseError(e.to_string()))?;
            Ok(chat_response)
        } else {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            Err(GatewayError::ApiError(status, error_text))
        }
    }
}

/// Error types for gateway operations
#[derive(thiserror::Error, Debug)]
pub enum GatewayError {
    #[error("Network error: {0}")]
    NetworkError(String),
    #[error("Parse error: {0}")]
    ParseError(String),
    #[error("API error ({0}): {1}")]
    ApiError(reqwest::StatusCode, String),
}

/// Chat completion request payload
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ChatCompletionRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop: Option<Vec<String>>,
    #[serde(rename = "toolChoice", skip_serializing_if = "Option::is_none")]
    pub tool_choice: Option<ToolChoice>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<Tool>>,
}

/// Chat message structure
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(rename = "toolCallId", skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    #[serde(rename = "toolCalls", skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
}

/// Tool choice specification
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "lowercase")]
pub enum ToolChoice {
    None,
    Auto,
    Required,
    Tool { r#type: String, name: String },
}

/// Tool definition
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Tool {
    pub r#type: String,
    pub function: ToolFunction,
}

/// Tool function definition
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ToolFunction {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
}

/// Tool call structure
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ToolCall {
    pub id: String,
    pub r#type: String,
    pub function: ToolFunctionCall,
}

/// Tool function call structure
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ToolFunctionCall {
    pub name: String,
    pub arguments: String,
}

/// Chat completion response
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ChatCompletionResponse {
    pub id: String,
    pub r#type: String,
    pub created: u64,
    pub model: String,
    pub choices: Vec<ChatChoice>,
    pub usage: Option<UsageInfo>,
}

/// Chat choice structure
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ChatChoice {
    pub index: u32,
    pub message: Option<ChatMessage>,
    pub delta: Option<ChatMessage>,
    #[serde(rename = "finishReason")]
    pub finish_reason: Option<String>,
}

/// Usage information
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UsageInfo {
    #[serde(rename = "promptTokens")]
    pub prompt_tokens: u32,
    #[serde(rename = "completionTokens")]
    pub completion_tokens: u32,
    #[serde(rename = "totalTokens")]
    pub total_tokens: u32,
}
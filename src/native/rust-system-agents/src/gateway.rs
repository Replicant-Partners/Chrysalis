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

    /// Send a chat completion request to the gateway with retry logic
    pub async fn chat_completion(
        &self,
        request: &ChatCompletionRequest,
    ) -> Result<ChatCompletionResponse, GatewayError> {
        self.chat_completion_with_retries(request, 3).await
    }

    /// Send a chat completion request with configurable retry attempts
    pub async fn chat_completion_with_retries(
        &self,
        request: &ChatCompletionRequest,
        max_retries: u32,
    ) -> Result<ChatCompletionResponse, GatewayError> {
        let url = format!("{}/v1/chat", self.config.base_url);
        let mut last_error = None;

        for attempt in 0..=max_retries {
            if attempt > 0 {
                // Exponential backoff: 100ms, 200ms, 400ms, etc.
                let backoff = Duration::from_millis(100 * 2_u64.pow(attempt - 1));
                tokio::time::sleep(backoff).await;
                eprintln!("Retry attempt {}/{} after {:?}", attempt, max_retries, backoff);
            }

            match self.execute_request(&url, request).await {
                Ok(response) => return Ok(response),
                Err(e) => {
                    // Don't retry on certain errors
                    match &e {
                        GatewayError::ApiError(status, _) if status.as_u16() == 401 || status.as_u16() == 403 => {
                            // Authentication errors - don't retry
                            return Err(e);
                        }
                        GatewayError::ParseError(_) | GatewayError::ConfigError(_) => {
                            // Client errors - don't retry
                            return Err(e);
                        }
                        _ => {
                            last_error = Some(e);
                        }
                    }
                }
            }
        }

        Err(last_error.unwrap_or_else(|| {
            GatewayError::NetworkError("All retry attempts exhausted".to_string())
        }))
    }

    /// Execute a single request attempt
    async fn execute_request(
        &self,
        url: &str,
        request: &ChatCompletionRequest,
    ) -> Result<ChatCompletionResponse, GatewayError> {
        let response = self
            .client
            .post(url)
            .json(request)
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    GatewayError::TimeoutError(self.config.timeout)
                } else if e.is_connect() {
                    GatewayError::NetworkError(format!("Connection failed: {}", e))
                } else {
                    GatewayError::NetworkError(e.to_string())
                }
            })?;

        let status = response.status();
        
        if status.is_success() {
            let chat_response = response
                .json::<ChatCompletionResponse>()
                .await
                .map_err(|e| GatewayError::ParseError(format!("Failed to parse response: {}", e)))?;
            Ok(chat_response)
        } else {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            
            // Provide more specific error messages based on status code
            let error_msg = match status.as_u16() {
                401 => format!("Authentication failed: {}", error_text),
                403 => format!("Access forbidden: {}", error_text),
                429 => format!("Rate limit exceeded: {}", error_text),
                503 => "Service unavailable (circuit breaker may be open)".to_string(),
                500..=599 => format!("Server error: {}", error_text),
                _ => error_text,
            };
            
            Err(GatewayError::ApiError(status, error_msg))
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
    #[error("Timeout error: request exceeded {0:?}")]
    TimeoutError(Duration),
    #[error("Circuit breaker open: too many failures")]
    CircuitBreakerOpen,
    #[error("No provider available")]
    NoProviderAvailable,
    #[error("Invalid configuration: {0}")]
    ConfigError(String),
}

/// Chat completion request payload
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ChatCompletionRequest {
    /// Agent ID for routing (required by Go gateway)
    #[serde(rename = "agent_id")]
    pub agent_id: Option<String>,
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

/// Chat completion response from Go gateway
/// Note: This is a simpler format than OpenAI's - Go gateway returns content directly
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ChatCompletionResponse {
    /// The generated content
    pub content: String,
    /// Model used
    pub model: String,
    /// Provider used (e.g., "openrouter")
    pub provider: String,
    /// Token usage
    pub usage: Option<UsageInfo>,
}


/// Usage information
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UsageInfo {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}
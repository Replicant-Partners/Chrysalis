//! Transport Layer for Experience Synchronization
//!
//! Provides multiple transport implementations for sending and receiving
//! synchronization messages between agent instances.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;
use tokio::sync::mpsc;

use crate::gossip::GossipMessage;

// =============================================================================
// Transport Errors
// =============================================================================

/// Errors that can occur in transport operations
#[derive(Error, Debug)]
pub enum TransportError {
    #[error("Connection failed: {0}")]
    ConnectionFailed(String),

    #[error("Send failed: {0}")]
    SendFailed(String),

    #[error("Receive failed: {0}")]
    ReceiveFailed(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Timeout: {0}")]
    Timeout(String),

    #[error("Not connected")]
    NotConnected,
}

pub type TransportResult<T> = Result<T, TransportError>;

// =============================================================================
// Transport Trait
// =============================================================================

/// Transport configuration
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TransportConfig {
    pub timeout_ms: u64,
    pub max_message_size: usize,
    pub retry_count: u32,
    pub retry_delay_ms: u64,
}

impl Default for TransportConfig {
    fn default() -> Self {
        TransportConfig {
            timeout_ms: 5000,
            max_message_size: 1024 * 1024, // 1MB
            retry_count: 3,
            retry_delay_ms: 1000,
        }
    }
}

/// Transport trait for synchronization messaging
#[async_trait]
pub trait Transport: Send + Sync {
    /// Connect to a peer
    async fn connect(&mut self, address: &str) -> TransportResult<()>;

    /// Disconnect from a peer
    async fn disconnect(&mut self, address: &str) -> TransportResult<()>;

    /// Send a message to a specific peer
    async fn send(&self, address: &str, message: GossipMessage) -> TransportResult<()>;

    /// Receive messages (non-blocking)
    async fn receive(&mut self) -> TransportResult<Vec<(String, GossipMessage)>>;

    /// Check if connected to a peer
    fn is_connected(&self, address: &str) -> bool;

    /// Get list of connected peers
    fn connected_peers(&self) -> Vec<String>;
}

// =============================================================================
// HTTP Transport
// =============================================================================

/// HTTP-based transport for synchronization
pub struct HttpTransport {
    config: TransportConfig,
    client: reqwest::Client,
    connected_peers: HashMap<String, bool>,
}

impl HttpTransport {
    pub fn new(config: TransportConfig) -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_millis(config.timeout_ms))
            .build()
            .expect("Failed to build HTTP client");

        HttpTransport {
            config,
            client,
            connected_peers: HashMap::new(),
        }
    }
}

#[async_trait]
impl Transport for HttpTransport {
    async fn connect(&mut self, address: &str) -> TransportResult<()> {
        // HTTP is connectionless, just mark as "connected"
        self.connected_peers.insert(address.to_string(), true);
        Ok(())
    }

    async fn disconnect(&mut self, address: &str) -> TransportResult<()> {
        self.connected_peers.remove(address);
        Ok(())
    }

    async fn send(&self, address: &str, message: GossipMessage) -> TransportResult<()> {
        let url = format!("{}/sync", address);

        self.client
            .post(&url)
            .json(&message)
            .send()
            .await
            .map_err(|e| TransportError::SendFailed(e.to_string()))?;

        Ok(())
    }

    async fn receive(&mut self) -> TransportResult<Vec<(String, GossipMessage)>> {
        // HTTP transport doesn't have a receive mechanism -
        // messages are received through an HTTP endpoint
        Ok(Vec::new())
    }

    fn is_connected(&self, address: &str) -> bool {
        self.connected_peers.contains_key(address)
    }

    fn connected_peers(&self) -> Vec<String> {
        self.connected_peers.keys().cloned().collect()
    }
}

// =============================================================================
// WebSocket Transport
// =============================================================================

/// WebSocket-based transport for real-time synchronization
pub struct WebSocketTransport {
    config: TransportConfig,
    connections: HashMap<String, WebSocketConnection>,
    message_rx: Option<mpsc::Receiver<(String, GossipMessage)>>,
    message_tx: mpsc::Sender<(String, GossipMessage)>,
}

struct WebSocketConnection {
    _address: String,
    // In a real implementation, this would hold the actual WebSocket connection
}

impl WebSocketTransport {
    pub fn new(config: TransportConfig) -> Self {
        let (tx, rx) = mpsc::channel(1000);

        WebSocketTransport {
            config,
            connections: HashMap::new(),
            message_rx: Some(rx),
            message_tx: tx,
        }
    }

    /// Get a clone of the message sender for use in connection handlers
    pub fn message_sender(&self) -> mpsc::Sender<(String, GossipMessage)> {
        self.message_tx.clone()
    }
}

#[async_trait]
impl Transport for WebSocketTransport {
    async fn connect(&mut self, address: &str) -> TransportResult<()> {
        // In a real implementation, this would establish a WebSocket connection
        // For now, we just track the connection
        self.connections.insert(
            address.to_string(),
            WebSocketConnection {
                _address: address.to_string(),
            },
        );
        Ok(())
    }

    async fn disconnect(&mut self, address: &str) -> TransportResult<()> {
        self.connections.remove(address);
        Ok(())
    }

    async fn send(&self, address: &str, message: GossipMessage) -> TransportResult<()> {
        if !self.connections.contains_key(address) {
            return Err(TransportError::NotConnected);
        }

        // In a real implementation, this would send through the WebSocket
        // For now, we log and return success
        Ok(())
    }

    async fn receive(&mut self) -> TransportResult<Vec<(String, GossipMessage)>> {
        let mut messages = Vec::new();

        if let Some(rx) = &mut self.message_rx {
            while let Ok(msg) = rx.try_recv() {
                messages.push(msg);
            }
        }

        Ok(messages)
    }

    fn is_connected(&self, address: &str) -> bool {
        self.connections.contains_key(address)
    }

    fn connected_peers(&self) -> Vec<String> {
        self.connections.keys().cloned().collect()
    }
}

// =============================================================================
// In-Memory Transport (for testing)
// =============================================================================

/// In-memory transport for testing purposes
pub struct InMemoryTransport {
    instance_id: String,
    messages: std::sync::Arc<std::sync::Mutex<HashMap<String, Vec<GossipMessage>>>>,
    connected_peers: HashMap<String, bool>,
}

impl InMemoryTransport {
    pub fn new(instance_id: String) -> Self {
        InMemoryTransport {
            instance_id,
            messages: std::sync::Arc::new(std::sync::Mutex::new(HashMap::new())),
            connected_peers: HashMap::new(),
        }
    }

    /// Create a pair of connected in-memory transports for testing
    pub fn create_pair() -> (Self, Self) {
        let messages = std::sync::Arc::new(std::sync::Mutex::new(HashMap::new()));

        let transport_a = InMemoryTransport {
            instance_id: "a".to_string(),
            messages: messages.clone(),
            connected_peers: HashMap::new(),
        };

        let transport_b = InMemoryTransport {
            instance_id: "b".to_string(),
            messages,
            connected_peers: HashMap::new(),
        };

        (transport_a, transport_b)
    }
}

#[async_trait]
impl Transport for InMemoryTransport {
    async fn connect(&mut self, address: &str) -> TransportResult<()> {
        self.connected_peers.insert(address.to_string(), true);
        Ok(())
    }

    async fn disconnect(&mut self, address: &str) -> TransportResult<()> {
        self.connected_peers.remove(address);
        Ok(())
    }

    async fn send(&self, address: &str, message: GossipMessage) -> TransportResult<()> {
        let mut messages = self.messages.lock().unwrap();
        messages
            .entry(address.to_string())
            .or_insert_with(Vec::new)
            .push(message);
        Ok(())
    }

    async fn receive(&mut self) -> TransportResult<Vec<(String, GossipMessage)>> {
        let mut messages = self.messages.lock().unwrap();

        if let Some(inbox) = messages.remove(&self.instance_id) {
            Ok(inbox.into_iter().map(|m| ("sender".to_string(), m)).collect())
        } else {
            Ok(Vec::new())
        }
    }

    fn is_connected(&self, address: &str) -> bool {
        self.connected_peers.contains_key(address)
    }

    fn connected_peers(&self) -> Vec<String> {
        self.connected_peers.keys().cloned().collect()
    }
}

// =============================================================================
// Transport Factory
// =============================================================================

/// Type of transport to use
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TransportType {
    Http,
    WebSocket,
    InMemory,
}

/// Create a transport based on configuration
pub fn create_transport(
    transport_type: TransportType,
    config: TransportConfig,
    instance_id: Option<String>,
) -> Box<dyn Transport> {
    match transport_type {
        TransportType::Http => Box::new(HttpTransport::new(config)),
        TransportType::WebSocket => Box::new(WebSocketTransport::new(config)),
        TransportType::InMemory => Box::new(InMemoryTransport::new(
            instance_id.unwrap_or_else(|| "default".to_string()),
        )),
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crdt::{DeltaState, VectorClock};

    #[tokio::test]
    async fn test_in_memory_transport() {
        let mut transport_a = InMemoryTransport::new("a".to_string());
        let mut transport_b = InMemoryTransport::new("b".to_string());

        // Connect
        transport_a.connect("b").await.unwrap();
        transport_b.connect("a").await.unwrap();

        // Send message from A to B
        let message = GossipMessage::Heartbeat {
            sender_id: "a".to_string(),
            clock: VectorClock::new(),
            peer_count: 1,
        };

        transport_a.send("b", message.clone()).await.unwrap();

        // B should receive the message
        let received = transport_b.receive().await.unwrap();
        assert_eq!(received.len(), 1);
    }

    #[tokio::test]
    async fn test_http_transport_connect() {
        let mut transport = HttpTransport::new(TransportConfig::default());

        transport.connect("http://localhost:8080").await.unwrap();
        assert!(transport.is_connected("http://localhost:8080"));

        transport.disconnect("http://localhost:8080").await.unwrap();
        assert!(!transport.is_connected("http://localhost:8080"));
    }
}

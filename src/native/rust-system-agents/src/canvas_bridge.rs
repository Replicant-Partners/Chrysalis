//! Canvas Chat Bridge
//!
//! Rust implementation of the bridge connecting canvas components
//! to chat interfaces. Handles message routing, event propagation,
//! and state synchronization between UI components.
//!
//! Ported from TypeScript CanvasChatBridge.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use uuid::Uuid;
use chrono::Utc;

// =============================================================================
// Types
// =============================================================================

/// Canvas types supported by the system
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum CanvasType {
    Main,
    Repl,
    Whiteboard,
    Workflow,
    Debug,
}

/// Message types for canvas-chat communication
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum BridgeMessage {
    /// Chat message to send to canvas
    ChatMessage {
        content: String,
        agent_id: String,
        role: String,
        canvas_id: String,
        timestamp: String,
    },
    /// Canvas event to propagate to chat
    CanvasEvent {
        event_type: String,
        canvas_id: String,
        payload: serde_json::Value,
        timestamp: String,
    },
    /// Agent selection change
    AgentSelection {
        agent_id: String,
        canvas_id: String,
        selected: bool,
    },
    /// Canvas focus change
    CanvasFocus {
        canvas_id: String,
        focused: bool,
    },
    /// Sync state update
    SyncState {
        canvas_id: String,
        state: serde_json::Value,
    },
}

/// Canvas pane state
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CanvasPaneState {
    pub canvas_id: String,
    pub canvas_type: CanvasType,
    pub is_focused: bool,
    pub bound_agent_id: Option<String>,
    pub message_count: usize,
    pub last_activity: String,
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Chat pane state
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChatPaneState {
    pub pane_id: String,
    pub canvas_id: String,
    pub agent_id: Option<String>,
    pub is_active: bool,
    pub message_history: Vec<ChatMessage>,
}

/// Chat message structure
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub id: String,
    pub content: String,
    pub role: String,
    pub agent_id: Option<String>,
    pub timestamp: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Bridge event callback type
pub type EventCallback = Box<dyn Fn(&BridgeMessage) + Send + Sync>;

// =============================================================================
// Canvas Chat Bridge
// =============================================================================

/// Bridge connecting canvas components to chat interfaces
pub struct CanvasChatBridge {
    /// Map of canvas ID to canvas state
    canvases: Arc<RwLock<HashMap<String, CanvasPaneState>>>,
    /// Map of chat pane ID to chat state
    chat_panes: Arc<RwLock<HashMap<String, ChatPaneState>>>,
    /// Canvas-to-agent bindings
    bindings: Arc<RwLock<HashMap<String, String>>>,
    /// Event listeners
    listeners: Arc<RwLock<Vec<EventCallback>>>,
    /// Message queue for async processing
    message_queue: Arc<RwLock<Vec<BridgeMessage>>>,
}

impl CanvasChatBridge {
    /// Create a new canvas chat bridge
    pub fn new() -> Self {
        CanvasChatBridge {
            canvases: Arc::new(RwLock::new(HashMap::new())),
            chat_panes: Arc::new(RwLock::new(HashMap::new())),
            bindings: Arc::new(RwLock::new(HashMap::new())),
            listeners: Arc::new(RwLock::new(Vec::new())),
            message_queue: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Register a canvas with the bridge
    pub fn register_canvas(&self, canvas_id: &str, canvas_type: CanvasType) -> String {
        let id = if canvas_id.is_empty() {
            Uuid::new_v4().to_string()
        } else {
            canvas_id.to_string()
        };

        let state = CanvasPaneState {
            canvas_id: id.clone(),
            canvas_type,
            is_focused: false,
            bound_agent_id: None,
            message_count: 0,
            last_activity: Utc::now().to_rfc3339(),
            metadata: HashMap::new(),
        };

        let mut canvases = self.canvases.write().unwrap();
        canvases.insert(id.clone(), state);

        log::debug!("Registered canvas: {} ({:?})", id, canvas_type);
        id
    }

    /// Register a chat pane with the bridge
    pub fn register_chat_pane(&self, canvas_id: &str, agent_id: Option<&str>) -> String {
        let pane_id = Uuid::new_v4().to_string();

        let state = ChatPaneState {
            pane_id: pane_id.clone(),
            canvas_id: canvas_id.to_string(),
            agent_id: agent_id.map(|s| s.to_string()),
            is_active: true,
            message_history: Vec::new(),
        };

        let mut chat_panes = self.chat_panes.write().unwrap();
        chat_panes.insert(pane_id.clone(), state);

        // If agent_id is provided, create binding
        if let Some(agent) = agent_id {
            let mut bindings = self.bindings.write().unwrap();
            bindings.insert(canvas_id.to_string(), agent.to_string());
        }

        log::debug!("Registered chat pane: {} for canvas: {}", pane_id, canvas_id);
        pane_id
    }

    /// Bind an agent to a canvas
    pub fn bind_agent(&self, canvas_id: &str, agent_id: &str) {
        let mut bindings = self.bindings.write().unwrap();
        bindings.insert(canvas_id.to_string(), agent_id.to_string());

        let mut canvases = self.canvases.write().unwrap();
        if let Some(canvas) = canvases.get_mut(canvas_id) {
            canvas.bound_agent_id = Some(agent_id.to_string());
        }

        // Emit binding event
        self.emit(BridgeMessage::AgentSelection {
            agent_id: agent_id.to_string(),
            canvas_id: canvas_id.to_string(),
            selected: true,
        });

        log::debug!("Bound agent {} to canvas {}", agent_id, canvas_id);
    }

    /// Unbind an agent from a canvas
    pub fn unbind_agent(&self, canvas_id: &str) {
        let mut bindings = self.bindings.write().unwrap();
        let agent_id = bindings.remove(canvas_id);

        let mut canvases = self.canvases.write().unwrap();
        if let Some(canvas) = canvases.get_mut(canvas_id) {
            canvas.bound_agent_id = None;
        }

        // Emit unbinding event
        if let Some(agent) = agent_id {
            self.emit(BridgeMessage::AgentSelection {
                agent_id: agent,
                canvas_id: canvas_id.to_string(),
                selected: false,
            });
        }

        log::debug!("Unbound agent from canvas {}", canvas_id);
    }

    /// Get the agent bound to a canvas
    pub fn get_bound_agent(&self, canvas_id: &str) -> Option<String> {
        let bindings = self.bindings.read().unwrap();
        bindings.get(canvas_id).cloned()
    }

    /// Send a message through the bridge
    pub fn send_message(&self, canvas_id: &str, content: &str, role: &str) {
        let agent_id = self.get_bound_agent(canvas_id).unwrap_or_else(|| "system".to_string());
        let timestamp = Utc::now().to_rfc3339();

        let message = BridgeMessage::ChatMessage {
            content: content.to_string(),
            agent_id: agent_id.clone(),
            role: role.to_string(),
            canvas_id: canvas_id.to_string(),
            timestamp: timestamp.clone(),
        };

        // Update canvas state
        {
            let mut canvases = self.canvases.write().unwrap();
            if let Some(canvas) = canvases.get_mut(canvas_id) {
                canvas.message_count += 1;
                canvas.last_activity = timestamp.clone();
            }
        }

        // Add to chat pane history
        {
            let mut chat_panes = self.chat_panes.write().unwrap();
            for pane in chat_panes.values_mut() {
                if pane.canvas_id == canvas_id {
                    pane.message_history.push(ChatMessage {
                        id: Uuid::new_v4().to_string(),
                        content: content.to_string(),
                        role: role.to_string(),
                        agent_id: Some(agent_id.clone()),
                        timestamp: timestamp.clone(),
                        metadata: None,
                    });
                }
            }
        }

        self.emit(message);
        log::debug!("Sent message on canvas {}: {} chars", canvas_id, content.len());
    }

    /// Emit a canvas event
    pub fn emit_canvas_event(&self, canvas_id: &str, event_type: &str, payload: serde_json::Value) {
        let message = BridgeMessage::CanvasEvent {
            event_type: event_type.to_string(),
            canvas_id: canvas_id.to_string(),
            payload,
            timestamp: Utc::now().to_rfc3339(),
        };

        self.emit(message);
    }

    /// Set canvas focus
    pub fn set_focus(&self, canvas_id: &str, focused: bool) {
        {
            let mut canvases = self.canvases.write().unwrap();

            // Unfocus all other canvases if this one is being focused
            if focused {
                for canvas in canvases.values_mut() {
                    if canvas.canvas_id != canvas_id {
                        canvas.is_focused = false;
                    }
                }
            }

            if let Some(canvas) = canvases.get_mut(canvas_id) {
                canvas.is_focused = focused;
            }
        }

        self.emit(BridgeMessage::CanvasFocus {
            canvas_id: canvas_id.to_string(),
            focused,
        });
    }

    /// Get canvas state
    pub fn get_canvas_state(&self, canvas_id: &str) -> Option<CanvasPaneState> {
        let canvases = self.canvases.read().unwrap();
        canvases.get(canvas_id).cloned()
    }

    /// Get all canvas states
    pub fn get_all_canvases(&self) -> Vec<CanvasPaneState> {
        let canvases = self.canvases.read().unwrap();
        canvases.values().cloned().collect()
    }

    /// Get chat pane state
    pub fn get_chat_pane_state(&self, pane_id: &str) -> Option<ChatPaneState> {
        let chat_panes = self.chat_panes.read().unwrap();
        chat_panes.get(pane_id).cloned()
    }

    /// Get message history for a canvas
    pub fn get_message_history(&self, canvas_id: &str) -> Vec<ChatMessage> {
        let chat_panes = self.chat_panes.read().unwrap();
        chat_panes
            .values()
            .filter(|p| p.canvas_id == canvas_id)
            .flat_map(|p| p.message_history.iter().cloned())
            .collect()
    }

    /// Get the focused canvas
    pub fn get_focused_canvas(&self) -> Option<CanvasPaneState> {
        let canvases = self.canvases.read().unwrap();
        canvases.values().find(|c| c.is_focused).cloned()
    }

    /// Register an event listener
    pub fn on_message(&self, callback: EventCallback) {
        let mut listeners = self.listeners.write().unwrap();
        listeners.push(callback);
    }

    /// Emit a message to all listeners
    fn emit(&self, message: BridgeMessage) {
        // Add to queue
        {
            let mut queue = self.message_queue.write().unwrap();
            queue.push(message.clone());
        }

        // Notify listeners
        let listeners = self.listeners.read().unwrap();
        for listener in listeners.iter() {
            listener(&message);
        }
    }

    /// Process queued messages (for async processing)
    pub fn process_queue(&self) -> Vec<BridgeMessage> {
        let mut queue = self.message_queue.write().unwrap();
        let messages = queue.drain(..).collect();
        messages
    }

    /// Sync state for a canvas (for CRDT-based sync)
    pub fn sync_state(&self, canvas_id: &str, state: serde_json::Value) {
        self.emit(BridgeMessage::SyncState {
            canvas_id: canvas_id.to_string(),
            state,
        });
    }

    /// Remove a canvas from the bridge
    pub fn unregister_canvas(&self, canvas_id: &str) {
        let mut canvases = self.canvases.write().unwrap();
        canvases.remove(canvas_id);

        let mut bindings = self.bindings.write().unwrap();
        bindings.remove(canvas_id);

        let mut chat_panes = self.chat_panes.write().unwrap();
        chat_panes.retain(|_, pane| pane.canvas_id != canvas_id);

        log::debug!("Unregistered canvas: {}", canvas_id);
    }

    /// Get bridge statistics
    pub fn get_stats(&self) -> BridgeStats {
        let canvases = self.canvases.read().unwrap();
        let chat_panes = self.chat_panes.read().unwrap();
        let bindings = self.bindings.read().unwrap();
        let queue = self.message_queue.read().unwrap();

        BridgeStats {
            canvas_count: canvases.len(),
            chat_pane_count: chat_panes.len(),
            binding_count: bindings.len(),
            queued_messages: queue.len(),
            total_messages: canvases.values().map(|c| c.message_count).sum(),
        }
    }
}

impl Default for CanvasChatBridge {
    fn default() -> Self {
        Self::new()
    }
}

/// Bridge statistics
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BridgeStats {
    pub canvas_count: usize,
    pub chat_pane_count: usize,
    pub binding_count: usize,
    pub queued_messages: usize,
    pub total_messages: usize,
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_register_canvas() {
        let bridge = CanvasChatBridge::new();
        let canvas_id = bridge.register_canvas("test-canvas", CanvasType::Main);

        assert_eq!(canvas_id, "test-canvas");

        let state = bridge.get_canvas_state("test-canvas").unwrap();
        assert_eq!(state.canvas_type, CanvasType::Main);
        assert!(!state.is_focused);
    }

    #[test]
    fn test_bind_agent() {
        let bridge = CanvasChatBridge::new();
        bridge.register_canvas("canvas-1", CanvasType::Main);

        bridge.bind_agent("canvas-1", "ada");

        let agent = bridge.get_bound_agent("canvas-1");
        assert_eq!(agent, Some("ada".to_string()));

        let state = bridge.get_canvas_state("canvas-1").unwrap();
        assert_eq!(state.bound_agent_id, Some("ada".to_string()));
    }

    #[test]
    fn test_send_message() {
        let bridge = CanvasChatBridge::new();
        bridge.register_canvas("canvas-1", CanvasType::Main);
        bridge.register_chat_pane("canvas-1", Some("ada"));

        bridge.send_message("canvas-1", "Hello, world!", "user");

        let history = bridge.get_message_history("canvas-1");
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].content, "Hello, world!");
        assert_eq!(history[0].role, "user");
    }

    #[test]
    fn test_focus() {
        let bridge = CanvasChatBridge::new();
        bridge.register_canvas("canvas-1", CanvasType::Main);
        bridge.register_canvas("canvas-2", CanvasType::Repl);

        bridge.set_focus("canvas-1", true);

        let focused = bridge.get_focused_canvas().unwrap();
        assert_eq!(focused.canvas_id, "canvas-1");

        // Focus canvas-2, canvas-1 should be unfocused
        bridge.set_focus("canvas-2", true);

        let canvas1_state = bridge.get_canvas_state("canvas-1").unwrap();
        assert!(!canvas1_state.is_focused);

        let focused = bridge.get_focused_canvas().unwrap();
        assert_eq!(focused.canvas_id, "canvas-2");
    }

    #[test]
    fn test_stats() {
        let bridge = CanvasChatBridge::new();
        bridge.register_canvas("canvas-1", CanvasType::Main);
        bridge.register_chat_pane("canvas-1", Some("ada"));
        bridge.send_message("canvas-1", "Test", "user");

        let stats = bridge.get_stats();
        assert_eq!(stats.canvas_count, 1);
        assert_eq!(stats.chat_pane_count, 1);
        assert_eq!(stats.binding_count, 1);
        assert_eq!(stats.total_messages, 1);
    }
}

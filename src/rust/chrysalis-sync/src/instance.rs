//! Instance Lifecycle Management
//!
//! Manages the lifecycle of agent instances, including registration,
//! state synchronization, and health monitoring.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

#[cfg(feature = "crdt")]
use crate::crdt::SyncState;

// =============================================================================
// Instance State
// =============================================================================

/// Status of an instance
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InstanceStatus {
    Starting,
    Running,
    Syncing,
    Paused,
    Stopping,
    Stopped,
    Failed,
}

/// Instance metadata
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct InstanceMetadata {
    pub version: String,
    pub agent_id: String,
    pub framework: Option<String>,
    pub capabilities: Vec<String>,
    pub tags: HashMap<String, String>,
}

impl Default for InstanceMetadata {
    fn default() -> Self {
        InstanceMetadata {
            version: "1.0.0".to_string(),
            agent_id: String::new(),
            framework: None,
            capabilities: Vec::new(),
            tags: HashMap::new(),
        }
    }
}

/// Instance configuration
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct InstanceConfig {
    pub instance_id: String,
    pub metadata: InstanceMetadata,
    pub sync_enabled: bool,
    pub heartbeat_interval_ms: u64,
    pub sync_interval_ms: u64,
    pub max_offline_duration_ms: u64,
}

impl Default for InstanceConfig {
    fn default() -> Self {
        InstanceConfig {
            instance_id: uuid::Uuid::new_v4().to_string(),
            metadata: InstanceMetadata::default(),
            sync_enabled: true,
            heartbeat_interval_ms: 10000,  // 10 seconds
            sync_interval_ms: 5000,        // 5 seconds
            max_offline_duration_ms: 300000, // 5 minutes
        }
    }
}

/// Instance health information
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct InstanceHealth {
    pub status: InstanceStatus,
    pub last_heartbeat: u64,
    pub last_sync: u64,
    pub error_count: u32,
    pub memory_bytes: Option<u64>,
    pub event_count: usize,
}

// =============================================================================
// Instance Manager
// =============================================================================

/// Information about a registered instance
#[derive(Clone, Debug)]
pub struct RegisteredInstance {
    pub config: InstanceConfig,
    pub status: InstanceStatus,
    pub health: InstanceHealth,
    pub address: Option<String>,
    pub created_at: Instant,
    pub last_seen: Instant,
}

impl RegisteredInstance {
    pub fn new(config: InstanceConfig, address: Option<String>) -> Self {
        let now = Instant::now();
        RegisteredInstance {
            config,
            status: InstanceStatus::Starting,
            health: InstanceHealth {
                status: InstanceStatus::Starting,
                last_heartbeat: now_millis(),
                last_sync: 0,
                error_count: 0,
                memory_bytes: None,
                event_count: 0,
            },
            address,
            created_at: now,
            last_seen: now,
        }
    }

    pub fn update_heartbeat(&mut self) {
        self.last_seen = Instant::now();
        self.health.last_heartbeat = now_millis();
    }

    pub fn update_status(&mut self, status: InstanceStatus) {
        self.status = status.clone();
        self.health.status = status;
    }

    pub fn record_error(&mut self) {
        self.health.error_count += 1;
    }

    pub fn is_stale(&self, timeout: Duration) -> bool {
        self.last_seen.elapsed() > timeout
    }
}

/// Manages multiple agent instances
pub struct InstanceManager {
    instances: HashMap<String, RegisteredInstance>,
    local_instance_id: Option<String>,
}

impl InstanceManager {
    /// Create a new instance manager
    pub fn new() -> Self {
        InstanceManager {
            instances: HashMap::new(),
            local_instance_id: None,
        }
    }

    /// Register a new instance
    pub fn register(&mut self, config: InstanceConfig, address: Option<String>) -> String {
        let instance_id = config.instance_id.clone();
        let instance = RegisteredInstance::new(config, address);
        self.instances.insert(instance_id.clone(), instance);
        instance_id
    }

    /// Register the local instance
    pub fn register_local(&mut self, config: InstanceConfig) -> String {
        let instance_id = self.register(config, None);
        self.local_instance_id = Some(instance_id.clone());
        instance_id
    }

    /// Get the local instance ID
    pub fn local_instance_id(&self) -> Option<&str> {
        self.local_instance_id.as_deref()
    }

    /// Update instance heartbeat
    pub fn heartbeat(&mut self, instance_id: &str) -> bool {
        if let Some(instance) = self.instances.get_mut(instance_id) {
            instance.update_heartbeat();
            true
        } else {
            false
        }
    }

    /// Update instance status
    pub fn update_status(&mut self, instance_id: &str, status: InstanceStatus) -> bool {
        if let Some(instance) = self.instances.get_mut(instance_id) {
            instance.update_status(status);
            true
        } else {
            false
        }
    }

    /// Get an instance by ID
    pub fn get(&self, instance_id: &str) -> Option<&RegisteredInstance> {
        self.instances.get(instance_id)
    }

    /// Get mutable instance
    pub fn get_mut(&mut self, instance_id: &str) -> Option<&mut RegisteredInstance> {
        self.instances.get_mut(instance_id)
    }

    /// Unregister an instance
    pub fn unregister(&mut self, instance_id: &str) -> Option<RegisteredInstance> {
        let instance = self.instances.remove(instance_id);
        if self.local_instance_id.as_deref() == Some(instance_id) {
            self.local_instance_id = None;
        }
        instance
    }

    /// Get all running instances
    pub fn running_instances(&self) -> Vec<&RegisteredInstance> {
        self.instances
            .values()
            .filter(|i| i.status == InstanceStatus::Running)
            .collect()
    }

    /// Get all instances
    pub fn all_instances(&self) -> Vec<&RegisteredInstance> {
        self.instances.values().collect()
    }

    /// Get remote instances (for sync)
    pub fn remote_instances(&self) -> Vec<&RegisteredInstance> {
        let local_id = self.local_instance_id.as_deref();
        self.instances
            .values()
            .filter(|i| Some(i.config.instance_id.as_str()) != local_id)
            .collect()
    }

    /// Clean up stale instances
    pub fn cleanup_stale(&mut self, timeout: Duration) -> Vec<String> {
        let stale_ids: Vec<String> = self
            .instances
            .iter()
            .filter(|(id, instance)| {
                // Don't clean up the local instance
                Some(id.as_str()) != self.local_instance_id.as_deref()
                    && instance.is_stale(timeout)
            })
            .map(|(id, _)| id.clone())
            .collect();

        for id in &stale_ids {
            self.instances.remove(id);
        }

        stale_ids
    }

    /// Get instance statistics
    pub fn get_stats(&self) -> InstanceManagerStats {
        let total = self.instances.len();
        let running = self
            .instances
            .values()
            .filter(|i| i.status == InstanceStatus::Running)
            .count();
        let syncing = self
            .instances
            .values()
            .filter(|i| i.status == InstanceStatus::Syncing)
            .count();
        let failed = self
            .instances
            .values()
            .filter(|i| i.status == InstanceStatus::Failed)
            .count();

        InstanceManagerStats {
            total_instances: total,
            running_instances: running,
            syncing_instances: syncing,
            failed_instances: failed,
            has_local: self.local_instance_id.is_some(),
        }
    }
}

impl Default for InstanceManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Statistics about the instance manager
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct InstanceManagerStats {
    pub total_instances: usize,
    pub running_instances: usize,
    pub syncing_instances: usize,
    pub failed_instances: usize,
    pub has_local: bool,
}

// =============================================================================
// Instance Coordinator
// =============================================================================

/// Coordinates synchronization across instances
#[cfg(feature = "crdt")]
pub struct InstanceCoordinator {
    manager: InstanceManager,
    local_state: SyncState,
}

#[cfg(feature = "crdt")]
impl InstanceCoordinator {
    /// Create a new coordinator
    pub fn new(instance_id: String) -> Self {
        let mut manager = InstanceManager::new();
        let config = InstanceConfig {
            instance_id: instance_id.clone(),
            ..Default::default()
        };
        manager.register_local(config);

        InstanceCoordinator {
            manager,
            local_state: SyncState::new(instance_id),
        }
    }

    /// Get the instance manager
    pub fn manager(&self) -> &InstanceManager {
        &self.manager
    }

    /// Get mutable instance manager
    pub fn manager_mut(&mut self) -> &mut InstanceManager {
        &mut self.manager
    }

    /// Get the local sync state
    pub fn state(&self) -> &SyncState {
        &self.local_state
    }

    /// Get mutable sync state
    pub fn state_mut(&mut self) -> &mut SyncState {
        &mut self.local_state
    }

    /// Start the coordinator (mark local instance as running)
    pub fn start(&mut self) {
        if let Some(id) = self.manager.local_instance_id() {
            self.manager.update_status(id, InstanceStatus::Running);
        }
    }

    /// Stop the coordinator
    pub fn stop(&mut self) {
        if let Some(id) = self.manager.local_instance_id() {
            self.manager.update_status(id, InstanceStatus::Stopped);
        }
    }
}

// =============================================================================
// Utilities
// =============================================================================

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_instance_manager_register() {
        let mut manager = InstanceManager::new();

        let config = InstanceConfig {
            instance_id: "test-1".to_string(),
            ..Default::default()
        };

        let id = manager.register(config, Some("localhost:8080".to_string()));
        assert_eq!(id, "test-1");

        let instance = manager.get("test-1").unwrap();
        assert_eq!(instance.status, InstanceStatus::Starting);
    }

    #[test]
    fn test_instance_manager_local() {
        let mut manager = InstanceManager::new();

        let config = InstanceConfig {
            instance_id: "local-1".to_string(),
            ..Default::default()
        };

        manager.register_local(config);
        assert_eq!(manager.local_instance_id(), Some("local-1"));
    }

    #[test]
    fn test_instance_heartbeat() {
        let mut manager = InstanceManager::new();

        let config = InstanceConfig {
            instance_id: "test-1".to_string(),
            ..Default::default()
        };

        manager.register(config, None);

        // Update heartbeat
        std::thread::sleep(std::time::Duration::from_millis(10));
        manager.heartbeat("test-1");

        let instance = manager.get("test-1").unwrap();
        assert!(instance.health.last_heartbeat > 0);
    }

    #[test]
    fn test_instance_status_update() {
        let mut manager = InstanceManager::new();

        let config = InstanceConfig::default();
        let id = manager.register(config, None);

        manager.update_status(&id, InstanceStatus::Running);
        let instance = manager.get(&id).unwrap();
        assert_eq!(instance.status, InstanceStatus::Running);
    }

    #[test]
    fn test_remote_instances() {
        let mut manager = InstanceManager::new();

        // Register local
        manager.register_local(InstanceConfig {
            instance_id: "local".to_string(),
            ..Default::default()
        });

        // Register remotes
        manager.register(
            InstanceConfig {
                instance_id: "remote-1".to_string(),
                ..Default::default()
            },
            Some("addr-1".to_string()),
        );
        manager.register(
            InstanceConfig {
                instance_id: "remote-2".to_string(),
                ..Default::default()
            },
            Some("addr-2".to_string()),
        );

        let remotes = manager.remote_instances();
        assert_eq!(remotes.len(), 2);
    }

    #[cfg(feature = "crdt")]
    #[test]
    fn test_coordinator() {
        let mut coordinator = InstanceCoordinator::new("coordinator-test".to_string());

        coordinator.start();

        let stats = coordinator.manager().get_stats();
        assert_eq!(stats.running_instances, 1);
        assert!(stats.has_local);

        coordinator.stop();

        let instance = coordinator.manager().get("coordinator-test").unwrap();
        assert_eq!(instance.status, InstanceStatus::Stopped);
    }
}

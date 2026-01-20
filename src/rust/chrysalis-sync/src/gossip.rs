//! Gossip Protocol for Experience Propagation
//!
//! Implements an epidemic-style gossip protocol for propagating experience
//! updates across distributed agent instances.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::time::{Duration, Instant};

use crate::crdt::{DeltaState, SyncState, VectorClock};

// =============================================================================
// Gossip Configuration
// =============================================================================

/// Configuration for the gossip protocol
#[derive(Clone, Debug)]
pub struct GossipConfig {
    /// How often to initiate gossip rounds (in milliseconds)
    pub gossip_interval_ms: u64,
    /// Number of peers to gossip with each round
    pub fanout: usize,
    /// Maximum number of events in a single gossip message
    pub max_events_per_message: usize,
    /// Time to consider a peer as failed (in milliseconds)
    pub peer_timeout_ms: u64,
    /// Time before retrying a failed peer (in milliseconds)
    pub retry_interval_ms: u64,
}

impl Default for GossipConfig {
    fn default() -> Self {
        GossipConfig {
            gossip_interval_ms: 1000, // 1 second
            fanout: 3,
            max_events_per_message: 100,
            peer_timeout_ms: 30000,  // 30 seconds
            retry_interval_ms: 10000, // 10 seconds
        }
    }
}

// =============================================================================
// Peer State
// =============================================================================

/// State of a peer in the gossip network
#[derive(Clone, Debug)]
pub struct PeerState {
    pub peer_id: String,
    pub address: String,
    pub last_seen: Instant,
    pub last_clock: VectorClock,
    pub failed_attempts: u32,
    pub is_reachable: bool,
}

impl PeerState {
    pub fn new(peer_id: String, address: String) -> Self {
        PeerState {
            peer_id,
            address,
            last_seen: Instant::now(),
            last_clock: VectorClock::new(),
            failed_attempts: 0,
            is_reachable: true,
        }
    }

    pub fn mark_seen(&mut self) {
        self.last_seen = Instant::now();
        self.failed_attempts = 0;
        self.is_reachable = true;
    }

    pub fn mark_failed(&mut self) {
        self.failed_attempts += 1;
        if self.failed_attempts >= 3 {
            self.is_reachable = false;
        }
    }

    pub fn is_stale(&self, timeout: Duration) -> bool {
        self.last_seen.elapsed() > timeout
    }
}

// =============================================================================
// Gossip Messages
// =============================================================================

/// Types of gossip messages
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum GossipMessage {
    /// Push delta state to a peer
    Push {
        sender_id: String,
        delta: DeltaState,
    },
    /// Pull request - ask for updates since a clock
    Pull {
        sender_id: String,
        since_clock: VectorClock,
    },
    /// Response to a pull request
    PullResponse {
        sender_id: String,
        delta: DeltaState,
    },
    /// Heartbeat to maintain membership
    Heartbeat {
        sender_id: String,
        clock: VectorClock,
        peer_count: usize,
    },
    /// Membership update
    MembershipUpdate {
        sender_id: String,
        joined: Vec<PeerInfo>,
        left: Vec<String>,
    },
}

/// Information about a peer for membership updates
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PeerInfo {
    pub peer_id: String,
    pub address: String,
}

// =============================================================================
// Gossip Protocol
// =============================================================================

/// The gossip protocol manager
pub struct GossipProtocol {
    pub instance_id: String,
    pub config: GossipConfig,
    pub state: SyncState,
    pub peers: HashMap<String, PeerState>,
    pub pending_messages: Vec<(String, GossipMessage)>,
    last_gossip: Instant,
}

impl GossipProtocol {
    /// Create a new gossip protocol instance
    pub fn new(instance_id: String, config: GossipConfig) -> Self {
        GossipProtocol {
            instance_id: instance_id.clone(),
            config,
            state: SyncState::new(instance_id),
            peers: HashMap::new(),
            pending_messages: Vec::new(),
            last_gossip: Instant::now(),
        }
    }

    /// Add a peer to the gossip network
    pub fn add_peer(&mut self, peer_id: String, address: String) {
        if peer_id != self.instance_id && !self.peers.contains_key(&peer_id) {
            self.peers
                .insert(peer_id.clone(), PeerState::new(peer_id, address));
        }
    }

    /// Remove a peer from the network
    pub fn remove_peer(&mut self, peer_id: &str) {
        self.peers.remove(peer_id);
    }

    /// Get the current sync state
    pub fn get_state(&self) -> &SyncState {
        &self.state
    }

    /// Get mutable sync state
    pub fn get_state_mut(&mut self) -> &mut SyncState {
        &mut self.state
    }

    /// Check if it's time for a gossip round
    pub fn should_gossip(&self) -> bool {
        self.last_gossip.elapsed()
            >= Duration::from_millis(self.config.gossip_interval_ms)
    }

    /// Select peers to gossip with this round
    pub fn select_gossip_targets(&self) -> Vec<&PeerState> {
        let reachable: Vec<_> = self
            .peers
            .values()
            .filter(|p| p.is_reachable)
            .collect();

        if reachable.len() <= self.config.fanout {
            return reachable;
        }

        // Random selection (simplified - in practice use proper randomization)
        reachable
            .into_iter()
            .take(self.config.fanout)
            .collect()
    }

    /// Initiate a gossip round
    pub fn initiate_gossip(&mut self) -> Vec<(String, GossipMessage)> {
        self.last_gossip = Instant::now();
        let mut messages = Vec::new();

        let targets = self.select_gossip_targets();
        for peer in targets {
            let delta = self.state.delta_since(&peer.last_clock);

            if !delta.is_empty() {
                messages.push((
                    peer.address.clone(),
                    GossipMessage::Push {
                        sender_id: self.instance_id.clone(),
                        delta,
                    },
                ));
            }
        }

        // Also send heartbeats to some peers
        for peer in self.peers.values().take(self.config.fanout) {
            messages.push((
                peer.address.clone(),
                GossipMessage::Heartbeat {
                    sender_id: self.instance_id.clone(),
                    clock: self.state.log.clock().clone(),
                    peer_count: self.peers.len(),
                },
            ));
        }

        messages
    }

    /// Handle an incoming gossip message
    pub fn handle_message(&mut self, from_address: &str, message: GossipMessage) -> Option<GossipMessage> {
        match message {
            GossipMessage::Push { sender_id, delta } => {
                // Update peer state
                if let Some(peer) = self.peers.get_mut(&sender_id) {
                    peer.mark_seen();
                    peer.last_clock = delta.to_clock.clone();
                }

                // Apply the delta
                self.state.apply_delta(delta);
                None
            }

            GossipMessage::Pull {
                sender_id,
                since_clock,
            } => {
                // Update peer state
                if let Some(peer) = self.peers.get_mut(&sender_id) {
                    peer.mark_seen();
                }

                // Generate response
                let delta = self.state.delta_since(&since_clock);
                Some(GossipMessage::PullResponse {
                    sender_id: self.instance_id.clone(),
                    delta,
                })
            }

            GossipMessage::PullResponse { sender_id, delta } => {
                // Update peer state
                if let Some(peer) = self.peers.get_mut(&sender_id) {
                    peer.mark_seen();
                    peer.last_clock = delta.to_clock.clone();
                }

                // Apply the delta
                self.state.apply_delta(delta);
                None
            }

            GossipMessage::Heartbeat {
                sender_id,
                clock,
                peer_count: _,
            } => {
                // Update peer state
                if let Some(peer) = self.peers.get_mut(&sender_id) {
                    peer.mark_seen();
                    peer.last_clock = clock;
                } else {
                    // New peer - add it
                    self.add_peer(sender_id.clone(), from_address.to_string());
                }
                None
            }

            GossipMessage::MembershipUpdate {
                sender_id,
                joined,
                left,
            } => {
                // Update peer state
                if let Some(peer) = self.peers.get_mut(&sender_id) {
                    peer.mark_seen();
                }

                // Handle joins
                for peer_info in joined {
                    self.add_peer(peer_info.peer_id, peer_info.address);
                }

                // Handle leaves
                for peer_id in left {
                    self.remove_peer(&peer_id);
                }

                None
            }
        }
    }

    /// Mark a peer as having failed to respond
    pub fn mark_peer_failed(&mut self, peer_id: &str) {
        if let Some(peer) = self.peers.get_mut(peer_id) {
            peer.mark_failed();
        }
    }

    /// Clean up stale peers
    pub fn cleanup_stale_peers(&mut self) {
        let timeout = Duration::from_millis(self.config.peer_timeout_ms);
        let stale_ids: Vec<_> = self
            .peers
            .iter()
            .filter(|(_, p)| p.is_stale(timeout))
            .map(|(id, _)| id.clone())
            .collect();

        for id in stale_ids {
            self.peers.remove(&id);
        }
    }

    /// Get peer statistics
    pub fn get_stats(&self) -> GossipStats {
        let reachable_count = self.peers.values().filter(|p| p.is_reachable).count();
        GossipStats {
            total_peers: self.peers.len(),
            reachable_peers: reachable_count,
            event_count: self.state.log.len(),
            current_clock: self.state.log.clock().clone(),
        }
    }

    /// Request a full state pull from a peer
    pub fn request_full_sync(&self, peer_address: &str) -> (String, GossipMessage) {
        (
            peer_address.to_string(),
            GossipMessage::Pull {
                sender_id: self.instance_id.clone(),
                since_clock: VectorClock::new(), // Request everything
            },
        )
    }
}

/// Statistics about the gossip protocol
#[derive(Clone, Debug)]
pub struct GossipStats {
    pub total_peers: usize,
    pub reachable_peers: usize,
    pub event_count: usize,
    pub current_clock: VectorClock,
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crdt::ExperienceEventType;

    #[test]
    fn test_gossip_protocol_add_peer() {
        let mut protocol = GossipProtocol::new("instance-a".to_string(), GossipConfig::default());
        protocol.add_peer("instance-b".to_string(), "localhost:8001".to_string());
        protocol.add_peer("instance-c".to_string(), "localhost:8002".to_string());

        assert_eq!(protocol.peers.len(), 2);
        assert!(protocol.peers.contains_key("instance-b"));
    }

    #[test]
    fn test_gossip_protocol_self_peer_ignored() {
        let mut protocol = GossipProtocol::new("instance-a".to_string(), GossipConfig::default());
        protocol.add_peer("instance-a".to_string(), "localhost:8000".to_string());

        assert_eq!(protocol.peers.len(), 0);
    }

    #[test]
    fn test_gossip_message_handling() {
        let mut protocol_a = GossipProtocol::new("instance-a".to_string(), GossipConfig::default());
        let mut protocol_b = GossipProtocol::new("instance-b".to_string(), GossipConfig::default());

        protocol_a.add_peer("instance-b".to_string(), "localhost:8001".to_string());

        // Record an event in A
        protocol_a.get_state_mut().record_event(
            ExperienceEventType::PatternDiscovered,
            serde_json::json!({"pattern": "test"}),
        );

        // Create push message
        let delta = protocol_a.state.delta_since(&VectorClock::new());
        let message = GossipMessage::Push {
            sender_id: "instance-a".to_string(),
            delta,
        };

        // Handle at B
        protocol_b.handle_message("localhost:8000", message);

        // B should now have the event
        assert_eq!(protocol_b.state.log.len(), 1);
    }

    #[test]
    fn test_peer_state_failure_tracking() {
        let mut peer = PeerState::new("test-peer".to_string(), "localhost:8000".to_string());

        assert!(peer.is_reachable);

        peer.mark_failed();
        assert!(peer.is_reachable); // Still reachable after 1 failure

        peer.mark_failed();
        peer.mark_failed();
        assert!(!peer.is_reachable); // Unreachable after 3 failures

        peer.mark_seen();
        assert!(peer.is_reachable); // Reachable again after successful contact
    }
}

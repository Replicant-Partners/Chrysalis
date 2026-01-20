//! Chrysalis Experience Synchronization
//!
//! Distributed state management and experience sharing for agent instances.
//!
//! This crate provides:
//! - CRDT-based state management (VectorClock, ExperienceLog, LWWMap)
//! - Gossip protocol for epidemic experience propagation
//! - Multi-transport experience delivery (HTTP, WebSocket, MCP)
//! - Instance lifecycle management
//!
//! # Architecture
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────────────┐
//! │                    Instance A                                   │
//! │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐│
//! │  │ SyncState   │  │ GossipProto │  │ Transport (HTTP/WS/MCP) ││
//! │  │ - Log       │──│ - Peers     │──│                         ││
//! │  │ - Metrics   │  │ - Config    │  │                         ││
//! │  │ - Metadata  │  │ - Messages  │  │                         ││
//! │  └─────────────┘  └─────────────┘  └───────────┬─────────────┘│
//! └───────────────────────────────────────────────────────────────┘
//!                                                   │
//!                                      ┌────────────┴────────────┐
//!                                      │                         │
//!                                      ▼                         ▼
//!                              ┌───────────────┐         ┌───────────────┐
//!                              │  Instance B   │         │  Instance C   │
//!                              └───────────────┘         └───────────────┘
//! ```

#[cfg(feature = "crdt")]
pub mod crdt;

#[cfg(feature = "gossip")]
pub mod gossip;

#[cfg(feature = "transport")]
pub mod transport;

pub mod instance;

// Re-exports for convenient access
#[cfg(feature = "crdt")]
pub use crdt::{
    DeltaState, ExperienceEvent, ExperienceEventType, ExperienceLog,
    LWWEntry, LWWMap, SyncState, VectorClock,
};

#[cfg(feature = "gossip")]
pub use gossip::{
    GossipConfig, GossipMessage, GossipProtocol, GossipStats, PeerInfo, PeerState,
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        assert_eq!(2 + 2, 4);
    }

    #[cfg(feature = "crdt")]
    #[test]
    fn test_crdt_basic() {
        let mut state = SyncState::new("test-instance".to_string());
        state.record_event(
            ExperienceEventType::MemoryCreated,
            serde_json::json!({"content": "test"}),
        );
        assert_eq!(state.log.len(), 1);
    }

    #[cfg(feature = "gossip")]
    #[test]
    fn test_gossip_basic() {
        let protocol = GossipProtocol::new("test".to_string(), GossipConfig::default());
        let stats = protocol.get_stats();
        assert_eq!(stats.total_peers, 0);
    }
}

//! Chrysalis Experience Synchronization
//!
//! Distributed state management and experience sharing for agent instances.
//!
//! This crate provides:
//! - CRDT-based state management
//! - Gossip protocol for experience propagation
//! - Multi-transport experience delivery (HTTP, WebSocket, MCP)
//! - Instance lifecycle management

#[cfg(feature = "crdt")]
pub mod crdt;

#[cfg(feature = "gossip")]
pub mod gossip;

#[cfg(feature = "transport")]
pub mod transport;

pub mod instance;

#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        assert_eq!(2 + 2, 4);
    }
}

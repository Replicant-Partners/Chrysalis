//! Chrysalis Protocol Adapters
//!
//! Framework-agnostic protocol adapters for agent communication.
//!
//! This crate provides:
//! - Unified adapter traits
//! - Protocol-specific implementations (MCP, A2A, ACP, Agent Protocol)
//! - Protocol registry and capability management
//! - Message translation and validation

pub mod traits;
pub mod registry;
pub mod messages;

#[cfg(feature = "mcp")]
pub mod mcp;

#[cfg(feature = "a2a")]
pub mod a2a;

#[cfg(feature = "acp")]
pub mod acp;

#[cfg(feature = "agent-protocol")]
pub mod agent_protocol;

pub use traits::*;

#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        assert_eq!(2 + 2, 4);
    }
}

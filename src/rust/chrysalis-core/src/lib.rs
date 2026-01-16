//! Chrysalis Core
//!
//! Core agent types and schemas for the Chrysalis agent transformation system.
//!
//! This crate provides:
//! - `UniformSemanticAgentV2` - The canonical agent representation
//! - Agent component types (Identity, Personality, Capabilities, etc.)
//! - Schema validation and versioning
//! - Builder patterns for agent construction

pub mod agent;
pub mod components;
pub mod validation;

pub use agent::*;
pub use components::*;

#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        assert_eq!(2 + 2, 4);
    }
}

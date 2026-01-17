//! Chrysalis Core
//!
//! Core agent types and schemas for the Chrysalis agent transformation system.
//!
//! This crate provides:
//! - `SemanticAgent` - Agents operating in semantic/meaning space
//! - Agent component types (Identity, Personality, Capabilities, etc.)
//! - Schema validation and versioning
//! - Builder patterns for agent construction
//!
//! Note: `UniformSemanticAgentV2` is aliased to `SemanticAgent` for backward compatibility.

pub mod agent;
pub mod types;
pub mod component_types;
pub mod components;
pub mod validation;

pub use agent::*;
pub use types::*;
pub use component_types::*;

#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        assert_eq!(2 + 2, 4);
    }
}

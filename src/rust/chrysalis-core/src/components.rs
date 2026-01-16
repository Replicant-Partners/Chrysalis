//! Agent component types
//!
//! Modular components that make up an agent's structure.

use serde::{Deserialize, Serialize};

/// Agent identity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Identity {
    pub id: String,
    pub name: String,
    pub designation: String,
    pub fingerprint: Option<String>,
    pub created: String,
    pub version: String,
}

/// Agent personality
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Personality {
    // TODO: Add personality fields
}

/// Agent communication style
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Communication {
    // TODO: Add communication fields
}

/// Agent capabilities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Capabilities {
    // TODO: Add capabilities fields
}

/// Agent knowledge
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Knowledge {
    // TODO: Add knowledge fields
}

// TODO: Add remaining component types:
// - Memory
// - Beliefs
// - Instances
// - ExperienceSyncConfig
// - Protocols
// - Execution
// - Metadata

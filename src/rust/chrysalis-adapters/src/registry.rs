//! Protocol registry
//!
//! Registry of supported protocols and their metadata

/// Protocol registry (placeholder)
pub struct ProtocolRegistry {
    // TODO: Load from PROTOCOL_REGISTRY_V2 JSON
}

impl ProtocolRegistry {
    pub fn new() -> Self {
        Self {}
    }
}

impl Default for ProtocolRegistry {
    fn default() -> Self {
        Self::new()
    }
}

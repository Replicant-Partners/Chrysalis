//! Semantic agent validation logic

use super::agent::SemanticAgent;

/// Validation result
#[derive(Debug)]
pub struct ValidationReport {
    pub valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

impl ValidationReport {
    pub fn new() -> Self {
        Self {
            valid: true,
            errors: Vec::new(),
            warnings: Vec::new(),
        }
    }

    pub fn add_error(&mut self, error: String) {
        self.valid = false;
        self.errors.push(error);
    }

    pub fn add_warning(&mut self, warning: String) {
        self.warnings.push(warning);
    }
}

impl Default for ValidationReport {
    fn default() -> Self {
        Self::new()
    }
}

/// Validate semantic agent schema
pub fn validate_agent(agent: &SemanticAgent) -> ValidationReport {
    let mut report = ValidationReport::new();

    // Required: schema_version
    if agent.schema_version.is_empty() {
        report.add_error("Missing schema_version".to_string());
    } else if agent.schema_version != super::agent::SCHEMA_VERSION {
        report.add_warning(format!(
            "Schema version {} != {}",
            agent.schema_version,
            super::agent::SCHEMA_VERSION
        ));
    }

    // Required: identity
    if agent.identity.id.is_empty() {
        report.add_error("Missing identity.id".to_string());
    }

    // Required: instances.active must exist (TypeScript checks this)
    // Note: Empty is okay, just checking the field exists (which it always does in Rust)

    // Required: experience_sync exists (always exists in Rust struct)

    // Required: protocols exists (always exists in Rust struct)

    // Protocol validation: at least one must be enabled
    let has_protocol = agent.protocols.mcp.as_ref().map(|p| p.enabled).unwrap_or(false)
        || agent.protocols.a2a.as_ref().map(|p| p.enabled).unwrap_or(false)
        || agent.protocols.agent_protocol.as_ref().map(|p| p.enabled).unwrap_or(false);

    if !has_protocol {
        report.add_warning("No protocols enabled - agent may not be functional".to_string());
    }

    report
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validation_report() {
        let mut report = ValidationReport::new();
        assert!(report.valid);

        report.add_error("Test error".to_string());
        assert!(!report.valid);
        assert_eq!(report.errors.len(), 1);
    }
}

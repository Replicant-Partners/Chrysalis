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
pub fn validate_agent(_agent: &SemanticAgent) -> ValidationReport {
    let report = ValidationReport::new();

    // TODO: Implement validation rules from TypeScript validateUniformSemanticAgentV2()
    // - Schema version check
    // - Required field validation (identity, instances, experience_sync, protocols)
    // - Protocol validation (at least one enabled)
    // - Type constraints
    // - Cross-field validation

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

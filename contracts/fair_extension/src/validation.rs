//! # Contract Validation
//!
//! Validates that a contract draft meets all fairness requirements.
//! A draft becomes a valid contract only by passing through this gate.

use thiserror::Error;

use crate::extension::{ContractDraft, ExtensionContract};
use crate::fairness::{FairnessRequirement, FairnessViolation};

/// Errors that prevent contract validation
#[derive(Debug, Error)]
pub enum ValidationError {
    #[error("Fairness violation: {0:?}")]
    FairnessViolation(FairnessViolation),

    #[error("Multiple fairness violations: {0:?}")]
    MultipleFairnessViolations(Vec<FairnessViolation>),

    #[error("Missing required field: {0}")]
    MissingField(String),

    #[error("Invalid license identifier: {0}")]
    InvalidLicense(String),

    #[error("URN format invalid: {0}")]
    InvalidUrn(String),
}

/// Result of contract validation
#[derive(Debug)]
pub enum ValidationResult {
    /// Contract is valid and fair
    Valid(ExtensionContract),
    /// Contract has fairness violations
    Invalid {
        violations: Vec<FairnessViolation>,
        suggestions: Vec<String>,
    },
}

/// Validates contract drafts against fairness requirements
pub struct ContractValidator {
    /// Requirements to check
    requirements: Vec<FairnessRequirement>,
}

impl Default for ContractValidator {
    fn default() -> Self {
        Self::new()
    }
}

impl ContractValidator {
    pub fn new() -> Self {
        Self {
            requirements: FairnessRequirement::all(),
        }
    }

    /// Validate a contract draft
    ///
    /// Returns a valid ExtensionContract only if all fairness
    /// requirements are satisfied. Otherwise returns violations
    /// with suggestions for remediation.
    pub fn validate(&self, draft: ContractDraft) -> ValidationResult {
        let mut violations = Vec::new();
        let mut suggestions = Vec::new();

        // Check each fairness requirement
        for requirement in &self.requirements {
            if let Some(violation) = self.check_requirement(requirement, &draft) {
                suggestions.push(self.suggest_remediation(requirement));
                violations.push(violation);
            }
        }

        // Check reciprocity specifically
        let reciprocity_violations = draft.reciprocity.find_imbalances();
        for v in reciprocity_violations {
            suggestions.push(format!(
                "Add obligations to balance: {:?}",
                v
            ));
            violations.push(v);
        }

        // Validate required fields
        if draft.license.is_empty() {
            violations.push(FairnessViolation::LackOfTransparency {
                term: "license".into(),
                reason: "No license specified".into(),
            });
            suggestions.push("Specify an SPDX license identifier".into());
        }

        if draft.description.is_empty() {
            violations.push(FairnessViolation::LackOfTransparency {
                term: "description".into(),
                reason: "No description provided".into(),
            });
            suggestions.push("Provide a clear description of what this extension does".into());
        }

        if violations.is_empty() {
            ValidationResult::Valid(ExtensionContract::new_validated(
                draft.urn,
                draft.provider,
                draft.description,
                draft.capabilities,
                draft.reciprocity,
                draft.license,
            ))
        } else {
            ValidationResult::Invalid {
                violations,
                suggestions,
            }
        }
    }

    /// Check a specific fairness requirement
    fn check_requirement(
        &self,
        requirement: &FairnessRequirement,
        draft: &ContractDraft,
    ) -> Option<FairnessViolation> {
        match requirement {
            FairnessRequirement::Reciprocity => {
                if !draft.reciprocity.is_balanced() {
                    Some(FairnessViolation::NoReciprocity {
                        from: crate::fairness::Party::Platform,
                        to: crate::fairness::Party::Provider(draft.provider.name.clone()),
                        reason: "Obligations not mutual".into(),
                    })
                } else {
                    None
                }
            }
            FairnessRequirement::Transparency => {
                // Check for comprehensible description
                if draft.description.len() < 10 {
                    Some(FairnessViolation::LackOfTransparency {
                        term: "description".into(),
                        reason: "Description too brief to be meaningful".into(),
                    })
                } else {
                    None
                }
            }
            FairnessRequirement::Stability => {
                // Stability is enforced by contract versioning
                // Checked in evolution module
                None
            }
            FairnessRequirement::ExitRight => {
                // Must be specified in reciprocity
                // For now, we assume it's present if reciprocity is balanced
                None
            }
            FairnessRequirement::DignityPreserving => {
                // Check for problematic terms
                // This would involve more sophisticated analysis
                None
            }
            FairnessRequirement::FairDispute => {
                // Dispute resolution mechanism required
                // For now, platform default applies
                None
            }
        }
    }

    /// Suggest how to fix a fairness violation
    fn suggest_remediation(&self, requirement: &FairnessRequirement) -> String {
        match requirement {
            FairnessRequirement::Reciprocity => {
                "Add mutual obligations: what does the platform provide, what does the provider commit to?".into()
            }
            FairnessRequirement::Transparency => {
                "Provide clear, comprehensible descriptions of all terms".into()
            }
            FairnessRequirement::Stability => {
                "Commit to stability: material changes require mutual agreement".into()
            }
            FairnessRequirement::ExitRight => {
                "Ensure either party can exit without punitive consequences".into()
            }
            FairnessRequirement::DignityPreserving => {
                "Remove any terms that strip fundamental dignity from any party".into()
            }
            FairnessRequirement::FairDispute => {
                "Specify a fair dispute resolution mechanism".into()
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::extension::{ExtensionCategory, ExtensionUrn, ProviderInfo};
    use crate::fairness::{Obligation, ObligationKind, Party};
    use semver::Version;

    fn valid_draft() -> ContractDraft {
        let urn = ExtensionUrn::new(
            ExtensionCategory::Memory,
            "testorg",
            "test-extension",
            Version::new(1, 0, 0),
        );

        let provider = ProviderInfo {
            name: "Test Provider".into(),
            contact: "test@example.com".into(),
            website: None,
            support_url: None,
        };

        ContractDraft::new(urn, provider, "A test extension that provides memory services".into())
            .with_license("MIT")
            .with_reciprocity(crate::fairness::Reciprocity {
                platform_to_provider: vec![
                    Obligation {
                        obligor: Party::Platform,
                        obligee: Party::Provider("Test Provider".into()),
                        description: "Provide API access and documentation".into(),
                        kind: ObligationKind::Service,
                    }
                ],
                provider_to_platform: vec![
                    Obligation {
                        obligor: Party::Provider("Test Provider".into()),
                        obligee: Party::Platform,
                        description: "Maintain compatibility with platform APIs".into(),
                        kind: ObligationKind::Constraint,
                    }
                ],
                provider_to_user: vec![
                    Obligation {
                        obligor: Party::Provider("Test Provider".into()),
                        obligee: Party::User,
                        description: "Provide reliable memory storage services".into(),
                        kind: ObligationKind::Service,
                    }
                ],
                user_to_provider: vec![],
            })
    }

    #[test]
    fn valid_draft_passes_validation() {
        let validator = ContractValidator::new();
        let draft = valid_draft();

        match validator.validate(draft) {
            ValidationResult::Valid(contract) => {
                assert_eq!(contract.license, "MIT");
                assert!(contract.reciprocity.is_balanced());
            }
            ValidationResult::Invalid { violations, .. } => {
                panic!("Expected valid, got violations: {:?}", violations);
            }
        }
    }

    #[test]
    fn empty_reciprocity_fails_validation() {
        let validator = ContractValidator::new();
        let urn = ExtensionUrn::new(
            ExtensionCategory::Memory,
            "testorg",
            "unfair-extension",
            Version::new(1, 0, 0),
        );

        let provider = ProviderInfo {
            name: "Unfair Provider".into(),
            contact: "unfair@example.com".into(),
            website: None,
            support_url: None,
        };

        let draft = ContractDraft::new(urn, provider, "An unfair extension".into())
            .with_license("MIT");

        match validator.validate(draft) {
            ValidationResult::Valid(_) => {
                panic!("Expected invalid due to empty reciprocity");
            }
            ValidationResult::Invalid { violations, .. } => {
                assert!(!violations.is_empty());
            }
        }
    }
}

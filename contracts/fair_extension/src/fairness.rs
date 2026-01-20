//! # Fairness Requirements
//!
//! The hedgehog principle: all of justice collapses into fairness
//! and reciprocity. This module defines what fairness means for
//! extension contracts.

use serde::{Deserialize, Serialize};

/// An obligation one party owes another.
///
/// Fairness requires that obligations are reciprocal—if Party A
/// owes something to Party B, there must be a corresponding
/// obligation flowing back.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Obligation {
    /// Who bears this obligation
    pub obligor: Party,
    /// Who benefits from this obligation
    pub obligee: Party,
    /// What the obligation entails
    pub description: String,
    /// Category of obligation
    pub kind: ObligationKind,
}

/// Categories of obligations
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ObligationKind {
    /// Provide a service or capability
    Service,
    /// Provide data or information
    Data,
    /// Provide compensation
    Compensation,
    /// Maintain confidentiality
    Confidentiality,
    /// Provide support
    Support,
    /// Respect limitations
    Constraint,
}

/// A party to the contract
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Party {
    /// The Chrysalis platform
    Platform,
    /// An extension provider
    Provider(String),
    /// An end user
    User,
}

/// Reciprocity assessment between parties.
///
/// A contract is fair only if reciprocity holds: obligations
/// flow in both directions, and neither party bears a
/// disproportionate burden.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Reciprocity {
    /// Obligations from platform to provider
    pub platform_to_provider: Vec<Obligation>,
    /// Obligations from provider to platform
    pub provider_to_platform: Vec<Obligation>,
    /// Obligations from provider to user
    pub provider_to_user: Vec<Obligation>,
    /// Obligations from user to provider (if any)
    pub user_to_provider: Vec<Obligation>,
}

impl Reciprocity {
    /// Check if obligations are balanced.
    ///
    /// This is not a simple count—some obligations weigh more
    /// than others. But gross imbalance fails.
    pub fn is_balanced(&self) -> bool {
        // Platform-Provider relationship must have obligations both ways
        let platform_provider_balanced =
            !self.platform_to_provider.is_empty() &&
            !self.provider_to_platform.is_empty();

        // Provider-User: providers must have obligations to users
        // Users may have minimal obligations (authentication, compliance)
        let provider_user_balanced = !self.provider_to_user.is_empty();

        platform_provider_balanced && provider_user_balanced
    }

    /// Identify any one-sided obligations that violate fairness
    pub fn find_imbalances(&self) -> Vec<FairnessViolation> {
        let mut violations = Vec::new();

        if self.platform_to_provider.is_empty() {
            violations.push(FairnessViolation::NoReciprocity {
                from: Party::Platform,
                to: Party::Provider("*".into()),
                reason: "Platform takes but gives nothing".into(),
            });
        }

        if self.provider_to_platform.is_empty() {
            violations.push(FairnessViolation::NoReciprocity {
                from: Party::Provider("*".into()),
                to: Party::Platform,
                reason: "Provider receives platform benefits without obligation".into(),
            });
        }

        if self.provider_to_user.is_empty() {
            violations.push(FairnessViolation::NoReciprocity {
                from: Party::Provider("*".into()),
                to: Party::User,
                reason: "Provider offers nothing to end users".into(),
            });
        }

        violations
    }
}

/// A requirement that must hold for a contract to be fair
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum FairnessRequirement {
    /// Obligations must flow both directions
    Reciprocity,
    /// Terms must be comprehensible, not hidden in legalese
    Transparency,
    /// Neither party may unilaterally change material terms
    Stability,
    /// Parties must be able to exit without punitive consequences
    ExitRight,
    /// No terms that strip fundamental dignity
    DignityPreserving,
    /// Disputes resolved through fair process
    FairDispute,
}

impl FairnessRequirement {
    /// All requirements that must hold
    pub fn all() -> Vec<Self> {
        vec![
            Self::Reciprocity,
            Self::Transparency,
            Self::Stability,
            Self::ExitRight,
            Self::DignityPreserving,
            Self::FairDispute,
        ]
    }

    /// Human-readable description
    pub fn description(&self) -> &'static str {
        match self {
            Self::Reciprocity => "Obligations must be mutual between parties",
            Self::Transparency => "Terms must be clear and comprehensible",
            Self::Stability => "Material terms cannot be changed unilaterally",
            Self::ExitRight => "Parties may exit without punitive consequence",
            Self::DignityPreserving => "No terms that strip fundamental dignity",
            Self::FairDispute => "Disputes resolved through fair process",
        }
    }
}

/// A violation of fairness that invalidates a contract
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum FairnessViolation {
    /// One party has obligations, the other does not
    NoReciprocity {
        from: Party,
        to: Party,
        reason: String,
    },
    /// Terms are hidden or incomprehensible
    LackOfTransparency {
        term: String,
        reason: String,
    },
    /// One party can unilaterally change terms
    UnilateralAmendment {
        party: Party,
        scope: String,
    },
    /// Exit is punitive or impossible
    TrapContract {
        exit_barrier: String,
    },
    /// Terms strip dignity
    DignityViolation {
        term: String,
        explanation: String,
    },
    /// Dispute resolution is unfair
    UnfairDispute {
        mechanism: String,
        bias: String,
    },
}

impl FairnessViolation {
    /// A contract with any violation is invalid
    pub fn invalidates_contract(&self) -> bool {
        true // All fairness violations are fatal
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_reciprocity_is_unbalanced() {
        let empty = Reciprocity {
            platform_to_provider: vec![],
            provider_to_platform: vec![],
            provider_to_user: vec![],
            user_to_provider: vec![],
        };

        assert!(!empty.is_balanced());
        assert!(!empty.find_imbalances().is_empty());
    }

    #[test]
    fn mutual_obligations_are_balanced() {
        let balanced = Reciprocity {
            platform_to_provider: vec![
                Obligation {
                    obligor: Party::Platform,
                    obligee: Party::Provider("test".into()),
                    description: "Provide API access".into(),
                    kind: ObligationKind::Service,
                }
            ],
            provider_to_platform: vec![
                Obligation {
                    obligor: Party::Provider("test".into()),
                    obligee: Party::Platform,
                    description: "Maintain compatibility".into(),
                    kind: ObligationKind::Constraint,
                }
            ],
            provider_to_user: vec![
                Obligation {
                    obligor: Party::Provider("test".into()),
                    obligee: Party::User,
                    description: "Provide documented functionality".into(),
                    kind: ObligationKind::Service,
                }
            ],
            user_to_provider: vec![],
        };

        assert!(balanced.is_balanced());
        assert!(balanced.find_imbalances().is_empty());
    }
}

//! # Chrysalis FAIR Extension Contracts
//!
//! A rigorous contract system grounded in Dworkinian principles:
//! justice collapses into fairness and reciprocity between parties.
//!
//! This module enforces fairness as a validity condition—contracts
//! that violate reciprocity or strip dignity simply do not compile
//! or validate.
//!
//! ## References
//!
//! - Dworkin, Ronald. *Justice for Hedgehogs*. Harvard University Press, 2011.
//! - Dworkin, Ronald. *Taking Rights Seriously*. Harvard University Press, 1977.

pub mod fairness;
pub mod extension;
pub mod validation;
pub mod evolution;
pub mod runtime;

pub use fairness::{FairnessRequirement, Reciprocity, Obligation};
pub use extension::{ExtensionContract, ExtensionCategory, Capability};
pub use validation::{ContractValidator, ValidationResult, ValidationError};
pub use evolution::{ContractVersion, Migration, EvolutionPath};
pub use runtime::{ExtensionRuntime, ExtensionConfig, HealthStatus, ExtensionError};

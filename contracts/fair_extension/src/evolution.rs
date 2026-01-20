//! # Contract Evolution
//!
//! Contracts with outside providers will evolve over time.
//! This module manages version transitions while preserving
//! fairness guarantees.
//!
//! Key principle: material changes require mutual agreement.
//! Neither party may unilaterally alter the contract's substance.

use chrono::{DateTime, Utc};
use semver::Version;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::extension::ExtensionContract;
use crate::fairness::FairnessRequirement;

/// Tracks the version history of a contract
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContractVersion {
    /// Version number
    pub version: u32,
    /// When this version was created
    pub created: DateTime<Utc>,
    /// What changed from previous version
    pub changes: Vec<ContractChange>,
    /// Who initiated the change
    pub initiator: ChangeInitiator,
    /// Whether the other party has agreed
    pub agreement_status: AgreementStatus,
}

/// Types of changes to a contract
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ContractChange {
    /// Added a new capability
    CapabilityAdded { capability_urn: String },
    /// Removed a capability
    CapabilityRemoved { capability_urn: String },
    /// Modified an obligation
    ObligationModified { description: String },
    /// Added a new obligation
    ObligationAdded { description: String },
    /// Removed an obligation
    ObligationRemoved { description: String },
    /// Updated metadata (non-material)
    MetadataUpdated { field: String },
    /// Extension version bumped
    ExtensionVersionBumped { from: Version, to: Version },
}

impl ContractChange {
    /// Is this a material change requiring mutual agreement?
    pub fn is_material(&self) -> bool {
        match self {
            Self::CapabilityAdded { .. } => true,
            Self::CapabilityRemoved { .. } => true,
            Self::ObligationModified { .. } => true,
            Self::ObligationAdded { .. } => true,
            Self::ObligationRemoved { .. } => true,
            Self::MetadataUpdated { .. } => false,
            Self::ExtensionVersionBumped { .. } => false,
        }
    }
}

/// Who initiated a contract change
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ChangeInitiator {
    Platform,
    Provider(String),
    Mutual,
}

/// Status of agreement to a change
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum AgreementStatus {
    /// Proposed but not yet agreed
    Proposed,
    /// Agreed by all parties
    Agreed,
    /// Rejected by one party
    Rejected { by: String, reason: String },
    /// Automatically applied (non-material change)
    AutoApplied,
}

/// A proposed migration from one contract version to another
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Migration {
    pub id: Uuid,
    pub contract_id: Uuid,
    pub from_version: u32,
    pub to_version: u32,
    pub changes: Vec<ContractChange>,
    pub proposed_at: DateTime<Utc>,
    pub proposed_by: ChangeInitiator,
    pub status: MigrationStatus,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum MigrationStatus {
    Proposed,
    AwaitingPlatformApproval,
    AwaitingProviderApproval,
    Approved,
    Rejected,
    Applied,
}

/// Tracks the full evolution path of a contract
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvolutionPath {
    pub contract_id: Uuid,
    pub versions: Vec<ContractVersion>,
    pub pending_migrations: Vec<Migration>,
}

impl EvolutionPath {
    pub fn new(contract: &ExtensionContract) -> Self {
        Self {
            contract_id: contract.id,
            versions: vec![ContractVersion {
                version: 1,
                created: contract.created,
                changes: vec![],
                initiator: ChangeInitiator::Mutual,
                agreement_status: AgreementStatus::Agreed,
            }],
            pending_migrations: vec![],
        }
    }

    /// Propose a new contract version
    ///
    /// Material changes require agreement from all parties.
    /// Non-material changes can be auto-applied.
    pub fn propose_migration(
        &mut self,
        changes: Vec<ContractChange>,
        initiator: ChangeInitiator,
    ) -> Result<Migration, EvolutionError> {
        let current_version = self.versions.last()
            .map(|v| v.version)
            .unwrap_or(0);

        let has_material_changes = changes.iter().any(|c| c.is_material());

        let status = if has_material_changes {
            match &initiator {
                ChangeInitiator::Platform => MigrationStatus::AwaitingProviderApproval,
                ChangeInitiator::Provider(_) => MigrationStatus::AwaitingPlatformApproval,
                ChangeInitiator::Mutual => MigrationStatus::Approved,
            }
        } else {
            MigrationStatus::Approved
        };

        let migration = Migration {
            id: Uuid::new_v4(),
            contract_id: self.contract_id,
            from_version: current_version,
            to_version: current_version + 1,
            changes,
            proposed_at: Utc::now(),
            proposed_by: initiator,
            status,
        };

        if migration.status == MigrationStatus::Approved {
            // Non-material or mutual: apply immediately
            self.apply_migration(&migration)?;
        } else {
            self.pending_migrations.push(migration.clone());
        }

        Ok(migration)
    }

    /// Approve a pending migration
    pub fn approve_migration(
        &mut self,
        migration_id: Uuid,
        approver: &str,
    ) -> Result<(), EvolutionError> {
        let migration = self.pending_migrations
            .iter_mut()
            .find(|m| m.id == migration_id)
            .ok_or(EvolutionError::MigrationNotFound)?;

        migration.status = MigrationStatus::Approved;

        // Move to versions
        let migration = self.pending_migrations
            .iter()
            .find(|m| m.id == migration_id)
            .cloned()
            .unwrap();

        self.apply_migration(&migration)?;
        self.pending_migrations.retain(|m| m.id != migration_id);

        Ok(())
    }

    /// Reject a pending migration
    pub fn reject_migration(
        &mut self,
        migration_id: Uuid,
        rejector: &str,
        reason: &str,
    ) -> Result<(), EvolutionError> {
        let migration = self.pending_migrations
            .iter_mut()
            .find(|m| m.id == migration_id)
            .ok_or(EvolutionError::MigrationNotFound)?;

        migration.status = MigrationStatus::Rejected;

        Ok(())
    }

    fn apply_migration(&mut self, migration: &Migration) -> Result<(), EvolutionError> {
        let new_version = ContractVersion {
            version: migration.to_version,
            created: Utc::now(),
            changes: migration.changes.clone(),
            initiator: migration.proposed_by.clone(),
            agreement_status: AgreementStatus::Agreed,
        };

        self.versions.push(new_version);
        Ok(())
    }

    /// Get current version number
    pub fn current_version(&self) -> u32 {
        self.versions.last().map(|v| v.version).unwrap_or(0)
    }
}

#[derive(Debug, thiserror::Error)]
pub enum EvolutionError {
    #[error("Migration not found")]
    MigrationNotFound,

    #[error("Cannot apply migration: {0}")]
    CannotApply(String),

    #[error("Material change requires mutual agreement")]
    RequiresMutualAgreement,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn metadata_changes_auto_apply() {
        let mut path = EvolutionPath {
            contract_id: Uuid::new_v4(),
            versions: vec![ContractVersion {
                version: 1,
                created: Utc::now(),
                changes: vec![],
                initiator: ChangeInitiator::Mutual,
                agreement_status: AgreementStatus::Agreed,
            }],
            pending_migrations: vec![],
        };

        let result = path.propose_migration(
            vec![ContractChange::MetadataUpdated { field: "description".into() }],
            ChangeInitiator::Provider("test".into()),
        );

        assert!(result.is_ok());
        assert_eq!(path.current_version(), 2);
        assert!(path.pending_migrations.is_empty());
    }

    #[test]
    fn material_changes_require_approval() {
        let mut path = EvolutionPath {
            contract_id: Uuid::new_v4(),
            versions: vec![ContractVersion {
                version: 1,
                created: Utc::now(),
                changes: vec![],
                initiator: ChangeInitiator::Mutual,
                agreement_status: AgreementStatus::Agreed,
            }],
            pending_migrations: vec![],
        };

        let result = path.propose_migration(
            vec![ContractChange::ObligationModified {
                description: "Changed obligation".into()
            }],
            ChangeInitiator::Provider("test".into()),
        );

        assert!(result.is_ok());
        assert_eq!(path.current_version(), 1); // Not yet applied
        assert_eq!(path.pending_migrations.len(), 1);
        assert_eq!(
            path.pending_migrations[0].status,
            MigrationStatus::AwaitingPlatformApproval
        );
    }
}

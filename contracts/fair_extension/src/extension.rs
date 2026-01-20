//! # Extension Contract Definition
//!
//! Defines the structure of an extension contract that meets
//! FAIR principles and Dworkinian fairness requirements.

use chrono::{DateTime, Utc};
use semver::Version;
use serde::{Deserialize, Serialize};
use url::Url;
use uuid::Uuid;

use crate::fairness::{FairnessRequirement, Reciprocity};

/// A unique, persistent identifier for an extension
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ExtensionUrn {
    pub category: ExtensionCategory,
    pub namespace: String,
    pub name: String,
    pub version: Version,
}

impl ExtensionUrn {
    pub fn new(category: ExtensionCategory, namespace: &str, name: &str, version: Version) -> Self {
        Self {
            category,
            namespace: namespace.to_string(),
            name: name.to_string(),
            version,
        }
    }

    /// Format as URN string
    pub fn to_urn(&self) -> String {
        format!(
            "urn:chrysalis:ext:{}:{}:{}:{}",
            self.category.as_str(),
            self.namespace,
            self.name,
            self.version
        )
    }
}

/// Categories of extensions
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ExtensionCategory {
    Memory,
    Ledger,
    Framework,
    Widget,
    Protocol,
    Embedding,
    Llm,
    Ide,
}

impl ExtensionCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Memory => "memory",
            Self::Ledger => "ledger",
            Self::Framework => "framework",
            Self::Widget => "widget",
            Self::Protocol => "protocol",
            Self::Embedding => "embedding",
            Self::Llm => "llm",
            Self::Ide => "ide",
        }
    }
}

/// A capability that an extension provides or requires
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Capability {
    /// Unique identifier for this capability
    pub urn: String,
    /// Human-readable name
    pub name: String,
    /// Description of what this capability enables
    pub description: String,
    /// Whether this is provided or required
    pub direction: CapabilityDirection,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CapabilityDirection {
    /// Extension provides this capability
    Provides,
    /// Extension requires this capability from the platform
    Requires,
}

/// Metadata about the extension provider
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProviderInfo {
    pub name: String,
    pub contact: String,
    pub website: Option<Url>,
    pub support_url: Option<Url>,
}

/// The complete extension contract
///
/// This structure can only be constructed through validation,
/// ensuring that all fairness requirements are met.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionContract {
    /// Unique identifier
    pub id: Uuid,
    /// URN for discovery
    pub urn: ExtensionUrn,
    /// Provider information
    pub provider: ProviderInfo,
    /// What this extension does
    pub description: String,
    /// Capabilities provided and required
    pub capabilities: Vec<Capability>,
    /// The reciprocal obligations that make this fair
    pub reciprocity: Reciprocity,
    /// Fairness requirements this contract satisfies
    pub fairness_satisfied: Vec<FairnessRequirement>,
    /// License (SPDX identifier)
    pub license: String,
    /// When this contract was created
    pub created: DateTime<Utc>,
    /// When this contract was last modified
    pub modified: DateTime<Utc>,
    /// Contract version for evolution tracking
    pub contract_version: u32,
}

impl ExtensionContract {
    /// Contracts cannot be constructed directly.
    /// Use `ContractValidator::validate()` instead.
    pub(crate) fn new_validated(
        urn: ExtensionUrn,
        provider: ProviderInfo,
        description: String,
        capabilities: Vec<Capability>,
        reciprocity: Reciprocity,
        license: String,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            urn,
            provider,
            description,
            capabilities,
            reciprocity,
            fairness_satisfied: FairnessRequirement::all(),
            license,
            created: Utc::now(),
            modified: Utc::now(),
            contract_version: 1,
        }
    }

    /// Check if this contract provides a specific capability
    pub fn provides(&self, capability_urn: &str) -> bool {
        self.capabilities.iter().any(|c| {
            c.urn == capability_urn && c.direction == CapabilityDirection::Provides
        })
    }

    /// Check if this contract requires a specific capability
    pub fn requires(&self, capability_urn: &str) -> bool {
        self.capabilities.iter().any(|c| {
            c.urn == capability_urn && c.direction == CapabilityDirection::Requires
        })
    }
}

/// A draft contract before validation
///
/// This is what providers submit. It becomes an ExtensionContract
/// only after passing fairness validation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContractDraft {
    pub urn: ExtensionUrn,
    pub provider: ProviderInfo,
    pub description: String,
    pub capabilities: Vec<Capability>,
    pub reciprocity: Reciprocity,
    pub license: String,
}

impl ContractDraft {
    pub fn new(
        urn: ExtensionUrn,
        provider: ProviderInfo,
        description: String,
    ) -> Self {
        Self {
            urn,
            provider,
            description,
            capabilities: Vec::new(),
            reciprocity: Reciprocity {
                platform_to_provider: Vec::new(),
                provider_to_platform: Vec::new(),
                provider_to_user: Vec::new(),
                user_to_provider: Vec::new(),
            },
            license: String::new(),
        }
    }

    /// Add a capability
    pub fn with_capability(mut self, capability: Capability) -> Self {
        self.capabilities.push(capability);
        self
    }

    /// Set the reciprocity structure
    pub fn with_reciprocity(mut self, reciprocity: Reciprocity) -> Self {
        self.reciprocity = reciprocity;
        self
    }

    /// Set the license
    pub fn with_license(mut self, license: &str) -> Self {
        self.license = license.to_string();
        self
    }
}

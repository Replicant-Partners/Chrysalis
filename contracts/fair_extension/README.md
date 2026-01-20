# Chrysalis FAIR Extension Contracts

A rigorous contract system implemented in Rust, grounded in Dworkinian principles: justice collapses into fairness and reciprocity between parties.

## Philosophical Foundation

This system is informed by Ronald Dworkin's work:

- **Justice for Hedgehogs** (2011): All of justice collapses into one principle—fairness and reciprocity between humans.
- **Taking Rights Seriously** (1977): If we are serious about rights, they must take priority.

See `docs/philosophy/DWORKINIAN_FOUNDATIONS.md` for the full philosophical grounding.

## Core Principle

**Fairness is a validity condition.** A contract that violates reciprocity or strips dignity is not merely discouraged—it fails validation and cannot be registered on the platform.

## Modules

### `fairness.rs`

Defines what fairness means:

- **Obligations**: What parties owe each other
- **Reciprocity**: Obligations must flow both directions
- **FairnessRequirement**: The requirements contracts must satisfy
- **FairnessViolation**: Conditions that invalidate a contract

### `extension.rs`

Defines the contract structure:

- **ExtensionUrn**: Unique identifier for extensions
- **ExtensionContract**: A validated, fair contract
- **ContractDraft**: What providers submit before validation

### `validation.rs`

The gate through which drafts become contracts:

- **ContractValidator**: Checks all fairness requirements
- **ValidationResult**: Either `Valid(ExtensionContract)` or `Invalid` with violations

### `evolution.rs`

Handles contract changes over time:

- **ContractVersion**: Tracks version history
- **Migration**: Proposed changes between versions
- **EvolutionPath**: Full history of a contract

Key principle: **Material changes require mutual agreement.** Neither party may unilaterally alter the contract's substance.

## Usage

```rust
use chrysalis_contracts::{
    ContractDraft, ContractValidator, ExtensionUrn,
    ExtensionCategory, ProviderInfo, ValidationResult,
};
use semver::Version;

// Create a draft
let urn = ExtensionUrn::new(
    ExtensionCategory::Memory,
    "myorg",
    "my-extension",
    Version::new(1, 0, 0),
);

let provider = ProviderInfo {
    name: "My Organization".into(),
    contact: "contact@myorg.com".into(),
    website: None,
    support_url: None,
};

let draft = ContractDraft::new(urn, provider, "A memory extension".into())
    .with_license("MIT")
    .with_reciprocity(/* mutual obligations */);

// Validate
let validator = ContractValidator::new();
match validator.validate(draft) {
    ValidationResult::Valid(contract) => {
        // Contract is fair and can be registered
    }
    ValidationResult::Invalid { violations, suggestions } => {
        // Contract fails fairness requirements
        for violation in violations {
            println!("Violation: {:?}", violation);
        }
        for suggestion in suggestions {
            println!("Suggestion: {}", suggestion);
        }
    }
}
```

## Fairness Requirements

Every contract must satisfy:

| Requirement | Description |
|-------------|-------------|
| **Reciprocity** | Obligations must be mutual between parties |
| **Transparency** | Terms must be clear and comprehensible |
| **Stability** | Material terms cannot be changed unilaterally |
| **ExitRight** | Parties may exit without punitive consequence |
| **DignityPreserving** | No terms that strip fundamental dignity |
| **FairDispute** | Disputes resolved through fair process |

## Why Rust?

TypeScript's type system is too permeable for rigorous contract enforcement. Rust provides:

- **Algebraic data types**: Contracts are precisely expressed as sum types
- **Traits as contracts**: Extensions must implement required interfaces
- **No escape hatches**: No `any`, no null, no undefined
- **Compile-time enforcement**: Invalid states are unrepresentable

## Building

```bash
cd contracts/fair_extension
cargo build
cargo test
```

## References

- Dworkin, Ronald. *Justice for Hedgehogs*. Harvard University Press, 2011.
- Dworkin, Ronald. *Taking Rights Seriously*. Harvard University Press, 1977.

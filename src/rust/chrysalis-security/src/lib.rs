//! Chrysalis Security
//!
//! Security-critical components for the Chrysalis system.
//!
//! This crate provides:
//! - API Key Wallet with AES-256-GCM encryption
//! - Argon2id key derivation
//! - Cost control and budget management
//! - Token counting and estimation

pub mod wallet;
pub mod cost_control;

pub use wallet::*;
pub use cost_control::*;

#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        assert_eq!(2 + 2, 4);
    }
}

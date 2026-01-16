//! Chrysalis FFI Bindings
//!
//! Node.js FFI bindings via napi-rs for Chrysalis Rust components.
//!
//! This crate exposes Rust functionality to TypeScript/JavaScript via N-API.

#![deny(clippy::all)]

use napi_derive::napi;

/// Hello World FFI test function
#[napi]
pub fn hello_world() -> String {
    "Hello from Rust via napi-rs!".to_string()
}

/// Add two numbers (FFI test)
#[napi]
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

// Module structure:
// - core: SemanticAgent parsing and validation
// - security: API Key Wallet and Cost Control
// - adapters: Protocol adapter invocation
// - sync: Experience sync operations

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hello_world() {
        assert_eq!(hello_world(), "Hello from Rust via napi-rs!");
    }

    #[test]
    fn test_add() {
        assert_eq!(add(2, 3), 5);
    }
}

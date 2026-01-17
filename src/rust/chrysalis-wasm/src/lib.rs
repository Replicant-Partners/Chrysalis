//! Chrysalis WASM Bindings
//!
//! WASM bindings for browser usage of Chrysalis components.
//!
//! This crate provides browser-compatible versions of:
//! - Agent parsing and validation
//! - Cryptographic operations (existing rust-crypto functionality)
//! - Canvas system utilities

use wasm_bindgen::prelude::*;

/// Initialize WASM module
#[wasm_bindgen(start)]
pub fn main() {
}

/// Hello World WASM test function
#[wasm_bindgen]
pub fn greet(name: &str) -> String {
    format!("Hello from Chrysalis WASM, {}!", name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_greet() {
        assert_eq!(greet("World"), "Hello from Chrysalis WASM, World!");
    }
}

//! Chrysalis System Agents Library
//!
//! High-performance Rust implementation of Chrysalis system agents with knowledge graph support.
//!
//! # Design Patterns
//!
//! This crate follows the patterns documented in `docs/DESIGN_PATTERNS.md`:
//!
//! - **Factory Pattern**: `AgentManager` creates agents from configuration
//! - **Strategy Pattern**: Multiple arbitration strategies in `agent.rs`
//! - **Adapter Pattern**: `MemoryAdapter` trait with HTTP/in-memory implementations
//! - **Circuit Breaker**: Retry logic with backoff in `gateway.rs`
//!
//! # Error Handling
//!
//! All errors use the unified `SystemAgentError` type from the `error` module.
//! Use `Result<T>` type alias for consistency.
//!
//! # Example
//!
//! ```rust,ignore
//! use chrysalis_system_agents::{agent::AgentManager, error::Result};
//!
//! async fn run() -> Result<()> {
//!     let manager = AgentManager::new("./config")?;
//!     let response = manager.chat("ada", "Hello!").await?;
//!     Ok(())
//! }
//! ```

pub mod agent;
pub mod canvas_bridge;
pub mod config;
pub mod error;
pub mod gateway;
pub mod knowledge_graph;
pub mod memory_adapter;
pub mod metrics;
pub mod models;
pub mod quality;

pub use error::{Result, SystemAgentError};

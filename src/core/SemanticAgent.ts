/**
 * SemanticAgent - Canonical Agent Type
 * 
 * This is the primary agent type for the Chrysalis system, representing
 * agents operating in semantic/meaning space with experience sync capabilities.
 * 
 * The type has been renamed from UniformSemanticAgent to align with the Rust
 * implementation (src/rust/chrysalis-core/src/agent.rs) which uses
 * `SemanticAgent` as the canonical name.
 * 
 * @see src/rust/chrysalis-core/src/agent.rs - Rust implementation
 * @version 2.0.0
 */

export interface SemanticAgent {
  id: string;
  name: string;
  version: string;
  // Add other properties as needed for type compatibility
  [key: string]: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

// Default export for compatibility
export default SemanticAgent;

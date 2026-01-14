/**
 * Chrysalis Universal Agent Bridge - Schema Validation Layer
 * 
 * Provides structural validation for external agent data using a
 * lightweight, type-safe schema validation approach. Supports both
 * compile-time type inference and runtime validation.
 * 
 * This file is a facade that re-exports from the modular validation/ directory.
 * 
 * @module bridge/validation
 * @version 1.0.0
 */

// Re-export everything from the modular validation system
export * from './validation/index';

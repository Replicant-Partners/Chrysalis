/**
 * Uniform Semantic Agent Morphing System - Main Entry Point
 * 
 * Export all core components for programmatic use.
 */

// Core types and utilities
export * from './core/UniformSemanticAgent';
export * from './core/FrameworkAdapter';
export * from './core/AdapterRegistry';
export * from './core/Encryption';

// Converter
export * from './converter/Converter';

// Adapters
export * from './adapters/universal/adapter-v2';
export * from './adapters/unified-adapter';

// Convenience re-exports
export { adapterRegistry, registerAdapter, getAdapter } from './core/AdapterRegistry';
export { Converter, createConverter } from './converter/Converter';

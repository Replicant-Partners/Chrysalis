/**
 * AgentBuilder module - Barrel exports.
 *
 * Provides a fluent Builder pattern API for constructing UniformSemanticAgentV2 instances.
 *
 * @module core/agent-builder
 */

// Core builder
export { AgentBuilder } from './builder';

// Types
export type {
  IdentityConfig,
  PersonalityConfig,
  CommunicationConfig,
  MemoryConfig,
  ExecutionConfig,
  SyncConfig,
} from './types';

// Error types
export { AgentBuilderError } from './errors';

// State management
export type { BuilderState } from './builder-state';
export { createDefaultState, initializeFromTemplate } from './builder-state';

// Factory functions
export { createAgentBuilder, quickAgent } from './factories';

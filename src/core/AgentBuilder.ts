/**
 * AgentBuilder - Fluent Builder Pattern for SemanticAgent
 *
 * Implements the Builder pattern (Gang of Four, 1994) to provide a fluent
 * interface for constructing complex agent objects step by step.
 *
 * Benefits:
 * - Prevents invalid agent states through validation
 * - Improves developer experience with fluent API
 * - Separates construction from representation
 * - Enables different agent configurations from same construction process
 *
 * @see Design Patterns: Elements of Reusable Object-Oriented Software
 *      Gamma, Helm, Johnson, Vlissides (1994), Chapter: Builder Pattern
 * @see docs/DESIGN_PATTERN_ANALYSIS.md - Section 1.1: Builder Pattern
 *
 * @module core/AgentBuilder
 *
 * This file is a facade that re-exports the modular agent-builder implementation.
 * See ./agent-builder/ for the decomposed modules.
 */

export {
  AgentBuilder,
  AgentBuilderError,
  createAgentBuilder,
  quickAgent,
} from './agent-builder';

export type {
  IdentityConfig,
  PersonalityConfig,
  CommunicationConfig,
  MemoryConfig,
  ExecutionConfig,
  SyncConfig,
  BuilderState,
} from './agent-builder';

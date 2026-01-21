/**
 * Semantic Agent Morphing System v2.0 - Main Entry Point
 *
 * Export all core components including experience sync.
 *
 * Note: SemanticAgent has been renamed to SemanticAgent to align
 * with the Rust implementation. Legacy aliases are provided for backward compatibility.
 */

// Core v2 types (now from SemanticAgent.ts)
export type {
  SemanticAgent,
  SemanticAgent, // Deprecated alias
  ValidationResult as ValidationResult,
  AgentImplementationType,
  SyncProtocol,
  InstanceMetadata,
  ExperienceSyncConfig,
  ExperienceEvent,
  ExperienceBatch,
  SyncResult,
  Skill,
  Episode,
  Concept
} from './core/SemanticAgent';

// Agent Builder (Fluent API)
export {
  AgentBuilder,
  createAgentBuilder,
  quickAgent,
  AgentBuilderError,
  type IdentityConfig,
  type PersonalityConfig,
  type CommunicationConfig,
  type MemoryConfig,
  type ExecutionConfig,
  type SyncConfig,
} from './core/AgentBuilder';

// Core v1 (for backward compatibility)
export type { SemanticAgent, Belief as BeliefV1 } from './core/SemanticAgent';
export * from './core/FrameworkAdapter';
export * from './core/AdapterRegistry';
export * from './core/Encryption';

// Converters
export * from './converter/Converter';
export * from './converter/Converter';

// Adapters - Universal
export * from './adapters/universal/adapter-v2';
export * from './adapters/unified-adapter';

// Instance Management
export * from './instance/InstanceManager';

// Experience Sync
export * from './sync/ExperienceSyncManager';
export * from './sync/StreamingSync';
export * from './sync/LumpedSync';
export * from './sync/CheckInSync';

// Experience Processing
export * from './experience/MemoryMerger';
export * from './experience/SkillAccumulator';
export * from './experience/KnowledgeIntegrator';

// Convenience re-exports
export { adapterRegistry, registerAdapter, getAdapter } from './core/AdapterRegistry';
export { Converter, createConverter } from './converter/Converter';
export { Converter, createConverter } from './converter/Converter';

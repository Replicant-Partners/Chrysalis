/**
 * Uniform Semantic Agent Morphing System v2.0 - Main Entry Point
 * 
 * Export all core components including experience sync.
 */

// Core v2 types
export type { 
  UniformSemanticAgentV2,
  ValidationResult as ValidationResultV2,
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
} from './core/UniformSemanticAgentV2';

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
export type { UniformSemanticAgent, Belief as BeliefV1 } from './core/UniformSemanticAgent';
export * from './core/FrameworkAdapter';
export * from './core/AdapterRegistry';
export * from './core/Encryption';

// Converters
export * from './converter/Converter';
export * from './converter/ConverterV2';

// Adapters - v2 Three Types
export * from './adapters/MCPAdapter';
export * from './adapters/MultiAgentAdapter';
export * from './adapters/OrchestratedAdapter';

// Adapters - v1 Legacy
export * from './adapters/ElizaOSAdapter';
export * from './adapters/CrewAIAdapter';

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
export { ConverterV2, createConverterV2 } from './converter/ConverterV2';
export { Converter, createConverter } from './converter/Converter';

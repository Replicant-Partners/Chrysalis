/**
 * Agent Components - Decomposed Agent Architecture
 * 
 * This module decomposes the monolithic UniformSemanticAgentV2 into
 * focused, single-responsibility components following SOLID principles.
 * 
 * Architecture:
 * - AgentIdentity: Immutable core identity
 * - AgentPersonality: Evolving personality traits
 * - AgentCommunication: Communication style and voice
 * - AgentCapabilities: Skills, tools, and domains
 * - AgentKnowledge: Facts, expertise, and accumulated knowledge
 * - AgentMemory: Memory architecture and storage
 * - AgentBeliefs: Belief system with conviction tracking
 * - AgentInstances: Instance management and health
 * - AgentSync: Experience synchronization
 * - AgentProtocols: Protocol configurations
 * - AgentExecution: LLM and runtime configuration
 * - AgentMetadata: Version and evolution tracking
 * 
 * @module core/agent-components
 * @version 1.0.0
 */

// Export all components
export * from './AgentIdentity';
export * from './AgentPersonality';
export * from './AgentCommunication';
export * from './AgentCapabilities';
export * from './AgentKnowledge';
export * from './AgentMemory';
export * from './AgentBeliefs';
export * from './AgentInstances';
export * from './AgentSync';
export * from './AgentProtocols';
export * from './AgentExecution';
export * from './AgentMetadata';
export * from './AgentComposer';

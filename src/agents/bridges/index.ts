/**
 * Agent Bridges Module
 *
 * Exports all agent bridge implementations and utilities.
 *
 * @module agents/bridges
 */

// Types
export * from './types';

// Base class
export { BaseBridge } from './BaseBridge';

// Implementations
export { SerenaBridge, SerenaConfig, createSerenaBridge } from './SerenaBridge';
export { DirectLLMBridge, DirectLLMConfig, createDirectLLMBridge } from './DirectLLMBridge';
export {
  ElizaOSBridge,
  ElizaOSConfig,
  ElizaCharacter,
  EvaluatorMode,
  createElizaOSBridge,
  ElizaOSFactory,
  EVALUATOR_MODES
} from './ElizaOSBridge';
export {
  ACPBridge,
  ACPBridgeConfig,
  ACPAgentType,
  createACPBridge,
  ACPBridgeFactory
} from './ACPBridge';

// Registry
export {
  AgentRegistry,
  RegistryEvent,
  RegistryEventType,
  RegistryEventHandler,
  getAgentRegistry,
  createAgentRegistry
} from './AgentRegistry';
/**
 * Chrysalis Universal Agent Bridge - Bridge Orchestrator Facade
 *
 * Facade module that re-exports the decomposed orchestrator components.
 * This maintains backward compatibility with existing imports.
 *
 * @module bridge/orchestrator
 * @version 1.0.0
 */

import { NativeAgent, AgentFramework, CanonicalAgent } from '../adapters/base-adapter';
import { AgentSnapshot } from '../rdf/temporal-store';
import {
  BridgeOrchestrator,
  TranslationRequest,
  TranslationResult,
  BatchTranslationRequest,
  BatchTranslationResult,
  OrchestratorConfig,
  BridgeHealth,
  CompatibilityEntry,
  RequestValidationError,
  RequestValidationResult,
  CacheManager,
  CacheEntry,
  CompatibilityManager,
  validateTranslationRequest,
  validateBatchTranslationRequest,
  isValidFramework
} from './orchestrator/index';

// Re-export all types and classes
export {
  TranslationRequest,
  TranslationResult,
  BatchTranslationRequest,
  BatchTranslationResult,
  OrchestratorConfig,
  BridgeHealth,
  CompatibilityEntry,
  RequestValidationError,
  RequestValidationResult,
  CacheManager,
  CacheEntry,
  CompatibilityManager,
  BridgeOrchestrator,
  validateTranslationRequest,
  validateBatchTranslationRequest,
  isValidFramework
};

// ============================================================================
// Factory & Default Instance
// ============================================================================

/**
 * Create a new bridge orchestrator
 */
export function createBridgeOrchestrator(config?: OrchestratorConfig): BridgeOrchestrator {
  return new BridgeOrchestrator(config);
}

/**
 * Default bridge orchestrator instance
 */
export const bridge = new BridgeOrchestrator();

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick translate between frameworks
 */
export async function translate(
  agent: NativeAgent,
  targetFramework: AgentFramework
): Promise<TranslationResult> {
  return bridge.translate({ agent, targetFramework });
}

/**
 * Quick store agent
 */
export async function storeAgent(agent: NativeAgent): Promise<AgentSnapshot> {
  return bridge.storeAgent(agent);
}

/**
 * Quick retrieve agent
 */
export async function getAgent(
  agentId: string,
  targetFramework?: AgentFramework
): Promise<NativeAgent | CanonicalAgent | null> {
  return bridge.getAgent(agentId, targetFramework);
}

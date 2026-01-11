/**
 * Bridge API Module
 * 
 * Exports REST API components for the Universal Agent Bridge.
 * 
 * @module api/bridge
 */

export {
  BridgeAPIController,
  createBridgeAPIServer,
  startBridgeAPIServer,
  type TranslateRequest,
  type IngestRequest,
  type BatchTranslateRequest,
  type QueryAgentsRequest,
  type TranslationResponseData,
  type BatchTranslationResponseData,
} from './controller';

// Re-export service types for convenience
export {
  IntegratedBridgeService,
  createIntegratedBridgeService,
  BridgeOrchestrator,
  TranslationResult,
  NativeAgent,
  CanonicalAgent,
  AgentFramework,
} from './controller';

/**
 * Chrysalis Adapters Module
 * 
 * Central export point for all adapter implementations, protocol types,
 * capabilities, version registry, and unified adapter interface.
 * 
 * @module adapters
 * @version 1.0.0
 */

// ============================================================================
// Protocol Types (Phase 1A - Enhanced Type System)
// ============================================================================

export {
  // Core types
  AgentFramework,
  LegacyAgentFramework,
  NewAgentFramework,
  ProtocolFamily,
  ProtocolMaturity,
  ProtocolMetadata,
  
  // Constants
  PROTOCOL_FAMILIES,
  PROTOCOL_METADATA,
  LEGACY_FRAMEWORKS,
  NEW_FRAMEWORKS,
  ALL_FRAMEWORKS,
  
  // Type guards
  isAgentFramework,
  isLegacyFramework,
  isNewFramework,
  
  // Utilities
  getProtocolFamily,
  getFrameworksByFamily,
  getCompatibilityLevel,
  
  // Default export
  default as protocolTypes
} from './protocol-types';

// ============================================================================
// Protocol Messages (Phase 1A - Universal Message Structures)
// ============================================================================

export {
  // Message envelope
  UniversalMessage,
  UniversalMessageType,
  UniversalPayload,
  
  // Agent types
  UniversalAgentRef,
  UniversalAgentCard,
  UniversalSkill,
  AuthScheme,
  OAuth2Flows,
  ContentMode,
  SkillExample,
  
  // Task types
  UniversalTaskRef,
  UniversalTaskState,
  UniversalMessagePart,
  UniversalArtifact,
  TaskStateTransition,
  
  // Tool types
  UniversalToolInvoke,
  UniversalToolDef,
  JsonSchema,
  
  // Resource types
  UniversalResourceRef,
  
  // Prompt types
  UniversalPromptRef,
  PromptArgument,
  
  // Discovery types
  UniversalDiscoveryQuery,
  UniversalDiscoveryResult,
  
  // Streaming types
  UniversalStreamChunk,
  
  // Error types
  UniversalError,
  ErrorCode,
  
  // Trace context
  TraceContext,
  
  // Factory functions
  createMessage,
  createTaskRequest,
  createToolInvoke,
  createError,
  
  // Type guards
  isTaskMessage,
  isToolMessage,
  isResourceMessage,
  isErrorMessage,
  isStreamingMessage,
  
  // Default export
  default as protocolMessages
} from './protocol-messages';

// ============================================================================
// Protocol Capabilities (Phase 1A - Capability Declarations)
// ============================================================================

export {
  // Types
  ProtocolFeature,
  CapabilityLevel,
  ProtocolCapability,
  FeatureDeclaration,
  FeatureCompatibility,
  CompatibilityResult,
  
  // Constants
  PROTOCOL_CAPABILITIES,
  
  // Query functions
  getProtocolCapability,
  supportsFeature,
  getFeatureLevel,
  getSupportedFeatures,
  getProtocolsWithFeature,
  getCommonFeatures,
  calculateFeatureOverlap,
  
  // Compatibility functions
  getFeatureCompatibility,
  getAllFeatureCompatibilities,
  calculateTranslationFidelity,
  
  // Recommendation functions
  getRecommendedProtocol,
  getProtocolCombination,
  
  // Default export
  default as protocolCapabilities
} from './protocol-capabilities';

// ============================================================================
// Protocol Registry (Phase 1A - Version Registry)
// ============================================================================

export {
  // Types
  SemanticVersion,
  ProtocolVersionInfo,
  DeprecationWarning,
  BreakingChange,
  VersionCompatibility,
  CompatibilityLevel as VersionCompatibilityLevel,
  CompatibilityIssue,
  ProtocolHealth,
  
  // Constants
  PROTOCOL_VERSION_REGISTRY,
  
  // Version utilities
  parseVersion,
  formatVersion,
  compareVersions,
  satisfiesRange,
  isSameMajor,
  incrementVersion,
  
  // Query functions
  getProtocolVersionInfo,
  getCurrentSpecVersion,
  getAdapterVersion,
  isSpecVersionSupported,
  getDeprecations,
  getBreakingChanges,
  
  // Compatibility functions
  checkVersionCompatibility,
  getMigrationPath,
  
  // Health functions
  getProtocolHealth,
  getAllProtocolHealth,
  getProtocolsByHealth,
  
  // Registry management
  registerProtocolVersion,
  getEffectiveVersionInfo,
  clearRuntimeRegistry,
  
  // Default export
  default as protocolRegistry
} from './protocol-registry';

// ============================================================================
// Adaptation Hooks (Phase 12 - Anticipatory Design Pattern Integration)
// ============================================================================

export {
  // Hook Types
  AdaptationHookType,
  HookPriority,
  HookResult,
  HookContext,
  AdaptationHookFn,
  RegisteredHook,
  HookChainResult,
  ExecutionStats,
  
  // Version Negotiation Types
  NegotiationStrategy,
  NegotiationRequest,
  NegotiationResult,
  NegotiationHistoryEntry,
  
  // Extension Types
  ExtensionPoint,
  ExtensionType,
  ExtensionHandler,
  ExtensionInput,
  ExtensionOutput,
  
  // Sensor Types
  PatternSensor,
  PatternDetectionFn,
  SensorContext,
  SensorMetrics,
  SensorHistoryEntry,
  SensorReading,
  
  // Classes
  AdaptationHookExecutor,
  VersionNegotiator,
  ExtensibilityManager,
  PatternSensorManager,
  
  // Global Instances
  hookExecutor,
  versionNegotiator,
  extensibilityManager,
  patternSensorManager,
  
  // Factory Functions
  createPreConversionHook,
  createPostConversionHook,
  createErrorHook,
  createVersionMismatchHook,
  createPatternDetectedHook,
  
  // Default export
  default as adaptationHooks
} from './adaptation-hooks';

// ============================================================================
// Unified Adapter Interface (Phase 1A - Bridge Interface)
// ============================================================================

export {
  // Types
  AdapterPattern,
  AdapterHealth,
  AdapterStatus,
  UnifiedAdapter,
  ConversionOptions,
  InvocationOptions,
  RdfBasedAdapter,
  UsaBasedAdapter,
  
  // Factory functions
  wrapRdfAdapter,
  wrapUsaAdapter,
  createUnifiedAdapter,
  
  // Registry
  adapterRegistry,
  
  // Protocol bridge
  ProtocolBridge,
  protocolBridge,
  
  // Default export
  default as unifiedAdapter
} from './unified-adapter';

// ============================================================================
// Legacy Adapters (Existing Implementations)
// ============================================================================

// Base adapter (RDF pattern foundation)
export { BaseAdapter } from './base-adapter';

// MCP Adapters (both patterns exist)
// Note: MCPAdapter uses USA pattern, mcp-adapter uses RDF pattern
export { MCPAdapter } from './MCPAdapter';
// export { MCPAdapter as MCPAdapterRdf } from './mcp-adapter'; // RDF-based, has type errors

// LangChain Adapter (RDF pattern)
// Note: Has pre-existing TypeScript errors, import may fail
// export { LangChainAdapter } from './langchain-adapter';

// CrewAI Adapter (USA pattern)
export { CrewAIAdapter } from './CrewAIAdapter';

// USA Adapter
export { USAAdapter, createUSAAdapter } from './usa-adapter';

// LMOS Adapter
// export { LMOSAdapter } from './lmos-adapter';

// ElizaOS Adapter
export { ElizaOSAdapter } from './ElizaOSAdapter';

// Multi-Agent Adapter
export { MultiAgentAdapter } from './MultiAgentAdapter';

// Orchestrated Adapter
export { OrchestratedAdapter } from './OrchestratedAdapter';

// ============================================================================
// Type Re-exports for Convenience
// ============================================================================

// Import types for re-export as aliases
import type { AgentFramework as AgentFrameworkType } from './protocol-types';
import type { UniversalMessageType as MessageTypeImport } from './protocol-messages';
import type { ProtocolFeature as FeatureImport } from './protocol-capabilities';

/**
 * Convenience type alias for any protocol identifier.
 */
export type Protocol = AgentFrameworkType;

/**
 * Convenience type alias for message types.
 */
export type MessageType = MessageTypeImport;

/**
 * Convenience type alias for feature identifiers.
 */
export type Feature = FeatureImport;

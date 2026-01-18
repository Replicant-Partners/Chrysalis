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
// Unified Adapters (Phase 15.2 - Protocol-Specific Implementations)
// ============================================================================

// Base unified adapter (abstract foundation)
export {
  BaseUnifiedAdapter,
  BaseAdapterConfig,
  OperationMetrics
} from './base-unified-adapter';

// MCP Unified Adapter
export {
  MCPUnifiedAdapter,
  MCPAdapterConfig,
  MCPTool,
  MCPToolCall,
  MCPToolResult,
  MCPContent,
  MCPResource,
  MCPPrompt,
  MCPPromptArgument,
  MCPCapabilities,
  createMCPAdapter,
  default as mcpUnifiedAdapter
} from './mcp-unified-adapter';

// A2A Unified Adapter
export {
  A2AUnifiedAdapter,
  A2AAdapterConfig,
  A2AAgentCard,
  A2ASkill,
  A2ATask,
  A2ATaskState,
  A2ATaskStatus,
  A2AMessage,
  A2APart,
  A2AArtifact,
  A2ASendTaskRequest,
  A2AContentMode,
  A2AAuthScheme,
  createA2AAdapter,
  default as a2aUnifiedAdapter
} from './a2a-unified-adapter';

// ANP Unified Adapter
export {
  ANPUnifiedAdapter,
  ANPAdapterConfig,
  ANPAgentIdentity,
  ANPEndpoint,
  ANPCapability,
  ANPMessage,
  ANPMessageType,
  ANPPayload,
  ANPTaskPayload,
  ANPTaskStatus,
  ANPContent,
  ANPCollaborationPayload,
  ANPErrorPayload,
  ANPTrustRecord,
  ANPFeedback,
  createANPAdapter,
  default as anpUnifiedAdapter
} from './anp-unified-adapter';

// ============================================================================
// Universal LLM-Powered Adapter (RECOMMENDED - Phase 2 Architecture)
// ============================================================================
//
// The Universal Adapter replaces all protocol-specific adapters by delegating
// translation logic to LLMs through structured prompts. Instead of 22 hand-coded
// adapters (~15,000 lines), we have 1 adapter (~450 lines) + mapping principles.
//
// Key insight: Map by SEMANTIC CATEGORY MEANING, not syntactic field names.
// The LLM applies mapping principles to protocol specifications dynamically.
//
// "tool" in MCP === "skill" in A2A === "function" in OpenAI === "action" in LMOS
//
// ## V2 Enhancements (RECOMMENDED)
// - Semantic category system (IDENTITY, CAPABILITIES, INSTRUCTIONS, STATE, etc.)
// - Protocol-specific semantic hints for accurate mapping
// - Agent morphing for identity-preserving transformations
// - Intelligent spec caching with TTL from registry
// - Field mapping cache with learning
// - Bidirectional round-trip verification
//
// See: docs/architecture/UNIVERSAL_ADAPTER_DESIGN.md
// See: src/adapters/universal/README.md
// ============================================================================

// V1 Adapter (basic, still supported)
export {
  UniversalAdapter,
  createUniversalAdapter,
  PROTOCOL_REGISTRY
} from './universal';

export type {
  ProtocolId,
  ProtocolSpec,
  TranslationResult,
  LLMProvider
} from './universal';

// V2 Adapter (RECOMMENDED - enhanced with semantic categories and morphing)
export {
  // Main class
  UniversalAdapter,
  createUniversalAdapter,
  createSimpleAdapter,
  
  // Types
  type LLMProvider,
  type TranslationResult,
  type MorphingResult,
  type UniversalAdapterConfig,
  
  // V2 Registry with semantic hints
  PROTOCOL_REGISTRY,
  type ProtocolEntry,
  type SemanticHints,
  getRegisteredProtocols,
  getProtocol,
  getProtocolsByTrustLevel,
  isProtocolRegistered,
  getSemanticHints,
  getSpecUrls,
  
  // Semantic Categories
  SEMANTIC_CATEGORIES,
  MAPPING_PRINCIPLES_COMPACT,
  buildTranslationPrompt,
  buildAgentMorphingPrompt
} from './universal';

// ============================================================================
// ACP (Agent Client Protocol) Adapter
// ============================================================================
//
// ACP is the open standard for code editor ↔ AI agent communication.
// Supports connecting to: Claude Code, OpenCode, Gemini, Codex, etc.
// Also allows exposing Chrysalis as an ACP agent for VS Code, Zed, Emacs.
//
// See: https://agentclientprotocol.com
// See: docs/research/ACP_PROTOCOL_MULTI_AGENT_SYNTHESIS.md
// ============================================================================

export {
  // Client (connect to ACP agents)
  ACPClient,
  ACPMultiClient,
  ACPAgentFactory,
  createACPClient,

  // Server (expose as ACP agent)
  ACPServer,
  createACPServer,

  // Types
  type ACPMessage,
  type ACPRequest,
  type ACPResponse,
  type ACPNotification,
  type ACPCapabilities,
  type ACPAgentInfo,
  type ACPConnectionConfig,
  type ACPConnectionState,
  type ACPServerConfig,
  type SessionNotification,
  type ACPToolCall,
  type ACPToolDefinition,
  type ACPContext,
  type ACPAttachment,
  type PromptRequest,
  type PromptResponse,
  ACPErrorCodes,
} from './acp';

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

/**
 * Universal Adapter Type Definitions
 *
 * Core types for the LLM-powered universal protocol adapter.
 *
 * @module adapters/universal/types
 * @version 1.0.0
 */

// ============================================================================
// Protocol Identification
// ============================================================================

/**
 * Protocol identifier - string key for registered protocols
 */
export type ProtocolId =
  | 'usa'       // Chrysalis Uniform Semantic Agent (internal)
  | 'mcp'       // Anthropic Model Context Protocol
  | 'a2a'       // Google Agent-to-Agent Protocol
  | 'anp'       // Agent Network Protocol
  | 'lmos'      // Eclipse LMOS
  | 'langchain' // LangChain Agent
  | 'crewai'    // CrewAI Agent
  | 'openai'    // OpenAI Function Calling
  | 'autogen'   // Microsoft AutoGen
  | string;     // Allow custom protocols

/**
 * Trust level for protocol specifications
 */
export type TrustLevel = 'internal' | 'verified' | 'experimental' | 'community';

/**
 * Semantic version
 */
export interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
}

// ============================================================================
// Agent Representation
// ============================================================================

/**
 * Generic agent representation - protocol-agnostic structure
 */
export interface AgentRepresentation {
  /** Raw data in protocol-specific format */
  data: Record<string, unknown>;

  /** Protocol this representation conforms to */
  protocol: ProtocolId;

  /** Schema version (if known) */
  schemaVersion?: string;

  /** Source information */
  source?: {
    url?: string;
    timestamp?: Date;
  };
}

// ============================================================================
// Protocol Specification
// ============================================================================

/**
 * JSON Schema definition (subset of JSON Schema spec)
 */
export interface JsonSchema {
  $schema?: string;
  $id?: string;
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  items?: JsonSchema | JsonSchema[];
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  allOf?: JsonSchema[];
  $ref?: string;
  definitions?: Record<string, JsonSchema>;
  $defs?: Record<string, JsonSchema>;
  description?: string;
  title?: string;
  default?: unknown;
  enum?: unknown[];
  const?: unknown;
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  [key: string]: unknown;
}

/**
 * OpenAPI specification (simplified)
 */
export interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths?: Record<string, unknown>;
  components?: {
    schemas?: Record<string, JsonSchema>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * AsyncAPI specification (simplified)
 */
export interface AsyncApiSpec {
  asyncapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  channels?: Record<string, unknown>;
  components?: {
    schemas?: Record<string, JsonSchema>;
    messages?: Record<string, unknown>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Protocol schema - can be JSON Schema, OpenAPI, or AsyncAPI
 */
export type ProtocolSchema = JsonSchema | OpenApiSpec | AsyncApiSpec;

/**
 * Protocol specification
 */
export interface ProtocolSpec {
  /** Protocol identifier */
  id: ProtocolId;

  /** Human-readable name */
  name: string;

  /** Specification URL */
  specUrl: string;

  /** Parsed specification schema */
  schema: ProtocolSchema;

  /** Schema version */
  version: SemanticVersion;

  /** Trust level */
  trustLevel: TrustLevel;

  /** Last fetched timestamp */
  lastFetched: Date;

  /** Cache TTL in seconds */
  cacheTtl: number;

  /** Optional documentation URL */
  docsUrl?: string;

  /** Optional example agent */
  exampleAgent?: Record<string, unknown>;
}

/**
 * Protocol info (public summary)
 */
export interface ProtocolInfo {
  id: ProtocolId;
  name: string;
  version: SemanticVersion;
  trustLevel: TrustLevel;
  docsUrl?: string;
}

// ============================================================================
// Translation Types
// ============================================================================

/**
 * Field mapping between protocols
 */
export interface FieldMapping {
  /** Source field path (dot notation) */
  source: string;

  /** Target field path (dot notation) */
  target: string;

  /** Confidence in this mapping (0.0 - 1.0) */
  confidence: number;

  /** Transform required (if any) */
  transform?: 'none' | 'rename' | 'type_coerce' | 'restructure' | 'custom';

  /** Custom transform function (serialized) */
  customTransform?: string;

  /** Notes about this mapping */
  notes?: string;
}

/**
 * Translation options
 */
export interface TranslationOptions {
  /** Strict mode - fail on unmappable fields */
  strict?: boolean;

  /** Include confidence scores in result */
  includeConfidence?: boolean;

  /** Allow lossy translation (some data may be lost) */
  allowLossy?: boolean;

  /** Custom field mappings (overrides learned mappings) */
  fieldOverrides?: FieldMapping[];

  /** Maximum LLM reasoning steps */
  maxReasoningSteps?: number;

  /** Request reasoning trace */
  includeReasoningTrace?: boolean;

  /** Timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * Translation warning
 */
export interface TranslationWarning {
  /** Warning code */
  code: string;

  /** Warning message */
  message: string;

  /** Severity level */
  severity: 'info' | 'warning' | 'error';

  /** Affected field path (if applicable) */
  fieldPath?: string;

  /** Suggestion for resolution */
  suggestion?: string;
}

/**
 * LLM reasoning step
 */
export interface ReasoningStep {
  /** Step number */
  step: number;

  /** Description of reasoning */
  description: string;

  /** Fields considered */
  fields: string[];

  /** Decision made */
  decision: string;

  /** Confidence */
  confidence: number;
}

/**
 * Translation result
 */
export interface TranslationResult {
  /** Translated agent representation */
  result: AgentRepresentation;

  /** Translation fidelity score (0.0 - 1.0) */
  fidelity: number;

  /** LLM confidence score (0.0 - 1.0) */
  confidence: number;

  /** Successfully mapped fields */
  mappedFields: string[];

  /** Fields stored in extensions (not directly mappable) */
  extensionFields: string[];

  /** Fields that were lost in translation */
  lostFields: string[];

  /** Translation warnings */
  warnings: TranslationWarning[];

  /** Field mappings used */
  fieldMappings: FieldMapping[];

  /** LLM reasoning trace (if requested) */
  reasoningTrace?: ReasoningStep[];

  /** Translation duration in milliseconds */
  durationMs: number;

  /** Timestamp */
  timestamp: Date;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Validation error
 */
export interface ValidationError {
  /** Error code */
  code: string;

  /** Error message */
  message: string;

  /** Path to invalid field */
  path: string;

  /** Expected value/type */
  expected?: string;

  /** Actual value/type */
  actual?: string;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /** Warning code */
  code: string;

  /** Warning message */
  message: string;

  /** Path to field */
  path: string;

  /** Suggestion */
  suggestion?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;

  /** Validation errors */
  errors: ValidationError[];

  /** Validation warnings */
  warnings: ValidationWarning[];

  /** Schema used for validation */
  schemaVersion?: string;
}

// ============================================================================
// Protocol Capabilities
// ============================================================================

/**
 * Protocol feature
 */
export type ProtocolFeature =
  | 'tools'
  | 'memory'
  | 'streaming'
  | 'multi_turn'
  | 'async_tasks'
  | 'artifacts'
  | 'resources'
  | 'prompts'
  | 'discovery'
  | 'authentication'
  | 'push_notifications'
  | 'collaboration';

/**
 * Feature support level
 */
export type FeatureLevel = 'native' | 'partial' | 'emulated' | 'unsupported';

/**
 * Protocol capabilities
 */
export interface ProtocolCapabilities {
  /** Protocol identifier */
  protocol: ProtocolId;

  /** Feature support map */
  features: Map<ProtocolFeature, FeatureLevel>;

  /** Maximum message size (bytes) */
  maxMessageSize?: number;

  /** Supported content types */
  contentTypes?: string[];

  /** Authentication methods supported */
  authMethods?: string[];

  /** Additional capabilities */
  extensions?: Record<string, unknown>;
}

// ============================================================================
// Registry Types
// ============================================================================

/**
 * Protocol registration options
 */
export interface RegistrationOptions {
  /** Override existing registration */
  overwrite?: boolean;

  /** Trust level (default: experimental) */
  trustLevel?: TrustLevel;

  /** Cache TTL in seconds (default: 43200 = 12 hours) */
  cacheTtl?: number;

  /** Documentation URL */
  docsUrl?: string;

  /** Example agent JSON */
  exampleAgent?: Record<string, unknown>;
}

// ============================================================================
// LLM Types
// ============================================================================

/**
 * LLM provider interface
 */
export interface LLMProvider {
  /** Provider name */
  name: string;

  /** Complete a prompt */
  complete(prompt: string, options: LLMCompletionOptions): Promise<LLMResponse>;

  /** Check if provider is available */
  isAvailable(): Promise<boolean>;
}

/**
 * LLM completion options
 */
export interface LLMCompletionOptions {
  /** Maximum tokens to generate */
  maxTokens?: number;

  /** Temperature (0.0 - 2.0) */
  temperature?: number;

  /** Response format */
  responseFormat?: 'text' | 'json';

  /** Stop sequences */
  stopSequences?: string[];

  /** System prompt */
  systemPrompt?: string;

  /** Timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * LLM response
 */
export interface LLMResponse {
  /** Generated content */
  content: string;

  /** Parsed JSON (if responseFormat is 'json') */
  json?: Record<string, unknown>;

  /** Confidence score (if available) */
  confidence?: number;

  /** Token usage */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };

  /** Model used */
  model?: string;
}

// ============================================================================
// Cache Types
// ============================================================================

/**
 * Cached mapping key
 */
export interface CacheKey {
  sourceProtocol: ProtocolId;
  targetProtocol: ProtocolId;
  sourceVersion?: string;
  targetVersion?: string;
}

/**
 * Cached mapping entry
 */
export interface CachedMappings {
  /** Cache key */
  key: CacheKey;

  /** Field mappings */
  mappings: FieldMapping[];

  /** Cache timestamp */
  cachedAt: Date;

  /** Cache expiry */
  expiresAt: Date;

  /** Number of successful uses */
  useCount: number;

  /** Average fidelity achieved */
  avgFidelity: number;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  // Re-export for convenience
};

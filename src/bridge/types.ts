/**
 * Chrysalis Universal Agent Bridge - Shared Type Definitions
 * 
 * Provides strongly-typed interfaces and generics for the bridge system.
 * Eliminates 'any' types with proper union types, branded types, and generics.
 * 
 * @module bridge/types
 * @version 1.0.0
 */

// ============================================================================
// Branded Types for Type Safety
// ============================================================================

/**
 * Create a branded type for nominal typing
 */
declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

/**
 * URI string type for RDF URIs
 */
export type URI = Brand<string, 'URI'>;

/**
 * Create a typed URI
 */
export function uri(value: string): URI {
  return value as URI;
}

/**
 * ISO 8601 timestamp string
 */
export type ISOTimestamp = Brand<string, 'ISOTimestamp'>;

/**
 * Create a typed ISO timestamp
 */
export function isoTimestamp(date: Date): ISOTimestamp {
  return date.toISOString() as ISOTimestamp;
}

/**
 * Validate and create ISO timestamp from string
 */
export function parseISOTimestamp(value: string): ISOTimestamp | null {
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  return value as ISOTimestamp;
}

/**
 * Agent identifier
 */
export type AgentId = Brand<string, 'AgentId'>;

/**
 * Create an agent ID
 */
export function agentId(value: string): AgentId {
  return value as AgentId;
}

/**
 * Correlation ID for tracing
 */
export type CorrelationId = Brand<string, 'CorrelationId'>;

/**
 * Create a correlation ID
 */
export function correlationId(value: string): CorrelationId {
  return value as CorrelationId;
}

/**
 * Generate a new correlation ID
 */
export function generateCorrelationId(): CorrelationId {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `brg-${timestamp}-${random}` as CorrelationId;
}

// ============================================================================
// Agent Framework Types
// ============================================================================

/**
 * Supported agent frameworks
 */
export const AgentFrameworks = [
  'usa',      // Chrysalis Uniform Semantic Agent
  'lmos',     // Eclipse LMOS Protocol
  'mcp',      // Model Context Protocol
  'langchain', // LangChain Agent
  'openai',   // OpenAI Function Calling
  'autogpt',  // AutoGPT Specification
  'semantic-kernel', // Microsoft Semantic Kernel
  'crewai',   // CrewAI
  'agent-protocol', // AI Engineer Foundation Agent Protocol
] as const;

export type AgentFramework = typeof AgentFrameworks[number];

/**
 * Type guard for agent framework
 */
export function isAgentFramework(value: unknown): value is AgentFramework {
  return typeof value === 'string' && AgentFrameworks.includes(value as AgentFramework);
}

// ============================================================================
// RDF Types
// ============================================================================

/**
 * RDF term types
 */
export type TermType = 'NamedNode' | 'BlankNode' | 'Literal' | 'Variable' | 'DefaultGraph';

/**
 * Base RDF term interface
 */
export interface Term {
  readonly termType: TermType;
  readonly value: string;
  equals(other: Term | null | undefined): boolean;
}

/**
 * Named node (URI reference)
 */
export interface NamedNode extends Term {
  readonly termType: 'NamedNode';
}

/**
 * Blank node (anonymous resource)
 */
export interface BlankNode extends Term {
  readonly termType: 'BlankNode';
}

/**
 * Literal value
 */
export interface Literal extends Term {
  readonly termType: 'Literal';
  readonly language: string;
  readonly datatype: NamedNode;
}

/**
 * Variable (for queries)
 */
export interface Variable extends Term {
  readonly termType: 'Variable';
}

/**
 * Default graph
 */
export interface DefaultGraph extends Term {
  readonly termType: 'DefaultGraph';
  readonly value: '';
}

/**
 * Quad subject types
 */
export type Subject = NamedNode | BlankNode;

/**
 * Quad predicate type
 */
export type Predicate = NamedNode;

/**
 * Quad object types
 */
export type QuadObject = NamedNode | BlankNode | Literal;

/**
 * Quad graph types
 */
export type Graph = NamedNode | BlankNode | DefaultGraph;

/**
 * RDF Quad (triple with graph)
 */
export interface Quad {
  readonly subject: Subject;
  readonly predicate: Predicate;
  readonly object: QuadObject;
  readonly graph: Graph;
}

// ============================================================================
// Native Agent Types
// ============================================================================

/**
 * Generic native agent representation
 */
export interface NativeAgent<TData extends AgentData = AgentData> {
  /** Agent specification data */
  data: TData;
  /** Source framework identifier */
  framework: AgentFramework;
  /** Framework version */
  version?: string;
  /** Source URI or identifier */
  source?: string;
}

/**
 * Base agent data constraint
 */
export type AgentData = Record<string, unknown>;

/**
 * USA Agent data type
 */
export interface USAAgentData extends AgentData {
  apiVersion: string;
  kind: 'Agent';
  metadata: {
    name: string;
    version?: string;
    description?: string;
    author?: string;
    tags?: string[];
  };
  identity: {
    role: string;
    goal: string;
    backstory?: string;
    personality_traits?: Record<string, string | number | boolean>;
    constraints?: string[];
  };
  capabilities: {
    tools?: Array<{
      name: string;
      protocol?: string;
      config?: Record<string, unknown>;
      description?: string;
    }>;
    reasoning?: {
      strategy: string;
      max_iterations?: number;
      allow_backtracking?: boolean;
    };
    memory?: {
      architecture: string;
      working?: { enabled: boolean; max_tokens?: number };
      episodic?: { enabled: boolean; storage?: string };
      semantic?: { enabled: boolean; storage?: string };
      procedural?: { enabled: boolean };
      core?: { enabled: boolean; blocks?: Array<{ name: string; content: string }> };
    };
  };
  execution: {
    llm: {
      provider: string;
      model: string;
      temperature?: number;
      max_tokens?: number;
    };
    runtime?: {
      timeout?: number;
      max_iterations?: number;
    };
  };
  protocols?: {
    mcp?: { enabled: boolean; role?: string };
    a2a?: { enabled: boolean };
    agent_protocol?: { enabled: boolean; endpoint?: string };
  };
}

/**
 * LMOS Agent data type (W3C WoT Thing Description based)
 */
export interface LMOSAgentData extends AgentData {
  '@context': string | string[] | Record<string, unknown>;
  '@type'?: string | string[];
  id: string;
  title: string;
  description?: string;
  version?: { instance?: string; model?: string };
  securityDefinitions?: Record<string, {
    scheme: string;
    description?: string;
    pubKeyPem?: string;
  }>;
  security?: string | string[];
  properties?: Record<string, {
    type?: string;
    title?: string;
    description?: string;
    observable?: boolean;
  }>;
  actions?: Record<string, {
    title?: string;
    description?: string;
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    forms?: Array<{ href: string; contentType?: string }>;
  }>;
  events?: Record<string, {
    title?: string;
    description?: string;
    data?: Record<string, unknown>;
  }>;
  forms?: Array<{
    href: string;
    contentType?: string;
    subprotocol?: string;
    op?: string | string[];
  }>;
  'lmos:agentClass'?: string;
  'lmos:capabilities'?: string[];
  'lmos:llmConfig'?: {
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  };
  'lmos:memory'?: {
    type: string;
    vectorStore?: { provider: string; config?: Record<string, unknown> };
    contextWindow?: number;
  };
  'lmos:protocols'?: {
    mcp?: boolean;
    a2a?: boolean;
    http?: boolean;
    websocket?: boolean;
  };
}

/**
 * MCP Agent data type
 */
export interface MCPAgentData extends AgentData {
  name: string;
  version: string;
  description?: string;
  tools?: Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }>;
  resources?: Array<{
    uri: string;
    name: string;
    description?: string;
    mimeType?: string;
  }>;
  prompts?: Array<{
    name: string;
    description?: string;
    arguments?: Array<{
      name: string;
      description?: string;
      required?: boolean;
    }>;
  }>;
}

/**
 * Type-safe native agent for specific frameworks
 */
export type TypedNativeAgent<F extends AgentFramework> = 
  F extends 'usa' ? NativeAgent<USAAgentData> :
  F extends 'lmos' ? NativeAgent<LMOSAgentData> :
  F extends 'mcp' ? NativeAgent<MCPAgentData> :
  NativeAgent<AgentData>;

// ============================================================================
// Canonical Agent Types
// ============================================================================

/**
 * Extension property for framework-specific data
 */
export interface ExtensionProperty {
  /** Extension namespace */
  namespace: string;
  /** Property name */
  property: string;
  /** Serialized value (JSON string) */
  value: string;
  /** Original source path */
  originalPath?: string;
}

/**
 * Translation warning during conversion
 */
export interface TranslationWarning {
  /** Warning severity */
  severity: 'info' | 'warning' | 'error';
  /** Warning code */
  code: string;
  /** Human-readable message */
  message: string;
  /** Source field path */
  sourcePath?: string;
  /** Target field path */
  targetPath?: string;
}

/**
 * Translation metadata
 */
export interface TranslationMetadata {
  /** Time taken to translate (ms) */
  translationTimeMs: number;
  /** Fields successfully mapped */
  mappedFields: string[];
  /** Fields that couldn't be mapped */
  unmappedFields: string[];
  /** Fields that lost information */
  lostFields: string[];
  /** Translation warnings */
  warnings: TranslationWarning[];
  /** Fidelity score (0-1) */
  fidelityScore: number;
  /** Adapter version */
  adapterVersion?: string;
  /** Translation timestamp */
  translatedAt: ISOTimestamp;
}

/**
 * Canonical (RDF-based) agent representation
 */
export interface CanonicalAgent {
  /** Agent URI */
  uri: URI;
  /** RDF quads representing the agent */
  quads: Quad[];
  /** Source framework */
  sourceFramework: AgentFramework;
  /** Framework-specific extensions */
  extensions: ExtensionProperty[];
  /** Translation metadata */
  metadata: TranslationMetadata;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Validation error detail
 */
export interface ValidationErrorDetail {
  /** Field path */
  path: string;
  /** Error code */
  code: string;
  /** Human-readable message */
  message: string;
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
  /** Human-readable message */
  message: string;
  /** Field path */
  path?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors */
  errors: ValidationErrorDetail[];
  /** Validation warnings */
  warnings: ValidationWarning[];
}

// ============================================================================
// Translation Types
// ============================================================================

/**
 * Translation request
 */
export interface TranslationRequest<F extends AgentFramework = AgentFramework> {
  /** Agent to translate */
  agent: TypedNativeAgent<F>;
  /** Target framework */
  targetFramework: AgentFramework;
  /** Request options */
  options?: TranslationOptions;
}

/**
 * Translation options
 */
export interface TranslationOptions {
  /** Whether to validate before translation */
  validate?: boolean;
  /** Whether to include extensions */
  includeExtensions?: boolean;
  /** Whether to track provenance */
  trackProvenance?: boolean;
  /** Whether to cache the result */
  cacheResult?: boolean;
  /** Correlation ID for tracing */
  correlationId?: CorrelationId;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Translation result
 */
export interface TranslationResult<F extends AgentFramework = AgentFramework> {
  /** Whether translation succeeded */
  success: boolean;
  /** Translated agent (if successful) */
  agent?: TypedNativeAgent<F>;
  /** Canonical representation */
  canonical?: CanonicalAgent;
  /** Errors (if failed) */
  errors?: string[];
  /** Translation metadata */
  metadata: TranslationResultMetadata;
}

/**
 * Translation result metadata
 */
export interface TranslationResultMetadata {
  /** Source framework */
  sourceFramework: AgentFramework;
  /** Target framework */
  targetFramework: AgentFramework;
  /** Translation time (ms) */
  translationTimeMs: number;
  /** Fidelity score */
  fidelityScore: number;
  /** Correlation ID */
  correlationId?: CorrelationId;
  /** Whether result was from cache */
  fromCache?: boolean;
}

// ============================================================================
// Temporal Types
// ============================================================================

/**
 * Temporal instant (point in time)
 */
export interface TemporalInstant {
  /** Timestamp */
  timestamp: Date;
  /** ISO string representation */
  iso: ISOTimestamp;
}

/**
 * Temporal interval
 */
export interface TemporalInterval {
  /** Start instant */
  start: TemporalInstant;
  /** End instant (null for ongoing) */
  end: TemporalInstant | null;
}

/**
 * Bi-temporal coordinates
 */
export interface BiTemporalCoordinates {
  /** Valid time (when fact is true in reality) */
  validTime: TemporalInterval;
  /** Transaction time (when recorded in system) */
  transactionTime: TemporalInterval;
}

/**
 * Temporal query options
 */
export interface TemporalQueryOptions {
  /** Query as of this transaction time */
  asOf?: Date;
  /** Query for valid time range */
  validAt?: Date;
  /** Query for valid time range */
  validFrom?: Date;
  /** Query for valid time range */
  validTo?: Date;
  /** Include historical versions */
  includeHistory?: boolean;
}

// ============================================================================
// Snapshot Types
// ============================================================================

/**
 * Agent snapshot (versioned state)
 */
export interface AgentSnapshot {
  /** Snapshot ID */
  id: string;
  /** Agent ID */
  agentId: AgentId;
  /** Graph URI for RDF data */
  graphUri: URI;
  /** RDF quads */
  quads: Quad[];
  /** Valid time start */
  validFrom: Date;
  /** Valid time end (null for current) */
  validTo: Date | null;
  /** Transaction time when recorded */
  recordedAt: Date;
  /** Source format */
  sourceFormat?: AgentFramework;
  /** Fidelity score */
  fidelityScore?: number;
  /** Supersedes previous snapshot ID */
  supersedes?: string;
}

// ============================================================================
// Field Mapping Types
// ============================================================================

/**
 * Field mapping definition
 */
export interface FieldMapping {
  /** Source path in native agent */
  sourcePath: string;
  /** RDF predicate URI */
  predicate: string;
  /** Data type */
  datatype: 'string' | 'integer' | 'float' | 'boolean' | 'date' | 'json' | 'uri';
  /** Whether field is required */
  required: boolean;
  /** Default value */
  defaultValue?: unknown;
  /** Transform function name */
  transform?: string;
}

// ============================================================================
// Adapter Types
// ============================================================================

/**
 * Adapter configuration
 */
export interface AdapterConfig {
  /** Adapter identifier */
  id?: string;
  /** Enable strict validation */
  strictValidation?: boolean;
  /** Include provenance triples */
  includeProvenance?: boolean;
  /** Custom namespace mappings */
  namespaces?: Record<string, string>;
  /** Extension handling mode */
  extensionMode?: 'preserve' | 'drop' | 'transform';
}

/**
 * Adapter interface
 */
export interface IAdapter<
  TData extends AgentData = AgentData,
  F extends AgentFramework = AgentFramework
> {
  /** Framework identifier */
  readonly framework: F;
  /** Adapter name */
  readonly name: string;
  /** Adapter version */
  readonly version: string;
  /** Extension namespace URI */
  readonly extensionNamespace: string;

  /** Convert native agent to canonical form */
  toCanonical(native: NativeAgent<TData>): Promise<CanonicalAgent>;
  
  /** Convert canonical form to native agent */
  fromCanonical(canonical: CanonicalAgent): Promise<NativeAgent<TData>>;
  
  /** Validate native agent */
  validateNative(native: NativeAgent<TData>): ValidationResult;
  
  /** Get field mappings */
  getFieldMappings(): FieldMapping[];
}

// ============================================================================
// Service Types
// ============================================================================

/**
 * Discovery query parameters
 */
export interface DiscoveryQuery {
  /** Filter by framework */
  framework?: AgentFramework | AgentFramework[];
  /** Filter by name pattern */
  namePattern?: string | RegExp;
  /** Filter by capability */
  hasCapability?: string | string[];
  /** Filter by protocol support */
  supportsProtocol?: string | string[];
  /** Temporal query options */
  temporal?: TemporalQueryOptions;
  /** Pagination limit */
  limit?: number;
  /** Pagination offset */
  offset?: number;
}

/**
 * Discovery result
 */
export interface DiscoveryResult {
  /** Found agents */
  agents: AgentSummary[];
  /** Total count (before pagination) */
  total: number;
  /** Whether more results exist */
  hasMore: boolean;
}

/**
 * Agent summary for discovery
 */
export interface AgentSummary {
  /** Agent ID */
  id: AgentId;
  /** Agent name */
  name: string;
  /** Source framework */
  framework: AgentFramework;
  /** Agent description */
  description?: string;
  /** Supported protocols */
  protocols?: string[];
  /** Last modified date */
  lastModified: Date;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Bridge event types
 */
export type BridgeEventType =
  | 'agent:registered'
  | 'agent:updated'
  | 'agent:deleted'
  | 'translation:started'
  | 'translation:completed'
  | 'translation:failed'
  | 'validation:failed'
  | 'cache:hit'
  | 'cache:miss'
  | 'cache:evicted'
  | 'error:occurred';

/**
 * Base bridge event
 */
export interface BridgeEvent<T extends BridgeEventType = BridgeEventType> {
  /** Event type */
  type: T;
  /** Event timestamp */
  timestamp: Date;
  /** Correlation ID */
  correlationId?: CorrelationId;
  /** Event data */
  data: BridgeEventData<T>;
}

/**
 * Event data by type
 */
export type BridgeEventData<T extends BridgeEventType> =
  T extends 'agent:registered' | 'agent:updated' | 'agent:deleted' ? AgentEventData :
  T extends 'translation:started' | 'translation:completed' | 'translation:failed' ? TranslationEventData :
  T extends 'validation:failed' ? ValidationEventData :
  T extends 'cache:hit' | 'cache:miss' | 'cache:evicted' ? CacheEventData :
  T extends 'error:occurred' ? ErrorEventData :
  Record<string, unknown>;

export interface AgentEventData {
  agentId: AgentId;
  framework: AgentFramework;
  agentUri?: URI;
}

export interface TranslationEventData {
  agentId?: AgentId;
  sourceFramework: AgentFramework;
  targetFramework: AgentFramework;
  durationMs?: number;
  success?: boolean;
  error?: string;
}

export interface ValidationEventData {
  agentId?: AgentId;
  framework: AgentFramework;
  errors: ValidationErrorDetail[];
}

export interface CacheEventData {
  key: string;
  framework?: AgentFramework;
}

export interface ErrorEventData {
  code: string;
  message: string;
  component: string;
  stack?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Deep partial type
 */
export type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>;
} : T;

/**
 * Deep readonly type
 */
export type DeepReadonly<T> = T extends (infer R)[] ? ReadonlyArray<DeepReadonly<R>> :
  T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } :
  T;

/**
 * Required keys of a type
 */
export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K
}[keyof T];

/**
 * Optional keys of a type
 */
export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never
}[keyof T];

/**
 * Make specific keys required
 */
export type WithRequired<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Make specific keys optional
 */
export type WithOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Non-nullable type
 */
export type NonNullableProps<T> = {
  [K in keyof T]: NonNullable<T[K]>;
};

/**
 * Extract value type from record
 */
export type ValueOf<T> = T[keyof T];

/**
 * Type guard result type
 */
export type TypeGuard<T> = (value: unknown) => value is T;

// ============================================================================
// JSON Types (for schema validation)
// ============================================================================

/**
 * JSON primitive types
 */
export type JsonPrimitive = string | number | boolean | null;

/**
 * JSON array type
 */
export type JsonArray = JsonValue[];

/**
 * JSON object type
 */
export type JsonObject = { [key: string]: JsonValue };

/**
 * JSON value type
 */
export type JsonValue = JsonPrimitive | JsonArray | JsonObject;

/**
 * Type guard for JSON value
 */
export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean') return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (type === 'object') {
    return Object.values(value as object).every(isJsonValue);
  }
  return false;
}

/**
 * Type guard for JSON object
 */
export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ============================================================================
// Disposable Types
// ============================================================================

/**
 * Async disposable interface
 */
export interface AsyncDisposable {
  [Symbol.asyncDispose](): Promise<void>;
}

/**
 * Disposable interface
 */
export interface Disposable {
  [Symbol.dispose](): void;
}

/**
 * Resource with disposal
 */
export interface DisposableResource<T> extends AsyncDisposable {
  readonly value: T;
  readonly disposed: boolean;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for NativeAgent
 */
export function isNativeAgent(value: unknown): value is NativeAgent {
  if (!isJsonObject(value)) return false;
  return (
    'data' in value &&
    'framework' in value &&
    isJsonObject(value.data) &&
    isAgentFramework(value.framework)
  );
}

/**
 * Type guard for CanonicalAgent
 */
export function isCanonicalAgent(value: unknown): value is CanonicalAgent {
  if (!isJsonObject(value)) return false;
  return (
    'uri' in value &&
    'quads' in value &&
    'sourceFramework' in value &&
    'extensions' in value &&
    'metadata' in value &&
    typeof value.uri === 'string' &&
    Array.isArray(value.quads) &&
    isAgentFramework(value.sourceFramework)
  );
}

/**
 * Type guard for ValidationResult
 */
export function isValidationResult(value: unknown): value is ValidationResult {
  if (!isJsonObject(value)) return false;
  return (
    'valid' in value &&
    'errors' in value &&
    'warnings' in value &&
    typeof value.valid === 'boolean' &&
    Array.isArray(value.errors) &&
    Array.isArray(value.warnings)
  );
}

/**
 * Type guard for Quad
 */
export function isQuad(value: unknown): value is Quad {
  if (!isJsonObject(value)) return false;
  return (
    'subject' in value &&
    'predicate' in value &&
    'object' in value &&
    'graph' in value
  );
}

/**
 * Type guard for Term
 */
export function isTerm(value: unknown): value is Term {
  if (!isJsonObject(value)) return false;
  return (
    'termType' in value &&
    'value' in value &&
    typeof value.termType === 'string' &&
    typeof value.value === 'string'
  );
}

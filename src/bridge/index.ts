/**
 * Chrysalis Universal Agent Bridge - Core Exports
 * 
 * This module exports all core bridge infrastructure including:
 * - Error types and error handling
 * - Type definitions and branded types
 * - Schema validation
 * - Dependency injection container
 * - Logging interface
 * - Resource lifecycle management
 * - Guard utilities
 * 
 * @module bridge
 * @version 1.0.0
 */

// ============================================================================
// Error Types
// ============================================================================

export {
  // Error codes
  ErrorCode,
  
  // Base error class
  BridgeError,
  
  // Specialized errors
  ValidationError,
  SchemaValidationError,
  RequiredFieldError,
  TypeMismatchError,
  TranslationError,
  AdapterNotFoundError,
  UnsupportedFrameworkError,
  StorageError,
  SnapshotNotFoundError,
  GraphNotFoundError,
  QueryError,
  ConfigurationError,
  DependencyError,
  TimeoutError,
  AbortError,
  DisposedError,
  TemporalConflictError,
  InvalidTimeRangeError,
  ResourceExhaustedError,
  SerializationError,
  DeserializationError,
  RDFError,
  AggregateError,
  
  // Error utilities
  isBridgeError,
  hasErrorCode,
  wrapError,
  createCorrelationId,
  
  // Result type from errors (different signature than types.ts)
  ok,
  err,
  isOk,
  isErr,
  unwrap,
  unwrapOr,
  
  // Types
  type ErrorContext,
  type SerializedError,
  type ErrorCodeType,
  type ValidationErrorDetail,
  type Result,
} from './errors';

// ============================================================================
// Type Definitions
// ============================================================================

export {
  // Branded types
  type URI,
  type ISOTimestamp,
  type AgentId,
  type CorrelationId,
  
  // Factory functions
  uri,
  isoTimestamp,
  agentId,
  generateCorrelationId,
  parseISOTimestamp,
  correlationId,
  
  // Agent framework types
  AgentFrameworks,
  type AgentFramework,
  isAgentFramework,
  
  // Agent data types
  type USAAgentData,
  type LMOSAgentData,
  type MCPAgentData,
  type AgentData,
  
  // Generic agent interfaces
  type NativeAgent,
  type CanonicalAgent,
  type TypedNativeAgent,
  
  // Type guards
  isNativeAgent,
  isCanonicalAgent,
  isValidationResult,
  isQuad,
  isTerm,
  isJsonValue,
  isJsonObject,
  
  // RDF Types
  type TermType,
  type Term,
  type NamedNode,
  type BlankNode,
  type Literal,
  type Variable,
  type DefaultGraph,
  type Subject,
  type Predicate,
  type QuadObject,
  type Graph,
  type Quad,
  
  // Translation types
  type ExtensionProperty,
  type TranslationWarning,
  type TranslationMetadata,
  type TranslationRequest,
  type TranslationOptions,
  type TranslationResult,
  type TranslationResultMetadata,
  
  // Validation types from types.ts
  type ValidationErrorDetail as TypesValidationErrorDetail,
  type ValidationWarning,
  type ValidationResult as TypesValidationResult,
  
  // Temporal types
  type TemporalInstant,
  type TemporalInterval,
  type BiTemporalCoordinates,
  type TemporalQueryOptions,
  
  // Snapshot types
  type AgentSnapshot,
  
  // Field mapping types
  type FieldMapping,
  
  // Adapter types
  type AdapterConfig,
  type IAdapter,
  
  // Service types
  type DiscoveryQuery,
  type DiscoveryResult,
  type AgentSummary,
  
  // Event types
  type BridgeEventType,
  type BridgeEvent,
  type BridgeEventData,
  type AgentEventData,
  type TranslationEventData,
  type ValidationEventData,
  type CacheEventData,
  type ErrorEventData,
  
  // Disposable types
  type Disposable,
  type AsyncDisposable,
  type DisposableResource,
  
  // Utility types
  type DeepReadonly,
  type DeepPartial,
  type RequiredKeys,
  type OptionalKeys,
  type WithRequired,
  type WithOptional,
  type NonNullableProps,
  type ValueOf,
  type TypeGuard,
  
  // JSON types
  type JsonPrimitive,
  type JsonArray,
  type JsonObject,
  type JsonValue,
} from './types';

// ============================================================================
// Schema Validation
// ============================================================================

export {
  // Schema types
  type SchemaType,
  type SchemaDefinition,
  type Schema,
  type StringSchema,
  type NumberSchema,
  type BooleanSchema,
  type ArraySchema,
  type ObjectSchema,
  type NullSchema,
  type AnySchema,
  type UnionSchema,
  
  // Schema builder
  SchemaBuilder,
  S,
  
  // Validation
  type ValidationOptions,
  type ValidationResult as SchemaValidationResult,
  Validator,
  
  // Schema registry
  SchemaRegistry,
  schemaRegistry,
  
  // Pre-defined schemas
  USAAgentSchema,
  LMOSAgentSchema,
  MCPAgentSchema,
  
  // Validation helpers
  validateUSAAgent,
  validateLMOSAgent,
  validateMCPAgent,
  validateAgentByFramework,
  createValidator,
} from './validation';

// ============================================================================
// Dependency Injection
// ============================================================================

export {
  // Container
  Container,
  ContainerBuilder,
  createDefaultContainer,
  getGlobalContainer,
  setGlobalContainer,
  resetGlobalContainer,
  
  // Service tokens
  createToken,
  ServiceTokens,
  type ServiceToken,
  
  // Types
  type ServiceLifetime,
  type ServiceFactory,
  type ServiceDescriptor,
  type BridgeConfig,
  
  // Service interfaces
  type ITemporalStore,
  type IAdapterRegistry,
  type IOrchestrator,
  type IEventBus,
  type ILogger as ILoggerService,
  type IValidationService,
  type IPersistenceService,
  type IDiscoveryService,
  
  // Lazy resolution
  Lazy,
  lazy,
  
  // Module pattern
  type ServiceModule,
  registerModules,
} from './container';

// ============================================================================
// Logging
// ============================================================================

export {
  // Log levels
  LogLevel,
  parseLogLevel,
  type LogLevelName,
  type LogLevelValue,
  
  // Log entry types
  type LogEntry,
  type LogErrorDetails,
  type LogContext,
  type LogTimer,
  
  // Logger interface
  type ILogger,
  
  // Logger implementation
  Logger,
  type LoggerConfig,
  
  // Transports
  type LogTransport,
  ConsoleTransport,
  type ConsoleTransportOptions,
  
  // Request logger helper
  createRequestLogger,
  
  // Default logger
  getLogger,
  setLogger,
  createLogger,
  
  // Null logger
  NullLogger,
  nullLogger,
} from './logging';

// ============================================================================
// Resource Lifecycle
// ============================================================================

export {
  // Disposal tracking
  type DisposalTracker,
  createDisposalTracker,
  
  // Managed resources
  ManagedResource,
  managed,
  
  // Disposable collection
  DisposableStack,
  
  // Abort controller
  type AbortOptions,
  createAbortController,
  linkAbortSignals,
  throwIfAborted,
  waitForAbort,
  raceAbort,
  
  // Graceful shutdown
  type ShutdownHandler,
  GracefulShutdown,
  getShutdownManager,
  onShutdown,
  
  // Resource pool
  type PoolOptions,
  type PooledResource,
  ResourcePool,
  
  // Using helpers
  using,
  usingAll,
} from './lifecycle';

// ============================================================================
// Guard Utilities
// ============================================================================

export {
  // Null/undefined guards
  isNullish,
  isDefined,
  isNonEmptyString,
  isNonEmptyArray,
  isPlainObject,
  isFunction,
  isPromise,
  
  // Assertion guards
  assertDefined,
  assertNonEmptyString,
  assertNumber,
  assertInRange,
  assertBoolean,
  assertArray,
  assertNonEmptyArray,
  assertObject,
  assertType,
  
  // Safe property access
  get,
  getOrThrow,
  has,
  hasTyped,
  
  // Default value helpers
  coalesce,
  coalesceOrThrow,
  withDefault,
  withLazyDefault,
  
  // Invariant checking
  invariant,
  
  // Object utilities
  pickDefined,
  omitNullish,
  deepFreeze,
  
  // Array utilities
  ensureArray,
  filterNullish,
  findOrThrow,
  firstOrThrow,
  lastOrThrow,
  
  // Type narrowing helpers
  isOneOf,
  hasKeys,
  not,
  
  // Error boundary helpers
  tryOrUndefined,
  tryOrDefault,
  tryAsyncOrUndefined,
  tryAsyncOrDefault,
} from './guards';
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
  TranslationError,
  StorageError,
  ConfigurationError,
  ConnectionError,
  TimeoutError,
  AbortError,
  DisposedError,
  NotFoundError,
  ConflictError,
  TemporalConflictError,
  PermissionError,
  RateLimitError,
  
  // Error utilities
  isBridgeError,
  wrapError,
  isRecoverableError,
  getErrorChain,
  serializeError,
  
  // Types
  type ErrorContext,
  type SerializedError,
} from './errors';

// ============================================================================
// Type Definitions
// ============================================================================

export {
  // Branded types
  type Brand,
  type URI,
  type ISOTimestamp,
  type AgentId,
  type CorrelationId,
  
  // Factory functions
  uri,
  isoTimestamp,
  agentId,
  generateCorrelationId,
  
  // Agent framework types
  AGENT_FRAMEWORKS,
  type AgentFramework,
  isAgentFramework,
  
  // Agent data types
  type USAAgentData,
  type LMOSAgentData,
  type MCPAgentData,
  type LangChainAgentData,
  type AgentData,
  
  // Generic agent interfaces
  type NativeAgent,
  type CanonicalAgent,
  
  // Type guards
  isUSAAgent,
  isLMOSAgent,
  isMCPAgent,
  isLangChainAgent,
  isNativeAgent,
  isCanonicalAgent,
  
  // Result pattern
  type Result,
  ok,
  err,
  isOk,
  isErr,
  unwrap,
  unwrapOr,
  mapResult,
  flatMapResult,
  
  // Disposable types
  type Disposable,
  type AsyncDisposable,
  type DisposableResource,
  
  // Utility types
  type DeepReadonly,
  type DeepPartial,
  type Awaitable,
  type PromiseOr,
  type ValueOf,
  type Entries,
  type NonEmptyArray,
} from './types';

// ============================================================================
// Schema Validation
// ============================================================================

export {
  // Schema builder
  S,
  type SchemaType,
  type SchemaDefinition,
  type ValidationResult,
  type ValidationIssue,
  
  // Schema registry
  SchemaRegistry,
  getSchemaRegistry,
  
  // Pre-defined schemas
  URISchema,
  ISOTimestampSchema,
  AgentIdSchema,
  CorrelationIdSchema,
  USAMetadataSchema,
  USAIdentitySchema,
  USAExecutionSchema,
  USAAgentSchema,
  LMOSAgentSchema,
  MCPCapabilitySchema,
  MCPAgentSchema,
  LangChainAgentSchema,
  
  // Validation helpers
  validateAgentData,
  parseAgentData,
} from './validation';

// ============================================================================
// Dependency Injection
// ============================================================================

export {
  // Container
  Container,
  ContainerBuilder,
  createContainer,
  
  // Service tokens
  createToken,
  ServiceTokens,
  type ServiceToken,
  
  // Lifetime
  Lifetime,
  type ServiceLifetime,
  
  // Service interfaces
  type ITemporalStore,
  type IAdapterRegistry,
  type IOrchestrator,
  type IEventBus,
  type ILogger as ILoggerService,
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
  
  // Correlation context
  correlationContext,
  createRequestLogger,
  
  // Decorators
  LogMethod,
  
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
  
  // Lazy initialization
  LazyDisposable,
  lazyDisposable,
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
  unreachable,
  exhaustiveCheck,
  
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

/**
 * Chrysalis Universal Agent Bridge - Error Type Hierarchy
 * 
 * Provides a comprehensive custom exception hierarchy for consistent error
 * handling across all bridge modules. Follows best practices for TypeScript
 * error classes with proper prototype chain and serialization support.
 * 
 * @module bridge/errors
 * @version 1.0.0
 */

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Error code categories for structured error handling
 */
export const ErrorCode = {
  // Validation Errors (1xxx)
  VALIDATION_FAILED: 'BRIDGE_1001',
  SCHEMA_INVALID: 'BRIDGE_1002',
  REQUIRED_FIELD_MISSING: 'BRIDGE_1003',
  TYPE_MISMATCH: 'BRIDGE_1004',
  CONSTRAINT_VIOLATION: 'BRIDGE_1005',
  
  // Translation Errors (2xxx)
  TRANSLATION_FAILED: 'BRIDGE_2001',
  ADAPTER_NOT_FOUND: 'BRIDGE_2002',
  UNSUPPORTED_FRAMEWORK: 'BRIDGE_2003',
  CANONICAL_CONVERSION_FAILED: 'BRIDGE_2004',
  NATIVE_CONVERSION_FAILED: 'BRIDGE_2005',
  ROUND_TRIP_FAILED: 'BRIDGE_2006',
  
  // Storage Errors (3xxx)
  STORAGE_FAILED: 'BRIDGE_3001',
  SNAPSHOT_NOT_FOUND: 'BRIDGE_3002',
  GRAPH_NOT_FOUND: 'BRIDGE_3003',
  PERSISTENCE_FAILED: 'BRIDGE_3004',
  QUERY_FAILED: 'BRIDGE_3005',
  INDEX_CORRUPTED: 'BRIDGE_3006',
  
  // Temporal Errors (4xxx)
  TEMPORAL_CONFLICT: 'BRIDGE_4001',
  INVALID_TIME_RANGE: 'BRIDGE_4002',
  FUTURE_TIMESTAMP: 'BRIDGE_4003',
  TEMPORAL_INVARIANT_VIOLATED: 'BRIDGE_4004',
  SUPERSESSION_CONFLICT: 'BRIDGE_4005',
  
  // Configuration Errors (5xxx)
  CONFIG_INVALID: 'BRIDGE_5001',
  CONFIG_MISSING: 'BRIDGE_5002',
  DEPENDENCY_MISSING: 'BRIDGE_5003',
  INITIALIZATION_FAILED: 'BRIDGE_5004',
  
  // Resource Errors (6xxx)
  RESOURCE_EXHAUSTED: 'BRIDGE_6001',
  CACHE_FULL: 'BRIDGE_6002',
  TIMEOUT: 'BRIDGE_6003',
  DISPOSED: 'BRIDGE_6004',
  ABORT_REQUESTED: 'BRIDGE_6005',
  
  // Protocol Errors (7xxx)
  PROTOCOL_ERROR: 'BRIDGE_7001',
  SERIALIZATION_FAILED: 'BRIDGE_7002',
  DESERIALIZATION_FAILED: 'BRIDGE_7003',
  RDF_INVALID: 'BRIDGE_7004',
  JSON_LD_INVALID: 'BRIDGE_7005',
} as const;

export type ErrorCodeType = typeof ErrorCode[keyof typeof ErrorCode];

// ============================================================================
// Error Context
// ============================================================================

/**
 * Structured error context for debugging and logging
 */
export interface ErrorContext {
  /** Unique correlation ID for tracing */
  correlationId?: string;
  /** Operation that was being performed */
  operation?: string;
  /** Component/module that raised the error */
  component?: string;
  /** Input that caused the error */
  input?: unknown;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Stack of nested causes */
  causedBy?: Error;
  /** Timestamp when error occurred */
  timestamp?: Date;
}

/**
 * Serializable error representation for logging/transmission
 */
export interface SerializedError {
  name: string;
  code: ErrorCodeType;
  message: string;
  context?: ErrorContext;
  stack?: string;
  cause?: SerializedError;
}

// ============================================================================
// Base Error Class
// ============================================================================

/**
 * Base error class for all Chrysalis Bridge errors.
 * 
 * Features:
 * - Structured error codes for programmatic handling
 * - Rich context for debugging
 * - Proper prototype chain for instanceof checks
 * - Serialization support for logging/transmission
 * - Cause chain support for error wrapping
 */
export class BridgeError extends Error {
  readonly code: ErrorCodeType;
  readonly context: ErrorContext;
  readonly isOperational: boolean;
  readonly timestamp: Date;

  constructor(
    code: ErrorCodeType,
    message: string,
    context: ErrorContext = {},
    isOperational = true
  ) {
    super(message);
    
    // Maintain proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
    
    this.name = this.constructor.name;
    this.code = code;
    this.context = {
      ...context,
      timestamp: context.timestamp ?? new Date(),
    };
    this.isOperational = isOperational;
    this.timestamp = this.context.timestamp!;
    
    // Capture stack trace (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    
    // Set cause if provided
    if (context.causedBy) {
      this.cause = context.causedBy;
    }
  }

  /**
   * Serialize error for logging or transmission
   */
  toJSON(): SerializedError {
    const serialized: SerializedError = {
      name: this.name,
      code: this.code,
      message: this.message,
      stack: this.stack,
    };

    // Include context without circular references
    if (Object.keys(this.context).length > 0) {
      const { causedBy, ...safeContext } = this.context;
      serialized.context = safeContext;
    }

    // Serialize cause chain
    if (this.cause instanceof BridgeError) {
      serialized.cause = this.cause.toJSON();
    } else if (this.cause instanceof Error) {
      serialized.cause = {
        name: this.cause.name,
        code: ErrorCode.VALIDATION_FAILED,
        message: this.cause.message,
        stack: this.cause.stack,
      };
    }

    return serialized;
  }

  /**
   * Create a new error wrapping this one
   */
  wrap(code: ErrorCodeType, message: string, additionalContext: Partial<ErrorContext> = {}): BridgeError {
    return new BridgeError(code, message, {
      ...additionalContext,
      causedBy: this,
      correlationId: this.context.correlationId,
    });
  }

  /**
   * Check if this error matches a specific code
   */
  hasCode(code: ErrorCodeType): boolean {
    return this.code === code;
  }

  /**
   * Get the root cause of the error chain
   */
  getRootCause(): Error {
    let current: Error = this;
    while (current.cause instanceof Error) {
      current = current.cause;
    }
    return current;
  }

  /**
   * Format error for console output
   */
  toString(): string {
    const parts = [`[${this.code}] ${this.name}: ${this.message}`];
    
    if (this.context.operation) {
      parts.push(`  Operation: ${this.context.operation}`);
    }
    if (this.context.component) {
      parts.push(`  Component: ${this.context.component}`);
    }
    if (this.context.correlationId) {
      parts.push(`  CorrelationId: ${this.context.correlationId}`);
    }
    
    return parts.join('\n');
  }
}

// ============================================================================
// Validation Errors
// ============================================================================

/**
 * Error thrown when validation fails
 */
export class ValidationError extends BridgeError {
  readonly validationErrors: ValidationErrorDetail[];

  constructor(
    message: string,
    errors: ValidationErrorDetail[] = [],
    context: ErrorContext = {}
  ) {
    super(ErrorCode.VALIDATION_FAILED, message, context);
    this.validationErrors = errors;
  }

  /**
   * Create from multiple validation failures
   */
  static fromErrors(errors: ValidationErrorDetail[], context: ErrorContext = {}): ValidationError {
    const message = errors.length === 1
      ? errors[0].message
      : `${errors.length} validation errors: ${errors.map(e => e.path).join(', ')}`;
    return new ValidationError(message, errors, context);
  }
}

export interface ValidationErrorDetail {
  path: string;
  code: string;
  message: string;
  expected?: string;
  actual?: string;
}

/**
 * Error for schema validation failures
 */
export class SchemaValidationError extends ValidationError {
  readonly schema: string;

  constructor(
    message: string,
    schema: string,
    errors: ValidationErrorDetail[] = [],
    context: ErrorContext = {}
  ) {
    super(message, errors, { ...context, metadata: { ...context.metadata, schema } });
    this.code = ErrorCode.SCHEMA_INVALID as ErrorCodeType;
    this.schema = schema;
  }
}

/**
 * Error for missing required fields
 */
export class RequiredFieldError extends ValidationError {
  readonly fieldPath: string;

  constructor(fieldPath: string, context: ErrorContext = {}) {
    super(
      `Required field missing: ${fieldPath}`,
      [{ path: fieldPath, code: 'required', message: `${fieldPath} is required` }],
      context
    );
    this.code = ErrorCode.REQUIRED_FIELD_MISSING as ErrorCodeType;
    this.fieldPath = fieldPath;
  }
}

/**
 * Error for type mismatches
 */
export class TypeMismatchError extends ValidationError {
  readonly fieldPath: string;
  readonly expectedType: string;
  readonly actualType: string;

  constructor(
    fieldPath: string,
    expectedType: string,
    actualType: string,
    context: ErrorContext = {}
  ) {
    super(
      `Type mismatch at ${fieldPath}: expected ${expectedType}, got ${actualType}`,
      [{
        path: fieldPath,
        code: 'type',
        message: `Expected ${expectedType}, got ${actualType}`,
        expected: expectedType,
        actual: actualType,
      }],
      context
    );
    this.code = ErrorCode.TYPE_MISMATCH as ErrorCodeType;
    this.fieldPath = fieldPath;
    this.expectedType = expectedType;
    this.actualType = actualType;
  }
}

// ============================================================================
// Translation Errors
// ============================================================================

/**
 * Error thrown during agent translation
 */
export class TranslationError extends BridgeError {
  readonly sourceFramework: string;
  readonly targetFramework: string;

  constructor(
    message: string,
    sourceFramework: string,
    targetFramework: string,
    context: ErrorContext = {}
  ) {
    super(ErrorCode.TRANSLATION_FAILED, message, {
      ...context,
      metadata: { ...context.metadata, sourceFramework, targetFramework },
    });
    this.sourceFramework = sourceFramework;
    this.targetFramework = targetFramework;
  }
}

/**
 * Error when adapter is not registered
 */
export class AdapterNotFoundError extends BridgeError {
  readonly framework: string;
  readonly availableAdapters: string[];

  constructor(framework: string, availableAdapters: string[] = [], context: ErrorContext = {}) {
    super(
      ErrorCode.ADAPTER_NOT_FOUND,
      `No adapter registered for framework: ${framework}. Available: ${availableAdapters.join(', ') || 'none'}`,
      { ...context, metadata: { ...context.metadata, framework, availableAdapters } }
    );
    this.framework = framework;
    this.availableAdapters = availableAdapters;
  }
}

/**
 * Error when framework is not supported
 */
export class UnsupportedFrameworkError extends BridgeError {
  readonly framework: string;
  readonly supportedFrameworks: string[];

  constructor(framework: string, supportedFrameworks: string[] = [], context: ErrorContext = {}) {
    super(
      ErrorCode.UNSUPPORTED_FRAMEWORK,
      `Framework not supported: ${framework}. Supported: ${supportedFrameworks.join(', ')}`,
      { ...context, metadata: { ...context.metadata, framework, supportedFrameworks } }
    );
    this.framework = framework;
    this.supportedFrameworks = supportedFrameworks;
  }
}

// ============================================================================
// Storage Errors
// ============================================================================

/**
 * Base error for storage operations
 */
export class StorageError extends BridgeError {
  constructor(
    code: ErrorCodeType = ErrorCode.STORAGE_FAILED,
    message: string,
    context: ErrorContext = {}
  ) {
    super(code, message, context);
  }
}

/**
 * Error when snapshot not found
 */
export class SnapshotNotFoundError extends StorageError {
  readonly agentId: string;
  readonly timestamp?: Date;

  constructor(agentId: string, timestamp?: Date, context: ErrorContext = {}) {
    const msg = timestamp
      ? `Snapshot not found for agent ${agentId} at ${timestamp.toISOString()}`
      : `No snapshots found for agent ${agentId}`;
    super(ErrorCode.SNAPSHOT_NOT_FOUND, msg, {
      ...context,
      metadata: { ...context.metadata, agentId, timestamp: timestamp?.toISOString() },
    });
    this.agentId = agentId;
    this.timestamp = timestamp;
  }
}

/**
 * Error when graph not found
 */
export class GraphNotFoundError extends StorageError {
  readonly graphUri: string;

  constructor(graphUri: string, context: ErrorContext = {}) {
    super(ErrorCode.GRAPH_NOT_FOUND, `Graph not found: ${graphUri}`, {
      ...context,
      metadata: { ...context.metadata, graphUri },
    });
    this.graphUri = graphUri;
  }
}

/**
 * Error when query fails
 */
export class QueryError extends StorageError {
  readonly queryType: string;
  readonly queryParams?: Record<string, unknown>;

  constructor(
    message: string,
    queryType: string,
    queryParams?: Record<string, unknown>,
    context: ErrorContext = {}
  ) {
    super(ErrorCode.QUERY_FAILED, message, {
      ...context,
      metadata: { ...context.metadata, queryType, queryParams },
    });
    this.queryType = queryType;
    this.queryParams = queryParams;
  }
}

// ============================================================================
// Temporal Errors
// ============================================================================

/**
 * Error for temporal conflicts
 */
export class TemporalConflictError extends BridgeError {
  readonly existingTimestamp: Date;
  readonly newTimestamp: Date;
  readonly agentId: string;

  constructor(
    agentId: string,
    existingTimestamp: Date,
    newTimestamp: Date,
    context: ErrorContext = {}
  ) {
    super(
      ErrorCode.TEMPORAL_CONFLICT,
      `Temporal conflict for agent ${agentId}: existing=${existingTimestamp.toISOString()}, new=${newTimestamp.toISOString()}`,
      {
        ...context,
        metadata: {
          ...context.metadata,
          agentId,
          existingTimestamp: existingTimestamp.toISOString(),
          newTimestamp: newTimestamp.toISOString(),
        },
      }
    );
    this.agentId = agentId;
    this.existingTimestamp = existingTimestamp;
    this.newTimestamp = newTimestamp;
  }
}

/**
 * Error for invalid time range
 */
export class InvalidTimeRangeError extends BridgeError {
  readonly start: Date;
  readonly end: Date;

  constructor(start: Date, end: Date, context: ErrorContext = {}) {
    super(
      ErrorCode.INVALID_TIME_RANGE,
      `Invalid time range: start (${start.toISOString()}) must be before end (${end.toISOString()})`,
      {
        ...context,
        metadata: {
          ...context.metadata,
          start: start.toISOString(),
          end: end.toISOString(),
        },
      }
    );
    this.start = start;
    this.end = end;
  }
}

// ============================================================================
// Configuration Errors
// ============================================================================

/**
 * Error for invalid configuration
 */
export class ConfigurationError extends BridgeError {
  readonly configKey?: string;

  constructor(message: string, configKey?: string, context: ErrorContext = {}) {
    super(ErrorCode.CONFIG_INVALID, message, {
      ...context,
      metadata: { ...context.metadata, configKey },
    });
    this.configKey = configKey;
  }
}

/**
 * Error for missing dependency
 */
export class DependencyError extends BridgeError {
  readonly dependencyName: string;

  constructor(dependencyName: string, context: ErrorContext = {}) {
    super(
      ErrorCode.DEPENDENCY_MISSING,
      `Required dependency not available: ${dependencyName}`,
      { ...context, metadata: { ...context.metadata, dependencyName } }
    );
    this.dependencyName = dependencyName;
  }
}

// ============================================================================
// Resource Errors
// ============================================================================

/**
 * Error when resource is exhausted
 */
export class ResourceExhaustedError extends BridgeError {
  readonly resourceType: string;
  readonly limit: number;
  readonly current: number;

  constructor(
    resourceType: string,
    limit: number,
    current: number,
    context: ErrorContext = {}
  ) {
    super(
      ErrorCode.RESOURCE_EXHAUSTED,
      `Resource exhausted: ${resourceType} (limit: ${limit}, current: ${current})`,
      {
        ...context,
        metadata: { ...context.metadata, resourceType, limit, current },
      }
    );
    this.resourceType = resourceType;
    this.limit = limit;
    this.current = current;
  }
}

/**
 * Error when operation times out
 */
export class TimeoutError extends BridgeError {
  readonly timeoutMs: number;
  readonly operation: string;

  constructor(operation: string, timeoutMs: number, context: ErrorContext = {}) {
    super(
      ErrorCode.TIMEOUT,
      `Operation timed out: ${operation} (${timeoutMs}ms)`,
      { ...context, operation, metadata: { ...context.metadata, timeoutMs } }
    );
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Error when resource has been disposed
 */
export class DisposedError extends BridgeError {
  readonly resourceType: string;

  constructor(resourceType: string, context: ErrorContext = {}) {
    super(
      ErrorCode.DISPOSED,
      `Resource has been disposed: ${resourceType}`,
      { ...context, metadata: { ...context.metadata, resourceType } }
    );
    this.resourceType = resourceType;
  }
}

/**
 * Error when operation is aborted
 */
export class AbortError extends BridgeError {
  readonly reason?: string;

  constructor(reason?: string, context: ErrorContext = {}) {
    super(
      ErrorCode.ABORT_REQUESTED,
      reason ? `Operation aborted: ${reason}` : 'Operation aborted',
      { ...context, metadata: { ...context.metadata, reason } }
    );
    this.reason = reason;
  }
}

// ============================================================================
// Protocol Errors
// ============================================================================

/**
 * Error for serialization failures
 */
export class SerializationError extends BridgeError {
  readonly format: string;

  constructor(format: string, message: string, context: ErrorContext = {}) {
    super(ErrorCode.SERIALIZATION_FAILED, message, {
      ...context,
      metadata: { ...context.metadata, format },
    });
    this.format = format;
  }
}

/**
 * Error for deserialization failures
 */
export class DeserializationError extends BridgeError {
  readonly format: string;
  readonly rawInput?: string;

  constructor(format: string, message: string, rawInput?: string, context: ErrorContext = {}) {
    super(ErrorCode.DESERIALIZATION_FAILED, message, {
      ...context,
      metadata: { ...context.metadata, format, rawInputLength: rawInput?.length },
    });
    this.format = format;
    this.rawInput = rawInput;
  }
}

/**
 * Error for invalid RDF
 */
export class RDFError extends BridgeError {
  constructor(message: string, context: ErrorContext = {}) {
    super(ErrorCode.RDF_INVALID, message, context);
  }
}

// ============================================================================
// Error Utilities
// ============================================================================

/**
 * Type guard for BridgeError
 */
export function isBridgeError(error: unknown): error is BridgeError {
  return error instanceof BridgeError;
}

/**
 * Type guard for specific error code
 */
export function hasErrorCode<T extends BridgeError>(
  error: unknown,
  code: ErrorCodeType
): error is T {
  return isBridgeError(error) && error.code === code;
}

/**
 * Wrap unknown error in BridgeError
 */
export function wrapError(
  error: unknown,
  code: ErrorCodeType = ErrorCode.VALIDATION_FAILED,
  message?: string,
  context: ErrorContext = {}
): BridgeError {
  if (error instanceof BridgeError) {
    return error;
  }

  if (error instanceof Error) {
    return new BridgeError(
      code,
      message ?? error.message,
      { ...context, causedBy: error }
    );
  }

  return new BridgeError(
    code,
    message ?? String(error),
    context
  );
}

/**
 * Create a correlation ID for error tracing
 */
export function createCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `brg-${timestamp}-${random}`;
}

/**
 * Aggregate multiple errors into a single error
 */
export class AggregateError extends BridgeError {
  readonly errors: BridgeError[];

  constructor(errors: BridgeError[], context: ErrorContext = {}) {
    super(
      ErrorCode.VALIDATION_FAILED,
      `${errors.length} errors occurred: ${errors.map(e => e.code).join(', ')}`,
      context
    );
    this.errors = errors;
  }

  override toJSON(): SerializedError & { errors: SerializedError[] } {
    return {
      ...super.toJSON(),
      errors: this.errors.map(e => e.toJSON()),
    };
  }
}

// ============================================================================
// Error Result Type (for Result Pattern)
// ============================================================================

/**
 * Result type for operations that can fail
 */
export type Result<T, E extends BridgeError = BridgeError> = 
  | { success: true; value: T }
  | { success: false; error: E };

/**
 * Create a success result
 */
export function ok<T>(value: T): Result<T, never> {
  return { success: true, value };
}

/**
 * Create a failure result
 */
export function err<E extends BridgeError>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Check if result is success
 */
export function isOk<T, E extends BridgeError>(result: Result<T, E>): result is { success: true; value: T } {
  return result.success === true;
}

/**
 * Check if result is failure
 */
export function isErr<T, E extends BridgeError>(result: Result<T, E>): result is { success: false; error: E } {
  return result.success === false;
}

/**
 * Unwrap result or throw
 */
export function unwrap<T, E extends BridgeError>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.value;
  }
  throw result.error;
}

/**
 * Unwrap result with default
 */
export function unwrapOr<T, E extends BridgeError>(result: Result<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.value;
  }
  return defaultValue;
}

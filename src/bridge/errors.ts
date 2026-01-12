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
 * Error thrown when validation fails.
 *
 * Provides factory methods for common validation error types,
 * replacing the need for separate SchemaValidationError, RequiredFieldError,
 * and TypeMismatchError classes.
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

  /**
   * Factory: Create schema validation error
   * @param schema - The schema that failed validation
   * @param errors - Validation error details
   * @param context - Error context
   * @returns SchemaValidationError with SCHEMA_INVALID code
   */
  static schema(
    schema: string,
    errors: ValidationErrorDetail[] = [],
    context: ErrorContext = {}
  ): SchemaValidationError {
    return new SchemaValidationError(
      `Schema validation failed: ${schema}`,
      schema,
      errors,
      { ...context, metadata: { ...context.metadata, schema } }
    );
  }

  /**
   * Factory: Create required field error
   * @param fieldPath - The path to the missing required field
   * @param context - Error context
   * @returns RequiredFieldError with REQUIRED_FIELD_MISSING code
   */
  static requiredField(fieldPath: string, context: ErrorContext = {}): RequiredFieldError {
    return new RequiredFieldError(fieldPath, { ...context, metadata: { ...context.metadata, fieldPath } });
  }

  /**
   * Factory: Create type mismatch error
   * @param fieldPath - The path to the field with wrong type
   * @param expectedType - The expected type
   * @param actualType - The actual type received
   * @param context - Error context
   * @returns TypeMismatchError with TYPE_MISMATCH code
   */
  static typeMismatch(
    fieldPath: string,
    expectedType: string,
    actualType: string,
    context: ErrorContext = {}
  ): TypeMismatchError {
    return new TypeMismatchError(
      fieldPath,
      expectedType,
      actualType,
      { ...context, metadata: { ...context.metadata, fieldPath, expectedType, actualType } }
    );
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
 * @deprecated Use ValidationError.schema() factory method instead
 */
export class SchemaValidationError extends BridgeError {
  readonly schema: string;
  readonly validationErrors: ValidationErrorDetail[];

  constructor(
    message: string,
    schema: string,
    errors: ValidationErrorDetail[] = [],
    context: ErrorContext = {}
  ) {
    super(ErrorCode.SCHEMA_INVALID, message, { ...context, metadata: { ...context.metadata, schema } });
    this.schema = schema;
    this.validationErrors = errors;
  }
}

/**
 * Error for missing required fields
 * @deprecated Use ValidationError.requiredField() factory method instead
 */
export class RequiredFieldError extends BridgeError {
  readonly fieldPath: string;
  readonly validationErrors: ValidationErrorDetail[];

  constructor(fieldPath: string, context: ErrorContext = {}) {
    super(
      ErrorCode.REQUIRED_FIELD_MISSING,
      `Required field missing: ${fieldPath}`,
      context
    );
    this.fieldPath = fieldPath;
    this.validationErrors = [{ path: fieldPath, code: 'required', message: `${fieldPath} is required` }];
  }
}

/**
 * Error for type mismatches
 * @deprecated Use ValidationError.typeMismatch() factory method instead
 */
export class TypeMismatchError extends BridgeError {
  readonly fieldPath: string;
  readonly expectedType: string;
  readonly actualType: string;
  readonly validationErrors: ValidationErrorDetail[];

  constructor(
    fieldPath: string,
    expectedType: string,
    actualType: string,
    context: ErrorContext = {}
  ) {
    super(
      ErrorCode.TYPE_MISMATCH,
      `Type mismatch at ${fieldPath}: expected ${expectedType}, got ${actualType}`,
      context
    );
    this.fieldPath = fieldPath;
    this.expectedType = expectedType;
    this.actualType = actualType;
    this.validationErrors = [{
      path: fieldPath,
      code: 'type',
      message: `Expected ${expectedType}, got ${actualType}`,
      expected: expectedType,
      actual: actualType,
    }];
  }
}

// ============================================================================
// Translation Errors
// ============================================================================

/**
 * Error thrown during agent translation.
 *
 * Provides factory methods for common translation error types,
 * replacing the need for separate AdapterNotFoundError and UnsupportedFrameworkError classes.
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

  /**
   * Factory: Create adapter not found error
   * @param framework - The framework for which no adapter was found
   * @param availableAdapters - List of available adapter frameworks
   * @param context - Error context
   * @returns TranslationError with ADAPTER_NOT_FOUND code
   */
  static adapterNotFound(
    framework: string,
    availableAdapters: string[] = [],
    context: ErrorContext = {}
  ): TranslationError {
    const error = new TranslationError(
      `No adapter registered for framework: ${framework}. Available: ${availableAdapters.join(', ') || 'none'}`,
      framework,
      'canonical',
      { ...context, metadata: { ...context.metadata, framework, availableAdapters } }
    );
    (error as { code: ErrorCodeType }).code = ErrorCode.ADAPTER_NOT_FOUND;
    return error;
  }

  /**
   * Factory: Create unsupported framework error
   * @param framework - The unsupported framework
   * @param supportedFrameworks - List of supported frameworks
   * @param context - Error context
   * @returns TranslationError with UNSUPPORTED_FRAMEWORK code
   */
  static unsupportedFramework(
    framework: string,
    supportedFrameworks: string[] = [],
    context: ErrorContext = {}
  ): TranslationError {
    const error = new TranslationError(
      `Framework not supported: ${framework}. Supported: ${supportedFrameworks.join(', ')}`,
      framework,
      'canonical',
      { ...context, metadata: { ...context.metadata, framework, supportedFrameworks } }
    );
    (error as { code: ErrorCodeType }).code = ErrorCode.UNSUPPORTED_FRAMEWORK;
    return error;
  }
}

// AdapterNotFoundError and UnsupportedFrameworkError removed - use TranslationError.adapterNotFound() and .unsupportedFramework() factory methods

// ============================================================================
// Storage Errors
// ============================================================================

/**
 * Base error for storage operations.
 *
 * Provides factory methods for common storage error types,
 * replacing the need for separate SnapshotNotFoundError, GraphNotFoundError,
 * and QueryError classes.
 */
export class StorageError extends BridgeError {
  constructor(
    code: ErrorCodeType = ErrorCode.STORAGE_FAILED,
    message: string,
    context: ErrorContext = {}
  ) {
    super(code, message, context);
  }

  /**
   * Factory: Create snapshot not found error
   * @param agentId - The agent ID whose snapshot was not found
   * @param timestamp - Optional timestamp for the snapshot
   * @param context - Error context
   * @returns StorageError with SNAPSHOT_NOT_FOUND code
   */
  static snapshotNotFound(
    agentId: string,
    timestamp?: Date,
    context: ErrorContext = {}
  ): StorageError {
    const msg = timestamp
      ? `Snapshot not found for agent ${agentId} at ${timestamp.toISOString()}`
      : `No snapshots found for agent ${agentId}`;
    return new StorageError(ErrorCode.SNAPSHOT_NOT_FOUND, msg, {
      ...context,
      metadata: { ...context.metadata, agentId, timestamp: timestamp?.toISOString() },
    });
  }

  /**
   * Factory: Create graph not found error
   * @param graphUri - The URI of the graph that was not found
   * @param context - Error context
   * @returns StorageError with GRAPH_NOT_FOUND code
   */
  static graphNotFound(graphUri: string, context: ErrorContext = {}): StorageError {
    return new StorageError(ErrorCode.GRAPH_NOT_FOUND, `Graph not found: ${graphUri}`, {
      ...context,
      metadata: { ...context.metadata, graphUri },
    });
  }

  /**
   * Factory: Create query failed error
   * @param message - Error message describing the query failure
   * @param queryType - Type of query that failed
   * @param queryParams - Optional query parameters
   * @param context - Error context
   * @returns StorageError with QUERY_FAILED code
   */
  static queryFailed(
    message: string,
    queryType: string,
    queryParams?: Record<string, unknown>,
    context: ErrorContext = {}
  ): StorageError {
    return new StorageError(ErrorCode.QUERY_FAILED, message, {
      ...context,
      metadata: { ...context.metadata, queryType, queryParams },
    });
  }
}

// SnapshotNotFoundError, GraphNotFoundError, QueryError removed - use StorageError factory methods

// ============================================================================
// Temporal Errors
// ============================================================================

/**
 * Error for temporal operations.
 *
 * Provides factory methods for common temporal error types,
 * replacing the need for separate TemporalConflictError and InvalidTimeRangeError classes.
 */
export class TemporalError extends BridgeError {
  constructor(
    code: ErrorCodeType = ErrorCode.TEMPORAL_CONFLICT,
    message: string,
    context: ErrorContext = {}
  ) {
    super(code, message, context);
  }

  /**
   * Factory: Create temporal conflict error
   * @param agentId - The agent ID with the conflict
   * @param existingTimestamp - The existing timestamp
   * @param newTimestamp - The new conflicting timestamp
   * @param context - Error context
   * @returns TemporalError with TEMPORAL_CONFLICT code
   */
  static conflict(
    agentId: string,
    existingTimestamp: Date,
    newTimestamp: Date,
    context: ErrorContext = {}
  ): TemporalError {
    return new TemporalError(
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
  }

  /**
   * Factory: Create invalid time range error
   * @param start - The start timestamp
   * @param end - The end timestamp
   * @param context - Error context
   * @returns TemporalError with INVALID_TIME_RANGE code
   */
  static invalidTimeRange(start: Date, end: Date, context: ErrorContext = {}): TemporalError {
    return new TemporalError(
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
  }
}

// TemporalConflictError, InvalidTimeRangeError removed - use TemporalError factory methods

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
 * Error for resource-related issues.
 *
 * Provides factory methods for common resource error types,
 * replacing the need for separate ResourceExhaustedError, TimeoutError,
 * DisposedError, and AbortError classes.
 */
export class ResourceError extends BridgeError {
  readonly resourceType: string;

  constructor(
    code: ErrorCodeType = ErrorCode.RESOURCE_EXHAUSTED,
    message: string,
    resourceType: string,
    context: ErrorContext = {}
  ) {
    super(code, message, { ...context, metadata: { ...context.metadata, resourceType } });
    this.resourceType = resourceType;
  }

  /**
   * Factory: Create resource exhausted error
   * @param resourceType - The type of resource that was exhausted
   * @param limit - The resource limit
   * @param current - The current usage level
   * @param context - Error context
   * @returns ResourceError with RESOURCE_EXHAUSTED code
   */
  static exhausted(
    resourceType: string,
    limit: number,
    current: number,
    context: ErrorContext = {}
  ): ResourceError {
    return new ResourceError(
      ErrorCode.RESOURCE_EXHAUSTED,
      `Resource exhausted: ${resourceType} (limit: ${limit}, current: ${current})`,
      resourceType,
      { ...context, metadata: { ...context.metadata, limit, current } }
    );
  }

  /**
   * Factory: Create timeout error
   * @param operation - The operation that timed out
   * @param timeoutMs - The timeout duration in milliseconds
   * @param context - Error context
   * @returns ResourceError with TIMEOUT code
   */
  static timeout(operation: string, timeoutMs: number, context: ErrorContext = {}): ResourceError {
    return new ResourceError(
      ErrorCode.TIMEOUT,
      `Operation timed out: ${operation} (${timeoutMs}ms)`,
      'timeout',
      { ...context, operation, metadata: { ...context.metadata, timeoutMs } }
    );
  }

  /**
   * Factory: Create disposed resource error
   * @param resourceType - The type of resource that was disposed
   * @param context - Error context
   * @returns ResourceError with DISPOSED code
   */
  static disposed(resourceType: string, context: ErrorContext = {}): ResourceError {
    return new ResourceError(
      ErrorCode.DISPOSED,
      `Resource has been disposed: ${resourceType}`,
      resourceType,
      context
    );
  }

  /**
   * Factory: Create abort error
   * @param reason - Optional reason for the abort
   * @param context - Error context
   * @returns ResourceError with ABORT_REQUESTED code
   */
  static aborted(reason?: string, context: ErrorContext = {}): ResourceError {
    return new ResourceError(
      ErrorCode.ABORT_REQUESTED,
      reason ? `Operation aborted: ${reason}` : 'Operation aborted',
      'abort',
      { ...context, metadata: { ...context.metadata, reason } }
    );
  }
}

// ResourceExhaustedError removed - use ResourceError.exhausted() factory method

/**
 * Error when operation times out
 * @deprecated Use ResourceError.timeout() factory method instead
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
 * @deprecated Use ResourceError.disposed() factory method instead
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
 * @deprecated Use ResourceError.aborted() factory method instead
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
 * Error for protocol-related issues.
 *
 * Provides factory methods for common protocol error types,
 * replacing the need for separate SerializationError, DeserializationError,
 * and RDFError classes.
 */
export class ProtocolError extends BridgeError {
  readonly format: string;

  constructor(
    code: ErrorCodeType = ErrorCode.PROTOCOL_ERROR,
    message: string,
    format: string,
    context: ErrorContext = {}
  ) {
    super(code, message, { ...context, metadata: { ...context.metadata, format } });
    this.format = format;
  }

  /**
   * Factory: Create serialization error
   * @param format - The serialization format
   * @param message - Error message
   * @param context - Error context
   * @returns ProtocolError with SERIALIZATION_FAILED code
   */
  static serialization(format: string, message: string, context: ErrorContext = {}): ProtocolError {
    return new ProtocolError(ErrorCode.SERIALIZATION_FAILED, message, format, context);
  }

  /**
   * Factory: Create deserialization error
   * @param format - The deserialization format
   * @param message - Error message
   * @param rawInput - Optional raw input that failed to deserialize
   * @param context - Error context
   * @returns ProtocolError with DESERIALIZATION_FAILED code
   */
  static deserialization(
    format: string,
    message: string,
    rawInput?: string,
    context: ErrorContext = {}
  ): ProtocolError {
    return new ProtocolError(
      ErrorCode.DESERIALIZATION_FAILED,
      message,
      format,
      { ...context, metadata: { ...context.metadata, rawInputLength: rawInput?.length } }
    );
  }

  /**
   * Factory: Create RDF error
   * @param message - Error message
   * @param context - Error context
   * @returns ProtocolError with RDF_INVALID code
   */
  static rdf(message: string, context: ErrorContext = {}): ProtocolError {
    return new ProtocolError(ErrorCode.RDF_INVALID, message, 'rdf', context);
  }

  /**
   * Factory: Create JSON-LD error
   * @param message - Error message
   * @param context - Error context
   * @returns ProtocolError with JSON_LD_INVALID code
   */
  static jsonLd(message: string, context: ErrorContext = {}): ProtocolError {
    return new ProtocolError(ErrorCode.JSON_LD_INVALID, message, 'json-ld', context);
  }
}

// SerializationError, DeserializationError, RDFError removed - use ProtocolError factory methods

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

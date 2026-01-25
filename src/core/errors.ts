/**
 * Chrysalis Error System
 * 
 * Centralized error types, error boundaries, and recovery strategies.
 * Provides structured error handling across all Chrysalis components.
 * 
 * @module core/errors
 * @see plans/CHRYSALIS_DEVELOPMENT_STREAMLINING_PLAN.md - Phase 4
 */

// =============================================================================
// Error Codes
// =============================================================================

/**
 * Chrysalis error codes organized by domain
 */
export const ErrorCodes = {
  // General (1xxx)
  UNKNOWN: 'CHRYS_1000',
  VALIDATION_FAILED: 'CHRYS_1001',
  NOT_FOUND: 'CHRYS_1002',
  ALREADY_EXISTS: 'CHRYS_1003',
  TIMEOUT: 'CHRYS_1004',
  RATE_LIMITED: 'CHRYS_1005',
  
  // Agent/Morph (2xxx)
  MORPH_FAILED: 'CHRYS_2000',
  MORPH_UNSUPPORTED_FRAMEWORK: 'CHRYS_2001',
  MORPH_VALIDATION_ERROR: 'CHRYS_2002',
  MORPH_INCOMPATIBLE: 'CHRYS_2003',
  AGENT_NOT_FOUND: 'CHRYS_2004',
  AGENT_INVALID_STATE: 'CHRYS_2005',
  
  // Memory (3xxx)
  MEMORY_STORE_ERROR: 'CHRYS_3000',
  MEMORY_RETRIEVAL_ERROR: 'CHRYS_3001',
  MEMORY_EMBEDDING_ERROR: 'CHRYS_3002',
  MEMORY_CAPACITY_EXCEEDED: 'CHRYS_3003',
  MEMORY_SANITIZATION_BLOCKED: 'CHRYS_3004',
  
  // LLM (4xxx)
  LLM_API_ERROR: 'CHRYS_4000',
  LLM_RATE_LIMITED: 'CHRYS_4001',
  LLM_CONTEXT_TOO_LONG: 'CHRYS_4002',
  LLM_INVALID_RESPONSE: 'CHRYS_4003',
  LLM_PROVIDER_UNAVAILABLE: 'CHRYS_4004',
  
  // MCP (5xxx)
  MCP_CONNECTION_ERROR: 'CHRYS_5000',
  MCP_TOOL_NOT_FOUND: 'CHRYS_5001',
  MCP_RESOURCE_ERROR: 'CHRYS_5002',
  MCP_PROTOCOL_ERROR: 'CHRYS_5003',
  
  // Config (6xxx)
  CONFIG_INVALID: 'CHRYS_6000',
  CONFIG_MISSING_REQUIRED: 'CHRYS_6001',
  CONFIG_TYPE_MISMATCH: 'CHRYS_6002',
  
  // Service (7xxx)
  SERVICE_UNAVAILABLE: 'CHRYS_7000',
  SERVICE_INITIALIZATION_FAILED: 'CHRYS_7001',
  SERVICE_SHUTDOWN_ERROR: 'CHRYS_7002',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// =============================================================================
// Base Error Classes
// =============================================================================

/**
 * Base Chrysalis error with code, context, and recovery hints
 */
export class ChrysalisError extends Error {
  readonly code: ErrorCode;
  readonly context: Record<string, unknown>;
  readonly timestamp: Date;
  readonly recoverable: boolean;
  readonly recoveryHint?: string;

  /**
   *
   * @param message
   * @param code
   * @param options
   * @param options.cause
   * @param options.context
   * @param options.recoverable
   * @param options.recoveryHint
   */
  constructor(
    message: string,
    code: ErrorCode = ErrorCodes.UNKNOWN,
    options?: {
      cause?: Error;
      context?: Record<string, unknown>;
      recoverable?: boolean;
      recoveryHint?: string;
    }
  ) {
    super(message, { cause: options?.cause });
    this.name = 'ChrysalisError';
    this.code = code;
    this.context = options?.context ?? {};
    this.timestamp = new Date();
    this.recoverable = options?.recoverable ?? false;
    this.recoveryHint = options?.recoveryHint;

    // Capture stack trace properly
    Error.captureStackTrace?.(this, ChrysalisError);
  }

  /**
   * Format error for logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      recoverable: this.recoverable,
      recoveryHint: this.recoveryHint,
      stack: this.stack,
      cause: this.cause instanceof Error ? {
        name: this.cause.name,
        message: this.cause.message,
      } : undefined,
    };
  }
}

// =============================================================================
// Domain-Specific Errors
// =============================================================================

/**
 * Agent/Morph operation errors
 */
export class MorphError extends ChrysalisError {
  readonly sourceFramework?: string;
  readonly targetFramework?: string;

  /**
   *
   * @param message
   * @param code
   * @param options
   * @param options.cause
   * @param options.context
   * @param options.sourceFramework
   * @param options.targetFramework
   * @param options.recoveryHint
   */
  constructor(
    message: string,
    code: ErrorCode = ErrorCodes.MORPH_FAILED,
    options?: {
      cause?: Error;
      context?: Record<string, unknown>;
      sourceFramework?: string;
      targetFramework?: string;
      recoveryHint?: string;
    }
  ) {
    super(message, code, {
      ...options,
      context: {
        ...options?.context,
        sourceFramework: options?.sourceFramework,
        targetFramework: options?.targetFramework,
      },
      recoverable: true,
    });
    this.name = 'MorphError';
    this.sourceFramework = options?.sourceFramework;
    this.targetFramework = options?.targetFramework;
  }
}

/**
 * Memory system errors
 */
export class MemoryError extends ChrysalisError {
  readonly memoryType?: string;

  /**
   *
   * @param message
   * @param code
   * @param options
   * @param options.cause
   * @param options.context
   * @param options.memoryType
   * @param options.recoveryHint
   */
  constructor(
    message: string,
    code: ErrorCode = ErrorCodes.MEMORY_STORE_ERROR,
    options?: {
      cause?: Error;
      context?: Record<string, unknown>;
      memoryType?: string;
      recoveryHint?: string;
    }
  ) {
    super(message, code, {
      ...options,
      context: { ...options?.context, memoryType: options?.memoryType },
    });
    this.name = 'MemoryError';
    this.memoryType = options?.memoryType;
  }
}

/**
 * LLM API errors
 */
export class LLMError extends ChrysalisError {
  readonly provider?: string;
  readonly model?: string;
  readonly tokensUsed?: number;

  /**
   *
   * @param message
   * @param code
   * @param options
   * @param options.cause
   * @param options.context
   * @param options.provider
   * @param options.model
   * @param options.tokensUsed
   * @param options.recoveryHint
   */
  constructor(
    message: string,
    code: ErrorCode = ErrorCodes.LLM_API_ERROR,
    options?: {
      cause?: Error;
      context?: Record<string, unknown>;
      provider?: string;
      model?: string;
      tokensUsed?: number;
      recoveryHint?: string;
    }
  ) {
    super(message, code, {
      ...options,
      context: {
        ...options?.context,
        provider: options?.provider,
        model: options?.model,
      },
      recoverable: code === ErrorCodes.LLM_RATE_LIMITED,
      recoveryHint: code === ErrorCodes.LLM_RATE_LIMITED 
        ? 'Wait and retry with exponential backoff'
        : options?.recoveryHint,
    });
    this.name = 'LLMError';
    this.provider = options?.provider;
    this.model = options?.model;
    this.tokensUsed = options?.tokensUsed;
  }
}

/**
 * MCP protocol errors
 */
export class MCPError extends ChrysalisError {
  readonly serverName?: string;
  readonly toolName?: string;

  /**
   *
   * @param message
   * @param code
   * @param options
   * @param options.cause
   * @param options.context
   * @param options.serverName
   * @param options.toolName
   * @param options.recoveryHint
   */
  constructor(
    message: string,
    code: ErrorCode = ErrorCodes.MCP_CONNECTION_ERROR,
    options?: {
      cause?: Error;
      context?: Record<string, unknown>;
      serverName?: string;
      toolName?: string;
      recoveryHint?: string;
    }
  ) {
    super(message, code, {
      ...options,
      context: {
        ...options?.context,
        serverName: options?.serverName,
        toolName: options?.toolName,
      },
    });
    this.name = 'MCPError';
    this.serverName = options?.serverName;
    this.toolName = options?.toolName;
  }
}

/**
 * Configuration errors
 */
export class ConfigError extends ChrysalisError {
  readonly configKey?: string;

  /**
   *
   * @param message
   * @param code
   * @param options
   * @param options.cause
   * @param options.context
   * @param options.configKey
   * @param options.recoveryHint
   */
  constructor(
    message: string,
    code: ErrorCode = ErrorCodes.CONFIG_INVALID,
    options?: {
      cause?: Error;
      context?: Record<string, unknown>;
      configKey?: string;
      recoveryHint?: string;
    }
  ) {
    super(message, code, {
      ...options,
      context: { ...options?.context, configKey: options?.configKey },
    });
    this.name = 'ConfigError';
    this.configKey = options?.configKey;
  }
}

/**
 * Service errors
 */
export class ServiceError extends ChrysalisError {
  readonly serviceName?: string;

  /**
   *
   * @param message
   * @param code
   * @param options
   * @param options.cause
   * @param options.context
   * @param options.serviceName
   * @param options.recoveryHint
   */
  constructor(
    message: string,
    code: ErrorCode = ErrorCodes.SERVICE_UNAVAILABLE,
    options?: {
      cause?: Error;
      context?: Record<string, unknown>;
      serviceName?: string;
      recoveryHint?: string;
    }
  ) {
    super(message, code, {
      ...options,
      context: { ...options?.context, serviceName: options?.serviceName },
    });
    this.name = 'ServiceError';
    this.serviceName = options?.serviceName;
  }
}

// =============================================================================
// Error Boundary
// =============================================================================

/**
 * Error boundary configuration
 */
export interface ErrorBoundaryConfig {
  onError?: (error: ChrysalisError) => void;
  onRecovery?: (error: ChrysalisError) => void;
  maxRetries: number;
  retryDelayMs: number;
  exponentialBackoff: boolean;
}

const DEFAULT_BOUNDARY_CONFIG: ErrorBoundaryConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
  exponentialBackoff: true,
};

/**
 * Error boundary for wrapping operations with automatic retry
 */
export class ErrorBoundary {
  private config: ErrorBoundaryConfig;
  private retryCount: number = 0;

  /**
   *
   * @param config
   */
  constructor(config?: Partial<ErrorBoundaryConfig>) {
    this.config = { ...DEFAULT_BOUNDARY_CONFIG, ...config };
  }

  /**
   * Execute operation with error handling and retry
   * @param operation
   * @param context
   */
  async execute<T>(
    operation: () => Promise<T>,
    context?: Record<string, unknown>
  ): Promise<T> {
    this.retryCount = 0;

    while (true) {
      try {
        return await operation();
      } catch (error) {
        const chrysalisError = this.normalizeError(error, context);
        
        this.config.onError?.(chrysalisError);

        if (!chrysalisError.recoverable || this.retryCount >= this.config.maxRetries) {
          throw chrysalisError;
        }

        this.retryCount++;
        const delay = this.calculateDelay();
        
        console.warn(
          `[ErrorBoundary] Retry ${this.retryCount}/${this.config.maxRetries} ` +
          `after ${delay}ms: ${chrysalisError.code}`
        );

        await this.sleep(delay);
        this.config.onRecovery?.(chrysalisError);
      }
    }
  }

  /**
   * Normalize any error to ChrysalisError
   * @param error
   * @param context
   */
  private normalizeError(error: unknown, context?: Record<string, unknown>): ChrysalisError {
    if (error instanceof ChrysalisError) {
      return error;
    }

    if (error instanceof Error) {
      return new ChrysalisError(error.message, ErrorCodes.UNKNOWN, {
        cause: error,
        context,
      });
    }

    return new ChrysalisError(String(error), ErrorCodes.UNKNOWN, { context });
  }

  private calculateDelay(): number {
    if (this.config.exponentialBackoff) {
      return this.config.retryDelayMs * Math.pow(2, this.retryCount - 1);
    }
    return this.config.retryDelayMs;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Error Utilities
// =============================================================================

/**
 * Type guard for ChrysalisError
 * @param error
 */
export function isChrysalisError(error: unknown): error is ChrysalisError {
  return error instanceof ChrysalisError;
}

/**
 * Check if error is recoverable
 * @param error
 */
export function isRecoverable(error: unknown): boolean {
  return isChrysalisError(error) && error.recoverable;
}

/**
 * Get error code from any error
 * @param error
 */
export function getErrorCode(error: unknown): ErrorCode {
  if (isChrysalisError(error)) {
    return error.code;
  }
  return ErrorCodes.UNKNOWN;
}

/**
 * Wrap a function with error boundary
 * @param fn
 * @param config
 */
export function withErrorBoundary<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  config?: Partial<ErrorBoundaryConfig>
): T {
  const boundary = new ErrorBoundary(config);
  
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return boundary.execute(() => fn(...args));
  }) as T;
}

/**
 * Create error from response (for HTTP/API errors)
 * @param response
 * @param response.status
 * @param response.statusText
 * @param response.body
 */
export function createErrorFromResponse(
  response: { status: number; statusText: string; body?: any }
): ChrysalisError {
  const codeMap: Record<number, ErrorCode> = {
    400: ErrorCodes.VALIDATION_FAILED,
    404: ErrorCodes.NOT_FOUND,
    409: ErrorCodes.ALREADY_EXISTS,
    429: ErrorCodes.RATE_LIMITED,
    500: ErrorCodes.SERVICE_UNAVAILABLE,
    503: ErrorCodes.SERVICE_UNAVAILABLE,
  };

  const code = codeMap[response.status] ?? ErrorCodes.UNKNOWN;
  
  return new ChrysalisError(
    response.statusText || `HTTP ${response.status}`,
    code,
    {
      context: { status: response.status, body: response.body },
      recoverable: response.status === 429 || response.status >= 500,
      recoveryHint: response.status === 429 ? 'Retry after delay' : undefined,
    }
  );
}
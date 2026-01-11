/**
 * Chrysalis Universal Agent Bridge - Logging Interface
 * 
 * Provides a standardized logging interface with structured context,
 * correlation IDs for distributed tracing, and log level control.
 * 
 * @module bridge/logging
 * @version 1.0.0
 */

import {
  type CorrelationId,
  type ISOTimestamp,
  generateCorrelationId,
  isoTimestamp,
} from './types';

import { type BridgeError, isBridgeError } from './errors';

// ============================================================================
// Log Level Types
// ============================================================================

/**
 * Log levels in order of severity
 */
export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4,
  SILENT: 5,
} as const;

export type LogLevelName = keyof typeof LogLevel;
export type LogLevelValue = typeof LogLevel[LogLevelName];

/**
 * Parse log level from string
 */
export function parseLogLevel(level: string): LogLevelValue {
  const upper = level.toUpperCase() as LogLevelName;
  return LogLevel[upper] ?? LogLevel.INFO;
}

// ============================================================================
// Log Entry Types
// ============================================================================

/**
 * Structured log entry
 */
export interface LogEntry {
  /** Log level */
  level: LogLevelName;
  /** Log message */
  message: string;
  /** ISO timestamp */
  timestamp: ISOTimestamp;
  /** Correlation ID for tracing */
  correlationId?: CorrelationId;
  /** Logger name/component */
  logger?: string;
  /** Structured context data */
  context?: Record<string, unknown>;
  /** Error details */
  error?: LogErrorDetails;
  /** Duration in milliseconds (for timed operations) */
  durationMs?: number;
  /** Additional tags */
  tags?: string[];
}

/**
 * Error details for logging
 */
export interface LogErrorDetails {
  /** Error name */
  name: string;
  /** Error message */
  message: string;
  /** Error code (for BridgeError) */
  code?: string;
  /** Stack trace */
  stack?: string;
  /** Cause chain */
  cause?: LogErrorDetails;
}

// ============================================================================
// Logger Interface
// ============================================================================

/**
 * Logger interface for dependency injection
 */
export interface ILogger {
  /** Log debug message */
  debug(message: string, context?: LogContext): void;
  
  /** Log info message */
  info(message: string, context?: LogContext): void;
  
  /** Log warning message */
  warn(message: string, context?: LogContext): void;
  
  /** Log error message */
  error(message: string, error?: Error | null, context?: LogContext): void;
  
  /** Log fatal error */
  fatal(message: string, error?: Error | null, context?: LogContext): void;
  
  /** Create child logger with additional context */
  child(context: LogContext): ILogger;
  
  /** Check if level is enabled */
  isLevelEnabled(level: LogLevelName): boolean;
  
  /** Start a timed operation */
  startTimer(operation: string): LogTimer;
}

/**
 * Log context type
 */
export type LogContext = Record<string, unknown>;

/**
 * Timer for measuring operation duration
 */
export interface LogTimer {
  /** End the timer and log the result */
  end(message?: string, context?: LogContext): void;
  /** End with success */
  success(message?: string, context?: LogContext): void;
  /** End with error */
  error(message: string, error?: Error, context?: LogContext): void;
}

// ============================================================================
// Log Transport Interface
// ============================================================================

/**
 * Transport for log output
 */
export interface LogTransport {
  /** Transport name */
  readonly name: string;
  /** Minimum level for this transport */
  level?: LogLevelValue;
  /** Write log entry */
  write(entry: LogEntry): void;
  /** Flush any buffered logs */
  flush?(): void | Promise<void>;
  /** Close the transport */
  close?(): void | Promise<void>;
}

// ============================================================================
// Console Transport
// ============================================================================

/**
 * Console transport options
 */
export interface ConsoleTransportOptions {
  /** Color output (default: true in TTY) */
  colors?: boolean;
  /** Pretty print JSON (default: true in development) */
  pretty?: boolean;
  /** Include timestamp (default: true) */
  timestamp?: boolean;
  /** Include stack traces (default: true) */
  stacks?: boolean;
}

/**
 * Console log transport
 */
export class ConsoleTransport implements LogTransport {
  readonly name = 'console';
  level?: LogLevelValue;
  private options: Required<ConsoleTransportOptions>;

  constructor(options: ConsoleTransportOptions = {}) {
    this.options = {
      colors: options.colors ?? (typeof process !== 'undefined' && process.stdout?.isTTY),
      pretty: options.pretty ?? (process.env.NODE_ENV !== 'production'),
      timestamp: options.timestamp ?? true,
      stacks: options.stacks ?? true,
    };
  }

  write(entry: LogEntry): void {
    const output = this.format(entry);
    
    switch (entry.level) {
      case 'DEBUG':
        console.debug(output);
        break;
      case 'INFO':
        console.info(output);
        break;
      case 'WARN':
        console.warn(output);
        break;
      case 'ERROR':
      case 'FATAL':
        console.error(output);
        break;
    }
  }

  private format(entry: LogEntry): string {
    if (this.options.pretty) {
      return this.formatPretty(entry);
    }
    return this.formatJson(entry);
  }

  private formatPretty(entry: LogEntry): string {
    const parts: string[] = [];
    
    // Timestamp
    if (this.options.timestamp) {
      const time = new Date(entry.timestamp).toISOString().split('T')[1].slice(0, -1);
      parts.push(this.colorize(`[${time}]`, 'dim'));
    }
    
    // Level
    const levelColors: Record<LogLevelName, string> = {
      DEBUG: 'cyan',
      INFO: 'green',
      WARN: 'yellow',
      ERROR: 'red',
      FATAL: 'magenta',
      SILENT: 'dim',
    };
    parts.push(this.colorize(entry.level.padEnd(5), levelColors[entry.level]));
    
    // Logger name
    if (entry.logger) {
      parts.push(this.colorize(`[${entry.logger}]`, 'blue'));
    }
    
    // Correlation ID
    if (entry.correlationId) {
      parts.push(this.colorize(`(${entry.correlationId.slice(0, 12)})`, 'dim'));
    }
    
    // Message
    parts.push(entry.message);
    
    // Duration
    if (entry.durationMs !== undefined) {
      parts.push(this.colorize(`(${entry.durationMs}ms)`, 'dim'));
    }
    
    // Context
    if (entry.context && Object.keys(entry.context).length > 0) {
      parts.push(this.colorize(JSON.stringify(entry.context), 'dim'));
    }
    
    let output = parts.join(' ');
    
    // Error
    if (entry.error && this.options.stacks && entry.error.stack) {
      output += '\n' + this.colorize(entry.error.stack, 'red');
    }
    
    return output;
  }

  private formatJson(entry: LogEntry): string {
    return JSON.stringify(entry);
  }

  private colorize(text: string, color: string): string {
    if (!this.options.colors) return text;
    
    const colors: Record<string, string> = {
      dim: '\x1b[2m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      reset: '\x1b[0m',
    };
    
    return `${colors[color] ?? ''}${text}${colors.reset}`;
  }
}

// ============================================================================
// Logger Implementation
// ============================================================================

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /** Logger name */
  name?: string;
  /** Minimum log level */
  level?: LogLevelValue | LogLevelName;
  /** Log transports */
  transports?: LogTransport[];
  /** Default context */
  context?: LogContext;
  /** Correlation ID */
  correlationId?: CorrelationId;
}

/**
 * Logger implementation
 */
export class Logger implements ILogger {
  private readonly name?: string;
  private readonly level: LogLevelValue;
  private readonly transports: LogTransport[];
  private readonly defaultContext: LogContext;
  private readonly correlationId?: CorrelationId;

  constructor(config: LoggerConfig = {}) {
    this.name = config.name;
    this.level = typeof config.level === 'string' 
      ? parseLogLevel(config.level)
      : config.level ?? LogLevel.INFO;
    this.transports = config.transports ?? [new ConsoleTransport()];
    this.defaultContext = config.context ?? {};
    this.correlationId = config.correlationId;
  }

  debug(message: string, context?: LogContext): void {
    this.log('DEBUG', message, undefined, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('INFO', message, undefined, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('WARN', message, undefined, context);
  }

  error(message: string, error?: Error | null, context?: LogContext): void {
    this.log('ERROR', message, error ?? undefined, context);
  }

  fatal(message: string, error?: Error | null, context?: LogContext): void {
    this.log('FATAL', message, error ?? undefined, context);
  }

  child(context: LogContext): ILogger {
    return new Logger({
      name: this.name,
      level: this.level,
      transports: this.transports,
      context: { ...this.defaultContext, ...context },
      correlationId: this.correlationId,
    });
  }

  isLevelEnabled(level: LogLevelName): boolean {
    return LogLevel[level] >= this.level;
  }

  startTimer(operation: string): LogTimer {
    const startTime = Date.now();
    const logger = this;

    return {
      end(message?: string, context?: LogContext) {
        const durationMs = Date.now() - startTime;
        logger.info(message ?? `${operation} completed`, {
          ...context,
          operation,
          durationMs,
        });
      },
      success(message?: string, context?: LogContext) {
        const durationMs = Date.now() - startTime;
        logger.info(message ?? `${operation} succeeded`, {
          ...context,
          operation,
          durationMs,
          success: true,
        });
      },
      error(message: string, error?: Error, context?: LogContext) {
        const durationMs = Date.now() - startTime;
        logger.error(message, error, {
          ...context,
          operation,
          durationMs,
          success: false,
        });
      },
    };
  }

  /**
   * Set correlation ID for this request
   */
  withCorrelationId(correlationId: CorrelationId): Logger {
    return new Logger({
      name: this.name,
      level: this.level,
      transports: this.transports,
      context: this.defaultContext,
      correlationId,
    });
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private log(
    level: LogLevelName,
    message: string,
    error?: Error,
    context?: LogContext
  ): void {
    if (!this.isLevelEnabled(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: isoTimestamp(new Date()),
      logger: this.name,
      correlationId: this.correlationId ?? (context?.correlationId as CorrelationId),
      context: { ...this.defaultContext, ...context },
      durationMs: context?.durationMs as number | undefined,
      tags: context?.tags as string[] | undefined,
    };

    // Extract error details
    if (error) {
      entry.error = this.extractErrorDetails(error);
    }

    // Clean up context
    if (entry.context) {
      delete entry.context.correlationId;
      delete entry.context.durationMs;
      delete entry.context.tags;
      if (Object.keys(entry.context).length === 0) {
        delete entry.context;
      }
    }

    // Write to all transports
    for (const transport of this.transports) {
      if (transport.level === undefined || LogLevel[level] >= transport.level) {
        try {
          transport.write(entry);
        } catch (e) {
          // Fallback to console
          console.error('Log transport error:', e);
          console.log(JSON.stringify(entry));
        }
      }
    }
  }

  private extractErrorDetails(error: Error): LogErrorDetails {
    const details: LogErrorDetails = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };

    if (isBridgeError(error)) {
      details.code = error.code;
    }

    if (error.cause instanceof Error) {
      details.cause = this.extractErrorDetails(error.cause);
    }

    return details;
  }
}

// ============================================================================
// Async Context for Correlation IDs
// ============================================================================

/**
 * Async local storage for correlation context
 */
class CorrelationContext {
  private currentId?: CorrelationId;
  private readonly storage = new Map<string, unknown>();

  /**
   * Get current correlation ID
   */
  getCorrelationId(): CorrelationId | undefined {
    return this.currentId;
  }

  /**
   * Run with a correlation ID
   */
  run<T>(correlationId: CorrelationId, fn: () => T): T {
    const previous = this.currentId;
    this.currentId = correlationId;
    try {
      return fn();
    } finally {
      this.currentId = previous;
    }
  }

  /**
   * Run with a new correlation ID
   */
  runWithNew<T>(fn: () => T): T {
    return this.run(generateCorrelationId(), fn);
  }

  /**
   * Set context value
   */
  set(key: string, value: unknown): void {
    this.storage.set(key, value);
  }

  /**
   * Get context value
   */
  get<T>(key: string): T | undefined {
    return this.storage.get(key) as T | undefined;
  }
}

/**
 * Global correlation context
 */
export const correlationContext = new CorrelationContext();

// ============================================================================
// Request Context Logger
// ============================================================================

/**
 * Create a request-scoped logger with correlation ID
 */
export function createRequestLogger(
  baseLogger: Logger,
  correlationId?: CorrelationId
): Logger {
  const id = correlationId ?? generateCorrelationId();
  return baseLogger.withCorrelationId(id);
}

// ============================================================================
// Log Decorators
// ============================================================================

/**
 * Decorator to log method entry and exit
 */
export function LogMethod(logger: ILogger): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    const original = descriptor.value;
    const methodName = String(propertyKey);

    descriptor.value = function (...args: unknown[]) {
      const timer = logger.startTimer(`${methodName}`);
      
      logger.debug(`Entering ${methodName}`, {
        args: args.length > 0 ? args : undefined,
      });

      try {
        const result = original.apply(this, args);

        if (result instanceof Promise) {
          return result
            .then((value) => {
              timer.success(`${methodName} completed`);
              return value;
            })
            .catch((error) => {
              timer.error(`${methodName} failed`, error as Error);
              throw error;
            });
        }

        timer.success(`${methodName} completed`);
        return result;
      } catch (error) {
        timer.error(`${methodName} failed`, error as Error);
        throw error;
      }
    };

    return descriptor;
  };
}

// ============================================================================
// Default Logger Instance
// ============================================================================

/**
 * Default logger instance
 */
let defaultLogger: Logger = new Logger({ name: 'chrysalis-bridge' });

/**
 * Get the default logger
 */
export function getLogger(): Logger {
  return defaultLogger;
}

/**
 * Set the default logger
 */
export function setLogger(logger: Logger): void {
  defaultLogger = logger;
}

/**
 * Create a named logger
 */
export function createLogger(name: string, config?: Omit<LoggerConfig, 'name'>): Logger {
  return new Logger({ ...config, name });
}

// ============================================================================
// Null Logger (for testing)
// ============================================================================

/**
 * Null logger that discards all output
 */
export class NullLogger implements ILogger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
  fatal(): void {}
  child(): ILogger { return this; }
  isLevelEnabled(): boolean { return false; }
  startTimer(): LogTimer {
    return {
      end: () => {},
      success: () => {},
      error: () => {},
    };
  }
}

/**
 * Null logger singleton
 */
export const nullLogger = new NullLogger();

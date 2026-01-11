/**
 * Centralized Logger - Unified Logging Infrastructure
 * 
 * Provides structured logging with correlation IDs, log levels, and multiple
 * output sinks. Designed to feed the AI-Led Adaptive Maintenance System.
 * 
 * Features:
 * - Structured JSON logging
 * - Correlation ID propagation
 * - Multiple log levels (trace, debug, info, warn, error, fatal)
 * - Pluggable sinks (console, file, remote)
 * - Context enrichment
 * - Performance metrics integration
 * - Adaptation system hooks
 * 
 * @module observability/CentralizedLogger
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

/**
 * Log levels in order of severity.
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Numeric log level values for comparison.
 */
export const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

/**
 * Log entry structure.
 */
export interface LogEntry {
  /** Unique log entry ID */
  id: string;
  /** Timestamp in ISO format */
  timestamp: string;
  /** Log level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Logger name/category */
  logger: string;
  /** Correlation ID for request tracing */
  correlationId?: string;
  /** Span ID for distributed tracing */
  spanId?: string;
  /** Parent span ID */
  parentSpanId?: string;
  /** Trace ID for distributed tracing */
  traceId?: string;
  /** Additional context */
  context?: Record<string, unknown>;
  /** Error details if applicable */
  error?: ErrorDetails;
  /** Duration in milliseconds for timed operations */
  durationMs?: number;
  /** Source location */
  source?: SourceLocation;
  /** Tags for filtering */
  tags?: string[];
  /** Metrics associated with this log */
  metrics?: Record<string, number>;
}

/**
 * Error details for error logs.
 */
export interface ErrorDetails {
  /** Error name/type */
  name: string;
  /** Error message */
  message: string;
  /** Stack trace */
  stack?: string;
  /** Error code */
  code?: string;
  /** Cause chain */
  cause?: ErrorDetails;
}

/**
 * Source location for log entry.
 */
export interface SourceLocation {
  /** File path */
  file?: string;
  /** Line number */
  line?: number;
  /** Column number */
  column?: number;
  /** Function name */
  function?: string;
}

/**
 * Log sink interface for output destinations.
 */
export interface LogSink {
  /** Sink name */
  name: string;
  /** Write a log entry */
  write(entry: LogEntry): void | Promise<void>;
  /** Flush pending writes */
  flush?(): void | Promise<void>;
  /** Close the sink */
  close?(): void | Promise<void>;
}

/**
 * Logger configuration.
 */
export interface LoggerConfig {
  /** Minimum log level */
  level: LogLevel;
  /** Logger name */
  name: string;
  /** Default context to include */
  defaultContext?: Record<string, unknown>;
  /** Default tags */
  defaultTags?: string[];
  /** Enable source location capture */
  captureSource?: boolean;
  /** Sinks to write to */
  sinks?: LogSink[];
}

/**
 * Span for distributed tracing.
 */
export interface Span {
  /** Span ID */
  spanId: string;
  /** Trace ID */
  traceId: string;
  /** Parent span ID */
  parentSpanId?: string;
  /** Operation name */
  operationName: string;
  /** Start timestamp */
  startTime: number;
  /** End timestamp */
  endTime?: number;
  /** Span status */
  status: 'ok' | 'error' | 'unset';
  /** Span attributes */
  attributes: Record<string, unknown>;
  /** Span events */
  events: SpanEvent[];
  /** Child spans */
  children: Span[];
}

/**
 * Span event.
 */
export interface SpanEvent {
  /** Event name */
  name: string;
  /** Event timestamp */
  timestamp: number;
  /** Event attributes */
  attributes?: Record<string, unknown>;
}

// ============================================================================
// Console Sink
// ============================================================================

/**
 * Console log sink with colored output.
 */
export class ConsoleSink implements LogSink {
  name = 'console';
  private useColors: boolean;
  private prettyPrint: boolean;

  constructor(opts?: { useColors?: boolean; prettyPrint?: boolean }) {
    this.useColors = opts?.useColors ?? true;
    this.prettyPrint = opts?.prettyPrint ?? false;
  }

  private getColor(level: LogLevel): string {
    if (!this.useColors) return '';
    const colors: Record<LogLevel, string> = {
      trace: '\x1b[90m',  // Gray
      debug: '\x1b[36m',  // Cyan
      info: '\x1b[32m',   // Green
      warn: '\x1b[33m',   // Yellow
      error: '\x1b[31m',  // Red
      fatal: '\x1b[35m',  // Magenta
    };
    return colors[level];
  }

  private reset(): string {
    return this.useColors ? '\x1b[0m' : '';
  }

  write(entry: LogEntry): void {
    const color = this.getColor(entry.level);
    const reset = this.reset();
    const levelStr = entry.level.toUpperCase().padEnd(5);
    
    if (this.prettyPrint) {
      const timestamp = new Date(entry.timestamp).toISOString();
      const correlationStr = entry.correlationId ? ` [${entry.correlationId.slice(0, 8)}]` : '';
      const prefix = `${color}${timestamp} ${levelStr}${reset}${correlationStr} [${entry.logger}]`;
      
      console.log(`${prefix} ${entry.message}`);
      
      if (entry.context && Object.keys(entry.context).length > 0) {
        console.log(`  Context: ${JSON.stringify(entry.context, null, 2)}`);
      }
      
      if (entry.error) {
        console.log(`  Error: ${entry.error.name}: ${entry.error.message}`);
        if (entry.error.stack) {
          console.log(`  Stack: ${entry.error.stack}`);
        }
      }
      
      if (entry.durationMs !== undefined) {
        console.log(`  Duration: ${entry.durationMs}ms`);
      }
    } else {
      // JSON output for structured logging
      console.log(JSON.stringify(entry));
    }
  }
}

// ============================================================================
// File Sink
// ============================================================================

/**
 * File log sink for persistent logging.
 */
export class FileSink implements LogSink {
  name = 'file';
  private buffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private filePath: string;
  private maxBufferSize: number;
  private fs: typeof import('fs') | null = null;

  constructor(opts: { filePath: string; maxBufferSize?: number; flushIntervalMs?: number }) {
    this.filePath = opts.filePath;
    this.maxBufferSize = opts.maxBufferSize ?? 100;
    
    // Lazy load fs module
    try {
      this.fs = require('fs');
    } catch {
      console.warn('FileSink: fs module not available');
    }

    if (opts.flushIntervalMs) {
      this.flushInterval = setInterval(() => this.flush(), opts.flushIntervalMs);
    }
  }

  write(entry: LogEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  flush(): void {
    if (!this.fs || this.buffer.length === 0) return;
    
    const lines = this.buffer.map(e => JSON.stringify(e)).join('\n') + '\n';
    this.buffer = [];
    
    try {
      this.fs.appendFileSync(this.filePath, lines);
    } catch (err) {
      console.error('FileSink: Failed to write to file', err);
    }
  }

  close(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush();
  }
}

// ============================================================================
// Adaptation Sink
// ============================================================================

/**
 * Adaptation sink that feeds logs to the AI-Led Maintenance System.
 * 
 * Collects patterns, anomalies, and metrics for proactive maintenance.
 */
export class AdaptationSink implements LogSink {
  name = 'adaptation';
  private eventEmitter: EventEmitter;
  private errorBuffer: LogEntry[] = [];
  private metricsBuffer: Map<string, number[]> = new Map();
  private patternBuffer: Map<string, number> = new Map();
  private maxBufferSize: number;
  private analysisIntervalMs: number;
  private analysisInterval: NodeJS.Timeout | null = null;

  constructor(opts?: {
    maxBufferSize?: number;
    analysisIntervalMs?: number;
    eventEmitter?: EventEmitter;
  }) {
    this.maxBufferSize = opts?.maxBufferSize ?? 1000;
    this.analysisIntervalMs = opts?.analysisIntervalMs ?? 60000; // 1 minute
    this.eventEmitter = opts?.eventEmitter ?? new EventEmitter();
    
    this.startAnalysis();
  }

  /**
   * Get the event emitter for subscribing to adaptation events.
   */
  getEventEmitter(): EventEmitter {
    return this.eventEmitter;
  }

  write(entry: LogEntry): void {
    // Collect errors for pattern analysis
    if (entry.level === 'error' || entry.level === 'fatal') {
      this.errorBuffer.push(entry);
      if (this.errorBuffer.length > this.maxBufferSize) {
        this.errorBuffer.shift();
      }
      
      // Track error patterns
      const pattern = this.extractErrorPattern(entry);
      const count = this.patternBuffer.get(pattern) ?? 0;
      this.patternBuffer.set(pattern, count + 1);
    }

    // Collect metrics
    if (entry.metrics) {
      for (const [key, value] of Object.entries(entry.metrics)) {
        if (!this.metricsBuffer.has(key)) {
          this.metricsBuffer.set(key, []);
        }
        const values = this.metricsBuffer.get(key)!;
        values.push(value);
        if (values.length > this.maxBufferSize) {
          values.shift();
        }
      }
    }

    // Collect duration metrics
    if (entry.durationMs !== undefined) {
      const key = `duration.${entry.logger}`;
      if (!this.metricsBuffer.has(key)) {
        this.metricsBuffer.set(key, []);
      }
      const values = this.metricsBuffer.get(key)!;
      values.push(entry.durationMs);
      if (values.length > this.maxBufferSize) {
        values.shift();
      }
    }
  }

  private extractErrorPattern(entry: LogEntry): string {
    if (entry.error) {
      return `${entry.error.name}:${entry.logger}`;
    }
    return `${entry.level}:${entry.logger}:${entry.message.slice(0, 50)}`;
  }

  private startAnalysis(): void {
    this.analysisInterval = setInterval(() => {
      this.analyzePatterns();
    }, this.analysisIntervalMs);
  }

  private analyzePatterns(): void {
    // Analyze error patterns
    const errorPatterns: Array<{ pattern: string; count: number; severity: string }> = [];
    for (const [pattern, count] of this.patternBuffer) {
      if (count >= 3) { // Threshold for pattern detection
        errorPatterns.push({
          pattern,
          count,
          severity: count >= 10 ? 'high' : count >= 5 ? 'medium' : 'low',
        });
      }
    }

    if (errorPatterns.length > 0) {
      this.eventEmitter.emit('adaptation:error-patterns', {
        timestamp: new Date().toISOString(),
        patterns: errorPatterns,
        totalErrors: this.errorBuffer.length,
      });
    }

    // Analyze metrics for anomalies
    const anomalies: Array<{ metric: string; value: number; threshold: number; type: string }> = [];
    for (const [metric, values] of this.metricsBuffer) {
      if (values.length < 10) continue;
      
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const stdDev = Math.sqrt(
        values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length
      );
      
      const latest = values[values.length - 1];
      const zScore = (latest - avg) / (stdDev || 1);
      
      if (Math.abs(zScore) > 2) { // 2 standard deviations
        anomalies.push({
          metric,
          value: latest,
          threshold: avg + 2 * stdDev,
          type: zScore > 0 ? 'spike' : 'drop',
        });
      }
    }

    if (anomalies.length > 0) {
      this.eventEmitter.emit('adaptation:metric-anomalies', {
        timestamp: new Date().toISOString(),
        anomalies,
      });
    }

    // Clear pattern buffer periodically
    this.patternBuffer.clear();
  }

  /**
   * Get current error patterns for analysis.
   */
  getErrorPatterns(): Map<string, number> {
    return new Map(this.patternBuffer);
  }

  /**
   * Get recent errors for analysis.
   */
  getRecentErrors(limit: number = 100): LogEntry[] {
    return this.errorBuffer.slice(-limit);
  }

  /**
   * Get metrics summary.
   */
  getMetricsSummary(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const summary: Record<string, { avg: number; min: number; max: number; count: number }> = {};
    
    for (const [metric, values] of this.metricsBuffer) {
      if (values.length === 0) continue;
      summary[metric] = {
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length,
      };
    }
    
    return summary;
  }

  close(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }
  }
}

// ============================================================================
// Logger Implementation
// ============================================================================

/**
 * Centralized logger with structured logging and tracing support.
 */
export class CentralizedLogger {
  private config: LoggerConfig;
  private sinks: LogSink[];
  private correlationId?: string;
  private traceId?: string;
  private spanId?: string;
  private parentSpanId?: string;
  private context: Record<string, unknown>;

  constructor(config: LoggerConfig) {
    this.config = config;
    this.sinks = config.sinks ?? [new ConsoleSink()];
    this.context = config.defaultContext ?? {};
  }

  /**
   * Create a child logger with additional context.
   */
  child(context: Record<string, unknown>): CentralizedLogger {
    const childConfig: LoggerConfig = {
      ...this.config,
      defaultContext: { ...this.context, ...context },
    };
    const child = new CentralizedLogger(childConfig);
    child.correlationId = this.correlationId;
    child.traceId = this.traceId;
    child.spanId = this.spanId;
    child.parentSpanId = this.parentSpanId;
    return child;
  }

  /**
   * Set correlation ID for request tracing.
   */
  setCorrelationId(id: string): this {
    this.correlationId = id;
    return this;
  }

  /**
   * Set trace context for distributed tracing.
   */
  setTraceContext(traceId: string, spanId: string, parentSpanId?: string): this {
    this.traceId = traceId;
    this.spanId = spanId;
    this.parentSpanId = parentSpanId;
    return this;
  }

  /**
   * Add context to all subsequent logs.
   */
  addContext(context: Record<string, unknown>): this {
    this.context = { ...this.context, ...context };
    return this;
  }

  /**
   * Check if a log level is enabled.
   */
  isLevelEnabled(level: LogLevel): boolean {
    return LOG_LEVEL_VALUES[level] >= LOG_LEVEL_VALUES[this.config.level];
  }

  /**
   * Create a log entry.
   */
  private createEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error,
    durationMs?: number,
    metrics?: Record<string, number>
  ): LogEntry {
    const entry: LogEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      level,
      message,
      logger: this.config.name,
      correlationId: this.correlationId,
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      context: { ...this.context, ...context },
      tags: this.config.defaultTags,
      durationMs,
      metrics,
    };

    if (error) {
      entry.error = this.serializeError(error);
    }

    if (this.config.captureSource) {
      entry.source = this.captureSource();
    }

    return entry;
  }

  /**
   * Serialize an error for logging.
   */
  private serializeError(error: Error): ErrorDetails {
    const details: ErrorDetails = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };

    if ((error as any).code) {
      details.code = (error as any).code;
    }

    if (error.cause instanceof Error) {
      details.cause = this.serializeError(error.cause);
    }

    return details;
  }

  /**
   * Capture source location.
   */
  private captureSource(): SourceLocation | undefined {
    const stack = new Error().stack;
    if (!stack) return undefined;

    const lines = stack.split('\n');
    // Skip Error, captureSource, createEntry, and the log method
    const callerLine = lines[5];
    if (!callerLine) return undefined;

    const match = callerLine.match(/at\s+(?:(.+?)\s+)?\(?(.+?):(\d+):(\d+)\)?/);
    if (!match) return undefined;

    return {
      function: match[1],
      file: match[2],
      line: parseInt(match[3], 10),
      column: parseInt(match[4], 10),
    };
  }

  /**
   * Write a log entry to all sinks.
   */
  private async write(entry: LogEntry): Promise<void> {
    for (const sink of this.sinks) {
      try {
        await sink.write(entry);
      } catch (err) {
        console.error(`Failed to write to sink ${sink.name}:`, err);
      }
    }
  }

  // Log level methods

  trace(message: string, context?: Record<string, unknown>): void {
    if (!this.isLevelEnabled('trace')) return;
    this.write(this.createEntry('trace', message, context));
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (!this.isLevelEnabled('debug')) return;
    this.write(this.createEntry('debug', message, context));
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (!this.isLevelEnabled('info')) return;
    this.write(this.createEntry('info', message, context));
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (!this.isLevelEnabled('warn')) return;
    this.write(this.createEntry('warn', message, context));
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    if (!this.isLevelEnabled('error')) return;
    this.write(this.createEntry('error', message, context, error));
  }

  fatal(message: string, error?: Error, context?: Record<string, unknown>): void {
    if (!this.isLevelEnabled('fatal')) return;
    this.write(this.createEntry('fatal', message, context, error));
  }

  /**
   * Log with timing information.
   */
  timed(
    level: LogLevel,
    message: string,
    durationMs: number,
    context?: Record<string, unknown>,
    metrics?: Record<string, number>
  ): void {
    if (!this.isLevelEnabled(level)) return;
    this.write(this.createEntry(level, message, context, undefined, durationMs, metrics));
  }

  /**
   * Create a timer for measuring operation duration.
   */
  startTimer(operationName: string): () => void {
    const startTime = performance.now();
    return () => {
      const durationMs = performance.now() - startTime;
      this.timed('info', `${operationName} completed`, durationMs, { operation: operationName });
    };
  }

  /**
   * Wrap an async function with timing.
   */
  async withTiming<T>(
    operationName: string,
    fn: () => Promise<T>,
    context?: Record<string, unknown>
  ): Promise<T> {
    const startTime = performance.now();
    try {
      const result = await fn();
      const durationMs = performance.now() - startTime;
      this.timed('info', `${operationName} completed`, durationMs, {
        ...context,
        operation: operationName,
        success: true,
      });
      return result;
    } catch (error) {
      const durationMs = performance.now() - startTime;
      this.timed('error', `${operationName} failed`, durationMs, {
        ...context,
        operation: operationName,
        success: false,
      });
      throw error;
    }
  }

  /**
   * Add a sink.
   */
  addSink(sink: LogSink): this {
    this.sinks.push(sink);
    return this;
  }

  /**
   * Remove a sink by name.
   */
  removeSink(name: string): this {
    this.sinks = this.sinks.filter(s => s.name !== name);
    return this;
  }

  /**
   * Flush all sinks.
   */
  async flush(): Promise<void> {
    for (const sink of this.sinks) {
      if (sink.flush) {
        await sink.flush();
      }
    }
  }

  /**
   * Close all sinks.
   */
  async close(): Promise<void> {
    for (const sink of this.sinks) {
      if (sink.close) {
        await sink.close();
      }
    }
  }
}

// ============================================================================
// Distributed Tracing
// ============================================================================

/**
 * Distributed tracing manager.
 */
export class TracingManager {
  private activeSpans: Map<string, Span> = new Map();
  private completedSpans: Span[] = [];
  private maxCompletedSpans: number;
  private logger: CentralizedLogger;

  constructor(logger: CentralizedLogger, opts?: { maxCompletedSpans?: number }) {
    this.logger = logger;
    this.maxCompletedSpans = opts?.maxCompletedSpans ?? 1000;
  }

  /**
   * Start a new trace.
   */
  startTrace(operationName: string, attributes?: Record<string, unknown>): Span {
    const traceId = uuidv4();
    const spanId = uuidv4();
    
    const span: Span = {
      spanId,
      traceId,
      operationName,
      startTime: Date.now(),
      status: 'unset',
      attributes: attributes ?? {},
      events: [],
      children: [],
    };

    this.activeSpans.set(spanId, span);
    this.logger.setTraceContext(traceId, spanId);
    this.logger.debug(`Trace started: ${operationName}`, { traceId, spanId });

    return span;
  }

  /**
   * Start a child span.
   */
  startSpan(parentSpan: Span, operationName: string, attributes?: Record<string, unknown>): Span {
    const spanId = uuidv4();
    
    const span: Span = {
      spanId,
      traceId: parentSpan.traceId,
      parentSpanId: parentSpan.spanId,
      operationName,
      startTime: Date.now(),
      status: 'unset',
      attributes: attributes ?? {},
      events: [],
      children: [],
    };

    parentSpan.children.push(span);
    this.activeSpans.set(spanId, span);
    this.logger.setTraceContext(parentSpan.traceId, spanId, parentSpan.spanId);
    this.logger.debug(`Span started: ${operationName}`, { traceId: span.traceId, spanId, parentSpanId: parentSpan.spanId });

    return span;
  }

  /**
   * Add an event to a span.
   */
  addEvent(span: Span, name: string, attributes?: Record<string, unknown>): void {
    span.events.push({
      name,
      timestamp: Date.now(),
      attributes,
    });
  }

  /**
   * Set span status.
   */
  setStatus(span: Span, status: 'ok' | 'error', message?: string): void {
    span.status = status;
    if (message) {
      span.attributes['status.message'] = message;
    }
  }

  /**
   * End a span.
   */
  endSpan(span: Span): void {
    span.endTime = Date.now();
    this.activeSpans.delete(span.spanId);
    
    // Only store root spans in completed
    if (!span.parentSpanId) {
      this.completedSpans.push(span);
      if (this.completedSpans.length > this.maxCompletedSpans) {
        this.completedSpans.shift();
      }
    }

    const durationMs = span.endTime - span.startTime;
    this.logger.timed('info', `Span ended: ${span.operationName}`, durationMs, {
      traceId: span.traceId,
      spanId: span.spanId,
      status: span.status,
    });
  }

  /**
   * Get active spans.
   */
  getActiveSpans(): Span[] {
    return Array.from(this.activeSpans.values());
  }

  /**
   * Get completed traces.
   */
  getCompletedTraces(limit: number = 100): Span[] {
    return this.completedSpans.slice(-limit);
  }

  /**
   * Wrap an async function with tracing.
   */
  async withSpan<T>(
    parentSpan: Span | null,
    operationName: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Record<string, unknown>
  ): Promise<T> {
    const span = parentSpan
      ? this.startSpan(parentSpan, operationName, attributes)
      : this.startTrace(operationName, attributes);

    try {
      const result = await fn(span);
      this.setStatus(span, 'ok');
      return result;
    } catch (error) {
      this.setStatus(span, 'error', (error as Error).message);
      this.addEvent(span, 'exception', {
        'exception.type': (error as Error).name,
        'exception.message': (error as Error).message,
        'exception.stacktrace': (error as Error).stack,
      });
      throw error;
    } finally {
      this.endSpan(span);
    }
  }
}

// ============================================================================
// Global Logger Factory
// ============================================================================

let globalLogger: CentralizedLogger | null = null;
let globalTracer: TracingManager | null = null;
let globalAdaptationSink: AdaptationSink | null = null;

/**
 * Initialize the global logger.
 */
export function initializeLogger(config?: Partial<LoggerConfig>): CentralizedLogger {
  const adaptationSink = new AdaptationSink();
  globalAdaptationSink = adaptationSink;

  const defaultConfig: LoggerConfig = {
    level: (process.env.LOG_LEVEL as LogLevel) ?? 'info',
    name: 'chrysalis',
    captureSource: process.env.NODE_ENV !== 'production',
    sinks: [
      new ConsoleSink({ prettyPrint: process.env.NODE_ENV !== 'production' }),
      adaptationSink,
    ],
    ...config,
  };

  globalLogger = new CentralizedLogger(defaultConfig);
  globalTracer = new TracingManager(globalLogger);

  return globalLogger;
}

/**
 * Get the global logger.
 */
export function getLogger(name?: string): CentralizedLogger {
  if (!globalLogger) {
    initializeLogger();
  }
  
  if (name) {
    return globalLogger!.child({ component: name });
  }
  
  return globalLogger!;
}

/**
 * Get the global tracer.
 */
export function getTracer(): TracingManager {
  if (!globalTracer) {
    initializeLogger();
  }
  return globalTracer!;
}

/**
 * Get the adaptation sink for AI-led maintenance.
 */
export function getAdaptationSink(): AdaptationSink | null {
  return globalAdaptationSink;
}

/**
 * Create a correlation ID for request tracing.
 */
export function createCorrelationId(): string {
  return uuidv4();
}

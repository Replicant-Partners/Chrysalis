/**
 * Observability System
 * 
 * Provides distributed tracing, metrics, and logging infrastructure.
 * Designed for OpenTelemetry integration when available, with fallback
 * to console-based observability for local development.
 * 
 * @module Observability
 * @version 1.0.0
 * @status Implemented
 * 
 * HIGH-002: Observability integration now formally implemented.
 * 
 * User Value: Support can diagnose sync failures for elders,
 * identify performance bottlenecks, and track system health.
 */

import { createLogger as createSharedLogger } from '../shared/logger';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Span context for distributed tracing
 */
export interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  sampled: boolean;
}

/**
 * Span attributes
 */
export type SpanAttributes = Record<string, string | number | boolean | string[]>;

/**
 * Span status
 */
export type SpanStatus = 'ok' | 'error' | 'unset';

/**
 * Span information
 */
export interface SpanInfo {
  name: string;
  context: SpanContext;
  startTime: number;
  endTime?: number;
  status: SpanStatus;
  attributes: SpanAttributes;
  events: SpanEvent[];
  links: SpanContext[];
}

/**
 * Span event
 */
export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: SpanAttributes;
}

/**
 * Metric types
 */
export type MetricType = 'counter' | 'gauge' | 'histogram';

/**
 * Metric value
 */
export interface MetricValue {
  name: string;
  type: MetricType;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

/**
 * Log level
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Structured log entry
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  traceId?: string;
  spanId?: string;
  attributes?: Record<string, unknown>;
}

// =============================================================================
// ID GENERATION
// =============================================================================

/**
 * Generate a random trace ID (32 hex characters)
 */
function generateTraceId(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a random span ID (16 hex characters)
 */
function generateSpanId(): string {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 8; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// =============================================================================
// SPAN IMPLEMENTATION
// =============================================================================

/**
 * A span represents a unit of work or operation
 */
export class Span {
  private _name: string;
  private _context: SpanContext;
  private _startTime: number;
  private _endTime?: number;
  private _status: SpanStatus = 'unset';
  private _attributes: SpanAttributes = {};
  private _events: SpanEvent[] = [];
  private _links: SpanContext[] = [];
  private _tracer: Tracer;
  private _ended = false;
  
  constructor(
    name: string,
    tracer: Tracer,
    parentContext?: SpanContext
  ) {
    this._name = name;
    this._tracer = tracer;
    this._startTime = Date.now();
    
    this._context = {
      traceId: parentContext?.traceId ?? generateTraceId(),
      spanId: generateSpanId(),
      parentSpanId: parentContext?.spanId,
      sampled: true
    };
  }
  
  get name(): string {
    return this._name;
  }
  
  get context(): SpanContext {
    return this._context;
  }
  
  get isEnded(): boolean {
    return this._ended;
  }
  
  /**
   * Set span attribute
   */
  setAttribute(key: string, value: string | number | boolean | string[]): this {
    if (!this._ended) {
      this._attributes[key] = value;
    }
    return this;
  }
  
  /**
   * Set multiple attributes
   */
  setAttributes(attributes: SpanAttributes): this {
    if (!this._ended) {
      Object.assign(this._attributes, attributes);
    }
    return this;
  }
  
  /**
   * Record an event
   */
  addEvent(name: string, attributes?: SpanAttributes): this {
    if (!this._ended) {
      this._events.push({
        name,
        timestamp: Date.now(),
        attributes
      });
    }
    return this;
  }
  
  /**
   * Set span status
   */
  setStatus(status: SpanStatus, message?: string): this {
    if (!this._ended) {
      this._status = status;
      if (message) {
        this._attributes['status.message'] = message;
      }
    }
    return this;
  }
  
  /**
   * Record an exception
   */
  recordException(error: Error): this {
    this.setStatus('error', error.message);
    this.addEvent('exception', {
      'exception.type': error.name,
      'exception.message': error.message,
      'exception.stacktrace': error.stack || ''
    });
    return this;
  }
  
  /**
   * Add a link to another span
   */
  addLink(context: SpanContext): this {
    if (!this._ended) {
      this._links.push(context);
    }
    return this;
  }
  
  /**
   * End the span
   */
  end(): void {
    if (!this._ended) {
      this._endTime = Date.now();
      this._ended = true;
      this._tracer.recordSpan(this.toSpanInfo());
    }
  }
  
  /**
   * Get span info for recording
   */
  toSpanInfo(): SpanInfo {
    return {
      name: this._name,
      context: this._context,
      startTime: this._startTime,
      endTime: this._endTime,
      status: this._status,
      attributes: { ...this._attributes },
      events: [...this._events],
      links: [...this._links]
    };
  }
}

// =============================================================================
// TRACER IMPLEMENTATION
// =============================================================================

export type SpanExporter = (span: SpanInfo) => void;

/**
 * Tracer for creating and managing spans
 */
export class Tracer {
  private _name: string;
  private _version: string;
  private _activeSpan?: Span;
  private _spans: SpanInfo[] = [];
  private _exporters: SpanExporter[] = [];
  private _maxSpans = 1000;
  
  constructor(name: string, version: string = '1.0.0') {
    this._name = name;
    this._version = version;
  }
  
  get name(): string {
    return this._name;
  }
  
  get version(): string {
    return this._version;
  }
  
  get activeSpan(): Span | undefined {
    return this._activeSpan;
  }
  
  /**
   * Start a new span
   */
  startSpan(
    name: string,
    options?: {
      parent?: SpanContext;
      attributes?: SpanAttributes;
    }
  ): Span {
    const parentContext = options?.parent ?? this._activeSpan?.context;
    const span = new Span(name, this, parentContext);
    
    if (options?.attributes) {
      span.setAttributes(options.attributes);
    }
    
    // Set standard attributes
    span.setAttributes({
      'telemetry.sdk.name': 'chrysalis',
      'telemetry.sdk.version': this._version,
      'service.name': this._name
    });
    
    this._activeSpan = span;
    return span;
  }
  
  /**
   * Start an active span with automatic context management
   */
  async startActiveSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    options?: {
      parent?: SpanContext;
      attributes?: SpanAttributes;
    }
  ): Promise<T> {
    const span = this.startSpan(name, options);
    
    try {
      const result = await fn(span);
      if (!span.isEnded) {
        span.setStatus('ok').end();
      }
      return result;
    } catch (error) {
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      span.end();
      throw error;
    }
  }
  
  /**
   * Record a completed span
   */
  recordSpan(span: SpanInfo): void {
    this._spans.push(span);
    
    // Enforce max spans
    if (this._spans.length > this._maxSpans) {
      this._spans = this._spans.slice(-this._maxSpans);
    }
    
    // Export to all exporters
    for (const exporter of this._exporters) {
      try {
        exporter(span);
      } catch {
        // Ignore exporter errors
      }
    }
  }
  
  /**
   * Add a span exporter
   */
  addExporter(exporter: SpanExporter): void {
    this._exporters.push(exporter);
  }
  
  /**
   * Get all recorded spans
   */
  getSpans(): SpanInfo[] {
    return [...this._spans];
  }
  
  /**
   * Clear recorded spans
   */
  clearSpans(): void {
    this._spans = [];
  }
}

// =============================================================================
// METRICS
// =============================================================================

export type MetricExporter = (metric: MetricValue) => void;

/**
 * Metrics collector for counters, gauges, and histograms
 */
export class MetricsCollector {
  private _counters: Map<string, number> = new Map();
  private _gauges: Map<string, number> = new Map();
  private _histograms: Map<string, number[]> = new Map();
  private _exporters: MetricExporter[] = [];
  
  /**
   * Increment a counter
   */
  incrementCounter(
    name: string,
    value: number = 1,
    labels: Record<string, string> = {}
  ): void {
    const key = this.makeKey(name, labels);
    const current = this._counters.get(key) ?? 0;
    this._counters.set(key, current + value);
    
    this.export({
      name,
      type: 'counter',
      value: current + value,
      labels,
      timestamp: Date.now()
    });
  }
  
  /**
   * Set a gauge value
   */
  setGauge(
    name: string,
    value: number,
    labels: Record<string, string> = {}
  ): void {
    const key = this.makeKey(name, labels);
    this._gauges.set(key, value);
    
    this.export({
      name,
      type: 'gauge',
      value,
      labels,
      timestamp: Date.now()
    });
  }
  
  /**
   * Record a histogram observation
   */
  recordHistogram(
    name: string,
    value: number,
    labels: Record<string, string> = {}
  ): void {
    const key = this.makeKey(name, labels);
    const observations = this._histograms.get(key) ?? [];
    observations.push(value);
    
    // Keep last 1000 observations
    if (observations.length > 1000) {
      observations.shift();
    }
    this._histograms.set(key, observations);
    
    this.export({
      name,
      type: 'histogram',
      value,
      labels,
      timestamp: Date.now()
    });
  }
  
  /**
   * Record operation duration
   */
  recordDuration(
    name: string,
    startTime: number,
    labels: Record<string, string> = {}
  ): void {
    const duration = Date.now() - startTime;
    this.recordHistogram(`${name}_duration_ms`, duration, labels);
  }
  
  /**
   * Get counter value
   */
  getCounter(name: string, labels: Record<string, string> = {}): number {
    return this._counters.get(this.makeKey(name, labels)) ?? 0;
  }
  
  /**
   * Get gauge value
   */
  getGauge(name: string, labels: Record<string, string> = {}): number | undefined {
    return this._gauges.get(this.makeKey(name, labels));
  }
  
  /**
   * Get histogram statistics
   */
  getHistogramStats(
    name: string,
    labels: Record<string, string> = {}
  ): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  } | undefined {
    const observations = this._histograms.get(this.makeKey(name, labels));
    if (!observations || observations.length === 0) return undefined;
    
    const sorted = [...observations].sort((a, b) => a - b);
    const count = sorted.length;
    
    return {
      count,
      min: sorted[0],
      max: sorted[count - 1],
      avg: sorted.reduce((a, b) => a + b, 0) / count,
      p50: sorted[Math.floor(count * 0.5)],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)]
    };
  }
  
  /**
   * Add metric exporter
   */
  addExporter(exporter: MetricExporter): void {
    this._exporters.push(exporter);
  }
  
  /**
   * Reset all metrics
   */
  reset(): void {
    this._counters.clear();
    this._gauges.clear();
    this._histograms.clear();
  }
  
  private makeKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }
  
  private export(metric: MetricValue): void {
    for (const exporter of this._exporters) {
      try {
        exporter(metric);
      } catch {
        // Ignore exporter errors
      }
    }
  }
}

// =============================================================================
// LOGGER
// =============================================================================

export type LogExporter = (entry: LogEntry) => void;

/**
 * Structured logger with trace context
 */
export class Logger {
  private _name: string;
  private _minLevel: LogLevel = 'info';
  private _exporters: LogExporter[] = [];
  private _tracer?: Tracer;
  private sharedLogger = createSharedLogger('observability');
  
  private static LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };
  
  constructor(name: string, options?: { minLevel?: LogLevel; tracer?: Tracer }) {
    this._name = name;
    this._minLevel = options?.minLevel ?? 'info';
    this._tracer = options?.tracer;
    this.sharedLogger = createSharedLogger(`observability:${name}`);
  }
  
  /**
   * Set minimum log level
   */
  setLevel(level: LogLevel): void {
    this._minLevel = level;
  }
  
  /**
   * Set tracer for context
   */
  setTracer(tracer: Tracer): void {
    this._tracer = tracer;
  }
  
  /**
   * Add log exporter
   */
  addExporter(exporter: LogExporter): void {
    this._exporters.push(exporter);
  }
  
  debug(message: string, attributes?: Record<string, unknown>): void {
    this.log('debug', message, attributes);
  }
  
  info(message: string, attributes?: Record<string, unknown>): void {
    this.log('info', message, attributes);
  }
  
  warn(message: string, attributes?: Record<string, unknown>): void {
    this.log('warn', message, attributes);
  }
  
  error(message: string, attributes?: Record<string, unknown>): void {
    this.log('error', message, attributes);
  }
  
  private log(level: LogLevel, message: string, attributes?: Record<string, unknown>): void {
    if (Logger.LEVEL_PRIORITY[level] < Logger.LEVEL_PRIORITY[this._minLevel]) {
      return;
    }
    
    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      attributes: {
        ...attributes,
        'logger.name': this._name
      }
    };
    
    // Add trace context if available
    const activeSpan = this._tracer?.activeSpan;
    if (activeSpan) {
      entry.traceId = activeSpan.context.traceId;
      entry.spanId = activeSpan.context.spanId;
    }
    
    // Emit via shared logger for unified JSONL output
    const prefix = `[${new Date().toISOString()}] [${level.toUpperCase()}] [${this._name}]`;
    const contextStr = entry.traceId ? ` [trace:${entry.traceId.slice(0, 8)}]` : '';
    this.sharedLogger[level](`${prefix}${contextStr} ${message}`, attributes);
    
    // Export
    for (const exporter of this._exporters) {
      try {
        exporter(entry);
      } catch {
        // Ignore exporter errors
      }
    }
  }
}

// =============================================================================
// OBSERVABILITY PROVIDER
// =============================================================================

/**
 * Central observability provider
 */
export class ObservabilityProvider {
  private _tracer: Tracer;
  private _metrics: MetricsCollector;
  private _logger: Logger;
  
  constructor(serviceName: string, options?: { logLevel?: LogLevel }) {
    this._tracer = new Tracer(serviceName);
    this._metrics = new MetricsCollector();
    this._logger = new Logger(serviceName, {
      minLevel: options?.logLevel ?? 'info',
      tracer: this._tracer
    });
    
    // Add console exporter for spans in development
    if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
      this._tracer.addExporter((span) => {
        const duration = span.endTime ? span.endTime - span.startTime : 0;
        console.log(
          `[SPAN] ${span.name} (${duration}ms) [trace:${span.context.traceId.slice(0, 8)}] status:${span.status}`
        );
      });
    }
  }
  
  get tracer(): Tracer {
    return this._tracer;
  }
  
  get metrics(): MetricsCollector {
    return this._metrics;
  }
  
  get logger(): Logger {
    return this._logger;
  }
  
  /**
   * Create a child logger
   */
  createLogger(name: string): Logger {
    return new Logger(name, { tracer: this._tracer });
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let defaultProvider: ObservabilityProvider | null = null;

/**
 * Get the default observability provider
 */
export function getObservabilityProvider(): ObservabilityProvider {
  if (!defaultProvider) {
    defaultProvider = new ObservabilityProvider('chrysalis');
  }
  return defaultProvider;
}

/**
 * Create a custom observability provider
 */
export function createObservabilityProvider(
  serviceName: string,
  options?: { logLevel?: LogLevel }
): ObservabilityProvider {
  return new ObservabilityProvider(serviceName, options);
}

// =============================================================================
// DECORATORS
// =============================================================================

/**
 * Decorator for automatic span creation
 */
export function traced(spanName?: string) {
  return function (
    _target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: unknown[]) {
      const provider = getObservabilityProvider();
      const name = spanName || `${this?.constructor?.name || 'anonymous'}.${propertyKey}`;
      
      return provider.tracer.startActiveSpan(name, async (span) => {
        span.setAttribute('function.name', propertyKey);
        span.setAttribute('function.args_count', args.length);
        return originalMethod.apply(this, args);
      });
    };
    
    return descriptor;
  };
}

/**
 * Decorator for automatic duration recording
 */
export function timed(metricName?: string) {
  return function (
    _target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: unknown[]) {
      const provider = getObservabilityProvider();
      const name = metricName || `${this?.constructor?.name || 'anonymous'}_${propertyKey}`;
      const startTime = Date.now();
      
      try {
        const result = await originalMethod.apply(this, args);
        provider.metrics.recordDuration(name, startTime, { status: 'ok' });
        return result;
      } catch (error) {
        provider.metrics.recordDuration(name, startTime, { status: 'error' });
        throw error;
      }
    };
    
    return descriptor;
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default ObservabilityProvider;

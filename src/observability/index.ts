/**
 * Chrysalis Observability Module
 * 
 * Centralized OpenTelemetry instrumentation for distributed tracing,
 * metrics collection, and structured logging.
 * 
 * @module observability
 * @see plans/CHRYSALIS_DEVELOPMENT_STREAMLINING_PLAN.md - Item C-1
 * 
 * Usage:
 *   import { initTelemetry, trace, metrics, logger } from './observability';
 *   
 *   // Initialize at application startup
 *   await initTelemetry({ serviceName: 'chrysalis-gateway' });
 *   
 *   // Use throughout application
 *   const span = trace.startSpan('operation-name');
 *   metrics.morphOperations.add(1);
 *   logger.info('Operation completed', { duration: 42 });
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { Resource } from '@opentelemetry/resources';
import { 
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_DEPLOYMENT_ENVIRONMENT 
} from '@opentelemetry/semantic-conventions';
import {
  trace as otelTrace,
  metrics as otelMetrics,
  context,
  SpanKind,
  SpanStatusCode,
  Span,
  Tracer,
  Meter,
  Counter,
  Histogram,
  UpDownCounter,
} from '@opentelemetry/api';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { getConfig } from '../core/config';

// =============================================================================
// Types
// =============================================================================

export interface TelemetryConfig {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  otlpEndpoint?: string;
  metricsPort?: number;
  enableAutoInstrumentation?: boolean;
  enableConsoleExporter?: boolean;
}

export interface ChrysalisMetrics {
  // Morph operations
  morphOperations: Counter;
  morphDuration: Histogram;
  morphErrors: Counter;
  
  // Memory operations
  memoryOperations: Counter;
  memoryStoreSize: UpDownCounter;
  memoryRetrievalDuration: Histogram;
  
  // LLM operations
  llmRequests: Counter;
  llmTokensUsed: Counter;
  llmLatency: Histogram;
  llmErrors: Counter;
  
  // Agent lifecycle
  activeAgents: UpDownCounter;
  agentSpawnDuration: Histogram;
  
  // General
  httpRequestDuration: Histogram;
  httpRequestsTotal: Counter;
}

// =============================================================================
// Module State
// =============================================================================

let sdk: NodeSDK | null = null;
let tracer: Tracer | null = null;
let meter: Meter | null = null;
let chrysalisMetrics: ChrysalisMetrics | null = null;
let initialized = false;

// =============================================================================
// Initialization
// =============================================================================

/**
 * Initialize OpenTelemetry SDK with Chrysalis-specific configuration.
 * Must be called before any other observability functions.
 */
export async function initTelemetry(config?: Partial<TelemetryConfig>): Promise<void> {
  if (initialized) {
    console.warn('[Observability] Already initialized, skipping...');
    return;
  }

  const appConfig = getConfig();
  
  const telemetryConfig: TelemetryConfig = {
    serviceName: config?.serviceName ?? process.env.OTEL_SERVICE_NAME ?? 'chrysalis-unknown',
    serviceVersion: config?.serviceVersion ?? appConfig.app.version ?? '0.0.0',
    environment: config?.environment ?? appConfig.env,
    otlpEndpoint: config?.otlpEndpoint ?? 
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 
      appConfig.observability.otlpEndpoint,
    metricsPort: config?.metricsPort ?? 
      parseInt(process.env.CHRYSALIS_METRICS_PORT ?? '9090', 10),
    enableAutoInstrumentation: config?.enableAutoInstrumentation ?? true,
    enableConsoleExporter: config?.enableConsoleExporter ?? appConfig.debug,
  };

  // Skip if observability is disabled
  if (!appConfig.observability.enabled && !process.env.CHRYSALIS_OTEL_ENABLED) {
    console.log('[Observability] Disabled by configuration');
    initialized = true;
    return;
  }

  const resource = new Resource({
    [ATTR_SERVICE_NAME]: telemetryConfig.serviceName,
    [ATTR_SERVICE_VERSION]: telemetryConfig.serviceVersion,
    [ATTR_DEPLOYMENT_ENVIRONMENT]: telemetryConfig.environment,
    'chrysalis.component': telemetryConfig.serviceName.replace('chrysalis-', ''),
  });

  // Configure trace exporter
  const traceExporter = new OTLPTraceExporter({
    url: `${telemetryConfig.otlpEndpoint}/v1/traces`,
  });

  // Configure metric exporters
  const metricExporters = [];
  
  // OTLP exporter for Jaeger/Grafana
  if (telemetryConfig.otlpEndpoint) {
    metricExporters.push(
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          url: `${telemetryConfig.otlpEndpoint}/v1/metrics`,
        }),
        exportIntervalMillis: 10000,
      })
    );
  }

  // Prometheus exporter for scraping
  const prometheusExporter = new PrometheusExporter({
    port: telemetryConfig.metricsPort,
    preventServerStart: false,
  });

  // Build SDK configuration
  const sdkConfig: any = {
    resource,
    traceExporter,
    metricReader: prometheusExporter,
  };

  if (telemetryConfig.enableAutoInstrumentation) {
    sdkConfig.instrumentations = [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ];
  }

  // Initialize SDK
  sdk = new NodeSDK(sdkConfig);

  try {
    sdk.start();
    console.log(`[Observability] SDK started for ${telemetryConfig.serviceName}`);
    console.log(`[Observability] Prometheus metrics at http://localhost:${telemetryConfig.metricsPort}/metrics`);
    
    // Initialize tracer and meter
    tracer = otelTrace.getTracer(telemetryConfig.serviceName, telemetryConfig.serviceVersion);
    meter = otelMetrics.getMeter(telemetryConfig.serviceName, telemetryConfig.serviceVersion);
    
    // Initialize Chrysalis-specific metrics
    chrysalisMetrics = createChrysalisMetrics(meter);
    
    initialized = true;
  } catch (error) {
    console.error('[Observability] Failed to start SDK:', error);
    throw error;
  }
}

/**
 * Gracefully shutdown telemetry SDK.
 * Should be called during application shutdown.
 */
export async function shutdownTelemetry(): Promise<void> {
  if (sdk) {
    try {
      await sdk.shutdown();
      console.log('[Observability] SDK shutdown complete');
    } catch (error) {
      console.error('[Observability] SDK shutdown error:', error);
    }
  }
  initialized = false;
  sdk = null;
  tracer = null;
  meter = null;
  chrysalisMetrics = null;
}

// =============================================================================
// Metrics Factory
// =============================================================================

function createChrysalisMetrics(meter: Meter): ChrysalisMetrics {
  return {
    // Morph operations
    morphOperations: meter.createCounter('chrysalis.morph.operations', {
      description: 'Total number of agent morph operations',
      unit: '1',
    }),
    morphDuration: meter.createHistogram('chrysalis.morph.duration', {
      description: 'Duration of morph operations in milliseconds',
      unit: 'ms',
    }),
    morphErrors: meter.createCounter('chrysalis.morph.errors', {
      description: 'Total number of morph operation errors',
      unit: '1',
    }),

    // Memory operations
    memoryOperations: meter.createCounter('chrysalis.memory.operations', {
      description: 'Total number of memory operations',
      unit: '1',
    }),
    memoryStoreSize: meter.createUpDownCounter('chrysalis.memory.store_size', {
      description: 'Current size of memory stores',
      unit: 'By',
    }),
    memoryRetrievalDuration: meter.createHistogram('chrysalis.memory.retrieval_duration', {
      description: 'Duration of memory retrieval operations',
      unit: 'ms',
    }),

    // LLM operations
    llmRequests: meter.createCounter('chrysalis.llm.requests', {
      description: 'Total LLM API requests',
      unit: '1',
    }),
    llmTokensUsed: meter.createCounter('chrysalis.llm.tokens_used', {
      description: 'Total tokens consumed by LLM operations',
      unit: '1',
    }),
    llmLatency: meter.createHistogram('chrysalis.llm.latency', {
      description: 'LLM request latency',
      unit: 'ms',
    }),
    llmErrors: meter.createCounter('chrysalis.llm.errors', {
      description: 'Total LLM API errors',
      unit: '1',
    }),

    // Agent lifecycle
    activeAgents: meter.createUpDownCounter('chrysalis.agents.active', {
      description: 'Number of currently active agents',
      unit: '1',
    }),
    agentSpawnDuration: meter.createHistogram('chrysalis.agents.spawn_duration', {
      description: 'Time to spawn a new agent',
      unit: 'ms',
    }),

    // HTTP
    httpRequestDuration: meter.createHistogram('chrysalis.http.request_duration', {
      description: 'HTTP request duration',
      unit: 'ms',
    }),
    httpRequestsTotal: meter.createCounter('chrysalis.http.requests_total', {
      description: 'Total HTTP requests',
      unit: '1',
    }),
  };
}

// =============================================================================
// Tracing API
// =============================================================================

/**
 * Get the Chrysalis tracer instance.
 * Returns a no-op tracer if not initialized.
 */
export function getTracer(): Tracer {
  return tracer ?? otelTrace.getTracer('chrysalis-noop');
}

/**
 * Start a new span for tracing an operation.
 */
export function startSpan(
  name: string,
  options?: {
    kind?: SpanKind;
    attributes?: Record<string, string | number | boolean>;
  }
): Span {
  return getTracer().startSpan(name, {
    kind: options?.kind ?? SpanKind.INTERNAL,
    attributes: options?.attributes,
  });
}

/**
 * Execute a function within a traced span.
 * Automatically handles span lifecycle and error recording.
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  options?: {
    kind?: SpanKind;
    attributes?: Record<string, string | number | boolean>;
  }
): Promise<T> {
  const span = startSpan(name, options);
  
  try {
    const result = await context.with(
      otelTrace.setSpan(context.active(), span),
      () => fn(span)
    );
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Decorator for tracing class methods.
 */
export function Traced(
  spanName?: string,
  options?: { kind?: SpanKind }
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const name = spanName ?? `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      return withSpan(name, async (span) => {
        span.setAttribute('chrysalis.method', propertyKey);
        span.setAttribute('chrysalis.class', target.constructor.name);
        return originalMethod.apply(this, args);
      }, options);
    };

    return descriptor;
  };
}

// =============================================================================
// Metrics API
// =============================================================================

/**
 * Get Chrysalis-specific metrics.
 * Returns metrics that record to no-op if not initialized.
 */
export function getMetrics(): ChrysalisMetrics {
  if (!chrysalisMetrics) {
    // Return no-op metrics
    const noopMeter = otelMetrics.getMeter('chrysalis-noop');
    return createChrysalisMetrics(noopMeter);
  }
  return chrysalisMetrics;
}

/**
 * Record a timed operation with automatic duration metric.
 */
export async function recordTimed<T>(
  histogram: Histogram,
  fn: () => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const duration = performance.now() - start;
    histogram.record(duration, attributes);
  }
}

// =============================================================================
// Structured Logging
// =============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Structured logger with OpenTelemetry context propagation.
 */
export const logger = {
  debug(message: string, context?: LogContext): void {
    logMessage('debug', message, context);
  },
  
  info(message: string, context?: LogContext): void {
    logMessage('info', message, context);
  },
  
  warn(message: string, context?: LogContext): void {
    logMessage('warn', message, context);
  },
  
  error(message: string, error?: Error, context?: LogContext): void {
    const errorContext = error ? {
      ...context,
      error_message: error.message,
      error_name: error.name,
      error_stack: error.stack?.split('\n')[0],
    } : context;
    logMessage('error', message, errorContext);
  },
};

function logMessage(level: LogLevel, message: string, context?: LogContext): void {
  const activeSpan = otelTrace.getActiveSpan();
  const traceId = activeSpan?.spanContext().traceId;
  const spanId = activeSpan?.spanContext().spanId;

  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    trace_id: traceId,
    span_id: spanId,
    ...context,
  };

  const output = JSON.stringify(logEntry);
  
  switch (level) {
    case 'debug':
      console.debug(output);
      break;
    case 'info':
      console.info(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    case 'error':
      console.error(output);
      break;
  }
}

// =============================================================================
// Express Middleware
// =============================================================================

/**
 * Express middleware for request tracing and metrics.
 */
export function observabilityMiddleware() {
  return async (req: any, res: any, next: any) => {
    const metrics = getMetrics();
    const startTime = performance.now();
    
    // Start request span
    const span = startSpan(`HTTP ${req.method} ${req.path}`, {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': req.method,
        'http.url': req.url,
        'http.route': req.route?.path ?? req.path,
        'http.user_agent': req.headers['user-agent'] ?? 'unknown',
      },
    });

    // Inject span into request for downstream use
    req.span = span;
    
    // Capture response
    res.on('finish', () => {
      const duration = performance.now() - startTime;
      
      span.setAttribute('http.status_code', res.statusCode);
      span.setStatus({
        code: res.statusCode < 400 ? SpanStatusCode.OK : SpanStatusCode.ERROR,
      });
      span.end();

      // Record metrics
      metrics.httpRequestsTotal.add(1, {
        method: req.method,
        route: req.route?.path ?? req.path,
        status: res.statusCode.toString(),
      });
      metrics.httpRequestDuration.record(duration, {
        method: req.method,
        route: req.route?.path ?? req.path,
      });
    });

    next();
  };
}

// =============================================================================
// Exports
// =============================================================================

export {
  SpanKind,
  SpanStatusCode,
  Span,
  Tracer,
  Meter,
  context,
};

// Re-export for convenience
export const trace = {
  getTracer,
  startSpan,
  withSpan,
  getActiveSpan: otelTrace.getActiveSpan,
};

export const metrics = {
  getMetrics,
  recordTimed,
};
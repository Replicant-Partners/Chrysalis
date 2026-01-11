/**
 * Observability Module - Unified Observability Infrastructure
 * 
 * Provides comprehensive observability capabilities for the Chrysalis system:
 * - Centralized structured logging with correlation IDs
 * - Distributed tracing with span management
 * - Metrics collection (Prometheus, OpenTelemetry)
 * - Real-time event streaming (Voyeur)
 * - Health monitoring and alerting
 * - AI-Led Adaptation hooks
 * 
 * @module observability
 * @version 2.0.0
 */

// Centralized Logger
export {
  CentralizedLogger,
  LogLevel,
  LOG_LEVEL_VALUES,
  LogEntry,
  ErrorDetails,
  SourceLocation,
  LogSink,
  LoggerConfig,
  Span,
  SpanEvent,
  ConsoleSink,
  FileSink,
  AdaptationSink,
  TracingManager,
  initializeLogger,
  getLogger,
  getTracer,
  getAdaptationSink,
  createCorrelationId,
} from './CentralizedLogger';

// Observability Hub
export {
  ObservabilityHub,
  ObservabilityConfig,
  HealthStatus,
  HealthCheckResult,
  SystemHealth,
  Alert,
  SystemMetrics,
  AdaptationEventType,
  AdaptationEvent,
  initializeObservability,
  getObservabilityHub,
  logger,
  tracer,
} from './ObservabilityHub';

// Voyeur Events
export {
  VoyeurBus,
  VoyeurEvent,
  VoyeurEventKind,
  VoyeurSink,
} from './VoyeurEvents';

// Voyeur Web Server
export { startVoyeurWebServer } from './VoyeurWebServer';

// Console Voyeur Sink
export { ConsoleVoyeurSink } from './ConsoleVoyeurSink';

// Metrics
export {
  MetricsSink,
  VectorOpMetric,
  VectorMetricKind,
  PrometheusMetricsSink,
  OtelMetricsSink,
  CombinedMetricsSink,
  createMetricsSinkFromEnv,
} from './Metrics';

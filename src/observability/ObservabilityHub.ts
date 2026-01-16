/**
 * Observability Hub - Unified Observability Infrastructure
 *
 * Integrates logging, tracing, metrics into a single coherent
 * observability system that feeds the AI-Led Adaptive Maintenance System.
 *
 * Features:
 * - Unified API for all observability concerns
 * - Correlation across logs, traces, and metrics
 * - Adaptation hooks for proactive maintenance
 * - Health monitoring and alerting
 *
 * @module observability/ObservabilityHub
 * @version 2.0.0
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  CentralizedLogger,
  LoggerConfig,
  LogLevel,
  LogEntry,
  AdaptationSink,
  TracingManager,
  Span,
  ConsoleSink,
  getLogger,
  getTracer,
  getAdaptationSink,
  initializeLogger,
  createCorrelationId,
} from './CentralizedLogger';
import {
  MetricsSink,
  VectorOpMetric,
  createMetricsSinkFromEnv,
} from './Metrics';

// ============================================================================
// Types
// ============================================================================

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface HealthCheckResult {
  component: string;
  status: HealthStatus;
  message?: string;
  responseTimeMs?: number;
  lastCheck: string;
  details?: Record<string, unknown>;
}

export interface SystemHealth {
  status: HealthStatus;
  timestamp: string;
  components: HealthCheckResult[];
  alerts: Alert[];
  metrics: SystemMetrics;
}

export interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  source: string;
  triggeredAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  context?: Record<string, unknown>;
}

export interface SystemMetrics {
  totalLogs: number;
  errorCount: number;
  warningCount: number;
  activeTraces: number;
  completedTraces: number;
  avgResponseTimeMs: number;
  uptimeSeconds: number;
}

export interface ObservabilityConfig {
  logger?: Partial<LoggerConfig>;
  enablePrometheus?: boolean;
  prometheusPort?: number;
  enableOtel?: boolean;
  healthCheckIntervalMs?: number;
  enableAdaptation?: boolean;
  adaptationIntervalMs?: number;
}

export type AdaptationEventType =
  | 'error-patterns'
  | 'metric-anomalies'
  | 'health-degradation'
  | 'performance-regression'
  | 'resource-exhaustion';

export interface AdaptationEvent {
  type: AdaptationEventType;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  data: Record<string, unknown>;
  recommendedActions?: string[];
}

// ============================================================================
// Observability Hub Implementation
// ============================================================================

export class ObservabilityHub extends EventEmitter {
  private config: ObservabilityConfig;
  private logger: CentralizedLogger;
  private tracer: TracingManager;
  private metricsSink?: MetricsSink;
  private adaptationSink?: AdaptationSink;
  private healthChecks: Map<string, () => Promise<HealthCheckResult>> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private startTime: number;
  private healthCheckInterval?: NodeJS.Timeout;
  private logCounts = { total: 0, errors: 0, warnings: 0 };
  private lastHealthStatus?: HealthStatus;

  constructor(config: ObservabilityConfig = {}) {
    super();
    this.config = config;
    this.startTime = Date.now();

    this.logger = initializeLogger(config.logger);
    this.tracer = getTracer();
    this.adaptationSink = getAdaptationSink() ?? undefined;

    if (config.enablePrometheus || config.enableOtel) {
      this.metricsSink = createMetricsSinkFromEnv();
    }

    if (config.enableAdaptation && this.adaptationSink) {
      this.setupAdaptationHooks();
    }

    if (config.healthCheckIntervalMs) {
      this.startHealthChecks(config.healthCheckIntervalMs);
    }

    this.logger.info('ObservabilityHub initialized', {
      config: {
        enablePrometheus: config.enablePrometheus,
        enableOtel: config.enableOtel,
        enableAdaptation: config.enableAdaptation,
      },
    });
  }

  getLogger(component: string): CentralizedLogger {
    return this.logger.child({ component });
  }

  withCorrelation(correlationId?: string): CentralizedLogger {
    const id = correlationId ?? createCorrelationId();
    return this.logger.child({}).setCorrelationId(id);
  }

  getTracer(): TracingManager {
    return this.tracer;
  }

  startTrace(operationName: string, attributes?: Record<string, unknown>): Span {
    return this.tracer.startTrace(operationName, attributes);
  }

  async withTrace<T>(
    operationName: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Record<string, unknown>
  ): Promise<T> {
    return this.tracer.withSpan(null, operationName, fn, attributes);
  }

  recordVectorOp(metric: VectorOpMetric): void {
    if (this.metricsSink) {
      this.metricsSink.recordVectorOp(metric);
    }
  }

  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    this.logger.timed('debug', `Metric: ${name}`, value, { metricName: name, ...tags });
  }

  registerHealthCheck(name: string, check: () => Promise<HealthCheckResult>): void {
    this.healthChecks.set(name, check);
    this.logger.debug(`Health check registered: ${name}`);
  }

  unregisterHealthCheck(name: string): void {
    this.healthChecks.delete(name);
  }

  async runHealthChecks(): Promise<SystemHealth> {
    const results: HealthCheckResult[] = [];

    for (const [name, check] of this.healthChecks) {
      try {
        const startTime = performance.now();
        const result = await check();
        result.responseTimeMs = performance.now() - startTime;
        results.push(result);
      } catch (error) {
        results.push({
          component: name,
          status: 'unhealthy',
          message: (error as Error).message,
          lastCheck: new Date().toISOString(),
        });
      }
    }

    let overallStatus: HealthStatus = 'healthy';
    if (results.some(r => r.status === 'unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (results.some(r => r.status === 'degraded')) {
      overallStatus = 'degraded';
    }

    if (this.lastHealthStatus && this.lastHealthStatus !== overallStatus) {
      this.handleHealthStatusChange(this.lastHealthStatus, overallStatus, results);
    }
    this.lastHealthStatus = overallStatus;

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      components: results,
      alerts: Array.from(this.alerts.values()),
      metrics: this.getSystemMetrics(),
    };
  }

  private handleHealthStatusChange(
    previous: HealthStatus,
    current: HealthStatus,
    results: HealthCheckResult[]
  ): void {
    if (current === 'unhealthy' || current === 'degraded') {
      const unhealthyComponents = results.filter(r => r.status !== 'healthy');
      this.createAlert({
        severity: current === 'unhealthy' ? 'critical' : 'warning',
        title: `System health ${current}`,
        message: `System health changed from ${previous} to ${current}`,
        source: 'health-monitor',
        context: { unhealthyComponents: unhealthyComponents.map(c => c.component) },
      });

      this.emitAdaptationEvent({
        type: 'health-degradation',
        timestamp: new Date().toISOString(),
        severity: current === 'unhealthy' ? 'critical' : 'high',
        data: { previousStatus: previous, currentStatus: current, unhealthyComponents },
        recommendedActions: [
          'Review unhealthy component logs',
          'Check resource utilization',
          'Verify external dependencies',
        ],
      });
    }
  }

  private startHealthChecks(intervalMs: number): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.runHealthChecks();
      } catch (error) {
        this.logger.error('Health check failed', error as Error);
      }
    }, intervalMs);
  }

  getSystemMetrics(): SystemMetrics {
    const adaptationMetrics = this.adaptationSink?.getMetricsSummary() ?? {};
    const avgResponseTime = adaptationMetrics['duration.chrysalis']?.avg ?? 0;

    return {
      totalLogs: this.logCounts.total,
      errorCount: this.logCounts.errors,
      warningCount: this.logCounts.warnings,
      activeTraces: this.tracer.getActiveSpans().length,
      completedTraces: this.tracer.getCompletedTraces().length,
      avgResponseTimeMs: avgResponseTime,
      uptimeSeconds: (Date.now() - this.startTime) / 1000,
    };
  }

  createAlert(alert: Omit<Alert, 'id' | 'triggeredAt'>): Alert {
    const fullAlert: Alert = {
      ...alert,
      id: uuidv4(),
      triggeredAt: new Date().toISOString(),
    };

    this.alerts.set(fullAlert.id, fullAlert);
    this.emit('alert:created', fullAlert);
    this.logger.warn(`Alert created: ${alert.title}`, { alert: fullAlert });

    return fullAlert;
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.acknowledgedAt = new Date().toISOString();
    this.emit('alert:acknowledged', alert);
    this.logger.info(`Alert acknowledged: ${alert.title}`, { alertId });

    return true;
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.resolvedAt = new Date().toISOString();
    this.alerts.delete(alertId);
    this.emit('alert:resolved', alert);
    this.logger.info(`Alert resolved: ${alert.title}`, { alertId });

    return true;
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(a => !a.resolvedAt);
  }

  private setupAdaptationHooks(): void {
    if (!this.adaptationSink) return;

    const emitter = this.adaptationSink.getEventEmitter();

    emitter.on('adaptation:error-patterns', (data) => {
      this.emitAdaptationEvent({
        type: 'error-patterns',
        timestamp: data.timestamp,
        severity: this.calculateSeverity(data.patterns),
        data,
        recommendedActions: this.generateErrorPatternActions(data.patterns),
      });
    });

    emitter.on('adaptation:metric-anomalies', (data) => {
      this.emitAdaptationEvent({
        type: 'metric-anomalies',
        timestamp: data.timestamp,
        severity: this.calculateAnomalySeverity(data.anomalies),
        data,
        recommendedActions: this.generateAnomalyActions(data.anomalies),
      });
    });
  }

  private calculateSeverity(patterns: Array<{ severity: string }>): AdaptationEvent['severity'] {
    if (patterns.some(p => p.severity === 'high')) return 'high';
    if (patterns.some(p => p.severity === 'medium')) return 'medium';
    return 'low';
  }

  private calculateAnomalySeverity(anomalies: Array<{ type: string }>): AdaptationEvent['severity'] {
    if (anomalies.length >= 5) return 'critical';
    if (anomalies.length >= 3) return 'high';
    if (anomalies.length >= 1) return 'medium';
    return 'low';
  }

  private generateErrorPatternActions(patterns: Array<{ pattern: string; count: number }>): string[] {
    const actions: string[] = [];
    for (const pattern of patterns) {
      if (pattern.count >= 10) actions.push(`Investigate recurring error: ${pattern.pattern}`);
      if (pattern.pattern.includes('timeout')) actions.push('Review timeout configurations');
      if (pattern.pattern.includes('connection')) actions.push('Check network connectivity');
    }
    return actions.length > 0 ? actions : ['Review error logs for patterns'];
  }

  private generateAnomalyActions(anomalies: Array<{ metric: string; type: string }>): string[] {
    const actions: string[] = [];
    for (const anomaly of anomalies) {
      if (anomaly.type === 'spike' && anomaly.metric.includes('duration')) {
        actions.push(`Investigate performance degradation in ${anomaly.metric}`);
      }
      if (anomaly.type === 'spike' && anomaly.metric.includes('error')) {
        actions.push(`Review error spike in ${anomaly.metric}`);
      }
    }
    return actions.length > 0 ? actions : ['Review metric dashboards'];
  }

  emitAdaptationEvent(event: AdaptationEvent): void {
    this.emit('adaptation:event', event);
    this.logger.info(`Adaptation event: ${event.type}`, { adaptationEvent: event });

    if (event.severity === 'high' || event.severity === 'critical') {
      this.createAlert({
        severity: event.severity === 'critical' ? 'critical' : 'error',
        title: `Adaptation: ${event.type}`,
        message: `Detected ${event.type} requiring attention`,
        source: 'adaptation-system',
        context: event.data,
      });
    }
  }

  getAdaptationInsights(): {
    errorPatterns: Map<string, number>;
    recentErrors: LogEntry[];
    metricsSummary: Record<string, { avg: number; min: number; max: number; count: number }>;
  } {
    if (!this.adaptationSink) {
      return { errorPatterns: new Map(), recentErrors: [], metricsSummary: {} };
    }
    return {
      errorPatterns: this.adaptationSink.getErrorPatterns(),
      recentErrors: this.adaptationSink.getRecentErrors(),
      metricsSummary: this.adaptationSink.getMetricsSummary(),
    };
  }

  async shutdown(): Promise<void> {
    this.logger.info('ObservabilityHub shutting down');
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    await this.logger.flush();
    await this.logger.close();
    this.emit('shutdown');
  }
}

// ============================================================================
// Global Hub Instance
// ============================================================================

let globalHub: ObservabilityHub | null = null;

export function initializeObservability(config?: ObservabilityConfig): ObservabilityHub {
  if (globalHub) return globalHub;
  globalHub = new ObservabilityHub({
    enableAdaptation: true,
    healthCheckIntervalMs: 60000,
    ...config,
  });
  return globalHub;
}

export function getObservabilityHub(): ObservabilityHub {
  if (!globalHub) return initializeObservability();
  return globalHub;
}

export function logger(component?: string): CentralizedLogger {
  return getObservabilityHub().getLogger(component ?? 'default');
}

export function tracer(): TracingManager {
  return getObservabilityHub().getTracer();
}

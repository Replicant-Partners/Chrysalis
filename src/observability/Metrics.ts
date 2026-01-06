/**
 * Optional metrics sinks (Prometheus, OpenTelemetry).
 * Designed to be safe when dependencies are absent.
 */

export type VectorMetricKind = 'vector.upsert' | 'vector.query';

export interface VectorOpMetric {
  kind: VectorMetricKind;
  backend: string;
  latencyMs: number;
  size?: number;
}

export interface MetricsSink {
  recordVectorOp(metric: VectorOpMetric): void;
}

/**
 * Prometheus sink (prom-client). No-op if prom-client is not installed.
 */
export class PrometheusMetricsSink implements MetricsSink {
  private prom: any | null;
  private histogram: any | null;
  private counter: any | null;
  private register: any | null;
  private serverStarted = false;

  constructor(opts?: { namespace?: string }) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ns = opts?.namespace || 'chrysalis';
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.prom = require('prom-client');
      this.register = this.prom.register;
      this.histogram = new this.prom.Histogram({
        name: `${ns}_vector_latency_ms`,
        help: 'Vector operation latency (ms)',
        labelNames: ['kind', 'backend'],
        buckets: [1, 5, 10, 25, 50, 100, 200, 500]
      });
      this.counter = new this.prom.Counter({
        name: `${ns}_vector_ops_total`,
        help: 'Vector operations',
        labelNames: ['kind', 'backend']
      });
    } catch (err) {
      this.prom = null;
      this.register = null;
      this.histogram = null;
      this.counter = null;
      // Intentionally silent; metrics are optional.
    }
  }

  recordVectorOp(metric: VectorOpMetric): void {
    if (!this.histogram || !this.counter) return;
    this.histogram.labels(metric.kind, metric.backend).observe(metric.latencyMs);
    this.counter.labels(metric.kind, metric.backend).inc();
  }

  async startServer(port: number = 9464): Promise<void> {
    if (!this.register || this.serverStarted) return;
    const http = await import('http');
    const server = http.createServer(async (_req, res) => {
      res.statusCode = 200;
      res.setHeader('Content-Type', this.register?.contentType || 'text/plain');
      const body = await this.register.metrics();
      res.end(body);
    });
    return new Promise((resolve) => {
      server.listen(port, () => {
        this.serverStarted = true;
        resolve();
      });
    });
  }
}

/**
 * OpenTelemetry sink. No-op if @opentelemetry/api is not installed.
 */
export class OtelMetricsSink implements MetricsSink {
  private meter: any | null;
  private histogram: any | null;
  private counter: any | null;

  constructor(opts?: { name?: string }) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const api = require('@opentelemetry/api');
      this.meter = api.metrics.getMeter(opts?.name || 'chrysalis');
      this.histogram = this.meter.createHistogram('chrysalis.vector.latency', {
        description: 'Vector operation latency (ms)'
      });
      this.counter = this.meter.createCounter('chrysalis.vector.ops', {
        description: 'Vector operations'
      });
    } catch (err) {
      this.meter = null;
      this.histogram = null;
      this.counter = null;
    }
  }

  recordVectorOp(metric: VectorOpMetric): void {
    if (!this.histogram || !this.counter) return;
    this.histogram.record(metric.latencyMs, { kind: metric.kind, backend: metric.backend });
    this.counter.add(1, { kind: metric.kind, backend: metric.backend });
  }
}

export class CombinedMetricsSink implements MetricsSink {
  private sinks: MetricsSink[];
  constructor(sinks: MetricsSink[]) {
    this.sinks = sinks;
  }
  recordVectorOp(metric: VectorOpMetric): void {
    for (const sink of this.sinks) {
      sink.recordVectorOp(metric);
    }
  }
}

export function createMetricsSinkFromEnv(): MetricsSink | undefined {
  const sinks: MetricsSink[] = [];
  const enableProm = (process.env.METRICS_PROMETHEUS || '').toLowerCase() === 'true';
  const enableOtel = (process.env.METRICS_OTEL || '').toLowerCase() === 'true';

  if (enableProm) {
    const promSink = new PrometheusMetricsSink();
    const port = process.env.METRICS_PROM_PORT ? parseInt(process.env.METRICS_PROM_PORT, 10) : undefined;
    promSink.startServer(port || 9464).catch(() => {
      // Ignore start errors to avoid breaking app
    });
    sinks.push(promSink);
  }

  if (enableOtel) {
    const otelSink = new OtelMetricsSink();
    sinks.push(otelSink);
  }

  if (!sinks.length) return undefined;
  if (sinks.length === 1) return sinks[0];
  return new CombinedMetricsSink(sinks);
}

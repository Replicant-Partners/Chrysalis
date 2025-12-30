#!/usr/bin/env node
import { PrometheusMetricsSink } from '../observability/Metrics';

async function main() {
  const port = process.env.METRICS_PROM_PORT ? parseInt(process.env.METRICS_PROM_PORT, 10) : 9464;
  const sink = new PrometheusMetricsSink();
  await sink.startServer(port);
  console.log(`Prometheus metrics server listening on :${port}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start metrics server', err);
  process.exit(1);
});

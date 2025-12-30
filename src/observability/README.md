# Observability Helpers

## Components
- `VoyeurEvents.ts`: event bus/types for ingest/merge/sync observability.
- `VoyeurWebServer.ts`: SSE viewer + stream; serves simple HTML at `/` and stream at `/voyeur-stream`.
- `ConsoleVoyeurSink.ts`: console sink for voyeur events.
- `Metrics.ts`: optional Prometheus/OTel sinks for vector ops.
- `../cli/metrics-server.ts`: simple Prometheus exporter for metrics sinks.

## Quick Start
```bash
# Build
npm run build

# Metrics (Prometheus) on :9464
METRICS_PROMETHEUS=true METRICS_PROM_PORT=9464 node dist/cli/metrics-server.js

# Voyeur SSE server (inside your app)
import { VoyeurBus } from './VoyeurEvents';
import { startVoyeurWebServer } from './VoyeurWebServer';

const bus = new VoyeurBus({ slowModeMs: 0 });
startVoyeurWebServer(bus, { port: 8787, redact: true });
// attach bus to MemoryMerger via config { voyeur: bus }

# View
open http://localhost:8787
```

## Env Flags
- `METRICS_PROMETHEUS=true` (and `METRICS_PROM_PORT`) to expose /metrics.
- `METRICS_OTEL=true` to emit via @opentelemetry/api.

## Privacy/Redaction
- Use `redact: true` for SSE server; default sinks should avoid content unless explicitly debugging.
- Pair with sanitizer/rate-limit in MemoryMerger to block unwanted content.

## References
- Prometheus exposition: https://prometheus.io/docs/instrumenting/exposition_formats/
- OpenTelemetry metrics API: https://opentelemetry.io/docs/specs/otel/metrics/api/
- SSE spec: https://html.spec.whatwg.org/multipage/server-sent-events.html

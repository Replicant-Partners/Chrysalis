# Voyeur Observability Mode

## Purpose
Surface what agents are “thinking” during ingest/merge with optional slow-motion playback for human-speed inspection.

## Implementation Sketch
- **Event bus**: `VoyeurBus` in `src/observability/VoyeurEvents.ts` with pluggable sinks and optional `slowModeMs`.
- **Event schema**: `VoyeurEvent` with kinds `ingest.start`, `embed.request`, `match.candidate`, `match.none`, `merge.applied`, `merge.deferred`, `error`.
- **Integration**: `MemoryMerger` now emits events (hash-only by default) on ingest, match, add, dedupe. Slow mode can be enabled via config `slow_mode_ms`.
- **Privacy**: Emit hashes + metadata; redact content by default. Allow explicit opt-in to include content for local-debug sinks only.
- **UI hooks**: Tail stream (CLI), WebSocket broadcast for dashboards, OTLP export for traces. Slow-mo can be toggled by setting `slowModeMs` on `VoyeurBus` or config.
- **Metrics**: Optional Prometheus/OTel sinks (`METRICS_PROMETHEUS=true`, `METRICS_PROM_PORT=9464`, `METRICS_OTEL=true`) via `createMetricsSinkFromEnv()`.
- **CLI tail**: `src/cli/voyeurTail.ts` can attach a console sink; combine with metrics server (`src/cli/metrics-server.ts`) for quick dashboards.

## UX Ideas
- Timeline view of merge steps with latency + decisions.
- “Thought bubble” overlay showing current action (embed, match, merge).
- Play/pause + speed control for demos or reviews.

## References
- OpenTelemetry tracing for long-lived flows.  
- Human-in-the-loop review patterns from active learning literature.  
- Slow-motion debugging inspired by step-through debuggers (e.g., Elm time travel).

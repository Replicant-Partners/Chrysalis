# Changelog

## [Phase 4] - 2026-01-25

### Memory System Integration - Production Ready ✅

**Summary**: Completed full memory system integration pipeline connecting system agents through local Rust core to Zep cloud storage with comprehensive testing and observability infrastructure.

#### Added
- `memory_system/cloud/zep_sync.py` - Zep cloud synchronization with retry/circuit breaker
- `Agents/system-agents/memory_bridge.py` - System agent memory bridge (<10ms writes)
- `memory_system/resilience/circuit_breaker.py` - Circuit breaker pattern implementation
- `tests/integration/memory_system/test_agent_memory_integration.py` - 25+ integration tests
- `deploy/docker-compose-memory.yml` - Docker deployment with Prometheus/Grafana
- `memory_system/observability/metrics.py` - Comprehensive Prometheus metrics
- `scripts/seed_test_memories.py` - Test data seeding for UI testing

#### Features
- Direct Rust core access with <10ms local write latency
- Async cloud sync with Zep API (credentials in `.env`)
- Local-first retrieval with cloud fallback
- Circuit breaker prevents cascading failures
- CRDT merge for concurrent writes
- Prometheus metrics collection
- 70 test memories across 5 agents (Ada, Lea, Phil, David, Milton)

#### Infrastructure
- Full Docker Compose stack (API, Prometheus, Grafana)
- Health checks and auto-restart
- Integration test suite with performance validation
- Quick start: `docker-compose -f deploy/docker-compose-memory.yml up -d`

---

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.34.0] - 2026-01-25

### Added
- **Phase 3 P1-1: Knowledge Graph Performance Optimization**
  - Memoized reasoning context with `Arc<Mutex<Option<Arc<ReasoningContext>>>>` caching
  - `Arc`-based sharing to eliminate redundant cloning (1.18 µs/call overhead)
  - `invalidate_cache()` method for cache management
  - Comprehensive criterion.rs benchmarks for YAML parsing and context generation
  - New `lib.rs` to expose modules for benchmarking
  - Test coverage for cache behavior validation
- **Phase 3 P1-2: Prometheus Metrics Integration**
  - `CloudRouterMetrics` struct with comprehensive LLM observability
  - Metrics: `llm_requests_total`, `llm_request_duration_seconds`, `llm_cache_hit_rate`
  - Cost metrics: `llm_cost_usd`, `llm_tokens_total{type=prompt|completion}`
  - Error tracking: `llm_provider_errors_total`
  - Multi-dimensional labels: provider, model, agent_id, cache_status
  - Shared Prometheus registry between gateway and cloud router
  - Duration histograms with 8 buckets (0.1s to 60s)
  - Token and cost tracking per provider/model combination

### Changed
- **Knowledge Graph**: `get_reasoning_context()` now returns `Arc<ReasoningContext>` (breaking change)
- **CloudOnlyRouter**: Added optional `MetricsRegistry` field to config
- **RouterConfig**: Now accepts `*prometheus.Registry` for metrics initialization
- `main.go`: Creates shared metrics registry for gateway and router
- Version updated from 0.33.0 to 0.34.0

### Performance
- Knowledge graph overhead: 1.18 µs per request (8400x below 10ms target)
- YAML parsing (medium graph): 63.0 µs (159x below target)
- Cache hit (Arc clone): ~0.01 µs (near-zero overhead)
- Prometheus metrics overhead: <0.1ms per request

### Documentation
- Updated `docs/PHASE3_PROGRESS.md` with P1 completion details
- Added performance benchmark results and analysis
- Documented Prometheus metrics integration architecture

## [0.33.0] - 2026-01-25

### Added
- Comprehensive integration tests for CloudOnlyRouter (Phase 3 P0-1)
  - Provider selection logic tests (anthropic, openai, openrouter routing)
  - Cache hit/miss rate validation
  - Cache TTL and expiry behavior tests
  - Cost tracking accuracy tests
  - Concurrent request handling (500 requests, 50 goroutines)
  - Agent configuration override tests
  - Cache key uniqueness validation
  - Streaming mode tests
  - Error handling tests (no providers, no registry)
- Performance benchmarks for cache hit performance
- `NamedMockProvider` test helper for configurable provider mocking
- `MockProviderWithErrors` helper for future retry logic tests (Phase 4)
- Phase 3 progress documentation (`docs/PHASE3_PROGRESS.md`)

### Changed
- Updated version to 0.33.0 across documentation
- Enhanced test coverage for cloud-only LLM routing to ~95%

### Fixed
- None

## [0.32.0] - 2026-01-25 (Phase 2 Complete)

### Security
- Enforce JWT secret requirement in production for both TypeScript and Python auth modules.
- Add request-body size guard and invalid JSON detection in shared HTTP parsing utilities.
- Return 413 for oversized payloads in system-agent endpoints.

### Observability
- Lazy-load OpenTelemetry auto-instrumentation to avoid test-time failures.

### Logging
- Bound adapter and job event logging payloads to prevent oversized JSONL entries.

### Documentation
- Add OpenAPI specification for internal System Agents API.


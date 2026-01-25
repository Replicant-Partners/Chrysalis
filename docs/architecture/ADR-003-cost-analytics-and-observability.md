# ADR-003: Cost Analytics and Prometheus Observability Integration

**Status**: Accepted  
**Date**: 2026-01-25  
**Decision Makers**: Development Team  
**Technical Story**: Phase 3 production readiness - cost tracking, prediction, and comprehensive observability

## Context

With the cloud-only LLM architecture in place (ADR-001), production deployment requires:

1. **Cost Visibility**: Track and predict cloud LLM API costs to prevent budget overruns
2. **Operation Observability**: Monitor system health, performance, and usage patterns
3. **Capacity Planning**: Historical data for trend analysis and capacity decisions
4. **Alert Systems**: Proactive notifications for budget thresholds and anomalies

Without structured cost analytics and metrics, operators lack visibility into:
- Real-time spending rates
- Cost trends over time
- Budget violation predictions  
- Performance degradations
- Cache effectiveness
- Provider reliability

## Decision

**Implement comprehensive cost analytics with historical tracking and Prometheus metrics integration for production observability.**

### Key Components

#### 1. Cost Analytics System (`cost_analytics.go`)

**Purpose**: Track, analyze, and predict LLM API costs

**Features**:
- Historical snapshot recording (1-minute intervals, 24-hour rolling buffer)
- Monthly cost prediction with confidence scoring
- 4-tier spending alert system (50%, 75%, 90%, 100% of budget)
- Trend analysis (1-hour, 24-hour, 7-day periods)
- Budget overage prediction

**Data Structures**:
```go
type CostAnalytics struct {
    tracker          *CostTracker
    history          []CostSnapshot  // Time-ordered snapshots
    maxHistorySize   int             // Default: 1440 (24hrs @ 1min)
    snapshotInterval time.Duration   // Default: 1 minute
}

type CostSnapshot struct {
    Timestamp    time.Time
    DailySpend   float64
    MonthlySpend float64
    TotalSpend   float64
    RequestCount int64
    TokenCount   int64
}

type CostPrediction struct {
    PredictedMonthlyTotal float64
    Confidence            float64  // 0.0-1.0
    DaysElapsed           int
    DaysRemaining         int
    BudgetOverageRisk     bool
}
```

**HTTP Endpoints**:
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/costs` | GET | Combined view: prediction + trends + alerts |
| `/v1/costs/history` | GET | Historical snapshots (query param: `?since=RFC3339`) |
| `/v1/costs/prediction` | GET | Monthly cost prediction only |
| `/v1/costs/alerts` | GET | Active spending alerts |

**Performance Characteristics**:
- Snapshot overhead: ~0.1ms (state copy)
- History lookup: O(n) with n ≤ 1440  
- Memory footprint: ~140KB for 24 hours
- Concurrency: Read-optimized with `sync.RWMutex`

#### 2. Prometheus Metrics (`cloud_router_metrics.go`)

**Purpose**: Production-grade observability for CloudOnlyRouter

**Metrics**:

| Metric Name | Type | Labels | Description |
|-------------|------|--------|-------------|
| `llm_requests_total` | Counter | provider, model, agent_id, cache_status | Total LLM requests |
| `llm_request_duration_seconds` | Histogram | provider, model | Request duration (buckets: 0.1s to 60s) |
| `llm_cache_hit_rate` | Gauge | agent_id | Cache effectiveness (0.0-1.0) |
| `llm_cost_usd` | Counter | provider, model | Cumulative cost in USD |
| `llm_tokens_total` | Counter | type, provider, model | Token usage (prompt/completion) |
| `llm_provider_errors_total` | Counter | provider | Provider failures |

**Integration**:
- Single Prometheus registry shared between gateway and router
- Metrics recorded inline with minimal overhead (<0.1ms per request)
- Standard `/metrics` endpoint (existing in `server.go`)
- Thread-safe via Prometheus built-in concurrency primitives

**Label Dimensions**:
- **Provider**: openrouter, anthropic, openai
- **Model**: claude-3-haiku, gpt-5.2, etc.  
- **Agent ID**: ada, lea, phil, david, milton
- **Cache Status**: hit, miss, expired
- **Token Type**: prompt, completion

### Architecture

```mermaid
flowchart TB
    subgraph Gateway["Go Gateway (Port 8080)"]
        Router[CloudOnlyRouter]
        CostTracker[CostTracker]
        CostAnalytics[CostAnalytics]
        Metrics[PrometheusMetrics]
        SnapshotTicker[Background Snapshot Ticker]
    end
    
    subgraph HTTPEndpoints["HTTP API"]
        MetricsEndpoint["/metrics (Prometheus)"]
        CostsEndpoint["/v1/costs"]
        HistoryEndpoint["/v1/costs/history"]
        PredictionEndpoint["/v1/costs/prediction"]
        AlertsEndpoint["/v1/costs/alerts"]
    end
    
    subgraph Monitoring["Monitoring Stack"]
        Prometheus[Prometheus Server]
        Grafana[Grafana Dashboard]
        AlertManager[Alert Manager]
    end
    
    Router --> CostTracker
    Router --> Metrics
    CostTracker --> CostAnalytics
    SnapshotTicker -->|Every 1min| CostAnalytics
    
    Metrics --> MetricsEndpoint
    CostAnalytics --> CostsEndpoint
    CostAnalytics --> HistoryEndpoint
    CostAnalytics --> PredictionEndpoint
    CostAnalytics --> AlertsEndpoint
    
    MetricsEndpoint --> Prometheus
    Prometheus --> Grafana
    Prometheus --> AlertManager
```

## Consequences

### Positive

1. **Cost Control**
   - Real-time visibility into spending
   - Predictive alerts prevent budget overruns
   - Historical trends inform capacity planning
   - Per-model/provider cost breakdown

2. **Operational Excellence**
   - Standard Prometheus metrics for dashboards
   - Integration with existing monitoring infrastructure
   - Performance tracking across multiple dimensions
   - Cache effectiveness monitoring

3. **Debugging & Optimization**
   - Request latency histograms identify slow providers  
   - Error counters track provider reliability
   - Cache hit rates guide caching strategy
   - Token usage informs model selection

4. **Production Readiness**
   - Industry-standard observability patterns
   - Low overhead (<0.1ms per request)
   - Graceful degradation (optional analytics)
   - Backward compatible

### Negative

1. **Memory Usage**
   - 24-hour history buffer: ~140KB per analytics instance
   - Prometheus metrics: ~10KB base + 100 bytes per label combination
   - **Mitigation**: Configurable history size, metrics cardinality control

2. **Complexity**
   - Additional components to maintain
   - Requires Prometheus for full value
   - **Mitigation**: Optional features, comprehensive documentation

3. **Background Goroutine**
   - Snapshot ticker runs continuously
   - **Mitigation**: Ticker stops with context cancellation, zero overhead when analytics is nil

### Neutral

- **Configuration**: Operators must configure monthly budget limits for predictions
- **Monitoring Setup**: Full value requires Prometheus + Grafana deployment

## Implementation Files

**Cost Analytics**:
- [`go-services/internal/llm/cost_analytics.go`](../../go-services/internal/llm/cost_analytics.go) - Analytics backend (415 lines)
- [`go-services/internal/llm/cost_analytics_test.go`](../../go-services/internal/llm/cost_analytics_test.go) - Test suite (5 test functions)
- [`go-services/internal/http/server.go`](../../go-services/internal/http/server.go) - HTTP endpoints (updated)

**Prometheus Metrics**:
- [`go-services/internal/llm/cloud_router_metrics.go`](../../go-services/internal/llm/cloud_router_metrics.go) - Metrics definition (95 lines)
- [`go-services/internal/llm/cloud_router.go`](../../go-services/internal/llm/cloud_router.go) - Metrics recording (updated)

**Gateway Integration**:
- [`go-services/cmd/gateway/main.go`](../../go-services/cmd/gateway/main.go) - Initialization and background ticker

## Test Coverage

**Cost Analytics** (`cost_analytics_test.go`):
| Test | Coverage |
|------|----------|
| `TestCostAnalytics_BasicFunctionality` | Snapshot recording, history retrieval |
| `TestCostAnalytics_Prediction` | Monthly cost prediction accuracy |
| `TestCostAnalytics_Alerts` | Budget alert thresholds (50/75/90/100%) |
| `TestCostAnalytics_Trends` | Trend calculation over time |
| `TestCostAnalytics_HistoryLimit` | Max history size enforcement |

**Results**: All tests passing

## Alert Thresholds

| Threshold | Severity | Applies To | Example |
|-----------|----------|------------|---------|
| 50% | Info | Monthly budget only | "Reached 50% of monthly budget" |
| 75% | Info | Daily + Monthly | "Approaching daily limit" |
| 90% | Warning | Daily + Monthly | " Warning: 90% of daily budget used" |
| 100% | Critical | Daily + Monthly | "⚠️ Budget exceeded!" |

**Predicted Overage**: Alert fired when prediction indicates >100% of monthly budget will be exceeded

## Metrics Labels Cardinality

**Estimated Combinations**:
- Providers: 3 (openrouter, anthropic, openai)
- Models: ~10 commonly used
- Agents: 5 (ada, lea, phil, david, milton)
- Cache Status: 3 (hit, miss, expired)

**Total Cardinality**: ~450 time series (well within Prometheus limits)

## Cost Prediction Algorithm

**Formula**: `predicted_total = current_spend + (daily_avg × days_remaining)`

**Confidence Scoring**:
```go
confidence := min(1.0, float64(daysElapsed) / 7.0)
// 0% on day 1, 100% on day 7, capped at 1.0
```

**Rationale**: More data → higher confidence. 7-day threshold based on weekly spending patterns.

## Performance Benchmarks

| Operation | Latency | Notes |
|-----------|---------|-------|
| Snapshot Recording | 0.1ms | State copy |
| History Query (24hrs) | <1ms | Linear scan of 1440 entries |
| Metrics Recording | <0.1ms | Prometheus counter/histogram update |
| Prediction Calculation | <0.5ms | Arithmetic + array traversal |
| Alert Generation | <0.5ms | Threshold comparisons |

## Related ADRs

- [ADR-001: Cloud-Only LLM Provider Architecture](ADR-001-cloud-only-llm.md) - Foundation for cost tracking
- [ADR-004: Integration Testing Strategy](ADR-004-integration-testing-strategy.md) - Cost tracking test coverage

## References

1. [Prometheus Best Practices](https://prometheus.io/docs/practices/) - Metrics naming and cardinality guidelines
2. [Go RWMutex Performance](https://go.dev/blog/race-detector) - Concurrency patterns
3. [Cost Prediction Algorithms](https://en.wikipedia.org/wiki/Cost_estimation_in_software_engineering) - Linear projection methods

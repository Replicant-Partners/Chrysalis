package llm

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// CloudRouterMetrics holds Prometheus metrics for CloudOnlyRouter
type CloudRouterMetrics struct {
	requestsTotal   *prometheus.CounterVec
	requestDuration *prometheus.HistogramVec
	cacheHitRate    *prometheus.GaugeVec
	costUSD         *prometheus.CounterVec
	tokensTotal     *prometheus.CounterVec
	providerErrors  *prometheus.CounterVec
}

// NewCloudRouterMetrics creates Prometheus metrics for the cloud router
func NewCloudRouterMetrics(registry *prometheus.Registry) *CloudRouterMetrics {
	factory := promauto.With(registry)

	return &CloudRouterMetrics{
		requestsTotal: factory.NewCounterVec(
			prometheus.CounterOpts{
				Name: "llm_requests_total",
				Help: "Total number of LLM requests by provider, model, agent_id, and cache status",
			},
			[]string{"provider", "model", "agent_id", "cache_status"},
		),
		requestDuration: factory.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "llm_request_duration_seconds",
				Help:    "Duration of LLM requests in seconds",
				Buckets: []float64{0.1, 0.5, 1, 2, 5, 10, 30, 60},
			},
			[]string{"provider", "model"},
		),
		cacheHitRate: factory.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "llm_cache_hit_rate",
				Help: "Cache hit rate by agent_id (0.0 to 1.0)",
			},
			[]string{"agent_id"},
		),
		costUSD: factory.NewCounterVec(
			prometheus.CounterOpts{
				Name: "llm_cost_usd",
				Help: "Total cost in USD by provider and model",
			},
			[]string{"provider", "model"},
		),
		tokensTotal: factory.NewCounterVec(
			prometheus.CounterOpts{
				Name: "llm_tokens_total",
				Help: "Total tokens used by type (prompt, completion)",
			},
			[]string{"type", "provider", "model"},
		),
		providerErrors: factory.NewCounterVec(
			prometheus.CounterOpts{
				Name: "llm_provider_errors_total",
				Help: "Total provider errors by provider name",
			},
			[]string{"provider"},
		),
	}
}

// RecordRequest records metrics for a completed LLM request
func (m *CloudRouterMetrics) RecordRequest(provider, model, agentID, cacheStatus string, durationSec float64) {
	m.requestsTotal.WithLabelValues(provider, model, agentID, cacheStatus).Inc()
	if durationSec > 0 {
		m.requestDuration.WithLabelValues(provider, model).Observe(durationSec)
	}
}

// RecordCost records cost metrics
func (m *CloudRouterMetrics) RecordCost(provider, model string, costUSD float64) {
	m.costUSD.WithLabelValues(provider, model).Add(costUSD)
}

// RecordTokens records token usage
func (m *CloudRouterMetrics) RecordTokens(tokenType, provider, model string, tokens int) {
	m.tokensTotal.WithLabelValues(tokenType, provider, model).Add(float64(tokens))
}

// UpdateCacheHitRate updates the cache hit rate gauge for an agent
func (m *CloudRouterMetrics) UpdateCacheHitRate(agentID string, hitRate float64) {
	m.cacheHitRate.WithLabelValues(agentID).Set(hitRate)
}

// RecordProviderError records a provider error
func (m *CloudRouterMetrics) RecordProviderError(provider string) {
	m.providerErrors.WithLabelValues(provider).Inc()
}

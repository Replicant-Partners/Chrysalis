package llm

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/Replicant-Partners/Chrysalis/go-services/internal/agents"
	"github.com/prometheus/client_golang/prometheus"
)

// CloudOnlyRouter routes all requests to cloud providers (OpenRouter, Anthropic, OpenAI).
// No local Ollama support - assumes user has cloud API keys configured.
type CloudOnlyRouter struct {
	registry        *agents.Registry
	cloudProviders  map[string]Provider
	defaultProvider Provider
	costTracker     *CostTracker
	cache           *ResponseCache
	metrics         *CloudRouterMetrics

	mu         sync.RWMutex
	totalCalls int64
	cloudHits  int64
	cacheHits  int64
}

// CloudOnlyRouterConfig configures the cloud-only router.
type CloudOnlyRouterConfig struct {
	Registry        *agents.Registry
	CloudProviders  map[string]Provider
	DefaultProvider Provider
	CostTracker     *CostTracker
	CacheEnabled    bool
	CacheTTL        time.Duration
	MetricsRegistry *prometheus.Registry // Optional Prometheus registry for metrics
}

// NewCloudOnlyRouter creates a router that uses only cloud providers.
func NewCloudOnlyRouter(cfg CloudOnlyRouterConfig) (*CloudOnlyRouter, error) {
	if len(cfg.CloudProviders) == 0 && cfg.DefaultProvider == nil {
		return nil, fmt.Errorf("at least one cloud provider is required")
	}
	if cfg.Registry == nil {
		return nil, fmt.Errorf("agent registry is required")
	}

	var cache *ResponseCache
	if cfg.CacheEnabled {
		ttl := cfg.CacheTTL
		if ttl == 0 {
			ttl = 5 * time.Minute
		}
		cache = NewResponseCache(ttl)
	}

	// Initialize metrics if registry provided
	var metrics *CloudRouterMetrics
	if cfg.MetricsRegistry != nil {
		metrics = NewCloudRouterMetrics(cfg.MetricsRegistry)
	}

	return &CloudOnlyRouter{
		registry:        cfg.Registry,
		cloudProviders:  cfg.CloudProviders,
		defaultProvider: cfg.DefaultProvider,
		costTracker:     cfg.CostTracker,
		cache:           cache,
		metrics:         metrics,
	}, nil
}

func (r *CloudOnlyRouter) ID() string {
	return "cloud-router"
}

// Complete routes the request to the appropriate cloud provider.
func (r *CloudOnlyRouter) Complete(req CompletionRequest) (CompletionResponse, error) {
	startTime := time.Now()

	// Get agent configuration (read-only, no lock needed for registry access)
	agentCfg := r.registry.Get(req.AgentID)

	// Check cache first (before incrementing metrics to avoid counting cache hits as calls)
	var cacheKey string
	if r.cache != nil {
		cacheKey = r.buildCacheKey(req)
		if cached, ok := r.cache.Get(cacheKey); ok {
			// Update metrics atomically
			r.mu.Lock()
			r.totalCalls++
			r.cacheHits++
			r.mu.Unlock()

			// Record Prometheus metrics for cache hit
			if r.metrics != nil {
				r.metrics.RecordRequest("cache", cached.Model, req.AgentID, "hit", time.Since(startTime).Seconds())
			}

			log.Printf("router: cache hit for agent=%s", req.AgentID)
			return cached, nil
		}
	}

	// Select provider based on model
	provider, providerID := r.selectProvider(agentCfg, req)
	if provider == nil {
		return CompletionResponse{}, fmt.Errorf("no provider available for agent %s", req.AgentID)
	}

	// Override model if agent has a default and request doesn't specify
	if agentCfg.DefaultModel != "" && req.Model == "" {
		req.Model = agentCfg.DefaultModel
	}

	// Apply agent's max tokens and temperature if not specified
	if req.MaxTokens == 0 && agentCfg.MaxTokens > 0 {
		req.MaxTokens = agentCfg.MaxTokens
	}
	if req.Temperature == 0 && agentCfg.Temperature > 0 {
		req.Temperature = agentCfg.Temperature
	}

	// Update metrics once before provider call
	r.mu.Lock()
	r.totalCalls++
	r.cloudHits++
	r.mu.Unlock()

	log.Printf("router: agent=%s tier=%s → provider=%s model=%s",
		req.AgentID, agentCfg.ModelTier, providerID, req.Model)

	// Execute request
	resp, err := provider.Complete(req)
	duration := time.Since(startTime).Seconds()

	if err != nil {
		if r.metrics != nil {
			r.metrics.RecordProviderError(providerID)
		}
		return CompletionResponse{}, fmt.Errorf("provider %s failed: %w", providerID, err)
	}

	// Record Prometheus metrics for successful request
	if r.metrics != nil {
		r.metrics.RecordRequest(providerID, resp.Model, req.AgentID, "miss", duration)
		r.metrics.RecordTokens("prompt", providerID, resp.Model, resp.Usage.PromptTokens)
		r.metrics.RecordTokens("completion", providerID, resp.Model, resp.Usage.CompletionTokens)
	}

	// Track cost (CostTracker handles its own concurrency)
	var cost float64
	if r.costTracker != nil {
		cost = r.costTracker.TrackUsage(resp.Model, resp.Usage.PromptTokens, resp.Usage.CompletionTokens)
		log.Printf("router: agent=%s cost=$%.6f tokens=%d", req.AgentID, cost, resp.Usage.TotalTokens)

		// Record cost in Prometheus
		if r.metrics != nil {
			r.metrics.RecordCost(providerID, resp.Model, cost)
		}
	}

	// Cache response (ResponseCache handles its own concurrency)
	if r.cache != nil {
		r.cache.Set(cacheKey, resp)
	}

	return resp, nil
}

// Stream routes streaming requests to cloud providers.
func (r *CloudOnlyRouter) Stream(ctx context.Context, req CompletionRequest, emit func(CompletionChunk) error) error {
	startTime := time.Now()

	r.mu.Lock()
	r.totalCalls++
	r.cloudHits++
	r.mu.Unlock()

	agentCfg := r.registry.Get(req.AgentID)
	provider, providerID := r.selectProvider(agentCfg, req)
	if provider == nil {
		if r.metrics != nil {
			r.metrics.RecordProviderError("unknown")
		}
		return fmt.Errorf("no provider available for agent %s", req.AgentID)
	}

	if agentCfg.DefaultModel != "" && req.Model == "" {
		req.Model = agentCfg.DefaultModel
	}
	if req.MaxTokens == 0 && agentCfg.MaxTokens > 0 {
		req.MaxTokens = agentCfg.MaxTokens
	}
	if req.Temperature == 0 && agentCfg.Temperature > 0 {
		req.Temperature = agentCfg.Temperature
	}

	log.Printf("router: streaming agent=%s → provider=%s model=%s", req.AgentID, providerID, req.Model)

	err := provider.Stream(ctx, req, emit)
	duration := time.Since(startTime).Seconds()

	if err != nil {
		if r.metrics != nil {
			r.metrics.RecordProviderError(providerID)
		}
		return err
	}

	// Record streaming request metrics (no token/cost tracking for streams currently)
	if r.metrics != nil {
		r.metrics.RecordRequest(providerID, req.Model, req.AgentID, "stream", duration)
	}

	return nil
}

// selectProvider chooses the appropriate cloud provider based on model name.
func (r *CloudOnlyRouter) selectProvider(agentCfg agents.AgentConfig, req CompletionRequest) (Provider, string) {
	model := req.Model
	if model == "" {
		model = agentCfg.DefaultModel
	}
	model = strings.ToLower(model)

	// Route based on model prefix
	if strings.HasPrefix(model, "anthropic/") || strings.HasPrefix(model, "claude") {
		if p, ok := r.cloudProviders["anthropic"]; ok {
			return p, "anthropic"
		}
		if p, ok := r.cloudProviders["openrouter"]; ok {
			return p, "openrouter"
		}
	}

	if strings.HasPrefix(model, "openai/") || strings.HasPrefix(model, "gpt") {
		if p, ok := r.cloudProviders["openai"]; ok {
			return p, "openai"
		}
		if p, ok := r.cloudProviders["openrouter"]; ok {
			return p, "openrouter"
		}
	}

	// OpenRouter handles most models
	if p, ok := r.cloudProviders["openrouter"]; ok {
		return p, "openrouter"
	}

	// Fall back to default provider
	if r.defaultProvider != nil {
		return r.defaultProvider, r.defaultProvider.ID()
	}

	// Return first available
	for id, p := range r.cloudProviders {
		return p, id
	}

	return nil, ""
}

func (r *CloudOnlyRouter) buildCacheKey(req CompletionRequest) string {
	// Pre-allocate buffer size estimation
	estimatedSize := len(req.AgentID) + len(req.Model) + 10
	for _, m := range req.Messages {
		estimatedSize += len(m.Role) + len(m.Content) + 2
	}

	var sb strings.Builder
	sb.Grow(estimatedSize)
	sb.WriteString(req.AgentID)
	sb.WriteString(":")
	sb.WriteString(req.Model)
	sb.WriteString(":")
	for _, m := range req.Messages {
		sb.WriteString(m.Role)
		sb.WriteString(":")
		sb.WriteString(m.Content)
		sb.WriteString("|")
	}
	return sb.String()
}

// CloudOnlyRouterMetrics holds router metrics.
type CloudOnlyRouterMetrics struct {
	TotalCalls int64
	CloudHits  int64
	CacheHits  int64
}

// GetMetrics returns current router metrics.
func (r *CloudOnlyRouter) GetMetrics() CloudOnlyRouterMetrics {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return CloudOnlyRouterMetrics{
		TotalCalls: r.totalCalls,
		CloudHits:  r.cloudHits,
		CacheHits:  r.cacheHits,
	}
}

package llm

import (
	"context"
	"errors"
	"fmt"
	"log"
	"sync"
)

// MultiProvider wraps multiple providers with automatic failover.
type MultiProvider struct {
	providers   []*CircuitBreaker
	costTracker *CostTracker

	mu          sync.RWMutex
	lastUsed    int
	totalCalls  int64
	failovers   int64
}

// MultiProviderConfig configures the multi-provider.
type MultiProviderConfig struct {
	Providers   []Provider
	CostTracker *CostTracker
	CircuitConfig CircuitBreakerConfig
}

// NewMultiProvider creates a provider that fails over between multiple backends.
func NewMultiProvider(cfg MultiProviderConfig) (*MultiProvider, error) {
	if len(cfg.Providers) == 0 {
		return nil, errors.New("at least one provider required")
	}

	wrapped := make([]*CircuitBreaker, len(cfg.Providers))
	for i, p := range cfg.Providers {
		wrapped[i] = NewCircuitBreaker(p, cfg.CircuitConfig)
	}

	return &MultiProvider{
		providers:   wrapped,
		costTracker: cfg.CostTracker,
	}, nil
}

func (mp *MultiProvider) ID() string {
	if len(mp.providers) > 0 {
		return mp.providers[0].ID() + "-multi"
	}
	return "multi"
}

func (mp *MultiProvider) Complete(req CompletionRequest) (CompletionResponse, error) {
	mp.mu.Lock()
	mp.totalCalls++
	mp.mu.Unlock()

	var lastErr error
	for i, provider := range mp.providers {
		// Check circuit breaker state
		if provider.State() == CircuitOpen {
			continue
		}

		resp, err := provider.Complete(req)
		if err != nil {
			lastErr = err
			log.Printf("provider %s failed: %v", provider.ID(), err)

			// Record failover
			if i > 0 {
				mp.mu.Lock()
				mp.failovers++
				mp.mu.Unlock()
			}
			continue
		}

		// Track cost
		if mp.costTracker != nil {
			cost := mp.costTracker.TrackUsage(resp.Model, resp.Usage.PromptTokens, resp.Usage.CompletionTokens)
			log.Printf("request cost: $%.6f (model=%s, tokens=%d)", cost, resp.Model, resp.Usage.TotalTokens)
		}

		mp.mu.Lock()
		mp.lastUsed = i
		mp.mu.Unlock()

		return resp, nil
	}

	return CompletionResponse{}, fmt.Errorf("all providers failed, last error: %w", lastErr)
}

func (mp *MultiProvider) Stream(ctx context.Context, req CompletionRequest, emit func(CompletionChunk) error) error {
	mp.mu.Lock()
	mp.totalCalls++
	mp.mu.Unlock()

	var lastErr error
	for i, provider := range mp.providers {
		// Check circuit breaker state
		if provider.State() == CircuitOpen {
			continue
		}

		err := provider.Stream(ctx, req, emit)
		if err != nil {
			lastErr = err
			log.Printf("provider %s stream failed: %v", provider.ID(), err)

			// Record failover
			if i > 0 {
				mp.mu.Lock()
				mp.failovers++
				mp.mu.Unlock()
			}
			continue
		}

		mp.mu.Lock()
		mp.lastUsed = i
		mp.mu.Unlock()

		return nil
	}

	return fmt.Errorf("all providers failed, last error: %w", lastErr)
}

// GetMetrics returns metrics for all providers.
func (mp *MultiProvider) GetMetrics() MultiProviderMetrics {
	mp.mu.RLock()
	defer mp.mu.RUnlock()

	circuits := make(map[string]CircuitMetrics)
	for _, p := range mp.providers {
		circuits[p.ID()] = p.Metrics()
	}

	var costStatus *CostStatus
	if mp.costTracker != nil {
		status := mp.costTracker.GetStatus()
		costStatus = &status
	}

	return MultiProviderMetrics{
		TotalCalls:     mp.totalCalls,
		Failovers:      mp.failovers,
		CircuitMetrics: circuits,
		CostStatus:     costStatus,
	}
}

// ResetCircuit resets the circuit breaker for a specific provider.
func (mp *MultiProvider) ResetCircuit(providerID string) bool {
	for _, p := range mp.providers {
		if p.ID() == providerID {
			p.Reset()
			return true
		}
	}
	return false
}

type MultiProviderMetrics struct {
	TotalCalls     int64
	Failovers      int64
	CircuitMetrics map[string]CircuitMetrics
	CostStatus     *CostStatus
}

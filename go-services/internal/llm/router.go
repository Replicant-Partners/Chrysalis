package llm

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
)

// ModelRouter routes requests to the correct provider based on model name.
// This is the CORRECT implementation - route by model, not failover.
type ModelRouter struct {
	providers   map[string]Provider // provider ID -> provider
	costTracker *CostTracker

	mu         sync.RWMutex
	totalCalls int64
	routeHits  map[string]int64 // provider ID -> hit count
}

// ModelRouterConfig configures the model router.
type ModelRouterConfig struct {
	Providers   []Provider
	CostTracker *CostTracker
}

// NewModelRouter creates a router that selects provider based on model name.
func NewModelRouter(cfg ModelRouterConfig) (*ModelRouter, error) {
	if len(cfg.Providers) == 0 {
		return nil, fmt.Errorf("at least one provider required")
	}

	providers := make(map[string]Provider)
	for _, p := range cfg.Providers {
		providers[p.ID()] = p
		log.Printf("router: registered provider %s", p.ID())
	}

	return &ModelRouter{
		providers:   providers,
		costTracker: cfg.CostTracker,
		routeHits:   make(map[string]int64),
	}, nil
}

func (r *ModelRouter) ID() string {
	return "model-router"
}

// resolveProvider determines which provider to use based on model name.
// This is the key routing logic.
//
// Provider Priority (OpenAI and Anthropic are DEPRECATED):
// 1. cursor - Cursor Agent (for complex reasoning, staying on task)
// 2. ollama - Local models (free, fast)
// 3. openrouter - GLM4, other open models
// 4. openai/anthropic - DEPRECATED, use OpenRouter instead
func (r *ModelRouter) resolveProvider(model string) (Provider, string) {
	model = strings.ToLower(model)

	// Route based on model prefix/name
	switch {
	// Cursor Agent - for system agent consultations
	case strings.HasPrefix(model, "cursor"),
		strings.HasPrefix(model, "cursor-agent"):
		if p, ok := r.providers["cursor"]; ok {
			return p, "cursor"
		}

	// Ollama / Local models
	case strings.HasPrefix(model, "llama"),
		strings.HasPrefix(model, "gemma"),
		strings.HasPrefix(model, "mistral"),
		strings.HasPrefix(model, "codellama"),
		strings.HasPrefix(model, "phi"),
		strings.HasPrefix(model, "qwen"),
		strings.HasPrefix(model, "deepseek"),
		strings.HasPrefix(model, "starcoder"),
		strings.HasPrefix(model, "ollama/"),
		strings.HasPrefix(model, "local/"):
		if p, ok := r.providers["ollama"]; ok {
			return p, "ollama"
		}

	// GLM models via OpenRouter
	case strings.HasPrefix(model, "glm"),
		strings.HasPrefix(model, "thudm/"):
		if p, ok := r.providers["openrouter"]; ok {
			return p, "openrouter"
		}

	// Mistral models - can use direct API or OpenRouter
	case strings.HasPrefix(model, "mistral"),
		strings.HasPrefix(model, "mixtral"),
		strings.HasPrefix(model, "codestral"),
		strings.HasPrefix(model, "mistralai/"):
		// Prefer direct Mistral if available, fallback to OpenRouter
		if p, ok := r.providers["mistral"]; ok {
			return p, "mistral"
		}
		if p, ok := r.providers["openrouter"]; ok {
			return p, "openrouter"
		}

	// HuggingFace models - direct API or via OpenRouter
	case strings.HasPrefix(model, "huggingface/"),
		strings.HasPrefix(model, "hf/"),
		strings.HasPrefix(model, "Qwen/"),
		strings.HasPrefix(model, "meta-llama/"),
		strings.HasPrefix(model, "bigcode/"),
		strings.HasPrefix(model, "codellama/"),
		strings.HasPrefix(model, "microsoft/"):
		// Prefer direct HuggingFace if available
		if p, ok := r.providers["huggingface"]; ok {
			return p, "huggingface"
		}
		if p, ok := r.providers["openrouter"]; ok {
			return p, "openrouter"
		}

	// OpenRouter - explicit prefix or any model with org/ prefix
	case strings.HasPrefix(model, "openrouter/"),
		strings.Contains(model, "/"):
		// OpenRouter uses format like "anthropic/claude-3" or "meta-llama/llama-3"
		if p, ok := r.providers["openrouter"]; ok {
			return p, "openrouter"
		}

	// DEPRECATED: Anthropic / Claude models - route through OpenRouter instead
	case strings.HasPrefix(model, "claude"),
		strings.HasPrefix(model, "anthropic/"):
		log.Printf("router: WARNING - direct Anthropic access is DEPRECATED, routing through OpenRouter")
		if p, ok := r.providers["openrouter"]; ok {
			return p, "openrouter"
		}
		// Fall through to deprecated provider only if OpenRouter not available
		if p, ok := r.providers["anthropic"]; ok {
			return p, "anthropic"
		}

	// DEPRECATED: OpenAI models - route through OpenRouter instead
	case strings.HasPrefix(model, "gpt"),
		strings.HasPrefix(model, "o1"),
		strings.HasPrefix(model, "o3"),
		strings.HasPrefix(model, "openai/"),
		strings.HasPrefix(model, "text-embedding"),
		strings.HasPrefix(model, "whisper"),
		strings.HasPrefix(model, "dall-e"),
		strings.HasPrefix(model, "tts"):
		log.Printf("router: WARNING - direct OpenAI access is DEPRECATED, routing through OpenRouter")
		if p, ok := r.providers["openrouter"]; ok {
			return p, "openrouter"
		}
		// Fall through to deprecated provider only if OpenRouter not available
		if p, ok := r.providers["openai"]; ok {
			return p, "openai"
		}
	}

	// Default fallback order: cursor -> ollama -> huggingface -> openrouter (OpenAI/Anthropic DEPRECATED)
	fallbackOrder := []string{"cursor", "ollama", "huggingface", "openrouter"}
	for _, id := range fallbackOrder {
		if p, ok := r.providers[id]; ok {
			log.Printf("router: no specific match for model %q, falling back to %s", model, id)
			return p, id
		}
	}

	return nil, ""
}

func (r *ModelRouter) Complete(req CompletionRequest) (CompletionResponse, error) {
	r.mu.Lock()
	r.totalCalls++
	r.mu.Unlock()

	provider, providerID := r.resolveProvider(req.Model)
	if provider == nil {
		return CompletionResponse{}, fmt.Errorf("no provider available for model %q", req.Model)
	}

	// Track route
	r.mu.Lock()
	r.routeHits[providerID]++
	r.mu.Unlock()

	log.Printf("router: routing model %q to provider %s", req.Model, providerID)

	resp, err := provider.Complete(req)
	if err != nil {
		return CompletionResponse{}, fmt.Errorf("provider %s failed: %w", providerID, err)
	}

	// Track cost
	if r.costTracker != nil {
		cost := r.costTracker.TrackUsage(resp.Model, resp.Usage.PromptTokens, resp.Usage.CompletionTokens)
		log.Printf("router: request cost $%.6f (model=%s, provider=%s, tokens=%d)",
			cost, resp.Model, providerID, resp.Usage.TotalTokens)
	}

	return resp, nil
}

func (r *ModelRouter) Stream(ctx context.Context, req CompletionRequest, emit func(CompletionChunk) error) error {
	r.mu.Lock()
	r.totalCalls++
	r.mu.Unlock()

	provider, providerID := r.resolveProvider(req.Model)
	if provider == nil {
		return fmt.Errorf("no provider available for model %q", req.Model)
	}

	// Track route
	r.mu.Lock()
	r.routeHits[providerID]++
	r.mu.Unlock()

	log.Printf("router: streaming model %q to provider %s", req.Model, providerID)

	return provider.Stream(ctx, req, emit)
}

// GetMetrics returns routing metrics.
func (r *ModelRouter) GetMetrics() ModelRouterMetrics {
	r.mu.RLock()
	defer r.mu.RUnlock()

	hits := make(map[string]int64)
	for k, v := range r.routeHits {
		hits[k] = v
	}

	var costStatus *CostStatus
	if r.costTracker != nil {
		status := r.costTracker.GetStatus()
		costStatus = &status
	}

	return ModelRouterMetrics{
		TotalCalls: r.totalCalls,
		RouteHits:  hits,
		CostStatus: costStatus,
	}
}

// ModelRouterMetrics contains routing statistics.
type ModelRouterMetrics struct {
	TotalCalls int64
	RouteHits  map[string]int64
	CostStatus *CostStatus
}

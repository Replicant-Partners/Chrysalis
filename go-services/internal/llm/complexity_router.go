package llm

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/Replicant-Partners/Chrysalis/go-services/internal/agents"
)

// ComplexityRouter routes requests based on agent config and task complexity.
// This implements the spec from adaptive-llm-layer-prompts-and-connectors.md:
// "ComplexityRouter: chooses model tier based on task type/input size/latency budget"
type ComplexityRouter struct {
	registry     *agents.Registry
	localProvider  Provider // Ollama
	cloudProviders map[string]Provider // claude, gpt, etc.
	costTracker  *CostTracker
	cache        *ResponseCache

	mu           sync.RWMutex
	totalCalls   int64
	localHits    int64
	cloudHits    int64
	cacheHits    int64
}

// ComplexityRouterConfig configures the complexity router.
type ComplexityRouterConfig struct {
	Registry       *agents.Registry
	LocalProvider  Provider            // Required: Ollama or other local
	CloudProviders map[string]Provider // Optional: claude, gpt, openrouter
	CostTracker    *CostTracker
	CacheEnabled   bool
	CacheTTL       time.Duration
}

// NewComplexityRouter creates a router that selects provider based on agent config and complexity.
func NewComplexityRouter(cfg ComplexityRouterConfig) (*ComplexityRouter, error) {
	if cfg.LocalProvider == nil {
		return nil, fmt.Errorf("local provider (Ollama) is required")
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

	return &ComplexityRouter{
		registry:       cfg.Registry,
		localProvider:  cfg.LocalProvider,
		cloudProviders: cfg.CloudProviders,
		costTracker:    cfg.CostTracker,
		cache:          cache,
	}, nil
}

func (r *ComplexityRouter) ID() string {
	return "complexity-router"
}

// Complete routes the request based on agent config and task complexity.
func (r *ComplexityRouter) Complete(req CompletionRequest) (CompletionResponse, error) {
	r.mu.Lock()
	r.totalCalls++
	r.mu.Unlock()

	// 1. Get agent configuration
	agentCfg := r.registry.Get(req.AgentID)

	// 2. Check cache first
	if r.cache != nil {
		cacheKey := r.buildCacheKey(req)
		if cached, ok := r.cache.Get(cacheKey); ok {
			r.mu.Lock()
			r.cacheHits++
			r.mu.Unlock()
			log.Printf("router: cache hit for agent=%s", req.AgentID)
			return cached, nil
		}
	}

	// 3. Route based on agent's model tier
	provider, providerID := r.selectProvider(agentCfg, req)
	if provider == nil {
		return CompletionResponse{}, fmt.Errorf("no provider available for agent %s (tier=%s)", req.AgentID, agentCfg.ModelTier)
	}

	// 4. Override model if agent has a default
	if agentCfg.DefaultModel != "" && req.Model == "" {
		req.Model = agentCfg.DefaultModel
	}

	// 5. Apply agent's max tokens and temperature if not specified
	if req.MaxTokens == 0 && agentCfg.MaxTokens > 0 {
		req.MaxTokens = agentCfg.MaxTokens
	}
	if req.Temperature == 0 && agentCfg.Temperature > 0 {
		req.Temperature = agentCfg.Temperature
	}

	log.Printf("router: agent=%s tier=%s → provider=%s model=%s",
		req.AgentID, agentCfg.ModelTier, providerID, req.Model)

	// 6. Execute request
	resp, err := provider.Complete(req)
	if err != nil {
		return CompletionResponse{}, fmt.Errorf("provider %s failed: %w", providerID, err)
	}

	// 7. Track cost
	if r.costTracker != nil {
		cost := r.costTracker.TrackUsage(resp.Model, resp.Usage.PromptTokens, resp.Usage.CompletionTokens)
		log.Printf("router: agent=%s cost=$%.6f tokens=%d", req.AgentID, cost, resp.Usage.TotalTokens)
	}

	// 8. Cache response
	if r.cache != nil {
		r.cache.Set(r.buildCacheKey(req), resp)
	}

	return resp, nil
}

// Stream routes streaming requests based on agent config.
func (r *ComplexityRouter) Stream(ctx context.Context, req CompletionRequest, emit func(CompletionChunk) error) error {
	r.mu.Lock()
	r.totalCalls++
	r.mu.Unlock()

	agentCfg := r.registry.Get(req.AgentID)
	provider, providerID := r.selectProvider(agentCfg, req)
	if provider == nil {
		return fmt.Errorf("no provider available for agent %s (tier=%s)", req.AgentID, agentCfg.ModelTier)
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

	log.Printf("router: streaming agent=%s tier=%s → provider=%s", req.AgentID, agentCfg.ModelTier, providerID)

	return provider.Stream(ctx, req, emit)
}

// selectProvider chooses the appropriate provider based on agent tier and request complexity.
func (r *ComplexityRouter) selectProvider(agentCfg agents.AgentConfig, req CompletionRequest) (Provider, string) {
	switch agentCfg.ModelTier {
	case agents.TierLocalSLM:
		r.mu.Lock()
		r.localHits++
		r.mu.Unlock()
		return r.localProvider, "ollama"

	case agents.TierCloudLLM:
		r.mu.Lock()
		r.cloudHits++
		r.mu.Unlock()
		return r.selectCloudProvider(req.Model)

	case agents.TierHybrid:
		// Route based on complexity assessment
		complexity := r.assessComplexity(req)
		if complexity >= agentCfg.ComplexityThreshold {
			r.mu.Lock()
			r.cloudHits++
			r.mu.Unlock()
			return r.selectCloudProvider(req.Model)
		}
		r.mu.Lock()
		r.localHits++
		r.mu.Unlock()
		return r.localProvider, "ollama"

	default:
		// Unknown tier, default to hybrid behavior
		return r.localProvider, "ollama"
	}
}

// selectCloudProvider picks a cloud provider based on model name or defaults.
func (r *ComplexityRouter) selectCloudProvider(model string) (Provider, string) {
	model = strings.ToLower(model)

	// Route by model prefix
	switch {
	case strings.HasPrefix(model, "claude"):
		if p, ok := r.cloudProviders["anthropic"]; ok {
			return p, "anthropic"
		}
	case strings.HasPrefix(model, "gpt"), strings.HasPrefix(model, "o1"), strings.HasPrefix(model, "o3"):
		if p, ok := r.cloudProviders["openai"]; ok {
			return p, "openai"
		}
	case strings.Contains(model, "/"):
		// OpenRouter format like "anthropic/claude-3"
		if p, ok := r.cloudProviders["openrouter"]; ok {
			return p, "openrouter"
		}
	}

	// Default cloud provider priority: anthropic → openai → openrouter
	for _, id := range []string{"anthropic", "openai", "openrouter"} {
		if p, ok := r.cloudProviders[id]; ok {
			return p, id
		}
	}

	// Fall back to local if no cloud available
	return r.localProvider, "ollama"
}

// assessComplexity estimates the complexity of a request (0.0 = simple, 1.0 = complex).
// This is a heuristic based on the spec requirements.
func (r *ComplexityRouter) assessComplexity(req CompletionRequest) float64 {
	var score float64

	// Factor 1: Input size (more tokens = more complex)
	totalChars := 0
	for _, msg := range req.Messages {
		totalChars += len(msg.Content)
	}
	if totalChars > 8000 {
		score += 0.3
	} else if totalChars > 4000 {
		score += 0.2
	} else if totalChars > 2000 {
		score += 0.1
	}

	// Factor 2: Message count (more turns = more context needed)
	if len(req.Messages) > 10 {
		score += 0.2
	} else if len(req.Messages) > 5 {
		score += 0.1
	}

	// Factor 3: System prompt complexity
	for _, msg := range req.Messages {
		if msg.Role == "system" {
			content := strings.ToLower(msg.Content)
			// Complex reasoning indicators
			if strings.Contains(content, "analyze") ||
				strings.Contains(content, "synthesize") ||
				strings.Contains(content, "evaluate") ||
				strings.Contains(content, "compare") ||
				strings.Contains(content, "reasoning") ||
				strings.Contains(content, "step by step") {
				score += 0.2
			}
			// Code generation indicators
			if strings.Contains(content, "code") ||
				strings.Contains(content, "implement") ||
				strings.Contains(content, "function") ||
				strings.Contains(content, "algorithm") {
				score += 0.15
			}
			break
		}
	}

	// Factor 4: Requested max tokens (more output = more complex)
	if req.MaxTokens > 4000 {
		score += 0.15
	} else if req.MaxTokens > 2000 {
		score += 0.1
	}

	// Cap at 1.0
	if score > 1.0 {
		score = 1.0
	}

	return score
}

// buildCacheKey creates a cache key for a request.
func (r *ComplexityRouter) buildCacheKey(req CompletionRequest) string {
	// Simple hash based on agent + model + messages
	var sb strings.Builder
	sb.WriteString(req.AgentID)
	sb.WriteString("|")
	sb.WriteString(req.Model)
	sb.WriteString("|")
	for _, msg := range req.Messages {
		sb.WriteString(msg.Role)
		sb.WriteString(":")
		// Use first 100 chars of content to avoid huge keys
		content := msg.Content
		if len(content) > 100 {
			content = content[:100]
		}
		sb.WriteString(content)
		sb.WriteString("|")
	}
	return sb.String()
}

// GetMetrics returns routing metrics.
func (r *ComplexityRouter) GetMetrics() ComplexityRouterMetrics {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var costStatus *CostStatus
	if r.costTracker != nil {
		status := r.costTracker.GetStatus()
		costStatus = &status
	}

	return ComplexityRouterMetrics{
		TotalCalls: r.totalCalls,
		LocalHits:  r.localHits,
		CloudHits:  r.cloudHits,
		CacheHits:  r.cacheHits,
		CostStatus: costStatus,
	}
}

// ComplexityRouterMetrics contains routing statistics.
type ComplexityRouterMetrics struct {
	TotalCalls int64
	LocalHits  int64
	CloudHits  int64
	CacheHits  int64
	CostStatus *CostStatus
}

// ResponseCache provides simple in-memory caching for responses.
type ResponseCache struct {
	mu      sync.RWMutex
	entries map[string]cacheEntry
	ttl     time.Duration
}

type cacheEntry struct {
	response  CompletionResponse
	expiresAt time.Time
}

func NewResponseCache(ttl time.Duration) *ResponseCache {
	return &ResponseCache{
		entries: make(map[string]cacheEntry),
		ttl:     ttl,
	}
}

func (c *ResponseCache) Get(key string) (CompletionResponse, bool) {
	c.mu.RLock()
	entry, ok := c.entries[key]
	c.mu.RUnlock()

	if !ok || time.Now().After(entry.expiresAt) {
		return CompletionResponse{}, false
	}
	return entry.response, true
}

func (c *ResponseCache) Set(key string, resp CompletionResponse) {
	c.mu.Lock()
	c.entries[key] = cacheEntry{
		response:  resp,
		expiresAt: time.Now().Add(c.ttl),
	}
	c.mu.Unlock()
}

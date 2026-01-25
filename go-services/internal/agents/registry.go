package agents

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"golang.org/x/time/rate"
)

// ModelTier defines which LLM tier an agent should use.
type ModelTier string

const (
	TierLocalSLM ModelTier = "local_slm"  // Ollama - fast, cheap, local
	TierCloudLLM ModelTier = "cloud_llm"  // Claude/GPT - powerful, expensive
	TierHybrid   ModelTier = "hybrid"     // Route by complexity
)

// AgentConfig holds per-agent configuration.
type AgentConfig struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	ModelTier     ModelTier `json:"model_tier"`
	DefaultModel  string    `json:"default_model"`  // Specific model for this agent
	RateLimitRPS  float64   `json:"rate_limit_rps"` // Per-agent rate limit
	RateLimitBurst int      `json:"rate_limit_burst"`
	MaxTokens     int       `json:"max_tokens"`
	Temperature   float64   `json:"temperature"`
	// ComplexityRouter settings for hybrid tier
	ComplexityThreshold float64 `json:"complexity_threshold"` // Above this → cloud
	LatencyBudgetMs     int     `json:"latency_budget_ms"`    // Max acceptable latency
}

// DefaultAgentConfig returns sensible defaults for unknown agents.
func DefaultAgentConfig(agentID string) AgentConfig {
	return AgentConfig{
		ID:                 agentID,
		Name:               agentID,
		ModelTier:          TierHybrid,
		DefaultModel:       "",
		RateLimitRPS:       5.0,
		RateLimitBurst:     10,
		MaxTokens:          2000,
		Temperature:        0.7,
		ComplexityThreshold: 0.5,
		LatencyBudgetMs:    5000,
	}
}

// Registry manages agent configurations and per-agent rate limiters.
type Registry struct {
	mu       sync.RWMutex
	configs  map[string]AgentConfig
	limiters map[string]*rate.Limiter
}

// NewRegistry creates an empty agent registry.
func NewRegistry() *Registry {
	return &Registry{
		configs:  make(map[string]AgentConfig),
		limiters: make(map[string]*rate.Limiter),
	}
}

// Register adds or updates an agent configuration.
func (r *Registry) Register(cfg AgentConfig) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.configs[cfg.ID] = cfg
	// Create per-agent rate limiter
	if cfg.RateLimitRPS > 0 {
		r.limiters[cfg.ID] = rate.NewLimiter(rate.Limit(cfg.RateLimitRPS), cfg.RateLimitBurst)
	}
}

// Get retrieves agent configuration, returning defaults for unknown agents.
func (r *Registry) Get(agentID string) AgentConfig {
	r.mu.RLock()
	cfg, ok := r.configs[agentID]
	r.mu.RUnlock()

	if !ok {
		// Return default config for unknown agents
		return DefaultAgentConfig(agentID)
	}
	return cfg
}

// GetLimiter returns the rate limiter for an agent, creating one if needed.
func (r *Registry) GetLimiter(agentID string) *rate.Limiter {
	r.mu.Lock()
	defer r.mu.Unlock()

	if lim, ok := r.limiters[agentID]; ok {
		return lim
	}

	// Create default limiter for unknown agent
	cfg := DefaultAgentConfig(agentID)
	lim := rate.NewLimiter(rate.Limit(cfg.RateLimitRPS), cfg.RateLimitBurst)
	r.limiters[agentID] = lim
	return lim
}

// Allow checks if a request from an agent should be allowed (rate limiting).
func (r *Registry) Allow(agentID string) bool {
	return r.GetLimiter(agentID).Allow()
}

// List returns all registered agent IDs.
func (r *Registry) List() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	ids := make([]string, 0, len(r.configs))
	for id := range r.configs {
		ids = append(ids, id)
	}
	return ids
}

// LoadFromDir loads agent configurations from JSON files in a directory.
func (r *Registry) LoadFromDir(dir string) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return fmt.Errorf("read agent config dir: %w", err)
	}

	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}

		path := filepath.Join(dir, entry.Name())
		data, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("read %s: %w", path, err)
		}

		var cfg AgentConfig
		if err := json.Unmarshal(data, &cfg); err != nil {
			return fmt.Errorf("parse %s: %w", path, err)
		}

		if cfg.ID == "" {
			cfg.ID = entry.Name()[:len(entry.Name())-5] // Strip .json
		}

		r.Register(cfg)
	}

	return nil
}

// LoadBuiltInAgents registers the built-in system agents from spec.
// All agents use cloud providers (OpenRouter, Anthropic, OpenAI) - no local Ollama.
func (r *Registry) LoadBuiltInAgents() {
	builtIn := []AgentConfig{
		{
			ID:                  "ada",
			Name:                "Ada Lovelace - Algorithmic Architect",
			ModelTier:           TierCloudLLM,
			DefaultModel:        "anthropic/claude-3-haiku", // Fast, affordable
			RateLimitRPS:        10,
			RateLimitBurst:      20,
			MaxTokens:           8000,
			Temperature:         0.7,
			ComplexityThreshold: 0.0,
			LatencyBudgetMs:     10000,
		},
		{
			ID:                  "lea",
			Name:                "Lea Verou - Implementation Reviewer",
			ModelTier:           TierCloudLLM,
			DefaultModel:        "anthropic/claude-3-haiku",
			RateLimitRPS:        15,
			RateLimitBurst:      30,
			MaxTokens:           4000,
			Temperature:         0.5,
			ComplexityThreshold: 0.0,
			LatencyBudgetMs:     5000,
		},
		{
			ID:                  "phil",
			Name:                "Phil Tetlock - Forecast Analyst",
			ModelTier:           TierCloudLLM,
			DefaultModel:        "anthropic/claude-3-haiku",
			RateLimitRPS:        10,
			RateLimitBurst:      20,
			MaxTokens:           8000,
			Temperature:         0.3,
			ComplexityThreshold: 0.0,
			LatencyBudgetMs:     10000,
		},
		{
			ID:                  "david",
			Name:                "David Dunning - Metacognitive Guardian",
			ModelTier:           TierCloudLLM,
			DefaultModel:        "anthropic/claude-3-haiku",
			RateLimitRPS:        5,
			RateLimitBurst:      10,
			MaxTokens:           8000,
			Temperature:         0.7,
			ComplexityThreshold: 0.0,
			LatencyBudgetMs:     15000,
		},
		{
			ID:                  "milton",
			Name:                "Milton Friedman - Ops Caretaker",
			ModelTier:           TierCloudLLM,
			DefaultModel:        "anthropic/claude-3-haiku",
			RateLimitRPS:        10,
			RateLimitBurst:      20,
			MaxTokens:           4000,
			Temperature:         0.3,
			ComplexityThreshold: 0.0,
			LatencyBudgetMs:     10000,
		},
		{
			ID:                  "prompt-engineer",
			Name:                "Prompt Engineer",
			ModelTier:           TierCloudLLM,
			DefaultModel:        "anthropic/claude-3-haiku",
			RateLimitRPS:        10,
			RateLimitBurst:      20,
			MaxTokens:           4000,
			Temperature:         0.5,
			ComplexityThreshold: 0.0,
			LatencyBudgetMs:     5000,
		},
		{
			ID:                  "ai-engineer",
			Name:                "AI Engineer",
			ModelTier:           TierCloudLLM,
			DefaultModel:        "anthropic/claude-3-haiku",
			RateLimitRPS:        10,
			RateLimitBurst:      20,
			MaxTokens:           4000,
			Temperature:         0.5,
			ComplexityThreshold: 0.0,
			LatencyBudgetMs:     5000,
		},
		{
			ID:                  "universal-adapter",
			Name:                "Universal Protocol Adapter",
			ModelTier:           TierCloudLLM,
			DefaultModel:        "openai/gpt-5.2-codex",
			RateLimitRPS:        20,
			RateLimitBurst:      40,
			MaxTokens:           8192,
			Temperature:         0.1,
			ComplexityThreshold: 0.0,
			LatencyBudgetMs:     60000,
		},
	}

	for _, cfg := range builtIn {
		r.Register(cfg)
	}
}

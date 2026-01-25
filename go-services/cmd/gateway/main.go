package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/Replicant-Partners/Chrysalis/go-services/internal/agents"
	"github.com/Replicant-Partners/Chrysalis/go-services/internal/config"
	httpserver "github.com/Replicant-Partners/Chrysalis/go-services/internal/http"
	"github.com/Replicant-Partners/Chrysalis/go-services/internal/llm"
	"github.com/prometheus/client_golang/prometheus"
)

func main() {
	cfg := config.FromEnv()

	// Initialize agent registry with built-in agents
	// This provides per-agent configuration: model tier, rate limits, etc.
	agentRegistry := agents.NewRegistry()
	agentRegistry.LoadBuiltInAgents()
	log.Printf("loaded %d built-in agents", len(agentRegistry.List()))

	// Optionally load additional agent configs from directory
	if agentConfigDir := os.Getenv("AGENT_CONFIG_DIR"); agentConfigDir != "" {
		if err := agentRegistry.LoadFromDir(agentConfigDir); err != nil {
			log.Printf("warning: failed to load agent configs from %s: %v", agentConfigDir, err)
		}
	}

	// Initialize cost tracker
	costTracker := llm.NewCostTracker(llm.CostTrackerConfig{
		DailyBudgetUSD:   cfg.DailyBudgetUSD,
		MonthlyBudgetUSD: cfg.MonthlyBudgetUSD,
	})

	// Create shared Prometheus registry for gateway and cloud router metrics
	metricsRegistry := prometheus.NewRegistry()

	// Build providers
	allProviders := buildProviders(cfg)
	if len(allProviders) == 0 {
		log.Fatal("no providers configured; set LLM_PROVIDER and appropriate API keys")
	}

	// All providers are cloud providers (no local Ollama)
	cloudProviders := make(map[string]llm.Provider)
	var defaultProvider llm.Provider
	for _, p := range allProviders {
		cloudProviders[p.ID()] = p
		if defaultProvider == nil {
			defaultProvider = p
		}
	}

	// Create CloudOnlyRouter with Prometheus metrics - all agents use cloud providers
	router, err := llm.NewCloudOnlyRouter(llm.CloudOnlyRouterConfig{
		Registry:        agentRegistry,
		CloudProviders:  cloudProviders,
		DefaultProvider: defaultProvider,
		CostTracker:     costTracker,
		CacheEnabled:    true,
		CacheTTL:        5 * time.Minute,
		MetricsRegistry: metricsRegistry,
	})
	if err != nil {
		log.Fatalf("failed to create complexity router: %v", err)
	}

	// Create cost analytics
	costAnalytics := llm.NewCostAnalytics(llm.CostAnalyticsConfig{
		Tracker:          costTracker,
		MaxHistorySize:   1440, // 24 hours @ 1 min snapshots
		SnapshotInterval: 1 * time.Minute,
	})

	// Log configuration
	var providerNames []string
	for _, p := range allProviders {
		providerNames = append(providerNames, p.ID())
	}
	log.Printf("configured cloud providers: %v", providerNames)

	// Parse CORS allowed origins from environment
	var allowedOrigins []string
	if corsEnv := os.Getenv("CORS_ALLOWED_ORIGINS"); corsEnv != "" {
		for _, origin := range strings.Split(corsEnv, ",") {
			if trimmed := strings.TrimSpace(origin); trimmed != "" {
				allowedOrigins = append(allowedOrigins, trimmed)
			}
		}
	}

	// Create HTTP server with per-agent rate limiting
	mux := http.NewServeMux()
	srv := httpserver.New(httpserver.ServerConfig{
		Provider:       router,
		AgentRegistry:  agentRegistry,
		CostAnalytics:  costAnalytics,
		AuthToken:      cfg.AuthToken,
		AllowedOrigins: allowedOrigins,
	})
	srv.RegisterRoutes(mux)

	// Add metrics endpoint for complexity router
	mux.HandleFunc("/v1/router/metrics", func(w http.ResponseWriter, r *http.Request) {
		metrics := router.GetMetrics()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"total_calls": metrics.TotalCalls,
			"cloud_hits":  metrics.CloudHits,
			"cache_hits":  metrics.CacheHits,
			"cost_status": costTracker.GetStatus(),
		})
	})

	server := &http.Server{
		Addr:         ":" + strconv.Itoa(cfg.Port),
		Handler:      mux,
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
		IdleTimeout:  cfg.IdleTimeout,
	}

	// Start cost analytics snapshot routine
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			costAnalytics.RecordSnapshot()
		}
	}()

	// Graceful shutdown
	go func() {
		log.Printf("gateway listening on :%d (agents=%d, providers=%v, per-agent-rate-limiting=enabled, cost-analytics=enabled)",
			cfg.Port, len(agentRegistry.List()), providerNames)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	<-ctx.Done()
	stop()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("graceful shutdown failed: %v", err)
	}
	log.Println("gateway stopped")
}

// buildProviders creates providers based on configuration.
func buildProviders(cfg config.Config) []llm.Provider {
	var providers []llm.Provider

	// Build provider order: primary first, then fallbacks
	providerOrder := []string{cfg.Provider}
	providerOrder = append(providerOrder, cfg.Fallbacks...)

	seen := make(map[string]bool)
	for _, name := range providerOrder {
		if seen[name] {
			continue
		}
		seen[name] = true

		p := createProvider(name, cfg)
		if p != nil {
			providers = append(providers, p)
			log.Printf("registered provider: %s", p.ID())
		}
	}

	return providers
}

func createProvider(name string, cfg config.Config) llm.Provider {
	switch name {
	case "openai":
		if cfg.OpenAIKey == "" {
			log.Printf("skipping openai: OPENAI_API_KEY not set")
			return nil
		}
		p, err := llm.NewOpenAIProvider(llm.OpenAIConfig{
			APIKey:       cfg.OpenAIKey,
			DefaultModel: defaultModel(cfg.DefaultModel, "gpt-4o-mini"),
		})
		if err != nil {
			log.Printf("failed to create openai provider: %v", err)
			return nil
		}
		return p

	case "anthropic":
		if cfg.AnthropicKey == "" {
			log.Printf("skipping anthropic: ANTHROPIC_API_KEY not set")
			return nil
		}
		p, err := llm.NewAnthropicProvider(llm.AnthropicConfig{
			APIKey:       cfg.AnthropicKey,
			DefaultModel: defaultModel(cfg.DefaultModel, "claude-sonnet-4-20250514"),
		})
		if err != nil {
			log.Printf("failed to create anthropic provider: %v", err)
			return nil
		}
		return p

	case "openrouter":
		if cfg.OpenRouterKey == "" {
			log.Printf("skipping openrouter: OPENROUTER_API_KEY not set")
			return nil
		}
		p, err := llm.NewOpenRouterProvider(llm.OpenRouterConfig{
			APIKey:       cfg.OpenRouterKey,
			DefaultModel: defaultModel(cfg.DefaultModel, "openai/gpt-4o-mini"),
		})
		if err != nil {
			log.Printf("failed to create openrouter provider: %v", err)
			return nil
		}
		return p

	case "ollama":
		p, err := llm.NewOllamaProvider(llm.OllamaConfig{
			BaseURL:      cfg.OllamaBaseURL,
			DefaultModel: defaultModel(cfg.DefaultModel, "llama3.2"),
		})
		if err != nil {
			log.Printf("failed to create ollama provider: %v", err)
			return nil
		}
		return p

	case "huggingface":
		if cfg.HuggingFaceKey == "" {
			log.Printf("skipping huggingface: HUGGINGFACE_API_KEY not set")
			return nil
		}
		p, err := llm.NewHuggingFaceProvider(llm.HuggingFaceConfig{
			APIKey:       cfg.HuggingFaceKey,
			BaseURL:      cfg.HuggingFaceURL, // Optional: for Inference Endpoints
			DefaultModel: defaultModel(cfg.DefaultModel, "Qwen/Qwen2.5-Coder-7B-Instruct"),
		})
		if err != nil {
			log.Printf("failed to create huggingface provider: %v", err)
			return nil
		}
		return p

	case "mock":
		return llm.MockProvider{DefaultModel: defaultModel(cfg.DefaultModel, "gpt-4o-mini")}

	default:
		log.Printf("unknown provider: %s", name)
		return nil
	}
}

func defaultModel(configured, fallback string) string {
	if configured != "" {
		return configured
	}
	return fallback
}

func keys(m map[string]llm.Provider) []string {
	result := make([]string, 0, len(m))
	for k := range m {
		result = append(result, k)
	}
	return result
}

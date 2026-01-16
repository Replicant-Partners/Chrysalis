package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/Replicant-Partners/Chrysalis/go-services/internal/config"
	httpserver "github.com/Replicant-Partners/Chrysalis/go-services/internal/http"
	"github.com/Replicant-Partners/Chrysalis/go-services/internal/llm"
)

func main() {
	cfg := config.FromEnv()

	// Initialize cost tracker
	costTracker := llm.NewCostTracker(llm.CostTrackerConfig{
		DailyBudgetUSD:   cfg.DailyBudgetUSD,
		MonthlyBudgetUSD: cfg.MonthlyBudgetUSD,
	})

	// Build provider list based on config
	providers := buildProviders(cfg)
	if len(providers) == 0 {
		log.Fatal("no providers configured; set LLM_PROVIDER and appropriate API keys")
	}

	// Create multi-provider with circuit breakers
	multiProvider, err := llm.NewMultiProvider(llm.MultiProviderConfig{
		Providers:   providers,
		CostTracker: costTracker,
		CircuitConfig: llm.CircuitBreakerConfig{
			FailureThreshold: cfg.CircuitFailureThreshold,
			ResetTimeout:     time.Duration(cfg.CircuitResetTimeMs) * time.Millisecond,
		},
	})
	if err != nil {
		log.Fatalf("failed to create multi-provider: %v", err)
	}

	// Log configured providers
	var providerNames []string
	for _, p := range providers {
		providerNames = append(providerNames, p.ID())
	}
	log.Printf("configured providers: %v", providerNames)

	// Parse CORS allowed origins from environment
	var allowedOrigins []string
	if corsEnv := os.Getenv("CORS_ALLOWED_ORIGINS"); corsEnv != "" {
		for _, origin := range strings.Split(corsEnv, ",") {
			if trimmed := strings.TrimSpace(origin); trimmed != "" {
				allowedOrigins = append(allowedOrigins, trimmed)
			}
		}
	}

	mux := http.NewServeMux()
	srv := httpserver.New(multiProvider, cfg.AuthToken, cfg.RateLimitRPS, cfg.RateLimitBurst, allowedOrigins)
	srv.RegisterRoutes(mux)

	// Add metrics endpoint for multi-provider
	mux.HandleFunc("/v1/providers", func(w http.ResponseWriter, r *http.Request) {
		metrics := multiProvider.GetMetrics()
		w.Header().Set("Content-Type", "application/json")
		// Simple JSON encoding for metrics
		w.Write([]byte(`{"total_calls":` + strconv.FormatInt(metrics.TotalCalls, 10) +
			`,"failovers":` + strconv.FormatInt(metrics.Failovers, 10) + `}`))
	})

	server := &http.Server{
		Addr:         ":" + strconv.Itoa(cfg.Port),
		Handler:      mux,
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
		IdleTimeout:  cfg.IdleTimeout,
	}

	// Graceful shutdown
	go func() {
		log.Printf("gateway listening on :%d (providers=%v, rps=%.2f, burst=%d)",
			cfg.Port, providerNames, cfg.RateLimitRPS, cfg.RateLimitBurst)
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
// Primary provider first, then fallbacks in order.
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

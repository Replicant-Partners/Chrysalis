package config

import (
	"log"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds runtime configuration for the gateway service.
type Config struct {
	Port           int
	Provider       string   // Primary provider: openai, anthropic, ollama, openrouter
	Fallbacks      []string // Fallback providers in order
	ReadTimeout    time.Duration
	WriteTimeout   time.Duration
	IdleTimeout    time.Duration
	AuthToken      string
	OpenAIKey      string
	AnthropicKey   string
	OpenRouterKey  string
	OllamaBaseURL  string
	DefaultModel   string
	RateLimitRPS   float64
	RateLimitBurst int
	// Cost tracking
	DailyBudgetUSD   float64
	MonthlyBudgetUSD float64
	// Circuit breaker
	CircuitFailureThreshold int
	CircuitResetTimeMs      int
}

// FromEnv loads configuration from environment variables with sensible defaults.
func FromEnv() Config {
	fallbacksStr := os.Getenv("LLM_FALLBACKS")
	var fallbacks []string
	if fallbacksStr != "" {
		for _, f := range strings.Split(fallbacksStr, ",") {
			if trimmed := strings.TrimSpace(f); trimmed != "" {
				fallbacks = append(fallbacks, trimmed)
			}
		}
	}

	return Config{
		Port:           intFromEnv("GATEWAY_PORT", 8080),
		Provider:       strFromEnv("LLM_PROVIDER", "openai"),
		Fallbacks:      fallbacks,
		ReadTimeout:    durationFromEnv("HTTP_READ_TIMEOUT_MS", 30_000),
		WriteTimeout:   durationFromEnv("HTTP_WRITE_TIMEOUT_MS", 120_000), // Longer for streaming
		IdleTimeout:    durationFromEnv("HTTP_IDLE_TIMEOUT_MS", 60_000),
		AuthToken:      os.Getenv("GATEWAY_AUTH_TOKEN"),
		OpenAIKey:      os.Getenv("OPENAI_API_KEY"),
		AnthropicKey:   os.Getenv("ANTHROPIC_API_KEY"),
		OpenRouterKey:  os.Getenv("OPENROUTER_API_KEY"),
		OllamaBaseURL:  strFromEnv("OLLAMA_BASE_URL", "http://localhost:11434"),
		DefaultModel:   os.Getenv("LLM_DEFAULT_MODEL"),
		RateLimitRPS:   floatFromEnv("GATEWAY_RATE_RPS", 10),
		RateLimitBurst: intFromEnv("GATEWAY_RATE_BURST", 20),
		// Cost tracking
		DailyBudgetUSD:   floatFromEnv("LLM_DAILY_BUDGET_USD", 50.0),
		MonthlyBudgetUSD: floatFromEnv("LLM_MONTHLY_BUDGET_USD", 500.0),
		// Circuit breaker
		CircuitFailureThreshold: intFromEnv("CIRCUIT_FAILURE_THRESHOLD", 3),
		CircuitResetTimeMs:      intFromEnv("CIRCUIT_RESET_TIME_MS", 60000),
	}
}

func intFromEnv(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
		log.Printf("config: invalid int for %s=%s, using default %d", key, v, def)
	}
	return def
}

func durationFromEnv(key string, defMs int) time.Duration {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return time.Duration(i) * time.Millisecond
		}
		log.Printf("config: invalid duration for %s=%s, using default %dms", key, v, defMs)
	}
	return time.Duration(defMs) * time.Millisecond
}

func strFromEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func floatFromEnv(key string, def float64) float64 {
	if v := os.Getenv(key); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			return f
		}
		log.Printf("config: invalid float for %s=%s, using default %f", key, v, def)
	}
	return def
}

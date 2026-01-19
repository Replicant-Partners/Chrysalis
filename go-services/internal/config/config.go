package config

import (
	"log"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds runtime configuration for the gateway service.
// NOTE: OpenAI and Anthropic are DEPRECATED - use OpenRouter or Ollama instead.
type Config struct {
	Port           int
	Provider       string   // Primary provider: openrouter, ollama, cursor (openai/anthropic DEPRECATED)
	Fallbacks      []string // Fallback providers in order
	ReadTimeout    time.Duration
	WriteTimeout   time.Duration
	IdleTimeout    time.Duration
	AuthToken      string
	// DEPRECATED: OpenAI - use OpenRouter instead
	OpenAIKey string
	// DEPRECATED: Anthropic - use OpenRouter instead
	AnthropicKey  string
	OpenRouterKey    string
	OllamaBaseURL    string
	HuggingFaceKey   string
	HuggingFaceURL   string // Optional: for Inference Endpoints
	MistralKey       string
	// Cursor Agent adapter endpoint (for system agents to consult Cursor)
	CursorAdapterURL string
	DefaultModel     string
	RateLimitRPS     float64
	RateLimitBurst   int
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
		Provider:       strFromEnv("LLM_PROVIDER", "openrouter"), // Default to OpenRouter (OpenAI/Anthropic deprecated)
		Fallbacks:      fallbacks,
		ReadTimeout:    durationFromEnv("HTTP_READ_TIMEOUT_MS", 30_000),
		WriteTimeout:   durationFromEnv("HTTP_WRITE_TIMEOUT_MS", 120_000), // Longer for streaming
		IdleTimeout:    durationFromEnv("HTTP_IDLE_TIMEOUT_MS", 60_000),
		AuthToken:      os.Getenv("GATEWAY_AUTH_TOKEN"),
		OpenAIKey:      os.Getenv("OPENAI_API_KEY"),      // DEPRECATED
		AnthropicKey:   os.Getenv("ANTHROPIC_API_KEY"),   // DEPRECATED
		OpenRouterKey:    os.Getenv("OPENROUTER_API_KEY"),
		OllamaBaseURL:    strFromEnv("OLLAMA_BASE_URL", "http://localhost:11434"),
		HuggingFaceKey:   os.Getenv("HUGGINGFACE_API_KEY"),
		HuggingFaceURL:   os.Getenv("HUGGINGFACE_BASE_URL"), // Optional: for Inference Endpoints
		MistralKey:       os.Getenv("MISTRAL_API_KEY"),
		CursorAdapterURL: strFromEnv("CURSOR_ADAPTER_URL", "http://localhost:3210"),
		DefaultModel:   strFromEnv("LLM_DEFAULT_MODEL", "thudm/glm-4-9b-chat"), // GLM4 via OpenRouter
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

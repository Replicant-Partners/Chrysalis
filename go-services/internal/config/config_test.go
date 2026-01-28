package config

import (
	"os"
	"testing"
	"time"
)

func TestFromEnv_Defaults(t *testing.T) {
	// Clear relevant env vars to test defaults
	envVars := []string{
		"GATEWAY_PORT",
		"LLM_PROVIDER",
		"LLM_FALLBACKS",
		"HTTP_READ_TIMEOUT_MS",
		"HTTP_WRITE_TIMEOUT_MS",
		"HTTP_IDLE_TIMEOUT_MS",
		"GATEWAY_AUTH_TOKEN",
		"OLLAMA_BASE_URL",
		"CURSOR_ADAPTER_URL",
		"LLM_DEFAULT_MODEL",
		"GATEWAY_RATE_RPS",
		"GATEWAY_RATE_BURST",
		"LLM_DAILY_BUDGET_USD",
		"LLM_MONTHLY_BUDGET_USD",
		"CIRCUIT_FAILURE_THRESHOLD",
		"CIRCUIT_RESET_TIME_MS",
	}

	// Save and clear
	saved := make(map[string]string)
	for _, key := range envVars {
		saved[key] = os.Getenv(key)
		os.Unsetenv(key)
	}
	defer func() {
		for key, val := range saved {
			if val != "" {
				os.Setenv(key, val)
			}
		}
	}()

	cfg := FromEnv()

	// Check defaults
	if cfg.Port != 8080 {
		t.Errorf("Port = %d, want 8080", cfg.Port)
	}
	if cfg.Provider != "openrouter" {
		t.Errorf("Provider = %s, want openrouter", cfg.Provider)
	}
	if cfg.ReadTimeout != 30*time.Second {
		t.Errorf("ReadTimeout = %v, want 30s", cfg.ReadTimeout)
	}
	if cfg.WriteTimeout != 120*time.Second {
		t.Errorf("WriteTimeout = %v, want 120s", cfg.WriteTimeout)
	}
	if cfg.IdleTimeout != 60*time.Second {
		t.Errorf("IdleTimeout = %v, want 60s", cfg.IdleTimeout)
	}
	if cfg.OllamaBaseURL != "http://localhost:11434" {
		t.Errorf("OllamaBaseURL = %s, want http://localhost:11434", cfg.OllamaBaseURL)
	}
	if cfg.CursorAdapterURL != "http://localhost:3210" {
		t.Errorf("CursorAdapterURL = %s, want http://localhost:3210", cfg.CursorAdapterURL)
	}
	if cfg.RateLimitRPS != 10 {
		t.Errorf("RateLimitRPS = %f, want 10", cfg.RateLimitRPS)
	}
	if cfg.RateLimitBurst != 20 {
		t.Errorf("RateLimitBurst = %d, want 20", cfg.RateLimitBurst)
	}
	if cfg.DailyBudgetUSD != 50.0 {
		t.Errorf("DailyBudgetUSD = %f, want 50.0", cfg.DailyBudgetUSD)
	}
	if cfg.MonthlyBudgetUSD != 500.0 {
		t.Errorf("MonthlyBudgetUSD = %f, want 500.0", cfg.MonthlyBudgetUSD)
	}
	if cfg.CircuitFailureThreshold != 3 {
		t.Errorf("CircuitFailureThreshold = %d, want 3", cfg.CircuitFailureThreshold)
	}
	if cfg.CircuitResetTimeMs != 60000 {
		t.Errorf("CircuitResetTimeMs = %d, want 60000", cfg.CircuitResetTimeMs)
	}
}

func TestFromEnv_CustomValues(t *testing.T) {
	// Set custom values
	os.Setenv("GATEWAY_PORT", "9090")
	os.Setenv("LLM_PROVIDER", "ollama")
	os.Setenv("GATEWAY_AUTH_TOKEN", "test-token")
	os.Setenv("GATEWAY_RATE_RPS", "25.5")
	os.Setenv("GATEWAY_RATE_BURST", "50")
	os.Setenv("LLM_DAILY_BUDGET_USD", "100.0")
	defer func() {
		os.Unsetenv("GATEWAY_PORT")
		os.Unsetenv("LLM_PROVIDER")
		os.Unsetenv("GATEWAY_AUTH_TOKEN")
		os.Unsetenv("GATEWAY_RATE_RPS")
		os.Unsetenv("GATEWAY_RATE_BURST")
		os.Unsetenv("LLM_DAILY_BUDGET_USD")
	}()

	cfg := FromEnv()

	if cfg.Port != 9090 {
		t.Errorf("Port = %d, want 9090", cfg.Port)
	}
	if cfg.Provider != "ollama" {
		t.Errorf("Provider = %s, want ollama", cfg.Provider)
	}
	if cfg.AuthToken != "test-token" {
		t.Errorf("AuthToken = %s, want test-token", cfg.AuthToken)
	}
	if cfg.RateLimitRPS != 25.5 {
		t.Errorf("RateLimitRPS = %f, want 25.5", cfg.RateLimitRPS)
	}
	if cfg.RateLimitBurst != 50 {
		t.Errorf("RateLimitBurst = %d, want 50", cfg.RateLimitBurst)
	}
	if cfg.DailyBudgetUSD != 100.0 {
		t.Errorf("DailyBudgetUSD = %f, want 100.0", cfg.DailyBudgetUSD)
	}
}

func TestFromEnv_Fallbacks(t *testing.T) {
	os.Setenv("LLM_FALLBACKS", "ollama, anthropic, openai")
	defer os.Unsetenv("LLM_FALLBACKS")

	cfg := FromEnv()

	if len(cfg.Fallbacks) != 3 {
		t.Errorf("Fallbacks len = %d, want 3", len(cfg.Fallbacks))
	}
	expected := []string{"ollama", "anthropic", "openai"}
	for i, fb := range cfg.Fallbacks {
		if fb != expected[i] {
			t.Errorf("Fallbacks[%d] = %s, want %s", i, fb, expected[i])
		}
	}
}

func TestFromEnv_EmptyFallbacks(t *testing.T) {
	os.Unsetenv("LLM_FALLBACKS")

	cfg := FromEnv()

	if cfg.Fallbacks != nil && len(cfg.Fallbacks) != 0 {
		t.Errorf("Fallbacks should be empty, got %v", cfg.Fallbacks)
	}
}

func TestFromEnv_InvalidInt(t *testing.T) {
	os.Setenv("GATEWAY_PORT", "not-a-number")
	defer os.Unsetenv("GATEWAY_PORT")

	cfg := FromEnv()

	// Should use default when invalid
	if cfg.Port != 8080 {
		t.Errorf("Port = %d, want 8080 (default)", cfg.Port)
	}
}

func TestFromEnv_InvalidFloat(t *testing.T) {
	os.Setenv("GATEWAY_RATE_RPS", "not-a-float")
	defer os.Unsetenv("GATEWAY_RATE_RPS")

	cfg := FromEnv()

	// Should use default when invalid
	if cfg.RateLimitRPS != 10 {
		t.Errorf("RateLimitRPS = %f, want 10 (default)", cfg.RateLimitRPS)
	}
}

func TestFromEnv_APIKeys(t *testing.T) {
	os.Setenv("OPENROUTER_API_KEY", "or-key")
	os.Setenv("OPENAI_API_KEY", "oai-key")
	os.Setenv("ANTHROPIC_API_KEY", "ant-key")
	os.Setenv("HUGGINGFACE_API_KEY", "hf-key")
	os.Setenv("MISTRAL_API_KEY", "mistral-key")
	defer func() {
		os.Unsetenv("OPENROUTER_API_KEY")
		os.Unsetenv("OPENAI_API_KEY")
		os.Unsetenv("ANTHROPIC_API_KEY")
		os.Unsetenv("HUGGINGFACE_API_KEY")
		os.Unsetenv("MISTRAL_API_KEY")
	}()

	cfg := FromEnv()

	if cfg.OpenRouterKey != "or-key" {
		t.Errorf("OpenRouterKey = %s, want or-key", cfg.OpenRouterKey)
	}
	if cfg.OpenAIKey != "oai-key" {
		t.Errorf("OpenAIKey = %s, want oai-key", cfg.OpenAIKey)
	}
	if cfg.AnthropicKey != "ant-key" {
		t.Errorf("AnthropicKey = %s, want ant-key", cfg.AnthropicKey)
	}
	if cfg.HuggingFaceKey != "hf-key" {
		t.Errorf("HuggingFaceKey = %s, want hf-key", cfg.HuggingFaceKey)
	}
	if cfg.MistralKey != "mistral-key" {
		t.Errorf("MistralKey = %s, want mistral-key", cfg.MistralKey)
	}
}

func TestFromEnv_Timeouts(t *testing.T) {
	os.Setenv("HTTP_READ_TIMEOUT_MS", "5000")
	os.Setenv("HTTP_WRITE_TIMEOUT_MS", "10000")
	os.Setenv("HTTP_IDLE_TIMEOUT_MS", "15000")
	defer func() {
		os.Unsetenv("HTTP_READ_TIMEOUT_MS")
		os.Unsetenv("HTTP_WRITE_TIMEOUT_MS")
		os.Unsetenv("HTTP_IDLE_TIMEOUT_MS")
	}()

	cfg := FromEnv()

	if cfg.ReadTimeout != 5*time.Second {
		t.Errorf("ReadTimeout = %v, want 5s", cfg.ReadTimeout)
	}
	if cfg.WriteTimeout != 10*time.Second {
		t.Errorf("WriteTimeout = %v, want 10s", cfg.WriteTimeout)
	}
	if cfg.IdleTimeout != 15*time.Second {
		t.Errorf("IdleTimeout = %v, want 15s", cfg.IdleTimeout)
	}
}

func TestFromEnv_InvalidDuration(t *testing.T) {
	os.Setenv("HTTP_READ_TIMEOUT_MS", "invalid")
	defer os.Unsetenv("HTTP_READ_TIMEOUT_MS")

	cfg := FromEnv()

	// Should use default when invalid
	if cfg.ReadTimeout != 30*time.Second {
		t.Errorf("ReadTimeout = %v, want 30s (default)", cfg.ReadTimeout)
	}
}

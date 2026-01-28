package main

import (
	"os"
	"testing"

	"github.com/Replicant-Partners/Chrysalis/go-services/internal/config"
	"github.com/Replicant-Partners/Chrysalis/go-services/internal/llm"
)

func TestDefaultModel(t *testing.T) {
	tests := []struct {
		name       string
		configured string
		fallback   string
		want       string
	}{
		{"configured model", "gpt-4", "gpt-3.5", "gpt-4"},
		{"empty configured", "", "gpt-3.5", "gpt-3.5"},
		{"both empty", "", "", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := defaultModel(tt.configured, tt.fallback)
			if got != tt.want {
				t.Errorf("defaultModel(%q, %q) = %q, want %q", tt.configured, tt.fallback, got, tt.want)
			}
		})
	}
}

func TestKeys(t *testing.T) {
	m := map[string]llm.Provider{
		"openai":     nil,
		"anthropic":  nil,
		"openrouter": nil,
	}

	result := keys(m)
	if len(result) != 3 {
		t.Errorf("keys() returned %d items, want 3", len(result))
	}

	// Check all keys are present
	found := make(map[string]bool)
	for _, k := range result {
		found[k] = true
	}
	for expected := range m {
		if !found[expected] {
			t.Errorf("keys() missing %q", expected)
		}
	}
}

func TestKeys_Empty(t *testing.T) {
	m := map[string]llm.Provider{}
	result := keys(m)
	if len(result) != 0 {
		t.Errorf("keys() on empty map returned %d items, want 0", len(result))
	}
}

func TestBuildProviders_NoProviders(t *testing.T) {
	// Clear all API keys
	envVars := []string{
		"OPENAI_API_KEY",
		"ANTHROPIC_API_KEY",
		"OPENROUTER_API_KEY",
		"HUGGINGFACE_API_KEY",
		"MISTRAL_API_KEY",
	}
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

	cfg := config.Config{
		Provider: "openai", // No API key set
	}

	providers := buildProviders(cfg)
	// Should return empty list when no API keys configured
	if len(providers) != 0 {
		t.Errorf("buildProviders with no API keys returned %d providers, want 0", len(providers))
	}
}

func TestBuildProviders_MockProvider(t *testing.T) {
	cfg := config.Config{
		Provider:     "mock",
		DefaultModel: "test-model",
	}

	providers := buildProviders(cfg)
	if len(providers) != 1 {
		t.Fatalf("buildProviders with mock returned %d providers, want 1", len(providers))
	}
	if providers[0].ID() != "mock" {
		t.Errorf("provider ID = %q, want mock", providers[0].ID())
	}
}

func TestBuildProviders_WithFallbacks(t *testing.T) {
	cfg := config.Config{
		Provider:     "mock",
		Fallbacks:    []string{"mock"}, // Duplicate should be ignored
		DefaultModel: "test-model",
	}

	providers := buildProviders(cfg)
	// Should only have 1 provider (duplicates removed)
	if len(providers) != 1 {
		t.Errorf("buildProviders with duplicate fallback returned %d providers, want 1", len(providers))
	}
}

func TestCreateProvider_Unknown(t *testing.T) {
	cfg := config.Config{}
	p := createProvider("unknown-provider", cfg)
	if p != nil {
		t.Error("createProvider should return nil for unknown provider")
	}
}

func TestCreateProvider_Mock(t *testing.T) {
	cfg := config.Config{
		DefaultModel: "test-model",
	}

	p := createProvider("mock", cfg)
	if p == nil {
		t.Fatal("createProvider(mock) returned nil")
	}
	if p.ID() != "mock" {
		t.Errorf("provider ID = %q, want mock", p.ID())
	}
}

func TestCreateProvider_OllamaNoKey(t *testing.T) {
	cfg := config.Config{
		OllamaBaseURL: "http://localhost:11434",
		DefaultModel:  "llama3.2",
	}

	// Ollama doesn't require an API key, so it should work
	p := createProvider("ollama", cfg)
	if p == nil {
		t.Fatal("createProvider(ollama) returned nil")
	}
	if p.ID() != "ollama" {
		t.Errorf("provider ID = %q, want ollama", p.ID())
	}
}

func TestCreateProvider_OpenAINoKey(t *testing.T) {
	os.Unsetenv("OPENAI_API_KEY")
	cfg := config.Config{
		OpenAIKey: "", // No key
	}

	p := createProvider("openai", cfg)
	if p != nil {
		t.Error("createProvider(openai) without API key should return nil")
	}
}

func TestCreateProvider_AnthropicNoKey(t *testing.T) {
	os.Unsetenv("ANTHROPIC_API_KEY")
	cfg := config.Config{
		AnthropicKey: "", // No key
	}

	p := createProvider("anthropic", cfg)
	if p != nil {
		t.Error("createProvider(anthropic) without API key should return nil")
	}
}

func TestCreateProvider_OpenRouterNoKey(t *testing.T) {
	os.Unsetenv("OPENROUTER_API_KEY")
	cfg := config.Config{
		OpenRouterKey: "", // No key
	}

	p := createProvider("openrouter", cfg)
	if p != nil {
		t.Error("createProvider(openrouter) without API key should return nil")
	}
}

func TestCreateProvider_HuggingFaceNoKey(t *testing.T) {
	os.Unsetenv("HUGGINGFACE_API_KEY")
	cfg := config.Config{
		HuggingFaceKey: "", // No key
	}

	p := createProvider("huggingface", cfg)
	if p != nil {
		t.Error("createProvider(huggingface) without API key should return nil")
	}
}

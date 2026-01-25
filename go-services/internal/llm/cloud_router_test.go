package llm

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Replicant-Partners/Chrysalis/go-services/internal/agents"
)

// NamedMockProvider is a MockProvider with a customizable ID
type NamedMockProvider struct {
	id           string
	DefaultModel string
}

func (m *NamedMockProvider) ID() string {
	return m.id
}

func (m *NamedMockProvider) Complete(req CompletionRequest) (CompletionResponse, error) {
	// Simple echo completion with basic token counting
	joined := make([]string, 0, len(req.Messages))
	for _, msg := range req.Messages {
		joined = append(joined, msg.Content)
	}
	combined := strings.Join(joined, "\n")
	respText := "[" + m.id + "] " + combined

	usage := Usage{
		PromptTokens:     len(combined) / 4,
		CompletionTokens: len(respText) / 4,
	}
	usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens

	model := req.Model
	if model == "" {
		model = m.DefaultModel
	}

	return CompletionResponse{
		Content:  respText,
		Model:    model,
		Provider: m.id,
		Usage:    usage,
	}, nil
}

func (m *NamedMockProvider) Stream(ctx context.Context, req CompletionRequest, emit func(CompletionChunk) error) error {
	resp, err := m.Complete(req)
	if err != nil {
		return err
	}
	if err := emit(CompletionChunk{
		Content:  resp.Content,
		Model:    resp.Model,
		Provider: resp.Provider,
	}); err != nil {
		return err
	}
	return emit(CompletionChunk{Done: true, Provider: resp.Provider, Model: resp.Model})
}

// MockProviderWithErrors simulates provider failures for retry testing
type MockProviderWithErrors struct {
	id          string
	failCount   int
	maxFails    int
	mu          sync.Mutex
	callCount   int
	lastRequest CompletionRequest
}

func (m *MockProviderWithErrors) ID() string {
	return m.id
}

func (m *MockProviderWithErrors) Complete(req CompletionRequest) (CompletionResponse, error) {
	m.mu.Lock()
	m.callCount++
	m.lastRequest = req
	currentFail := m.failCount
	if m.failCount < m.maxFails {
		m.failCount++
	}
	m.mu.Unlock()

	// Fail first N attempts
	if currentFail < m.maxFails {
		return CompletionResponse{}, fmt.Errorf("simulated provider failure %d/%d", currentFail+1, m.maxFails)
	}

	// Success after retries
	content := fmt.Sprintf("[%s] success after %d failures", m.id, m.maxFails)
	return CompletionResponse{
		Content:  content,
		Model:    req.Model,
		Provider: m.id,
		Usage: Usage{
			PromptTokens:     100,
			CompletionTokens: 50,
			TotalTokens:      150,
		},
	}, nil
}

func (m *MockProviderWithErrors) Stream(ctx context.Context, req CompletionRequest, emit func(CompletionChunk) error) error {
	resp, err := m.Complete(req)
	if err != nil {
		return err
	}
	emit(CompletionChunk{Content: resp.Content, Model: resp.Model, Provider: resp.Provider})
	return emit(CompletionChunk{Done: true})
}

func (m *MockProviderWithErrors) GetCallCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.callCount
}

func (m *MockProviderWithErrors) Reset() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.failCount = 0
	m.callCount = 0
}

// TestCloudOnlyRouter_ProviderSelection tests provider routing based on model prefix
func TestCloudOnlyRouter_ProviderSelection(t *testing.T) {
	registry := agents.NewRegistry()
	registry.Register(agents.AgentConfig{
		ID:           "test-agent",
		Name:         "Test Agent",
		ModelTier:    agents.TierCloudLLM,
		DefaultModel: "anthropic/claude-3-haiku",
	})

	// Setup mock providers with specific IDs
	anthropicMock := &NamedMockProvider{id: "anthropic", DefaultModel: "anthropic/claude-3-haiku"}
	openaiMock := &NamedMockProvider{id: "openai", DefaultModel: "openai/gpt-4o"}
	openrouterMock := &NamedMockProvider{id: "openrouter", DefaultModel: "default"}

	router, err := NewCloudOnlyRouter(CloudOnlyRouterConfig{
		Registry: registry,
		CloudProviders: map[string]Provider{
			"anthropic":  anthropicMock,
			"openai":     openaiMock,
			"openrouter": openrouterMock,
		},
		DefaultProvider: openrouterMock,
		CacheEnabled:    false,
	})
	if err != nil {
		t.Fatalf("Failed to create router: %v", err)
	}

	tests := []struct {
		name             string
		model            string
		expectedProvider string
	}{
		{
			name:             "anthropic prefix routes to anthropic",
			model:            "anthropic/claude-3-haiku",
			expectedProvider: "anthropic",
		},
		{
			name:             "claude prefix routes to anthropic",
			model:            "claude-3-opus",
			expectedProvider: "anthropic",
		},
		{
			name:             "openai prefix routes to openai",
			model:            "openai/gpt-4o",
			expectedProvider: "openai",
		},
		{
			name:             "gpt prefix routes to openai",
			model:            "gpt-4-turbo",
			expectedProvider: "openai",
		},
		{
			name:             "unknown model routes to openrouter",
			model:            "meta-llama/llama-3-70b",
			expectedProvider: "openrouter",
		},
		{
			name:             "empty model uses agent default",
			model:            "",
			expectedProvider: "anthropic", // agent default is anthropic/claude-3-haiku
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := CompletionRequest{
				AgentID: "test-agent",
				Model:   tt.model,
				Messages: []Message{
					{Role: "user", Content: "test message"},
				},
			}

			resp, err := router.Complete(req)
			if err != nil {
				t.Fatalf("Complete failed: %v", err)
			}

			if resp.Provider != tt.expectedProvider {
				t.Errorf("Expected provider %s, got %s", tt.expectedProvider, resp.Provider)
			}
		})
	}
}

// TestCloudOnlyRouter_CacheHitMiss tests cache behavior
func TestCloudOnlyRouter_CacheHitMiss(t *testing.T) {
	registry := agents.NewRegistry()
	registry.Register(agents.AgentConfig{
		ID:        "test-agent",
		ModelTier: agents.TierCloudLLM,
	})

	mockProvider := &MockProvider{DefaultModel: "test-model"}
	costTracker := NewCostTracker(CostTrackerConfig{})

	router, err := NewCloudOnlyRouter(CloudOnlyRouterConfig{
		Registry: registry,
		CloudProviders: map[string]Provider{
			"mock": mockProvider,
		},
		DefaultProvider: mockProvider,
		CostTracker:     costTracker,
		CacheEnabled:    true,
		CacheTTL:        5 * time.Minute,
	})
	if err != nil {
		t.Fatalf("Failed to create router: %v", err)
	}

	req := CompletionRequest{
		AgentID: "test-agent",
		Model:   "test-model",
		Messages: []Message{
			{Role: "user", Content: "What is 2+2?"},
		},
	}

	// First request - cache miss
	resp1, err := router.Complete(req)
	if err != nil {
		t.Fatalf("First request failed: %v", err)
	}

	metrics1 := router.GetMetrics()
	if metrics1.TotalCalls != 1 {
		t.Errorf("Expected 1 total call, got %d", metrics1.TotalCalls)
	}
	if metrics1.CloudHits != 1 {
		t.Errorf("Expected 1 cloud hit, got %d", metrics1.CloudHits)
	}
	if metrics1.CacheHits != 0 {
		t.Errorf("Expected 0 cache hits, got %d", metrics1.CacheHits)
	}

	// Second identical request - cache hit
	resp2, err := router.Complete(req)
	if err != nil {
		t.Fatalf("Second request failed: %v", err)
	}

	if resp1.Content != resp2.Content {
		t.Errorf("Cached response content mismatch")
	}

	metrics2 := router.GetMetrics()
	if metrics2.TotalCalls != 2 {
		t.Errorf("Expected 2 total calls, got %d", metrics2.TotalCalls)
	}
	if metrics2.CloudHits != 1 {
		t.Errorf("Expected 1 cloud hit (no new provider call), got %d", metrics2.CloudHits)
	}
	if metrics2.CacheHits != 1 {
		t.Errorf("Expected 1 cache hit, got %d", metrics2.CacheHits)
	}

	// Different request - cache miss
	reqDifferent := CompletionRequest{
		AgentID: "test-agent",
		Model:   "test-model",
		Messages: []Message{
			{Role: "user", Content: "What is 3+3?"},
		},
	}

	_, err = router.Complete(reqDifferent)
	if err != nil {
		t.Fatalf("Third request failed: %v", err)
	}

	metrics3 := router.GetMetrics()
	if metrics3.TotalCalls != 3 {
		t.Errorf("Expected 3 total calls, got %d", metrics3.TotalCalls)
	}
	if metrics3.CloudHits != 2 {
		t.Errorf("Expected 2 cloud hits, got %d", metrics3.CloudHits)
	}
	if metrics3.CacheHits != 1 {
		t.Errorf("Expected 1 cache hit (unchanged), got %d", metrics3.CacheHits)
	}
}

// TestCloudOnlyRouter_CacheExpiry tests cache TTL behavior
func TestCloudOnlyRouter_CacheExpiry(t *testing.T) {
	registry := agents.NewRegistry()
	registry.Register(agents.AgentConfig{
		ID:        "test-agent",
		ModelTier: agents.TierCloudLLM,
	})

	mockProvider := &MockProvider{DefaultModel: "test-model"}

	// Very short TTL for testing
	router, err := NewCloudOnlyRouter(CloudOnlyRouterConfig{
		Registry: registry,
		CloudProviders: map[string]Provider{
			"mock": mockProvider,
		},
		DefaultProvider: mockProvider,
		CacheEnabled:    true,
		CacheTTL:        100 * time.Millisecond, // 100ms TTL
	})
	if err != nil {
		t.Fatalf("Failed to create router: %v", err)
	}

	req := CompletionRequest{
		AgentID: "test-agent",
		Model:   "test-model",
		Messages: []Message{
			{Role: "user", Content: "test"},
		},
	}

	// First request
	_, err = router.Complete(req)
	if err != nil {
		t.Fatalf("First request failed: %v", err)
	}

	metrics1 := router.GetMetrics()
	if metrics1.CacheHits != 0 {
		t.Errorf("Expected 0 cache hits initially, got %d", metrics1.CacheHits)
	}

	// Wait for cache to expire
	time.Sleep(150 * time.Millisecond)

	// Request after expiry - should be cache miss
	_, err = router.Complete(req)
	if err != nil {
		t.Fatalf("Second request failed: %v", err)
	}

	metrics2 := router.GetMetrics()
	if metrics2.CacheHits != 0 {
		t.Errorf("Expected 0 cache hits after expiry, got %d", metrics2.CacheHits)
	}
	if metrics2.CloudHits != 2 {
		t.Errorf("Expected 2 cloud hits (both requests to provider), got %d", metrics2.CloudHits)
	}
}

// TestCloudOnlyRouter_CostTracking tests cost tracking accuracy
func TestCloudOnlyRouter_CostTracking(t *testing.T) {
	registry := agents.NewRegistry()
	registry.Register(agents.AgentConfig{
		ID:        "test-agent",
		ModelTier: agents.TierCloudLLM,
	})

	mockProvider := &MockProvider{DefaultModel: "gpt-4o"}
	costTracker := NewCostTracker(CostTrackerConfig{
		DailyBudgetUSD:   10.0,
		MonthlyBudgetUSD: 100.0,
	})

	router, err := NewCloudOnlyRouter(CloudOnlyRouterConfig{
		Registry: registry,
		CloudProviders: map[string]Provider{
			"mock": mockProvider,
		},
		DefaultProvider: mockProvider,
		CostTracker:     costTracker,
		CacheEnabled:    false, // Disable cache to ensure all requests hit provider
	})
	if err != nil {
		t.Fatalf("Failed to create router: %v", err)
	}

	req := CompletionRequest{
		AgentID: "test-agent",
		Model:   "gpt-4o",
		Messages: []Message{
			{Role: "user", Content: "test"},
		},
	}

	// Make a request
	resp, err := router.Complete(req)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}

	// Check cost was tracked
	status := costTracker.GetStatus()

	// Calculate expected cost for gpt-4o
	// gpt-4o: $2.50 input / $10.00 output per 1M tokens
	expectedCost := CalculateCost("gpt-4o", resp.Usage.PromptTokens, resp.Usage.CompletionTokens)

	if status.TotalSpend != expectedCost {
		t.Errorf("Expected total spend %.6f, got %.6f", expectedCost, status.TotalSpend)
	}

	if status.DailySpend != expectedCost {
		t.Errorf("Expected daily spend %.6f, got %.6f", expectedCost, status.DailySpend)
	}

	if status.RequestCount != 1 {
		t.Errorf("Expected 1 request tracked, got %d", status.RequestCount)
	}

	if status.TokenCount != int64(resp.Usage.TotalTokens) {
		t.Errorf("Expected %d tokens tracked, got %d", resp.Usage.TotalTokens, status.TokenCount)
	}
}

// TestCloudOnlyRouter_ConcurrentRequests tests thread safety under concurrent load
func TestCloudOnlyRouter_ConcurrentRequests(t *testing.T) {
	registry := agents.NewRegistry()
	registry.Register(agents.AgentConfig{
		ID:        "test-agent",
		ModelTier: agents.TierCloudLLM,
	})

	mockProvider := &MockProvider{DefaultModel: "test-model"}
	costTracker := NewCostTracker(CostTrackerConfig{})

	router, err := NewCloudOnlyRouter(CloudOnlyRouterConfig{
		Registry: registry,
		CloudProviders: map[string]Provider{
			"mock": mockProvider,
		},
		DefaultProvider: mockProvider,
		CostTracker:     costTracker,
		CacheEnabled:    true,
		CacheTTL:        5 * time.Minute,
	})
	if err != nil {
		t.Fatalf("Failed to create router: %v", err)
	}

	// Run concurrent requests
	const numGoroutines = 50
	const requestsPerGoroutine = 10

	var wg sync.WaitGroup
	errors := make(chan error, numGoroutines*requestsPerGoroutine)

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for j := 0; j < requestsPerGoroutine; j++ {
				req := CompletionRequest{
					AgentID: "test-agent",
					Model:   "test-model",
					Messages: []Message{
						{Role: "user", Content: fmt.Sprintf("request %d-%d", id, j)},
					},
				}
				_, err := router.Complete(req)
				if err != nil {
					errors <- err
				}
			}
		}(i)
	}

	wg.Wait()
	close(errors)

	// Check for errors
	errorCount := 0
	for err := range errors {
		t.Errorf("Concurrent request failed: %v", err)
		errorCount++
	}

	if errorCount > 0 {
		t.Fatalf("Had %d errors during concurrent requests", errorCount)
	}

	// Verify metrics are consistent
	metrics := router.GetMetrics()
	if metrics.TotalCalls != int64(numGoroutines*requestsPerGoroutine) {
		t.Errorf("Expected %d total calls, got %d", numGoroutines*requestsPerGoroutine, metrics.TotalCalls)
	}

	// Cache hits + cloud hits should equal total calls
	if metrics.CacheHits+metrics.CloudHits != metrics.TotalCalls {
		t.Errorf("Cache hits (%d) + cloud hits (%d) != total calls (%d)",
			metrics.CacheHits, metrics.CloudHits, metrics.TotalCalls)
	}
}

// TestCloudOnlyRouter_AgentConfigOverride tests that agent configuration overrides work
func TestCloudOnlyRouter_AgentConfigOverride(t *testing.T) {
	registry := agents.NewRegistry()
	registry.Register(agents.AgentConfig{
		ID:           "configured-agent",
		ModelTier:    agents.TierCloudLLM,
		DefaultModel: "agent-default-model",
		MaxTokens:    4000,
		Temperature:  0.3,
	})

	mockProvider := &MockProvider{DefaultModel: "provider-default"}

	router, err := NewCloudOnlyRouter(CloudOnlyRouterConfig{
		Registry: registry,
		CloudProviders: map[string]Provider{
			"mock": mockProvider,
		},
		DefaultProvider: mockProvider,
		CacheEnabled:    false,
	})
	if err != nil {
		t.Fatalf("Failed to create router: %v", err)
	}

	// Request without model - should use agent default
	req1 := CompletionRequest{
		AgentID: "configured-agent",
		Messages: []Message{
			{Role: "user", Content: "test"},
		},
	}

	resp1, err := router.Complete(req1)
	if err != nil {
		t.Fatalf("Request 1 failed: %v", err)
	}

	if resp1.Model != "agent-default-model" {
		t.Errorf("Expected model 'agent-default-model', got '%s'", resp1.Model)
	}

	// Request with explicit model - should override agent default
	req2 := CompletionRequest{
		AgentID: "configured-agent",
		Model:   "explicit-model",
		Messages: []Message{
			{Role: "user", Content: "test"},
		},
	}

	resp2, err := router.Complete(req2)
	if err != nil {
		t.Fatalf("Request 2 failed: %v", err)
	}

	if resp2.Model != "explicit-model" {
		t.Errorf("Expected model 'explicit-model', got '%s'", resp2.Model)
	}
}

// TestCloudOnlyRouter_NoProvidersError tests error handling when no providers are configured
func TestCloudOnlyRouter_NoProvidersError(t *testing.T) {
	registry := agents.NewRegistry()
	registry.Register(agents.AgentConfig{
		ID:        "test-agent",
		ModelTier: agents.TierCloudLLM,
	})

	_, err := NewCloudOnlyRouter(CloudOnlyRouterConfig{
		Registry:        registry,
		CloudProviders:  map[string]Provider{}, // Empty
		DefaultProvider: nil,                   // No default
		CacheEnabled:    false,
	})

	if err == nil {
		t.Fatal("Expected error when no providers configured, got nil")
	}

	if !strings.Contains(err.Error(), "at least one cloud provider is required") {
		t.Errorf("Expected 'at least one cloud provider' error, got: %v", err)
	}
}

// TestCloudOnlyRouter_NoRegistryError tests error handling when registry is nil
func TestCloudOnlyRouter_NoRegistryError(t *testing.T) {
	mockProvider := &MockProvider{DefaultModel: "test-model"}

	_, err := NewCloudOnlyRouter(CloudOnlyRouterConfig{
		Registry:        nil, // Nil registry
		CloudProviders:  map[string]Provider{"mock": mockProvider},
		DefaultProvider: mockProvider,
		CacheEnabled:    false,
	})

	if err == nil {
		t.Fatal("Expected error when registry is nil, got nil")
	}

	if !strings.Contains(err.Error(), "agent registry is required") {
		t.Errorf("Expected 'agent registry is required' error, got: %v", err)
	}
}

// TestCloudOnlyRouter_CacheKeyUniqueness tests that cache keys are unique for different requests
func TestCloudOnlyRouter_CacheKeyUniqueness(t *testing.T) {
	registry := agents.NewRegistry()
	registry.Register(agents.AgentConfig{
		ID:        "test-agent",
		ModelTier: agents.TierCloudLLM,
	})

	mockProvider := &MockProvider{DefaultModel: "test-model"}

	router, err := NewCloudOnlyRouter(CloudOnlyRouterConfig{
		Registry: registry,
		CloudProviders: map[string]Provider{
			"mock": mockProvider,
		},
		DefaultProvider: mockProvider,
		CacheEnabled:    true,
		CacheTTL:        5 * time.Minute,
	})
	if err != nil {
		t.Fatalf("Failed to create router: %v", err)
	}

	// Two requests with different content - should have different cache keys
	req1 := CompletionRequest{
		AgentID: "test-agent",
		Model:   "test-model",
		Messages: []Message{
			{Role: "user", Content: "content A"},
		},
	}

	req2 := CompletionRequest{
		AgentID: "test-agent",
		Model:   "test-model",
		Messages: []Message{
			{Role: "user", Content: "content B"},
		},
	}

	key1 := router.buildCacheKey(req1)
	key2 := router.buildCacheKey(req2)

	if key1 == key2 {
		t.Errorf("Expected different cache keys for different content, got same key: %s", key1)
	}

	// Two requests with different agent IDs - should have different cache keys
	req3 := CompletionRequest{
		AgentID: "agent-1",
		Model:   "test-model",
		Messages: []Message{
			{Role: "user", Content: "same content"},
		},
	}

	req4 := CompletionRequest{
		AgentID: "agent-2",
		Model:   "test-model",
		Messages: []Message{
			{Role: "user", Content: "same content"},
		},
	}

	key3 := router.buildCacheKey(req3)
	key4 := router.buildCacheKey(req4)

	if key3 == key4 {
		t.Errorf("Expected different cache keys for different agent IDs, got same key: %s", key3)
	}
}

// TestCloudOnlyRouter_StreamingMode tests streaming functionality
func TestCloudOnlyRouter_StreamingMode(t *testing.T) {
	registry := agents.NewRegistry()
	registry.Register(agents.AgentConfig{
		ID:        "test-agent",
		ModelTier: agents.TierCloudLLM,
	})

	mockProvider := &MockProvider{DefaultModel: "test-model"}

	router, err := NewCloudOnlyRouter(CloudOnlyRouterConfig{
		Registry: registry,
		CloudProviders: map[string]Provider{
			"mock": mockProvider,
		},
		DefaultProvider: mockProvider,
		CacheEnabled:    false,
	})
	if err != nil {
		t.Fatalf("Failed to create router: %v", err)
	}

	req := CompletionRequest{
		AgentID: "test-agent",
		Model:   "test-model",
		Messages: []Message{
			{Role: "user", Content: "streaming test"},
		},
	}

	chunks := []CompletionChunk{}
	err = router.Stream(context.Background(), req, func(chunk CompletionChunk) error {
		chunks = append(chunks, chunk)
		return nil
	})

	if err != nil {
		t.Fatalf("Stream failed: %v", err)
	}

	if len(chunks) < 1 {
		t.Errorf("Expected at least 1 chunk, got %d", len(chunks))
	}

	// Last chunk should mark completion
	lastChunk := chunks[len(chunks)-1]
	if !lastChunk.Done {
		t.Errorf("Expected last chunk to have Done=true")
	}

	// Verify metrics tracked streaming request
	metrics := router.GetMetrics()
	if metrics.TotalCalls != 1 {
		t.Errorf("Expected 1 call tracked, got %d", metrics.TotalCalls)
	}
}

// BenchmarkCloudOnlyRouter_CacheHit benchmarks cache hit performance
func BenchmarkCloudOnlyRouter_CacheHit(b *testing.B) {
	registry := agents.NewRegistry()
	registry.Register(agents.AgentConfig{
		ID:        "test-agent",
		ModelTier: agents.TierCloudLLM,
	})

	mockProvider := &MockProvider{DefaultModel: "test-model"}

	router, _ := NewCloudOnlyRouter(CloudOnlyRouterConfig{
		Registry: registry,
		CloudProviders: map[string]Provider{
			"mock": mockProvider,
		},
		DefaultProvider: mockProvider,
		CacheEnabled:    true,
		CacheTTL:        10 * time.Minute,
	})

	req := CompletionRequest{
		AgentID: "test-agent",
		Model:   "test-model",
		Messages: []Message{
			{Role: "user", Content: "benchmark test"},
		},
	}

	// Prime the cache
	router.Complete(req)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		router.Complete(req)
	}
}

// BenchmarkCloudOnlyRouter_ConcurrentCacheHit benchmarks concurrent cache hits
func BenchmarkCloudOnlyRouter_ConcurrentCacheHit(b *testing.B) {
	registry := agents.NewRegistry()
	registry.Register(agents.AgentConfig{
		ID:        "test-agent",
		ModelTier: agents.TierCloudLLM,
	})

	mockProvider := &MockProvider{DefaultModel: "test-model"}

	router, _ := NewCloudOnlyRouter(CloudOnlyRouterConfig{
		Registry: registry,
		CloudProviders: map[string]Provider{
			"mock": mockProvider,
		},
		DefaultProvider: mockProvider,
		CacheEnabled:    true,
		CacheTTL:        10 * time.Minute,
	})

	req := CompletionRequest{
		AgentID: "test-agent",
		Model:   "test-model",
		Messages: []Message{
			{Role: "user", Content: "concurrent benchmark"},
		},
	}

	// Prime the cache
	router.Complete(req)

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			router.Complete(req)
		}
	})
}

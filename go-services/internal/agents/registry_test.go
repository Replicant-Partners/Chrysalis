package agents

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNewRegistry(t *testing.T) {
	r := NewRegistry()
	if r == nil {
		t.Fatal("NewRegistry returned nil")
	}
	if r.configs == nil {
		t.Error("configs map not initialized")
	}
	if r.limiters == nil {
		t.Error("limiters map not initialized")
	}
}

func TestRegistry_Register(t *testing.T) {
	r := NewRegistry()

	cfg := AgentConfig{
		ID:             "test-agent",
		Name:           "Test Agent",
		ModelTier:      TierCloudLLM,
		RateLimitRPS:   10.0,
		RateLimitBurst: 20,
	}

	r.Register(cfg)

	got := r.Get("test-agent")
	if got.ID != cfg.ID {
		t.Errorf("Get() ID = %v, want %v", got.ID, cfg.ID)
	}
	if got.Name != cfg.Name {
		t.Errorf("Get() Name = %v, want %v", got.Name, cfg.Name)
	}
	if got.ModelTier != cfg.ModelTier {
		t.Errorf("Get() ModelTier = %v, want %v", got.ModelTier, cfg.ModelTier)
	}
}

func TestRegistry_Get_Unknown(t *testing.T) {
	r := NewRegistry()

	// Getting an unknown agent should return defaults
	got := r.Get("unknown-agent")
	if got.ID != "unknown-agent" {
		t.Errorf("Get() ID = %v, want %v", got.ID, "unknown-agent")
	}
	if got.ModelTier != TierHybrid {
		t.Errorf("Get() ModelTier = %v, want %v", got.ModelTier, TierHybrid)
	}
	if got.RateLimitRPS != 5.0 {
		t.Errorf("Get() RateLimitRPS = %v, want %v", got.RateLimitRPS, 5.0)
	}
}

func TestRegistry_List(t *testing.T) {
	r := NewRegistry()

	// Empty registry
	if len(r.List()) != 0 {
		t.Error("List() should return empty slice for empty registry")
	}

	// Add agents
	r.Register(AgentConfig{ID: "agent1"})
	r.Register(AgentConfig{ID: "agent2"})
	r.Register(AgentConfig{ID: "agent3"})

	list := r.List()
	if len(list) != 3 {
		t.Errorf("List() len = %d, want 3", len(list))
	}

	// Check all IDs are present
	ids := make(map[string]bool)
	for _, id := range list {
		ids[id] = true
	}
	for _, expected := range []string{"agent1", "agent2", "agent3"} {
		if !ids[expected] {
			t.Errorf("List() missing agent %s", expected)
		}
	}
}

func TestRegistry_Allow_RateLimiting(t *testing.T) {
	r := NewRegistry()

	// Register agent with very low rate limit
	r.Register(AgentConfig{
		ID:             "limited-agent",
		RateLimitRPS:   1.0,
		RateLimitBurst: 1,
	})

	// First request should be allowed
	if !r.Allow("limited-agent") {
		t.Error("First request should be allowed")
	}

	// Second immediate request should be rate limited
	if r.Allow("limited-agent") {
		t.Error("Second immediate request should be rate limited")
	}
}

func TestRegistry_GetLimiter(t *testing.T) {
	r := NewRegistry()

	// Get limiter for unknown agent (should create default)
	lim1 := r.GetLimiter("unknown-agent")
	if lim1 == nil {
		t.Error("GetLimiter should not return nil")
	}

	// Getting same agent should return same limiter
	lim2 := r.GetLimiter("unknown-agent")
	if lim1 != lim2 {
		t.Error("GetLimiter should return same limiter for same agent")
	}
}

func TestRegistry_LoadFromDir(t *testing.T) {
	r := NewRegistry()

	// Create temp directory with test config
	tmpDir := t.TempDir()

	testConfig := `{
		"id": "test-loaded-agent",
		"name": "Test Loaded Agent",
		"model_tier": "cloud_llm",
		"rate_limit_rps": 15.0,
		"rate_limit_burst": 30,
		"max_tokens": 4000
	}`

	configPath := filepath.Join(tmpDir, "test-agent.json")
	if err := os.WriteFile(configPath, []byte(testConfig), 0644); err != nil {
		t.Fatalf("Failed to write test config: %v", err)
	}

	// Load from directory
	if err := r.LoadFromDir(tmpDir); err != nil {
		t.Fatalf("LoadFromDir failed: %v", err)
	}

	// Verify agent was loaded
	got := r.Get("test-loaded-agent")
	if got.ID != "test-loaded-agent" {
		t.Errorf("Loaded agent ID = %v, want test-loaded-agent", got.ID)
	}
	if got.RateLimitRPS != 15.0 {
		t.Errorf("Loaded agent RateLimitRPS = %v, want 15.0", got.RateLimitRPS)
	}
}

func TestRegistry_LoadFromDir_InvalidJSON(t *testing.T) {
	r := NewRegistry()
	tmpDir := t.TempDir()

	// Write invalid JSON
	configPath := filepath.Join(tmpDir, "invalid.json")
	if err := os.WriteFile(configPath, []byte("not valid json"), 0644); err != nil {
		t.Fatalf("Failed to write test config: %v", err)
	}

	err := r.LoadFromDir(tmpDir)
	if err == nil {
		t.Error("LoadFromDir should fail on invalid JSON")
	}
}

func TestRegistry_LoadFromDir_NonExistent(t *testing.T) {
	r := NewRegistry()

	err := r.LoadFromDir("/nonexistent/directory")
	if err == nil {
		t.Error("LoadFromDir should fail on non-existent directory")
	}
}

func TestRegistry_LoadBuiltInAgents(t *testing.T) {
	r := NewRegistry()
	r.LoadBuiltInAgents()

	// Verify built-in agents are loaded
	expectedAgents := []string{"ada", "lea", "phil", "david", "milton", "prompt-engineer", "ai-engineer", "universal-adapter"}

	list := r.List()
	if len(list) != len(expectedAgents) {
		t.Errorf("LoadBuiltInAgents loaded %d agents, want %d", len(list), len(expectedAgents))
	}

	for _, expected := range expectedAgents {
		cfg := r.Get(expected)
		if cfg.ID != expected {
			t.Errorf("Built-in agent %s not loaded correctly", expected)
		}
	}
}

func TestDefaultAgentConfig(t *testing.T) {
	cfg := DefaultAgentConfig("test-id")

	if cfg.ID != "test-id" {
		t.Errorf("ID = %v, want test-id", cfg.ID)
	}
	if cfg.ModelTier != TierHybrid {
		t.Errorf("ModelTier = %v, want %v", cfg.ModelTier, TierHybrid)
	}
	if cfg.RateLimitRPS != 5.0 {
		t.Errorf("RateLimitRPS = %v, want 5.0", cfg.RateLimitRPS)
	}
	if cfg.Temperature != 0.7 {
		t.Errorf("Temperature = %v, want 0.7", cfg.Temperature)
	}
}

func TestModelTier_Constants(t *testing.T) {
	// Verify tier constants have expected values
	if TierLocalSLM != "local_slm" {
		t.Errorf("TierLocalSLM = %v, want local_slm", TierLocalSLM)
	}
	if TierCloudLLM != "cloud_llm" {
		t.Errorf("TierCloudLLM = %v, want cloud_llm", TierCloudLLM)
	}
	if TierHybrid != "hybrid" {
		t.Errorf("TierHybrid = %v, want hybrid", TierHybrid)
	}
}

func TestRegistry_ConcurrentAccess(t *testing.T) {
	r := NewRegistry()
	done := make(chan bool)

	// Concurrent reads and writes
	for i := 0; i < 10; i++ {
		go func(id int) {
			cfg := AgentConfig{ID: "concurrent-agent"}
			r.Register(cfg)
			r.Get("concurrent-agent")
			r.List()
			r.Allow("concurrent-agent")
			done <- true
		}(i)
	}

	// Wait for all goroutines
	for i := 0; i < 10; i++ {
		<-done
	}
}

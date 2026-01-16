// Package ratelimit provides an HTTP server for rate limiting.
package ratelimit

import (
	"encoding/json"
	"net/http"
	"sync"
)

// Server provides an HTTP interface for rate limiting.
type Server struct {
	limiters map[string]*RateLimiter
	configs  map[string]RateLimiterConfig
	mu       sync.RWMutex
	mux      *http.ServeMux
}

// NewServer creates a new rate limiter HTTP server.
func NewServer() *Server {
	s := &Server{
		limiters: make(map[string]*RateLimiter),
		configs:  make(map[string]RateLimiterConfig),
		mux:      http.NewServeMux(),
	}
	s.registerRoutes()
	return s
}

// registerRoutes sets up HTTP routes.
func (s *Server) registerRoutes() {
	s.mux.HandleFunc("/health", s.handleHealth)
	s.mux.HandleFunc("/api/v1/check", s.handleCheck)
	s.mux.HandleFunc("/api/v1/record", s.handleRecord)
	s.mux.HandleFunc("/api/v1/stats", s.handleStats)
	s.mux.HandleFunc("/api/v1/config", s.handleConfig)
}

// Handler returns the HTTP handler.
func (s *Server) Handler() http.Handler {
	return s.mux
}

// GetOrCreateLimiter gets or creates a rate limiter for a resource.
func (s *Server) GetOrCreateLimiter(resource string) *RateLimiter {
	s.mu.RLock()
	limiter, exists := s.limiters[resource]
	s.mu.RUnlock()

	if exists {
		return limiter
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if limiter, exists = s.limiters[resource]; exists {
		return limiter
	}

	config := DefaultRateLimiterConfig()
	if customConfig, ok := s.configs[resource]; ok {
		config = customConfig
	}

	limiter = NewRateLimiter(config)
	s.limiters[resource] = limiter
	return limiter
}

// SetResourceConfig sets a custom configuration for a resource.
func (s *Server) SetResourceConfig(resource string, config RateLimiterConfig) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.configs[resource] = config
	delete(s.limiters, resource) // Force recreation with new config
}

// CheckRequest represents a rate limit check request.
type CheckRequest struct {
	Resource string `json:"resource"`
	ClientID string `json:"client_id,omitempty"`
}

// CheckResponse represents a rate limit check response.
type CheckResponse struct {
	Allowed bool   `json:"allowed"`
	Error   string `json:"error,omitempty"`
	Stats   *RateLimiterStats `json:"stats,omitempty"`
}

// handleHealth handles health checks.
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
}

// handleCheck handles rate limit checks.
func (s *Server) handleCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req CheckRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Resource == "" {
		req.Resource = "default"
	}

	limiter := s.GetOrCreateLimiter(req.Resource)
	allowed, err := limiter.AllowClient(req.ClientID)

	resp := CheckResponse{
		Allowed: allowed,
	}
	if err != nil {
		resp.Error = err.Error()
	}

	stats := limiter.Stats()
	resp.Stats = &stats

	w.Header().Set("Content-Type", "application/json")
	if !allowed {
		w.WriteHeader(http.StatusTooManyRequests)
	}
	json.NewEncoder(w).Encode(resp)
}

// RecordRequest represents a record request.
type RecordRequest struct {
	Resource string `json:"resource"`
	Success  bool   `json:"success"`
}

// handleRecord handles success/failure recording for circuit breaker.
func (s *Server) handleRecord(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req RecordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Resource == "" {
		req.Resource = "default"
	}

	limiter := s.GetOrCreateLimiter(req.Resource)
	if req.Success {
		limiter.RecordSuccess()
	} else {
		limiter.RecordFailure()
	}

	w.Header().Set("Content-Type", "application/json")
	stats := limiter.Stats()
	json.NewEncoder(w).Encode(map[string]interface{}{
		"recorded": true,
		"stats":    stats,
	})
}

// handleStats returns stats for a resource.
func (s *Server) handleStats(w http.ResponseWriter, r *http.Request) {
	resource := r.URL.Query().Get("resource")
	if resource == "" {
		resource = "default"
	}

	limiter := s.GetOrCreateLimiter(resource)
	stats := limiter.Stats()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// ConfigRequest represents a configuration request.
type ConfigRequest struct {
	Resource          string  `json:"resource"`
	RequestsPerSecond float64 `json:"requests_per_second,omitempty"`
	BurstSize         int64   `json:"burst_size,omitempty"`
	WindowLimit       int64   `json:"window_limit,omitempty"`
	FailureThreshold  int64   `json:"failure_threshold,omitempty"`
}

// handleConfig handles configuration updates.
func (s *Server) handleConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		s.handleGetConfig(w, r)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Resource == "" {
		req.Resource = "default"
	}

	config := DefaultRateLimiterConfig()
	if req.RequestsPerSecond > 0 {
		config.RequestsPerSecond = req.RequestsPerSecond
	}
	if req.BurstSize > 0 {
		config.BurstSize = req.BurstSize
	}
	if req.WindowLimit > 0 {
		config.WindowLimit = req.WindowLimit
	}
	if req.FailureThreshold > 0 {
		config.CircuitBreaker.FailureThreshold = req.FailureThreshold
	}

	s.SetResourceConfig(req.Resource, config)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"configured": true,
		"resource":   req.Resource,
	})
}

// handleGetConfig returns the current configuration.
func (s *Server) handleGetConfig(w http.ResponseWriter, r *http.Request) {
	resource := r.URL.Query().Get("resource")
	if resource == "" {
		resource = "default"
	}

	s.mu.RLock()
	config, exists := s.configs[resource]
	s.mu.RUnlock()

	if !exists {
		config = DefaultRateLimiterConfig()
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

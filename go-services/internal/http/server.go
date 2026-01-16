package httpserver

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/Replicant-Partners/Chrysalis/go-services/internal/agents"
	"github.com/Replicant-Partners/Chrysalis/go-services/internal/llm"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Server wraps the HTTP handlers for the gateway.
// Now supports multi-agent concurrent access with per-agent rate limiting.
type Server struct {
	provider       llm.Provider
	registry       *agents.Registry // Per-agent config and rate limiters
	auth           string
	requests       *prometheus.CounterVec
	latency        *prometheus.HistogramVec
	promRegistry   *prometheus.Registry
	allowedOrigins map[string]bool
}

// ServerConfig holds configuration for creating a new server.
type ServerConfig struct {
	Provider       llm.Provider
	AgentRegistry  *agents.Registry // Required for per-agent rate limiting
	AuthToken      string
	AllowedOrigins []string
}

// New constructs a new Server with per-agent rate limiting.
func New(cfg ServerConfig) *Server {
	promRegistry := prometheus.NewRegistry()
	requests := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "gateway_requests_total",
		Help: "Total gateway requests",
	}, []string{"path", "status", "agent_id"})
	latency := prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "gateway_request_duration_seconds",
		Help:    "Gateway request durations",
		Buckets: prometheus.DefBuckets,
	}, []string{"path", "agent_id"})
	promRegistry.MustRegister(requests, latency)

	// Build allowed origins map
	origins := make(map[string]bool)
	if len(cfg.AllowedOrigins) == 0 {
		// Default to localhost for development
		origins["http://localhost:3000"] = true
		origins["http://localhost:8080"] = true
		origins["http://127.0.0.1:3000"] = true
	} else {
		for _, o := range cfg.AllowedOrigins {
			origins[o] = true
		}
	}

	return &Server{
		provider:       cfg.Provider,
		registry:       cfg.AgentRegistry,
		auth:           cfg.AuthToken,
		requests:       requests,
		latency:        latency,
		promRegistry:   promRegistry,
		allowedOrigins: origins,
	}
}

// RegisterRoutes attaches handlers to a mux.
func (s *Server) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/healthz", s.wrapCORS(s.handleHealth))
	mux.HandleFunc("/v1/chat", s.wrapCORS(s.wrapAuth(s.handleChat)))
	mux.HandleFunc("/v1/chat/stream", s.wrapCORS(s.wrapAuth(s.handleChatStream)))
	mux.HandleFunc("/v1/agents", s.wrapCORS(s.wrapAuth(s.handleListAgents)))
	mux.Handle("/metrics", promhttp.HandlerFor(s.promRegistry, promhttp.HandlerOpts{}))
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	reqID := requestID(r)
	w.Header().Set("X-Request-Id", reqID)

	agentCount := 0
	if s.registry != nil {
		agentCount = len(s.registry.List())
	}

	s.writeJSONWithMetrics(w, r, "", http.StatusOK, map[string]any{
		"status":       "ok",
		"provider":     s.provider.ID(),
		"agent_count":  agentCount,
		"multi_tenant": true,
	})
}

func (s *Server) handleListAgents(w http.ResponseWriter, r *http.Request) {
	reqID := requestID(r)
	w.Header().Set("X-Request-Id", reqID)

	if s.registry == nil {
		s.writeJSONWithMetrics(w, r, "", http.StatusOK, map[string]any{
			"agents": []string{},
		})
		return
	}

	agentIDs := s.registry.List()
	agentConfigs := make([]map[string]any, 0, len(agentIDs))
	for _, id := range agentIDs {
		cfg := s.registry.Get(id)
		agentConfigs = append(agentConfigs, map[string]any{
			"id":          cfg.ID,
			"name":        cfg.Name,
			"model_tier":  cfg.ModelTier,
			"default_model": cfg.DefaultModel,
		})
	}

	s.writeJSONWithMetrics(w, r, "", http.StatusOK, map[string]any{
		"agents": agentConfigs,
	})
}

func (s *Server) handleChat(w http.ResponseWriter, r *http.Request) {
	reqID := requestID(r)
	w.Header().Set("X-Request-Id", reqID)
	start := time.Now()

	if r.Method != http.MethodPost {
		s.writeJSONWithMetrics(w, r, "", http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var req llm.CompletionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeJSONWithMetrics(w, r, "", http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	if req.AgentID == "" || len(req.Messages) == 0 {
		s.writeJSONWithMetrics(w, r, "", http.StatusBadRequest, map[string]string{"error": "agent_id and messages are required"})
		return
	}

	// Per-agent rate limiting
	if s.registry != nil && !s.registry.Allow(req.AgentID) {
		agentCfg := s.registry.Get(req.AgentID)
		s.logJSON(map[string]any{
			"event":    "rate_limited",
			"req_id":   reqID,
			"agent_id": req.AgentID,
			"tier":     agentCfg.ModelTier,
		})
		s.writeJSONWithMetrics(w, r, req.AgentID, http.StatusTooManyRequests, map[string]string{
			"error":    "rate limit exceeded",
			"agent_id": req.AgentID,
		})
		return
	}

	resp, err := s.provider.Complete(req)
	if err != nil {
		s.logJSON(map[string]any{
			"event":       "chat_error",
			"req_id":      reqID,
			"agent_id":    req.AgentID,
			"path":        "/v1/chat",
			"duration_ms": time.Since(start).Milliseconds(),
			"error":       err.Error(),
		})
		s.writeJSONWithMetrics(w, r, req.AgentID, http.StatusBadGateway, map[string]string{"error": "llm failure"})
		return
	}

	s.latency.WithLabelValues("/v1/chat", req.AgentID).Observe(time.Since(start).Seconds())
	s.logJSON(map[string]any{
		"event":       "chat_ok",
		"req_id":      reqID,
		"agent_id":    req.AgentID,
		"path":        "/v1/chat",
		"provider":    resp.Provider,
		"model":       resp.Model,
		"duration_ms": time.Since(start).Milliseconds(),
	})
	s.writeJSONWithMetrics(w, r, req.AgentID, http.StatusOK, resp)
}

func (s *Server) handleChatStream(w http.ResponseWriter, r *http.Request) {
	reqID := requestID(r)
	w.Header().Set("X-Request-Id", reqID)
	start := time.Now()

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		s.writeJSONWithMetrics(w, r, "", http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var req llm.CompletionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeJSONWithMetrics(w, r, "", http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}

	if req.AgentID == "" || len(req.Messages) == 0 {
		s.writeJSONWithMetrics(w, r, "", http.StatusBadRequest, map[string]string{"error": "agent_id and messages are required"})
		return
	}

	// Per-agent rate limiting
	if s.registry != nil && !s.registry.Allow(req.AgentID) {
		s.writeJSONWithMetrics(w, r, req.AgentID, http.StatusTooManyRequests, map[string]string{
			"error":    "rate limit exceeded",
			"agent_id": req.AgentID,
		})
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		s.writeJSONWithMetrics(w, r, req.AgentID, http.StatusInternalServerError, map[string]string{"error": "streaming unsupported"})
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Request-Id", reqID)

	ctx := r.Context()
	err := s.provider.Stream(ctx, req, func(chunk llm.CompletionChunk) error {
		data, err := json.Marshal(chunk)
		if err != nil {
			return err
		}
		if _, err := w.Write([]byte("data: ")); err != nil {
			return err
		}
		if _, err := w.Write(data); err != nil {
			return err
		}
		if _, err := w.Write([]byte("\n\n")); err != nil {
			return err
		}
		flusher.Flush()
		return nil
	})

	if err != nil && !errors.Is(err, context.Canceled) {
		s.logJSON(map[string]any{
			"event":       "chat_stream_error",
			"req_id":      reqID,
			"agent_id":    req.AgentID,
			"path":        "/v1/chat/stream",
			"error":       err.Error(),
			"duration_ms": time.Since(start).Milliseconds(),
		})
		_, _ = w.Write([]byte("data: {\"error\":\"stream failure\",\"done\":true}\n\n"))
		flusher.Flush()
		return
	}

	s.latency.WithLabelValues("/v1/chat/stream", req.AgentID).Observe(time.Since(start).Seconds())
	s.logJSON(map[string]any{
		"event":       "chat_stream_ok",
		"req_id":      reqID,
		"agent_id":    req.AgentID,
		"path":        "/v1/chat/stream",
		"provider":    s.provider.ID(),
		"duration_ms": time.Since(start).Milliseconds(),
	})
}

func (s *Server) wrapAuth(next http.HandlerFunc) http.HandlerFunc {
	if s.auth == "" {
		return next
	}
	return func(w http.ResponseWriter, r *http.Request) {
		token := r.Header.Get("Authorization")
		if token != "Bearer "+s.auth {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}
		next(w, r)
	}
}

// wrapCORS adds CORS headers with origin validation.
func (s *Server) wrapCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && s.allowedOrigins[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

func requestID(r *http.Request) string {
	if v := r.Header.Get("X-Request-Id"); v != "" {
		return v
	}
	var b [8]byte
	if _, err := rand.Read(b[:]); err == nil {
		return hex.EncodeToString(b[:])
	}
	return time.Now().Format("20060102150405.000000")
}

// writeJSONWithMetrics writes JSON, records metrics, and sets content type.
func (s *Server) writeJSONWithMetrics(w http.ResponseWriter, r *http.Request, agentID string, status int, v any) {
	if s.requests != nil {
		if agentID == "" {
			agentID = "unknown"
		}
		s.requests.WithLabelValues(r.URL.Path, http.StatusText(status), agentID).Inc()
	}
	writeJSON(w, status, v)
}

// logJSON writes a structured JSON log line.
func (s *Server) logJSON(fields map[string]any) {
	b, err := json.Marshal(fields)
	if err != nil {
		log.Printf("log encode error: %v", err)
		return
	}
	log.Println(string(b))
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

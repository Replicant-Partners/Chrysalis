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

	"github.com/Replicant-Partners/Chrysalis/go-services/internal/llm"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"golang.org/x/time/rate"
)

// Server wraps the HTTP handlers for the gateway.
type Server struct {
	provider       llm.Provider
	auth           string
	limiter        *rate.Limiter
	requests       *prometheus.CounterVec
	latency        *prometheus.HistogramVec
	registry       *prometheus.Registry
	allowedOrigins map[string]bool // CORS allowed origins
}

// New constructs a new Server.
// allowedOrigins specifies CORS allowed origins. If empty, uses localhost defaults for development.
// In production, always specify explicit origins.
func New(provider llm.Provider, authToken string, rps float64, burst int, allowedOrigins []string) *Server {
	var limiter *rate.Limiter
	if rps > 0 && burst > 0 {
		limiter = rate.NewLimiter(rate.Limit(rps), burst)
	}
	registry := prometheus.NewRegistry()
	requests := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "gateway_requests_total",
		Help: "Total gateway requests",
	}, []string{"path", "status"})
	latency := prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "gateway_request_duration_seconds",
		Help:    "Gateway request durations",
		Buckets: prometheus.DefBuckets,
	}, []string{"path"})
	registry.MustRegister(requests, latency)

	// Build allowed origins map
	origins := make(map[string]bool)
	if len(allowedOrigins) == 0 {
		// Default to localhost for development
		origins["http://localhost:3000"] = true
		origins["http://localhost:8080"] = true
		origins["http://127.0.0.1:3000"] = true
	} else {
		for _, o := range allowedOrigins {
			origins[o] = true
		}
	}

	return &Server{
		provider:       provider,
		auth:           authToken,
		limiter:        limiter,
		requests:       requests,
		latency:        latency,
		registry:       registry,
		allowedOrigins: origins,
	}
}

// RegisterRoutes attaches handlers to a mux.
func (s *Server) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/healthz", s.wrapCORS(s.handleHealth))
	mux.HandleFunc("/v1/chat", s.wrapCORS(s.wrapRateLimit(s.wrapAuth(s.handleChat))))
	mux.HandleFunc("/v1/chat/stream", s.wrapCORS(s.wrapRateLimit(s.wrapAuth(s.handleChatStream))))
	mux.Handle("/metrics", promhttp.HandlerFor(s.registry, promhttp.HandlerOpts{}))
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	reqID := requestID(r)
	w.Header().Set("X-Request-Id", reqID)
	s.writeJSONWithMetrics(w, r, http.StatusOK, map[string]any{
		"status":   "ok",
		"provider": s.provider.ID(),
	})
}

func (s *Server) handleChat(w http.ResponseWriter, r *http.Request) {
	reqID := requestID(r)
	w.Header().Set("X-Request-Id", reqID)
	start := time.Now()

	if r.Method != http.MethodPost {
		s.writeJSONWithMetrics(w, r, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var req llm.CompletionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeJSONWithMetrics(w, r, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	if req.AgentID == "" || len(req.Messages) == 0 {
		s.writeJSONWithMetrics(w, r, http.StatusBadRequest, map[string]string{"error": "agent_id and messages are required"})
		return
	}

	resp, err := s.provider.Complete(req)
	if err != nil {
		s.logJSON(map[string]any{
			"event":       "chat_error",
			"req_id":      reqID,
			"path":        "/v1/chat",
			"duration_ms": time.Since(start).Milliseconds(),
			"error":       err.Error(),
		})
		s.writeJSONWithMetrics(w, r, http.StatusBadGateway, map[string]string{"error": "llm failure"})
		return
	}
	s.logJSON(map[string]any{
		"event":       "chat_ok",
		"req_id":      reqID,
		"path":        "/v1/chat",
		"provider":    s.provider.ID(),
		"duration_ms": time.Since(start).Milliseconds(),
	})
	s.writeJSONWithMetrics(w, r, http.StatusOK, resp)
}

func (s *Server) handleChatStream(w http.ResponseWriter, r *http.Request) {
	reqID := requestID(r)
	w.Header().Set("X-Request-Id", reqID)
	start := time.Now()

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodPost {
		s.writeJSONWithMetrics(w, r, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var req llm.CompletionRequest
	if r.Method == http.MethodPost {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			s.writeJSONWithMetrics(w, r, http.StatusBadRequest, map[string]string{"error": "invalid json"})
			return
		}
	} else {
		// GET not fully supported; reject for clarity
		s.writeJSONWithMetrics(w, r, http.StatusBadRequest, map[string]string{"error": "stream requires POST body"})
		return
	}

	if req.AgentID == "" || len(req.Messages) == 0 {
		s.writeJSONWithMetrics(w, r, http.StatusBadRequest, map[string]string{"error": "agent_id and messages are required"})
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		s.writeJSONWithMetrics(w, r, http.StatusInternalServerError, map[string]string{"error": "streaming unsupported"})
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
			"path":        "/v1/chat/stream",
			"error":       err.Error(),
			"duration_ms": time.Since(start).Milliseconds(),
		})
		// Send error chunk if possible
		_, _ = w.Write([]byte("data: {\"error\":\"stream failure\",\"done\":true}\n\n"))
		flusher.Flush()
		return
	}
	s.logJSON(map[string]any{
		"event":       "chat_stream_ok",
		"req_id":      reqID,
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
// Only origins in the allowedOrigins map are permitted.
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

// wrapRateLimit enforces a simple per-process rate limit.
func (s *Server) wrapRateLimit(next http.HandlerFunc) http.HandlerFunc {
	if s.limiter == nil {
		return next
	}
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.limiter.Allow() {
			s.writeJSONWithMetrics(w, r, http.StatusTooManyRequests, map[string]string{"error": "rate limit exceeded"})
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
func (s *Server) writeJSONWithMetrics(w http.ResponseWriter, r *http.Request, status int, v any) {
	if s.requests != nil && s.latency != nil {
		s.requests.WithLabelValues(r.URL.Path, http.StatusText(status)).Inc()
		// latency recorded at caller; here we only track count
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

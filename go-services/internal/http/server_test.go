package httpserver

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Replicant-Partners/Chrysalis/go-services/internal/llm"
)

type mockProvider struct{ llm.MockProvider }

func TestCORS(t *testing.T) {
	// Test with explicitly allowed origin
	allowedOrigins := []string{"http://localhost:3000"}
	s := New(mockProvider{}, "", 0, 0, allowedOrigins)
	mux := http.NewServeMux()
	s.RegisterRoutes(mux)

	req := httptest.NewRequest(http.MethodOptions, "/v1/chat", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	w := httptest.NewRecorder()

	mux.ServeHTTP(w, req)

	if status := w.Result().StatusCode; status != http.StatusNoContent {
		t.Fatalf("expected 204 for OPTIONS, got %d", status)
	}
	if allow := w.Header().Get("Access-Control-Allow-Origin"); allow != "http://localhost:3000" {
		t.Fatalf("expected 'http://localhost:3000' CORS, got %s", allow)
	}
}

func TestCORSBlocksUnknownOrigin(t *testing.T) {
	allowedOrigins := []string{"http://localhost:3000"}
	s := New(mockProvider{}, "", 0, 0, allowedOrigins)
	mux := http.NewServeMux()
	s.RegisterRoutes(mux)

	req := httptest.NewRequest(http.MethodOptions, "/v1/chat", nil)
	req.Header.Set("Origin", "http://evil.com")
	w := httptest.NewRecorder()

	mux.ServeHTTP(w, req)

	if allow := w.Header().Get("Access-Control-Allow-Origin"); allow != "" {
		t.Fatalf("expected no CORS header for unknown origin, got %s", allow)
	}
}

func TestChatBadRequest(t *testing.T) {
	s := New(mockProvider{}, "", 0, 0, nil)
	mux := http.NewServeMux()
	s.RegisterRoutes(mux)

	req := httptest.NewRequest(http.MethodPost, "/v1/chat", strings.NewReader(`{"messages":[]}`))
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if status := w.Result().StatusCode; status != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", status)
	}
}

func TestRateLimit(t *testing.T) {
	s := New(mockProvider{}, "", 1, 1, nil)
	mux := http.NewServeMux()
	s.RegisterRoutes(mux)

	req := httptest.NewRequest(http.MethodPost, "/v1/chat", strings.NewReader(`{"agent_id":"a","messages":[{"role":"user","content":"hi"}]}`))
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if w.Result().StatusCode == http.StatusTooManyRequests {
		t.Fatalf("first request should pass")
	}

	// Immediate second request should hit limiter (burst 1)
	w2 := httptest.NewRecorder()
	mux.ServeHTTP(w2, req)
	if w2.Result().StatusCode != http.StatusTooManyRequests {
		t.Fatalf("expected rate limit, got %d", w2.Result().StatusCode)
	}
}

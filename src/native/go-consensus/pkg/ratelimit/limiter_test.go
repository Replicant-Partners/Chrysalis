package ratelimit

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

func TestTokenBucket_Basic(t *testing.T) {
	tb := NewTokenBucket(10, 10.0) // 10 capacity, 10/sec refill

	// Should allow initial burst
	for i := 0; i < 10; i++ {
		if !tb.Allow() {
			t.Errorf("expected request %d to be allowed", i)
		}
	}

	// Should be exhausted
	if tb.Allow() {
		t.Error("expected request to be denied after exhaustion")
	}
}

func TestTokenBucket_Refill(t *testing.T) {
	tb := NewTokenBucket(10, 100.0) // 10 capacity, 100/sec refill

	// Exhaust tokens
	for i := 0; i < 10; i++ {
		tb.Allow()
	}

	// Wait for refill
	time.Sleep(50 * time.Millisecond) // Should refill ~5 tokens

	tokens := tb.Tokens()
	if tokens < 4 || tokens > 6 {
		t.Errorf("expected ~5 tokens after refill, got %f", tokens)
	}
}

func TestTokenBucket_Wait(t *testing.T) {
	tb := NewTokenBucket(1, 100.0) // 1 capacity, 100/sec refill

	// Exhaust token
	tb.Allow()

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	start := time.Now()
	err := tb.Wait(ctx)
	duration := time.Since(start)

	if err != nil {
		t.Errorf("expected Wait to succeed, got error: %v", err)
	}

	if duration < 5*time.Millisecond {
		t.Errorf("expected Wait to take some time, took %v", duration)
	}
}

func TestSlidingWindow_Basic(t *testing.T) {
	sw := NewSlidingWindow(10, 100*time.Millisecond, 10)

	// Should allow up to limit
	for i := 0; i < 10; i++ {
		if !sw.Allow() {
			t.Errorf("expected request %d to be allowed", i)
		}
	}

	// Should deny over limit
	if sw.Allow() {
		t.Error("expected request to be denied at limit")
	}

	// Wait for window to expire
	time.Sleep(110 * time.Millisecond)

	// Should allow again
	if !sw.Allow() {
		t.Error("expected request to be allowed after window reset")
	}
}

func TestSlidingWindow_Count(t *testing.T) {
	sw := NewSlidingWindow(100, time.Second, 10)

	for i := 0; i < 5; i++ {
		sw.Allow()
	}

	count := sw.Count()
	if count != 5 {
		t.Errorf("expected count of 5, got %d", count)
	}
}

func TestCircuitBreaker_ClosedToOpen(t *testing.T) {
	config := CircuitBreakerConfig{
		FailureThreshold: 3,
		SuccessThreshold: 2,
		Timeout:          50 * time.Millisecond,
		MaxHalfOpen:      1,
	}
	cb := NewCircuitBreaker(config)

	// Should start closed
	if cb.State() != CircuitClosed {
		t.Errorf("expected initial state to be closed, got %s", cb.State())
	}

	// Record failures to open circuit
	for i := int64(0); i < config.FailureThreshold; i++ {
		cb.RecordFailure()
	}

	if cb.State() != CircuitOpen {
		t.Errorf("expected state to be open after failures, got %s", cb.State())
	}

	// Should deny requests when open
	allowed, err := cb.Allow()
	if allowed || err != ErrCircuitOpen {
		t.Errorf("expected denial when open, got allowed=%v err=%v", allowed, err)
	}
}

func TestCircuitBreaker_OpenToHalfOpen(t *testing.T) {
	config := CircuitBreakerConfig{
		FailureThreshold: 2,
		SuccessThreshold: 2,
		Timeout:          20 * time.Millisecond,
		MaxHalfOpen:      1,
	}
	cb := NewCircuitBreaker(config)

	// Open the circuit
	cb.RecordFailure()
	cb.RecordFailure()

	if cb.State() != CircuitOpen {
		t.Fatalf("expected circuit to be open, got %s", cb.State())
	}

	// Wait for timeout
	time.Sleep(30 * time.Millisecond)

	// Should transition to half-open on next check
	allowed, err := cb.Allow()
	if !allowed || err != nil {
		t.Errorf("expected allowance after timeout, got allowed=%v err=%v", allowed, err)
	}

	if cb.State() != CircuitHalfOpen {
		t.Errorf("expected half-open state, got %s", cb.State())
	}
}

func TestCircuitBreaker_HalfOpenToClosed(t *testing.T) {
	config := CircuitBreakerConfig{
		FailureThreshold: 2,
		SuccessThreshold: 2,
		Timeout:          10 * time.Millisecond,
		MaxHalfOpen:      2,
	}
	cb := NewCircuitBreaker(config)

	// Open and wait for half-open
	cb.RecordFailure()
	cb.RecordFailure()
	time.Sleep(15 * time.Millisecond)
	cb.Allow() // Transition to half-open

	// Record successes to close
	cb.RecordSuccess()
	cb.RecordSuccess()

	if cb.State() != CircuitClosed {
		t.Errorf("expected circuit to close after successes, got %s", cb.State())
	}
}

func TestCircuitBreaker_Execute(t *testing.T) {
	config := DefaultCircuitBreakerConfig()
	cb := NewCircuitBreaker(config)

	// Successful execution
	err := cb.Execute(func() error {
		return nil
	})
	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}

	// Failed execution
	testErr := errors.New("test error")
	err = cb.Execute(func() error {
		return testErr
	})
	if err != testErr {
		t.Errorf("expected test error, got %v", err)
	}
}

func TestClientLimiter_PerClient(t *testing.T) {
	cl := NewClientLimiter(5, time.Second)

	// Each client should have independent limits
	for i := 0; i < 5; i++ {
		if !cl.Allow("client-a") {
			t.Errorf("expected client-a request %d to be allowed", i)
		}
		if !cl.Allow("client-b") {
			t.Errorf("expected client-b request %d to be allowed", i)
		}
	}

	// Both should be exhausted
	if cl.Allow("client-a") {
		t.Error("expected client-a to be rate limited")
	}
	if cl.Allow("client-b") {
		t.Error("expected client-b to be rate limited")
	}
}

func TestClientLimiter_CustomLimit(t *testing.T) {
	cl := NewClientLimiter(5, time.Second)
	cl.SetClientLimit("vip", 10)

	// VIP should have higher limit
	for i := 0; i < 10; i++ {
		if !cl.Allow("vip") {
			t.Errorf("expected VIP request %d to be allowed", i)
		}
	}

	if cl.Allow("vip") {
		t.Error("expected VIP to be rate limited after 10 requests")
	}
}

func TestRateLimiter_Combined(t *testing.T) {
	config := RateLimiterConfig{
		RequestsPerSecond:  100,
		BurstSize:          10,
		WindowLimit:        100,
		WindowSize:         time.Second,
		CircuitBreaker:     DefaultCircuitBreakerConfig(),
		EnableClientLimits: true,
		ClientLimitDefault: 50,
	}
	rl := NewRateLimiter(config)

	// Should allow within limits
	for i := 0; i < 10; i++ {
		allowed, err := rl.AllowClient("test-client")
		if !allowed || err != nil {
			t.Errorf("expected request %d to be allowed, got allowed=%v err=%v", i, allowed, err)
		}
	}

	// Verify stats
	stats := rl.Stats()
	if stats.CircuitState != "closed" {
		t.Errorf("expected circuit state to be closed, got %s", stats.CircuitState)
	}
}

func TestRateLimiter_CircuitBreakerIntegration(t *testing.T) {
	config := RateLimiterConfig{
		RequestsPerSecond:  1000,
		BurstSize:          100,
		WindowLimit:        1000,
		WindowSize:         time.Second,
		CircuitBreaker: CircuitBreakerConfig{
			FailureThreshold: 3,
			SuccessThreshold: 1,
			Timeout:          20 * time.Millisecond,
			MaxHalfOpen:      1,
		},
		EnableClientLimits: false,
	}
	rl := NewRateLimiter(config)

	// Record failures to open circuit
	for i := int64(0); i < 3; i++ {
		rl.Allow()
		rl.RecordFailure()
	}

	// Should be blocked by circuit breaker
	allowed, err := rl.Allow()
	if allowed || err != ErrCircuitOpen {
		t.Errorf("expected circuit breaker block, got allowed=%v err=%v", allowed, err)
	}

	stats := rl.Stats()
	if stats.CircuitState != "open" {
		t.Errorf("expected circuit state to be open, got %s", stats.CircuitState)
	}
}

func TestRateLimiter_Concurrent(t *testing.T) {
	config := DefaultRateLimiterConfig()
	config.BurstSize = 100
	config.WindowLimit = 1000
	rl := NewRateLimiter(config)

	var wg sync.WaitGroup
	allowed := make([]bool, 200)

	for i := 0; i < 200; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			ok, _ := rl.Allow()
			allowed[idx] = ok
		}(i)
	}

	wg.Wait()

	// Count how many were allowed
	count := 0
	for _, a := range allowed {
		if a {
			count++
		}
	}

	// Should have allowed approximately burst size
	if count < 80 || count > 120 {
		t.Errorf("expected ~100 allowed, got %d", count)
	}
}

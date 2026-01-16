package llm

import (
	"context"
	"errors"
	"sync"
	"time"
)

// CircuitState represents the state of the circuit breaker.
type CircuitState string

const (
	CircuitClosed   CircuitState = "closed"   // Normal operation
	CircuitOpen     CircuitState = "open"     // Failing, rejecting requests
	CircuitHalfOpen CircuitState = "half-open" // Testing if service recovered
)

var ErrCircuitOpen = errors.New("circuit breaker is open")

// CircuitBreaker wraps a Provider with circuit breaker pattern.
type CircuitBreaker struct {
	provider         Provider
	failureThreshold int
	resetTimeout     time.Duration

	mu            sync.RWMutex
	state         CircuitState
	failures      int
	lastFailure   time.Time
	successStreak int
}

type CircuitBreakerConfig struct {
	FailureThreshold int           // Number of failures before opening
	ResetTimeout     time.Duration // Time before attempting half-open
}

// NewCircuitBreaker wraps a provider with circuit breaker functionality.
func NewCircuitBreaker(provider Provider, cfg CircuitBreakerConfig) *CircuitBreaker {
	if cfg.FailureThreshold <= 0 {
		cfg.FailureThreshold = 3
	}
	if cfg.ResetTimeout <= 0 {
		cfg.ResetTimeout = 60 * time.Second
	}

	return &CircuitBreaker{
		provider:         provider,
		failureThreshold: cfg.FailureThreshold,
		resetTimeout:     cfg.ResetTimeout,
		state:            CircuitClosed,
	}
}

func (cb *CircuitBreaker) ID() string {
	return cb.provider.ID()
}

func (cb *CircuitBreaker) State() CircuitState {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.state
}

func (cb *CircuitBreaker) Complete(req CompletionRequest) (CompletionResponse, error) {
	if err := cb.allowRequest(); err != nil {
		return CompletionResponse{}, err
	}

	resp, err := cb.provider.Complete(req)
	cb.recordResult(err)
	return resp, err
}

func (cb *CircuitBreaker) Stream(ctx context.Context, req CompletionRequest, emit func(CompletionChunk) error) error {
	if err := cb.allowRequest(); err != nil {
		return err
	}

	err := cb.provider.Stream(ctx, req, emit)
	cb.recordResult(err)
	return err
}

func (cb *CircuitBreaker) allowRequest() error {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case CircuitClosed:
		return nil
	case CircuitOpen:
		// Check if enough time has passed to try half-open
		if time.Since(cb.lastFailure) > cb.resetTimeout {
			cb.state = CircuitHalfOpen
			cb.successStreak = 0
			return nil
		}
		return ErrCircuitOpen
	case CircuitHalfOpen:
		return nil
	}
	return nil
}

func (cb *CircuitBreaker) recordResult(err error) {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	if err != nil {
		cb.failures++
		cb.lastFailure = time.Now()
		cb.successStreak = 0

		if cb.failures >= cb.failureThreshold {
			cb.state = CircuitOpen
		}
	} else {
		cb.successStreak++

		// In half-open state, successful requests close the circuit
		if cb.state == CircuitHalfOpen && cb.successStreak >= 2 {
			cb.state = CircuitClosed
			cb.failures = 0
		}
	}
}

// Reset manually resets the circuit breaker to closed state.
func (cb *CircuitBreaker) Reset() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.state = CircuitClosed
	cb.failures = 0
	cb.successStreak = 0
}

// Metrics returns current circuit breaker metrics.
func (cb *CircuitBreaker) Metrics() CircuitMetrics {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return CircuitMetrics{
		State:         cb.state,
		Failures:      cb.failures,
		LastFailure:   cb.lastFailure,
		SuccessStreak: cb.successStreak,
	}
}

type CircuitMetrics struct {
	State         CircuitState
	Failures      int
	LastFailure   time.Time
	SuccessStreak int
}

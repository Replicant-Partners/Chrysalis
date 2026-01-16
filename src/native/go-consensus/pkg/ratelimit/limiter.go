// Package ratelimit implements high-performance rate limiting algorithms
// including token bucket, sliding window, and circuit breaker patterns.
package ratelimit

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"sync/atomic"
	"time"
)

// Common errors
var (
	ErrRateLimitExceeded = errors.New("rate limit exceeded")
	ErrCircuitOpen       = errors.New("circuit breaker is open")
	ErrTimeout           = errors.New("request timeout")
)

// ============================================================================
// Token Bucket Algorithm
// ============================================================================

// TokenBucket implements the token bucket rate limiting algorithm.
// Tokens are added at a constant rate and consumed by requests.
type TokenBucket struct {
	capacity   int64         // Maximum bucket capacity
	rate       float64       // Tokens per second refill rate
	tokens     int64         // Current tokens (stored as int64 for atomics, scaled by 1000)
	lastRefill int64         // Last refill timestamp (unix nano)
	mu         sync.Mutex    // Mutex for refill calculation
}

const tokenScale = 1000 // Scale factor for token precision

// NewTokenBucket creates a new token bucket rate limiter.
func NewTokenBucket(capacity int64, tokensPerSecond float64) *TokenBucket {
	return &TokenBucket{
		capacity:   capacity * tokenScale,
		rate:       tokensPerSecond * tokenScale,
		tokens:     capacity * tokenScale,
		lastRefill: time.Now().UnixNano(),
	}
}

// refill adds tokens based on elapsed time.
func (tb *TokenBucket) refill() {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	now := time.Now().UnixNano()
	elapsed := float64(now-tb.lastRefill) / float64(time.Second)
	tb.lastRefill = now

	newTokens := tb.tokens + int64(elapsed*tb.rate)
	if newTokens > tb.capacity {
		newTokens = tb.capacity
	}
	atomic.StoreInt64(&tb.tokens, newTokens)
}

// Allow checks if a request can proceed and consumes a token if allowed.
func (tb *TokenBucket) Allow() bool {
	return tb.AllowN(1)
}

// AllowN checks if N tokens are available and consumes them if so.
func (tb *TokenBucket) AllowN(n int64) bool {
	tb.refill()

	cost := n * tokenScale
	for {
		current := atomic.LoadInt64(&tb.tokens)
		if current < cost {
			return false
		}
		if atomic.CompareAndSwapInt64(&tb.tokens, current, current-cost) {
			return true
		}
	}
}

// Wait blocks until a token is available or context is cancelled.
func (tb *TokenBucket) Wait(ctx context.Context) error {
	return tb.WaitN(ctx, 1)
}

// WaitN blocks until N tokens are available or context is cancelled.
func (tb *TokenBucket) WaitN(ctx context.Context, n int64) error {
	for {
		if tb.AllowN(n) {
			return nil
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(10 * time.Millisecond):
			// Retry after short delay
		}
	}
}

// Tokens returns the current number of available tokens.
func (tb *TokenBucket) Tokens() float64 {
	tb.refill()
	return float64(atomic.LoadInt64(&tb.tokens)) / tokenScale
}

// ============================================================================
// Sliding Window Rate Limiter
// ============================================================================

// SlidingWindow implements a sliding window rate limiter with sub-window precision.
type SlidingWindow struct {
	limit        int64         // Max requests per window
	windowSize   time.Duration // Window duration
	numSlots     int           // Number of sub-windows
	slotDuration time.Duration // Duration of each sub-window
	slots        []int64       // Request counts per slot
	currentSlot  int           // Current slot index
	lastSlotTime int64         // Timestamp of current slot start
	mu           sync.Mutex
}

// NewSlidingWindow creates a new sliding window rate limiter.
func NewSlidingWindow(limit int64, windowSize time.Duration, numSlots int) *SlidingWindow {
	if numSlots < 2 {
		numSlots = 10 // Default to 10 sub-windows
	}
	return &SlidingWindow{
		limit:        limit,
		windowSize:   windowSize,
		numSlots:     numSlots,
		slotDuration: windowSize / time.Duration(numSlots),
		slots:        make([]int64, numSlots),
		currentSlot:  0,
		lastSlotTime: time.Now().UnixNano(),
	}
}

// advance moves the window forward, clearing expired slots.
func (sw *SlidingWindow) advance() {
	now := time.Now().UnixNano()
	slotDurationNs := int64(sw.slotDuration)
	elapsed := now - sw.lastSlotTime

	slotsToAdvance := int(elapsed / slotDurationNs)
	if slotsToAdvance > 0 {
		if slotsToAdvance >= sw.numSlots {
			// Clear all slots
			for i := range sw.slots {
				sw.slots[i] = 0
			}
		} else {
			// Clear expired slots
			for i := 0; i < slotsToAdvance; i++ {
				sw.currentSlot = (sw.currentSlot + 1) % sw.numSlots
				sw.slots[sw.currentSlot] = 0
			}
		}
		sw.lastSlotTime = now - (elapsed % slotDurationNs)
	}
}

// count returns the total requests in the current window.
func (sw *SlidingWindow) count() int64 {
	var total int64
	for _, c := range sw.slots {
		total += c
	}
	return total
}

// Allow checks if a request can proceed and records it if allowed.
func (sw *SlidingWindow) Allow() bool {
	sw.mu.Lock()
	defer sw.mu.Unlock()

	sw.advance()

	if sw.count() >= sw.limit {
		return false
	}

	sw.slots[sw.currentSlot]++
	return true
}

// AllowN checks if N requests can proceed.
func (sw *SlidingWindow) AllowN(n int64) bool {
	sw.mu.Lock()
	defer sw.mu.Unlock()

	sw.advance()

	if sw.count()+n > sw.limit {
		return false
	}

	sw.slots[sw.currentSlot] += n
	return true
}

// Count returns the current request count in the window.
func (sw *SlidingWindow) Count() int64 {
	sw.mu.Lock()
	defer sw.mu.Unlock()
	sw.advance()
	return sw.count()
}

// ============================================================================
// Circuit Breaker
// ============================================================================

// CircuitState represents the state of a circuit breaker.
type CircuitState int32

const (
	CircuitClosed   CircuitState = iota // Normal operation
	CircuitOpen                         // Failing, reject requests
	CircuitHalfOpen                     // Testing if service recovered
)

func (s CircuitState) String() string {
	switch s {
	case CircuitClosed:
		return "closed"
	case CircuitOpen:
		return "open"
	case CircuitHalfOpen:
		return "half-open"
	default:
		return "unknown"
	}
}

// CircuitBreakerConfig configures a circuit breaker.
type CircuitBreakerConfig struct {
	FailureThreshold int64         // Number of failures before opening
	SuccessThreshold int64         // Successes needed to close from half-open
	Timeout          time.Duration // Time before trying half-open
	MaxHalfOpen      int64         // Max concurrent half-open requests
}

// DefaultCircuitBreakerConfig returns sensible defaults.
func DefaultCircuitBreakerConfig() CircuitBreakerConfig {
	return CircuitBreakerConfig{
		FailureThreshold: 5,
		SuccessThreshold: 3,
		Timeout:          30 * time.Second,
		MaxHalfOpen:      1,
	}
}

// CircuitBreaker implements the circuit breaker pattern for fault tolerance.
type CircuitBreaker struct {
	config         CircuitBreakerConfig
	state          int32 // CircuitState stored as int32 for atomics
	failures       int64
	successes      int64
	lastFailure    int64 // Unix nano timestamp
	halfOpenCount  int64
	mu             sync.Mutex
	onStateChange  func(from, to CircuitState)
}

// NewCircuitBreaker creates a new circuit breaker with the given config.
func NewCircuitBreaker(config CircuitBreakerConfig) *CircuitBreaker {
	return &CircuitBreaker{
		config: config,
		state:  int32(CircuitClosed),
	}
}

// OnStateChange sets a callback for state transitions.
func (cb *CircuitBreaker) OnStateChange(fn func(from, to CircuitState)) {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.onStateChange = fn
}

// State returns the current circuit state.
func (cb *CircuitBreaker) State() CircuitState {
	return CircuitState(atomic.LoadInt32(&cb.state))
}

// transition changes the circuit state.
func (cb *CircuitBreaker) transition(to CircuitState) {
	cb.mu.Lock()
	from := CircuitState(cb.state)
	if from == to {
		cb.mu.Unlock()
		return
	}

	atomic.StoreInt32(&cb.state, int32(to))
	atomic.StoreInt64(&cb.failures, 0)
	atomic.StoreInt64(&cb.successes, 0)
	atomic.StoreInt64(&cb.halfOpenCount, 0)

	callback := cb.onStateChange
	cb.mu.Unlock()

	if callback != nil {
		callback(from, to)
	}
}

// Allow checks if a request should be allowed through the circuit.
func (cb *CircuitBreaker) Allow() (bool, error) {
	state := cb.State()

	switch state {
	case CircuitClosed:
		return true, nil

	case CircuitOpen:
		// Check if timeout has elapsed
		lastFail := atomic.LoadInt64(&cb.lastFailure)
		if time.Now().UnixNano()-lastFail > int64(cb.config.Timeout) {
			cb.transition(CircuitHalfOpen)
			return cb.Allow()
		}
		return false, ErrCircuitOpen

	case CircuitHalfOpen:
		// Allow limited requests for testing
		count := atomic.AddInt64(&cb.halfOpenCount, 1)
		if count > cb.config.MaxHalfOpen {
			atomic.AddInt64(&cb.halfOpenCount, -1)
			return false, ErrCircuitOpen
		}
		return true, nil

	default:
		return false, ErrCircuitOpen
	}
}

// RecordSuccess records a successful request.
func (cb *CircuitBreaker) RecordSuccess() {
	state := cb.State()

	switch state {
	case CircuitClosed:
		// Reset failure count on success
		atomic.StoreInt64(&cb.failures, 0)

	case CircuitHalfOpen:
		successes := atomic.AddInt64(&cb.successes, 1)
		atomic.AddInt64(&cb.halfOpenCount, -1)
		if successes >= cb.config.SuccessThreshold {
			cb.transition(CircuitClosed)
		}
	}
}

// RecordFailure records a failed request.
func (cb *CircuitBreaker) RecordFailure() {
	state := cb.State()
	atomic.StoreInt64(&cb.lastFailure, time.Now().UnixNano())

	switch state {
	case CircuitClosed:
		failures := atomic.AddInt64(&cb.failures, 1)
		if failures >= cb.config.FailureThreshold {
			cb.transition(CircuitOpen)
		}

	case CircuitHalfOpen:
		atomic.AddInt64(&cb.halfOpenCount, -1)
		cb.transition(CircuitOpen)
	}
}

// Execute runs the given function with circuit breaker protection.
func (cb *CircuitBreaker) Execute(fn func() error) error {
	allowed, err := cb.Allow()
	if !allowed {
		return err
	}

	if err := fn(); err != nil {
		cb.RecordFailure()
		return err
	}

	cb.RecordSuccess()
	return nil
}

// ============================================================================
// Per-Client Rate Limiter
// ============================================================================

// ClientLimiter manages rate limits per client/agent.
type ClientLimiter struct {
	defaultLimit  int64
	windowSize    time.Duration
	limiters      map[string]*SlidingWindow
	customLimits  map[string]int64
	mu            sync.RWMutex
}

// NewClientLimiter creates a new per-client rate limiter.
func NewClientLimiter(defaultLimit int64, windowSize time.Duration) *ClientLimiter {
	return &ClientLimiter{
		defaultLimit: defaultLimit,
		windowSize:   windowSize,
		limiters:     make(map[string]*SlidingWindow),
		customLimits: make(map[string]int64),
	}
}

// SetClientLimit sets a custom limit for a specific client.
func (cl *ClientLimiter) SetClientLimit(clientID string, limit int64) {
	cl.mu.Lock()
	defer cl.mu.Unlock()
	cl.customLimits[clientID] = limit
	// Reset the limiter so it uses the new limit
	delete(cl.limiters, clientID)
}

// getOrCreateLimiter gets or creates a limiter for a client.
func (cl *ClientLimiter) getOrCreateLimiter(clientID string) *SlidingWindow {
	cl.mu.RLock()
	limiter, exists := cl.limiters[clientID]
	cl.mu.RUnlock()

	if exists {
		return limiter
	}

	cl.mu.Lock()
	defer cl.mu.Unlock()

	// Double-check after acquiring write lock
	if limiter, exists = cl.limiters[clientID]; exists {
		return limiter
	}

	limit := cl.defaultLimit
	if customLimit, ok := cl.customLimits[clientID]; ok {
		limit = customLimit
	}

	limiter = NewSlidingWindow(limit, cl.windowSize, 10)
	cl.limiters[clientID] = limiter
	return limiter
}

// Allow checks if a request from the given client is allowed.
func (cl *ClientLimiter) Allow(clientID string) bool {
	return cl.getOrCreateLimiter(clientID).Allow()
}

// AllowN checks if N requests from the given client are allowed.
func (cl *ClientLimiter) AllowN(clientID string, n int64) bool {
	return cl.getOrCreateLimiter(clientID).AllowN(n)
}

// Count returns the current request count for a client.
func (cl *ClientLimiter) Count(clientID string) int64 {
	cl.mu.RLock()
	limiter, exists := cl.limiters[clientID]
	cl.mu.RUnlock()

	if !exists {
		return 0
	}
	return limiter.Count()
}

// ============================================================================
// Combined Rate Limiter with Circuit Breaker
// ============================================================================

// RateLimiterConfig configures the combined rate limiter.
type RateLimiterConfig struct {
	// Rate limiting
	RequestsPerSecond float64       // Token bucket refill rate
	BurstSize         int64         // Token bucket capacity
	WindowLimit       int64         // Sliding window limit
	WindowSize        time.Duration // Sliding window duration

	// Circuit breaker
	CircuitBreaker CircuitBreakerConfig

	// Client limits
	EnableClientLimits bool
	ClientLimitDefault int64
}

// DefaultRateLimiterConfig returns sensible defaults.
func DefaultRateLimiterConfig() RateLimiterConfig {
	return RateLimiterConfig{
		RequestsPerSecond:  100,
		BurstSize:          200,
		WindowLimit:        1000,
		WindowSize:         time.Minute,
		CircuitBreaker:     DefaultCircuitBreakerConfig(),
		EnableClientLimits: true,
		ClientLimitDefault: 100,
	}
}

// RateLimiter combines token bucket, sliding window, and circuit breaker.
type RateLimiter struct {
	config        RateLimiterConfig
	tokenBucket   *TokenBucket
	slidingWindow *SlidingWindow
	circuitBreaker *CircuitBreaker
	clientLimiter *ClientLimiter
}

// NewRateLimiter creates a new combined rate limiter.
func NewRateLimiter(config RateLimiterConfig) *RateLimiter {
	rl := &RateLimiter{
		config:         config,
		tokenBucket:    NewTokenBucket(config.BurstSize, config.RequestsPerSecond),
		slidingWindow:  NewSlidingWindow(config.WindowLimit, config.WindowSize, 10),
		circuitBreaker: NewCircuitBreaker(config.CircuitBreaker),
	}

	if config.EnableClientLimits {
		rl.clientLimiter = NewClientLimiter(config.ClientLimitDefault, config.WindowSize)
	}

	return rl
}

// Allow checks if a request is allowed through all limiters.
func (rl *RateLimiter) Allow() (bool, error) {
	return rl.AllowClient("")
}

// AllowClient checks if a request from a specific client is allowed.
func (rl *RateLimiter) AllowClient(clientID string) (bool, error) {
	// Check circuit breaker first
	if allowed, err := rl.circuitBreaker.Allow(); !allowed {
		return false, err
	}

	// Check token bucket (for burst control)
	if !rl.tokenBucket.Allow() {
		return false, ErrRateLimitExceeded
	}

	// Check sliding window (for sustained rate)
	if !rl.slidingWindow.Allow() {
		return false, ErrRateLimitExceeded
	}

	// Check client-specific limits
	if rl.clientLimiter != nil && clientID != "" {
		if !rl.clientLimiter.Allow(clientID) {
			return false, ErrRateLimitExceeded
		}
	}

	return true, nil
}

// RecordSuccess records a successful request.
func (rl *RateLimiter) RecordSuccess() {
	rl.circuitBreaker.RecordSuccess()
}

// RecordFailure records a failed request.
func (rl *RateLimiter) RecordFailure() {
	rl.circuitBreaker.RecordFailure()
}

// SetClientLimit sets a custom rate limit for a client.
func (rl *RateLimiter) SetClientLimit(clientID string, limit int64) {
	if rl.clientLimiter != nil {
		rl.clientLimiter.SetClientLimit(clientID, limit)
	}
}

// Stats returns current rate limiter statistics.
func (rl *RateLimiter) Stats() RateLimiterStats {
	return RateLimiterStats{
		CircuitState:    rl.circuitBreaker.State().String(),
		AvailableTokens: rl.tokenBucket.Tokens(),
		WindowCount:     rl.slidingWindow.Count(),
		WindowLimit:     rl.config.WindowLimit,
	}
}

// RateLimiterStats contains rate limiter statistics.
type RateLimiterStats struct {
	CircuitState    string  `json:"circuit_state"`
	AvailableTokens float64 `json:"available_tokens"`
	WindowCount     int64   `json:"window_count"`
	WindowLimit     int64   `json:"window_limit"`
}

// MarshalJSON implements json.Marshaler.
func (s RateLimiterStats) MarshalJSON() ([]byte, error) {
	type statsAlias RateLimiterStats
	return json.Marshal(statsAlias(s))
}

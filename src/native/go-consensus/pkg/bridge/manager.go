// Package bridge provides inter-agent communication and protocol bridging.
package bridge

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"sync/atomic"
	"time"

	"github.com/rs/zerolog"
)

// Common errors
var (
	ErrAgentNotFound     = errors.New("agent not found")
	ErrBridgeNotFound    = errors.New("bridge not found")
	ErrProtocolMismatch  = errors.New("protocol mismatch")
	ErrBridgeUnavailable = errors.New("bridge unavailable")
	ErrMessageDropped    = errors.New("message dropped")
)

// ============================================================================
// Types
// ============================================================================

// AgentType identifies the type of agent.
type AgentType string

const (
	AgentTypeAda     AgentType = "ada"
	AgentTypeLea     AgentType = "lea"
	AgentTypePhil    AgentType = "phil"
	AgentTypeDavid   AgentType = "david"
	AgentTypeSerena  AgentType = "serena"
	AgentTypeGeneric AgentType = "generic"
)

// Protocol identifies the communication protocol.
type Protocol string

const (
	ProtocolA2A     Protocol = "a2a"      // Agent-to-Agent
	ProtocolACP     Protocol = "acp"      // Agent Communication Protocol
	ProtocolMCP     Protocol = "mcp"      // Model Context Protocol
	ProtocolHTTP    Protocol = "http"     // HTTP/REST
	ProtocolWS      Protocol = "ws"       // WebSocket
	ProtocolInternal Protocol = "internal" // Internal pub/sub
)

// AgentInfo contains information about a registered agent.
type AgentInfo struct {
	ID          string            `json:"id"`
	Type        AgentType         `json:"type"`
	Protocol    Protocol          `json:"protocol"`
	Endpoint    string            `json:"endpoint"`
	Capabilities []string         `json:"capabilities"`
	Metadata    map[string]string `json:"metadata"`
	RegisteredAt time.Time        `json:"registered_at"`
	LastSeen    time.Time         `json:"last_seen"`
	Health      HealthStatus      `json:"health"`
}

// HealthStatus represents agent health.
type HealthStatus struct {
	Healthy     bool    `json:"healthy"`
	Latency     int64   `json:"latency_ms"`
	ErrorRate   float64 `json:"error_rate"`
	LastCheck   time.Time `json:"last_check"`
	FailCount   int     `json:"fail_count"`
}

// Message represents a bridge message.
type Message struct {
	ID          string          `json:"id"`
	Source      string          `json:"source"`
	Target      string          `json:"target"`
	Protocol    Protocol        `json:"protocol"`
	ContentType string          `json:"content_type"`
	Payload     json.RawMessage `json:"payload"`
	Timestamp   time.Time       `json:"timestamp"`
	TTL         int             `json:"ttl"`
	Priority    int             `json:"priority"`
	ReplyTo     string          `json:"reply_to,omitempty"`
	Metadata    map[string]string `json:"metadata,omitempty"`
}

// MessageHandler handles incoming messages.
type MessageHandler func(ctx context.Context, msg *Message) error

// ============================================================================
// Protocol Adapter Interface
// ============================================================================

// ProtocolAdapter adapts messages between protocols.
type ProtocolAdapter interface {
	// Protocol returns the protocol this adapter handles.
	Protocol() Protocol

	// CanTranslate checks if translation to target protocol is supported.
	CanTranslate(target Protocol) bool

	// Translate converts a message to the target protocol format.
	Translate(ctx context.Context, msg *Message, target Protocol) (*Message, error)

	// Send sends a message using this protocol.
	Send(ctx context.Context, agent *AgentInfo, msg *Message) error

	// Validate validates a message for this protocol.
	Validate(msg *Message) error
}

// ============================================================================
// Bridge Manager
// ============================================================================

// ManagerConfig configures the bridge manager.
type ManagerConfig struct {
	HealthCheckInterval time.Duration
	MessageTimeout      time.Duration
	MaxRetries          int
	RetryBackoff        time.Duration
	MaxQueueSize        int
	EnableMetrics       bool
}

// DefaultManagerConfig returns sensible defaults.
func DefaultManagerConfig() ManagerConfig {
	return ManagerConfig{
		HealthCheckInterval: 30 * time.Second,
		MessageTimeout:      10 * time.Second,
		MaxRetries:          3,
		RetryBackoff:        100 * time.Millisecond,
		MaxQueueSize:        1000,
		EnableMetrics:       true,
	}
}

// Manager coordinates inter-agent communication.
type Manager struct {
	config   ManagerConfig
	agents   map[string]*AgentInfo
	adapters map[Protocol]ProtocolAdapter
	handlers map[string]MessageHandler
	queue    chan *Message
	metrics  *Metrics
	logger   zerolog.Logger
	mu       sync.RWMutex
	running  int32
	ctx      context.Context
	cancel   context.CancelFunc
}

// NewManager creates a new bridge manager.
func NewManager(config ManagerConfig, logger zerolog.Logger) *Manager {
	ctx, cancel := context.WithCancel(context.Background())
	return &Manager{
		config:   config,
		agents:   make(map[string]*AgentInfo),
		adapters: make(map[Protocol]ProtocolAdapter),
		handlers: make(map[string]MessageHandler),
		queue:    make(chan *Message, config.MaxQueueSize),
		metrics:  NewMetrics(),
		logger:   logger,
		ctx:      ctx,
		cancel:   cancel,
	}
}

// Start starts the bridge manager.
func (m *Manager) Start() error {
	if !atomic.CompareAndSwapInt32(&m.running, 0, 1) {
		return errors.New("manager already running")
	}

	// Start message processor
	go m.processMessages()

	// Start health checker
	go m.healthChecker()

	m.logger.Info().Msg("bridge manager started")
	return nil
}

// Stop stops the bridge manager.
func (m *Manager) Stop() {
	if atomic.CompareAndSwapInt32(&m.running, 1, 0) {
		m.cancel()
		close(m.queue)
		m.logger.Info().Msg("bridge manager stopped")
	}
}

// ============================================================================
// Agent Registration
// ============================================================================

// RegisterAgent registers an agent with the bridge.
func (m *Manager) RegisterAgent(info *AgentInfo) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	info.RegisteredAt = time.Now()
	info.LastSeen = time.Now()
	info.Health = HealthStatus{Healthy: true, LastCheck: time.Now()}

	m.agents[info.ID] = info
	m.metrics.AgentRegistered()

	m.logger.Info().
		Str("agent_id", info.ID).
		Str("type", string(info.Type)).
		Str("protocol", string(info.Protocol)).
		Msg("agent registered")

	return nil
}

// UnregisterAgent removes an agent from the bridge.
func (m *Manager) UnregisterAgent(agentID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.agents[agentID]; !exists {
		return ErrAgentNotFound
	}

	delete(m.agents, agentID)
	m.metrics.AgentUnregistered()

	m.logger.Info().Str("agent_id", agentID).Msg("agent unregistered")
	return nil
}

// GetAgent returns agent info by ID.
func (m *Manager) GetAgent(agentID string) (*AgentInfo, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	agent, exists := m.agents[agentID]
	if !exists {
		return nil, ErrAgentNotFound
	}

	return agent, nil
}

// ListAgents returns all registered agents.
func (m *Manager) ListAgents() []*AgentInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	agents := make([]*AgentInfo, 0, len(m.agents))
	for _, agent := range m.agents {
		agents = append(agents, agent)
	}

	return agents
}

// FindAgentsByType returns agents of a specific type.
func (m *Manager) FindAgentsByType(agentType AgentType) []*AgentInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	agents := make([]*AgentInfo, 0)
	for _, agent := range m.agents {
		if agent.Type == agentType {
			agents = append(agents, agent)
		}
	}

	return agents
}

// FindAgentsByCapability returns agents with a specific capability.
func (m *Manager) FindAgentsByCapability(capability string) []*AgentInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	agents := make([]*AgentInfo, 0)
	for _, agent := range m.agents {
		for _, cap := range agent.Capabilities {
			if cap == capability {
				agents = append(agents, agent)
				break
			}
		}
	}

	return agents
}

// ============================================================================
// Protocol Adapters
// ============================================================================

// RegisterAdapter registers a protocol adapter.
func (m *Manager) RegisterAdapter(adapter ProtocolAdapter) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.adapters[adapter.Protocol()] = adapter
	m.logger.Info().
		Str("protocol", string(adapter.Protocol())).
		Msg("protocol adapter registered")
}

// GetAdapter returns an adapter for a protocol.
func (m *Manager) GetAdapter(protocol Protocol) (ProtocolAdapter, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	adapter, exists := m.adapters[protocol]
	if !exists {
		return nil, ErrBridgeNotFound
	}

	return adapter, nil
}

// ============================================================================
// Message Handling
// ============================================================================

// RegisterHandler registers a message handler for an agent.
func (m *Manager) RegisterHandler(agentID string, handler MessageHandler) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.handlers[agentID] = handler
	m.logger.Debug().Str("agent_id", agentID).Msg("handler registered")
}

// Send sends a message to an agent.
func (m *Manager) Send(ctx context.Context, msg *Message) error {
	if atomic.LoadInt32(&m.running) == 0 {
		return ErrBridgeUnavailable
	}

	// Validate message
	if msg.Target == "" {
		return errors.New("target agent required")
	}

	// Set defaults
	if msg.Timestamp.IsZero() {
		msg.Timestamp = time.Now()
	}
	if msg.TTL == 0 {
		msg.TTL = 3
	}

	// Queue message
	select {
	case m.queue <- msg:
		m.metrics.MessageQueued()
		return nil
	case <-ctx.Done():
		return ctx.Err()
	default:
		m.metrics.MessageDropped()
		return ErrMessageDropped
	}
}

// SendDirect sends a message directly without queuing.
func (m *Manager) SendDirect(ctx context.Context, msg *Message) error {
	return m.deliverMessage(ctx, msg)
}

// Broadcast sends a message to multiple agents.
func (m *Manager) Broadcast(ctx context.Context, msg *Message, targets []string) error {
	for _, target := range targets {
		msgCopy := *msg
		msgCopy.Target = target
		if err := m.Send(ctx, &msgCopy); err != nil {
			m.logger.Warn().
				Str("target", target).
				Err(err).
				Msg("broadcast to agent failed")
		}
	}
	return nil
}

// BroadcastToType sends a message to all agents of a type.
func (m *Manager) BroadcastToType(ctx context.Context, msg *Message, agentType AgentType) error {
	agents := m.FindAgentsByType(agentType)
	targets := make([]string, len(agents))
	for i, agent := range agents {
		targets[i] = agent.ID
	}
	return m.Broadcast(ctx, msg, targets)
}

// processMessages processes queued messages.
func (m *Manager) processMessages() {
	for msg := range m.queue {
		ctx, cancel := context.WithTimeout(m.ctx, m.config.MessageTimeout)

		if err := m.deliverMessage(ctx, msg); err != nil {
			m.logger.Warn().
				Str("target", msg.Target).
				Err(err).
				Msg("message delivery failed")
			m.metrics.MessageFailed()
		} else {
			m.metrics.MessageDelivered()
		}

		cancel()
	}
}

// deliverMessage delivers a single message.
func (m *Manager) deliverMessage(ctx context.Context, msg *Message) error {
	// Get target agent
	agent, err := m.GetAgent(msg.Target)
	if err != nil {
		return err
	}

	// Check agent health
	if !agent.Health.Healthy {
		return ErrBridgeUnavailable
	}

	// Get adapter for target protocol
	adapter, err := m.GetAdapter(agent.Protocol)
	if err != nil {
		return err
	}

	// Translate if needed
	if msg.Protocol != agent.Protocol {
		if !adapter.CanTranslate(msg.Protocol) {
			return ErrProtocolMismatch
		}
		msg, err = adapter.Translate(ctx, msg, agent.Protocol)
		if err != nil {
			return err
		}
	}

	// Try registered handler first
	m.mu.RLock()
	handler, hasHandler := m.handlers[msg.Target]
	m.mu.RUnlock()

	if hasHandler {
		return handler(ctx, msg)
	}

	// Fall back to adapter send
	return m.sendWithRetry(ctx, adapter, agent, msg)
}

// sendWithRetry sends a message with retry logic.
func (m *Manager) sendWithRetry(ctx context.Context, adapter ProtocolAdapter, agent *AgentInfo, msg *Message) error {
	var lastErr error

	for i := 0; i < m.config.MaxRetries; i++ {
		if err := adapter.Send(ctx, agent, msg); err != nil {
			lastErr = err
			m.logger.Debug().
				Int("attempt", i+1).
				Err(err).
				Msg("send attempt failed")

			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(m.config.RetryBackoff * time.Duration(i+1)):
				continue
			}
		}
		return nil
	}

	return lastErr
}

// ============================================================================
// Health Checking
// ============================================================================

// healthChecker periodically checks agent health.
func (m *Manager) healthChecker() {
	ticker := time.NewTicker(m.config.HealthCheckInterval)
	defer ticker.Stop()

	for {
		select {
		case <-m.ctx.Done():
			return
		case <-ticker.C:
			m.checkAllAgents()
		}
	}
}

// checkAllAgents checks health of all registered agents.
func (m *Manager) checkAllAgents() {
	m.mu.RLock()
	agents := make([]*AgentInfo, 0, len(m.agents))
	for _, agent := range m.agents {
		agents = append(agents, agent)
	}
	m.mu.RUnlock()

	for _, agent := range agents {
		m.checkAgentHealth(agent)
	}
}

// checkAgentHealth checks a single agent's health.
func (m *Manager) checkAgentHealth(agent *AgentInfo) {
	adapter, err := m.GetAdapter(agent.Protocol)
	if err != nil {
		m.updateAgentHealth(agent.ID, false, 0)
		return
	}

	start := time.Now()
	ctx, cancel := context.WithTimeout(m.ctx, 5*time.Second)
	defer cancel()

	// Send a health check message
	healthMsg := &Message{
		ID:          "health-" + agent.ID,
		Source:      "bridge-manager",
		Target:      agent.ID,
		Protocol:    agent.Protocol,
		ContentType: "application/health-check",
		Payload:     json.RawMessage(`{"type":"ping"}`),
		Timestamp:   time.Now(),
		TTL:         1,
	}

	err = adapter.Send(ctx, agent, healthMsg)
	latency := time.Since(start).Milliseconds()

	m.updateAgentHealth(agent.ID, err == nil, latency)
}

// updateAgentHealth updates an agent's health status.
func (m *Manager) updateAgentHealth(agentID string, healthy bool, latency int64) {
	m.mu.Lock()
	defer m.mu.Unlock()

	agent, exists := m.agents[agentID]
	if !exists {
		return
	}

	now := time.Now()

	if healthy {
		agent.Health.Healthy = true
		agent.Health.FailCount = 0
		agent.Health.Latency = latency
		agent.LastSeen = now
	} else {
		agent.Health.FailCount++
		if agent.Health.FailCount >= 3 {
			agent.Health.Healthy = false
		}
	}

	agent.Health.LastCheck = now
}

// ============================================================================
// Metrics
// ============================================================================

// Metrics tracks bridge metrics.
type Metrics struct {
	messagesQueued    int64
	messagesDelivered int64
	messagesFailed    int64
	messagesDropped   int64
	agentsRegistered  int64
	agentsUnregistered int64
	mu                sync.Mutex
}

// NewMetrics creates a new metrics instance.
func NewMetrics() *Metrics {
	return &Metrics{}
}

func (m *Metrics) MessageQueued()    { atomic.AddInt64(&m.messagesQueued, 1) }
func (m *Metrics) MessageDelivered() { atomic.AddInt64(&m.messagesDelivered, 1) }
func (m *Metrics) MessageFailed()    { atomic.AddInt64(&m.messagesFailed, 1) }
func (m *Metrics) MessageDropped()   { atomic.AddInt64(&m.messagesDropped, 1) }
func (m *Metrics) AgentRegistered()  { atomic.AddInt64(&m.agentsRegistered, 1) }
func (m *Metrics) AgentUnregistered() { atomic.AddInt64(&m.agentsUnregistered, 1) }

// Stats returns current metrics.
func (m *Metrics) Stats() map[string]int64 {
	return map[string]int64{
		"messages_queued":     atomic.LoadInt64(&m.messagesQueued),
		"messages_delivered":  atomic.LoadInt64(&m.messagesDelivered),
		"messages_failed":     atomic.LoadInt64(&m.messagesFailed),
		"messages_dropped":    atomic.LoadInt64(&m.messagesDropped),
		"agents_registered":   atomic.LoadInt64(&m.agentsRegistered),
		"agents_unregistered": atomic.LoadInt64(&m.agentsUnregistered),
	}
}

// GetStats returns manager statistics.
func (m *Manager) GetStats() map[string]interface{} {
	m.mu.RLock()
	agentCount := len(m.agents)
	adapterCount := len(m.adapters)
	m.mu.RUnlock()

	return map[string]interface{}{
		"agents":   agentCount,
		"adapters": adapterCount,
		"metrics":  m.metrics.Stats(),
		"running":  atomic.LoadInt32(&m.running) == 1,
	}
}

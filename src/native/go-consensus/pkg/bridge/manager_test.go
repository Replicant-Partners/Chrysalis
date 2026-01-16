package bridge

import (
	"context"
	"encoding/json"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/rs/zerolog"
)

func testLogger() zerolog.Logger {
	return zerolog.Nop()
}

func TestManager_RegisterAgent(t *testing.T) {
	m := NewManager(DefaultManagerConfig(), testLogger())

	agent := &AgentInfo{
		ID:       "ada-001",
		Type:     AgentTypeAda,
		Protocol: ProtocolInternal,
		Endpoint: "internal://ada",
		Capabilities: []string{"conversation", "memory"},
	}

	if err := m.RegisterAgent(agent); err != nil {
		t.Fatalf("failed to register agent: %v", err)
	}

	// Verify agent is registered
	retrieved, err := m.GetAgent("ada-001")
	if err != nil {
		t.Fatalf("failed to get agent: %v", err)
	}

	if retrieved.ID != agent.ID {
		t.Errorf("expected agent ID %s, got %s", agent.ID, retrieved.ID)
	}

	if retrieved.Type != agent.Type {
		t.Errorf("expected agent type %s, got %s", agent.Type, retrieved.Type)
	}
}

func TestManager_UnregisterAgent(t *testing.T) {
	m := NewManager(DefaultManagerConfig(), testLogger())

	agent := &AgentInfo{
		ID:       "test-agent",
		Type:     AgentTypeGeneric,
		Protocol: ProtocolInternal,
	}

	m.RegisterAgent(agent)

	if err := m.UnregisterAgent("test-agent"); err != nil {
		t.Fatalf("failed to unregister agent: %v", err)
	}

	// Verify agent is gone
	_, err := m.GetAgent("test-agent")
	if err != ErrAgentNotFound {
		t.Errorf("expected ErrAgentNotFound, got %v", err)
	}
}

func TestManager_ListAgents(t *testing.T) {
	m := NewManager(DefaultManagerConfig(), testLogger())

	agents := []*AgentInfo{
		{ID: "ada", Type: AgentTypeAda, Protocol: ProtocolInternal},
		{ID: "lea", Type: AgentTypeLea, Protocol: ProtocolInternal},
		{ID: "phil", Type: AgentTypePhil, Protocol: ProtocolInternal},
	}

	for _, agent := range agents {
		m.RegisterAgent(agent)
	}

	listed := m.ListAgents()
	if len(listed) != 3 {
		t.Errorf("expected 3 agents, got %d", len(listed))
	}
}

func TestManager_FindAgentsByType(t *testing.T) {
	m := NewManager(DefaultManagerConfig(), testLogger())

	agents := []*AgentInfo{
		{ID: "ada-1", Type: AgentTypeAda, Protocol: ProtocolInternal},
		{ID: "ada-2", Type: AgentTypeAda, Protocol: ProtocolInternal},
		{ID: "lea-1", Type: AgentTypeLea, Protocol: ProtocolInternal},
	}

	for _, agent := range agents {
		m.RegisterAgent(agent)
	}

	adaAgents := m.FindAgentsByType(AgentTypeAda)
	if len(adaAgents) != 2 {
		t.Errorf("expected 2 Ada agents, got %d", len(adaAgents))
	}
}

func TestManager_FindAgentsByCapability(t *testing.T) {
	m := NewManager(DefaultManagerConfig(), testLogger())

	agents := []*AgentInfo{
		{ID: "ada", Type: AgentTypeAda, Protocol: ProtocolInternal, Capabilities: []string{"conversation", "memory"}},
		{ID: "lea", Type: AgentTypeLea, Protocol: ProtocolInternal, Capabilities: []string{"conversation", "external"}},
		{ID: "phil", Type: AgentTypePhil, Protocol: ProtocolInternal, Capabilities: []string{"memory", "reasoning"}},
	}

	for _, agent := range agents {
		m.RegisterAgent(agent)
	}

	conversationAgents := m.FindAgentsByCapability("conversation")
	if len(conversationAgents) != 2 {
		t.Errorf("expected 2 conversation-capable agents, got %d", len(conversationAgents))
	}

	memoryAgents := m.FindAgentsByCapability("memory")
	if len(memoryAgents) != 2 {
		t.Errorf("expected 2 memory-capable agents, got %d", len(memoryAgents))
	}
}

func TestManager_RegisterAdapter(t *testing.T) {
	m := NewManager(DefaultManagerConfig(), testLogger())

	adapter := NewInternalAdapter()
	m.RegisterAdapter(adapter)

	retrieved, err := m.GetAdapter(ProtocolInternal)
	if err != nil {
		t.Fatalf("failed to get adapter: %v", err)
	}

	if retrieved.Protocol() != ProtocolInternal {
		t.Errorf("expected internal protocol, got %s", retrieved.Protocol())
	}
}

func TestManager_SendMessage(t *testing.T) {
	config := DefaultManagerConfig()
	config.MaxQueueSize = 10
	m := NewManager(config, testLogger())

	// Register internal adapter with handler
	internalAdapter := NewInternalAdapter()
	var receivedMsg *Message
	var mu sync.Mutex

	internalAdapter.RegisterHandler("target-agent", func(ctx context.Context, msg *Message) error {
		mu.Lock()
		receivedMsg = msg
		mu.Unlock()
		return nil
	})

	m.RegisterAdapter(internalAdapter)

	// Register target agent
	m.RegisterAgent(&AgentInfo{
		ID:       "target-agent",
		Type:     AgentTypeGeneric,
		Protocol: ProtocolInternal,
	})

	// Start manager
	m.Start()
	defer m.Stop()

	// Send message
	msg := &Message{
		ID:      "test-msg-1",
		Source:  "sender",
		Target:  "target-agent",
		Protocol: ProtocolInternal,
		Payload: json.RawMessage(`{"hello": "world"}`),
	}

	if err := m.Send(context.Background(), msg); err != nil {
		t.Fatalf("failed to send message: %v", err)
	}

	// Wait for delivery
	time.Sleep(100 * time.Millisecond)

	mu.Lock()
	if receivedMsg == nil {
		t.Error("message was not received")
	} else if receivedMsg.ID != "test-msg-1" {
		t.Errorf("expected message ID test-msg-1, got %s", receivedMsg.ID)
	}
	mu.Unlock()
}

func TestManager_SendDirect(t *testing.T) {
	m := NewManager(DefaultManagerConfig(), testLogger())

	var received atomic.Int32
	internalAdapter := NewInternalAdapter()
	internalAdapter.RegisterHandler("agent", func(ctx context.Context, msg *Message) error {
		received.Add(1)
		return nil
	})

	m.RegisterAdapter(internalAdapter)
	m.RegisterAgent(&AgentInfo{
		ID:       "agent",
		Type:     AgentTypeGeneric,
		Protocol: ProtocolInternal,
	})

	msg := &Message{
		ID:      "direct-msg",
		Source:  "sender",
		Target:  "agent",
		Protocol: ProtocolInternal,
		Payload: json.RawMessage(`{}`),
	}

	// Note: SendDirect requires the manager's registered handlers, not adapter handlers
	m.RegisterHandler("agent", func(ctx context.Context, msg *Message) error {
		received.Add(1)
		return nil
	})

	if err := m.SendDirect(context.Background(), msg); err != nil {
		t.Fatalf("failed to send direct: %v", err)
	}

	if received.Load() != 1 {
		t.Errorf("expected 1 received message, got %d", received.Load())
	}
}

func TestManager_Broadcast(t *testing.T) {
	m := NewManager(DefaultManagerConfig(), testLogger())

	var received atomic.Int32
	internalAdapter := NewInternalAdapter()

	// Register multiple agents
	for _, id := range []string{"agent-1", "agent-2", "agent-3"} {
		m.RegisterAgent(&AgentInfo{
			ID:       id,
			Type:     AgentTypeGeneric,
			Protocol: ProtocolInternal,
		})
		m.RegisterHandler(id, func(ctx context.Context, msg *Message) error {
			received.Add(1)
			return nil
		})
	}

	m.RegisterAdapter(internalAdapter)
	m.Start()
	defer m.Stop()

	msg := &Message{
		ID:      "broadcast-msg",
		Source:  "sender",
		Protocol: ProtocolInternal,
		Payload: json.RawMessage(`{}`),
	}

	if err := m.Broadcast(context.Background(), msg, []string{"agent-1", "agent-2", "agent-3"}); err != nil {
		t.Fatalf("failed to broadcast: %v", err)
	}

	// Wait for delivery
	time.Sleep(100 * time.Millisecond)

	if received.Load() != 3 {
		t.Errorf("expected 3 received messages, got %d", received.Load())
	}
}

func TestManager_BroadcastToType(t *testing.T) {
	m := NewManager(DefaultManagerConfig(), testLogger())

	var received atomic.Int32

	// Register agents of different types
	m.RegisterAgent(&AgentInfo{ID: "ada-1", Type: AgentTypeAda, Protocol: ProtocolInternal})
	m.RegisterAgent(&AgentInfo{ID: "ada-2", Type: AgentTypeAda, Protocol: ProtocolInternal})
	m.RegisterAgent(&AgentInfo{ID: "lea-1", Type: AgentTypeLea, Protocol: ProtocolInternal})

	for _, id := range []string{"ada-1", "ada-2", "lea-1"} {
		m.RegisterHandler(id, func(ctx context.Context, msg *Message) error {
			received.Add(1)
			return nil
		})
	}

	m.RegisterAdapter(NewInternalAdapter())
	m.Start()
	defer m.Stop()

	msg := &Message{
		ID:      "type-broadcast",
		Source:  "sender",
		Protocol: ProtocolInternal,
		Payload: json.RawMessage(`{}`),
	}

	// Broadcast to Ada agents only
	if err := m.BroadcastToType(context.Background(), msg, AgentTypeAda); err != nil {
		t.Fatalf("failed to broadcast to type: %v", err)
	}

	// Wait for delivery
	time.Sleep(100 * time.Millisecond)

	if received.Load() != 2 {
		t.Errorf("expected 2 received messages (Ada agents), got %d", received.Load())
	}
}

func TestManager_GetStats(t *testing.T) {
	m := NewManager(DefaultManagerConfig(), testLogger())

	m.RegisterAgent(&AgentInfo{ID: "agent-1", Protocol: ProtocolInternal})
	m.RegisterAgent(&AgentInfo{ID: "agent-2", Protocol: ProtocolInternal})
	m.RegisterAdapter(NewInternalAdapter())

	stats := m.GetStats()

	if stats["agents"].(int) != 2 {
		t.Errorf("expected 2 agents in stats, got %d", stats["agents"])
	}

	if stats["adapters"].(int) != 1 {
		t.Errorf("expected 1 adapter in stats, got %d", stats["adapters"])
	}
}

func TestInternalAdapter_Translate(t *testing.T) {
	adapter := NewInternalAdapter()

	msg := &Message{
		ID:      "test",
		Source:  "sender",
		Target:  "receiver",
		Protocol: ProtocolHTTP,
		Payload: json.RawMessage(`{"data": "test"}`),
	}

	translated, err := adapter.Translate(context.Background(), msg, ProtocolInternal)
	if err != nil {
		t.Fatalf("failed to translate: %v", err)
	}

	if translated.Protocol != ProtocolInternal {
		t.Errorf("expected internal protocol, got %s", translated.Protocol)
	}
}

func TestHTTPAdapter_CanTranslate(t *testing.T) {
	adapter := NewHTTPAdapter()

	if !adapter.CanTranslate(ProtocolA2A) {
		t.Error("HTTP adapter should be able to translate to A2A")
	}

	if !adapter.CanTranslate(ProtocolACP) {
		t.Error("HTTP adapter should be able to translate to ACP")
	}

	if adapter.CanTranslate(ProtocolWS) {
		t.Error("HTTP adapter should not translate to WS")
	}
}

func TestA2AAdapter_Validate(t *testing.T) {
	adapter := NewA2AAdapter()

	// Valid A2A message
	validMsg := &Message{
		Payload: json.RawMessage(`{"jsonrpc": "2.0", "method": "test", "id": "1"}`),
	}

	if err := adapter.Validate(validMsg); err != nil {
		t.Errorf("expected valid message, got error: %v", err)
	}

	// Invalid A2A message (wrong version)
	invalidMsg := &Message{
		Payload: json.RawMessage(`{"jsonrpc": "1.0", "method": "test"}`),
	}

	if err := adapter.Validate(invalidMsg); err == nil {
		t.Error("expected error for invalid JSON-RPC version")
	}

	// Invalid JSON
	badMsg := &Message{
		Payload: json.RawMessage(`not json`),
	}

	if err := adapter.Validate(badMsg); err == nil {
		t.Error("expected error for invalid JSON")
	}
}

func TestACPAdapter_Translate(t *testing.T) {
	adapter := NewACPAdapter()

	acpMsg := &Message{
		ID:      "test",
		Source:  "sender",
		Target:  "receiver",
		Protocol: ProtocolACP,
		Payload: json.RawMessage(`{"type": "message", "from": "sender", "to": "receiver", "content": {"text": "hello"}}`),
	}

	translated, err := adapter.Translate(context.Background(), acpMsg, ProtocolA2A)
	if err != nil {
		t.Fatalf("failed to translate: %v", err)
	}

	if translated.Protocol != ProtocolA2A {
		t.Errorf("expected A2A protocol, got %s", translated.Protocol)
	}

	// Verify the translated payload contains JSON-RPC structure
	var a2a A2AMessage
	if err := json.Unmarshal(translated.Payload, &a2a); err != nil {
		t.Fatalf("failed to parse translated payload: %v", err)
	}

	if a2a.JSONRPC != "2.0" {
		t.Errorf("expected JSON-RPC 2.0, got %s", a2a.JSONRPC)
	}
}

func TestMetrics(t *testing.T) {
	m := NewMetrics()

	m.MessageQueued()
	m.MessageQueued()
	m.MessageDelivered()
	m.MessageFailed()
	m.MessageDropped()
	m.AgentRegistered()
	m.AgentUnregistered()

	stats := m.Stats()

	if stats["messages_queued"] != 2 {
		t.Errorf("expected 2 queued, got %d", stats["messages_queued"])
	}

	if stats["messages_delivered"] != 1 {
		t.Errorf("expected 1 delivered, got %d", stats["messages_delivered"])
	}

	if stats["messages_failed"] != 1 {
		t.Errorf("expected 1 failed, got %d", stats["messages_failed"])
	}

	if stats["messages_dropped"] != 1 {
		t.Errorf("expected 1 dropped, got %d", stats["messages_dropped"])
	}
}

// Package bridge provides protocol adapters for different communication protocols.
package bridge

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

// ============================================================================
// Internal Adapter (In-memory pub/sub)
// ============================================================================

// InternalAdapter handles internal in-process messages.
type InternalAdapter struct {
	handlers map[string]MessageHandler
}

// NewInternalAdapter creates a new internal adapter.
func NewInternalAdapter() *InternalAdapter {
	return &InternalAdapter{
		handlers: make(map[string]MessageHandler),
	}
}

func (a *InternalAdapter) Protocol() Protocol {
	return ProtocolInternal
}

func (a *InternalAdapter) CanTranslate(target Protocol) bool {
	// Internal can translate from any protocol (it just passes the payload)
	return true
}

func (a *InternalAdapter) Translate(ctx context.Context, msg *Message, target Protocol) (*Message, error) {
	// Create a copy with the target protocol
	translated := *msg
	translated.Protocol = target
	return &translated, nil
}

func (a *InternalAdapter) Send(ctx context.Context, agent *AgentInfo, msg *Message) error {
	handler, exists := a.handlers[agent.ID]
	if !exists {
		return fmt.Errorf("no handler registered for agent %s", agent.ID)
	}
	return handler(ctx, msg)
}

func (a *InternalAdapter) Validate(msg *Message) error {
	if msg.Payload == nil {
		return fmt.Errorf("payload is required")
	}
	return nil
}

// RegisterHandler registers a handler for an agent.
func (a *InternalAdapter) RegisterHandler(agentID string, handler MessageHandler) {
	a.handlers[agentID] = handler
}

// ============================================================================
// HTTP Adapter
// ============================================================================

// HTTPAdapter handles HTTP/REST communication.
type HTTPAdapter struct {
	client *http.Client
}

// NewHTTPAdapter creates a new HTTP adapter.
func NewHTTPAdapter() *HTTPAdapter {
	return &HTTPAdapter{
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (a *HTTPAdapter) Protocol() Protocol {
	return ProtocolHTTP
}

func (a *HTTPAdapter) CanTranslate(target Protocol) bool {
	// HTTP can translate to A2A and ACP
	return target == ProtocolA2A || target == ProtocolACP
}

func (a *HTTPAdapter) Translate(ctx context.Context, msg *Message, target Protocol) (*Message, error) {
	translated := *msg
	translated.Protocol = target

	switch target {
	case ProtocolA2A:
		// Wrap in A2A envelope
		a2aEnvelope := map[string]interface{}{
			"jsonrpc": "2.0",
			"method":  "message",
			"id":      msg.ID,
			"params": map[string]interface{}{
				"message": json.RawMessage(msg.Payload),
			},
		}
		payload, err := json.Marshal(a2aEnvelope)
		if err != nil {
			return nil, err
		}
		translated.Payload = payload
		translated.ContentType = "application/json"

	case ProtocolACP:
		// Wrap in ACP envelope
		acpEnvelope := map[string]interface{}{
			"type":    "message",
			"from":    msg.Source,
			"to":      msg.Target,
			"content": json.RawMessage(msg.Payload),
		}
		payload, err := json.Marshal(acpEnvelope)
		if err != nil {
			return nil, err
		}
		translated.Payload = payload
		translated.ContentType = "application/json"
	}

	return &translated, nil
}

func (a *HTTPAdapter) Send(ctx context.Context, agent *AgentInfo, msg *Message) error {
	contentType := msg.ContentType
	if contentType == "" {
		contentType = "application/json"
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, agent.Endpoint, bytes.NewReader(msg.Payload))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", contentType)
	req.Header.Set("X-Message-ID", msg.ID)
	req.Header.Set("X-Source-Agent", msg.Source)

	resp, err := a.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("HTTP error: %s", resp.Status)
	}

	return nil
}

func (a *HTTPAdapter) Validate(msg *Message) error {
	if msg.Payload == nil {
		return fmt.Errorf("payload is required for HTTP messages")
	}
	return nil
}

// ============================================================================
// WebSocket Adapter
// ============================================================================

// WebSocketAdapter handles WebSocket communication.
type WebSocketAdapter struct {
	connections map[string]*websocket.Conn
}

// NewWebSocketAdapter creates a new WebSocket adapter.
func NewWebSocketAdapter() *WebSocketAdapter {
	return &WebSocketAdapter{
		connections: make(map[string]*websocket.Conn),
	}
}

func (a *WebSocketAdapter) Protocol() Protocol {
	return ProtocolWS
}

func (a *WebSocketAdapter) CanTranslate(target Protocol) bool {
	return target == ProtocolInternal || target == ProtocolA2A
}

func (a *WebSocketAdapter) Translate(ctx context.Context, msg *Message, target Protocol) (*Message, error) {
	translated := *msg
	translated.Protocol = target
	// WebSocket messages are typically JSON, so minimal translation needed
	return &translated, nil
}

func (a *WebSocketAdapter) Send(ctx context.Context, agent *AgentInfo, msg *Message) error {
	conn, exists := a.connections[agent.ID]
	if !exists {
		// Establish connection
		var err error
		conn, _, err = websocket.DefaultDialer.DialContext(ctx, agent.Endpoint, nil)
		if err != nil {
			return err
		}
		a.connections[agent.ID] = conn
	}

	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	return conn.WriteMessage(websocket.TextMessage, data)
}

func (a *WebSocketAdapter) Validate(msg *Message) error {
	return nil // WebSocket accepts any message format
}

// SetConnection sets a connection for an agent (for incoming connections).
func (a *WebSocketAdapter) SetConnection(agentID string, conn *websocket.Conn) {
	a.connections[agentID] = conn
}

// ============================================================================
// A2A (Agent-to-Agent) Adapter
// ============================================================================

// A2AMessage represents an A2A protocol message.
type A2AMessage struct {
	JSONRPC string      `json:"jsonrpc"`
	Method  string      `json:"method"`
	ID      string      `json:"id,omitempty"`
	Params  interface{} `json:"params,omitempty"`
	Result  interface{} `json:"result,omitempty"`
	Error   *A2AError   `json:"error,omitempty"`
}

// A2AError represents an A2A error.
type A2AError struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// A2AAdapter handles A2A protocol communication.
type A2AAdapter struct {
	httpClient *http.Client
}

// NewA2AAdapter creates a new A2A adapter.
func NewA2AAdapter() *A2AAdapter {
	return &A2AAdapter{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (a *A2AAdapter) Protocol() Protocol {
	return ProtocolA2A
}

func (a *A2AAdapter) CanTranslate(target Protocol) bool {
	return target == ProtocolHTTP || target == ProtocolInternal || target == ProtocolACP
}

func (a *A2AAdapter) Translate(ctx context.Context, msg *Message, target Protocol) (*Message, error) {
	translated := *msg
	translated.Protocol = target

	// Parse A2A message
	var a2aMsg A2AMessage
	if err := json.Unmarshal(msg.Payload, &a2aMsg); err != nil {
		return nil, err
	}

	switch target {
	case ProtocolHTTP, ProtocolInternal:
		// Extract params as the payload
		params, err := json.Marshal(a2aMsg.Params)
		if err != nil {
			return nil, err
		}
		translated.Payload = params

	case ProtocolACP:
		// Convert to ACP format
		acpMsg := map[string]interface{}{
			"type":    a2aMsg.Method,
			"from":    msg.Source,
			"to":      msg.Target,
			"content": a2aMsg.Params,
		}
		payload, err := json.Marshal(acpMsg)
		if err != nil {
			return nil, err
		}
		translated.Payload = payload
	}

	return &translated, nil
}

func (a *A2AAdapter) Send(ctx context.Context, agent *AgentInfo, msg *Message) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, agent.Endpoint, bytes.NewReader(msg.Payload))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("A2A error: %s", resp.Status)
	}

	return nil
}

func (a *A2AAdapter) Validate(msg *Message) error {
	var a2aMsg A2AMessage
	if err := json.Unmarshal(msg.Payload, &a2aMsg); err != nil {
		return fmt.Errorf("invalid A2A message format: %w", err)
	}

	if a2aMsg.JSONRPC != "2.0" {
		return fmt.Errorf("invalid JSON-RPC version: %s", a2aMsg.JSONRPC)
	}

	return nil
}

// ============================================================================
// ACP (Agent Communication Protocol) Adapter
// ============================================================================

// ACPMessage represents an ACP protocol message.
type ACPMessage struct {
	Type    string          `json:"type"`
	From    string          `json:"from"`
	To      string          `json:"to"`
	Content json.RawMessage `json:"content"`
	ReplyTo string          `json:"reply_to,omitempty"`
}

// ACPAdapter handles ACP protocol communication.
type ACPAdapter struct {
	httpClient *http.Client
}

// NewACPAdapter creates a new ACP adapter.
func NewACPAdapter() *ACPAdapter {
	return &ACPAdapter{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (a *ACPAdapter) Protocol() Protocol {
	return ProtocolACP
}

func (a *ACPAdapter) CanTranslate(target Protocol) bool {
	return target == ProtocolHTTP || target == ProtocolA2A || target == ProtocolInternal
}

func (a *ACPAdapter) Translate(ctx context.Context, msg *Message, target Protocol) (*Message, error) {
	translated := *msg
	translated.Protocol = target

	// Parse ACP message
	var acpMsg ACPMessage
	if err := json.Unmarshal(msg.Payload, &acpMsg); err != nil {
		return nil, err
	}

	switch target {
	case ProtocolHTTP, ProtocolInternal:
		// Extract content as the payload
		translated.Payload = acpMsg.Content

	case ProtocolA2A:
		// Convert to A2A format
		a2aMsg := A2AMessage{
			JSONRPC: "2.0",
			Method:  acpMsg.Type,
			ID:      msg.ID,
			Params: map[string]interface{}{
				"content": json.RawMessage(acpMsg.Content),
			},
		}
		payload, err := json.Marshal(a2aMsg)
		if err != nil {
			return nil, err
		}
		translated.Payload = payload
	}

	return &translated, nil
}

func (a *ACPAdapter) Send(ctx context.Context, agent *AgentInfo, msg *Message) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, agent.Endpoint, bytes.NewReader(msg.Payload))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("ACP error: %s", resp.Status)
	}

	return nil
}

func (a *ACPAdapter) Validate(msg *Message) error {
	var acpMsg ACPMessage
	if err := json.Unmarshal(msg.Payload, &acpMsg); err != nil {
		return fmt.Errorf("invalid ACP message format: %w", err)
	}

	if acpMsg.Type == "" {
		return fmt.Errorf("ACP message type is required")
	}

	return nil
}

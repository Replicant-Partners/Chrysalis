package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// CursorProvider implements Provider using the Cursor Agent adapter.
// This allows system agents to consult the Cursor IDE agent as an LLM resource.
//
// The Cursor Agent is particularly effective at:
// - Staying on task and following specific instructions
// - Building differentiated solutions (not defaulting to mainstream approaches)
// - Maintaining context and consistency across interactions
//
// Architecture:
// SystemAgent -> Gateway -> CursorProvider -> CursorAdapter -> Cursor IDE Agent
type CursorProvider struct {
	adapterURL   string
	defaultModel string
	id           string
	httpClient   *http.Client
	timeout      time.Duration
}

type CursorConfig struct {
	AdapterURL   string
	DefaultModel string
	ID           string
	TimeoutMs    int
}

// NewCursorProvider constructs a Cursor Agent provider.
func NewCursorProvider(cfg CursorConfig) (*CursorProvider, error) {
	adapterURL := cfg.AdapterURL
	if adapterURL == "" {
		adapterURL = os.Getenv("CURSOR_ADAPTER_URL")
	}
	if adapterURL == "" {
		adapterURL = "http://localhost:3210"
	}

	timeout := time.Duration(cfg.TimeoutMs) * time.Millisecond
	if timeout == 0 {
		timeout = 120 * time.Second // Long timeout for complex reasoning
	}

	return &CursorProvider{
		adapterURL:   adapterURL,
		defaultModel: defaultString(cfg.DefaultModel, "cursor-agent"),
		id:           defaultString(cfg.ID, "cursor"),
		httpClient:   &http.Client{Timeout: timeout},
		timeout:      timeout,
	}, nil
}

func (p *CursorProvider) ID() string {
	return p.id
}

// cursorRequest is the request body for the Cursor Adapter API.
type cursorRequest struct {
	RequestID   string          `json:"request_id"`
	AgentID     string          `json:"agent_id"`
	Messages    []cursorMessage `json:"messages"`
	Context     string          `json:"context,omitempty"`
	Priority    string          `json:"priority,omitempty"` // low, normal, high, critical
	WaitTimeout int             `json:"wait_timeout_ms,omitempty"`
}

type cursorMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// cursorResponse is the response from the Cursor Adapter API.
type cursorResponse struct {
	RequestID string `json:"request_id"`
	Status    string `json:"status"` // pending, processing, completed, error
	Content   string `json:"content,omitempty"`
	Error     string `json:"error,omitempty"`
	Model     string `json:"model"`
	Usage     struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
	Metadata struct {
		ProcessingTimeMs int    `json:"processing_time_ms"`
		HandlerType      string `json:"handler_type"` // sync, async, queued
	} `json:"metadata"`
}

func (p *CursorProvider) Complete(req CompletionRequest) (CompletionResponse, error) {
	model := p.defaultModel
	if req.Model != "" {
		model = req.Model
	}

	// Convert messages
	var messages []cursorMessage
	for _, m := range req.Messages {
		messages = append(messages, cursorMessage{
			Role:    m.Role,
			Content: m.Content,
		})
	}

	// Generate request ID
	requestID := fmt.Sprintf("cursor-%d", time.Now().UnixNano())

	cursorReq := cursorRequest{
		RequestID:   requestID,
		AgentID:     req.AgentID,
		Messages:    messages,
		Priority:    "normal",
		WaitTimeout: int(p.timeout.Milliseconds()),
	}

	body, err := json.Marshal(cursorReq)
	if err != nil {
		return CompletionResponse{}, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", p.adapterURL+"/v1/complete", bytes.NewReader(body))
	if err != nil {
		return CompletionResponse{}, fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return CompletionResponse{}, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return CompletionResponse{}, fmt.Errorf("cursor adapter error %d: %s", resp.StatusCode, string(respBody))
	}

	var cursorResp cursorResponse
	if err := json.NewDecoder(resp.Body).Decode(&cursorResp); err != nil {
		return CompletionResponse{}, fmt.Errorf("decode response: %w", err)
	}

	if cursorResp.Status == "error" {
		return CompletionResponse{}, fmt.Errorf("cursor agent error: %s", cursorResp.Error)
	}

	return CompletionResponse{
		Content:  cursorResp.Content,
		Model:    model,
		Provider: p.ID(),
		Usage: Usage{
			PromptTokens:     cursorResp.Usage.PromptTokens,
			CompletionTokens: cursorResp.Usage.CompletionTokens,
			TotalTokens:      cursorResp.Usage.TotalTokens,
		},
	}, nil
}

// Stream sends chunks using the Cursor Adapter's streaming API.
func (p *CursorProvider) Stream(ctx context.Context, req CompletionRequest, emit func(CompletionChunk) error) error {
	model := p.defaultModel
	if req.Model != "" {
		model = req.Model
	}

	// Convert messages
	var messages []cursorMessage
	for _, m := range req.Messages {
		messages = append(messages, cursorMessage{
			Role:    m.Role,
			Content: m.Content,
		})
	}

	requestID := fmt.Sprintf("cursor-%d", time.Now().UnixNano())

	cursorReq := cursorRequest{
		RequestID:   requestID,
		AgentID:     req.AgentID,
		Messages:    messages,
		Priority:    "normal",
		WaitTimeout: int(p.timeout.Milliseconds()),
	}

	body, err := json.Marshal(cursorReq)
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.adapterURL+"/v1/stream", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("cursor adapter error %d: %s", resp.StatusCode, string(respBody))
	}

	// Stream newline-delimited JSON
	decoder := json.NewDecoder(resp.Body)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		var chunk cursorResponse
		if err := decoder.Decode(&chunk); err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return fmt.Errorf("decode chunk: %w", err)
		}

		if chunk.Content != "" {
			if err := emit(CompletionChunk{
				Content:  chunk.Content,
				Model:    model,
				Provider: p.ID(),
			}); err != nil {
				return err
			}
		}

		if chunk.Status == "completed" {
			return emit(CompletionChunk{Done: true, Provider: p.ID(), Model: model})
		}

		if chunk.Status == "error" {
			return fmt.Errorf("cursor agent error: %s", chunk.Error)
		}
	}

	return emit(CompletionChunk{Done: true, Provider: p.ID(), Model: model})
}

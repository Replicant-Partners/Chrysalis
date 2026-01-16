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
)

// AnthropicProvider implements Provider using Anthropic's messages API.
type AnthropicProvider struct {
	apiKey       string
	baseURL      string
	defaultModel string
	id           string
	httpClient   *http.Client
}

type AnthropicConfig struct {
	APIKey       string
	BaseURL      string
	DefaultModel string
	ID           string
}

// NewAnthropicProvider constructs an Anthropic provider; requires API key.
func NewAnthropicProvider(cfg AnthropicConfig) (*AnthropicProvider, error) {
	key := cfg.APIKey
	if key == "" {
		key = os.Getenv("ANTHROPIC_API_KEY")
	}
	if key == "" {
		return nil, errors.New("ANTHROPIC_API_KEY required for Anthropic provider")
	}

	baseURL := cfg.BaseURL
	if baseURL == "" {
		baseURL = "https://api.anthropic.com"
	}

	return &AnthropicProvider{
		apiKey:       key,
		baseURL:      baseURL,
		defaultModel: defaultString(cfg.DefaultModel, "claude-sonnet-4-20250514"),
		id:           defaultString(cfg.ID, "anthropic"),
		httpClient:   &http.Client{},
	}, nil
}

func (p *AnthropicProvider) ID() string {
	return p.id
}

// anthropicRequest is the request body for Anthropic's messages API.
type anthropicRequest struct {
	Model     string             `json:"model"`
	MaxTokens int                `json:"max_tokens"`
	Messages  []anthropicMessage `json:"messages"`
	System    string             `json:"system,omitempty"`
	Stream    bool               `json:"stream,omitempty"`
}

type anthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// anthropicResponse is the response from Anthropic's messages API.
type anthropicResponse struct {
	ID      string `json:"id"`
	Type    string `json:"type"`
	Role    string `json:"role"`
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
	Model      string `json:"model"`
	StopReason string `json:"stop_reason"`
	Usage      struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
}

func (p *AnthropicProvider) Complete(req CompletionRequest) (CompletionResponse, error) {
	model := p.defaultModel
	if req.Model != "" {
		model = req.Model
	}

	// Convert messages, extracting system message
	var systemMsg string
	var messages []anthropicMessage
	for _, m := range req.Messages {
		if m.Role == "system" {
			systemMsg = m.Content
			continue
		}
		role := "user"
		if m.Role == "assistant" {
			role = "assistant"
		}
		messages = append(messages, anthropicMessage{
			Role:    role,
			Content: m.Content,
		})
	}

	// Anthropic requires at least one message
	if len(messages) == 0 {
		return CompletionResponse{}, errors.New("at least one user or assistant message required")
	}

	anthropicReq := anthropicRequest{
		Model:     model,
		MaxTokens: 4096,
		Messages:  messages,
		System:    systemMsg,
	}

	body, err := json.Marshal(anthropicReq)
	if err != nil {
		return CompletionResponse{}, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", p.baseURL+"/v1/messages", bytes.NewReader(body))
	if err != nil {
		return CompletionResponse{}, fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", p.apiKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return CompletionResponse{}, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return CompletionResponse{}, fmt.Errorf("anthropic error %d: %s", resp.StatusCode, string(respBody))
	}

	var anthropicResp anthropicResponse
	if err := json.NewDecoder(resp.Body).Decode(&anthropicResp); err != nil {
		return CompletionResponse{}, fmt.Errorf("decode response: %w", err)
	}

	// Extract content
	var content string
	for _, c := range anthropicResp.Content {
		if c.Type == "text" {
			content += c.Text
		}
	}

	return CompletionResponse{
		Content:  content,
		Model:    anthropicResp.Model,
		Provider: p.ID(),
		Usage: Usage{
			PromptTokens:     anthropicResp.Usage.InputTokens,
			CompletionTokens: anthropicResp.Usage.OutputTokens,
			TotalTokens:      anthropicResp.Usage.InputTokens + anthropicResp.Usage.OutputTokens,
		},
	}, nil
}

// anthropicStreamEvent represents a streaming event from Anthropic.
type anthropicStreamEvent struct {
	Type  string `json:"type"`
	Index int    `json:"index,omitempty"`
	Delta struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"delta,omitempty"`
	Message *anthropicResponse `json:"message,omitempty"`
	Usage   *struct {
		OutputTokens int `json:"output_tokens"`
	} `json:"usage,omitempty"`
}

// Stream sends an SSE-friendly stream of chunks using Anthropic streaming.
func (p *AnthropicProvider) Stream(ctx context.Context, req CompletionRequest, emit func(CompletionChunk) error) error {
	model := p.defaultModel
	if req.Model != "" {
		model = req.Model
	}

	// Convert messages, extracting system message
	var systemMsg string
	var messages []anthropicMessage
	for _, m := range req.Messages {
		if m.Role == "system" {
			systemMsg = m.Content
			continue
		}
		role := "user"
		if m.Role == "assistant" {
			role = "assistant"
		}
		messages = append(messages, anthropicMessage{
			Role:    role,
			Content: m.Content,
		})
	}

	if len(messages) == 0 {
		return errors.New("at least one user or assistant message required")
	}

	anthropicReq := anthropicRequest{
		Model:     model,
		MaxTokens: 4096,
		Messages:  messages,
		System:    systemMsg,
		Stream:    true,
	}

	body, err := json.Marshal(anthropicReq)
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.baseURL+"/v1/messages", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", p.apiKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("anthropic error %d: %s", resp.StatusCode, string(respBody))
	}

	// Read SSE stream line by line
	buf := make([]byte, 0, 4096)
	reader := resp.Body

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// Read line by line for SSE
		line, err := readSSELine(reader, &buf)
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("read stream: %w", err)
		}

		if len(line) == 0 || !bytes.HasPrefix(line, []byte("data: ")) {
			continue
		}

		data := bytes.TrimPrefix(line, []byte("data: "))
		if bytes.Equal(data, []byte("[DONE]")) {
			break
		}

		var event anthropicStreamEvent
		if err := json.Unmarshal(data, &event); err != nil {
			continue // Skip malformed events
		}

		switch event.Type {
		case "content_block_delta":
			if event.Delta.Type == "text_delta" && event.Delta.Text != "" {
				if err := emit(CompletionChunk{
					Content:  event.Delta.Text,
					Model:    model,
					Provider: p.ID(),
				}); err != nil {
					return err
				}
			}
		case "message_stop":
			return emit(CompletionChunk{Done: true, Provider: p.ID(), Model: model})
		}
	}

	return emit(CompletionChunk{Done: true, Provider: p.ID(), Model: model})
}

// readSSELine reads a single line from an SSE stream.
func readSSELine(r io.Reader, buf *[]byte) ([]byte, error) {
	*buf = (*buf)[:0]
	b := make([]byte, 1)
	for {
		n, err := r.Read(b)
		if err != nil {
			return *buf, err
		}
		if n == 0 {
			continue
		}
		if b[0] == '\n' {
			return *buf, nil
		}
		*buf = append(*buf, b[0])
	}
}

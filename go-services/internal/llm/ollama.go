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

// OllamaProvider implements Provider using Ollama's local API.
type OllamaProvider struct {
	baseURL      string
	defaultModel string
	id           string
	httpClient   *http.Client
}

type OllamaConfig struct {
	BaseURL      string
	DefaultModel string
	ID           string
}

// NewOllamaProvider constructs an Ollama provider for local LLM inference.
func NewOllamaProvider(cfg OllamaConfig) (*OllamaProvider, error) {
	baseURL := cfg.BaseURL
	if baseURL == "" {
		baseURL = os.Getenv("OLLAMA_BASE_URL")
	}
	if baseURL == "" {
		baseURL = "http://localhost:11434"
	}

	return &OllamaProvider{
		baseURL:      baseURL,
		defaultModel: defaultString(cfg.DefaultModel, "llama3.2"),
		id:           defaultString(cfg.ID, "ollama"),
		httpClient:   &http.Client{},
	}, nil
}

func (p *OllamaProvider) ID() string {
	return p.id
}

// ollamaRequest is the request body for Ollama's chat API.
type ollamaRequest struct {
	Model    string          `json:"model"`
	Messages []ollamaMessage `json:"messages"`
	Stream   bool            `json:"stream"`
	Options  *ollamaOptions  `json:"options,omitempty"`
}

type ollamaMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ollamaOptions struct {
	Temperature float64 `json:"temperature,omitempty"`
}

// ollamaResponse is the response from Ollama's chat API.
type ollamaResponse struct {
	Model   string `json:"model"`
	Message struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	} `json:"message"`
	Done         bool `json:"done"`
	TotalDuration int64 `json:"total_duration"`
	PromptEvalCount   int `json:"prompt_eval_count"`
	EvalCount         int `json:"eval_count"`
}

func (p *OllamaProvider) Complete(req CompletionRequest) (CompletionResponse, error) {
	model := p.defaultModel
	if req.Model != "" {
		model = req.Model
	}

	// Convert messages
	var messages []ollamaMessage
	for _, m := range req.Messages {
		messages = append(messages, ollamaMessage{
			Role:    m.Role,
			Content: m.Content,
		})
	}

	ollamaReq := ollamaRequest{
		Model:    model,
		Messages: messages,
		Stream:   false,
	}

	if req.Temperature > 0 {
		ollamaReq.Options = &ollamaOptions{Temperature: req.Temperature}
	}

	body, err := json.Marshal(ollamaReq)
	if err != nil {
		return CompletionResponse{}, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", p.baseURL+"/api/chat", bytes.NewReader(body))
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
		return CompletionResponse{}, fmt.Errorf("ollama error %d: %s", resp.StatusCode, string(respBody))
	}

	var ollamaResp ollamaResponse
	if err := json.NewDecoder(resp.Body).Decode(&ollamaResp); err != nil {
		return CompletionResponse{}, fmt.Errorf("decode response: %w", err)
	}

	return CompletionResponse{
		Content:  ollamaResp.Message.Content,
		Model:    ollamaResp.Model,
		Provider: p.ID(),
		Usage: Usage{
			PromptTokens:     ollamaResp.PromptEvalCount,
			CompletionTokens: ollamaResp.EvalCount,
			TotalTokens:      ollamaResp.PromptEvalCount + ollamaResp.EvalCount,
		},
	}, nil
}

// ollamaStreamResponse is a streaming chunk from Ollama.
type ollamaStreamResponse struct {
	Model   string `json:"model"`
	Message struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	} `json:"message"`
	Done bool `json:"done"`
}

// Stream sends chunks using Ollama's streaming API.
func (p *OllamaProvider) Stream(ctx context.Context, req CompletionRequest, emit func(CompletionChunk) error) error {
	model := p.defaultModel
	if req.Model != "" {
		model = req.Model
	}

	// Convert messages
	var messages []ollamaMessage
	for _, m := range req.Messages {
		messages = append(messages, ollamaMessage{
			Role:    m.Role,
			Content: m.Content,
		})
	}

	ollamaReq := ollamaRequest{
		Model:    model,
		Messages: messages,
		Stream:   true,
	}

	if req.Temperature > 0 {
		ollamaReq.Options = &ollamaOptions{Temperature: req.Temperature}
	}

	body, err := json.Marshal(ollamaReq)
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.baseURL+"/api/chat", bytes.NewReader(body))
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
		return fmt.Errorf("ollama error %d: %s", resp.StatusCode, string(respBody))
	}

	// Ollama streams newline-delimited JSON
	decoder := json.NewDecoder(resp.Body)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		var chunk ollamaStreamResponse
		if err := decoder.Decode(&chunk); err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return fmt.Errorf("decode chunk: %w", err)
		}

		if chunk.Message.Content != "" {
			if err := emit(CompletionChunk{
				Content:  chunk.Message.Content,
				Model:    chunk.Model,
				Provider: p.ID(),
			}); err != nil {
				return err
			}
		}

		if chunk.Done {
			return emit(CompletionChunk{Done: true, Provider: p.ID(), Model: model})
		}
	}

	return emit(CompletionChunk{Done: true, Provider: p.ID(), Model: model})
}

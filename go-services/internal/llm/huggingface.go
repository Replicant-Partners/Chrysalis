package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
)

// HuggingFaceProvider implements Provider using HuggingFace Inference API.
// Supports both Inference API (serverless) and Inference Endpoints (dedicated).
type HuggingFaceProvider struct {
	apiKey       string
	baseURL      string
	defaultModel string
	id           string
	httpClient   *http.Client
}

type HuggingFaceConfig struct {
	APIKey       string
	BaseURL      string // Optional: override for Inference Endpoints
	DefaultModel string // e.g., "Qwen/Qwen2.5-Coder-7B-Instruct", "mistralai/Mistral-7B-Instruct-v0.3"
	ID           string
}

// NewHuggingFaceProvider constructs a HuggingFace Inference API provider.
func NewHuggingFaceProvider(cfg HuggingFaceConfig) (*HuggingFaceProvider, error) {
	apiKey := cfg.APIKey
	if apiKey == "" {
		apiKey = os.Getenv("HUGGINGFACE_API_KEY")
	}
	if apiKey == "" {
		return nil, errors.New("HUGGINGFACE_API_KEY required for HuggingFace provider")
	}

	baseURL := cfg.BaseURL
	if baseURL == "" {
		baseURL = os.Getenv("HUGGINGFACE_BASE_URL")
	}
	if baseURL == "" {
		// Default to HuggingFace Inference API
		baseURL = "https://api-inference.huggingface.co/models"
	}

	return &HuggingFaceProvider{
		apiKey:       apiKey,
		baseURL:      baseURL,
		defaultModel: defaultString(cfg.DefaultModel, "Qwen/Qwen2.5-Coder-7B-Instruct"),
		id:           defaultString(cfg.ID, "huggingface"),
		httpClient:   &http.Client{},
	}, nil
}

func (p *HuggingFaceProvider) ID() string {
	return p.id
}

// HuggingFace Inference API request/response types

// hfChatRequest is for the Messages API (chat completion style)
type hfChatRequest struct {
	Model       string      `json:"model"`
	Messages    []hfMessage `json:"messages"`
	MaxTokens   int         `json:"max_tokens,omitempty"`
	Temperature float64     `json:"temperature,omitempty"`
	Stream      bool        `json:"stream"`
}

type hfMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// hfChatResponse is the response from HF Messages API
type hfChatResponse struct {
	Choices []struct {
		Message struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
	Model string `json:"model"`
}

// hfTextGenRequest is for the text-generation pipeline (legacy/simple)
type hfTextGenRequest struct {
	Inputs     string              `json:"inputs"`
	Parameters *hfTextGenParams    `json:"parameters,omitempty"`
	Options    *hfRequestOptions   `json:"options,omitempty"`
}

type hfTextGenParams struct {
	MaxNewTokens    int     `json:"max_new_tokens,omitempty"`
	Temperature     float64 `json:"temperature,omitempty"`
	TopP            float64 `json:"top_p,omitempty"`
	DoSample        bool    `json:"do_sample,omitempty"`
	ReturnFullText  bool    `json:"return_full_text,omitempty"`
}

type hfRequestOptions struct {
	WaitForModel bool `json:"wait_for_model,omitempty"`
	UseCache     bool `json:"use_cache,omitempty"`
}

// hfTextGenResponse for text-generation pipeline
type hfTextGenResponse struct {
	GeneratedText string `json:"generated_text"`
}

func (p *HuggingFaceProvider) Complete(req CompletionRequest) (CompletionResponse, error) {
	model := p.defaultModel
	if req.Model != "" {
		model = req.Model
	}

	// Normalize model name (remove huggingface/ prefix if present)
	model = normalizeHFModel(model)

	// Try the Messages API first (chat completion style)
	resp, err := p.completeChatStyle(model, req)
	if err != nil {
		// Fall back to text-generation pipeline
		log.Printf("huggingface: chat API failed, trying text-generation: %v", err)
		return p.completeTextGen(model, req)
	}
	return resp, nil
}

func (p *HuggingFaceProvider) completeChatStyle(model string, req CompletionRequest) (CompletionResponse, error) {
	var messages []hfMessage
	for _, m := range req.Messages {
		messages = append(messages, hfMessage{
			Role:    m.Role,
			Content: m.Content,
		})
	}

	hfReq := hfChatRequest{
		Model:       model,
		Messages:    messages,
		MaxTokens:   4096,
		Temperature: req.Temperature,
		Stream:      false,
	}

	body, err := json.Marshal(hfReq)
	if err != nil {
		return CompletionResponse{}, fmt.Errorf("marshal request: %w", err)
	}

	// Use the v1/chat/completions endpoint for chat-style models
	endpoint := "https://api-inference.huggingface.co/v1/chat/completions"

	httpReq, err := http.NewRequest("POST", endpoint, bytes.NewReader(body))
	if err != nil {
		return CompletionResponse{}, fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return CompletionResponse{}, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return CompletionResponse{}, fmt.Errorf("huggingface error %d: %s", resp.StatusCode, string(respBody))
	}

	var hfResp hfChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&hfResp); err != nil {
		return CompletionResponse{}, fmt.Errorf("decode response: %w", err)
	}

	if len(hfResp.Choices) == 0 {
		return CompletionResponse{}, errors.New("no choices returned")
	}

	return CompletionResponse{
		Content:  hfResp.Choices[0].Message.Content,
		Model:    hfResp.Model,
		Provider: p.ID(),
		Usage: Usage{
			PromptTokens:     hfResp.Usage.PromptTokens,
			CompletionTokens: hfResp.Usage.CompletionTokens,
			TotalTokens:      hfResp.Usage.TotalTokens,
		},
	}, nil
}

func (p *HuggingFaceProvider) completeTextGen(model string, req CompletionRequest) (CompletionResponse, error) {
	// Convert messages to a single prompt for text-generation
	prompt := formatMessagesAsPrompt(req.Messages)

	hfReq := hfTextGenRequest{
		Inputs: prompt,
		Parameters: &hfTextGenParams{
			MaxNewTokens:   2048,
			Temperature:    req.Temperature,
			DoSample:       req.Temperature > 0,
			ReturnFullText: false,
		},
		Options: &hfRequestOptions{
			WaitForModel: true,
		},
	}

	body, err := json.Marshal(hfReq)
	if err != nil {
		return CompletionResponse{}, fmt.Errorf("marshal request: %w", err)
	}

	endpoint := fmt.Sprintf("%s/%s", p.baseURL, model)

	httpReq, err := http.NewRequest("POST", endpoint, bytes.NewReader(body))
	if err != nil {
		return CompletionResponse{}, fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return CompletionResponse{}, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return CompletionResponse{}, fmt.Errorf("huggingface error %d: %s", resp.StatusCode, string(respBody))
	}

	// HF returns an array for text-generation
	var hfResp []hfTextGenResponse
	if err := json.NewDecoder(resp.Body).Decode(&hfResp); err != nil {
		return CompletionResponse{}, fmt.Errorf("decode response: %w", err)
	}

	if len(hfResp) == 0 {
		return CompletionResponse{}, errors.New("no response generated")
	}

	return CompletionResponse{
		Content:  hfResp[0].GeneratedText,
		Model:    model,
		Provider: p.ID(),
		Usage:    Usage{}, // Text-gen doesn't return usage stats
	}, nil
}

// Stream implements streaming for HuggingFace Inference API
func (p *HuggingFaceProvider) Stream(ctx context.Context, req CompletionRequest, emit func(CompletionChunk) error) error {
	model := p.defaultModel
	if req.Model != "" {
		model = req.Model
	}
	model = normalizeHFModel(model)

	var messages []hfMessage
	for _, m := range req.Messages {
		messages = append(messages, hfMessage{
			Role:    m.Role,
			Content: m.Content,
		})
	}

	hfReq := hfChatRequest{
		Model:       model,
		Messages:    messages,
		MaxTokens:   4096,
		Temperature: req.Temperature,
		Stream:      true,
	}

	body, err := json.Marshal(hfReq)
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}

	endpoint := "https://api-inference.huggingface.co/v1/chat/completions"

	httpReq, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("huggingface stream error %d: %s", resp.StatusCode, string(respBody))
	}

	// HF uses SSE format for streaming
	reader := resp.Body
	buf := make([]byte, 4096)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		n, err := reader.Read(buf)
		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return fmt.Errorf("read stream: %w", err)
		}

		data := string(buf[:n])
		// Parse SSE data lines
		for _, line := range strings.Split(data, "\n") {
			line = strings.TrimSpace(line)
			if !strings.HasPrefix(line, "data: ") {
				continue
			}

			jsonData := strings.TrimPrefix(line, "data: ")
			if jsonData == "[DONE]" {
				return emit(CompletionChunk{Done: true, Provider: p.ID(), Model: model})
			}

			var chunk struct {
				Choices []struct {
					Delta struct {
						Content string `json:"content"`
					} `json:"delta"`
				} `json:"choices"`
			}

			if err := json.Unmarshal([]byte(jsonData), &chunk); err != nil {
				continue // Skip malformed chunks
			}

			if len(chunk.Choices) > 0 && chunk.Choices[0].Delta.Content != "" {
				if err := emit(CompletionChunk{
					Content:  chunk.Choices[0].Delta.Content,
					Model:    model,
					Provider: p.ID(),
				}); err != nil {
					return err
				}
			}
		}
	}

	return emit(CompletionChunk{Done: true, Provider: p.ID(), Model: model})
}

// normalizeHFModel removes common prefixes and normalizes the model name
func normalizeHFModel(model string) string {
	// Remove huggingface/ prefix if present
	model = strings.TrimPrefix(model, "huggingface/")
	model = strings.TrimPrefix(model, "hf/")
	return model
}

// formatMessagesAsPrompt converts chat messages to a text prompt
// This is used for models that don't support the chat API
func formatMessagesAsPrompt(messages []Message) string {
	var builder strings.Builder

	for _, msg := range messages {
		switch msg.Role {
		case "system":
			builder.WriteString("System: ")
		case "user":
			builder.WriteString("User: ")
		case "assistant":
			builder.WriteString("Assistant: ")
		}
		builder.WriteString(msg.Content)
		builder.WriteString("\n\n")
	}

	builder.WriteString("Assistant: ")
	return builder.String()
}

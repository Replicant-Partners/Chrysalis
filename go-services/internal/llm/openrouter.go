package llm

import (
	"context"
	"errors"
	"io"
	"os"
	"strings"

	openai "github.com/sashabaranov/go-openai"
)

// OpenRouterProvider implements Provider using OpenRouter's OpenAI-compatible API.
// OpenRouter provides access to many models (OpenAI, Anthropic, Google, Meta, etc.)
// through a single API endpoint.
type OpenRouterProvider struct {
	client       *openai.Client
	defaultModel string
	id           string
	temperature  float32
	siteURL      string // For OpenRouter attribution
	siteName     string
}

type OpenRouterConfig struct {
	APIKey       string
	DefaultModel string // e.g., "anthropic/claude-sonnet-4-20250514", "openai/gpt-4o", "meta-llama/llama-3-70b-instruct"
	Temperature  float32
	ID           string
	SiteURL      string // Optional: your site URL for OpenRouter dashboard
	SiteName     string // Optional: your app name for OpenRouter dashboard
}

// NewOpenRouterProvider constructs an OpenRouter provider.
func NewOpenRouterProvider(cfg OpenRouterConfig) (*OpenRouterProvider, error) {
	key := cfg.APIKey
	if key == "" {
		key = os.Getenv("OPENROUTER_API_KEY")
	}
	if key == "" {
		return nil, errors.New("OPENROUTER_API_KEY required for OpenRouter provider")
	}

	// OpenRouter uses OpenAI-compatible API at a different base URL
	clientCfg := openai.DefaultConfig(key)
	clientCfg.BaseURL = "https://openrouter.ai/api/v1"

	return &OpenRouterProvider{
		client:       openai.NewClientWithConfig(clientCfg),
		defaultModel: defaultString(cfg.DefaultModel, "openai/gpt-4o-mini"),
		id:           defaultString(cfg.ID, "openrouter"),
		temperature:  defaultFloat32(cfg.Temperature, 0.7),
		siteURL:      cfg.SiteURL,
		siteName:     defaultString(cfg.SiteName, "Chrysalis"),
	}, nil
}

func (p *OpenRouterProvider) ID() string {
	return p.id
}

func (p *OpenRouterProvider) Complete(req CompletionRequest) (CompletionResponse, error) {
	messages := make([]openai.ChatCompletionMessage, 0, len(req.Messages))
	for _, m := range req.Messages {
		role := openai.ChatMessageRoleUser
		switch m.Role {
		case "system":
			role = openai.ChatMessageRoleSystem
		case "assistant":
			role = openai.ChatMessageRoleAssistant
		}
		messages = append(messages, openai.ChatCompletionMessage{
			Role:    role,
			Content: m.Content,
		})
	}

	model := p.defaultModel
	if req.Model != "" {
		model = req.Model
	}

	// Normalize model name for OpenRouter if needed
	model = normalizeOpenRouterModel(model)

	resp, err := p.client.CreateChatCompletion(
		context.Background(),
		openai.ChatCompletionRequest{
			Model:       model,
			Messages:    messages,
			Temperature: p.temperature,
		},
	)
	if err != nil {
		return CompletionResponse{}, err
	}

	if len(resp.Choices) == 0 {
		return CompletionResponse{}, errors.New("no choices returned")
	}

	choice := resp.Choices[0]
	usage := Usage{
		PromptTokens:     resp.Usage.PromptTokens,
		CompletionTokens: resp.Usage.CompletionTokens,
		TotalTokens:      resp.Usage.TotalTokens,
	}

	return CompletionResponse{
		Content:  choice.Message.Content,
		Model:    resp.Model,
		Provider: p.ID(),
		Usage:    usage,
	}, nil
}

// Stream sends an SSE-friendly stream using OpenRouter's streaming API.
func (p *OpenRouterProvider) Stream(ctx context.Context, req CompletionRequest, emit func(CompletionChunk) error) error {
	messages := make([]openai.ChatCompletionMessage, 0, len(req.Messages))
	for _, m := range req.Messages {
		role := openai.ChatMessageRoleUser
		switch m.Role {
		case "system":
			role = openai.ChatMessageRoleSystem
		case "assistant":
			role = openai.ChatMessageRoleAssistant
		}
		messages = append(messages, openai.ChatCompletionMessage{
			Role:    role,
			Content: m.Content,
		})
	}

	model := p.defaultModel
	if req.Model != "" {
		model = req.Model
	}

	model = normalizeOpenRouterModel(model)

	stream, err := p.client.CreateChatCompletionStream(
		ctx,
		openai.ChatCompletionRequest{
			Model:       model,
			Messages:    messages,
			Temperature: p.temperature,
			Stream:      true,
		},
	)
	if err != nil {
		return err
	}
	defer stream.Close()

	for {
		response, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return err
		}
		if len(response.Choices) == 0 {
			continue
		}
		delta := response.Choices[0].Delta.Content
		if delta == "" {
			continue
		}
		if err := emit(CompletionChunk{
			Content:  delta,
			Model:    model,
			Provider: p.ID(),
		}); err != nil {
			return err
		}
	}

	return emit(CompletionChunk{Done: true, Provider: p.ID(), Model: model})
}

// normalizeOpenRouterModel ensures the model name is in OpenRouter format.
// OpenRouter uses format like "openai/gpt-4o", "anthropic/claude-sonnet-4-20250514", etc.
func normalizeOpenRouterModel(model string) string {
	// If already has a provider prefix, return as-is
	if strings.Contains(model, "/") {
		return model
	}

	// Map common model names to OpenRouter format
	switch {
	case strings.HasPrefix(model, "gpt-"):
		return "openai/" + model
	case strings.HasPrefix(model, "claude-"):
		return "anthropic/" + model
	case strings.HasPrefix(model, "llama"):
		return "meta-llama/" + model
	case strings.HasPrefix(model, "gemini"):
		return "google/" + model
	case strings.HasPrefix(model, "mistral"):
		return "mistralai/" + model
	default:
		// Return as-is; OpenRouter will figure it out or error
		return model
	}
}

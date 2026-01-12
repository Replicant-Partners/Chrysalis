package llm

import (
	"context"
	"errors"
	"io"
	"os"
	"strings"

	openai "github.com/sashabaranov/go-openai"
)

// OpenAIProvider implements Provider using OpenAI's chat completions API.
type OpenAIProvider struct {
	client     *openai.Client
	defaultModel string
	id         string
	temperature float32
}

type OpenAIConfig struct {
	APIKey       string
	BaseURL      string
	DefaultModel string
	Temperature  float32
	ID           string
}

// NewOpenAIProvider constructs a provider; requires API key.
func NewOpenAIProvider(cfg OpenAIConfig) (*OpenAIProvider, error) {
	key := cfg.APIKey
	if key == "" {
		key = os.Getenv("OPENAI_API_KEY")
	}
	if key == "" {
		return nil, errors.New("OPENAI_API_KEY required for OpenAI provider")
	}
	clientCfg := openai.DefaultConfig(key)
	if cfg.BaseURL != "" {
		clientCfg.BaseURL = strings.TrimSuffix(cfg.BaseURL, "/")
	}
	return &OpenAIProvider{
		client:       openai.NewClientWithConfig(clientCfg),
		defaultModel: defaultString(cfg.DefaultModel, "gpt-4o-mini"),
		id:           defaultString(cfg.ID, "openai"),
		temperature:  defaultFloat32(cfg.Temperature, 0.7),
	}, nil
}

func (p *OpenAIProvider) ID() string {
	return p.id
}

func (p *OpenAIProvider) Complete(req CompletionRequest) (CompletionResponse, error) {
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

// Stream sends an SSE-friendly stream of chunks using OpenAI streaming completions.
func (p *OpenAIProvider) Stream(ctx context.Context, req CompletionRequest, emit func(CompletionChunk) error) error {
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

func defaultString(val, def string) string {
	if val != "" {
		return val
	}
	return def
}

func defaultFloat32(val, def float32) float32 {
	if val != 0 {
		return val
	}
	return def
}

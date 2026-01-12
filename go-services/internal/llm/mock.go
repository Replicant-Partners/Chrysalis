package llm

import (
	"context"
	"strings"
)

// MockProvider returns echo-like responses for testing.
type MockProvider struct {
	DefaultModel string
}

func (m MockProvider) ID() string {
	return "mock"
}

func (m MockProvider) Complete(req CompletionRequest) (CompletionResponse, error) {
	// Simple echo completion with basic token counting.
	joined := make([]string, 0, len(req.Messages))
	for _, msg := range req.Messages {
		joined = append(joined, msg.Content)
	}
	combined := strings.Join(joined, "\n")
	respText := "[mock] " + combined

	usage := Usage{
		PromptTokens:     len(combined) / 4,
		CompletionTokens: len(respText) / 4,
	}
	usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens

	return CompletionResponse{
		Content:  respText,
		Model:    req.Model,
		Provider: m.ID(),
		Usage:    usage,
	}, nil
}

func (m MockProvider) Stream(ctx context.Context, req CompletionRequest, emit func(CompletionChunk) error) error {
	resp, err := m.Complete(req)
	if err != nil {
		return err
	}
	if err := emit(CompletionChunk{
		Content:  resp.Content,
		Model:    resp.Model,
		Provider: resp.Provider,
	}); err != nil {
		return err
	}
	return emit(CompletionChunk{Done: true, Provider: resp.Provider, Model: resp.Model})
}

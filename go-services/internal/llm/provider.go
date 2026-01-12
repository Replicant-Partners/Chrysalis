package llm

import "context"
// Message represents a chat message.
type Message struct {
	Role    string `json:"role"`    // system | user | assistant
	Content string `json:"content"` // message text
}

// CompletionRequest captures an LLM completion request.
type CompletionRequest struct {
	AgentID     string    `json:"agent_id"`
	Messages    []Message `json:"messages"`
	Model       string    `json:"model,omitempty"`
	Temperature float64   `json:"temperature,omitempty"`
}

// Usage tracks token usage (approximate for mock).
type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// CompletionResponse is the response from a provider.
type CompletionResponse struct {
	Content  string `json:"content"`
	Model    string `json:"model"`
	Provider string `json:"provider"`
	Usage    Usage  `json:"usage"`
}

// CompletionChunk is a partial response for streaming.
type CompletionChunk struct {
	Content  string `json:"content"`
	Model    string `json:"model,omitempty"`
	Provider string `json:"provider,omitempty"`
	Done     bool   `json:"done"`
	Error    string `json:"error,omitempty"`
}

// Provider defines the interface LLM providers must implement.
type Provider interface {
	ID() string
	Complete(req CompletionRequest) (CompletionResponse, error)
	Stream(ctx context.Context, req CompletionRequest, emit func(CompletionChunk) error) error
}

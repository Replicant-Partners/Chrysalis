# Chrysalis Go Services (LLM Gateway)

This package hosts the Go-based LLM gateway service — the **single source of truth** for all LLM interactions in Chrysalis.

## Architecture Decision

**Go is the service layer. TypeScript is the thin HTTP client.**

All LLM logic (provider management, rate limiting, circuit breaking, cost tracking, failover) lives here in Go. The TypeScript frontend uses `GatewayLLMClient` to make HTTP calls to this service.

## Providers

| Provider | Environment Variable | Description |
|----------|---------------------|-------------|
| **OpenAI** | `OPENAI_API_KEY` | Direct OpenAI API access |
| **Anthropic** | `ANTHROPIC_API_KEY` | Direct Anthropic API access |
| **OpenRouter** | `OPENROUTER_API_KEY` | Unified gateway to 100+ models |
| **Ollama** | `OLLAMA_BASE_URL` | Local inference (default: localhost:11434) |
| **Mock** | (none) | Testing/development |

## Features

- ✅ **Multi-provider failover** — automatic fallback when primary fails
- ✅ **Circuit breaker** — prevents cascading failures
- ✅ **Rate limiting** — configurable RPS and burst
- ✅ **Cost tracking** — daily/monthly budgets
- ✅ **Streaming** — SSE-based `/v1/chat/stream`
- ✅ **Prometheus metrics** — `/metrics` endpoint
- ✅ **CORS support** — configurable allowed origins
- ✅ **Auth** — Bearer token authentication

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `GATEWAY_PORT` | 8080 | HTTP port |
| `LLM_PROVIDER` | openai | Primary provider |
| `LLM_FALLBACKS` | (empty) | Comma-separated fallback providers |
| `LLM_DEFAULT_MODEL` | (per provider) | Override default model |
| `GATEWAY_AUTH_TOKEN` | (empty) | Bearer auth token (optional) |
| `GATEWAY_RATE_RPS` | 10 | Requests per second |
| `GATEWAY_RATE_BURST` | 20 | Burst allowance |
| `LLM_DAILY_BUDGET_USD` | 50 | Daily spend limit |
| `LLM_MONTHLY_BUDGET_USD` | 500 | Monthly spend limit |
| `CIRCUIT_FAILURE_THRESHOLD` | 3 | Failures before circuit opens |
| `CIRCUIT_RESET_TIME_MS` | 60000 | Time before half-open retry |
| `CORS_ALLOWED_ORIGINS` | localhost:3000,8080 | Allowed CORS origins |

## API

### `POST /v1/chat`
Non-streaming chat completion.

```json
{
  "agent_id": "string",
  "messages": [
    {"role": "system", "content": "You are helpful."},
    {"role": "user", "content": "Hello"}
  ],
  "model": "gpt-4o-mini",
  "temperature": 0.7
}
```

Response:
```json
{
  "content": "Hello! How can I help?",
  "model": "gpt-4o-mini",
  "provider": "openai",
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 8,
    "total_tokens": 23
  }
}
```

### `POST /v1/chat/stream`
Streaming chat completion (SSE).

Same request format. Response is `text/event-stream`:
```
data: {"content":"Hello","model":"gpt-4o-mini","provider":"openai"}

data: {"content":"!","model":"gpt-4o-mini","provider":"openai"}

data: {"done":true,"model":"gpt-4o-mini","provider":"openai"}
```

### `GET /healthz`
Health check.

### `GET /metrics`
Prometheus metrics.

### `GET /v1/providers`
Provider metrics (total calls, failovers).

## Running

```bash
# With OpenAI
export OPENAI_API_KEY=sk-...
export LLM_PROVIDER=openai
cd go-services && go run ./cmd/gateway

# With failover (OpenAI primary, Anthropic fallback)
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export LLM_PROVIDER=openai
export LLM_FALLBACKS=anthropic
cd go-services && go run ./cmd/gateway

# With OpenRouter (access to many models)
export OPENROUTER_API_KEY=sk-or-...
export LLM_PROVIDER=openrouter
export LLM_DEFAULT_MODEL=anthropic/claude-sonnet-4-20250514
cd go-services && go run ./cmd/gateway

# With local Ollama
export LLM_PROVIDER=ollama
export OLLAMA_BASE_URL=http://localhost:11434
cd go-services && go run ./cmd/gateway
```

## Building

```bash
cd go-services
go build -o bin/gateway ./cmd/gateway
```

## Layout

```
go-services/
├── cmd/gateway/          # Service entrypoint
├── internal/
│   ├── config/           # Environment configuration
│   ├── http/             # HTTP server, handlers, middleware
│   └── llm/              # Provider implementations
│       ├── provider.go       # Interface definition
│       ├── openai.go         # OpenAI provider
│       ├── anthropic.go      # Anthropic provider
│       ├── openrouter.go     # OpenRouter provider
│       ├── ollama.go         # Ollama provider
│       ├── mock.go           # Mock provider for testing
│       ├── circuit_breaker.go # Circuit breaker wrapper
│       ├── cost_tracker.go   # Cost/budget tracking
│       └── multi_provider.go # Failover orchestration
└── README.md
```

## TypeScript Integration

From TypeScript, use only `GatewayLLMClient`:

```typescript
import { GatewayLLMClient } from './services/gateway/GatewayLLMClient';

const client = new GatewayLLMClient({
  baseUrl: process.env.GATEWAY_BASE_URL || 'http://localhost:8080'
});

const response = await client.chat('my-agent', [
  { role: 'user', content: 'Hello' }
]);
```

**Do NOT use** the deprecated `LLMHydrationService` — it duplicates logic that belongs in Go.

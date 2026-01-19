# Chrysalis Go Services (LLM Gateway)

This package hosts the Go-based LLM gateway service — the **single source of truth** for all LLM interactions in Chrysalis.

## Architecture Decision

**Go is the service layer. TypeScript is the thin HTTP client.**

All LLM logic (provider management, rate limiting, circuit breaking, cost tracking, model routing) lives here in Go. The TypeScript frontend uses `GatewayLLMClient` to make HTTP calls to this service.

## Provider Policy

> ⚠️ **OpenAI and Anthropic are DEPRECATED** — do not use their API keys directly.
> Use OpenRouter to access their models if needed.

**Why?** Direct OpenAI and Anthropic APIs showed consistent patterns of:
- Not staying on task during complex development
- Defaulting to mainstream approaches rather than differentiated solutions
- Context window resets requiring repeated "battles" to maintain direction

**Recommended providers:**
1. **OpenRouter** — Primary provider (GLM4, open models, or access Claude/GPT via OpenRouter)
2. **Ollama** — Local inference, offline fallback
3. **Cursor** — System agents can consult the Cursor Agent for complex reasoning

## Providers

| Provider | Environment Variable | Status | Description |
|----------|---------------------|--------|-------------|
| **OpenRouter** | `OPENROUTER_API_KEY` | ✅ Primary | GLM4, open models, unified gateway |
| **Ollama** | `OLLAMA_BASE_URL` | ✅ Local | qwen2.5-coder, local inference |
| **Cursor** | `CURSOR_ADAPTER_URL` | ✅ New | Cursor Agent consultation for system agents |
| **OpenAI** | `OPENAI_API_KEY` | ⚠️ Deprecated | Route through OpenRouter instead |
| **Anthropic** | `ANTHROPIC_API_KEY` | ⚠️ Deprecated | Route through OpenRouter instead |
| **Mock** | (none) | ✅ | Testing/development |

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
| `LLM_PROVIDER` | openrouter | Primary provider (was: openai) |
| `LLM_DEFAULT_MODEL` | thudm/glm-4-9b-chat | Default model (GLM4 via OpenRouter) |
| `LLM_FALLBACKS` | (empty) | Comma-separated fallback providers |
| `OPENROUTER_API_KEY` | (required) | OpenRouter API key |
| `OLLAMA_BASE_URL` | localhost:11434 | Ollama server URL |
| `CURSOR_ADAPTER_URL` | localhost:3210 | Cursor Agent adapter URL |
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

### Recommended Configuration (OpenRouter + GLM4)

```bash
# Primary: OpenRouter with GLM4
export OPENROUTER_API_KEY=sk-or-...
export LLM_PROVIDER=openrouter
export LLM_DEFAULT_MODEL=thudm/glm-4-9b-chat
cd go-services && go run ./cmd/gateway
```

### With Ollama Fallback

```bash
# OpenRouter primary, Ollama fallback
export OPENROUTER_API_KEY=sk-or-...
export LLM_PROVIDER=openrouter
export LLM_FALLBACKS=ollama
export OLLAMA_BASE_URL=http://localhost:11434
cd go-services && go run ./cmd/gateway
```

### Local-Only (Ollama)

```bash
# Pure local inference
export LLM_PROVIDER=ollama
export OLLAMA_BASE_URL=http://localhost:11434
export LLM_DEFAULT_MODEL=qwen2.5-coder:7b
cd go-services && go run ./cmd/gateway
```

### With Cursor Agent Consultation

```bash
# Enable Cursor Agent for system agents
# First, start the Cursor Adapter:
#   npx ts-node src/services/cursor-adapter/run-cursor-adapter.ts

export OPENROUTER_API_KEY=sk-or-...
export LLM_PROVIDER=openrouter
export LLM_FALLBACKS=cursor,ollama
export CURSOR_ADAPTER_URL=http://localhost:3210
cd go-services && go run ./cmd/gateway
```

### DEPRECATED: Direct OpenAI/Anthropic

> ⚠️ These configurations are deprecated. Use OpenRouter instead.

```bash
# DEPRECATED: Direct OpenAI
# export OPENAI_API_KEY=sk-...
# export LLM_PROVIDER=openai

# DEPRECATED: Direct Anthropic
# export ANTHROPIC_API_KEY=sk-ant-...
# export LLM_PROVIDER=anthropic
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
│       ├── openrouter.go     # OpenRouter provider (PRIMARY)
│       ├── ollama.go         # Ollama provider (LOCAL)
│       ├── cursor.go         # Cursor Agent adapter (NEW)
│       ├── router.go         # Model-based routing
│       ├── openai.go         # OpenAI provider (DEPRECATED)
│       ├── anthropic.go      # Anthropic provider (DEPRECATED)
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

# Chrysalis Go Services (Gateway/Semantic Core)

This package hosts the Go-based services for the lean Chrysalis core:

- **Gateway (LLM/chat/service bridge)**: Fast, type-safe HTTP interface for chat/completions and tool calls; intended to front LLM providers and unify agent-facing APIs.
- **(Future) Sync/Bridge**: Experience sync and agent bridge services can live alongside the gateway once the core contract stabilizes.

## Why Go here?
- Clear, small deployables for gateway/sync tasks.
- Concurrency and HTTP/streaming support without Node/TS build churn.
- Keeps UI/canvas in TypeScript, services in Go, with clean JSON contracts between them.

## Layout
```
go-services/
├── cmd/gateway/          # Gateway service entrypoint
├── internal/
│   ├── config/           # Env/config handling
│   ├── http/             # HTTP server and handlers
│   └── llm/              # LLM provider interfaces + mocks
└── README.md
```

## Gateway API (initial)
- `POST /v1/chat` — Chat/completion request.
  - Request: `{ "agent_id": "string", "messages": [{ "role": "user|assistant|system", "content": "..." }], "model": "gpt-4o-mini", "temperature": 0.7 }`
  - Response: `{ "content": "string", "model": "string", "provider": "mock", "usage": { "prompt_tokens": n, "completion_tokens": n, "total_tokens": n } }`
- Health: `GET /healthz`

## Running (mock provider)
```bash
cd go-services
go run ./cmd/gateway
```

## Next steps
- Wire real providers (OpenAI/Anthropic) behind `llm.Provider`.
- Add streaming (`/v1/chat/stream`) with `text/event-stream`.
- Add auth (Bearer token) + rate limiting.
- Add observability: structured logs, metrics endpoints.
- Integrate sync/bridge services once the core JSON contracts stabilize.

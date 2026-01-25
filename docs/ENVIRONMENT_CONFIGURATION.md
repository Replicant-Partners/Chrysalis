# Environment Configuration

**Version**: 2.0 (Cloud-Only Architecture)
**Last Updated**: January 25, 2026

**BREAKING CHANGE**: Ollama/local LLM support has been removed. Cloud API keys are now required.

Create a `.env` file in the project root with these values:

---

## LLM Provider Configuration (Cloud-Only)

Chrysalis now uses a **cloud-only architecture** with OpenRouter as the default provider. See [ADR-001](architecture/ADR-001-cloud-only-llm.md) for details.

```bash
# OpenRouter API Key (RECOMMENDED - provides access to multiple models)
OPENROUTER_API_KEY=sk-or-v1-your-key-here

# Direct provider keys (optional, used as fallback)
OPENAI_API_KEY=sk-your-key-here
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Default models (configured in go-services/internal/agents/registry.go)
# System agents: anthropic/claude-3-haiku (via OpenRouter)
# Universal adapter: openai/gpt-5.2-codex
```

**Required**: At least `OPENROUTER_API_KEY` or one direct provider key (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`).

**Without a valid cloud API key, the system will not function.**

---

## Gateway Service (Go)

The Go gateway service routes LLM requests to cloud providers with:
- **CloudOnlyRouter**: Routes to OpenRouter, Anthropic, or OpenAI
- **Cost Tracking**: Monitors API usage and spending
- **Response Caching**: 5-minute TTL to reduce costs
- **Circuit Breaker**: Fails fast when providers are down

```bash
# Port for the Go LLM gateway service
GATEWAY_PORT=8080

# Auth token for gateway API (generate a secure random string)
GATEWAY_AUTH_TOKEN=your-secure-token-here

# Rate limiting
GATEWAY_RATE_RPS=10
GATEWAY_RATE_BURST=20

# CORS allowed origins (comma-separated)
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Cache configuration
LLM_CACHE_ENABLED=true
LLM_CACHE_TTL=5m
```

### Starting the Gateway

```bash
cd go-services
go build -o bin/gateway cmd/gateway/main.go
./bin/gateway
```

Or run directly:

```bash
cd go-services
go run cmd/gateway/main.go
```

The gateway will:
1. Load agent configurations from `internal/agents/registry.go`
2. Initialize CloudOnlyRouter with configured providers
3. Start HTTP server on `:8080` with cost tracking

---

## Terminal Service

PTY backend for terminal widgets.

```bash
# WebSocket port for terminal PTY service
TERMINAL_WS_PORT=8081

# Default shell
TERMINAL_DEFAULT_SHELL=/bin/bash
```

**The terminal service must be running for Terminal widgets to work.**

---

## Storage Configuration

```bash
# Storage type: "local", "fireproof", or "remote"
STORAGE_TYPE=local

# Remote storage URL (required if STORAGE_TYPE=remote)
STORAGE_URL=http://localhost:3005

# Fireproof database name
FIREPROOF_DB_NAME=chrysalis-canvas
```

---

## Memory System

Vector embeddings for semantic search.

```bash
# Embedding model
MEMORY_EMBEDDING_MODEL=openai/text-embedding-3-small

# Vector store type: "chroma", "pinecone", "local"
MEMORY_VECTOR_STORE=chroma

# ChromaDB URL (required if MEMORY_VECTOR_STORE=chroma)
CHROMA_URL=http://localhost:8000

# Storage path for local memory
MEMORY_STORAGE_PATH=./data/memory
```

---

## Quick Start Checklist

1. [ ] Copy `env.example` to `.env`
2. [ ] Set `OPENROUTER_API_KEY` (get one at https://openrouter.ai/keys)
3. [ ] Generate a random `GATEWAY_AUTH_TOKEN` (e.g., `openssl rand -hex 32`)
4. [ ] Build and start the gateway:
   ```bash
   cd go-services
   go build -o bin/gateway cmd/gateway/main.go
   ./bin/gateway
   ```
5. [ ] Verify gateway health: `curl http://localhost:8080/health`
6. [ ] Test agent chat:
   ```bash
   python scripts/test-agents.py
   ```
7. [ ] Start Rust system agents (optional):
   ```bash
   cd src/native/rust-system-agents
   cargo build --release
   ./target/release/chrysalis-system-agents
   ```

---

## Verification

Test that services are running:

```bash
# Gateway health check
curl http://localhost:8080/health
# Should return: {"status":"healthy","router":"cloud-router","providers":["openrouter","anthropic","openai"]}

# Test system agent chat via gateway
curl -X POST http://localhost:8080/api/agent/chat \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "ada",
    "message": "Hello Ada, how are you?",
    "conversation_id": "test-123"
  }'

# Check cost tracking
curl http://localhost:8080/api/costs
```

---

## Troubleshooting

| Symptom | Cause | Solution |
|---------|-------|----------|
| "Gateway not connected" | Gateway not running | Start `go-services/cmd/gateway` |
| "No cloud provider available" | Missing API keys | Set `OPENROUTER_API_KEY` in `.env` |
| "Provider authentication failed" | Invalid API key | Verify key at provider dashboard |
| "Rate limit exceeded" | Too many requests | Adjust `GATEWAY_RATE_RPS` or wait |
| "Circuit breaker open" | Provider offline | Wait for circuit breaker to close |
| "Terminal not connected" | PTY service not running | Start terminal WebSocket server |
| "CORS error" | Origin not allowed | Add origin to `CORS_ALLOWED_ORIGINS` |

### Cloud Provider Issues

If you're having issues with cloud providers:

1. **OpenRouter**: Verify key at https://openrouter.ai/keys
2. **Anthropic**: Check quota at https://console.anthropic.com/
3. **OpenAI**: Check usage at https://platform.openai.com/usage

**Note**: Cost tracking logs are stored in `data/telemetry.db` and can be queried via the `/api/costs` endpoint.

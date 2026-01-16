# Environment Configuration

**ALL OF THESE ARE REQUIRED FOR THE SYSTEM TO WORK.**

Create a `.env` file in the project root with these values:

---

## LLM Provider Configuration

```bash
# Which LLM provider to use: "openai", "anthropic", "ollama", or "mock"
LLM_PROVIDER=openai

# OpenAI API Key (required if LLM_PROVIDER=openai)
OPENAI_API_KEY=sk-your-key-here

# Anthropic API Key (required if LLM_PROVIDER=anthropic)
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Ollama base URL (required if LLM_PROVIDER=ollama)
OLLAMA_BASE_URL=http://localhost:11434

# Default model to use
LLM_DEFAULT_MODEL=gpt-4o
```

**Without a valid LLM configuration, AI features will not work.**

---

## Gateway Service (Go)

The Go gateway service proxies LLM requests with rate limiting and auth.

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
```

### Starting the Gateway

```bash
cd go-services
go run cmd/gateway/main.go
```

Or with Docker:

```bash
docker-compose up gateway
```

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

1. [ ] Copy values to `.env` file
2. [ ] Set `OPENAI_API_KEY` (or other provider key)
3. [ ] Generate a random `GATEWAY_AUTH_TOKEN`
4. [ ] Start the gateway: `cd go-services && go run cmd/gateway/main.go`
5. [ ] Verify gateway health: `curl http://localhost:8080/healthz`
6. [ ] Start the frontend with backend connector initialized

---

## Verification

Test that services are running:

```bash
# Gateway health check
curl http://localhost:8080/healthz
# Should return: {"status":"ok","provider":"openai"}

# Gateway chat test
curl -X POST http://localhost:8080/v1/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secure-token-here" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'
```

---

## Troubleshooting

| Symptom | Cause | Solution |
|---------|-------|----------|
| "Gateway not connected" | Gateway not running | Start `go-services/cmd/gateway` |
| "401 Unauthorized" | Wrong auth token | Check `GATEWAY_AUTH_TOKEN` matches |
| "No LLM response" | API key invalid | Verify `OPENAI_API_KEY` |
| "Terminal not connected" | PTY service not running | Start terminal WebSocket server |
| "CORS error" | Origin not allowed | Add origin to `CORS_ALLOWED_ORIGINS` |

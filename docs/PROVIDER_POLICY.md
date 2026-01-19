# LLM Provider Policy

## Overview

As of January 2026, Chrysalis has **deprecated direct OpenAI and Anthropic API access**. All LLM interactions should now go through:

1. **OpenRouter** — Primary provider (GLM4 default, access to 100+ models)
2. **Ollama** — Local inference (offline, fast, private)
3. **Cursor Agent** — System agent consultation (complex reasoning, staying on task)

## Why This Change?

Direct OpenAI and Anthropic APIs showed consistent patterns that hindered development:

1. **Context Drift** — Models would not stay on task during complex development sessions
2. **Mainstream Bias** — Strong tendency toward "safe", mainstream approaches rather than differentiated solutions
3. **Battle Fatigue** — Context window resets required repeated "battles" to maintain architectural direction
4. **Documentation Pollution** — Project documentation became dominated by records of these battles rather than actual system design

The Cursor Agent, in contrast, has demonstrated exceptional ability to:
- Stay on task across complex, multi-step implementations
- Build differentiated solutions that follow project-specific architecture
- Maintain context consistency without requiring constant re-alignment

## Provider Configuration

### Default Setup (Recommended)

```bash
# env.example - copy to .env
export LLM_PROVIDER=openrouter
export LLM_DEFAULT_MODEL=thudm/glm-4-9b-chat
export OPENROUTER_API_KEY=sk-or-your-key-here
export LLM_FALLBACKS=ollama
export OLLAMA_BASE_URL=http://localhost:11434
```

### With Cursor Agent

For system agents that need complex reasoning:

```bash
# Additional setup for Cursor Agent consultation
export LLM_FALLBACKS=cursor,ollama
export CURSOR_ADAPTER_URL=http://localhost:3210

# Start the Cursor Adapter service
npm run service:cursor-adapter
```

### Model Routing

The Go LLM Gateway (`go-services/`) routes requests based on model name:

| Model Prefix | Provider | Notes |
|--------------|----------|-------|
| `cursor-*` | Cursor | System agent consultations |
| `llama*`, `qwen*`, `codellama*`, `ollama/*` | Ollama | Local inference |
| `glm*`, `thudm/*` | OpenRouter | GLM4 family |
| `*/` (any org prefix) | OpenRouter | All other models |
| `claude*`, `gpt*` | OpenRouter | ⚠️ Deprecated, routed through OpenRouter |

## System Agent Configuration

All system agents now use a hybrid model configuration:

```json
{
  "modelConfig": {
    "modelTier": "hybrid",
    "primaryModel": {
      "provider": "openrouter",
      "model": "thudm/glm-4-9b-chat",
      "useCases": ["general_tasks"]
    },
    "localModel": {
      "provider": "ollama",
      "model": "qwen2.5-coder:7b",
      "useCases": ["offline_fallback", "low_latency"]
    },
    "cursorModel": {
      "provider": "cursor",
      "model": "cursor-agent",
      "useCases": ["complex_reasoning", "staying_on_task"]
    }
  }
}
```

## Cursor Agent Adapter

The Cursor Adapter (`src/services/cursor-adapter/`) bridges system agents to the Cursor IDE agent:

```
SystemAgent -> Go Gateway -> CursorAdapter -> Request Queue -> Cursor IDE Agent
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/complete` | POST | Submit request, wait for response |
| `/v1/pending` | GET | List pending requests |
| `/v1/respond` | POST | Submit response (from Cursor) |
| `/health` | GET | Health check |

### Running the Adapter

```bash
# Start the adapter
npm run service:cursor-adapter

# Or directly
npx ts-node src/services/cursor-adapter/run-cursor-adapter.ts
```

## Migration Guide

### From Direct OpenAI

```bash
# Before (deprecated)
export OPENAI_API_KEY=sk-...
export LLM_PROVIDER=openai

# After (recommended)
export OPENROUTER_API_KEY=sk-or-...
export LLM_PROVIDER=openrouter
export LLM_DEFAULT_MODEL=thudm/glm-4-9b-chat
```

### From Direct Anthropic

```bash
# Before (deprecated)
export ANTHROPIC_API_KEY=sk-ant-...
export LLM_PROVIDER=anthropic

# After (recommended)
export OPENROUTER_API_KEY=sk-or-...
export LLM_PROVIDER=openrouter
export LLM_DEFAULT_MODEL=thudm/glm-4-9b-chat
# Or to still use Claude via OpenRouter:
export LLM_DEFAULT_MODEL=anthropic/claude-sonnet-4-20250514
```

## Files Changed

- `go-services/internal/config/config.go` — Default provider changed to OpenRouter
- `go-services/internal/llm/router.go` — Updated routing with deprecation warnings
- `go-services/internal/llm/cursor.go` — New Cursor Agent provider
- `go-services/README.md` — Updated documentation
- `Agents/system-agents/*_config.json` — All agents updated to hybrid model
- `requirements.txt` — OpenAI/Anthropic marked deprecated
- `src/services/cursor-adapter/` — New Cursor Adapter service
- `env.example` — New environment template

## Related Documents

- `go-services/README.md` — Gateway configuration and API
- `Agents/system-agents/README.md` — System agents architecture
- `docs/ARCHITECTURE.md` — Overall system architecture

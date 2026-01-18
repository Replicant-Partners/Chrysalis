# Quick Start: Ada with Ollama

Get Ada running with local Ollama models in 5 minutes.

## 1. Install Ollama

```bash
# Linux
curl -fsSL https://ollama.com/install.sh | sh

# macOS
brew install ollama
```

## 2. Pull Default Model

```bash
ollama pull gemma:2b
```

## 3. Start Services

### Fast Path (Local Chat TUI)

If you want a working local chat path with system agents:

```bash
./scripts/run-local-chat.sh
```

### Manual Path (Three Terminals)

If you prefer to run each service yourself:

```bash
# Terminal 1: Start Ollama
ollama serve

# Terminal 2: Start Gateway (from Chrysalis root)
cd go-services
LLM_PROVIDER=ollama OLLAMA_BASE_URL=http://localhost:11434 go run ./cmd/gateway

# Terminal 3: Start System Agents API + TUI
cd ..
npm run build
GATEWAY_BASE_URL=http://localhost:8080 npm run service:system-agents
npx tsx src/cli/chrysalis-cli.ts chat
```

## 4. Verify

```bash
# Check Ollama
curl http://localhost:11434/api/version

# Check Gateway
curl http://localhost:8080/health

# Check System Agents
curl http://localhost:3200/api/v1/system-agents/health
```

## 5. Test Ada

```bash
In the TUI, send a message and target Ada:
  /agent ada
  hello
```

## Done! 🎉

Ada is now using **gemma:2b** locally via Ollama.

## Quick Commands

```bash
# List installed models
ollama list

# Run model interactively
ollama run gemma:2b

# Pull alternative model
ollama pull qwen3:4b

# Check what's running
ps aux | grep ollama
```

## Troubleshooting

**Ollama not responding?**
```bash
ollama serve
```

**Gateway not connecting?**
```bash
cd go-services && go run cmd/gateway/main.go
```

**Model not found?**
```bash
ollama pull gemma:2b
```

## Available Models

- `gemma:2b` (2.0 GB) ⭐ **Default**
- `granite4:3b` (2.1 GB) - Enterprise
- `qwen3:4b` (2.5 GB) - Multilingual
- `llama3.2:latest` (2.0 GB) - Versatile
- `gemma3:latest` (3.3 GB) - Reasoning
- `deepseek-r1:1.5b` (1.1 GB) - Compact
- `smollm:1.7b` (990 MB) - Lightweight

## Next Steps

📖 Full guide: [docs/guides/ollama-setup.md](./ollama-setup.md)

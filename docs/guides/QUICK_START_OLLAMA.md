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
ollama pull ministral-3:3b
```

## 3. Start Services

```bash
# Terminal 1: Start Ollama
ollama serve

# Terminal 2: Start Gateway (from Chrysalis root)
cd go-services
go run cmd/gateway/main.go

# Terminal 3: Start Chrysalis
npm run dev
```

## 4. Verify

```bash
# Check Ollama
curl http://localhost:11434/api/version

# Check Gateway
curl http://localhost:8080/health

# Should see: {"status": "ok"}
```

## 5. Test Ada

```bash
npm run dev:ada-demo
```

Click "Request Help" in the demo console to test Ada's response with Ollama.

## Done! 🎉

Ada is now using **ministral-3:3b** locally via Ollama.

## Quick Commands

```bash
# List installed models
ollama list

# Run model interactively
ollama run ministral-3:3b

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
ollama pull ministral-3:3b
```

## Available Models

- `ministral-3:3b` (3.0 GB) ⭐ **Default**
- `granite4:3b` (2.1 GB) - Enterprise
- `qwen3:4b` (2.5 GB) - Multilingual
- `llama3.2:latest` (2.0 GB) - Versatile
- `gemma3:latest` (3.3 GB) - Reasoning
- `deepseek-r1:1.5b` (1.1 GB) - Compact
- `smollm:1.7b` (990 MB) - Lightweight

## Next Steps

📖 Full guide: [docs/guides/ollama-setup.md](./ollama-setup.md)
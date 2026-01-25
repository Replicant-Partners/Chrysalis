# Migration Guide: Ollama to Cloud-Only Architecture

**Version**: 1.0  
**Date**: January 25, 2026  
**Breaking Change**: Chrysalis v0.32.0+

## Overview

As of v0.32.0, Chrysalis has transitioned from a hybrid local/cloud LLM architecture to a **cloud-only** architecture. This guide helps you migrate from Ollama-based deployments to cloud providers.

## Why Cloud-Only?

See [ADR-001: Cloud-Only LLM Provider Architecture](../architecture/ADR-001-cloud-only-llm.md) for the full rationale. Key benefits:

- **Simplified Architecture**: No local model management
- **Consistent Quality**: Production-grade models
- **Easier Debugging**: Standard API error handling
- **Cost Visibility**: Built-in cost tracking

## What Changed

### Removed

- ❌ Ollama provider support
- ❌ Local model configurations (phi4-mini, mistral3:3b, etc.)
- ❌ `ComplexityRouter` (task-based routing)
- ❌ `LLM_PROVIDER=ollama` environment variable

### Added

- ✅ `CloudOnlyRouter` with OpenRouter, Anthropic, OpenAI
- ✅ Cost tracking and analytics
- ✅ Response caching (5-minute TTL)
- ✅ Circuit breaker for provider failures
- ✅ Knowledge graph integration

## Migration Steps

### 1. Update Environment Variables

**Before (.env)**:
```bash
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
LLM_DEFAULT_MODEL=phi4-mini
```

**After (.env)**:
```bash
# Required: At least one cloud provider API key
OPENROUTER_API_KEY=sk-or-v1-your-key-here

# Optional: Direct provider keys
ANTHROPIC_API_KEY=sk-ant-your-key-here
OPENAI_API_KEY=sk-your-key-here

# Cache and rate limiting
LLM_CACHE_ENABLED=true
LLM_CACHE_TTL=5m
GATEWAY_RATE_RPS=10
```

### 2. Get Cloud API Keys

#### OpenRouter (Recommended)

OpenRouter provides access to multiple models through a single API:

1. Sign up at https://openrouter.ai/
2. Navigate to https://openrouter.ai/keys
3. Create a new API key
4. Add to `.env` as `OPENROUTER_API_KEY`

**Cost**: Pay-as-you-go, cards accepted. Example pricing:
- Claude 3 Haiku: $0.25/1M input, $1.25/1M output
- GPT-4o mini: $0.15/1M input, $0.60/1M output

#### Anthropic Direct

1. Sign up at https://console.anthropic.com/
2. Add billing information
3. Create API key under "API Keys"
4. Add to `.env` as `ANTHROPIC_API_KEY`

#### OpenAI Direct

1. Sign up at https://platform.openai.com/
2. Add billing information
3. Create API key under "API keys"
4. Add to `.env` as `OPENAI_API_KEY`

### 3. Update Agent Configurations

Agent model configurations are now in [`go-services/internal/agents/registry.go`](../../go-services/internal/agents/registry.go):

```go
// System agents use Claude 3 Haiku via OpenRouter
Config: agents.AgentConfig{
    Tier: agents.TierCloudLLM,
    ModelID: "anthropic/claude-3-haiku",
    Provider: "openrouter",
}

// Universal adapter uses GPT-5.2-codex
Config: agents.AgentConfig{
    Tier: agents.TierCloudLLM,
    ModelID: "openai/gpt-5.2-codex",
    Provider: "openai",
}
```

You can customize models per agent, but ensure they're supported by your chosen provider.

### 4. Remove Ollama Dependencies

```bash
# Uninstall Ollama (optional)
# Linux/Mac:
curl -fsSL https://ollama.ai/uninstall.sh | sh

# Stop any running Ollama services
sudo systemctl stop ollama
sudo systemctl disable ollama
```

### 5. Rebuild and Test

```bash
# Rebuild Go gateway
cd go-services
go build -o bin/gateway cmd/gateway/main.go

# Start gateway
./bin/gateway

# Test in another terminal
curl http://localhost:8080/health
# Should return: {"status":"healthy","router":"cloud-router",...}

# Test agent chat
python scripts/test-agents.py
```

### 6. Monitor Costs

The gateway tracks costs in real-time:

```bash
# Check cumulative costs
curl http://localhost:8080/api/costs

# Example response:
{
  "total_cost_usd": 0.042,
  "total_requests": 156,
  "by_provider": {
    "openrouter": {
      "cost_usd": 0.042,
      "requests": 156
    }
  },
  "by_agent": {
    "ada": {"cost_usd": 0.015, "requests": 52},
    "lea": {"cost_usd": 0.012, "requests": 41},
    ...
  }
}
```

## Expected Cost Comparison

**Ollama (Local)**:
- Hardware: $500-2000 (GPU)
- Power: ~$20-50/month (300W GPU)
- Maintenance: Your time

**Cloud (OpenRouter)**:
- Hardware: $0
- Per-token: $0.25-1.25 per 1M tokens
- Estimated: $10-100/month depending on usage

For most users, cloud is more cost-effective unless running >10M tokens/day.

## Troubleshooting

### "No cloud provider available"

**Cause**: Missing API keys in `.env`

**Solution**: Add at least `OPENROUTER_API_KEY`:
```bash
echo "OPENROUTER_API_KEY=sk-or-v1-your-key" >> .env
```

### "Provider authentication failed"

**Cause**: Invalid or expired API key

**Solution**: 
1. Check key format (OpenRouter: `sk-or-v1-...`, Anthropic: `sk-ant-...`, OpenAI: `sk-...`)
2. Verify at provider dashboard
3. Regenerate if needed

### "Rate limit exceeded"

**Cause**: Too many requests to provider

**Solution**:
1. Add caching: `LLM_CACHE_ENABLED=true`
2. Reduce rate: `GATEWAY_RATE_RPS=5`
3. Upgrade provider tier

### "Circuit breaker open"

**Cause**: Provider is experiencing issues

**Solution**: Wait 60 seconds for circuit breaker to close, or switch providers temporarily.

## Rollback (If Needed)

If you must rollback to Ollama support:

```bash
# Checkout last Ollama-compatible version
git checkout v0.31.0

# Reinstall dependencies
npm install
cd go-services && go mod download

# Rebuild
npm run build
cd go-services && go build -o bin/gateway cmd/gateway/main.go
```

**Note**: v0.31.0 lacks knowledge graph integration and other recent features.

## FAQ

### Can I use multiple providers simultaneously?

Yes. The `CloudOnlyRouter` tries providers in order:
1. Agent-specific provider (if configured)
2. OpenRouter (if `OPENROUTER_API_KEY` set)
3. Anthropic (if `ANTHROPIC_API_KEY` set)
4. OpenAI (if `OPENAI_API_KEY` set)

### What if my provider is down?

The circuit breaker will detect failures and fail fast. Configure fallback providers:

```bash
OPENROUTER_API_KEY=primary-key
ANTHROPIC_API_KEY=fallback-key
```

### Can I still run locally?

No. Local LLM support has been permanently removed. Use cloud providers or fork the project to restore Ollama support.

### How do I optimize costs?

1. Enable caching: `LLM_CACHE_ENABLED=true`
2. Use cheaper models: Claude 3 Haiku instead of GPT-4
3. Reduce system prompt length
4. Batch requests when possible

### What about privacy?

All major providers have privacy policies:
- OpenRouter: https://openrouter.ai/privacy
- Anthropic: https://www.anthropic.com/legal/privacy
- OpenAI: https://openai.com/privacy

For sensitive data, consider:
- Self-hosted alternatives (requires code changes)
- On-premises deployments with direct provider contracts
- Data anonymization before LLM calls

## Related Documentation

- [ADR-001: Cloud-Only LLM Architecture](../architecture/ADR-001-cloud-only-llm.md)
- [Environment Configuration](../ENVIRONMENT_CONFIGURATION.md)
- [Go Gateway Documentation](../../go-services/README.md)
- [Cost Tracking API](../../go-services/internal/llm/README.md)

## Support

If you encounter issues not covered here:

1. Check [GitHub Issues](https://github.com/chrysalis-ai/agents/issues)
2. Review [Architecture Documentation](../ARCHITECTURE.md)
3. Join [Discord Community](https://discord.gg/chrysalis-ai)

---

**Last Updated**: January 25, 2026  
**Applies To**: Chrysalis v0.32.0+

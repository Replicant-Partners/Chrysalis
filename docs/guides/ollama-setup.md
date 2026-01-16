# Ollama Setup Guide for Testing Phase

This guide explains how to set up and use Ollama local models for the **initial testing phase** of Ada and system agents in Chrysalis.

## Testing Phase Overview

During this testing phase, we are:
- Testing Ada with **ministral-3:3b** as the default model
- Evaluating system agents running on various Ollama models
- Determining optimal model sizes for different agent tasks
- Comparing model performance across different agent capabilities

**Current default model:** `ministral-3:3b` (3.0 GB)

This provides:

- ✅ **Privacy**: All processing happens locally on your machine
- ✅ **Speed**: No network latency for API calls
- ✅ **Cost**: No API usage fees
- ✅ **Offline**: Works without internet connection
- ✅ **Experimentation**: Easy to test different models for different tasks

## Prerequisites

- **Ollama** installed on your system
- **At least 4GB** of available RAM
- **8GB+ disk space** for models

## Installing Ollama

### Linux

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### macOS

```bash
brew install ollama
```

Or download from: https://ollama.com/download

### Windows

Download the installer from: https://ollama.com/download

## Installing Models

### Default Model (Recommended)

Ada uses **ministral-3:3b** by default. To install:

```bash
ollama pull ministral-3:3b
```

To start the model:

```bash
ollama run ministral-3:3b
```

### Initial Testing Phase Models

These are the **recommended starting models** for the testing phase. They are optimized for local development on systems with 8-16GB RAM:

| Model | Size | Description | Command |
|-------|------|-------------|---------|
| **ministral-3:3b** ⭐ | 3.0 GB | Default for Ada. Balanced performance | `ollama pull ministral-3:3b` |
| **granite4:3b** | 2.1 GB | IBM model for enterprise tasks | `ollama pull granite4:3b` |
| **qwen3:4b** | 2.5 GB | Alibaba model with multilingual support | `ollama pull qwen3:4b` |
| **llama3.2:latest** | 2.0 GB | Meta's versatile model | `ollama pull llama3.2:latest` |
| **gemma3:latest** | 3.3 GB | Google model with strong reasoning | `ollama pull gemma3:latest` |
| **deepseek-r1:1.5b** | 1.1 GB | Compact reasoning model | `ollama pull deepseek-r1:1.5b` |
| **smollm:1.7b** | 990 MB | Ultra-compact for lightweight tasks | `ollama pull smollm:1.7b` |

### Discovering Available Models

To see all models currently installed on your machine:

```bash
ollama list
```

This shows models you've already downloaded and can use immediately.

### Finding Additional Models

If during testing you find a task would benefit from a different model:

1. **Browse the Ollama Model Library**: https://ollama.com/library
2. **Find an optimal model** for your specific task (code generation, reasoning, chat, etc.)
3. **Pull it on-demand**:
   ```bash
   ollama pull <model-name>
   ```

**Example:** If you need better code generation:
```bash
# Discover code-focused models at https://ollama.com/library
ollama pull codellama:7b
ollama pull deepseek-coder:6.7b
```

**Remember:** The goal during this testing phase is to determine which model sizes and types work best for specific agent tasks. Don't hesitate to download and test new models as you discover optimization opportunities.

## Starting Ollama

Ollama must be running before starting Chrysalis:

```bash
# Start Ollama server (runs in background)
ollama serve

# Or run a specific model interactively
ollama run ministral-3:3b
```

The Ollama server runs on **http://localhost:11434** by default.

## Gateway Configuration

Chrysalis uses the **Go LLM Gateway** to route requests to Ollama. The gateway should be running on **http://localhost:8080**.

### Starting the Gateway

```bash
cd go-services
go run cmd/gateway/main.go
```

The gateway will automatically detect and route to Ollama models.

## Ada Configuration

### Default Configuration

Ada is pre-configured to use Ollama with these settings:

```typescript
{
  useGateway: true,
  gatewayBaseUrl: 'http://localhost:8080',
  gatewayModel: 'ministral-3:3b',
}
```

### Custom Configuration

To use a different model:

```typescript
import { getAdaService } from '@/components/Ada';

const ada = getAdaService({
  useGateway: true,
  gatewayBaseUrl: 'http://localhost:8080',
  gatewayModel: 'qwen3:4b', // or any other model
});
```

### Environment Variables

Configure via environment variables:

```bash
# .env.local
GATEWAY_BASE_URL=http://localhost:8080
OLLAMA_BASE_URL=http://localhost:11434
```

## Verifying Setup

### 1. Check Ollama is Running

```bash
curl http://localhost:11434/api/version
```

Should return version information.

### 2. Test Model

```bash
curl http://localhost:11434/api/generate -d '{
  "model": "ministral-3:3b",
  "prompt": "Hello, Ada!"
}'
```

### 3. Check Gateway

```bash
curl http://localhost:8080/health
```

Should return `{"status": "ok"}`.

### 4. Test Ada Integration

Run the demo:

```bash
npm run dev:ada-demo
```

Click "Request Help" in the demo console to test Ada's response.

## Testing Phase: Model Optimization

### Testing Goals

During this phase, we're determining:
- **Which model sizes work best for different agent types**
  - Can smaller models (1.5-2GB) handle simple agent tasks effectively?
  - Do complex reasoning tasks need larger models (3-4GB+)?
- **Task-specific model performance**
  - Code generation vs. natural language
  - Quick responses vs. deep analysis
  - Memory-intensive vs. compute-intensive tasks
- **System agent model assignments**
  - Each system agent can use a different model
  - Test if specialized models improve specific agent performance

### Model Selection Guide

Choose a model based on your testing needs:

#### For General Use
**ministral-3:3b** (default) - Best balance of quality and speed. Start here.

#### For Multilingual Support
**qwen3:4b** - Strong multilingual capabilities. Test for international agent interactions.

#### For Reasoning Tasks
**gemma3:latest** or **deepseek-r1:1.5b** - Enhanced reasoning. Test for complex analysis agents.

#### For Low-Resource Systems
**smollm:1.7b** - Minimal memory footprint. Test if lightweight agents can use this effectively.

#### For Enterprise/Compliance
**granite4:3b** - IBM-backed enterprise model. Test for business logic agents.

#### For Code-Focused Tasks
**codellama:7b** or **deepseek-coder:6.7b** - Specialized for code. Test for developer assistance agents.

### Testing Methodology

1. **Baseline with ministral-3:3b**: Establish baseline performance for all agents
2. **Test smaller models**: Try smollm:1.7b or deepseek-r1:1.5b for simple tasks
3. **Test larger models**: Try larger models for complex reasoning tasks
4. **Document findings**: Note which tasks benefit from which model sizes
5. **Optimize assignments**: Assign optimal models to each agent type

### Example Testing Scenarios

```typescript
// Test 1: Ada on default model
const adaDefault = getAdaService({ gatewayModel: 'ministral-3:3b' });

// Test 2: Ada on smaller model (for comparison)
const adaSmall = getAdaService({ gatewayModel: 'smollm:1.7b' });

// Test 3: Ada on larger reasoning model
const adaLarge = getAdaService({ gatewayModel: 'gemma3:latest' });

// Compare response quality, speed, and resource usage
```

### System Agent Model Testing

Each system agent can use a different model optimized for its task:

```typescript
// Example: Different models for different agent types
const agents = {
  ada: { model: 'ministral-3:3b' },        // General assistance
  codeReviewer: { model: 'deepseek-coder:6.7b' }, // Code analysis
  researcher: { model: 'gemma3:latest' },  // Deep reasoning
  translator: { model: 'qwen3:4b' },       // Multilingual
  quickResponder: { model: 'smollm:1.7b' } // Fast, simple tasks
};
```

**Testing Questions to Answer:**
- Can we run 3-4 agents simultaneously with different models?
- Do smaller models save enough resources to justify quality trade-offs?
- Which agent tasks truly need larger models vs. can use smaller ones?

## Troubleshooting

### Ollama Not Found

```bash
# Check if Ollama is installed
which ollama

# Install if missing (Linux)
curl -fsSL https://ollama.com/install.sh | sh
```

### Model Not Loaded

```bash
# List available models
ollama list

# Pull missing model
ollama pull ministral-3:3b
```

### Gateway Connection Failed

1. Verify gateway is running: `curl http://localhost:8080/health`
2. Check firewall settings
3. Ensure gateway is configured for Ollama provider

### Slow Responses

- Use a smaller model (smollm:1.7b or deepseek-r1:1.5b)
- Ensure sufficient RAM available
- Close other applications
- Consider GPU acceleration if available

### Out of Memory

- Use a smaller model
- Restart Ollama: `ollama serve`
- Check system resources: `htop` or Task Manager

## Performance Tips

### Optimize RAM Usage

```bash
# Set Ollama memory limit (Linux/macOS)
export OLLAMA_MAX_LOADED_MODELS=1
export OLLAMA_NUM_PARALLEL=1
```

### Keep Models Loaded

Models stay loaded in memory for faster responses. To keep ministral-3:3b ready:

```bash
# Start in background
ollama run ministral-3:3b &
```

### GPU Acceleration

If you have a compatible GPU:

```bash
# Ollama automatically uses GPU if available
# Check GPU usage
nvidia-smi  # NVIDIA
rocm-smi    # AMD
```

## Switching Between Models

### Via Configuration

```typescript
import { getAdaService } from '@/components/Ada';
import { DEFAULT_ADA_MODEL, OLLAMA_MODELS } from '@/config';

// Get available models
const models = Object.keys(OLLAMA_MODELS);

// Switch model
const ada = getAdaService({
  gatewayModel: 'gemma3:latest',
});
```

### Via Environment

```bash
# .env.local
GATEWAY_MODEL=qwen3:4b
```

## Advanced Configuration

### Multiple Models for Different Agents

```typescript
// Ada uses ministral-3:3b
const ada = getAdaService({
  gatewayModel: 'ministral-3:3b',
});

// Another agent uses gemma3
const analyst = getAnalystService({
  gatewayModel: 'gemma3:latest',
});
```

### Model Routing

The gateway can route based on model name:

```typescript
// Gateway automatically routes to correct provider
await gateway.chat('ada', messages, 0.7, 'ministral-3:3b');
```

## Next Steps

- [Ada Integration Guide](./ada-integration.md)
- [Gateway Configuration](../deployment/gateway-setup.md)
- [System Agent Architecture](../architecture/system-agents.md)
- [Model Comparison](./model-comparison.md)

## Additional Resources

### Ollama Resources
- **Official Website**: https://ollama.com
- **GitHub Repository**: https://github.com/ollama/ollama
- **Model Library**: https://ollama.com/library - Browse all available models
- **Documentation**: https://ollama.com/docs
- **API Reference**: https://github.com/ollama/ollama/blob/main/docs/api.md

### Chrysalis Resources
- [Ada Integration Guide](./ada-integration.md)
- [Gateway Configuration](../deployment/gateway-setup.md)
- [System Agent Architecture](../architecture/system-agents.md)
- [Gateway Documentation](../../go-services/README.md)

### Testing Phase Resources
- Document your testing findings in a shared location
- Track model performance metrics (response time, quality, resource usage)
- Share optimal model configurations for different agent types
- Report issues or discoveries during testing
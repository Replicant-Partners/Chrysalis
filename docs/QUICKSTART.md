# Chrysalis Quickstart Guide

> Framework-transcendent agent morphing built on universal semantic patterns

## Installation

```bash
# Clone repository
git clone https://github.com/chrysalis-project/chrysalis.git
cd chrysalis

# Install dependencies
npm install

# Build
npm run build
```

## Quick Start

### 1. Initialize Configuration

```typescript
import { initializeConfig } from './src/core';

// Auto-loads from environment and chrysalis.config.json
const config = initializeConfig();
```

### 2. Create an Agent Memory

```typescript
import { Memory } from './src/memory';

const memory = new Memory({
  working: { maxSize: 10 },
  core: { allowedBlocks: ['persona', 'user_facts'] },
});

// Add working memory (recent context)
memory.addWorking('User asked about TypeScript');

// Set core memory (persistent)
memory.setCore('persona', 'A helpful coding assistant');

// Get context for LLM
const context = await memory.getContext('TypeScript question');
```

### 3. Use Prompt Templates

```typescript
import { prompts } from './src/prompts';

// Render a built-in prompt
const morphPrompt = prompts.render('agent.morph.analyze', {
  sourceFramework: 'elizaos',
  targetFramework: 'crewai',
  agentDefinition: JSON.stringify(myAgent),
});

// Register custom prompt
prompts.register('my.custom.prompt', {
  template: 'Hello {{name}}, how can I help with {{task}}?',
  requiredVars: ['name', 'task'],
});
```

### 4. CLI Usage

```bash
# Morph an agent between frameworks
npx chrysalis morph --source agent.json --target crewai --output agent-crew.py

# Manage instances
npx chrysalis instances list
npx chrysalis instances spawn my-agent --count 3

# Sync memory across instances
npx chrysalis sync start

# Validate agent definition
npx chrysalis validate agent.json
```

## Docker Deployment

```bash
# Build and run all services
docker-compose up -d

# View logs
docker-compose logs -f gateway

# Access services
# - Gateway: http://localhost:3000
# - Jaeger UI: http://localhost:16686
# - Prometheus: http://localhost:9091
# - Grafana: http://localhost:3010 (admin/chrysalis)
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Chrysalis Stack                         │
├─────────────────────────────────────────────────────────────┤
│  CLI                │  chrysalis morph|restore|sync|...      │
├─────────────────────────────────────────────────────────────┤
│  Memory             │  Working | Episodic | Semantic | Core  │
├─────────────────────────────────────────────────────────────┤
│  Prompts            │  PromptRegistry with versioned templates│
├─────────────────────────────────────────────────────────────┤
│  Adapters           │  ElizaOS | CrewAI | MCP | AutoGen      │
├─────────────────────────────────────────────────────────────┤
│  Observability      │  OpenTelemetry → Prometheus + Jaeger   │
├─────────────────────────────────────────────────────────────┤
│  Config             │  Centralized config facade             │
└─────────────────────────────────────────────────────────────┘
```

## Core Concepts

### Uniform Semantic Agent (USA)

The USA is Chrysalis's framework-agnostic agent representation:

```typescript
interface UniformSemanticAgent {
  id: string;
  name: string;
  version: string;
  capabilities: string[];
  memory: {
    working: MemoryEntry[];
    core: Record<string, string>;
  };
  tools: Tool[];
}
```

### Four-Tier Memory

| Tier | Purpose | Storage | Retention |
|------|---------|---------|-----------|
| Working | Recent context | In-memory | Session |
| Episodic | Past experiences | Vector DB | Persistent |
| Semantic | Knowledge/facts | Vector DB | Persistent |
| Core | Agent identity | Structured | Persistent |

### Error Handling

```typescript
import { ErrorBoundary, MorphError, ErrorCodes } from './src/core';

const boundary = new ErrorBoundary({
  maxRetries: 3,
  exponentialBackoff: true,
});

const result = await boundary.execute(async () => {
  // Your operation here
  return morphAgent(source, target);
});
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CHRYSALIS_ENV` | Environment (development/production) | development |
| `CHRYSALIS_LOG_LEVEL` | Log level | info |
| `CHRYSALIS_OTEL_ENABLED` | Enable OpenTelemetry | false |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP endpoint | http://localhost:4318 |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `ANTHROPIC_API_KEY` | Anthropic API key | - |

## Running Tests

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# All tests
npm test
```

## Next Steps

- [Architecture Guide](./ARCHITECTURE.md)
- [Adapter Development](./adapters/)
- [Memory System Deep Dive](./memory/)
- [Contributing](../CONTRIBUTING.md)

---

**Chrysalis** - *Nothing flies that is overweight, bumpy, and crufted.*
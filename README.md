# Chrysalis

**Uniform Semantic Agent Transformation System**

[![Version](https://img.shields.io/badge/version-3.1.0-blue.svg)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](package.json)

---

## What is Chrysalis?

Chrysalis enables AI agents to operate as **independent, evolving entities** by providing:

- **Lossless Morphing** — Transform agents between MCP, Multi-Agent, and Orchestrated implementations without information loss
- **Distributed Memory** — Persistent episodic and semantic memory with intelligent deduplication
- **Experience Synchronization** — Continuous learning from deployed instances
- **Cryptographic Identity** — Tamper-evident agent identity using SHA-384 and Ed25519

```mermaid
flowchart LR
    A[Source Agent] --> B{Morph}
    B --> C[MCP Agent]
    B --> D[Multi-Agent]
    B --> E[Orchestrated]
    C --> F[Experience Sync]
    D --> F
    E --> F
    F --> G[Enhanced Agent]
```

---

## Quick Start

### Prerequisites

- Node.js ≥ 18.0.0
- npm ≥ 9.0
- Python 3.10+ (for memory_system)

### Installation

```bash
# Clone repository
git clone https://github.com/Replicant-Partners/Chrysalis.git
cd Chrysalis

# Install TypeScript dependencies
npm install

# Build
npm run build

# Verify
npm run test:unit
```

### Basic Usage

```typescript
import { createPatternResolver } from './src/fabric/PatternResolver';
import { MemoryMerger } from './src/experience/MemoryMerger';
import { ExperienceSyncManager } from './src/sync/ExperienceSyncManager';

// Create pattern resolver (adaptive mode)
const resolver = createPatternResolver('adaptive');

// Use cryptographic patterns
const hashImpl = await resolver.resolveHash();
const fingerprint = await hashImpl.implementation.generateFingerprint(agent.identity);

// Merge memories with deduplication
const merger = new MemoryMerger({
  similarity_method: 'jaccard',
  similarity_threshold: 0.9
});
await merger.mergeBatch(agent, memories, 'instance-1');

// Sync experiences from instances
const syncManager = new ExperienceSyncManager();
await syncManager.initializeSync('instance-1', 'streaming', config, agent);
```

### Python Memory System

```bash
# Install Python package
pip install -e memory_system/

# Run tests
cd memory_system && python3 -m pytest tests/ -v
```

```python
from memory_system.semantic import HeuristicStrategy
from memory_system.embedding import EmbeddingService

# Semantic decomposition
strategy = HeuristicStrategy()
frame = await strategy.decompose("fix the login bug in auth.py")
print(frame.intent)  # Intent.DEBUG

# Embeddings with fallback
service = EmbeddingService(model="voyage-3")
vector = service.embed("Knowledge representation")
```

---

## Key Capabilities

### Implemented ✅

| Capability | Description | Source |
|------------|-------------|--------|
| **Agent Schema v2.0** | Three implementation types with OODA interrogatives | [`UniformSemanticAgentV2.ts`](src/core/UniformSemanticAgentV2.ts) |
| **Adaptive Pattern Resolution** | Context-aware MCP/Go/Embedded selection | [`PatternResolver.ts`](src/fabric/PatternResolver.ts) |
| **Memory Merging** | Jaccard + embedding similarity with deduplication | [`MemoryMerger.ts`](src/experience/MemoryMerger.ts) |
| **Experience Sync** | Streaming, lumped, and check-in protocols | [`ExperienceSyncManager.ts`](src/sync/ExperienceSyncManager.ts) |
| **Observability** | Voyeur event bus + SSE viewer + Prometheus metrics | [`src/observability/`](src/observability/) |
| **Circuit Breaker** | Fault tolerance for external service calls | [`CircuitBreaker.ts`](src/utils/CircuitBreaker.ts) |
| **Python Semantic Services** | 7 modules, 84 tests passing | [`memory_system/`](memory_system/) |

### In Progress 🔄

- MCP client SDK integration with PatternResolver
- Sanitizer hardening (PII detection, allowlists)
- Go gRPC test verification

### Planned 📋

- True gossip protocol (epidemic spreading)
- CRDT state management
- Vector database persistence

---

## Project Structure

```
Chrysalis/
├── src/                      # TypeScript source
│   ├── core/                 # Agent schema, patterns
│   ├── fabric/               # Pattern resolution
│   ├── memory/               # Memory adapters, embeddings
│   ├── experience/           # Merging algorithms
│   ├── sync/                 # Experience synchronization
│   ├── observability/        # Voyeur, metrics
│   ├── adapters/             # Framework adapters
│   └── services/             # Microservices
├── memory_system/            # Python semantic services
│   ├── semantic/             # Intent detection, triples
│   ├── graph/                # Knowledge graphs
│   ├── converters/           # Document processing
│   ├── embedding/            # Vector embeddings
│   └── analysis/             # Shannon entropy
├── docs/                     # Documentation
│   ├── current/              # Active specifications
│   ├── research/             # Research foundation
│   └── archive/              # Historical versions
├── examples/                 # Usage examples
└── tests/                    # Test suites
```

---

## Documentation

| Document | Purpose |
|----------|---------|
| **[Architecture](ARCHITECTURE.md)** | System design, components, data flow |
| **[Status](docs/current/STATUS.md)** | Implementation status, remaining work |
| **[Documentation Index](docs/README.md)** | Navigation hub for all docs |
| **[Memory System](memory_system/README.md)** | Python package documentation |
| **[Research](docs/research/)** | Universal patterns, deep research |

### Quick Links

- [Unified Spec v3.1](docs/current/UNIFIED_SPEC_V3.1.md) — Complete technical specification
- [Universal Patterns](docs/research/universal-patterns/PATTERNS_ANCHORED.md) — Evidence-based pattern validation
- [Observability Guide](docs/current/OBSERVABILITY_GUIDE.md) — SSE viewer and metrics setup

---

## Configuration

### Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `VOYAGE_API_KEY` | Voyage AI embeddings | For production |
| `OPENAI_API_KEY` | OpenAI embeddings (fallback) | For production |
| `ANTHROPIC_API_KEY` | Claude semantic decomposition | For LLM analysis |
| `VECTOR_INDEX_TYPE` | Index backend (`hnsw`, `lance`, `brute`) | No |
| `METRICS_PROMETHEUS` | Enable Prometheus metrics | No |

### npm Scripts

```bash
npm run build           # Compile TypeScript
npm run test:unit       # Run unit tests
npm run test:mcp        # Run MCP server tests
npm run dev             # Development mode
npm run service:ledger  # Start ledger service
npm run service:gateway # Start capability gateway
```

---

## Architecture Overview

```mermaid
flowchart TB
    subgraph Core["Core Layer"]
        USA[UniformSemanticAgent]
        PR[PatternResolver]
    end

    subgraph Memory["Memory Layer"]
        MM[MemoryMerger]
        VIF[VectorIndex]
        EB[EmbeddingBridge]
    end

    subgraph Sync["Sync Layer"]
        ESM[ExperienceSyncManager]
        ET[ExperienceTransport]
    end

    subgraph Obs["Observability"]
        VB[VoyeurBus]
        MET[Metrics]
    end

    USA --> PR
    USA --> MM
    MM --> VIF
    MM --> EB
    MM --> VB
    ESM --> MM
    ESM --> ET
    VB --> MET
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for complete system design.

---

## Contributing

We welcome contributions! Please see our development workflow:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make changes with tests
4. Run `npm run build && npm run test:unit`
5. Commit (`git commit -m 'Add amazing feature'`)
6. Push (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Standards

- TypeScript strict mode
- ESLint configuration
- Jest for testing
- Mermaid for diagrams

---

## Research Foundation

Chrysalis applies **10 universal patterns** validated against production systems:

| Pattern | Application | Evidence |
|---------|-------------|----------|
| Hash | Agent fingerprinting | Git, Bitcoin, IPFS |
| Signatures | Authentication | TLS, Ethereum, Signal |
| Gossip | Experience propagation | Cassandra, Ethereum 2.0 |
| DAG | Evolution tracking | Git, IPFS, Hedera |
| CRDT | Conflict-free merge | Automerge, Riak |

See [docs/research/](docs/research/) for deep research and mathematical foundations.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Status Summary

| Component | Status |
|-----------|--------|
| TypeScript Core | ✅ Builds and tests pass |
| Python Memory System | ✅ 84/84 tests passing |
| Go Crypto Server | ⚠️ Tests not verified this session |
| Documentation | ✅ Current |

**Version**: 3.1.0
**Last Updated**: January 9, 2026

---

<p align="center">
  <strong>Transform. Learn. Emerge.</strong>
</p>

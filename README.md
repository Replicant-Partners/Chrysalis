# Chrysalis: Uniform Semantic Agent Transformation System

**Version**: 3.1.0  
**Status**: Active Development | Research Phase  
**License**: TBD

---

## Overview

Chrysalis enables AI agents to act as independent, evolving entities through a Uniform Semantic Agent specification that includes distributed memory layers and a computing fabric. The system provides:

- **Lossless agent morphing** between three implementation types (MCP, Multi-Agent, Orchestrated)
- **Distributed memory architecture** with episodic and semantic layers
- **10 universal patterns** from distributed systems research
- **MCP Layer 1 fabric** providing cryptographic and distributed primitives
- **Experience synchronization** protocols for agent evolution

## Quick Links

- 🚀 **[Quick Start](QUICK_START.md)** - Get started in 10 minutes
- 📐 **[Architecture Overview](ARCHITECTURE.md)** - System design and patterns
- 📚 **[Complete Specification](docs/current/UNIFIED_SPEC_V3.1.md)** - Comprehensive technical spec
- 🔬 **[Research Foundation](docs/research/)** - Universal patterns and deep research
- 💻 **[Source Code](src/)** - TypeScript core + Go gRPC services + Clojure uSA
- 📖 **[Documentation Index](docs/README.md)** - Complete documentation map

## Project Structure

```
Chrysalis/
├── docs/                    # All documentation
│   ├── current/             # Active specifications
│   ├── research/            # Research foundation
│   ├── archive/             # Historical versions
│   └── diagrams/            # System diagrams
├── src/                     # Source code
│   ├── core/                # Core patterns and types
│   ├── fabric/              # Pattern resolution
│   ├── memory/              # Memory systems
│   ├── adapters/            # Framework adapters
│   └── sync/                # Experience sync
├── mcp-servers/             # Layer 1 MCP services
├── examples/                # Usage examples
├── projects/                # Project-specific code
└── tests/                   # Test suite
```

## Key Features

### Uniform Semantic Agent Schema v3.1
- Three implementation types supported
- Cryptographic identity (SHA-384 + Ed25519)
- Dual-coded memory (episodic + semantic) with OODA interrogatives per episode
- Evolution tracking with DAG structure
- CRDT-ready state management

### Fractal Architecture
- **Scale 0**: Mathematical patterns (hash, signatures, gossip, etc.)
- **Scale 1**: Validated libraries (@noble/*, graphlib)
- **Scale 2**: Go gRPC fabric (crypto primitives) + MCP services
- **Scale 3**: Embedded pattern implementations
- **Scale 4**: Agent operations

### Pattern Resolution
- Go gRPC crypto (hash, verify, Merkle, Ed25519, BLS)
- MCP servers for distributed structures
- Embedded/local for low-latency fallback
- Adaptive resolver chooses per context

### Experience Synchronization
- **Streaming**: Continuous real-time sync
- **Lumped**: Batch synchronization
- **Check-in**: Periodic reconciliation
- OODA recording persisted on episodes

### Interaction Modes
- CLI and adapters
- Emoji command mode (Noto default; Fluent/Open/custom selectable)

## Getting Started

### Prerequisites
```bash
Node.js >= 18
TypeScript >= 5.0
npm >= 9.0
```

### Installation
```bash
# Clone repository
git clone https://github.com/Replicant-Partners/Chrysalis.git
cd Chrysalis

# Install dependencies
npm install

# Build
npm run build

# Verify
npm test
```

### Basic Usage

```typescript
import { AdaptivePatternResolver } from './src/fabric/PatternResolver';
import { UniformSemanticAgentV2 } from './src/core/UniformSemanticAgentV2';

// Create pattern resolver
const resolver = createPatternResolver('adaptive');

// Use patterns
const hash = await resolver.resolveHash();
const fingerprint = await hash.implementation.generateFingerprint(agent.identity);
```

See [examples/](examples/) for more usage patterns.

## Documentation

### Current Specifications
- **[Unified Spec v3.1](docs/current/UNIFIED_SPEC_V3.1.md)** - Complete system specification
- **[Foundation Spec](docs/current/FOUNDATION_SPEC.md)** - Pattern foundations
- **[System Analysis](docs/current/ANALYSIS.md)** - Rigorous system analysis
- **[Synthesis](docs/current/SYNTHESIS.md)** - Design insights and evolution

### Research Foundation
- **[Universal Patterns](docs/research/universal-patterns/)** - 10 validated patterns
- **[Deep Research](docs/research/deep-research/)** - Mathematical foundations, security, gossip
- **[Agent Spec Research](docs/research/agent-spec/)** - Agent architecture research

### Guides
- **[Implementation Guide](docs/current/IMPLEMENTATION_GUIDE.md)** - How to implement
- **[MCP Setup](docs/current/MCP_SETUP.md)** - MCP server configuration
- **[Memory Systems](docs/current/memory/)** - Memory architecture and implementation

## Architecture

```mermaid
graph TD
    A[Agents] --> B[Pattern Resolver]
    B --> C{Deployment Context}
    C -->|Distributed| D[MCP Fabric]
    C -->|Single-Node| E[Embedded Patterns]
    D --> F[Crypto Primitives]
    D --> G[Distributed Structures]
    E --> H[@noble/hashes]
    E --> I[@noble/curves]
    E --> J[graphlib]
```

### Core Concepts

**Fractal Composition**: Patterns recur at multiple scales, from mathematics to application logic

**Adaptive Resolution**: Context-aware selection of pattern implementation (MCP vs embedded)

**Lossless Morphing**: Perfect bidirectional conversion between agent types with shadow fields

**Byzantine Resistance**: <1/3 fault tolerance through threshold voting and median aggregation

## Development Status

### Implemented ✅
- [x] Universal agent schema v2.0
- [x] Three agent type adapters
- [x] Experience sync (request-response)
- [x] Memory/skill/knowledge merging
- [x] Cryptographic identity
- [x] Instance management
- [x] MCP servers (33 tools)
- [x] Adaptive pattern resolution
- [x] Configurable memory similarity

### In Progress 🔄
- [ ] Embedding-based similarity (@xenova/transformers integration)
- [ ] MCP client connection
- [ ] True epidemic gossip protocol

### Planned 📋
- [ ] CRDT state management
- [ ] Vector indexing (HNSW)
- [ ] Evolution DAG visualization
- [ ] Multi-region deployment

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Workflow
1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## Research & Citations

This project builds on extensive research in distributed systems, cryptography, and agent architectures. Key sources:

- **Hedera Hashgraph**: Virtual voting, DAG consensus [[1](docs/research/deep-research/MATHEMATICAL_FOUNDATIONS.md)]
- **Noble Cryptography**: Audited cryptographic libraries [[2](docs/research/universal-patterns/PATTERNS_ANCHORED.md)]
- **Gossip Protocols**: Epidemic spreading in distributed systems [[3](docs/research/deep-research/GOSSIP_PROTOCOLS.md)]
- **Byzantine Fault Tolerance**: <1/3 malicious node tolerance [[4](docs/research/deep-research/SECURITY_ATTACKS.md)]

Full citations in [docs/research/](docs/research/).

## Community & Support

- **GitHub Issues**: Bug reports and feature requests
- **Discussions**: Design discussions and Q&A
- **Documentation**: Comprehensive specs and guides

## Project Mission

**Enable AI agents to operate as parts of larger, long-term learning and evolving information entities**, with their own memory, communication protocols, and compute fabric.

Key principles:
- **Agent Autonomy**: Agents as independent evolving entities
- **Lossless Transformation**: Perfect fidelity across implementations
- **Distributed Memory**: Persistent, synchronized experience and knowledge
- **Universal Patterns**: Build on proven distributed systems research
- **Research-Driven**: Evidence-based design decisions

## License

[License TBD]

## Acknowledgments

- Built with **standards-mode** rigor (evidence-based, single-step inference)
- Inspired by distributed systems research (Hedera, Cassandra, Ethereum)
- Leverages audited cryptography (@noble/hashes, @noble/curves)

---

**Version**: 3.1.0 | **Last Updated**: December 28, 2025  
**Repository**: [github.com/Replicant-Partners/Chrysalis](https://github.com/Replicant-Partners/Chrysalis)

🦋 **Transformation through evidence-based evolution** 🦋

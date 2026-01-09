# Chrysalis Documentation

> **Version:** 3.1.0 | **Status:** Active Development

Chrysalis is a **Uniform Semantic Agent Transformation System** that enables AI agents to morph between different framework implementations while preserving identity, knowledge, and skills.

---

## Quick Navigation

| I want to... | Go to |
|-------------|-------|
| **Get started quickly** | [Quickstart Guide](./getting-started/quickstart.md) |
| **Understand the architecture** | [Architecture Overview](./architecture/overview.md) |
| **Learn about the patterns** | [Universal Patterns](./architecture/universal-patterns.md) |
| **See what's implemented** | [Implementation Status](./current/STATUS.md) |
| **Read the full specification** | [Unified Spec v3.1](./current/UNIFIED_SPEC_V3.1.md) |

---

## Documentation Structure

```
docs/
├── getting-started/         # 🚀 Start here
│   └── quickstart.md        # 5-minute setup guide
│
├── architecture/            # 🏗️ System design
│   ├── overview.md          # High-level architecture
│   ├── universal-patterns.md # 10 mathematical patterns
│   ├── experience-sync.md   # Sync protocols (planned)
│   └── memory-system.md     # Memory architecture (planned)
│
├── guides/                  # 📖 How-to guides
│   ├── morphing-agents.md   # ElizaOS ↔ CrewAI (planned)
│   ├── services.md          # Running services (planned)
│   └── observability.md     # Metrics and tracing (planned)
│
├── reference/               # 📚 API reference
│   ├── typescript-api.md    # TypeScript API (planned)
│   └── python-api.md        # Python API (planned)
│
├── current/                 # 📋 Active specifications
│   ├── STATUS.md            # Implementation tracker
│   ├── UNIFIED_SPEC_V3.1.md # Complete technical spec
│   └── memory/              # Memory subsystem specs
│
├── research/                # 🔬 Research foundation
│   ├── RESEARCH_SUMMARY.md
│   └── COMPARISON.md
│
└── archive/                 # 📦 Historical docs
    ├── v1/
    ├── v2/
    └── v3/
```

---

## Getting Started

### For New Users

1. **[Quickstart Guide](./getting-started/quickstart.md)** - Install, build, and morph your first agent
2. **[Architecture Overview](./architecture/overview.md)** - Understand the system design
3. **[Universal Patterns](./architecture/universal-patterns.md)** - Learn the foundational patterns

### For Contributors

1. Review the [Implementation Status](./current/STATUS.md)
2. Read the [Unified Specification](./current/UNIFIED_SPEC_V3.1.md)
3. Check open issues on GitHub

---

## Core Concepts

### Three Agent Types

| Type | Description | Use Case |
|------|-------------|----------|
| **MCP** | Tool-augmented single agent | Rich tool access |
| **Multi-Agent** | Peer-to-peer collaboration | Autonomous networks |
| **Orchestrated** | Managed fleet with coordinator | Task delegation |

### Supported Frameworks

| Framework | Adapter Status | Direction |
|-----------|---------------|-----------|
| **ElizaOS** | ✅ Implemented | Bidirectional |
| **CrewAI** | ✅ Implemented | Bidirectional |
| **LangChain** | 📋 Planned | - |
| **AutoGen** | 📋 Planned | - |

### 10 Universal Patterns

Mathematical foundations from distributed systems:

1. Hash Functions
2. Digital Signatures
3. Encryption
4. Byzantine Agreement
5. Logical Time
6. CRDTs
7. Gossip Protocol
8. DAG
9. Convergence
10. Random Selection

See [Universal Patterns](./architecture/universal-patterns.md) for details.

---

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Core Runtime** | TypeScript / Node.js 18+ | Agent morphing, sync |
| **Memory System** | Python 3.11+ | Semantic analysis |
| **Vector Store** | LanceDB | Memory retrieval |
| **CRDT Sync** | Yjs | Distributed state |
| **Crypto** | @noble/curves | Identity, signatures |

---

## Key Files Reference

### TypeScript Core

| File | Purpose |
|------|---------|
| [`src/core/UniformSemanticAgentV2.ts`](../src/core/UniformSemanticAgentV2.ts) | Agent type definitions |
| [`src/adapters/ElizaOSAdapter.ts`](../src/adapters/ElizaOSAdapter.ts) | ElizaOS conversion |
| [`src/adapters/CrewAIAdapter.ts`](../src/adapters/CrewAIAdapter.ts) | CrewAI conversion |
| [`src/fabric/PatternResolver.ts`](../src/fabric/PatternResolver.ts) | Pattern resolution |
| [`src/sync/ExperienceSyncManager.ts`](../src/sync/ExperienceSyncManager.ts) | Experience sync |

### Python Memory

| File | Purpose |
|------|---------|
| [`memory_system/core.py`](../memory_system/core.py) | Memory interface |
| [`memory_system/semantic/`](../memory_system/semantic/) | Semantic analysis |
| [`memory_system/embedding/`](../memory_system/embedding/) | Vector embeddings |

---

## Status Legend

Throughout the documentation:

| Symbol | Meaning |
|--------|---------|
| ✅ | Implemented and tested |
| 🔄 | In progress |
| 📋 | Designed, not implemented |
| 💭 | Concept only |
| ⚠️ | Deprecated |

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| 3.1.0 | Current | Experience sync, memory merging |
| 3.0.0 | - | Universal patterns, adapters |
| 2.0.0 | - | Agent V2 schema |
| 1.0.0 | - | Initial release |

See [archive/](./archive/) for historical documentation.

---

## Related Resources

- **Root README**: [`../README.md`](../README.md)
- **Architecture Doc**: [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
- **Memory System**: [`../memory_system/README.md`](../memory_system/README.md)
- **Plans**: [`../plans/`](../plans/)

---

## Contributing to Docs

1. Follow the templates in [`plans/documentation-architecture-plan.md`](../plans/documentation-architecture-plan.md)
2. All code references must use clickable format: [`file.ts:line`](../src/file.ts:line)
3. Mark implementation status with symbols
4. Keep tone technical but accessible
# Chrysalis Documentation Index

**Last Updated**: January 16, 2026
**Status**: Active

---

## Navigation Hub

This index is the central navigation point for all Chrysalis documentation.

---

## Quick Links

| I want to... | Go to... |
|--------------|----------|
| Check current status | [`STATUS.md`](STATUS.md) |
| Understand system architecture | [`ARCHITECTURE.md`](../ARCHITECTURE.md) |
| Understand canvas architecture | [`guides/WIDGET_DEVELOPER_GUIDE.md`](guides/WIDGET_DEVELOPER_GUIDE.md) |
| Get started quickly | [`guides/QUICK_START.md`](guides/QUICK_START.md) |
| Configure the system | [`CONFIGURATION.md`](CONFIGURATION.md) |
| Use the memory system | [`memory_system/README.md`](../memory_system/README.md) |
| Build custom widgets | [`guides/WIDGET_DEVELOPER_GUIDE.md`](guides/WIDGET_DEVELOPER_GUIDE.md) |

---

## Documentation Structure

```
docs/
├── INDEX.md                 # This file - navigation hub
├── STATUS.md                # Single source of truth for implementation status
│
├── architecture/            # Architecture deep-dives
│   ├── overview.md
│   ├── memory-system.md
│   └── universal-patterns.md
│
├── api/                     # API documentation
│   └── API_REFERENCE_INDEX.md
│
├── guides/                  # How-to guides
│   ├── QUICK_START.md
│   └── TROUBLESHOOTING.md
│
├── current/                 # Active specifications
│   └── UNIFIED_SPEC_V3.1.md
│
├── research/                # Research foundation
│   └── universal-patterns/
│
├── adr/                     # Architecture Decision Records
│
└── archive/                 # Historical documentation (flat structure)
    └── *.md                 # Archived docs with ARCHIVED prefix

src/canvas/                  # Canvas system (TypeScript)
├── core/                    # Base canvas types
├── widgets/                 # Widget registry & factory
├── layout/                  # Spatial layout engine
├── terminal/                # xterm.js integration
└── react/                   # React components & demo
```

---

## Core Documentation

### Status & Implementation

| Document | Purpose | Authority |
|----------|---------|-----------|
| **[`STATUS.md`](STATUS.md)** | Build status, test results, known gaps | **Authoritative** |
| **[`ARCHITECTURE.md`](../ARCHITECTURE.md)** | System design | **Authoritative** |

### Architecture

| Document | Scope |
|----------|-------|
| [`ARCHITECTURE.md`](../ARCHITECTURE.md) | Full system design |
| [`architecture/EXTENSIBILITY_ARCHITECTURE.md`](architecture/EXTENSIBILITY_ARCHITECTURE.md) | Extension contracts, Web3 integration |
| [`architecture/FAIR_EXTENSION_ALIGNMENT.md`](architecture/FAIR_EXTENSION_ALIGNMENT.md) | FAIR principles, Complex Learner alignment |
| [`CHRYSALIS_SHARED_MEMORY_ARCHITECTURE.md`](CHRYSALIS_SHARED_MEMORY_ARCHITECTURE.md) | CRDT-based shared memory |
| [`guides/WIDGET_DEVELOPER_GUIDE.md`](guides/WIDGET_DEVELOPER_GUIDE.md) | Canvas & widget architecture |
| [`canvas-architecture.md`](canvas-architecture.md) | Canvas wireframe spec |
| [`memory_system/README.md`](../memory_system/README.md) | Python memory system |

### Guides

| Document | Purpose |
|----------|---------|
| [`guides/QUICK_START.md`](guides/QUICK_START.md) | Get running in 15 minutes |
| [`CONFIGURATION.md`](CONFIGURATION.md) | Environment variables |
| [`guides/WIDGET_DEVELOPER_GUIDE.md`](guides/WIDGET_DEVELOPER_GUIDE.md) | Build custom widgets |
| [`guides/CANVAS_TYPE_EXTENSION_GUIDE.md`](guides/CANVAS_TYPE_EXTENSION_GUIDE.md) | Extend canvas types |
| [`guides/WIDGET_PUBLISHING_GUIDE.md`](guides/WIDGET_PUBLISHING_GUIDE.md) | Publish widgets |
| [`guides/MCP_SERVER_GUIDE.md`](guides/MCP_SERVER_GUIDE.md) | MCP server setup |

### API

| Document | Purpose |
|----------|---------|
| [`api/API_REFERENCE_INDEX.md`](api/API_REFERENCE_INDEX.md) | API documentation index |
| [`ENVIRONMENT_CONFIGURATION.md`](ENVIRONMENT_CONFIGURATION.md) | Backend config & env vars |

### Research

| Document | Purpose |
|----------|---------|
| [`research/universal-patterns/`](research/universal-patterns/) | 10 distributed systems patterns |
| [`research/INDEX.md`](research/INDEX.md) | Research hub |

---

## By Domain

### TypeScript Core (`src/`)

| Document | Purpose |
|----------|---------|
| [`ARCHITECTURE.md`](../ARCHITECTURE.md) | System design |
| [`STATUS.md`](STATUS.md) | Implementation status |
| [`api/API_REFERENCE_INDEX.md`](api/API_REFERENCE_INDEX.md) | API reference |

### Python Memory System (`memory_system/`)

| Document | Purpose |
|----------|---------|
| [`memory_system/README.md`](../memory_system/README.md) | Package documentation |
| [`FIREPROOF_INTEGRATION_PROPOSAL.md`](FIREPROOF_INTEGRATION_PROPOSAL.md) | Fireproof architecture |

### Canvas System (`src/canvas/`)

| Document | Purpose |
|----------|---------|
| [`guides/WIDGET_DEVELOPER_GUIDE.md`](guides/WIDGET_DEVELOPER_GUIDE.md) | Widget development |
| [`guides/CANVAS_TYPE_EXTENSION_GUIDE.md`](guides/CANVAS_TYPE_EXTENSION_GUIDE.md) | Canvas extension |
| [`CANVAS_DEVELOPMENT_PROTOCOL.md`](CANVAS_DEVELOPMENT_PROTOCOL.md) | Development workflow |

---

## By Audience

### Developers

1. [`STATUS.md`](STATUS.md) — Current state and known gaps
2. [`ARCHITECTURE.md`](../ARCHITECTURE.md) — System design
3. [`memory_system/README.md`](../memory_system/README.md) — Python package
4. [`guides/WIDGET_DEVELOPER_GUIDE.md`](guides/WIDGET_DEVELOPER_GUIDE.md) — Canvas development

### Architects

1. [`ARCHITECTURE.md`](../ARCHITECTURE.md) — Full system design
2. [`architecture/EXTENSIBILITY_ARCHITECTURE.md`](architecture/EXTENSIBILITY_ARCHITECTURE.md) — Extension contracts, Web3
3. [`CHRYSALIS_SHARED_MEMORY_ARCHITECTURE.md`](CHRYSALIS_SHARED_MEMORY_ARCHITECTURE.md) — CRDT memory design
4. [`guides/WIDGET_DEVELOPER_GUIDE.md`](guides/WIDGET_DEVELOPER_GUIDE.md) — Canvas architecture
5. [`research/universal-patterns/`](research/universal-patterns/) — Research foundation

### Operations

1. [`CONFIGURATION.md`](CONFIGURATION.md) — Environment variables
2. [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) — Deployment options

---

## Document Lifecycle

### Active Documents

Documents in `docs/` (except `archive/`) are **active** and reflect current implementation.

### Archived Documents

Historical documents are moved to `docs/archive/` with:
- Flat structure (no nested date folders)
- Clear indication of archived status
- Original date in filename or content

See [`archive/README.md`](archive/README.md) for archive contents.

---

## Maintenance

| Area | Owner | Review |
|------|-------|--------|
| STATUS.md | Core Team | Weekly |
| ARCHITECTURE.md | Core Team | Monthly |
| UI docs | UI Team | Weekly |
| API docs | API Team | On change |
| Guides | Documentation Team | Quarterly |

---

## External Resources

- [Mermaid](https://mermaid.js.org/) — Diagram syntax
- [MCP Protocol](https://modelcontextprotocol.io/) — Model Context Protocol
- [React Flow](https://reactflow.dev/) — Canvas library
- [YJS](https://yjs.dev/) — CRDT sync library

---

**Navigation**: [Home](../README.md) | [Architecture](../ARCHITECTURE.md) | [Status](STATUS.md)
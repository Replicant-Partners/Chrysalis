# Chrysalis Documentation Index

**Last Updated**: January 15, 2026  
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
| Understand UI architecture | [`ui/docs/CHRYSALIS_TERMINAL_ARCHITECTURE.md`](../ui/docs/CHRYSALIS_TERMINAL_ARCHITECTURE.md) |
| Get started quickly | [`guides/QUICK_START.md`](guides/QUICK_START.md) |
| Configure the system | [`CONFIGURATION.md`](CONFIGURATION.md) |
| Use the memory system | [`memory_system/README.md`](../memory_system/README.md) |
| Develop UI components | [`ui/docs/guides/DEVELOPMENT.md`](../ui/docs/guides/DEVELOPMENT.md) |

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

ui/docs/                     # UI-specific documentation
├── CHRYSALIS_TERMINAL_ARCHITECTURE.md  # UI system architecture
├── CANVAS_SYSTEM_USAGE_GUIDE.md        # Canvas developer guide
├── architecture/            # UI component architecture
├── guides/                  # UI development guides
└── archive/                 # UI historical docs
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
| [`ui/docs/CHRYSALIS_TERMINAL_ARCHITECTURE.md`](../ui/docs/CHRYSALIS_TERMINAL_ARCHITECTURE.md) | UI system design |
| [`ui/docs/architecture/COMPONENT_ARCHITECTURE.md`](../ui/docs/architecture/COMPONENT_ARCHITECTURE.md) | UI component structure |
| [`memory_system/README.md`](../memory_system/README.md) | Python memory system |

### Guides

| Document | Purpose |
|----------|---------|
| [`guides/QUICK_START.md`](guides/QUICK_START.md) | Get running in 15 minutes |
| [`CONFIGURATION.md`](CONFIGURATION.md) | Environment variables |
| [`ui/docs/guides/DEVELOPMENT.md`](../ui/docs/guides/DEVELOPMENT.md) | UI development workflow |
| [`ui/docs/CANVAS_SYSTEM_USAGE_GUIDE.md`](../ui/docs/CANVAS_SYSTEM_USAGE_GUIDE.md) | Canvas implementation guide |

### API

| Document | Purpose |
|----------|---------|
| [`api/API_REFERENCE_INDEX.md`](api/API_REFERENCE_INDEX.md) | API documentation index |
| [`ui/docs/api/BACKEND_INTEGRATION.md`](../ui/docs/api/BACKEND_INTEGRATION.md) | UI-backend integration |

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

### UI (`ui/`)

| Document | Purpose |
|----------|---------|
| [`ui/docs/CHRYSALIS_TERMINAL_ARCHITECTURE.md`](../ui/docs/CHRYSALIS_TERMINAL_ARCHITECTURE.md) | UI architecture |
| [`ui/docs/CANVAS_SYSTEM_USAGE_GUIDE.md`](../ui/docs/CANVAS_SYSTEM_USAGE_GUIDE.md) | Canvas guide |
| [`ui/docs/guides/DEVELOPMENT.md`](../ui/docs/guides/DEVELOPMENT.md) | Development guide |

---

## By Audience

### Developers

1. [`STATUS.md`](STATUS.md) — Current state and known gaps
2. [`ARCHITECTURE.md`](../ARCHITECTURE.md) — System design
3. [`memory_system/README.md`](../memory_system/README.md) — Python package
4. [`ui/docs/guides/DEVELOPMENT.md`](../ui/docs/guides/DEVELOPMENT.md) — UI development

### Architects

1. [`ARCHITECTURE.md`](../ARCHITECTURE.md) — Full system design
2. [`ui/docs/CHRYSALIS_TERMINAL_ARCHITECTURE.md`](../ui/docs/CHRYSALIS_TERMINAL_ARCHITECTURE.md) — UI architecture
3. [`research/universal-patterns/`](research/universal-patterns/) — Research foundation

### Operations

1. [`CONFIGURATION.md`](CONFIGURATION.md) — Environment variables
2. [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) — Deployment options

---

## Document Lifecycle

### Active Documents

Documents in `docs/` (except `archive/`) and `ui/docs/` (except `archive/`) are **active** and reflect current implementation.

### Archived Documents

Historical documents are moved to `docs/archive/` or `ui/docs/archive/` with:
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
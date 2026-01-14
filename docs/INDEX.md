# Chrysalis Documentation Index

**Last Updated**: January 13, 2026  
**Status**: Active

---

## Navigation Hub

This index is the central navigation point for all Chrysalis documentation.

---

## Quick Links

| I want to... | Go to... |
|--------------|----------|
| Check current status | [STATUS.md](STATUS.md) |
| Understand the architecture | [ARCHITECTURE.md](../ARCHITECTURE.md) |
| Get started quickly | [guides/QUICK_START.md](guides/QUICK_START.md) |
| Configure the system | [CONFIGURATION.md](CONFIGURATION.md) |
| Troubleshoot issues | [guides/TROUBLESHOOTING.md](guides/TROUBLESHOOTING.md) |
| Use the memory system | [memory_system/README.md](../memory_system/README.md) |

---

## Documentation Structure

```
docs/
├── INDEX.md                 # This file - navigation hub
├── STATUS.md                # Single source of truth for status
├── README.md                # Documentation overview
│
├── architecture/            # Architecture deep-dives
│   ├── overview.md
│   ├── memory-system.md
│   └── universal-patterns.md
│
├── api/                     # API documentation
│   ├── API_REFERENCE_INDEX.md
│   └── openapi/
│
├── guides/                  # How-to guides
│   ├── QUICK_START.md       # Canonical quickstart (Python + TS)
│   └── TROUBLESHOOTING.md
│
├── current/                 # Active specifications
│   └── UNIFIED_SPEC_V3.1.md
│
├── personas/                # AI persona prompt templates
│   └── *.md
│
├── research/                # Research foundation
│   └── universal-patterns/
│
├── adr/                     # Architecture Decision Records
│   └── ADR-*.md
│
└── archive/                 # Historical documentation (36 docs)
    ├── phases/              # Phase completion reports
    ├── quickstarts/         # Legacy quickstart guides
    ├── remediation/         # Code review remediation docs
    ├── reports/             # Dated audit and analysis reports
    └── sessions/            # Session handoff documents
```

---

## Core Documentation

### Status & Implementation

| Document | Purpose | Authority |
|----------|---------|-----------|
| **[STATUS.md](STATUS.md)** | Current build state, test results, next steps | **Authoritative** |
| **[ARCHITECTURE.md](../ARCHITECTURE.md)** | System design and component architecture | **Authoritative** |

### Getting Started

| Document | Purpose |
|----------|---------|
| [QUICK_START.md](guides/QUICK_START.md) | Get running in 15 minutes |
| [CONFIGURATION.md](CONFIGURATION.md) | Environment and configuration |
| [TROUBLESHOOTING.md](guides/TROUBLESHOOTING.md) | Problem resolution |

### Architecture

| Document | Purpose |
|----------|---------|
| [Architecture Overview](architecture/overview.md) | High-level system design |
| [Memory System](architecture/memory-system.md) | Memory layer architecture |
| [Universal Patterns](architecture/universal-patterns.md) | 10 distributed patterns |

### API

| Document | Purpose |
|----------|---------|
| [API Reference Index](api/API_REFERENCE_INDEX.md) | Complete API documentation |
| [Authentication](api/AUTHENTICATION.md) | Auth documentation |
| [OpenAPI Specs](api/openapi/) | OpenAPI definitions |

### Technology Assessments

| Document | Purpose | Date |
|----------|---------|------|
| [Canvas & Visual Programming](technology-assessments/canvas-visual-programming-assessment.md) | Comprehensive evaluation of 8 canvas libraries (React Flow recommended) | 2026-01-14 |
| [React Flow Integration Guide](technology-assessments/react-flow-integration-guide.md) | Practical implementation guide for React Flow canvas | 2026-01-14 |

### Specifications

| Document | Purpose |
|----------|---------|
| [Unified Spec v3.1](current/UNIFIED_SPEC_V3.1.md) | Complete technical specification |
| [Sanitization Policy](current/SANITIZATION_POLICY.md) | Input validation rules |
| [MCP Setup](current/MCP_SETUP.md) | MCP configuration |

### Research

| Area | Purpose |
|------|---------|
| [Universal Patterns](research/universal-patterns/) | 10 distributed systems patterns |
| [Research Index](research/INDEX.md) | Research documentation hub |

---

## By Audience

### Developers

1. [STATUS.md](STATUS.md) - Current state and known issues
2. [ARCHITECTURE.md](../ARCHITECTURE.md) - System design
3. [Memory System](../memory_system/README.md) - Python package
4. [API Reference](api/API_REFERENCE_INDEX.md) - API documentation

### Architects

1. [Architecture Specification](../ARCHITECTURE.md) - Full system design
2. [Unified Spec v3.1](current/UNIFIED_SPEC_V3.1.md) - Technical specification
3. [Universal Patterns](research/universal-patterns/) - Research foundation

### Operations

1. [Configuration](CONFIGURATION.md) - Environment variables
2. [Deployment Guide](DEPLOYMENT_GUIDE.md) - Deployment options

---

## Document Lifecycle

### Active Documents

Documents in `docs/` root and subdirectories (except `archive/`) are **active** and reflect current implementation.

### Archived Documents

Historical documents are moved to `docs/archive/` with:
- Clear "ARCHIVED" label
- Date of archival
- Reason for archival
- Pointer to superseding document

See [archive/README.md](archive/README.md) for archive contents.

---

## Maintenance

| Area | Owner | Review |
|------|-------|--------|
| STATUS.md | Core Team | Weekly |
| ARCHITECTURE.md | Core Team | Monthly |
| API docs | API Team | On change |
| Guides | Documentation Team | Quarterly |

---

## External Resources

- [JSON Schema](https://json-schema.org/) - Data validation
- [Mermaid](https://mermaid.js.org/) - Diagram syntax
- [MCP Protocol](https://modelcontextprotocol.io/) - Model Context Protocol

---

**Navigation**: [Home](../README.md) | [Architecture](../ARCHITECTURE.md) | [Status](STATUS.md)
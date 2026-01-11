# Chrysalis Documentation Index

**Version**: 2.0.0  
**Last Updated**: January 11, 2026  
**Status**: Active

---

## Navigation Hub

This index serves as the central navigation point for all Chrysalis documentation. Documents are organized by purpose and audience.

---

## Quick Links

| I want to... | Go to... |
|--------------|----------|
| Get started quickly | [Quick Start Guide](guides/QUICK_START.md) |
| Check implementation status | [Implementation Status](IMPLEMENTATION_STATUS.md) |
| Understand the architecture | [Architecture](../ARCHITECTURE.md) |
| Configure the system | [Configuration](CONFIGURATION.md) |
| Troubleshoot issues | [Troubleshooting](guides/TROUBLESHOOTING.md) |
| Contribute to the project | [Contributing](../CONTRIBUTING.md) |

---

## Documentation Structure

```
docs/
├── INDEX.md                    # This file - navigation hub
├── IMPLEMENTATION_STATUS.md    # Authoritative status (single source of truth)
├── DOCUMENTATION_INVENTORY.md  # Complete audit of all documentation
│
├── getting-started/            # New user documentation
│   └── ...
│
├── guides/                     # How-to guides
│   ├── QUICK_START.md          # Getting started guide
│   └── TROUBLESHOOTING.md      # Problem resolution
│
├── api/                        # API documentation
│   ├── README.md               # API overview
│   ├── API_REFERENCE_INDEX.md  # Complete API reference
│   └── AUTHENTICATION.md       # Auth documentation
│
├── architecture/               # Architecture details
│   ├── memory-system.md        # Memory architecture
│   └── universal-patterns.md   # Pattern documentation
│
├── current/                    # Active specifications
│   ├── UNIFIED_SPEC_V3.1.md    # Technical specification
│   ├── DOCUMENTATION_STANDARDS.md
│   └── ...
│
├── research/                   # Research foundation
│   ├── INDEX.md                # Research index
│   ├── universal-patterns/     # Pattern research
│   └── deep-research/          # Deep dive research
│
├── quality/                    # Quality documentation
│   └── ...
│
└── archive/                    # Historical documentation
    ├── README.md               # Archive index
    └── [dated directories]     # Organized by date
```

---

## By Audience

### For New Users

1. **[Quick Start Guide](guides/QUICK_START.md)** - Get running in 15 minutes
2. **[Configuration](CONFIGURATION.md)** - Environment setup
3. **[Troubleshooting](guides/TROUBLESHOOTING.md)** - Common issues

### For Developers

1. **[Implementation Status](IMPLEMENTATION_STATUS.md)** - Current state and known issues
2. **[Architecture](../ARCHITECTURE.md)** - System design
3. **[API Reference](api/API_REFERENCE_INDEX.md)** - Complete API documentation
4. **[Data Models](DATA_MODELS.md)** - Data structures and schemas
5. **[Contributing](../CONTRIBUTING.md)** - How to contribute

### For Architects

1. **[Architecture Specification](../ARCHITECTURE.md)** - Full system design
2. **[Unified Specification v3.1](current/UNIFIED_SPEC_V3.1.md)** - Technical specification
3. **[Universal Patterns](research/universal-patterns/)** - Research foundation
4. **[Memory System](architecture/memory-system.md)** - Memory architecture

### For Operations

1. **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - Deployment options
2. **[Configuration](CONFIGURATION.md)** - Environment variables
3. **[Observability Guide](current/OBSERVABILITY_GUIDE.md)** - Voyeur and metrics

---

## Core Documentation

### Implementation & Status

| Document | Purpose | Authority |
|----------|---------|-----------|
| **[Implementation Status](IMPLEMENTATION_STATUS.md)** | Current build state, known issues | **Authoritative** |
| **[Documentation Inventory](DOCUMENTATION_INVENTORY.md)** | Complete documentation audit | Reference |

### Architecture

| Document | Purpose | Authority |
|----------|---------|-----------|
| **[Architecture](../ARCHITECTURE.md)** | System design, components, data flow | **Authoritative** |
| **[Memory System](architecture/memory-system.md)** | Memory architecture details | Reference |
| **[Universal Patterns](architecture/universal-patterns.md)** | Pattern documentation | Reference |

### API

| Document | Purpose | Authority |
|----------|---------|-----------|
| **[API Reference Index](api/API_REFERENCE_INDEX.md)** | Complete API documentation | Reference |
| **[API Documentation](API.md)** | API overview | Reference |
| **[Authentication](api/AUTHENTICATION.md)** | Auth documentation | Reference |

### Guides

| Document | Purpose | Authority |
|----------|---------|-----------|
| **[Quick Start](guides/QUICK_START.md)** | Getting started | Reference |
| **[Troubleshooting](guides/TROUBLESHOOTING.md)** | Problem resolution | Reference |
| **[Configuration](CONFIGURATION.md)** | Environment setup | Reference |

---

## Research Documentation

The research directory contains foundational research that informs the architecture:

| Area | Contents |
|------|----------|
| **[Universal Patterns](research/universal-patterns/)** | 10 distributed systems patterns (Hash, DAG, CRDT, etc.) |
| **[Deep Research](research/deep-research/)** | Extended analysis and mathematical foundations |
| **[Agent Specifications](research/agent-spec/)** | Agent format research |

---

## Specifications

Active specifications defining the system:

| Specification | Purpose |
|---------------|---------|
| **[Unified Spec v3.1](current/UNIFIED_SPEC_V3.1.md)** | Complete technical specification |
| **[Documentation Standards](current/DOCUMENTATION_STANDARDS.md)** | Documentation requirements |
| **[Sanitization Policy](current/SANITIZATION_POLICY.md)** | Input validation rules |
| **[Vector Index Setup](current/VECTOR_INDEX_SETUP.md)** | Vector database configuration |

---

## Archive

Historical documentation is preserved in the [archive](archive/) directory:

- **Organized by date**: `2026-01-*` directories
- **Clearly labeled**: All archived content marked as non-current
- **Reference only**: Do not use for current development

See [Archive README](archive/README.md) for the complete archive index.

---

## Documentation Standards

All documentation follows these principles:

1. **Code is Ground Truth**: Documentation reflects actual implementation
2. **Single Source of Truth**: One authoritative document per topic
3. **Mermaid Diagrams**: Visual representations where helpful
4. **Citations**: External references for design decisions
5. **Versioned**: Last-updated timestamps on all documents

See [Documentation Standards](current/DOCUMENTATION_STANDARDS.md) for full guidelines.

---

## Maintenance

### Document Ownership

| Area | Owner |
|------|-------|
| Root docs (README, ARCHITECTURE) | Core Team |
| Implementation Status | Core Team |
| API Documentation | API Team |
| Research | Research Team |

### Review Cadence

| Document Type | Review Frequency |
|---------------|------------------|
| Implementation Status | Weekly |
| Architecture | Monthly |
| API Reference | On API changes |
| Guides | Quarterly |

---

## External Resources

### Standards

- [JSON Schema](https://json-schema.org/) - Data validation
- [Schema.org](https://schema.org/) - Structured data vocabulary
- [Mermaid](https://mermaid.js.org/) - Diagram syntax
- [Semantic Versioning](https://semver.org/) - Version numbering

### Related Technologies

- [MCP Protocol](https://modelcontextprotocol.io/) - Model Context Protocol
- [LanceDB](https://lancedb.github.io/lancedb/) - Vector database
- [Voyage AI](https://docs.voyageai.com/) - Embedding provider

---

## Getting Help

1. **Check Documentation**: Search this index first
2. **Troubleshooting**: See [Troubleshooting Guide](guides/TROUBLESHOOTING.md)
3. **GitHub Issues**: Report bugs or request features
4. **Contributing**: See [Contributing Guide](../CONTRIBUTING.md)

---

**Navigation**: [Home](../README.md) | [Architecture](../ARCHITECTURE.md) | [Status](IMPLEMENTATION_STATUS.md) | [Archive](archive/README.md)
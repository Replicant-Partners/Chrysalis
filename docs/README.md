# Chrysalis Documentation

**Version**: 1.1.0
**Last Updated**: January 11, 2026
**Status**: Phase 1 Consolidation Complete

Welcome to the Chrysalis documentation. This page serves as the central navigation hub for all documentation resources.

> **Recent Updates** (2026-01-11):
> - ✅ Status documentation consolidated into [`docs/current/STATUS.md`](current/STATUS.md)
> - ✅ Documentation cross-references validated and updated
> - ✅ Archive structure enhanced with `legacy/` directory
> - ✅ Link validation report generated

## 🚀 Getting Started

New to Chrysalis? Start here:

1. **[Quick Start Guide](guides/QUICK_START.md)** ⭐
   - Get up and running in 15 minutes
   - Process your first legend
   - Verify semantic merging

2. **[Configuration Guide](CONFIGURATION.md)**
   - Environment variables
   - API keys and providers
   - Component configuration

3. **[Troubleshooting](guides/TROUBLESHOOTING.md)**
   - Common issues and solutions
   - Debugging techniques
   - Getting help

## 📚 Core Documentation

### System Architecture

- **[Architecture Overview](../ARCHITECTURE.md)**
  - System design and components
  - Data flow and processing
  - Integration points

### API Reference

- **[API Documentation](API.md)**
  - Memory System API
  - KnowledgeBuilder API
  - SkillBuilder API
  - Semantic Merge API
  - Data contracts and error handling

### Data and Configuration

- **[Data Models](DATA_MODELS.md)**
  - Memory entries and schemas
  - Knowledge and skill structures
  - Consolidated file formats
  - ER diagrams and validation

- **[Configuration Guide](CONFIGURATION.md)**
  - Environment variables (20+ documented)
  - Configuration files
  - Provider setup (Voyage AI, OpenAI, Deterministic)
  - Examples and troubleshooting

### Development

- **[Development Guide](DEVELOPMENT.md)** (Coming Soon)
  - Development workflow
  - Testing strategy
  - Code standards
  - Contributing guidelines

- **[Deployment Guide](DEPLOYMENT.md)** (Coming Soon)
  - Deployment options
  - Production configuration
  - Monitoring and maintenance

## 🎯 Features

Detailed documentation for major features:

### Semantic Merge

- **[Semantic Merge Feature](features/SEMANTIC_MERGE.md)** ⭐
  - Incremental learning system
  - Cosine similarity-based merging
  - Weighted averaging (60/40)
  - Architecture diagrams
  - Usage examples
  - Performance metrics

### Memory System

- **[Memory System](features/MEMORY_SYSTEM.md)** (Coming Soon)
  - Semantic memory with vector embeddings
  - Storage and retrieval
  - Consolidation and forgetting

### KnowledgeBuilder

- **[KnowledgeBuilder](features/KNOWLEDGE_BUILDER.md)** (Coming Soon)
  - Knowledge extraction pipeline
  - Data collectors (Tavily, Exa, Brave, Firecrawl)
  - Ground truth establishment
  - Conflict resolution

### SkillBuilder

- **[SkillBuilder](features/SKILL_BUILDER.md)** (Coming Soon)
  - Skill extraction system
  - Descriptor strategies
  - CLI and Python API

### Vector Embeddings

- **[Vector Embedding Best Practices](features/VECTOR_EMBEDDINGS.md)**
  - Embedding providers
  - Dimension considerations
  - Performance optimization

## 📖 Guides

Step-by-step guides for common tasks:

### User Guides

- **[Quick Start](guides/QUICK_START.md)** - 15-minute setup
- **[Troubleshooting](guides/TROUBLESHOOTING.md)** - Problem solving
- **[Performance Tuning](guides/PERFORMANCE.md)** (Coming Soon)

### Developer Guides

- **[Contributing](../CONTRIBUTING.md)** - How to contribute
- **[Testing Guide](processes/TESTING.md)** (Coming Soon)
- **[Code Review Process](processes/CODE_REVIEW.md)** (Coming Soon)

## 🔧 Processes

Development processes and workflows:

- **[Code Review](processes/CODE_REVIEW.md)** (Coming Soon)
  - Review checklist
  - Standards and best practices
  - Approval process

- **[Testing Strategy](processes/TESTING.md)** (Coming Soon)
  - Unit testing
  - Integration testing
  - End-to-end testing

- **[Deployment Checklist](processes/DEPLOYMENT_CHECKLIST.md)** (Coming Soon)
  - Pre-deployment checks
  - Deployment steps
  - Post-deployment validation

## 📦 Projects

Project-specific documentation:

### KnowledgeBuilder

- **[KnowledgeBuilder README](../projects/KnowledgeBuilder/README.md)**
- **[KnowledgeBuilder Architecture](../projects/KnowledgeBuilder/ARCHITECTURE.md)**
- **[Implementation Guide](../projects/KnowledgeBuilder/IMPLEMENTATION.md)**
- **[Data Sources](../projects/KnowledgeBuilder/DATA_SOURCES.md)**
- **[Tool Assessment](../projects/KnowledgeBuilder/TOOL_ASSESSMENT.md)**

### SkillBuilder

- **[SkillBuilder README](../projects/SkillBuilder/README.md)**
- **[SkillBuilder Documentation](../projects/SkillBuilder/docs/README.md)**
- **[Status](../projects/SkillBuilder/docs/status.md)**
- **[Audit](../projects/SkillBuilder/docs/audit.md)**

### Memory System

- **[Memory System README](../memory_system/README.md)**

## 🗂️ Archive

Historical documentation and completed work:

- **[Archive Index](archive/README.md)**
  - Semantic Merge Implementation (January 2026)
  - KnowledgeBuilder Code Review (December 2025)
  - Historical Plans

## 📋 Documentation Standards

Guidelines for maintaining documentation:

- **[Documentation Standards](STANDARDS.md)**
  - Diagram requirement (Mermaid)
  - Provenance requirement (citations)
  - Forward-looking requirement (present-tense)
  - Structure and formatting
  - Maintenance guidelines

## 🔍 Quick Reference

### Common Tasks

| Task | Documentation |
|------|---------------|
| Install Chrysalis | [Quick Start](guides/QUICK_START.md#step-1-clone-repository) |
| Configure API keys | [Quick Start](guides/QUICK_START.md#step-3-configure-api-keys) |
| Process a legend | [Quick Start](guides/QUICK_START.md#step-4-process-your-first-legend) |
| Fix dimension mismatch | [Troubleshooting](guides/TROUBLESHOOTING.md#lancedb-dimension-mismatch) |
| Handle rate limits | [Troubleshooting](guides/TROUBLESHOOTING.md#rate-limit-exceeded) |
| Use Memory System API | [API Docs](API.md#memory-system-api) |
| Configure providers | [Configuration](CONFIGURATION.md#provider-configuration) |
| Validate data | [Data Models](DATA_MODELS.md#schema-validation) |

### By Role

**For Users**:
1. [Quick Start](guides/QUICK_START.md)
2. [Configuration](CONFIGURATION.md)
3. [Troubleshooting](guides/TROUBLESHOOTING.md)

**For Developers**:
1. [API Documentation](API.md)
2. [Data Models](DATA_MODELS.md)
3. [Architecture](../ARCHITECTURE.md)
4. [Contributing](../CONTRIBUTING.md)

**For Operators**:
1. [Configuration](CONFIGURATION.md)
2. [Deployment](DEPLOYMENT.md) (Coming Soon)
3. [Troubleshooting](guides/TROUBLESHOOTING.md)

## 📊 Documentation Status

### Completed ✅

- [x] Documentation inventory and assessment
- [x] Documentation cleanup plan
- [x] API documentation
- [x] Configuration guide
- [x] Data models
- [x] Quick start guide
- [x] Troubleshooting guide
- [x] Semantic merge feature docs
- [x] Navigation hub (this page)
- [x] Archive organization

### In Progress ⏳

- [ ] Root README update
- [ ] Root ARCHITECTURE update
- [ ] Feature documentation (Memory, KB, SB)
- [ ] Process documentation
- [ ] Development guide
- [ ] Deployment guide

### Planned 📅

- [ ] Performance guide
- [ ] Security guide
- [ ] API versioning guide
- [ ] Migration guides

## 🔗 External Resources

### Standards and Specifications

- [JSON Schema](https://json-schema.org/) - Data validation
- [Schema.org](https://schema.org/) - Structured data vocabulary
- [Mermaid](https://mermaid.js.org/) - Diagram syntax
- [Semantic Versioning](https://semver.org/) - Version numbering

### Embedding Providers

- [Voyage AI Documentation](https://docs.voyageai.com/)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [Vector Embeddings Overview](https://www.pinecone.io/learn/vector-embeddings/)

### Vector Databases

- [LanceDB Documentation](https://lancedb.github.io/lancedb/)
- [Vector Database Concepts](https://www.pinecone.io/learn/vector-database/)

### Design Patterns

- [Strategy Pattern](https://refactoring.guru/design-patterns/strategy)
- [Template Method Pattern](https://refactoring.guru/design-patterns/template-method)

## 🤝 Contributing to Documentation

We welcome documentation improvements! See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

### Documentation Principles

1. **Diagram Everything**: Use Mermaid for flows, architectures, data models
2. **Cite Sources**: Link to external standards, papers, vendor docs
3. **Forward-Looking**: Keep docs present-tense and enabling
4. **Single Source of Truth**: One authoritative document per topic
5. **Code is Ground Truth**: Documentation reflects actual implementation

### How to Contribute

1. **Report Issues**: [GitHub Issues](https://github.com/your-org/Chrysalis/issues)
2. **Suggest Improvements**: [GitHub Discussions](https://github.com/your-org/Chrysalis/discussions)
3. **Submit Pull Requests**: Follow [CONTRIBUTING.md](../CONTRIBUTING.md)

## 📞 Getting Help

### Documentation

- **Search**: Use Ctrl+F or search GitHub
- **Index**: This page (docs/README.md)
- **Archive**: [archive/README.md](archive/README.md)

### Support

- **GitHub Issues**: [Report bugs](https://github.com/your-org/Chrysalis/issues)
- **Discussions**: [Ask questions](https://github.com/your-org/Chrysalis/discussions)
- **Troubleshooting**: [Common issues](guides/TROUBLESHOOTING.md)

## 📝 Maintenance

### Last Updated

**Date**: January 9, 2026  
**Version**: 1.0.0  
**Maintainer**: Chrysalis Team

### Update Frequency

- **Core Docs**: Updated with code changes
- **API Docs**: Updated with API changes
- **Guides**: Reviewed quarterly
- **Archive**: Updated as needed

### Feedback

Found an issue with the documentation? Please:
1. Check [Troubleshooting](guides/TROUBLESHOOTING.md)
2. Search [GitHub Issues](https://github.com/your-org/Chrysalis/issues)
3. [Report a new issue](https://github.com/your-org/Chrysalis/issues/new)

---

**Navigation**: [Home](../README.md) | [Architecture](../ARCHITECTURE.md) | [Contributing](../CONTRIBUTING.md) | [Changelog](../CHANGELOG.md)

**Quick Links**: [Quick Start](guides/QUICK_START.md) | [API](API.md) | [Configuration](CONFIGURATION.md) | [Troubleshooting](guides/TROUBLESHOOTING.md)

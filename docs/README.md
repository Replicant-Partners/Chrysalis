# Chrysalis Documentation

**Navigation Hub** | **Version**: 3.1.0 | **Status**: Active

---

## Documentation Structure

```
docs/
├── current/          # Active specifications and guides
├── research/         # Research foundation
├── archive/          # Historical versions (v1, v2, deprecated)
├── diagrams/         # Mermaid diagrams
└── index.md          # Master navigation
```

---

## Quick Navigation

### 🎯 Start Here

| Document | Purpose | Time |
|----------|---------|------|
| **[Unified Spec v3.1](current/UNIFIED_SPEC_V3.1.md)** | Complete system specification | 2 hours |
| **[Quick Start](../QUICK_START.md)** | Get started in 10 minutes | 10 min |
| **[Architecture](../ARCHITECTURE.md)** | System design overview | 30 min |

### 📐 Current Specifications (v3.1)

**Core Specs**:
- **[UNIFIED_SPEC_V3.1.md](current/UNIFIED_SPEC_V3.1.md)** - Complete v3.1 specification
- **[FOUNDATION_SPEC.md](current/FOUNDATION_SPEC.md)** - Pattern foundations
- **[ANALYSIS.md](current/ANALYSIS.md)** - Rigorous system analysis
- **[SYNTHESIS.md](current/SYNTHESIS.md)** - Design insights

**Subsystem Docs**:
- **[Memory System](current/memory/)** - Memory architecture and implementation
- **[MCP Setup](current/MCP_SETUP.md)** - MCP server configuration
- **[Implementation Guide](current/IMPLEMENTATION_GUIDE.md)** - How to implement
- **[Uniform Semantic Agent Lexicon](current/UNIVERSAL_AGENT_LEXICON.md)** - Core terms, OODA, emoji mode

### 🔬 Research Foundation

**Universal Patterns**:
- **[PATTERNS.md](research/universal-patterns/PATTERNS.md)** - 10 universal patterns
- **[PATTERNS_ANCHORED.md](research/universal-patterns/PATTERNS_ANCHORED.md)** - Evidence validation

**Deep Research**:
- **[MATHEMATICAL_FOUNDATIONS.md](research/deep-research/MATHEMATICAL_FOUNDATIONS.md)** - Virtual voting, DAG
- **[SECURITY_ATTACKS.md](research/deep-research/SECURITY_ATTACKS.md)** - Attack vectors & defenses
- **[GOSSIP_PROTOCOLS.md](research/deep-research/GOSSIP_PROTOCOLS.md)** - Epidemic spreading
- **[SYNTHESIS.md](research/deep-research/SYNTHESIS.md)** - Meta-insights

**Agent Research**:
- **[AgentSpecResearch.md](research/agent-spec/AgentSpecResearch.md)** - Agent architecture research
- **[MemoryResearch.md](research/agent-spec/MemoryResearch.md)** - Memory system research

### 📚 Historical Archive

**Version 2** (Superseded by v3.1):
- **[archive/v2/](archive/v2/)** - V2 specifications and guides

**Version 1** (Original):
- **[archive/v1/](archive/v1/)** - V1 morphing specifications

**Deprecated**:
- **[archive/deprecated/](archive/deprecated/)** - uSA and outdated approaches

---

## Documentation Standards

### File Naming
- `UPPERCASE.md` - Major documents
- `PascalCase.md` - Specific topics
- `kebab-case.md` - Multi-word topics

### Required Sections
1. Header (title, version, date, status)
2. Purpose statement
3. Navigation links
4. Main content
5. Mermaid diagrams (where appropriate)
6. Citations/sources
7. Footer (last updated)

### Status Indicators
- ✅ **Current** - Active, up-to-date
- 🔄 **In Progress** - Being updated
- 📋 **Planned** - Designed, not implemented
- 🗄️ **Archived** - Historical reference
- ⚠️ **Deprecated** - No longer recommended

---

## Finding Information

### By Topic

**Architecture**:
- System overview → [ARCHITECTURE.md](../ARCHITECTURE.md)
- Fractal composition → [UNIFIED_SPEC_V3.1.md](current/UNIFIED_SPEC_V3.1.md#fractal-architecture)
- Deployment models → [UNIFIED_SPEC_V3.1.md](current/UNIFIED_SPEC_V3.1.md#deployment-models)

**Patterns**:
- What are they? → [research/universal-patterns/PATTERNS.md](research/universal-patterns/PATTERNS.md)
- Why these? → [research/universal-patterns/PATTERNS_ANCHORED.md](research/universal-patterns/PATTERNS_ANCHORED.md)
- How implemented? → [FOUNDATION_SPEC.md](current/FOUNDATION_SPEC.md)

**Memory**:
- Architecture → [current/memory/ARCHITECTURE.md](current/memory/ARCHITECTURE.md)
- Implementation → [current/memory/IMPLEMENTATION.md](current/memory/IMPLEMENTATION.md)
- Evolution → [UNIFIED_SPEC_V3.1.md#memory-system](current/UNIFIED_SPEC_V3.1.md#memory-system)

**Security**:
- Model → [UNIFIED_SPEC_V3.1.md#security-architecture](current/UNIFIED_SPEC_V3.1.md#security-architecture)
- Attacks → [research/deep-research/SECURITY_ATTACKS.md](research/deep-research/SECURITY_ATTACKS.md)
- Defenses → [FOUNDATION_SPEC.md#security](current/FOUNDATION_SPEC.md)

### By Use Case

**I want to...**

| Goal | Document |
|------|----------|
| Understand the system | [ARCHITECTURE.md](../ARCHITECTURE.md) |
| Start using it | [QUICK_START.md](../QUICK_START.md) |
| Implement patterns | [IMPLEMENTATION_GUIDE.md](current/IMPLEMENTATION_GUIDE.md) |
| Set up MCP servers | [MCP_SETUP.md](current/MCP_SETUP.md) |
| Understand research | [research/](research/) |
| See examples | [../examples/](../examples/) |
| Review source code | [../src/](../src/) |

---

## Documentation Maintenance

### Update Triggers
- New feature implementation
- API changes
- Architecture decisions
- Bug fixes affecting behavior
- Version releases

### Review Schedule
- **Weekly**: Current specs accuracy check
- **Monthly**: Research relevance review
- **Quarterly**: Archive cleanup
- **Per-release**: Version update

### Contributors
See [../CONTRIBUTING.md](../CONTRIBUTING.md) for documentation contribution guidelines.

---

## Quality Standards

**Accuracy** ✅: Documentation reflects actual implementation  
**Completeness** ✅: All major systems documented  
**Clarity** ✅: Technical terms defined, diagrams support text  
**Maintainability** ✅: Structured for ongoing updates  
**Professionalism** ✅: Consistent formatting and presentation

---

## External Resources

**Research Papers**:
- Hedera Hashgraph whitepaper
- Byzantine fault tolerance literature
- Gossip protocol research

**Related Projects**:
- @noble/hashes - Audited cryptography
- graphlib - Graph operations
- Model Context Protocol (MCP)

**Community**:
- GitHub Issues
- Discussions
- Contributing guidelines

---

**Navigation**: [Root README](../README.md) | [Architecture](../ARCHITECTURE.md) | [Quick Start](../QUICK_START.md)

**Last Updated**: December 28, 2025 | **Maintained By**: Chrysalis Team

🦋 **Comprehensive documentation for rigorous development** 🦋

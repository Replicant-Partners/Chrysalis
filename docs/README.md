# Chrysalis Documentation

**Welcome to the Chrysalis documentation hub.** This is your central navigation point for all project documentation.

---

**📂 Quick Navigation**: [Home](/) > **Documentation**

**Last Updated**: 2026-01-17  
**Maintenance**: Documentation Team | Updated per release  
**Status**: ✅ Current

---

## 🎯 Start Here

New to Chrysalis? Start with these resources:

| Resource | Description | Audience |
|----------|-------------|----------|
| [**Project README**](../README.md) | System overview, quick start, core capabilities | Everyone |
| [**Architecture Overview**](../ARCHITECTURE.md) | System design and component relationships | Developers, Architects |
| [**Implementation Status**](STATUS.md) | **SSOT** for what's implemented vs. planned | Developers, PMs |
| [**Quick Start Guide**](guides/QUICK_START.md) | Get Chrysalis running in 5 minutes | New Users |

---

## 📚 Documentation by Role

### 🧑‍💻 **Developers**

Building with or extending Chrysalis?

- **Getting Started**
  - [Quick Start](guides/QUICK_START.md) — 5-minute installation and first agent
  - [Developer Onboarding](DEVELOPER_ONBOARDING.md) — Comprehensive onboarding
- **How-To Guides**
  - [Adapter Testing Guide](guides/ADAPTER_TESTING_GUIDE.md)
  - [Widget Developer Guide](guides/WIDGET_DEVELOPER_GUIDE.md)
  - [Canvas Type Extension Guide](guides/CANVAS_TYPE_EXTENSION_GUIDE.md)
  - [MCP Server Guide](guides/MCP_SERVER_GUIDE.md)
  - [Task Framework Guide](guides/TASK_FRAMEWORK_GUIDE.md)
- **API Reference**
  - [API Documentation](api/)
  - [Configuration Reference](CONFIGURATION.md)
- **Architecture**
  - [System Overview](architecture/overview.md)
  - [Component Architecture](architecture/)

### 🚀 **Operators**

Deploying and running Chrysalis in production?

- **Deployment**
  - [Deployment Guide](deployment/DEPLOYMENT_GUIDE.md)
  - [Environment Configuration](ENVIRONMENT_CONFIGURATION.md)
- **Operations**
  - [Monitoring](guides/monitoring.md) *(planned)*
  - [Troubleshooting](guides/TROUBLESHOOTING.md)

### 🤖 **AI Agent Integrators**

Connecting AI agents to Chrysalis?

- **Protocol Selection**
  - [MCP Decision Guide](guides/MCP_DECISION_GUIDE.md) — When to use MCP
- **Integration Guides**
  - [MCP Integration](guides/MCP_SERVER_GUIDE.md)
  - [A2A Protocol](a2a-client/) — Agent-to-Agent communication
  - [ACP Integration](architecture/) — Agent Communication Protocol
- **Specifications**
  - [Agent Schema](specs/)
  - [Protocol Specifications](specs/)

### 🏗️ **Architects**

Understanding system design and making architectural decisions?

- **System Design**
  - [Architecture Overview](architecture/overview.md)
  - [C4 Architecture Diagrams](architecture/C4_ARCHITECTURE_DIAGRAMS.md)
  - [Component Boundaries](architecture/)
- **Design Patterns**
  - [Universal Patterns](research/universal-patterns/)
  - [Semantic Mediation Pattern](patterns/SEMANTIC_MEDIATION_PATTERN.md)
- **Decisions**
  - [ADR-001: Service Layer Independence](adr/ADR-001-service-layer-independence.md)

### 🤝 **Contributors**

Contributing to Chrysalis?

- [**Contributing Guidelines**](../CONTRIBUTING.md)
- [Code Quality Standards](quality/)
- [Code Review Checklist](quality/CODE_REVIEW_CHECKLIST.md)
- [Personas](personas/) — AI assistant persona definitions

---

## 📖 Documentation Types

### 🎓 Learning-Oriented

**Tutorials**: Step-by-step lessons for beginners

- [Quick Start](guides/QUICK_START.md)
- [Developer Onboarding](DEVELOPER_ONBOARDING.md)

### 🛠️ Task-Oriented

**How-To Guides**: Recipes for specific tasks

- [Guides Directory](guides/)
- [Adapter Testing](guides/ADAPTER_TESTING_GUIDE.md)
- [Widget Development](guides/WIDGET_DEVELOPER_GUIDE.md)

### 📐 Understanding-Oriented

**Explanations**: Architecture, design, concepts

- [Architecture](architecture/)
- [Research](research/)
- [Patterns](patterns/)

### 📋 Information-Oriented

**Reference**: Technical specifications, API docs

- [API Documentation](api/)
- [Specifications](specs/)
- [Configuration](CONFIGURATION.md)

---

## 🗂️ Browse by Topic

### Core System

| Topic | Description | Location |
|-------|-------------|----------|
| **Semantic Agents** | SemanticAgent design | [architecture/](architecture/) |
| **Framework Adapters** | MCP, A2A, ACP, multi-agent support | [architecture/](architecture/) |
| **Bridge Layer** | Agent translation orchestration | [architecture/](architecture/) |
| **Universal Adapter** | JSON-driven task orchestration (Python) | [architecture/UNIVERSAL_ADAPTER_DESIGN.md](architecture/UNIVERSAL_ADAPTER_DESIGN.md) |

### Memory & Persistence

| Topic | Description | Location |
|-------|-------------|----------|
| **Memory System** | Python-based Fireproof, embeddings, graph | [architecture/memory-system.md](architecture/memory-system.md) |
| **Experience Sync** | Agent learning from deployments | [architecture/experience-sync.md](architecture/experience-sync.md) |

### Integration

| Topic | Description | Location |
|-------|-------------|----------|
| **MCP Protocol** | Model Context Protocol integration | [guides/MCP_SERVER_GUIDE.md](guides/MCP_SERVER_GUIDE.md) |
| **A2A Protocol** | Agent-to-Agent communication | [a2a-client/](a2a-client/) |
| **ACP Bridge** | Agent Communication Protocol | [architecture/](architecture/) |

### UI & Visualization

| Topic | Description | Location |
|-------|-------------|----------|
| **Canvas System** | Multi-canvas visualization | [architecture/](architecture/) |
| **Widget System** | Canvas widget development | [guides/WIDGET_DEVELOPER_GUIDE.md](guides/WIDGET_DEVELOPER_GUIDE.md) |

### Infrastructure

| Topic | Description | Location |
|-------|-------------|----------|
| **Deployment** | Kubernetes, Docker, cloud | [deployment/](deployment/) |
| **Configuration** | Environment variables, settings | [CONFIGURATION.md](CONFIGURATION.md) |
| **Quality Assurance** | Testing, code review, verification | [quality/](quality/) |

---

## 🔬 Research & Background

Understanding the research foundation:

- [**Universal Patterns**](research/universal-patterns/) — 10 validated cryptographic/distributed patterns
- [**Agentic Memory Frameworks**](research/AGENTIC_MEMORY_FRAMEWORKS_2026-01-16.md) — Memory system research
- [**Agent Specification Research**](research/agent-spec/) — Agent schema evolution
- [**Framework Comparisons**](research/) — Letta, OpenInterpreter, OpenHands analysis
- [**Protocol Research**](research/) — ACP, multi-agent CLI studies

---

## 📊 Project Status

**Implementation Status**: See [**STATUS.md**](STATUS.md) ⭐ **SSOT**

**Recent Updates** (as of 2026-01-17):
- ✅ TypeScript core build passing
- ✅ Python memory system operational
- ✅ Framework adapters (MCP, A2A, ACP) implemented
- 🔄 Canvas system prototype complete, integration pending
- 🔄 Universal Adapter (Python) implemented, TypeScript wiring pending

**Known Gaps**: See [Documentation Gap Analysis](DOCUMENTATION_GAP_ANALYSIS_2026-01-16.md)

---

## 🗄️ Historical Documentation

**⚠️ Not Current**: Historical documents are in [`archive/`](archive/)

Archived materials include:
- Session summaries and working notes
- Historical reports and analyses
- Superseded specifications
- Completed project handoffs

See [**Archive Index**](archive/README.md) for temporal context.

---

## 🔍 Finding What You Need

### By Question

| I want to... | Go to... |
|--------------|----------|
| **Get started quickly** | [Quick Start Guide](guides/QUICK_START.md) |
| **Understand the architecture** | [Architecture Overview](architecture/overview.md) |
| **Deploy to production** | [Deployment Guide](deployment/DEPLOYMENT_GUIDE.md) |
| **Build an MCP server** | [MCP Server Guide](guides/MCP_SERVER_GUIDE.md) |
| **Develop a widget** | [Widget Developer Guide](guides/WIDGET_DEVELOPER_GUIDE.md) |
| **Configure environment** | [Configuration Reference](CONFIGURATION.md) |
| **Check implementation status** | [STATUS.md](STATUS.md) |
| **Understand a term** | [Glossary](GLOSSARY.md) *(planned)* |
| **Contribute code** | [Contributing Guidelines](../CONTRIBUTING.md) |
| **Review architecture decisions** | [ADRs](adr/) |

### By Keyword

Use your editor's search or:
```bash
# Search all documentation
grep -r "keyword" docs/

# Search specific type
grep -r "keyword" docs/guides/
grep -r "keyword" docs/architecture/
```

---

## 📝 Documentation Standards

All documentation follows [Documentation Standards](current/DOCUMENTATION_STANDARDS.md).

**Key Principles**:
- **Code is ground truth** — docs describe what exists
- **Single source of truth** — one authoritative doc per topic
- **Timestamped** — last-updated dates on active docs
- **Verified** — code examples tested, links checked
- **Audience-aware** — clear target readers
- **Navigable** — breadcrumbs and clear structure

---

## 🔄 Keeping Documentation Current

**Maintenance Ownership**: See individual documents for owners

**Update Triggers**:
- **Per release**: README, STATUS, deployment guides
- **Per feature**: API docs, guides for new features
- **Per architecture change**: Architecture docs, diagrams
- **Quarterly**: Research summaries, archive index

**Report Issues**: 
- Documentation bugs or stale content → [Open an issue](https://github.com/Replicant-Partners/Chrysalis/issues)
- Broken links, outdated examples → Tag with `documentation`

---

## 🗺️ Documentation Map

```
docs/
├── README.md (this file)           # 📍 You are here
├── STATUS.md                       # ⭐ Implementation status (SSOT)
├── INDEX.md                        # Comprehensive alphabetical index
│
├── guides/                         # 📖 How-to guides
├── architecture/                   # 🏛️ System design docs
├── api/                            # 🔌 API reference
├── specs/                          # 📐 Technical specifications
├── research/                       # 🔬 Research foundation
├── quality/                        # 🎯 Quality assurance
├── deployment/                     # 🚀 Deployment docs
├── personas/                       # 🎭 AI assistant personas
├── patterns/                       # 🔷 Design patterns
├── adr/                            # 📋 Architecture decisions
└── archive/                        # 🗄️ Historical materials
```

**Full Structure**: See [Information Architecture Design](INFORMATION_ARCHITECTURE_DESIGN_2026-01-17.md)

---

## 📬 Getting Help

1. **Check [STATUS.md](STATUS.md)** for implementation status
2. **Search documentation** for your topic
3. **Review [Troubleshooting Guide](guides/TROUBLESHOOTING.md)**
4. **Check [Research](research/)** for background
5. **Ask in discussions** or open an issue

---

## 🎯 Next Steps

**New to Chrysalis?**
1. Read [Project README](../README.md)
2. Follow [Quick Start Guide](guides/QUICK_START.md)
3. Explore [Architecture Overview](architecture/overview.md)
4. Review [STATUS.md](STATUS.md) for what's available

**Ready to develop?**
1. Complete [Developer Onboarding](DEVELOPER_ONBOARDING.md)
2. Review [Contributing Guidelines](../CONTRIBUTING.md)
3. Explore [API Documentation](api/)
4. Check [Code Quality Standards](quality/)

**Deploying?**
1. Review [Deployment Guide](deployment/DEPLOYMENT_GUIDE.md)
2. Configure [Environment](ENVIRONMENT_CONFIGURATION.md)
3. Set up [Monitoring](guides/monitoring.md) *(planned)*
4. Have [Troubleshooting Guide](guides/TROUBLESHOOTING.md) ready

---

**📚 Happy learning and building with Chrysalis!**

---

**Maintained by**: Documentation Team  
**Questions?** Open an issue with the `documentation` label  
**Last comprehensive review**: 2026-01-17

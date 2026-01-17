# Chrysalis Information Architecture Design

**Date**: January 17, 2026  
**Purpose**: Authoritative blueprint for documentation restructuring  
**Audit Basis**: [`AUDIT_REPORT_2026-01-17.json`](AUDIT_REPORT_2026-01-17.json)  
**Status**: 🏗️ Design Complete - Pending Implementation

---

## Executive Summary

This document defines the target information architecture for Chrysalis documentation based on systematic audit of **560 markdown files** across **55 source code categories**. The design establishes clear separation between active operational documentation and historical artifacts, with explicit maintenance ownership and navigational clarity.

**Key Principle**: **Code is authoritative source of truth**—documentation describes what exists, not what is planned.

---

## Design Principles

### 1. Active vs. Historical Separation

**Why?** Prevents confusion between current capabilities and aspirational features. Historical context available through version control, not active docs.

- **Active**: Current system state, maintained docs, verified against codebase
- **Archive**: Completed sessions, superseded specs, historical reports, external project contamination

### 2. Single Source of Truth (SSOT) Pattern

**Why?** Eliminates contradictions, establishes canonical reference for each topic.

- Each technical topic has ONE authoritative document
- Other references link to SSOT, don't duplicate content
- Conflicts resolved by designating one source canonical, archiving duplicates with reconciliation notes

### 3. Audience-Oriented Organization

**Why?** Enables rapid navigation by role and task—developers, operators, AI agent integrators find relevant info quickly.

- **Developer**: Getting started, guides, API docs, architecture deep-dives
- **Operator**: Deployment, configuration, monitoring, troubleshooting
- **AI Agent Integrator**: Protocols, schemas, integration patterns, examples
- **Contributor**: Contributing guidelines, quality standards, ADRs, personas

### 4. Maintenance Transparency

**Why?** Readers know documentation freshness, triggering review when stale.

- Last-updated timestamp on major docs
- Maintenance ownership specified
- Expected update cadence (e.g., "updated per release", "reviewed monthly")
- Staleness markers trigger updates

### 5. Navigational Clarity

**Why?** Users find information without grep or trial-and-error.

- Clear directory structure with self-documenting names
- Directory-level README explaining contained docs
- Comprehensive index with role-based entry points
- No orphaned documents

---

## Target Directory Structure

```
Chrysalis/
├── README.md                         # SSOT: Project overview, quick start, capabilities
├── ARCHITECTURE.md                   # SSOT: System design, verified against code
├── CONTRIBUTING.md                   # SSOT: Contribution guidelines
├── CHANGELOG.md                      # Version history
├── LICENSE                           # Legal
│
├── docs/                             # 📚 All documentation
│   ├── README.md                     # Documentation hub, navigation guide
│   ├── STATUS.md                     # ⭐ SSOT: Implementation status, remaining work
│   ├── GLOSSARY.md                   # Terminology definitions, consistent usage
│   │
│   ├── getting-started/              # 🚀 New user onboarding
│   │   ├── README.md                 # Getting started hub
│   │   ├── quickstart.md             # 5-minute start (verified runnable)
│   │   ├── installation.md           # Detailed setup (all platforms)
│   │   ├── first-agent.md            # Tutorial: Create first agent
│   │   └── examples/                 # Verified code examples
│   │
│   ├── guides/                       # 📖 How-to guides (task-oriented)
│   │   ├── README.md                 # Guides index by category
│   │   ├── developer/                # Developer guides
│   │   │   ├── ADAPTER_TESTING_GUIDE.md
│   │   │   ├── WIDGET_DEVELOPER_GUIDE.md
│   │   │   ├── CANVAS_TYPE_EXTENSION_GUIDE.md
│   │   │   └── MCP_SERVER_GUIDE.md
│   │   ├── operator/                 # Deployment & operations
│   │   │   ├── deployment.md
│   │   │   ├── configuration.md
│   │   │   ├── monitoring.md
│   │   │   └── troubleshooting.md
│   │   └── integration/              # AI agent integration
│   │       ├── protocol-selection.md
│   │       ├── mcp-integration.md
│   │       ├── a2a-integration.md
│   │       └── universal-adapter-usage.md
│   │
│   ├── architecture/                 # 🏛️ System design (understanding-oriented)
│   │   ├── README.md                 # Architecture documentation hub
│   │   ├── overview.md               # High-level system design
│   │   ├── components/               # Component-specific architecture
│   │   │   ├── semantic-agent.md     # UniformSemanticAgentV2 design
│   │   │   ├── bridge-layer.md       # Translation orchestration
│   │   │   ├── adapters.md           # Framework adapter architecture
│   │   │   ├── memory-system.md      # Python memory system (Fireproof, embeddings)
│   │   │   ├── canvas-system.md      # Canvas architecture
│   │   │   ├── experience-sync.md    # Sync protocols
│   │   │   └── universal-adapter.md  # Python task orchestration
│   │   ├── patterns/                 # Architectural patterns
│   │   │   ├── cryptographic-patterns.md   # Hash, signatures, DAG, CRDT, gossip
│   │   │   ├── adapter-pattern.md
│   │   │   ├── repository-pattern.md
│   │   │   └── semantic-mediation.md
│   │   ├── data-flow/                # Data flow diagrams (Mermaid)
│   │   │   ├── agent-transformation-flow.md
│   │   │   ├── experience-sync-flow.md
│   │   │   └── universal-adapter-execution.md
│   │   └── decisions/                # Architectural Decision Records (ADRs)
│   │       └── ADR-001-service-layer-independence.md
│   │
│   ├── api/                          # 🔌 API reference (code-generated when possible)
│   │   ├── README.md                 # API documentation hub
│   │   ├── bridge-rest-api.md        # Bridge REST API endpoints
│   │   ├── a2a-protocol.md           # Agent-to-Agent protocol spec
│   │   ├── mcp-interface.md          # MCP client/server interface
│   │   ├── universal-adapter-api.md  # Python Universal Adapter API
│   │   └── schemas/                  # JSON schemas, OpenAPI specs
│   │
│   ├── specs/                        # 📐 Technical specifications
│   │   ├── README.md                 # Specifications index
│   │   ├── agent-schema.md           # Uniform Semantic Agent schema
│   │   ├── protocols/                # Protocol specifications
│   │   │   ├── experience-sync-protocol.md
│   │   │   ├── acp-protocol.md
│   │   │   └── agent-protocol.md
│   │   ├── data-models/              # Data model specifications
│   │   │   ├── agent-state.md
│   │   │   ├── memory-structures.md
│   │   │   └── canvas-types.md
│   │   └── formats/                  # File formats, serialization
│   │       └── agent-definition-format.md
│   │
│   ├── research/                     # 🔬 Research foundation (context, not implementation)
│   │   ├── README.md                 # Research documentation hub
│   │   ├── universal-patterns/       # Pattern research & validation
│   │   │   ├── PATTERNS.md
│   │   │   ├── PATTERNS_ANCHORED.md
│   │   │   └── CRYPTO_COMPLETE.md
│   │   ├── agent-spec/               # Agent specification research
│   │   │   ├── agent-spec-evolution.md
│   │   │   └── MemoryResearch.md
│   │   ├── frameworks/               # Framework comparisons
│   │   │   ├── AGENTIC_MEMORY_FRAMEWORKS_2026-01-16.md
│   │   │   ├── LETTA_CODE_ANALYSIS_2026-01-16.md
│   │   │   ├── OPEN_INTERPRETER_ANALYSIS_2026-01-16.md
│   │   │   └── OPENHANDS_AGENTPIPE_INTEGRATION_ARCHITECTURE.md
│   │   └── protocols/                # Protocol research
│   │       ├── ACP_PROTOCOL_MULTI_AGENT_SYNTHESIS.md
│   │       └── MULTI_AGENT_CLI_CHAT_STUDY_2026-01-16.md
│   │
│   ├── quality/                      # 🎯 Quality assurance
│   │   ├── README.md                 # Quality system hub
│   │   ├── CODE_REVIEW_CHECKLIST.md
│   │   ├── DESIGN_PATTERN_CODE_REVIEW.md
│   │   ├── testing-strategy.md
│   │   └── verification-reports/     # Test reports, coverage reports
│   │
│   ├── deployment/                   # 🚀 Deployment documentation
│   │   ├── README.md                 # Deployment hub
│   │   ├── DEPLOYMENT_GUIDE.md       # Comprehensive deployment guide
│   │   ├── kubernetes/               # K8s deployment manifests & docs
│   │   ├── docker/                   # Docker deployment
│   │   └── cloud/                    # Cloud-specific guides (AWS, GCP, Azure)
│   │
│   ├── personas/                     # 🎭 AI assistant personas
│   │   ├── README.md                 # Persona system documentation
│   │   └── *.md                      # Individual persona definitions
│   │
│   ├── contributing/                 # 🤝 Contributor resources
│   │   ├── README.md                 # Contribution hub
│   │   ├── code-style.md             # Coding standards
│   │   ├── git-workflow.md           # Branching, PR process
│   │   ├── release-process.md        # Release checklist
│   │   └── documentation-standards.md
│   │
│   └── archive/                      # 🗄️ Historical documentation
│       ├── README.md                 # ⚠️ Archive index with temporal context
│       ├── 2026-01/                  # Organized by month
│       │   ├── sessions/             # Session summaries
│       │   │   ├── SESSION_SUMMARY_2026-01-15.md
│       │   │   ├── CANVAS_SESSION_SUMMARY_2026-01-15.md
│       │   │   └── *.md
│       │   ├── reports/              # Historical reports
│       │   │   ├── CODE_REVIEW_REPORT_2026-01-14.md
│       │   │   ├── DOCUMENTATION_REVIEW_REPORT_2026-01-15.md
│       │   │   └── *.md
│       │   ├── handoffs/             # Handoff documents
│       │   │   ├── DOCUMENTATION_REVIEW_HANDOFF.md
│       │   │   └── FINAL_HANDOFF.md
│       │   └── superseded/           # Superseded specifications
│       │       └── *.md
│       ├── 2025/                     # Historical 2025 docs
│       └── external/                 # External project docs (e.g., GaryVision)
│
├── plans/                            # 📋 Active planning documents
│   ├── README.md                     # Plans index, status tracking
│   ├── active/                       # Currently active plans
│   │   ├── NEXT_STEPS_2026-01-15.md
│   │   ├── system-agents-layer-completion.md
│   │   └── *.md
│   └── completed/                    # Completed plans (for reference)
│
├── Agents/                           # 🤖 Agent definitions & configurations
│   ├── README.md                     # Agent directory documentation
│   ├── system/                       # System agents
│   ├── modes/                        # Custom modes
│   └── wshobson/                     # User-specific agents
│
├── projects/                         # 📦 Sub-projects with own documentation
│   ├── SkillBuilder/README.md
│   ├── KnowledgeBuilder/README.md
│   └── AgentBuilder/README.md
│
├── memory_system/                    # 🧠 Python memory system package
│   └── README.md                     # Python package documentation
│
├── go-services/                      # 🐹 Go LLM gateway service
│   └── README.md                     # Go service documentation
│
├── src/                              # 💻 TypeScript/Python source code
│   └── README.md                     # Source code overview
│
└── examples/                         # 📚 Verified code examples
    ├── README.md                     # Examples index
    ├── adapters/                     # Framework adapter examples
    ├── agents/                       # Agent configuration examples
    └── tasks/                        # Task definition examples
```

---

## Documentation Classification Matrix

### By Audience and Type

| Audience | Type | Location | Maintenance |
|----------|------|----------|-------------|
| **New Users** | Tutorial, Quickstart | `docs/getting-started/` | Updated per release |
| **Developers** | How-to guides, API reference | `docs/guides/developer/`, `docs/api/` | Updated per feature |
| **Operators** | Deployment, config, monitoring | `docs/guides/operator/`, `docs/deployment/` | Updated per release |
| **AI Integrators** | Protocols, schemas, integration | `docs/guides/integration/`, `docs/specs/` | Updated per protocol change |
| **Contributors** | Standards, workflow, personas | `docs/contributing/`, `docs/personas/` | Reviewed quarterly |
| **Architects** | System design, patterns, decisions | `docs/architecture/` | Updated per major change |
| **Researchers** | Research foundation, comparisons | `docs/research/` | Added as research progresses |

---

## Single Source of Truth (SSOT) Mapping

### Core Documents

| Topic | SSOT Location | Linked From | Update Trigger |
|-------|---------------|-------------|----------------|
| **Project Overview** | `README.md` | All docs | Each release |
| **System Architecture** | `ARCHITECTURE.md` | Guides, specs | Major refactor |
| **Implementation Status** | `docs/STATUS.md` | README, INDEX | Weekly during active dev |
| **Contribution Process** | `CONTRIBUTING.md` | PR templates | Process changes |
| **API Contracts** | `docs/api/*.md` | Guides, architecture | API changes |
| **Agent Schema** | `docs/specs/agent-schema.md` | API docs, guides | Schema version bump |
| **Configuration** | `docs/guides/operator/configuration.md` | Deployment guide | New env vars |
| **Deployment** | `docs/deployment/DEPLOYMENT_GUIDE.md` | README | Infrastructure changes |
| **Terminology** | `docs/GLOSSARY.md` | All docs | New concepts |

### Conflict Resolution

When duplicates/conflicts found:
1. **Designate canonical source** based on recency, completeness, code alignment
2. **Archive non-canonical** with note: "Superseded by [canonical-doc] on [date]. Reason: [reconciliation-note]"
3. **Update all links** to point to canonical source
4. **Add forward reference** from archived doc to canonical

---

## Naming Conventions

### Files

- **README files**: `README.md` (uppercase, every directory)
- **Guides**: `{topic}-guide.md` (e.g., `deployment-guide.md`, `testing-guide.md`)
- **Specifications**: `{component}-spec.md` or `{protocol}-specification.md`
- **Architecture**: `{component}-architecture.md` or `{topic}.md` in `docs/architecture/components/`
- **API docs**: `{service}-api.md` or `{protocol}-protocol.md`
- **ADRs**: `ADR-{number}-{slug}.md` (e.g., `ADR-001-service-layer-independence.md`)
- **Session logs**: `{type}_SUMMARY_{YYYY-MM-DD}.md` → archive as `docs/archive/{YYYY-MM}/sessions/`
- **Reports**: `{REPORT_TYPE}_{YYYY-MM-DD}.md` → archive as `docs/archive/{YYYY-MM}/reports/`

### Directories

- **Lowercase with hyphens**: `getting-started/`, `api-reference/`
- **Plural for collections**: `guides/`, `specs/`, `examples/`
- **Singular for single-topic**: `architecture/`, `deployment/`
- **Date-based for archives**: `archive/2026-01/`, `archive/2025/`

---

## Directory-Level README Template

Each directory must have a `README.md`:

```markdown
# {Directory Name}

**Purpose**: {One-sentence description}  
**Target Audience**: {Developer|Operator|Integrator|Contributor|Architect}  
**Maintenance**: {Owner/team} | Updated {frequency}  
**Last Updated**: {YYYY-MM-DD}

## Contents

| Document | Description | Status |
|----------|-------------|--------|
| [{filename}]({filepath}) | {Brief description} | ✅ Current / 🔄 In Progress / 📋 Planned |

## Related Documentation

- [{Related doc}]({path}) — {Why related}

## Contributing

{Guidelines for updating docs in this directory}
```

---

## Maintenance Cadence

| Doc Type | Review Frequency | Owner | Update Trigger |
|----------|------------------|-------|----------------|
| README.md | Per release | Maintainers | Major changes |
| ARCHITECTURE.md | Per major release | Architect | Architectural changes |
| STATUS.md | Weekly (active dev) | Engineering lead | Implementation progress |
| API docs | Per API change | Component owners | Endpoint/schema changes |
| Guides | Per feature release | Doc team | Feature additions |
| Specs | Per spec version | Architect | Protocol/schema changes |
| Research | Ad-hoc | Researchers | New research completed |
| Archive README | Quarterly | Doc team | Archive additions |

---

## Timestamp Requirements

### Major Documents (Always Required)

```markdown
---
**Last Updated**: {YYYY-MM-DD}  
**Reviewed By**: {Name/Role}  
**Next Review**: {YYYY-MM-DD or "Per release"}  
**Status**: ✅ Current | ⚠️ Needs Review | 🔄 In Progress | 📋 Planned | 🗄️ Archived
---
```

### Archive Documents (Temporal Context Required)

```markdown
---
**⚠️ ARCHIVED**: {YYYY-MM-DD}  
**Historical Context**: {Why archived}  
**Superseded By**: [{Current doc}]({path}) or "N/A - Completed work"  
**Temporal Scope**: {When this was current/relevant}
---
```

---

## Navigation System Design

### Entry Points by Role

**Developer (New to Chrysalis)**
1. `README.md` → Quick Start
2. `docs/getting-started/quickstart.md` → 5-minute start
3. `docs/getting-started/first-agent.md` → Tutorial
4. `docs/guides/developer/` → Specific task guides
5. `docs/api/` → API reference

**Operator (Deploying Chrysalis)**
1. `README.md` → System overview
2. `docs/deployment/DEPLOYMENT_GUIDE.md` → Deployment
3. `docs/guides/operator/configuration.md` → Configuration
4. `docs/guides/operator/monitoring.md` → Observability
5. `docs/guides/operator/troubleshooting.md` → Problem resolution

**AI Agent Integrator (Connecting Agents)**
1. `README.md` → Capabilities overview
2. `docs/guides/integration/protocol-selection.md` → Choose protocol
3. `docs/specs/protocols/` → Protocol specifications
4. `docs/api/` → API contracts
5. `examples/` → Verified integration examples

**Contributor (Adding Features)**
1. `CONTRIBUTING.md` → Contribution process
2. `docs/contributing/code-style.md` → Standards
3. `docs/architecture/` → System understanding
4. `docs/quality/CODE_REVIEW_CHECKLIST.md` → Quality gates
5. `docs/contributing/git-workflow.md` → PR process

**Architect (Understanding Design)**
1. `ARCHITECTURE.md` → System design overview
2. `docs/architecture/overview.md` → Deep dive
3. `docs/architecture/components/` → Component-specific design
4. `docs/architecture/patterns/` → Applied patterns
5. `docs/architecture/decisions/` → ADRs

### Navigation Breadcrumbs

Every document includes breadcrumb navigation:

```markdown
📂 [Chrysalis](/) > [Documentation](/docs/) > [Guides](/docs/guides/) > [Developer](/docs/guides/developer/) > **This Page**
```

---

## Archive Organization Strategy

### Principles

1. **Time-based hierarchy**: `archive/{YEAR-MONTH}/` for session logs, reports
2. **Category subdivision**: Within month, organize by type (sessions, reports, handoffs, superseded)
3. **Explicit archival note**: Every archived doc has header explaining non-current status
4. **Permanent deletion criteria**: Only delete true duplicates (identical content), large binary test outputs

### Archive README Structure

`docs/archive/README.md` serves as temporal index:

```markdown
# Documentation Archive

**⚠️ Historical Documentation - Not Current System State**

This archive preserves project history, completed sessions, superseded specifications, and historical reports. For current documentation, see [docs/README.md](../README.md).

## Organization

- **`{YYYY-MM}/`**: Organized by month
  - **`sessions/`**: Session summaries and working notes
  - **`reports/`**: Historical analysis and review reports
  - **`handoffs/`**: Project handoff documents
  - **`superseded/`**: Specifications replaced by newer versions
- **`external/`**: External project documentation (e.g., GaryVision)

## Index by Type

### Session Logs (Recent First)

| Date | Document | Summary |
|------|----------|---------|
| 2026-01-15 | [SESSION_SUMMARY_2026-01-15.md](2026-01/sessions/SESSION_SUMMARY_2026-01-15.md) | Canvas system implementation |

### Reports

| Date | Document | Type |
|------|----------|------|
| 2026-01-16 | [DOCUMENTATION_REVIEW_REPORT_2026-01-15.md](2026-01/reports/DOCUMENTATION_REVIEW_REPORT_2026-01-15.md) | Documentation review |

## Accessing Historical Context

Use git history for:
- Code evolution over time
- Commit-level context
- Blame/annotation for specific changes

Use this archive for:
- Session summaries and working notes
- Completed project reports
- Superseded design documents
```

---

## Implementation Plan

### Phase 3 (This Phase): Design ✅

- [x] Define directory structure
- [x] Establish SSOT mappings
- [x] Design naming conventions
- [x] Create directory README template
- [x] Specify maintenance cadences
- [x] Design navigation system
- [x] Plan archive organization

### Phase 4: Active Documentation Creation

1. Update `README.md` with current capabilities (verified against code)
2. Update `ARCHITECTURE.md` with actual implementation
3. Create `docs/README.md` as navigation hub
4. Update `docs/STATUS.md` as SSOT for implementation status
5. Create `docs/GLOSSARY.md` with consistent terminology
6. Create directory-level READMEs for major sections

### Phase 5: Systematic Cleanup and Archive

1. Archive session logs: `*_SUMMARY_*.md` → `docs/archive/2026-01/sessions/`
2. Archive handoffs: `*_HANDOFF.md` → `docs/archive/2026-01/handoffs/`
3. Archive reports: `*_REPORT_*.md` → `docs/archive/2026-01/reports/`
4. Move guides to correct directories: root → `docs/guides/`
5. Delete true duplicates (identical content, not just similar)
6. Update all internal links to reflect new locations

### Phase 6: Verification

1. Validate all hyperlinks resolve correctly
2. Verify Mermaid diagrams render properly
3. Validate API docs match actual code signatures
4. Verify configuration docs match actual env vars
5. Execute all code examples and verify output
6. Confirm no aspirational features presented as current

### Phase 7: Completion Artifacts

1. Generate summary of created/updated/archived/deleted docs
2. Present final directory tree structure
3. Produce verification report with test results
4. Identify remaining gaps requiring engineering work
5. Confirm documentation supports professional maintenance

---

## Verification Criteria

### Documentation Quality Gates

- [ ] All active docs have last-updated timestamp
- [ ] All active docs specify maintenance ownership
- [ ] No broken internal links
- [ ] No broken external links (or marked as potentially stale)
- [ ] All Mermaid diagrams render correctly
- [ ] All code examples execute successfully
- [ ] API docs match actual implementation signatures
- [ ] Configuration docs match actual environment variables
- [ ] No aspirational features presented as implemented
- [ ] Clear separation of active vs. archived materials
- [ ] Archive index explains temporal context
- [ ] Navigation breadcrumbs on all docs
- [ ] Consistent terminology (defined in GLOSSARY)
- [ ] Each topic has single authoritative source

---

## Success Metrics

1. **Discoverability**: Any user can find relevant doc in ≤3 clicks from README
2. **Accuracy**: Zero contradictions between docs and code
3. **Currency**: All active docs updated within their cadence window
4. **Maintainability**: Clear ownership and update triggers
5. **Clarity**: No ambiguity about current vs. planned features
6. **Completeness**: All implemented features documented, all docs describe implementation

---

**Next Actions**: 
1. Review this design for completeness and correctness
2. Proceed to Phase 4: Active Documentation Creation
3. Execute Phase 5: Systematic Cleanup and Archive
4. Complete Phase 6: Verification
5. Deliver Phase 7: Completion Artifacts

---

**Design Author**: Documentation Audit System  
**Based On**: Comprehensive audit of 560 markdown files, 55 source categories  
**Target Audience**: Engineering team, documentation maintainers, future contributors  
**Maintenance**: Update when information architecture evolves

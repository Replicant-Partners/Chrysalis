# Chrysalis Glossary

**Semantic precision for AI agent systems**

---

**📂 Quick Navigation**: [Home](/) > [Documentation](/docs/) > **Glossary**

**Purpose**: Single source of truth for Chrysalis terminology  
**Last Updated**: 2026-01-17  
**Maintained by**: Documentation Team  
**Status**: ✅ Current

---

## How to Use This Glossary

- **Bolded terms** are primary definitions
- *Italicized terms* are synonyms or related concepts
- →Links point to detailed documentation
- ⚠️ marks terms with common misunderstandings

---

## A

### Adapter

**Framework-specific translation layer** that allows Chrysalis to communicate with different agent frameworks (MCP, A2A, ACP, CrewAI, ElizaOS, Agent Protocol).

*Related*: Bridge, Protocol, Translation

→ See [Architecture: Adapters](architecture/)

### Agent

**Autonomous software entity** with goals, memory, and capability to act. In Chrysalis context, specifically refers to AI agents that can be morphed between different implementations.

*Types*: Semantic Agent, System Agent, Custom Agent

→ See [Agent Schema](specs/)

### Agent-to-Agent (A2A)

**Protocol for direct agent communication** without centralized coordination. Enables peer-to-peer agent collaboration.

*Related*: ACP, Multi-Agent, Protocol

→ See [A2A Client Documentation](a2a-client/)

### Agent Communication Protocol (ACP)

**Protocol for agent messaging and coordination** in multi-agent systems.

*Related*: A2A, Multi-Agent

→ See [Architecture](architecture/)

### Agent Protocol

**Standardized API specification** for agent interaction. One of the supported frameworks in Chrysalis.

→ See [Adapters](architecture/)

### Architecture Decision Record (ADR)

**Document capturing a specific architectural decision**, including context, decision, and consequences.

*Format*: `ADR-{number}-{slug}.md`

→ See [ADRs](adr/)

### Authoritative Source

⚠️ **Single document designated as ground truth** for a specific topic. All other references should link to it, not duplicate content.

*Synonym*: SSOT (Single Source of Truth), Canonical Source

---

## B

### Bridge

**Translation orchestration layer** that morphs agents between different framework implementations while preserving semantic meaning.

*Components*: Orchestrator, Cache, Validation, API

→ See [Bridge Architecture](architecture/)

### Byzantine Fault Tolerance

**Resistance to Byzantine failures** where components may behave arbitrarily or maliciously. Applied in Chrysalis's distributed agent coordination.

*Related*: Gossip Protocol, Consensus

→ See [Cryptographic Patterns](architecture/patterns/)

---

## C

### Canvas

**Multi-canvas visualization system** for displaying agent state, workflows, and interactions.

*Components*: Canvas Core, Widget Registry, Layout Engine

→ See [Canvas Architecture](architecture/)

### CRDT (Conflict-free Replicated Data Type)

**Data structure that guarantees eventual consistency** across distributed replicas without coordination. Used in Chrysalis for distributed memory and state.

*Types*: OR-Set, LWW-Register, G-Set

*Related*: Gossip, DAG, Memory Merge

→ See [Cryptographic Patterns](architecture/patterns/)

### Circuit Breaker

**Fault tolerance pattern** that prevents cascading failures by temporarily blocking calls to failing services.

→ See [src/utils/CircuitBreaker.ts](../src/utils/CircuitBreaker.ts)

---

## D

### DAG (Directed Acyclic Graph)

**Graph structure without cycles** used in Chrysalis for tracking agent evolution and experience history.

*Related*: Hash, Merkle Tree, Git-like History

→ See [Cryptographic Patterns](architecture/patterns/)

---

## E

### Embedding

**Vector representation of semantic content** (text, code, etc.) enabling similarity search and semantic operations.

*Providers*: Voyage AI, OpenAI

*Related*: Vector Index, Semantic Search

→ See [Memory System](architecture/memory-system.md)

### Experience Sync

**Protocol for agents to share and learn from deployment experiences**. Enables distributed learning across agent instances.

*Protocols*: Streaming, Lumped, Check-in

*Related*: Memory, Distributed Learning

→ See [Experience Sync Architecture](architecture/experience-sync.md)

---

## F

### Fireproof

**CRDT-based document store** providing conflict-free distributed data management. Used in Python memory system.

*Related*: CRDT, Memory System

→ See [Memory System](architecture/memory-system.md)

### Framework Adapter

See **Adapter**

---

## G

### Gossip Protocol

**Epidemic-style information dissemination** where nodes randomly share information with peers, achieving eventual consistency with O(log N) message complexity.

*Related*: Byzantine Fault Tolerance, CRDT, Distributed Systems

→ See [Cryptographic Patterns](architecture/patterns/)

### Ground Truth

⚠️ **Empirical reality verified against actual codebase**, not documentation or AI-generated artifacts. In Chrysalis: running code is ground truth, documentation describes it.

*Related*: SSOT, Verification

---

## H

### Hash

**Cryptographic fingerprint** (SHA-384) used for agent identity, content addressing, and tamper detection.

*Related*: Signature, DAG, Identity

→ See [Cryptographic Patterns](architecture/patterns/)

---

## I

### Instance

**Deployed copy of an agent** with its own runtime state and memory. Multiple instances can share experiences via Experience Sync.

*Related*: Experience Sync, Agent

---

## L

### Lossless Morphing

⚠️ **Transformation between agent implementations** (MCP ↔ Multi-Agent ↔ Orchestrated) without information loss. Core Chrysalis capability.

*Related*: Bridge, Adapter, Translation

→ See [Architecture](architecture/)

---

## M

### MCP (Model Context Protocol)

**Protocol for AI models to interact with external tools and context**. One of the primary protocols supported by Chrysalis.

*Related*: Adapter, Protocol

→ See [MCP Guide](guides/MCP_SERVER_GUIDE.md)

### Memory Merge

**Intelligent deduplication of memories** using Jaccard similarity and embedding distance to avoid redundant storage.

*Related*: Embedding, Deduplication

→ See [Memory System](architecture/memory-system.md)

### Memory System

**Python-based persistent storage layer** using Fireproof CRDT, embeddings, and knowledge graphs.

*Note*: TypeScript memory system was removed; Python is current implementation.

*Components*: Fireproof, Embedding Service, Knowledge Graph

→ See [Memory System](architecture/memory-system.md)

### Morph

See **Lossless Morphing**

### Multi-Agent

**System with multiple cooperating agents**, each with specialized capabilities. Chrysalis can morph agents to/from multi-agent architectures.

*Related*: A2A, ACP, Orchestrated

---

## O

### Orchestrated

**Centrally coordinated agent architecture** where a controller manages agent interactions. One of the agent implementation patterns Chrysalis supports.

*Opposite*: Multi-Agent (peer-to-peer)

*Related*: Bridge, Adapter

---

## P

### Pattern

**Reusable solution to common problem**. Chrysalis applies 10 universal patterns: Hash, Signatures, DAG, CRDT, Gossip, Byzantine Resistance, Merkle Trees, Content Addressing, Consensus, Replication.

→ See [Universal Patterns](research/universal-patterns/)

### Protocol

**Standardized communication specification**. Chrysalis supports multiple: MCP, A2A, ACP, Agent Protocol.

*Related*: Adapter, Framework

→ See [Specifications](specs/)

---

## S

### Semantic Agent

**Agent operating in semantic/meaning space** rather than just syntactic pattern matching. Core abstraction in Chrysalis.

*Current Version*: SemanticAgent

*Related*: SemanticAgent, Agent

→ See [Architecture](architecture/)

### Semantic Space

**Mathematical representation where semantic similarity corresponds to geometric proximity**. Enabled by embeddings and vector operations.

*Related*: Embedding, Vector Index

### Signature

**Cryptographic proof of authenticity** (Ed25519) used for agent authentication and tamper detection.

*Related*: Hash, Identity, Security

→ See [Cryptographic Patterns](architecture/patterns/)

### SSOT (Single Source of Truth)

**One authoritative document** designated as canonical reference for a topic. Prevents contradictions.

*Example*: `docs/STATUS.md` is SSOT for implementation status

*Related*: Authoritative Source, Ground Truth

→ See [Information Architecture](INFORMATION_ARCHITECTURE_DESIGN_2026-01-17.md)

### Status Document

**docs/STATUS.md** — SSOT for distinguishing implemented vs. planned features.

⚠️ *Critical*: This is the authoritative reference for "what actually works"

→ See [STATUS.md](STATUS.md)

---

## T

### Translation

**Semantic-preserving transformation** between different agent representations. Bridge layer performs translation.

*Related*: Morph, Adapter, Bridge

### TypeScript Core

**Primary implementation language** for Chrysalis core, adapters, bridge, canvas, and API layer.

*Related*: Python Memory System, Go Gateway

---

## U

### Universal Adapter (Python)

⚠️ **JSON-driven LLM task orchestration system** (Python implementation). Different from TypeScript framework adapters.

*Location*: `src/universal_adapter/` (Python code)

*Related*: Task Orchestration, Flow Execution

→ See [Universal Adapter Design](architecture/UNIVERSAL_ADAPTER_DESIGN.md)

### Universal Adapter (TypeScript)

See **Adapter** — Framework-specific adapters in TypeScript.

⚠️ *Confusion Warning*: Two systems share "Universal Adapter" name but serve different purposes.

### SemanticAgent (SemanticAgent)

**Current semantic agent schema and implementation**. Successor to V1, designed for experience sync, protocols, and instance management.

*Related*: Semantic Agent, Agent

→ See [src/core/SemanticAgent.ts](../src/core/SemanticAgent.ts)

### SemanticAgent

See **SemanticAgent**

---

## V

### Vector Index

**Searchable index of embeddings** enabling semantic similarity queries.

*Implementations*: LanceDB (planned), In-memory (current)

*Related*: Embedding, Semantic Search

→ See [Memory System](architecture/memory-system.md)

---

## W

### Widget

**Reusable UI component** in the Canvas system.

*Related*: Canvas, Visualization

→ See [Widget Developer Guide](guides/WIDGET_DEVELOPER_GUIDE.md)

---

## Acronyms

| Acronym | Full Term | Definition |
|---------|-----------|------------|
| **A2A** | Agent-to-Agent | Direct agent communication protocol |
| **ACP** | Agent Communication Protocol | Multi-agent messaging protocol |
| **ADR** | Architecture Decision Record | Document capturing architectural decision |
| **API** | Application Programming Interface | Programmatic interface |
| **CRDT** | Conflict-free Replicated Data Type | Eventually consistent distributed data structure |
| **DAG** | Directed Acyclic Graph | Graph without cycles |
| **LLM** | Large Language Model | AI language model |
| **MCP** | Model Context Protocol | AI tool interaction protocol |
| **PTY** | Pseudo-Terminal | Virtual terminal interface |
| **REST** | Representational State Transfer | HTTP API architectural style |
| **SSOT** | Single Source of Truth | One authoritative reference |
| **TUI** | Terminal User Interface | Text-based UI (removed from Chrysalis) |
| **SemanticAgent** | Canonical agent type | Current agent schema (formerly UniformSemanticAgent) |
| **UUID** | Universally Unique Identifier | Unique identifier |

---

## Common Confusions

### ⚠️ Memory System: TypeScript vs. Python

**Confusion**: Documentation references both TypeScript and Python memory systems.

**Truth**: 
- TypeScript memory system **deleted** in refactoring (2026-01-15)
- Python memory system (`memory_system/`) is **current implementation**
- Use Python system for Fireproof, embeddings, graph operations

→ See [Documentation Gap Analysis](DOCUMENTATION_GAP_ANALYSIS_2026-01-16.md)

### ⚠️ Universal Adapter: Two Different Systems

**Confusion**: "Universal Adapter" refers to two different things.

**Truth**:
- **TypeScript Framework Adapters**: `src/adapters/universal/` — Framework translation
- **Python Universal Adapter**: `src/universal_adapter/` — JSON-driven task orchestration

*Different purposes, overlapping names*

### ⚠️ TUI System

**Confusion**: Some docs reference Terminal User Interface (TUI).

**Truth**: TUI system (`src/tui/`) was **deleted** in refactoring. No current TUI implementation.

### ⚠️ Voyeur Observability

**Confusion**: Architecture diagrams show Voyeur event bus.

**Truth**: Voyeur was **removed** and replaced with standard logging and metrics (2026-01-15).

→ See [STATUS.md](STATUS.md)

---

## Term Usage Guidelines

### Consistent Terminology

**Use This** | **Not This** | **Why**
------------|-------------|--------
Semantic Agent | AI Agent, LLM Agent | Specificity—operating in semantic space
Framework Adapter | Protocol Adapter | Clarity—adapts frameworks, not just protocols
Bridge Layer | Translation Layer | Established term in codebase
Experience Sync | Learning Sync, Knowledge Sync | Official protocol name
Universal Adapter (Python) | Task Orchestrator | Official component name
SemanticAgent | SemanticAgent, Semantic Agent V2 | Canonical class name

### Capitalization

- **Proper names**: Chrysalis, Fireproof, MCP, A2A, ACP
- **Code constructs**: `SemanticAgent`, `CircuitBreaker`, `MemoryMerger`
- **Generic concepts**: semantic agent, bridge layer, adapter pattern

### Abbreviations

- **First use**: Spell out with acronym: "Model Context Protocol (MCP)"
- **Subsequent**: Use acronym: "MCP integration"
- **Code**: Use full names for clarity

---

## Contributing to Glossary

### Adding Terms

1. **Check for existing**: Ensure term not already defined
2. **Write clear definition**: One-sentence primary definition
3. **Add context**: Related terms, examples, links
4. **Mark confusions**: Use ⚠️ for commonly misunderstood terms
5. **Link to details**: Point to comprehensive documentation

### Updating Terms

1. **Preserve history**: Don't delete old meanings—mark as deprecated
2. **Update references**: Check all docs using the term
3. **Note in changelog**: Document terminology changes

### Template

```markdown
### Term Name

**Primary definition in bold** with one-sentence clarity.

*Related*: Related Term1, Related Term2

*Synonym*: Alternative names (if any)

*Note*: Important clarifications

⚠️ *Common Confusion*: Address misunderstandings

→ See [Detailed Documentation](path/to/doc.md)
```

---

## Related Documentation

- [Information Architecture](INFORMATION_ARCHITECTURE_DESIGN_2026-01-17.md) — Documentation structure
- [STATUS.md](STATUS.md) — Implementation status (SSOT)
- [Architecture](architecture/) — System design
- [Documentation Standards](current/DOCUMENTATION_STANDARDS.md) — Writing guidelines

---

**Last Updated**: 2026-01-17  
**Maintained by**: Documentation Team  
**Review Cadence**: Quarterly or when new concepts introduced  
**Contribution**: See [Contributing Guidelines](../CONTRIBUTING.md)

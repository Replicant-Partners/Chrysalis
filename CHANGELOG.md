# Changelog

All notable changes to Chrysalis will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.3.0] - 2026-01-06

### Added
- **Memory System Package**: Consolidated semantic services into standalone Python package
  - **Semantic Module**: Triple extraction, intent detection, semantic frames
    - HeuristicStrategy (pattern-based, no API required)
    - AnthropicStrategy (Claude Sonnet 4.5: `claude-sonnet-4-5-20250514`)
  - **Graph Module**: NetworkX and SQLite graph backends with path finding
  - **Converters Module**: Document, code, and chunk conversion utilities
  - **Analysis Module**: Shannon entropy and redundancy detection
  - **Embedding Module**: Voyage AI (primary) + OpenAI (fallback) with deterministic mode
  - **MCP Module**: Model Context Protocol integration utilities
  - **Resolvers Module**: Entity and schema resolution services
- **Test Suite**: 84 comprehensive tests for memory_system (100% passing)
- **API Documentation**: Complete module documentation with examples

### Changed
- **KnowledgeBuilder**: Added `pyarrow>=15.0.0` dependency for LanceDB compatibility
- **Test Infrastructure**: Converted async tests from pytest-asyncio to asyncio.run()
- **Embedding Strategy**: Voyage AI configured as primary provider (Anthropic recommended)

### Fixed
- **Async Tests**: Resolved pytest-asyncio dependency issues
- **Graph Tests**: Added NetworkX availability checks with skip decorators
- **Converter Tests**: Fixed Chunk field validation tests

### Architecture
- **Integration Ready**: Both KnowledgeBuilder (43/43 tests) and SkillBuilder operational
- **Semantic Services**: Modular design allows gradual adoption
- **Provider Fallback**: Voyage AI → OpenAI → Deterministic (no API required)

### Notes
- Created comprehensive semantic services foundation
- All 127 tests passing (84 memory_system + 43 KnowledgeBuilder)
- Voyage AI API key configured for production embeddings
- Integration documentation for builder adoption paths

---

## [3.2.0] - 2026-01-06

### Removed
- **Qdrant Vector Index**: Deprecated in favor of LanceDB for embedded persistence
  - Removed `QdrantVectorIndex.ts` adapter
  - Updated `VectorIndexFactory` to remove qdrant option
  - Updated `MemoryMerger` type definitions
  - Updated adapters to use `provider: 'lance'`

### Fixed
- **KnowledgeBuilder LanceDB**: Fixed deprecated `table_names()` → `list_tables()` in [`lancedb_client.py`](projects/KnowledgeBuilder/src/storage/lancedb_client.py:78)

### Changed
- **Vector Index Backends**: Now `hnsw | lance | brute` (removed `qdrant`)
- **Documentation**: Updated VECTOR_INDEX_SETUP.md and MEMORY_MERGE_PLAN.md
- Adapters (CrewAI, ElizaOS, OrchestratedAdapter, AgentBuilder) default to LanceDB

### Notes
- LanceDB provides zero-infrastructure embedded vector storage
- For graph+vector hybrid needs, use ArangoDB
- Migration guide added in VECTOR_INDEX_SETUP.md

---

## [3.1.0] - 2025-12-28

### Added
- **Adaptive Pattern Resolver**: Context-aware selection of pattern implementations (MCP vs embedded)
- **Embedding Service**: Infrastructure for semantic similarity (ready for @xenova/transformers)
- **Enhanced Memory Merger**: Configurable similarity methods (Jaccard or embedding)
- **Fractal Architecture**: Formalized pattern composition across 5 scales
- **Comprehensive Documentation**: 18 documents with rigorous analysis
- **Documentation Reorganization**: Clean structure (docs/{current,research,archive})

### Changed
- Memory similarity now configurable (backward compatible, Jaccard default)
- Specifications use precise terminology (honest gap assessment)
- Documentation structure reorganized for clarity and professionalism

### Research
- Standards-mode rigor applied (evidence-based, single-step inference)
- Layer 1 MCP servers reviewed and integrated into architecture
- Memory system evolution path specified (4 phases)

---

## [3.0.0] - 2025-12-27

### Added
- 10 universal patterns from distributed systems research
- MCP Layer 1 fabric (cryptographic-primitives, distributed-structures)
- Pattern implementations (Hash, Signature, Byzantine, Time)
- Enhanced security architecture (multi-layer defense)
- Deep research integration (150+ pages)

### Research
- Universal patterns identified and validated
- Mathematical foundations documented
- Security attacks analyzed with defenses
- Gossip protocols researched

---

## [2.0.0] - 2025-12-26

### Added
- Three agent types (MCP, Multi-Agent, Orchestrated)
- Experience sync protocols (Streaming, Lumped, Check-in)
- Memory/Skill/Knowledge merging
- Instance management with health monitoring
- Dual-coded memory (episodic + semantic)

### Changed
- Expanded from two-way (ElizaOS ↔ CrewAI) to universal morphing
- Added experience accumulation from deployed instances

---

## [1.0.0] - 2025-12-25

### Added
- Initial lossless agent morphing (ElizaOS ↔ CrewAI)
- Shadow field encryption for information preservation
- Basic cryptographic identity
- Framework adapters

### Foundation
- Proof of concept for lossless conversion
- Shadow data approach validated

---

## Upcoming

### [3.2.0] - Planned (4-6 weeks)
- [ ] Embedding-based similarity (@xenova/transformers integration)
- [ ] Vector indexing (HNSW for O(log N) search)
- [ ] True gossip protocol (epidemic spreading)
- [ ] MCP client integration

### [3.3.0] - Planned (8 weeks)
- [ ] Anti-entropy protocol
- [ ] Full gossip implementation
- [ ] Performance benchmarking

### [3.4.0] - Planned (12 weeks)
- [ ] CRDT state management
- [ ] Multi-region deployment support
- [ ] Evolution DAG visualization

---

## Version History Summary

| Version | Date | Key Features |
|---------|------|--------------|
| **3.3.0** | 2026-01-06 | Memory system package, semantic services, Claude Sonnet 4.5, Voyage AI embeddings |
| **3.2.0** | 2026-01-06 | Qdrant removal, LanceDB consolidation, pipeline fixes |
| **3.1.0** | 2025-12-28 | Fractal architecture, adaptive patterns, enhanced memory |
| **3.0.0** | 2025-12-27 | Universal patterns, MCP fabric, deep research |
| **2.0.0** | 2025-12-26 | Three agent types, experience sync, instance management |
| **1.0.0** | 2025-12-25 | Initial lossless morphing (ElizaOS ↔ CrewAI) |

---

**Maintained By**: Chrysalis Team  
**Repository**: [github.com/Replicant-Partners/Chrysalis](https://github.com/Replicant-Partners/Chrysalis)

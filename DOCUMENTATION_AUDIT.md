# Chrysalis Documentation Audit & Reorganization Plan

**Date**: December 28, 2025  
**Objective**: Consolidate, clarify, and organize documentation per semantic-doc-prompt.md

---

## Current State Analysis

### Root Directory Issues

**Problems Identified**:
1. **60+ files in root** - Difficult to navigate
2. **Multiple overlapping specs** - CHRYSALIS_*, UNIFIED_*, V2_*, V3_* versions
3. **Project-specific code mixed with docs** - GaryVision_*, CrewPony_*, deer-flow_*
4. **Unclear versioning** - Which spec is current?
5. **Redundant summaries** - Multiple SUMMARY, STATUS, GUIDE files
6. **No clear entry point** - Too many README variants

### Document Categories Identified

**Current Specifications** (Active):
- CHRYSALIS_UNIFIED_SPEC_V3.1.md ✅ PRIMARY
- CHRYSALIS_FOUNDATION_SPEC.md
- RIGOROUS_SYSTEM_ANALYSIS.md
- CHRYSALIS_SYNTHESIS_V3.md
- MASTER_INDEX_V3.1.md

**Research Foundation** (Reference):
- LAYER1_UNIVERSAL_PATTERNS_ANCHORED.md
- LAYER1_UNIVERSAL_PATTERNS.md
- DEEP_RESEARCH_MATHEMATICAL_FOUNDATIONS.md
- DEEP_RESEARCH_SECURITY_ATTACKS.md
- DEEP_RESEARCH_SYNTHESIS.md
- DEEP_RESEARCH_GOSSIP_PROTOCOLS.md

**Historical/Superseded** (Archive):
- V2_*.md (superseded by v3.1)
- UAS_*.md (deprecated Uniform Semantic Agent Spec)
- AGENT_MORPHING_SPECIFICATION.md (old version)
- Multiple SUMMARY/STATUS files

**Project-Specific Code** (Move to /projects):
- GaryVision_* (9 files)
- CrewPony_* (8 files)
- deer-flow_* (2 files)
- LeatherLadder_* (2 files)
- Ludwig_* (1 file)

**Configuration Files** (Keep in root):
- package.json
- .gitignore
- .semgrep*
- semantic-doc-prompt.md

---

## Proposed Directory Structure

```
Chrysalis/
├── README.md                          # PRIMARY ENTRY POINT
├── QUICK_START.md                     # Get started in 10 minutes
├── ARCHITECTURE.md                    # System overview with diagrams
├── CONTRIBUTING.md                    # How to contribute
├── CHANGELOG.md                       # Version history
├── package.json
├── .gitignore
├── semantic-doc-prompt.md
│
├── docs/                              # All documentation
│   ├── README.md                      # Documentation navigation
│   │
│   ├── current/                       # Active specifications
│   │   ├── UNIFIED_SPEC_V3.1.md       # Complete system spec
│   │   ├── FOUNDATION_SPEC.md         # Pattern foundations
│   │   ├── SYNTHESIS.md               # Design insights
│   │   ├── ANALYSIS.md                # System analysis
│   │   ├── IMPLEMENTATION_GUIDE.md    # How to implement
│   │   └── API_REFERENCE.md           # API documentation
│   │
│   ├── research/                      # Research foundation
│   │   ├── README.md                  # Research overview
│   │   ├── universal-patterns/
│   │   │   ├── PATTERNS.md
│   │   │   └── PATTERNS_ANCHORED.md
│   │   ├── deep-research/
│   │   │   ├── MATHEMATICAL_FOUNDATIONS.md
│   │   │   ├── SECURITY_ATTACKS.md
│   │   │   ├── GOSSIP_PROTOCOLS.md
│   │   │   └── SYNTHESIS.md
│   │   └── agent-spec/
│   │       └── AgentSpecResearch.md
│   │
│   ├── archive/                       # Historical documents
│   │   ├── README.md                  # Archive index
│   │   ├── v2/
│   │   │   ├── V2_SPECIFICATION.md
│   │   │   ├── V2_GUIDE.md
│   │   │   └── V2_STATUS.txt
│   │   ├── v1/
│   │   │   └── AGENT_MORPHING_SPEC.md
│   │   └── deprecated/
│   │       ├── UAS_*.md
│   │       └── old-memory/
│   │
│   └── diagrams/                      # Mermaid diagrams
│       ├── README.md
│       ├── architecture.mmd
│       ├── data-flow.mmd
│       └── patterns.mmd
│
├── src/                               # Source code (unchanged)
│   ├── core/
│   ├── fabric/
│   ├── memory/
│   └── ...
│
├── examples/                          # Usage examples (unchanged)
│   └── ...
│
├── projects/                          # Project-specific code
│   ├── README.md                      # Projects overview
│   ├── GaryVision/
│   │   └── (9 GaryVision files)
│   ├── CrewPony/
│   │   └── (8 CrewPony files)
│   ├── deer-flow/
│   │   └── (2 deer-flow files)
│   ├── LeatherLadder/
│   │   └── (2 LeatherLadder files)
│   └── Ludwig/
│       └── (1 Ludwig file)
│
├── Agents/                            # Agent definitions (unchanged)
│   └── ...
│
├── Replicants/                        # Replicant configs (unchanged)
│   └── ...
│
├── mcp-servers/                       # MCP servers (unchanged)
│   └── ...
│
└── tests/                             # Tests (unchanged)
    └── ...
```

---

## Reorganization Actions

### Phase 1: Create New Structure (Non-Destructive)

1. **Create directories**:
   ```bash
   mkdir -p docs/{current,research/{universal-patterns,deep-research,agent-spec},archive/{v2,v1,deprecated},diagrams}
   mkdir -p projects/{GaryVision,CrewPony,deer-flow,LeatherLadder,Ludwig}
   ```

2. **Copy (not move) files** to new locations for review

### Phase 2: Document Consolidation

1. **Merge overlapping specifications**:
   - Consolidate multiple CHRYSALIS_* files into coherent current docs
   - Remove redundancy while preserving unique content

2. **Create master documents**:
   - README.md (root) - Clear entry point
   - ARCHITECTURE.md - System overview with Mermaid diagrams
   - docs/current/UNIFIED_SPEC_V3.1.md - Complete specification

3. **Update all cross-references**:
   - Fix internal links
   - Update master index
   - Ensure navigation paths work

### Phase 3: Archive Historical

1. **Move superseded versions** to archive:
   - V2 specifications → docs/archive/v2/
   - V1 specifications → docs/archive/v1/
   - uSA documents → docs/archive/deprecated/
   - Old memory docs → docs/archive/deprecated/old-memory/

2. **Create archive READMEs**:
   - Explain what each archived version contained
   - Link to migration guides
   - Mark clearly as non-current

### Phase 4: Extract Project Code

1. **Move project files** to projects/:
   - GaryVision_* → projects/GaryVision/
   - CrewPony_* → projects/CrewPony/
   - etc.

2. **Create project READMEs**:
   - Explain each project's purpose
   - Link to relevant documentation
   - Document current status

### Phase 5: Cleanup Root

1. **Keep in root** (max 10-12 files):
   - README.md
   - QUICK_START.md
   - ARCHITECTURE.md
   - CONTRIBUTING.md
   - CHANGELOG.md
   - package.json
   - tsconfig.json
   - .gitignore
   - .semgrep.yml
   - semantic-doc-prompt.md

2. **Remove from root**:
   - All other .md files (moved to docs/)
   - All project files (moved to projects/)
   - Temporary files (git-init.sh, etc.)

---

## Documentation Standards

### Naming Conventions

**Files**:
- `UPPERCASE.md` - Major documents (README, ARCHITECTURE)
- `PascalCase.md` - Specific topics (MemorySystem, PatternResolver)
- `kebab-case.md` - Multi-word topics (getting-started, api-reference)

**Directories**:
- `lowercase` - All directory names lowercase
- `kebab-case` - Multi-word directories

### Content Standards

**Every document must include**:
1. **Header** - Title, version, date
2. **Purpose** - What this document covers
3. **Status** - Current/Archive/Deprecated
4. **Navigation** - Links to related docs
5. **Diagrams** - Mermaid diagrams where appropriate
6. **Citations** - Sources for design decisions
7. **Footer** - Last updated, maintainer

**Mermaid Diagrams Required For**:
- System architecture
- Data flows
- Interaction patterns
- Object models
- State transitions

---

## Quality Checklist

**Accuracy**:
- [ ] Documentation reflects actual implementation
- [ ] Code examples tested and working
- [ ] Version numbers consistent

**Completeness**:
- [ ] All major systems documented
- [ ] Migration guides for breaking changes
- [ ] Troubleshooting sections

**Clarity**:
- [ ] Technical terms defined
- [ ] Diagrams support text
- [ ] Examples illustrate concepts

**Maintainability**:
- [ ] Clear ownership/maintainers
- [ ] Update triggers documented
- [ ] Consistent formatting

**Professionalism**:
- [ ] Proper grammar and spelling
- [ ] Consistent voice and tone
- [ ] Professional presentation

---

## Next Steps

1. **Review this audit** with stakeholders
2. **Execute Phase 1** - Create structure (non-destructive)
3. **Validate organization** - Ensure nothing lost
4. **Execute remaining phases** incrementally
5. **Update git** - Commit reorganization

---

**Status**: AUDIT COMPLETE - Ready for reorganization

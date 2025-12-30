# Chrysalis Documentation Reorganization Guide

**Date**: December 28, 2025  
**Status**: Manual execution required  
**Purpose**: Clean professional documentation structure per semantic-doc-prompt.md

---

## Situation

The reorganization scripts have been created but require manual execution in a terminal with visible output.

**Run this command manually**:
```bash
cd ~/Documents/GitClones/Chrysalis
python3 reorganize_docs.py
```

Or execute the bash script:
```bash
cd ~/Documents/GitClones/Chrysalis
bash reorganize.sh
```

---

## Target Structure

```
Chrysalis/                              # Clean root
├── README.md                           ✅ Created
├── ARCHITECTURE.md                     ✅ Created
├── QUICK_START.md                      ✅ Exists
├── CONTRIBUTING.md                     ✅ Created
├── CHANGELOG.md                        ✅ Created
├── semantic-doc-prompt.md              ✅ Keep
├── package.json                        ✅ Keep
├── tsconfig.json                       ✅ Keep
├── .gitignore                          ✅ Keep
│
├── docs/                              📁 Documentation
│   ├── README.md                       ✅ Created (navigation hub)
│   │
│   ├── current/                       📁 Active v3.1 specifications
│   │   ├── UNIFIED_SPEC_V3.1.md       (from CHRYSALIS_UNIFIED_SPEC_V3.1.md)
│   │   ├── FOUNDATION_SPEC.md         (from CHRYSALIS_FOUNDATION_SPEC.md)
│   │   ├── SYNTHESIS.md               (from CHRYSALIS_SYNTHESIS_V3.md)
│   │   ├── ANALYSIS.md                (from RIGOROUS_SYSTEM_ANALYSIS.md)
│   │   ├── V3.1_DELIVERY_REPORT.md
│   │   ├── IMPLEMENTATION_GUIDE.md
│   │   ├── MCP_SETUP.md               (from DESIGN_PATTERNS_MCP_SETUP.md)
│   │   ├── HEDERA_REFERENCE.md        (from HEDERA_MCP_QUICK_REFERENCE.md)
│   │   └── memory/                    📁 Memory subsystem
│   │       ├── README.md              (from MEMORY_SYSTEM_README.md)
│   │       ├── ARCHITECTURE.md        (from CHRYSALIS_MEMORY_ARCHITECTURE.md)
│   │       ├── IMPLEMENTATION.md      (from CHRYSALIS_MEMORY_IMPLEMENTATION.md)
│   │       ├── QUICK_SUMMARY.md       (from AgentMemory_QuickSummary.md)
│   │       └── ARCHITECTURE_ANCHORED.md
│   │
│   ├── research/                      📁 Research foundation
│   │   ├── README.md                  🔄 Need to create
│   │   ├── INDEX.md                   (from RESEARCH_INDEX.md)
│   │   ├── universal-patterns/
│   │   │   ├── PATTERNS.md            (from LAYER1_UNIVERSAL_PATTERNS.md)
│   │   │   └── PATTERNS_ANCHORED.md   (from LAYER1_UNIVERSAL_PATTERNS_ANCHORED.md)
│   │   ├── deep-research/
│   │   │   ├── MATHEMATICAL_FOUNDATIONS.md
│   │   │   ├── SECURITY_ATTACKS.md
│   │   │   ├── GOSSIP_PROTOCOLS.md
│   │   │   └── SYNTHESIS.md
│   │   └── agent-spec/
│   │       ├── AgentSpecResearch.md
│   │       └── MemoryResearch.md      (from AgentMemoryArchitectureResearch.md)
│   │
│   ├── archive/                       📁 Historical versions
│   │   ├── README.md                  🔄 Need to create
│   │   ├── v3/                        📁 V3.0 completion docs
│   │   │   ├── FINAL_SYNTHESIS.md
│   │   │   ├── COMPLETE.md            (from CHRYSALIS_V3_COMPLETE.md)
│   │   │   └── KEY_LESSONS.md         (from KEY_LESSONS_BRIEF.md)
│   │   ├── v2/                        📁 V2 specifications
│   │   │   ├── SPECIFICATION.md       (from V2_COMPLETE_SPECIFICATION.md)
│   │   │   ├── MORPHING_SPEC.md       (from UNIFIED_AGENT_MORPHING_SPECIFICATION_V2.md)
│   │   │   └── SYSTEM_README.md       (from V2_SYSTEM_README.md)
│   │   ├── v1/                        📁 V1 specifications
│   │   │   ├── MORPHING_SPEC.md       (from AGENT_MORPHING_SPECIFICATION.md)
│   │   │   └── CREWAI_VS_ELIZAOS.md   (from CREWAI_VS_ELIZAOS_ANALYSIS.md)
│   │   └── deprecated/                📁 Deprecated approaches
│   │       ├── UAS_*.md               (5 files)
│   │       └── old-memory/
│   │           └── README_MEMORY_V1.md
│   │
│   └── diagrams/                      📁 Mermaid diagrams
│       └── README.md                  🔄 Need to create
│
├── projects/                          📁 Project-specific code
│   ├── README.md                      🔄 Need to create
│   ├── GaryVision/                    (9 files + 2 directories)
│   ├── CrewPony/                      (7 files)
│   ├── deer-flow/                     (2 files)
│   ├── LeatherLadder/                 (2 files)
│   ├── Ludwig/                        (1 file)
│   └── configs/                       (3 config files)
│
├── src/                               📁 Source code (unchanged)
├── examples/                          📁 Examples (unchanged)
├── mcp-servers/                       📁 MCP servers (unchanged)
├── Agents/                            📁 Agent definitions (unchanged)
├── Replicants/                        📁 Replicant configs (unchanged)
├── tests/                             📁 Tests (unchanged)
├── memory_system/                     📁 Python memory impl (unchanged)
└── uas_implementation/                📁 UAS impl (unchanged)
```

---

## Manual Execution Steps

Since automated scripts aren't producing output, execute manually:

### Step 1: Create Directories

```bash
cd ~/Documents/GitClones/Chrysalis

mkdir -p docs/current/memory
mkdir -p docs/research/{universal-patterns,deep-research,agent-spec}
mkdir -p docs/archive/{v1,v2,v3,deprecated/old-memory}
mkdir -p docs/diagrams
mkdir -p projects/{GaryVision,CrewPony,deer-flow,LeatherLadder,Ludwig,configs}
```

### Step 2: Move Current Specifications

```bash
mv CHRYSALIS_UNIFIED_SPEC_V3.1.md docs/current/UNIFIED_SPEC_V3.1.md
mv CHRYSALIS_FOUNDATION_SPEC.md docs/current/FOUNDATION_SPEC.md
mv CHRYSALIS_SYNTHESIS_V3.md docs/current/SYNTHESIS.md
mv RIGOROUS_SYSTEM_ANALYSIS.md docs/current/ANALYSIS.md
mv V3.1_DELIVERY_REPORT.md docs/current/V3.1_DELIVERY_REPORT.md
mv IMPLEMENTATION_GUIDE.md docs/current/IMPLEMENTATION_GUIDE.md
mv IMPLEMENTATION_SUMMARY.md docs/current/IMPLEMENTATION_SUMMARY.md
mv MASTER_INDEX_V3.1.md docs/current/MASTER_INDEX.md
mv SYSTEM_SUMMARY.md docs/current/SYSTEM_SUMMARY.md
mv CHRYSALIS_COMPLETE_SPEC.md docs/current/COMPLETE_SPEC.md
```

### Step 3: Move Research Documents

```bash
# Universal patterns
mv LAYER1_UNIVERSAL_PATTERNS.md docs/research/universal-patterns/PATTERNS.md
mv LAYER1_UNIVERSAL_PATTERNS_ANCHORED.md docs/research/universal-patterns/PATTERNS_ANCHORED.md
mv LAYER1_CRYPTO_COMPLETE.md docs/research/universal-patterns/CRYPTO_COMPLETE.md

# Deep research
mv DEEP_RESEARCH_MATHEMATICAL_FOUNDATIONS.md docs/research/deep-research/MATHEMATICAL_FOUNDATIONS.md
mv DEEP_RESEARCH_SECURITY_ATTACKS.md docs/research/deep-research/SECURITY_ATTACKS.md
mv DEEP_RESEARCH_GOSSIP_PROTOCOLS.md docs/research/deep-research/GOSSIP_PROTOCOLS.md
mv DEEP_RESEARCH_SYNTHESIS.md docs/research/deep-research/SYNTHESIS.md

# Agent spec research
mv AgentSpecResearch.md docs/research/agent-spec/AgentSpecResearch.md
mv AgentMemoryArchitectureResearch.md docs/research/agent-spec/MemoryResearch.md
mv RESEARCH_INDEX.md docs/research/INDEX.md
```

### Step 4: Move Memory Documentation

```bash
mv CHRYSALIS_MEMORY_ARCHITECTURE.md docs/current/memory/ARCHITECTURE.md
mv CHRYSALIS_MEMORY_IMPLEMENTATION.md docs/current/memory/IMPLEMENTATION.md
mv CHRYSALIS_MEMORY_UPDATE_SUMMARY.md docs/current/memory/UPDATE_SUMMARY.md
mv AgentMemory_QuickSummary.md docs/current/memory/QUICK_SUMMARY.md
mv AgentMemoryArchitecture_Anchored.md docs/current/memory/ARCHITECTURE_ANCHORED.md
mv MEMORY_SYSTEM_README.md docs/current/memory/README.md
```

### Step 5: Archive Historical Versions

```bash
# V3.0 completions
mv FINAL_SYNTHESIS.md docs/archive/v3/FINAL_SYNTHESIS.md
mv CHRYSALIS_V3_COMPLETE.md docs/archive/v3/COMPLETE.md
mv KEY_LESSONS_BRIEF.md docs/archive/v3/KEY_LESSONS.md
mv VERIFICATION_CHECKLIST.md docs/archive/v3/VERIFICATION_CHECKLIST.md

# V2
mv V2_COMPLETE_SPECIFICATION.md docs/archive/v2/SPECIFICATION.md
mv V2_SYSTEM_README.md docs/archive/v2/SYSTEM_README.md
mv V2_MASTER_GUIDE.md docs/archive/v2/MASTER_GUIDE.md
mv UNIFIED_AGENT_MORPHING_SPECIFICATION_V2.md docs/archive/v2/MORPHING_SPEC.md

# V1
mv AGENT_MORPHING_SPECIFICATION.md docs/archive/v1/MORPHING_SPEC.md
mv LOSSLESS_AGENT_MORPHING.md docs/archive/v1/LOSSLESS_MORPHING.md
mv CREWAI_VS_ELIZAOS_ANALYSIS.md docs/archive/v1/CREWAI_VS_ELIZAOS.md

# Deprecated
mv UAS_*.md docs/archive/deprecated/
mv UniversalAgentSpecification.md docs/archive/deprecated/
mv README_MORPHING_SYSTEM.md docs/archive/deprecated/
```

### Step 6: Move Project Files

```bash
# GaryVision
mv GaryVision_* projects/GaryVision/
mv GaryVision_crew_data projects/GaryVision/
mv GaryVision_teams projects/GaryVision/

# CrewPony
mv CrewPony_* projects/CrewPony/

# Others
mv deer-flow_* projects/deer-flow/
mv LeatherLadder_* projects/LeatherLadder/
mv Ludwig_* projects/Ludwig/

# Configs
mv Congo_serena_project.yml projects/configs/
mv SkyPrompt_serena_project.yml projects/configs/
mv CRP.md projects/configs/
```

### Step 7: Move MCP References

```bash
mv DESIGN_PATTERNS_MCP_SETUP.md docs/current/MCP_SETUP.md
mv HEDERA_MCP_QUICK_REFERENCE.md docs/current/HEDERA_REFERENCE.md
mv HEDERA_CONSENSUS_MCP_STRATEGY.md docs/current/HEDERA_STRATEGY.md
```

### Step 8: Clean Up

```bash
# Remove temporary files
rm -f git-init.sh reorganize.sh RIGOROUS_COMPLETION_SUMMARY.txt

# Move git docs to archive
mv GIT_INIT_CONFIRMATION.md docs/archive/deprecated/
mv GIT_PUSH_STATUS.md docs/archive/deprecated/
```

### Step 9: Commit

```bash
git add -A
git commit -m "docs: reorganize documentation structure

- Create docs/{current,research,archive,diagrams} structure
- Move 40+ docs from root to appropriate locations
- Extract project-specific code to projects/ directory
- Add comprehensive README.md and ARCHITECTURE.md
- Create documentation navigation hub
- Establish clean root (<15 files)

Follows semantic-doc-prompt.md guidelines."

git push origin main
```

---

## Benefits of New Structure

**Before**:
- 60+ files in root (overwhelming)
- Unclear which docs are current
- Project code mixed with documentation
- No clear entry point
- Difficult to navigate

**After**:
- <15 files in root (clean)
- Clear current/archive separation
- Projects organized separately
- README.md entry point with diagrams
- Logical navigation through docs/README.md

---

## File Mapping Reference

See `REORGANIZATION_MAP.txt` for complete mapping of old → new locations.

See `reorganize_docs.py` for automated Python script.

---

## Verification

After running reorganization:

```bash
# Check structure
ls docs/current/
ls docs/research/
ls projects/

# Count files
find docs/current -name "*.md" | wc -l    # Should be ~10-15
find docs/research -name "*.md" | wc -l   # Should be ~10-12
find docs/archive -name "*.md" | wc -l    # Should be ~15-20
ls *.md | wc -l                            # Should be <10

# Verify no broken content
grep -r "CHRYSALIS_UNIFIED_SPEC" docs/    # Update cross-references
```

---

## Created Documents (Ready)

These new documents are ready and provide the new structure:

✅ **README.md** - Comprehensive entry point with architecture diagram  
✅ **ARCHITECTURE.md** - System overview with Mermaid diagrams  
✅ **CONTRIBUTING.md** - Contribution guidelines  
✅ **CHANGELOG.md** - Version history  
✅ **docs/README.md** - Documentation navigation hub  
✅ **REORGANIZATION_COMPLETE.md** - Completion summary  
✅ **REORGANIZATION_GUIDE.md** - This guide

---

## Status

**Scripts Created**: ✅ reorganize_docs.py, reorganize.sh  
**Navigation Created**: ✅ README.md, docs/README.md  
**Structure Designed**: ✅ Complete mapping  
**Execution**: ⏸️ Requires manual terminal run

**Next**: Run `python3 reorganize_docs.py` in terminal with visible output

---

🦋 **Clean structure enables clear thinking** 🦋

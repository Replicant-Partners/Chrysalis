#!/usr/bin/env python3
"""
Chrysalis Documentation Reorganization Script
Date: December 28, 2025
Purpose: Reorganize 60+ root files into clean professional structure
"""

import os
import shutil
from pathlib import Path

# Base directory
BASE = Path.home() / "Documents/GitClones/Chrysalis"
os.chdir(BASE)

print("🦋 Chrysalis Documentation Reorganization")
print("=" * 60)
print()

# Create directory structure
print("📁 Creating directory structure...")
dirs_to_create = [
    "docs/current/memory",
    "docs/research/universal-patterns",
    "docs/research/deep-research",
    "docs/research/agent-spec",
    "docs/archive/v1",
    "docs/archive/v2",
    "docs/archive/v3",
    "docs/archive/deprecated/old-memory",
    "docs/diagrams",
    "projects/GaryVision",
    "projects/CrewPony",
    "projects/deer-flow",
    "projects/LeatherLadder",
    "projects/Ludwig",
    "projects/configs",
]

for dir_path in dirs_to_create:
    Path(dir_path).mkdir(parents=True, exist_ok=True)
    print(f"  ✓ {dir_path}")

print()

# Define file movements
moves = {
    # Current specifications
    "CHRYSALIS_UNIFIED_SPEC_V3.1.md": "docs/current/UNIFIED_SPEC_V3.1.md",
    "CHRYSALIS_FOUNDATION_SPEC.md": "docs/current/FOUNDATION_SPEC.md",
    "CHRYSALIS_SYNTHESIS_V3.md": "docs/current/SYNTHESIS.md",
    "RIGOROUS_SYSTEM_ANALYSIS.md": "docs/current/ANALYSIS.md",
    "V3.1_DELIVERY_REPORT.md": "docs/current/V3.1_DELIVERY_REPORT.md",
    "IMPLEMENTATION_GUIDE.md": "docs/current/IMPLEMENTATION_GUIDE.md",
    "IMPLEMENTATION_SUMMARY.md": "docs/current/IMPLEMENTATION_SUMMARY.md",
    "MASTER_INDEX_V3.1.md": "docs/current/MASTER_INDEX.md",
    "SYSTEM_SUMMARY.md": "docs/current/SYSTEM_SUMMARY.md",
    "CHRYSALIS_COMPLETE_SPEC.md": "docs/current/COMPLETE_SPEC.md",
    "IMPLEMENTATION_COMPLETE.md": "docs/current/IMPLEMENTATION_COMPLETE.md",
    
    # Universal patterns research
    "LAYER1_UNIVERSAL_PATTERNS.md": "docs/research/universal-patterns/PATTERNS.md",
    "LAYER1_UNIVERSAL_PATTERNS_ANCHORED.md": "docs/research/universal-patterns/PATTERNS_ANCHORED.md",
    "LAYER1_CRYPTO_COMPLETE.md": "docs/research/universal-patterns/CRYPTO_COMPLETE.md",
    
    # Deep research
    "DEEP_RESEARCH_MATHEMATICAL_FOUNDATIONS.md": "docs/research/deep-research/MATHEMATICAL_FOUNDATIONS.md",
    "DEEP_RESEARCH_SECURITY_ATTACKS.md": "docs/research/deep-research/SECURITY_ATTACKS.md",
    "DEEP_RESEARCH_GOSSIP_PROTOCOLS.md": "docs/research/deep-research/GOSSIP_PROTOCOLS.md",
    "DEEP_RESEARCH_SYNTHESIS.md": "docs/research/deep-research/SYNTHESIS.md",
    
    # Agent research
    "AgentSpecResearch.md": "docs/research/agent-spec/AgentSpecResearch.md",
    "AgentMemoryArchitectureResearch.md": "docs/research/agent-spec/MemoryResearch.md",
    "ANCHORED_RESEARCH_SUMMARY.md": "docs/research/RESEARCH_SUMMARY.md",
    "CREATIVE_RESEARCH_COMPLETE.md": "docs/research/CREATIVE_RESEARCH.md",
    "RESEARCH_INDEX.md": "docs/research/INDEX.md",
    "RESEARCH_COMPARISON.md": "docs/research/COMPARISON.md",
    
    # Memory docs
    "CHRYSALIS_MEMORY_ARCHITECTURE.md": "docs/current/memory/ARCHITECTURE.md",
    "CHRYSALIS_MEMORY_IMPLEMENTATION.md": "docs/current/memory/IMPLEMENTATION.md",
    "CHRYSALIS_MEMORY_UPDATE_SUMMARY.md": "docs/current/memory/UPDATE_SUMMARY.md",
    "AgentMemory_QuickSummary.md": "docs/current/memory/QUICK_SUMMARY.md",
    "AgentMemoryArchitecture_Anchored.md": "docs/current/memory/ARCHITECTURE_ANCHORED.md",
    "MEMORY_SYSTEM_README.md": "docs/current/memory/README.md",
    
    # MCP reference
    "DESIGN_PATTERNS_MCP_SETUP.md": "docs/current/MCP_SETUP.md",
    "HEDERA_MCP_QUICK_REFERENCE.md": "docs/current/HEDERA_REFERENCE.md",
    "HEDERA_CONSENSUS_MCP_STRATEGY.md": "docs/current/HEDERA_STRATEGY.md",
    
    # V2 archive
    "V2_COMPLETE_SPECIFICATION.md": "docs/archive/v2/SPECIFICATION.md",
    "V2_SYSTEM_README.md": "docs/archive/v2/SYSTEM_README.md",
    "V2_MASTER_GUIDE.md": "docs/archive/v2/MASTER_GUIDE.md",
    "V2_FINAL_STATUS.txt": "docs/archive/v2/FINAL_STATUS.txt",
    "UNIFIED_AGENT_MORPHING_SPECIFICATION_V2.md": "docs/archive/v2/MORPHING_SPEC.md",
    
    # V1 archive
    "AGENT_MORPHING_SPECIFICATION.md": "docs/archive/v1/MORPHING_SPEC.md",
    "LOSSLESS_AGENT_MORPHING.md": "docs/archive/v1/LOSSLESS_MORPHING.md",
    "LOSSLESS_MORPHING_README.md": "docs/archive/v1/LOSSLESS_MORPHING_README.md",
    "CREWAI_VS_ELIZAOS_ANALYSIS.md": "docs/archive/v1/CREWAI_VS_ELIZAOS.md",
    "lossless_agent_morph.ts": "docs/archive/v1/lossless_agent_morph.ts",
    
    # V3.0 archive
    "FINAL_SYNTHESIS.md": "docs/archive/v3/FINAL_SYNTHESIS.md",
    "CHRYSALIS_V3_COMPLETE.md": "docs/archive/v3/COMPLETE.md",
    "KEY_LESSONS_BRIEF.md": "docs/archive/v3/KEY_LESSONS.md",
    "VERIFICATION_CHECKLIST.md": "docs/archive/v3/VERIFICATION_CHECKLIST.md",
    "LESSONS_AND_SIGNIFICANCE.md": "docs/archive/v3/LESSONS_AND_SIGNIFICANCE.md",
    
    # Deprecated
    "UAS_README.md": "docs/archive/deprecated/UAS_README.md",
    "UAS_IMPLEMENTATION_SUMMARY.md": "docs/archive/deprecated/UAS_IMPLEMENTATION_SUMMARY.md",
    "UAS_QuickStart.md": "docs/archive/deprecated/UAS_QuickStart.md",
    "UAS_V2_MEMORY_GUIDE.md": "docs/archive/deprecated/UAS_V2_MEMORY_GUIDE.md",
    "UAS_V2_RELEASE_SUMMARY.md": "docs/archive/deprecated/UAS_V2_RELEASE_SUMMARY.md",
    "UniformSemanticAgentSpecification.md": "docs/archive/deprecated/UniformSemanticAgentSpecification.md",
    "README_MORPHING_SYSTEM.md": "docs/archive/deprecated/README_MORPHING_SYSTEM.md",
    "README_MEMORY_V1.md": "docs/archive/deprecated/old-memory/README_MEMORY_V1.md",
    "ComprehensiveReviewPrompt.md": "docs/archive/deprecated/ComprehensiveReviewPrompt.md",
    "UNIVERSAL_AGENT_BRIDGE_README.md": "docs/archive/deprecated/UNIVERSAL_AGENT_BRIDGE_README.md",
    "universal_agent_bridge.ts": "docs/archive/deprecated/universal_agent_bridge.ts",
    "universal_agent_types.ts": "docs/archive/deprecated/universal_agent_types.ts",
    "GIT_INIT_CONFIRMATION.md": "docs/archive/deprecated/GIT_INIT_CONFIRMATION.md",
    "GIT_PUSH_STATUS.md": "docs/archive/deprecated/GIT_PUSH_STATUS.md",
    "ARCHITECTURE_DIAGRAM.md": "docs/archive/deprecated/ARCHITECTURE_DIAGRAM.md",
    
    # Config files
    "Congo_serena_project.yml": "projects/configs/Congo_serena_project.yml",
    "SkyPrompt_serena_project.yml": "projects/configs/SkyPrompt_serena_project.yml",
    "CRP.md": "projects/configs/CRP.md",
}

# Move GaryVision files
garyvision_files = [
    "GaryVision_agents_export.json",
    "GaryVision_agents_list.json",
    "GaryVision_crewai.yaml",
    "GaryVision_elder_photo_analysis.yaml",
    "GaryVision_load_project_to_crewai_advanced.py",
    "GaryVision_load_project_to_crewai.py",
    "GaryVision_quick_load_crewai.py",
    "GaryVision_validate_crewai_setup.py",
    "GaryVision_vision_models_elder_photo_analysis.yaml",
]

for f in garyvision_files:
    if os.path.exists(f):
        moves[f] = f"projects/GaryVision/{f}"

# GaryVision directories
if os.path.exists("GaryVision_crew_data"):
    moves["GaryVision_crew_data"] = "projects/GaryVision/crew_data"
if os.path.exists("GaryVision_teams"):
    moves["GaryVision_teams"] = "projects/GaryVision/teams"

# Move CrewPony files
crewpony_files = [
    "CrewPony_CrewToDo.json",
    "CrewPony_crewtools.json",
    "CrewPony_development_teams.py",
    "CrewPony_guide_config.yaml",
    "CrewPony_load_crewai_teams.py",
    "CrewPony_serena_project.yml",
    "CrewPony_teams_export.json",
]

for f in crewpony_files:
    if os.path.exists(f):
        moves[f] = f"projects/CrewPony/{f}"

# Move other project files
other_projects = {
    "deer-flow_agents.py": "projects/deer-flow/agents.py",
    "deer-flow_tool_interceptor.py": "projects/deer-flow/tool_interceptor.py",
    "LeatherLadder_mcp_agent_mixin.py": "projects/LeatherLadder/mcp_agent_mixin.py",
    "LeatherLadder_mr_shoe_leather_agent.py": "projects/LeatherLadder/mr_shoe_leather_agent.py",
    "Ludwig_eliza_bridge.py": "projects/Ludwig/eliza_bridge.py",
}

moves.update(other_projects)

# Execute moves
print("📦 Moving files...")
moved_count = 0
skipped_count = 0

for src, dest in moves.items():
    src_path = Path(src)
    dest_path = Path(dest)
    
    if src_path.exists():
        try:
            # Create parent directory if needed
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Move file or directory
            if src_path.is_dir():
                if dest_path.exists():
                    shutil.rmtree(dest_path)
                shutil.move(str(src_path), str(dest_path))
            else:
                shutil.move(str(src_path), str(dest_path))
            
            print(f"  ✓ {src} → {dest}")
            moved_count += 1
        except Exception as e:
            print(f"  ✗ {src}: {e}")
            skipped_count += 1
    else:
        skipped_count += 1

print()
print(f"✅ Moved {moved_count} files/directories")
print(f"⏭️  Skipped {skipped_count} (already moved or not found)")
print()

# Remove temporary files
print("🧹 Cleaning up temporary files...")
temp_files = ["git-init.sh", "reorganize.sh", "RIGOROUS_COMPLETION_SUMMARY.txt"]
for f in temp_files:
    if Path(f).exists():
        Path(f).unlink()
        print(f"  ✓ Removed {f}")

print()

# Count results
print("📊 Results:")
print(f"  Current specs: {len(list(Path('docs/current').glob('*.md')))} files")
print(f"  Research docs: {len(list(Path('docs/research').rglob('*.md')))} files")
print(f"  Archived docs: {len(list(Path('docs/archive').rglob('*.md')))} files")
print(f"  Memory docs: {len(list(Path('docs/current/memory').glob('*.md')))} files")
print(f"  Projects: {len([d for d in Path('projects').iterdir() if d.is_dir()])} directories")
print(f"  Root MD files: {len(list(Path('.').glob('*.md')))} files")
print()

# List root markdown files
print("📄 Remaining root markdown files:")
root_mds = sorted(Path('.').glob('*.md'))
for md in root_mds:
    print(f"  - {md.name}")

print()
print("✅ Reorganization Complete!")
print()
print("📖 Next steps:")
print("  1. Review structure: ls docs/current/")
print("  2. Read navigation: cat docs/README.md")
print("  3. Commit changes: git add -A && git commit -m 'docs: reorganize'")
print()

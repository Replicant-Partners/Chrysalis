#!/usr/bin/env python3
"""
Test script for Team 1 Elder UX Crew
"""

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

try:
    from agents.teams.team_1_elder_ux import elder_ux_crew
    print("✅ Successfully imported elder_ux_crew")
    print(f"   Agents: {len(elder_ux_crew.agents)}")
    print(f"   Tasks: {len(elder_ux_crew.tasks)}")
    print(f"   Process: {elder_ux_crew.process}")
    print("\n✅ Import successful! You can now execute:")
    print("   result = elder_ux_crew.kickoff()")
except ImportError as e:
    print(f"❌ Import error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

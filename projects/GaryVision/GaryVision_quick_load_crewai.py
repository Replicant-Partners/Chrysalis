#!/usr/bin/env python3
"""
Quick CrewAI Loader for GaryVision
Simplest way to load and execute existing CrewAI plans.
"""

import os
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

def check_environment():
    """Check if environment is set up correctly."""
    issues = []
    
    # Check API keys
    if not os.getenv('ANTHROPIC_API_KEY') and not os.getenv('OPENAI_API_KEY'):
        issues.append("❌ No API key found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY")
    
    # Check CrewAI installation
    try:
        import crewai
        print(f"✅ CrewAI installed: {crewai.__version__}")
    except ImportError:
        issues.append("❌ CrewAI not installed. Run: pip install crewai crewai-tools")
    
    # Check LLM providers
    try:
        from langchain_anthropic import ChatAnthropic
        print("✅ langchain-anthropic installed")
    except ImportError:
        issues.append("❌ langchain-anthropic not installed. Run: pip install langchain-anthropic")
    
    if issues:
        print("\n".join(issues))
        return False
    
    return True

def load_crewai_plans():
    """Load CrewAI plans from existing files."""
    agents_dir = Path(__file__).parent
    
    # Check if plan files exist
    plan_files = [
        agents_dir / "CREWAI_COMPLETE_SPECIFICATIONS.md",
        agents_dir / "CREWAI_AGENT_TEAM_PLANS.md",
    ]
    
    existing_plans = [f for f in plan_files if f.exists()]
    
    if not existing_plans:
        print("❌ No CrewAI plan files found")
        print(f"   Expected in: {agents_dir}")
        return None
    
    print(f"✅ Found {len(existing_plans)} CrewAI plan file(s)")
    for plan in existing_plans:
        print(f"   - {plan.name}")
    
    return existing_plans

def main():
    """Main entry point."""
    print("="*60)
    print("GaryVision CrewAI Quick Loader")
    print("="*60)
    print()
    
    # Check environment
    print("Checking environment...")
    if not check_environment():
        print("\n❌ Environment check failed. Please fix issues above.")
        sys.exit(1)
    
    print()
    
    # Check for plans
    print("Checking for CrewAI plans...")
    plans = load_crewai_plans()
    
    if not plans:
        print("\n❌ No CrewAI plans found.")
        print("\nTo generate plans from specifications:")
        print("  python load_project_to_crewai_advanced.py --source local --path .")
        sys.exit(1)
    
    print()
    print("="*60)
    print("✅ Ready to execute CrewAI crews!")
    print("="*60)
    print()
    print("To execute crews, import them directly:")
    print()
    print("  from agents.teams.team_1_elder_ux import elder_ux_crew")
    print("  result = elder_ux_crew.kickoff()")
    print()
    print("Or use the team files directly:")
    print("  python agents/teams/team_1_elder_ux.py")
    print()

if __name__ == "__main__":
    main()

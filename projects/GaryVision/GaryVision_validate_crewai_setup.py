#!/usr/bin/env python3
"""
Validate CrewAI Setup
Tests that all modules can be imported and configured without executing crews.
"""

import sys
import os
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

def validate_setup():
    """Validate CrewAI setup without executing."""
    print("="*60)
    print("CrewAI Setup Validation")
    print("="*60)
    print()
    
    errors = []
    warnings = []
    
    # Check 1: Python version
    print("1. Checking Python version...")
    if sys.version_info >= (3, 10):
        print(f"   ✅ Python {sys.version_info.major}.{sys.version_info.minor}")
    else:
        errors.append("Python 3.10+ required")
        print(f"   ❌ Python {sys.version_info.major}.{sys.version_info.minor} (need 3.10+)")
    
    # Check 2: CrewAI installation
    print("\n2. Checking CrewAI installation...")
    try:
        import crewai
        print(f"   ✅ CrewAI {crewai.__version__ if hasattr(crewai, '__version__') else 'installed'}")
    except ImportError:
        errors.append("CrewAI not installed")
        print("   ❌ CrewAI not installed")
        print("      Install: pip install crewai crewai-tools")
    
    # Check 3: LangChain providers
    print("\n3. Checking LangChain providers...")
    try:
        from langchain_anthropic import ChatAnthropic
        print("   ✅ langchain-anthropic installed")
    except ImportError:
        warnings.append("langchain-anthropic not installed")
        print("   ⚠️  langchain-anthropic not installed")
        print("      Install: pip install langchain-anthropic")
    
    try:
        from langchain_openai import ChatOpenAI
        print("   ✅ langchain-openai installed")
    except ImportError:
        warnings.append("langchain-openai not installed")
        print("   ⚠️  langchain-openai not installed")
        print("      Install: pip install langchain-openai")
    
    # Check 4: API keys
    print("\n4. Checking API keys...")
    anthropic_key = os.getenv('ANTHROPIC_API_KEY')
    openai_key = os.getenv('OPENAI_API_KEY')
    
    if anthropic_key:
        print(f"   ✅ ANTHROPIC_API_KEY set (length: {len(anthropic_key)})")
    else:
        warnings.append("ANTHROPIC_API_KEY not set")
        print("   ⚠️  ANTHROPIC_API_KEY not set")
    
    if openai_key:
        print(f"   ✅ OPENAI_API_KEY set (length: {len(openai_key)})")
    else:
        warnings.append("OPENAI_API_KEY not set")
        print("   ⚠️  OPENAI_API_KEY not set")
    
    if not anthropic_key and not openai_key:
        print("   ⚠️  No API keys found - crews won't execute")
        print("      Set: export ANTHROPIC_API_KEY='your-key'")
    
    # Check 5: Module structure
    print("\n5. Checking module structure...")
    agents_dir = project_root / "agents"
    teams_dir = agents_dir / "teams"
    config_dir = agents_dir / "config"
    
    checks = [
        (agents_dir / "__init__.py", "agents/__init__.py"),
        (config_dir / "__init__.py", "agents/config/__init__.py"),
        (teams_dir / "__init__.py", "agents/teams/__init__.py"),
        (teams_dir / "team_1_elder_ux.py", "agents/teams/team_1_elder_ux.py"),
    ]
    
    for path, name in checks:
        if path.exists():
            print(f"   ✅ {name}")
        else:
            errors.append(f"{name} missing")
            print(f"   ❌ {name} missing")
    
    # Check 6: Import test
    print("\n6. Testing imports...")
    try:
        from agents.config import get_specialist_llm, standard_tools
        print("   ✅ agents.config imports successfully")
    except Exception as e:
        errors.append(f"agents.config import failed: {e}")
        print(f"   ❌ agents.config import failed: {e}")
    
    try:
        from agents.teams.team_1_elder_ux import elder_ux_crew
        print("   ✅ agents.teams.team_1_elder_ux imports successfully")
        print(f"      Crew has {len(elder_ux_crew.agents)} agents")
        print(f"      Crew has {len(elder_ux_crew.tasks)} tasks")
    except Exception as e:
        errors.append(f"agents.teams.team_1_elder_ux import failed: {e}")
        print(f"   ❌ agents.teams.team_1_elder_ux import failed: {e}")
        import traceback
        traceback.print_exc()
    
    # Check 7: LLM initialization (if API key available)
    print("\n7. Testing LLM initialization...")
    if anthropic_key or openai_key:
        try:
            from agents.config import get_specialist_llm
            llm = get_specialist_llm()
            print(f"   ✅ LLM initialized: {type(llm).__name__}")
        except Exception as e:
            warnings.append(f"LLM initialization failed: {e}")
            print(f"   ⚠️  LLM initialization failed: {e}")
    else:
        print("   ⚠️  Skipped (no API key)")
    
    # Summary
    print("\n" + "="*60)
    print("Validation Summary")
    print("="*60)
    
    if errors:
        print(f"\n❌ Errors: {len(errors)}")
        for error in errors:
            print(f"   - {error}")
    
    if warnings:
        print(f"\n⚠️  Warnings: {len(warnings)}")
        for warning in warnings:
            print(f"   - {warning}")
    
    if not errors and not warnings:
        print("\n✅ All checks passed! Ready to execute crews.")
        return True
    elif not errors:
        print("\n⚠️  Setup complete but with warnings. Crews may not execute without API keys.")
        return True
    else:
        print("\n❌ Setup incomplete. Please fix errors above.")
        return False

if __name__ == "__main__":
    success = validate_setup()
    sys.exit(0 if success else 1)

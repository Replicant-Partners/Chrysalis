#!/usr/bin/env python3
"""
Load CrewPony CrewAI Teams

This script loads the CrewAI agents, tasks, and crews for CrewPony development
and optionally runs a test crew execution.
"""

import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from crews.crewpony_development_teams import get_crewpony_teams
    from dotenv import load_dotenv
except ImportError as e:
    print(f"Error importing modules: {e}")
    print("\nPlease ensure:")
    print("1. python-dotenv is installed: pip install python-dotenv")
    print("2. CrewAI is installed: pip install crewai")
    print("3. All dependencies from requirements.txt are installed")
    sys.exit(1)


def check_api_keys():
    """Check for API keys in environment"""
    load_dotenv()
    
    api_keys = {
        'ANTHROPIC_API_KEY': os.getenv('ANTHROPIC_API_KEY'),
        'OPENAI_API_KEY': os.getenv('OPENAI_API_KEY'),
    }
    
    has_anthropic = bool(api_keys['ANTHROPIC_API_KEY'])
    has_openai = bool(api_keys['OPENAI_API_KEY'])
    
    print("API Keys Status:")
    print(f"  Anthropic (Claude): {'✅ Found' if has_anthropic else '❌ Not found'}")
    print(f"  OpenAI: {'✅ Found' if has_openai else '❌ Not found'}")
    
    if not has_anthropic and not has_openai:
        print("\n⚠️  Warning: No LLM API keys found!")
        print("Set ANTHROPIC_API_KEY or OPENAI_API_KEY environment variable")
        print("Or create a .env file with your API keys")
        return None
    
    return api_keys


def load_and_display_config(api_keys):
    """Load CrewAI configuration and display summary"""
    print("\n" + "=" * 60)
    print("Loading CrewPony CrewAI Teams Configuration")
    print("=" * 60)
    
    try:
        config = get_crewpony_teams(api_keys)
        
        print(f"\n✅ Configuration loaded successfully!")
        print(f"\nAgents: {len(config['agents'])}")
        for i, agent in enumerate(config['agents'], 1):
            llm_info = "Unknown"
            if hasattr(agent, 'llm'):
                if agent.llm:
                    llm_info = str(agent.llm).split('.')[-1].split('(')[0]
            print(f"  {i}. {agent.role}")
            print(f"     Goal: {agent.goal[:80]}...")
            print(f"     LLM: {llm_info}")
            print(f"     Memory: {agent.memory}, Delegation: {agent.allow_delegation}")
            print()
        
        print(f"\nTasks: {len(config['tasks'])}")
        for i, task in enumerate(config['tasks'], 1):
            agent_role = task.agent.role if task.agent else "Unassigned"
            print(f"  {i}. {task.description[:80]}...")
            print(f"     Agent: {agent_role}")
            print(f"     Output: {task.output_file}")
            print()
        
        print(f"\nCrews: {len(config['crews'])}")
        for i, crew in enumerate(config['crews'], 1):
            process_type = crew.process if hasattr(crew, 'process') else "Unknown"
            print(f"  Crew {i}:")
            print(f"     Agents: {len(crew.agents)}")
            print(f"     Tasks: {len(crew.tasks)}")
            print(f"     Process: {process_type}")
            print()
        
        return config
        
    except Exception as e:
        print(f"\n❌ Error loading configuration: {e}")
        import traceback
        traceback.print_exc()
        return None


def test_crew_execution(config, crew_index=0, dry_run=True):
    """Test executing a crew"""
    if not config or not config['crews']:
        print("No crews available to test")
        return False
    
    if crew_index >= len(config['crews']):
        print(f"Crew index {crew_index} out of range (max: {len(config['crews'])-1})")
        return False
    
    crew = config['crews'][crew_index]
    
    print("\n" + "=" * 60)
    print(f"Testing Crew {crew_index + 1} Execution")
    print("=" * 60)
    print(f"Agents: {len(crew.agents)}")
    print(f"Tasks: {len(crew.tasks)}")
    
    if dry_run:
        print("\n🔍 Dry run mode - not executing crew")
        print("To actually execute, run with --execute flag")
        return True
    
    print("\n🚀 Executing crew...")
    try:
        result = crew.kickoff()
        print("\n✅ Crew execution completed!")
        print(f"\nResult:\n{result}")
        return True
    except Exception as e:
        print(f"\n❌ Error during crew execution: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Load CrewPony CrewAI Teams")
    parser.add_argument(
        '--execute',
        action='store_true',
        help='Actually execute a crew (default is dry run)'
    )
    parser.add_argument(
        '--crew',
        type=int,
        default=0,
        help='Crew index to execute (default: 0)'
    )
    parser.add_argument(
        '--list-only',
        action='store_true',
        help='Only list configuration, do not test execution'
    )
    
    args = parser.parse_args()
    
    # Check for API keys
    api_keys = check_api_keys()
    if api_keys is None:
        print("\nCannot proceed without API keys")
        sys.exit(1)
    
    # Load configuration
    config = load_and_display_config(api_keys)
    if config is None:
        sys.exit(1)
    
    # Test execution if requested
    if not args.list_only:
        success = test_crew_execution(config, crew_index=args.crew, dry_run=not args.execute)
        if not success:
            sys.exit(1)
    
    print("\n" + "=" * 60)
    print("✅ CrewAI Teams Configuration Loaded Successfully")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Review agent definitions and backstories")
    print("2. Expand task definitions from ROADMAP.md")
    print("3. Add more teams (WebSocket, LLM, RAG, etc.)")
    print("4. Test crew execution with --execute flag")
    print("5. Integrate with CrewPony infrastructure")


if __name__ == "__main__":
    main()



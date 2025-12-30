#!/usr/bin/env python3
"""
CrewPony Development Teams - CrewAI Configuration

This module defines CrewAI agents, tasks, and crews specifically for developing
CrewPony itself. It integrates metacognitive frameworks (Tetlock, Dunning-Kruger,
Toyota Kata) into agent backstories and behaviors.

Status: Initial Implementation - Basic structure with example agents
"""

from typing import List, Dict, Any, Optional
from pathlib import Path
import os

# CrewAI imports
from crewai import Agent, Task, Crew, Process
from crewai_tools import (
    FileReadTool,
    FileWriterTool,  # Renamed from FileWriterTool in crewai-tools 1.7+
    DirectoryReadTool,
    CodeInterpreterTool,
    GithubSearchTool,  # GithubSearchTool was removed in crewai-tools 1.7+
)

# LLM imports
try:
    from langchain_anthropic import ChatAnthropic
    from langchain_openai import ChatOpenAI
except ImportError:
    # Handle import errors gracefully
    ChatAnthropic = None
    ChatOpenAI = None


# ============================================================================
# METACOGNITIVE FRAMEWORK EXTENSIONS
# ============================================================================

METACOGNITIVE_FRAMEWORKS_INTRO = """
You integrate multiple metacognitive frameworks to enhance decision-making,
self-awareness, and continuous improvement:

1. **Tetlock Forecasting**: Practice probabilistic thinking and calibrated forecasting
2. **Dunning-Kruger Awareness**: Match confidence to actual competence, know your limits
3. **Toyota Kata**: Use scientific thinking and continuous improvement cycles
"""

TETLOCK_FORECASTING_EXTENSION = """
**Forecasting Accuracy (Tetlock)**:
- Express predictions as probabilities (e.g., "70% confident")
- Use base rates and reference classes
- Decompose complex problems into components
- Consider alternative scenarios (best/worst/most likely)
- Track and calibrate predictions over time
- Update beliefs based on evidence (Bayesian thinking)
"""

DUNNING_KRUGER_EXTENSION = """
**Self-Awareness (Dunning-Kruger)**:
- Assess your own expertise level honestly
- Match confidence to actual competence
- Recognize when operating at expertise boundaries
- Seek help when approaching limits
- Actively identify blind spots
- Use feedback to calibrate self-assessment
"""

TOYOTA_KATA_EXTENSION = """
**Continuous Improvement (Toyota Kata)**:
- Define target condition clearly
- Grasp current condition honestly
- Identify obstacles systematically
- Use 5 Whys for root cause analysis
- Form testable hypotheses
- Run small experiments (PDCA cycles)
- Learn and iterate continuously
"""


# ============================================================================
# LLM SETUP
# ============================================================================

def setup_llms(api_keys: Dict[str, str]) -> Dict[str, Any]:
    """
    Setup LLM configurations for different agent tiers.
    
    Returns:
        Dictionary with 'orchestrator', 'specialist', and 'worker' LLMs
    """
    llms = {}
    
    # Orchestrator LLM (for managers/coordinators)
    if api_keys.get('ANTHROPIC_API_KEY') and ChatAnthropic:
        llms['orchestrator'] = ChatAnthropic(
            model="claude-3-opus-20240229",
            temperature=0.3,
            max_tokens=4096,
            api_key=api_keys['ANTHROPIC_API_KEY']
        )
    elif api_keys.get('OPENAI_API_KEY') and ChatOpenAI:
        llms['orchestrator'] = ChatOpenAI(
            model="gpt-4-turbo-preview",
            temperature=0.3,
            max_tokens=4096,
            api_key=api_keys['OPENAI_API_KEY']
        )
    
    # Specialist LLM (for domain experts)
    if api_keys.get('ANTHROPIC_API_KEY') and ChatAnthropic:
        llms['specialist'] = ChatAnthropic(
            model="claude-3-sonnet-20240229",
            temperature=0.5,
            max_tokens=4096,
            api_key=api_keys['ANTHROPIC_API_KEY']
        )
    elif api_keys.get('OPENAI_API_KEY') and ChatOpenAI:
        llms['specialist'] = ChatOpenAI(
            model="gpt-4",
            temperature=0.5,
            max_tokens=4096,
            api_key=api_keys['OPENAI_API_KEY']
        )
    
    # Worker LLM (for specialists/testers)
    if api_keys.get('ANTHROPIC_API_KEY') and ChatAnthropic:
        llms['worker'] = ChatAnthropic(
            model="claude-3-haiku-20240307",
            temperature=0.3,
            max_tokens=2048,
            api_key=api_keys['ANTHROPIC_API_KEY']
        )
    elif api_keys.get('OPENAI_API_KEY') and ChatOpenAI:
        llms['worker'] = ChatOpenAI(
            model="gpt-3.5-turbo",
            temperature=0.3,
            max_tokens=2048,
            api_key=api_keys['OPENAI_API_KEY']
        )
    
    return llms


# ============================================================================
# TOOLS SETUP
# ============================================================================

def setup_tools() -> Dict[str, Any]:
    """Setup CrewAI tools for agents"""
    return {
        'file_read': FileReadTool(),
        'file_write': FileWriterTool(),
        'directory_read': DirectoryReadTool(),
        'code_interpreter': CodeInterpreterTool(),
        'git': GithubSearchTool(),
    }


# ============================================================================
# AGENT DEFINITIONS
# ============================================================================

def create_security_agents(llms: Dict[str, Any], tools: Dict[str, Any]) -> List[Agent]:
    """
    Create agents for Security team.
    
    Domain: AES-256 encryption, RBAC, input validation, prompt injection detection
    """
    agents = []
    
    # Security Architect Agent
    security_architect = Agent(
        role="Senior Security Architect for CrewPony",
        goal="Maintain and enhance CrewPony's security infrastructure including AES-256 encryption, RBAC, and prompt injection detection",
        backstory=f"""You are a security expert with 15+ years in cybersecurity, 
                    specializing in AI/ML security. You understand:
                    - FIPS 197 AES-256 encryption standards
                    - OWASP security guidelines
                    - Prompt injection attack vectors
                    - RBAC implementation patterns
                    
                    You've been working on CrewPony's security layer since its inception
                    and deeply understand the threat model and security requirements.
                    You balance security with usability, always considering the human-in-the-loop paradigm.
                    
                    {METACOGNITIVE_FRAMEWORKS_INTRO}
                    {TETLOCK_FORECASTING_EXTENSION}
                    {DUNNING_KRUGER_EXTENSION}
                    {TOYOTA_KATA_EXTENSION}
                    """,
        tools=[
            tools['file_read'],
            tools['file_write'],
            tools['code_interpreter'],
            tools['git'],
        ],
        llm=llms.get('specialist'),
        verbose=True,
        allow_delegation=True,
        max_iter=12,
        max_execution_time=3600,
        memory=True,
        allow_code_execution=True,
    )
    agents.append(security_architect)
    
    return agents


def create_terminal_agents(llms: Dict[str, Any], tools: Dict[str, Any]) -> List[Agent]:
    """
    Create agents for Terminal Management team.
    
    Domain: PTY control, session management, command injection
    """
    agents = []
    
    # Terminal Systems Engineer
    terminal_engineer = Agent(
        role="Terminal Systems Engineer",
        goal="Develop and maintain CrewPony's terminal session management, PTY control, and command injection capabilities",
        backstory=f"""You are a systems engineer specializing in terminal emulation,
                    PTY management, and process control. You have deep expertise in:
                    - Unix/Linux PTY (pseudo-terminal) internals
                    - Process management and session isolation
                    - Command injection patterns and safety
                    - Real-time output capture and streaming
                    
                    You understand the challenges of managing multiple agent terminal
                    sessions concurrently while maintaining security and performance.
                    
                    {METACOGNITIVE_FRAMEWORKS_INTRO}
                    {TETLOCK_FORECASTING_EXTENSION}
                    {DUNNING_KRUGER_EXTENSION}
                    {TOYOTA_KATA_EXTENSION}
                    """,
        tools=[
            tools['file_read'],
            tools['file_write'],
            tools['code_interpreter'],
            tools['git'],
        ],
        llm=llms.get('specialist'),
        verbose=True,
        allow_delegation=True,
        max_iter=10,
        max_execution_time=3600,
        memory=True,
        allow_code_execution=True,
    )
    agents.append(terminal_engineer)
    
    return agents


def create_frontend_agents(llms: Dict[str, Any], tools: Dict[str, Any]) -> List[Agent]:
    """
    Create agents for Frontend UI team.
    
    Domain: React/TypeScript components, UI/UX, agent windows (currently 0% complete)
    """
    agents = []
    
    # Frontend Architect
    frontend_architect = Agent(
        role="Frontend UI Architect",
        goal="Design and implement CrewPony's React/TypeScript frontend UI for agent management and monitoring",
        backstory=f"""You are a frontend architect with expertise in:
                    - React and TypeScript
                    - Real-time UI updates and WebSocket integration
                    - Agent interface design and UX
                    - Accessibility and usability
                    
                    You understand that CrewPony currently has no frontend implementation
                    (0% complete) and need to build from scratch. You'll design an intuitive
                    interface for human-in-the-loop agent orchestration.
                    
                    {METACOGNITIVE_FRAMEWORKS_INTRO}
                    {TETLOCK_FORECASTING_EXTENSION}
                    {DUNNING_KRUGER_EXTENSION}
                    {TOYOTA_KATA_EXTENSION}
                    """,
        tools=[
            tools['file_read'],
            tools['file_write'],
            tools['code_interpreter'],
            tools['git'],
        ],
        llm=llms.get('specialist'),
        verbose=True,
        allow_delegation=True,
        max_iter=12,
        max_execution_time=3600,
        memory=True,
        allow_code_execution=True,
    )
    agents.append(frontend_architect)
    
    return agents


def create_testing_agents(llms: Dict[str, Any], tools: Dict[str, Any]) -> List[Agent]:
    """
    Create agents for Testing team.
    
    Domain: Unit tests, integration tests, E2E tests (currently ~5% complete)
    """
    agents = []
    
    # Test Engineer
    test_engineer = Agent(
        role="Test Engineer",
        goal="Develop comprehensive test coverage for CrewPony including unit, integration, and E2E tests",
        backstory=f"""You are a test engineer specializing in:
                    - Python testing frameworks (pytest)
                    - Test coverage strategies
                    - Integration testing patterns
                    - E2E testing for agent systems
                    
                    You understand CrewPony currently has minimal test coverage (~5%)
                    and need to build a comprehensive testing infrastructure from the ground up.
                    
                    {METACOGNITIVE_FRAMEWORKS_INTRO}
                    {TETLOCK_FORECASTING_EXTENSION}
                    {DUNNING_KRUGER_EXTENSION}
                    {TOYOTA_KATA_EXTENSION}
                    """,
        tools=[
            tools['file_read'],
            tools['file_write'],
            tools['code_interpreter'],
            tools['git'],
        ],
        llm=llms.get('worker'),
        verbose=True,
        allow_delegation=False,
        max_iter=10,
        max_execution_time=3600,
        memory=True,
        allow_code_execution=True,
    )
    agents.append(test_engineer)
    
    return agents


def create_coordination_agents(llms: Dict[str, Any], tools: Dict[str, Any]) -> List[Agent]:
    """
    Create agents for Coordination/Integration team.
    
    Domain: Cross-team integration, dependency management, quality gates
    """
    agents = []
    
    # Project Orchestrator
    project_orchestrator = Agent(
        role="Senior Project Manager and Agent Coordinator",
        goal="Coordinate all CrewPony development teams, manage dependencies, ensure milestones, and maintain project momentum",
        backstory=f"""You are an expert project manager with experience coordinating
                    large-scale AI agent teams. You manage dependencies, resolve blockers,
                    and maintain project momentum. You understand CrewPony's architecture
                    and can coordinate between security, terminal, websocket, LLM, RAG,
                    frontend, and testing teams.
                    
                    {METACOGNITIVE_FRAMEWORKS_INTRO}
                    {TETLOCK_FORECASTING_EXTENSION}
                    {DUNNING_KRUGER_EXTENSION}
                    {TOYOTA_KATA_EXTENSION}
                    """,
        tools=[
            tools['file_read'],
            tools['file_write'],
            tools['git'],
        ],
        llm=llms.get('orchestrator'),
        verbose=True,
        allow_delegation=True,
        max_iter=15,
        max_execution_time=7200,
        memory=True,
        allow_code_execution=False,
    )
    agents.append(project_orchestrator)
    
    # Integration Specialist
    integration_specialist = Agent(
        role="Cross-Team Integration Expert",
        goal="Ensure cross-team compatibility and seamless integration between CrewPony components",
        backstory=f"""You specialize in ensuring components built by different teams
                    integrate seamlessly. You understand API contracts, data formats,
                    and integration patterns. You validate that security, terminal,
                    websocket, LLM, and RAG components work together correctly.
                    
                    {METACOGNITIVE_FRAMEWORKS_INTRO}
                    {TETLOCK_FORECASTING_EXTENSION}
                    {DUNNING_KRUGER_EXTENSION}
                    {TOYOTA_KATA_EXTENSION}
                    """,
        tools=[
            tools['file_read'],
            tools['file_write'],
            tools['code_interpreter'],
            tools['git'],
        ],
        llm=llms.get('specialist'),
        verbose=True,
        allow_delegation=False,
        max_iter=10,
        max_execution_time=3600,
        memory=True,
        allow_code_execution=True,
    )
    agents.append(integration_specialist)
    
    return agents


# ============================================================================
# ALL AGENTS
# ============================================================================

def create_all_agents(api_keys: Dict[str, str]) -> List[Agent]:
    """
    Create all CrewPony development agents.
    
    Args:
        api_keys: Dictionary with 'ANTHROPIC_API_KEY' and/or 'OPENAI_API_KEY'
    
    Returns:
        List of all agents for CrewPony development
    """
    llms = setup_llms(api_keys)
    tools = setup_tools()
    
    all_agents = []
    
    # Create agents for each team
    all_agents.extend(create_security_agents(llms, tools))
    all_agents.extend(create_terminal_agents(llms, tools))
    all_agents.extend(create_frontend_agents(llms, tools))
    all_agents.extend(create_testing_agents(llms, tools))
    all_agents.extend(create_coordination_agents(llms, tools))
    
    return all_agents


# ============================================================================
# TASK DEFINITIONS
# ============================================================================

def create_initial_tasks(agents: List[Agent]) -> List[Task]:
    """
    Create initial tasks for CrewPony development.
    
    This is a basic implementation - tasks should be expanded based on
    actual work items from ROADMAP.md and STATUS.md
    """
    tasks = []
    
    # Find agents by role
    security_architect = next((a for a in agents if "Security Architect" in a.role), None)
    frontend_architect = next((a for a in agents if "Frontend UI Architect" in a.role), None)
    test_engineer = next((a for a in agents if "Test Engineer" in a.role), None)
    
    # Example: Frontend UI Task (high priority - 0% complete)
    if frontend_architect:
        frontend_task = Task(
            description="""Design and implement the initial React/TypeScript frontend
                          for CrewPony agent management.
                          
                          Requirements:
                          - React + TypeScript setup
                          - WebSocket integration for real-time updates
                          - Agent status monitoring interface
                          - Basic agent window components
                          - Integration with existing CrewPony backend
                          
                          Deliverables:
                          - Frontend project structure
                          - Core components (AgentList, AgentWindow, StatusMonitor)
                          - WebSocket client integration
                          - Basic styling and layout
                          - Documentation for component usage
                          
                          Consider:
                          - Human-in-the-loop UX patterns
                          - Real-time updates and performance
                          - Accessibility requirements
                          - Future extensibility""",
            agent=frontend_architect,
            expected_output="""Frontend implementation with:
                            - Project structure in crewpony-ui/
                            - Core React components
                            - WebSocket integration
                            - Basic UI for agent management
                            - README with usage instructions""",
            output_file="crews/tasks/frontend_initial_implementation.md",
            tools=[FileReadTool(), FileWriterTool(), CodeInterpreterTool(), GithubSearchTool()],
        )
        tasks.append(frontend_task)
    
    # Example: Testing Infrastructure Task
    if test_engineer:
        testing_task = Task(
            description="""Develop comprehensive testing infrastructure for CrewPony.
                          
                          Current state: ~5% test coverage
                          Target: 80%+ coverage for critical paths
                          
                          Requirements:
                          - Expand unit test coverage for core modules
                          - Create integration tests for component interactions
                          - Design E2E test framework for agent workflows
                          - Set up test automation and CI integration
                          
                          Focus areas:
                          - security_utils.py (security layer)
                          - terminal_session_manager.py (terminal management)
                          - websocket_connector.py (real-time communication)
                          - guide_llm_system.py (LLM orchestration)
                          
                          Deliverables:
                          - Test suite expansion
                          - Integration test framework
                          - E2E test patterns
                          - Test documentation
                          - Coverage reports""",
            agent=test_engineer,
            expected_output="""Testing infrastructure with:
                            - Expanded unit tests (target: 80%+ coverage)
                            - Integration test suite
                            - E2E test framework
                            - Test documentation
                            - CI integration configuration""",
            output_file="crews/tasks/testing_infrastructure.md",
            tools=[FileReadTool(), FileWriterTool(), CodeInterpreterTool(), GithubSearchTool()],
        )
        tasks.append(testing_task)
    
    return tasks


# ============================================================================
# CREW CONFIGURATIONS
# ============================================================================

def create_crews(agents: List[Agent], tasks: List[Task], api_keys: Dict[str, str]) -> List[Crew]:
    """
    Create CrewAI crews for CrewPony development teams.
    
    Args:
        agents: List of all agents
        tasks: List of all tasks
        api_keys: API keys for LLM setup
    
    Returns:
        List of configured crews
    """
    llms = setup_llms(api_keys)
    crews = []
    
    # Frontend Development Crew
    frontend_agents = [a for a in agents if "Frontend" in a.role]
    frontend_tasks = [t for t in tasks if "frontend" in t.output_file.lower()]
    
    if frontend_agents and frontend_tasks:
        frontend_crew = Crew(
            agents=frontend_agents,
            tasks=frontend_tasks,
            process=Process.hierarchical,
            manager_llm=llms.get('orchestrator'),
            verbose=True,
            memory=True,
            max_rpm=60,
            max_execution_time=7200,
        )
        crews.append(frontend_crew)
    
    # Testing Crew
    testing_agents = [a for a in agents if "Test" in a.role]
    testing_tasks = [t for t in tasks if "testing" in t.output_file.lower()]
    
    if testing_agents and testing_tasks:
        testing_crew = Crew(
            agents=testing_agents,
            tasks=testing_tasks,
            process=Process.sequential,
            verbose=True,
            memory=True,
            max_rpm=60,
            max_execution_time=7200,
        )
        crews.append(testing_crew)
    
    return crews


# ============================================================================
# MAIN EXPORT
# ============================================================================

def get_crewpony_teams(api_keys: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """
    Get complete CrewPony development teams configuration.
    
    Args:
        api_keys: Optional dict with API keys. If None, tries to load from environment.
    
    Returns:
        Dictionary with 'agents', 'tasks', 'crews', 'llms', and 'tools'
    """
    if api_keys is None:
        api_keys = {
            'ANTHROPIC_API_KEY': os.getenv('ANTHROPIC_API_KEY'),
            'OPENAI_API_KEY': os.getenv('OPENAI_API_KEY'),
        }
    
    agents = create_all_agents(api_keys)
    tasks = create_initial_tasks(agents)
    crews = create_crews(agents, tasks, api_keys)
    llms = setup_llms(api_keys)
    tools = setup_tools()
    
    return {
        'agents': agents,
        'tasks': tasks,
        'crews': crews,
        'llms': llms,
        'tools': tools,
    }


if __name__ == "__main__":
    # Example usage
    print("CrewPony Development Teams Configuration")
    print("=" * 50)
    
    config = get_crewpony_teams()
    
    print(f"\nAgents: {len(config['agents'])}")
    for agent in config['agents']:
        print(f"  - {agent.role}")
    
    print(f"\nTasks: {len(config['tasks'])}")
    for task in config['tasks']:
        print(f"  - Assigned to: {task.agent.role if task.agent else 'Unassigned'}")
    
    print(f"\nCrews: {len(config['crews'])}")
    for i, crew in enumerate(config['crews']):
        print(f"  Crew {i+1}: {len(crew.agents)} agents, {len(crew.tasks)} tasks")
    
    print("\n" + "=" * 50)
    print("Configuration loaded successfully!")
    print("\nNext steps:")
    print("1. Review agent definitions and backstories")
    print("2. Expand task definitions based on ROADMAP.md")
    print("3. Configure crews with appropriate process types")
    print("4. Test crew execution with sample tasks")


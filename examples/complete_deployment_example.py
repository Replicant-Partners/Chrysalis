#!/usr/bin/env python3
"""
Complete Deployment Example for Universal Agent Specification
"""

import sys
from pathlib import Path
import json

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from uas_implementation import load_agent, save_agent


def main():
    print("=" * 70)
    print("Universal Agent Specification - Complete Deployment Example")
    print("=" * 70)

    # Load the simple agent first
    spec_file = Path(__file__).parent / "simple_agent.uas.yaml"
    
    print(f"\n📁 Loading agent specification...")
    spec = load_agent(str(spec_file))

    print(f"\n✅ Loaded: {spec.metadata.name} v{spec.metadata.version}")
    print(f"   {spec.metadata.description}")

    # Validate
    print("\n🔍 Validating specification...")
    try:
        spec.validate()
        print("   ✓ Validation passed!")
    except ValueError as e:
        print(f"   ✗ Validation failed: {e}")
        return

    # Display capabilities
    print(f"\n🛠️  Agent Capabilities:")
    print(f"   Tools: {len(spec.capabilities.tools)}")
    for tool in spec.capabilities.tools:
        print(f"      • {tool.name} (via {tool.protocol.value})")
        print(f"        Server: {tool.config.get('server', 'N/A')}")

    if spec.capabilities.skills:
        print(f"   Skills: {len(spec.capabilities.skills)}")
        for skill in spec.capabilities.skills:
            print(f"      • {skill.name} ({skill.type})")

    if spec.capabilities.reasoning:
        print(f"   Reasoning: {spec.capabilities.reasoning.strategy.value}")
        print(f"   Max Iterations: {spec.capabilities.reasoning.max_iterations}")

    if spec.capabilities.memory:
        print(f"   Memory: {spec.capabilities.memory.type.value} ({spec.capabilities.memory.scope})")

    # Show protocol support
    print(f"\n🔌 Protocol Support:")
    protocols = []
    
    if spec.protocols.mcp and spec.protocols.mcp.enabled:
        protocols.append(f"MCP ({spec.protocols.mcp.role.value})")
        print(f"   ✓ MCP (Model Context Protocol)")
        print(f"     Role: {spec.protocols.mcp.role.value}")
        print(f"     Servers: {len(spec.protocols.mcp.servers)}")
        for server in spec.protocols.mcp.servers:
            print(f"       • {server.name}")
            print(f"         Command: {server.command} {' '.join(server.args)}")
    
    if spec.protocols.a2a and spec.protocols.a2a.enabled:
        protocols.append(f"A2A ({spec.protocols.a2a.role})")
        print(f"   ✓ A2A (Agent2Agent Protocol)")
        print(f"     Role: {spec.protocols.a2a.role}")
        if spec.protocols.a2a.endpoint:
            print(f"     Endpoint: {spec.protocols.a2a.endpoint}")
    else:
        print(f"   ○ A2A (disabled)")
    
    if spec.protocols.agent_protocol and spec.protocols.agent_protocol.enabled:
        protocols.append("Agent Protocol")
        print(f"   ✓ Agent Protocol (Orchestration)")
        print(f"     Endpoint: {spec.protocols.agent_protocol.endpoint}")

    # Execution configuration
    print(f"\n⚙️  Execution Configuration:")
    print(f"   LLM Provider: {spec.execution.llm.provider}")
    print(f"   Model: {spec.execution.llm.model}")
    print(f"   Temperature: {spec.execution.llm.temperature}")
    print(f"   Max Tokens: {spec.execution.llm.max_tokens}")
    print(f"   Timeout: {spec.execution.runtime.timeout}s")
    print(f"   Max Iterations: {spec.execution.runtime.max_iterations}")

    # Deployment configuration
    print(f"\n🚀 Deployment Configuration:")
    print(f"   Context: {spec.deployment.context}")
    print(f"   Environment:")
    for key, value in spec.deployment.environment.items():
        print(f"      {key}: {value}")

    # Show what this agent can be deployed to
    print(f"\n📦 This agent can be deployed to:")
    deployment_options = [
        ("CrewAI", "Multi-agent workflows and autonomous task execution"),
        ("Cline/Cursor", "Interactive IDE coding assistant"),
        ("FastAPI", "REST API web service"),
        ("AWS Lambda", "Serverless function"),
        ("CLI Tool", "Command-line interface"),
        ("Docker", "Containerized service")
    ]
    
    for i, (target, description) in enumerate(deployment_options, 1):
        print(f"   {i}. {target}")
        print(f"      {description}")

    # Export for different frameworks
    print(f"\n💾 Exporting agent metadata...")

    # Export basic metadata
    metadata_export = {
        "specification_version": spec.api_version,
        "agent": {
            "name": spec.metadata.name,
            "version": spec.metadata.version,
            "description": spec.metadata.description,
            "tags": spec.metadata.tags
        },
        "identity": {
            "role": spec.identity.role,
            "goal": spec.identity.goal
        },
        "capabilities": {
            "tools": [
                {
                    "name": t.name,
                    "protocol": t.protocol.value,
                    "config": t.config
                }
                for t in spec.capabilities.tools
            ],
            "reasoning": spec.capabilities.reasoning.strategy.value if spec.capabilities.reasoning else None,
            "memory": spec.capabilities.memory.type.value if spec.capabilities.memory else None
        },
        "protocols": {
            "mcp": spec.protocols.mcp.enabled if spec.protocols.mcp else False,
            "a2a": spec.protocols.a2a.enabled if spec.protocols.a2a else False,
            "agent_protocol": spec.protocols.agent_protocol.enabled if spec.protocols.agent_protocol else False
        },
        "deployment_ready": True
    }

    output_path = Path(__file__).parent / "agent_metadata.json"
    with open(output_path, "w") as f:
        json.dump(metadata_export, f, indent=2)

    print(f"   ✓ Metadata exported to: {output_path}")

    # Generate example deployment snippets
    print(f"\n📝 Example Deployment Code:")
    
    print(f"\n   1. CrewAI Deployment:")
    print(f"      ```python")
    print(f"      from uas_implementation import load_agent")
    print(f"      from crewai import Agent, Task")
    print(f"      ")
    print(f"      spec = load_agent('{spec_file.name}')")
    print(f"      agent = Agent(")
    print(f"          role=spec.identity.role,")
    print(f"          goal=spec.identity.goal,")
    print(f"          backstory=spec.identity.backstory,")
    print(f"          verbose=True")
    print(f"      )")
    print(f"      ```")

    print(f"\n   2. FastAPI Service:")
    print(f"      ```python")
    print(f"      from fastapi import FastAPI")
    print(f"      from uas_implementation import load_agent")
    print(f"      ")
    print(f"      app = FastAPI()")
    print(f"      spec = load_agent('{spec_file.name}')")
    print(f"      ")
    print(f"      @app.post('/execute')")
    print(f"      async def execute(task: str):")
    print(f"          # Use spec to configure agent execution")
    print(f"          return {{'result': '...'}}")
    print(f"      ```")

    print(f"\n   3. Cline Configuration:")
    print(f"      ```python")
    print(f"      from uas_implementation import load_agent")
    print(f"      import json")
    print(f"      ")
    print(f"      spec = load_agent('{spec_file.name}')")
    print(f"      cline_config = generate_cline_config(spec)")
    print(f"      ")
    print(f"      with open('.vscode/cline_settings.json', 'w') as f:")
    print(f"          json.dump(cline_config, f, indent=2)")
    print(f"      ```")

    # Summary
    print(f"\n" + "=" * 70)
    print("✨ Agent Specification Summary")
    print("=" * 70)
    print(f"")
    print(f"This agent specification demonstrates the Universal Agent Specification")
    print(f"(UAS) format which enables:")
    print(f"")
    print(f"  ✓ Framework-agnostic agent definitions")
    print(f"  ✓ Portable across CrewAI, Cline, AutoGPT, etc.")
    print(f"  ✓ Protocol support (MCP, A2A, Agent Protocol)")
    print(f"  ✓ Multiple deployment contexts")
    print(f"  ✓ Version control friendly")
    print(f"  ✓ Reusable in agent marketplaces")
    print(f"")
    print(f"The agent is ready for deployment! 🎉")
    print("=" * 70)


if __name__ == "__main__":
    main()

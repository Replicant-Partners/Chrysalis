#!/usr/bin/env python3
"""
Test script to demonstrate Universal Agent Specification loading
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from uas_implementation import load_agent, save_agent


def main():
    print("=" * 60)
    print("Universal Agent Specification - Loader Test")
    print("=" * 60)
    
    # Load the example agent
    spec_file = Path(__file__).parent / "simple_agent.uas.yaml"
    
    print(f"\n📁 Loading agent from: {spec_file}")
    spec = load_agent(str(spec_file))
    
    # Display agent information
    print(f"\n✅ Agent loaded successfully!")
    print(f"\n📋 Agent Information:")
    print(f"   Name: {spec.metadata.name}")
    print(f"   Version: {spec.metadata.version}")
    print(f"   Description: {spec.metadata.description}")
    print(f"   Tags: {', '.join(spec.metadata.tags)}")
    
    print(f"\n👤 Identity:")
    print(f"   Role: {spec.identity.role}")
    print(f"   Goal: {spec.identity.goal}")
    
    print(f"\n🛠️  Capabilities:")
    print(f"   Tools: {len(spec.capabilities.tools)}")
    for tool in spec.capabilities.tools:
        print(f"      - {tool.name} (via {tool.protocol.value})")
    
    if spec.capabilities.reasoning:
        print(f"   Reasoning: {spec.capabilities.reasoning.strategy.value}")
        print(f"   Max Iterations: {spec.capabilities.reasoning.max_iterations}")
    
    if spec.capabilities.memory:
        print(f"   Memory: {spec.capabilities.memory.type.value} ({spec.capabilities.memory.scope})")
    
    print(f"\n🔌 Protocols:")
    if spec.protocols.mcp and spec.protocols.mcp.enabled:
        print(f"   MCP: Enabled (role: {spec.protocols.mcp.role.value})")
        print(f"   MCP Servers: {len(spec.protocols.mcp.servers)}")
        for server in spec.protocols.mcp.servers:
            print(f"      - {server.name}")
    
    if spec.protocols.a2a and spec.protocols.a2a.enabled:
        print(f"   A2A: Enabled (role: {spec.protocols.a2a.role})")
    else:
        print(f"   A2A: Disabled")
    
    if spec.protocols.agent_protocol and spec.protocols.agent_protocol.enabled:
        print(f"   Agent Protocol: Enabled")
    
    print(f"\n⚙️  Execution:")
    print(f"   LLM: {spec.execution.llm.provider}/{spec.execution.llm.model}")
    print(f"   Temperature: {spec.execution.llm.temperature}")
    print(f"   Timeout: {spec.execution.runtime.timeout}s")
    
    print(f"\n🚀 Deployment:")
    print(f"   Context: {spec.deployment.context}")
    print(f"   Environment: {spec.deployment.environment}")
    
    # Test saving
    print(f"\n💾 Testing save functionality...")
    output_json = Path(__file__).parent / "simple_agent.uas.json"
    save_agent(spec, str(output_json), format="json")
    print(f"   Saved as JSON: {output_json}")
    
    # Reload and verify
    print(f"\n🔄 Reloading from JSON to verify...")
    spec_json = load_agent(str(output_json))
    
    if spec_json.metadata.name == spec.metadata.name:
        print(f"   ✅ Round-trip successful!")
    else:
        print(f"   ❌ Round-trip failed!")
    
    print(f"\n" + "=" * 60)
    print("Test completed successfully! 🎉")
    print("=" * 60)


if __name__ == "__main__":
    main()

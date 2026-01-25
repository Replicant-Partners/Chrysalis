#!/usr/bin/env python3
"""
Test script for Chrysalis System Agents and Universal Adapter

Tests:
1. System agent chat via REST API
2. Universal adapter task execution
3. LLM provider connectivity

Usage:
    python scripts/test-agents.py
    python scripts/test-agents.py --agent ada
    python scripts/test-agents.py --task simple_qa
"""

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

try:
    import httpx
except ImportError:
    print("Installing httpx...")
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "httpx"], check=True)
    import httpx


# Configuration
SYSTEM_AGENTS_URL = os.environ.get("SYSTEM_AGENTS_URL", "http://localhost:3200")
GATEWAY_URL = os.environ.get("GATEWAY_URL", "http://localhost:8080")


async def test_system_agents_health():
    """Test system agents health endpoint."""
    print("\n=== Testing System Agents Health ===")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{SYSTEM_AGENTS_URL}/api/v1/system-agents/health",
                timeout=5.0
            )
            if response.status_code == 200:
                data = response.json()
                print(f"✓ Health check passed")
                print(f"  Status: {data.get('data', {}).get('status', 'unknown')}")
                print(f"  Agents: {data.get('data', {}).get('agents', [])}")
                return True
            else:
                print(f"✗ Health check failed: {response.status_code}")
                return False
        except httpx.ConnectError:
            print(f"✗ Cannot connect to system agents at {SYSTEM_AGENTS_URL}")
            print("  Start with: ./scripts/start-agents.sh")
            return False


async def test_list_agents():
    """Test listing available agents."""
    print("\n=== Testing List Agents ===")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{SYSTEM_AGENTS_URL}/api/v1/system-agents/agents",
                timeout=5.0
            )
            if response.status_code == 200:
                data = response.json()
                agents = data.get("data", {}).get("agents", [])
                print(f"✓ Found {len(agents)} agents:")
                for agent in agents:
                    print(f"  - {agent.get('id')}: {agent.get('name')} ({agent.get('role')})")
                return True
            else:
                print(f"✗ List agents failed: {response.status_code}")
                return False
        except httpx.ConnectError:
            print(f"✗ Cannot connect to system agents")
            return False


async def test_chat_with_agent(agent_id: str = "ada", message: str = "Hello! What can you help me with?"):
    """Test chatting with a specific agent."""
    print(f"\n=== Testing Chat with {agent_id.upper()} ===")
    print(f"Message: {message}")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{SYSTEM_AGENTS_URL}/api/v1/system-agents/chat",
                json={
                    "message": message,
                    "targetAgent": agent_id,
                },
                timeout=30.0
            )
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    responses = data.get("data", {}).get("responses", [])
                    latency = data.get("data", {}).get("totalLatencyMs", 0)
                    print(f"✓ Got response in {latency}ms")
                    for resp in responses:
                        agent = resp.get("agent_id", "unknown")
                        content = resp.get("response", "")[:200]
                        print(f"\n  [{agent}]: {content}...")
                    return True
                else:
                    print(f"✗ Chat failed: {data.get('error', 'Unknown error')}")
                    return False
            else:
                print(f"✗ Chat request failed: {response.status_code}")
                print(f"  Response: {response.text[:200]}")
                return False
        except httpx.ConnectError:
            print(f"✗ Cannot connect to system agents")
            return False
        except httpx.ReadTimeout:
            print(f"✗ Request timed out (LLM may be slow or unavailable)")
            return False


async def test_universal_adapter():
    """Test the Universal Adapter task execution."""
    print("\n=== Testing Universal Adapter ===")
    
    try:
        from universal_adapter import (
            run_task,
            list_available_tasks,
            DEFAULT_CONFIG,
            DEFAULT_MODEL,
        )
        
        print(f"✓ Universal Adapter imported")
        print(f"  Default Model: {DEFAULT_MODEL}")
        print(f"  Default Provider: {DEFAULT_CONFIG.provider}")
        
        # List available tasks
        tasks = list_available_tasks()
        print(f"\n  Available tasks: {len(tasks)}")
        for task in tasks[:5]:
            print(f"    - {task.get('id', 'unknown')}: {task.get('description', '')[:50]}")
        
        return True
        
    except ImportError as e:
        print(f"✗ Failed to import universal_adapter: {e}")
        return False
    except Exception as e:
        print(f"✗ Universal adapter error: {e}")
        return False


async def test_gateway_health():
    """Test gateway health endpoint."""
    print("\n=== Testing Gateway Health ===")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{GATEWAY_URL}/health",
                timeout=5.0
            )
            if response.status_code == 200:
                print(f"✓ Gateway is healthy")
                return True
            else:
                print(f"✗ Gateway health check failed: {response.status_code}")
                return False
        except httpx.ConnectError:
            print(f"✗ Cannot connect to gateway at {GATEWAY_URL}")
            return False


async def run_all_tests(agent_id: str = "ada"):
    """Run all tests."""
    print("=" * 50)
    print("Chrysalis System Agents Test Suite")
    print("=" * 50)
    
    results = {}
    
    # Test gateway
    results["gateway"] = await test_gateway_health()
    
    # Test system agents
    results["health"] = await test_system_agents_health()
    results["list_agents"] = await test_list_agents()
    results["chat"] = await test_chat_with_agent(agent_id)
    
    # Test universal adapter
    results["universal_adapter"] = await test_universal_adapter()
    
    # Summary
    print("\n" + "=" * 50)
    print("Test Summary")
    print("=" * 50)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test, result in results.items():
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"  {test}: {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    return passed == total


def main():
    parser = argparse.ArgumentParser(description="Test Chrysalis System Agents")
    parser.add_argument("--agent", default="ada", help="Agent to test chat with")
    parser.add_argument("--message", default="Hello! What can you help me with?", help="Message to send")
    parser.add_argument("--task", help="Universal adapter task to run")
    args = parser.parse_args()
    
    success = asyncio.run(run_all_tests(args.agent))
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

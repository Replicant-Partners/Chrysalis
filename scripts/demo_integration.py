#!/usr/bin/env python3
"""
Chrysalis Integration Demo Script
=================================
Exercises all connected components:
- Go LLM Gateway (port 8081)
- Python Universal Adapter (Ollama)
- Python Memory API (port 8082)
- System Agents (Ada, Lea, Phil, David, Milton)

Run with: python3 scripts/demo_integration.py
"""

import asyncio
import json
import sys
from pathlib import Path

import httpx

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from universal_adapter.engine.llm_client import LLMClient, LLMRequest
from universal_adapter.schema import ResourceLLM


# Configuration
GO_GATEWAY_URL = "http://localhost:8081"
MEMORY_API_URL = "http://localhost:8082"
OLLAMA_MODEL = "qwen3:4b"


async def check_service(name: str, url: str, path: str = "/health") -> bool:
    """Check if a service is running."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{url}{path}", timeout=5.0)
            if response.status_code == 200:
                print(f"  ✅ {name} is running at {url}")
                return True
            else:
                print(f"  ⚠️ {name} returned status {response.status_code}")
                return False
    except Exception as e:
        print(f"  ❌ {name} not reachable: {e}")
        return False


async def demo_go_gateway():
    """Demo the Go LLM Gateway."""
    print("\n" + "=" * 60)
    print("🚀 Go LLM Gateway Demo")
    print("=" * 60)

    try:
        async with httpx.AsyncClient() as client:
            # Test chat endpoint
            response = await client.post(
                f"{GO_GATEWAY_URL}/v1/chat",
                json={
                    "agent_id": "demo",
                    "model": OLLAMA_MODEL,
                    "messages": [
                        {"role": "user", "content": "Say 'Gateway works!' in exactly 3 words."}
                    ],
                },
                timeout=30.0,
            )

            if response.status_code == 200:
                data = response.json()
                content = data.get("message", {}).get("content", data.get("content", ""))
                print(f"  Response: {content[:100]}...")
                print("  ✅ Go Gateway working!")
                return True
            else:
                print(f"  ❌ Gateway error: {response.status_code} {response.text[:200]}")
                return False
    except Exception as e:
        print(f"  ❌ Gateway error: {e}")
        return False


async def demo_universal_adapter():
    """Demo the Python Universal Adapter with Ollama."""
    print("\n" + "=" * 60)
    print("🔄 Python Universal Adapter Demo")
    print("=" * 60)

    try:
        config = ResourceLLM(
            provider="ollama",
            model=OLLAMA_MODEL,
            endpoint="http://localhost:11434",
        )
        client = LLMClient(config)

        request = LLMRequest.simple(
            "You are Ada, the Algorithmic Architect. In one sentence, describe your role.",
            OLLAMA_MODEL,
        )
        response = await client.complete(request)

        print(f"  Ada says: {response.content[:200]}...")
        print(f"  Tokens: {response.usage}")
        print("  ✅ Universal Adapter working!")
        return True
    except Exception as e:
        print(f"  ❌ Adapter error: {e}")
        return False


async def demo_memory_api():
    """Demo the Python Memory API."""
    print("\n" + "=" * 60)
    print("🧠 Python Memory API Demo")
    print("=" * 60)

    try:
        async with httpx.AsyncClient() as client:
            # Create a memory entry
            response = await client.post(
                f"{MEMORY_API_URL}/beads",
                json={
                    "content": "Demo integration test - all systems connected!",
                    "role": "system",
                    "importance": 0.9,
                    "agent_id": "demo",
                },
                timeout=5.0,
            )

            if response.status_code == 200:
                bead = response.json()
                print(f"  Created bead: {bead['id'][:8]}...")

                # Retrieve recent beads
                response = await client.get(f"{MEMORY_API_URL}/beads?limit=3")
                beads = response.json()
                print(f"  Recent beads: {len(beads)}")
                for b in beads[:3]:
                    print(f"    - [{b['role']}] {b['content'][:50]}...")

                print("  ✅ Memory API working!")
                return True
            else:
                print(f"  ❌ Memory API error: {response.status_code}")
                return False
    except Exception as e:
        print(f"  ❌ Memory API error: {e}")
        return False


async def demo_system_agent(agent_id: str, agent_name: str, prompt: str, retries: int = 2):
    """Demo a system agent via the Universal Adapter."""
    print(f"\n  🤖 {agent_name} ({agent_id})")
    print(f"  " + "-" * 40)

    response = None
    for attempt in range(retries + 1):
        try:
            config = ResourceLLM(
                provider="ollama",
                model=OLLAMA_MODEL,
                endpoint="http://localhost:11434",
            )
            client = LLMClient(config)

            request = LLMRequest.simple(prompt, OLLAMA_MODEL)
            response = await client.complete(request)
            break
        except Exception as e:
            if attempt < retries:
                print(f"  ⏳ Retry {attempt + 1}/{retries}...")
                await asyncio.sleep(1)
                continue
            print(f"  ❌ Error: {e}")
            return False

    if not response:
        print("  ❌ No response received")
        return False

    # Store in memory (optional)
    try:
        async with httpx.AsyncClient() as http_client:
            await http_client.post(
                f"{MEMORY_API_URL}/beads",
                json={
                    "content": response.content[:500],
                    "role": "assistant",
                    "importance": 0.7,
                    "agent_id": agent_id,
                },
                timeout=5.0,
            )
    except Exception:
        pass  # Memory storage is optional

    print(f"  Response: {response.content[:150]}...")
    return True


async def demo_all_agents():
    """Demo all system agents."""
    print("\n" + "=" * 60)
    print("👥 System Agents Demo")
    print("=" * 60)

    agents = [
        ("ada", "Ada - Algorithmic Architect",
         "You are Ada, the Algorithmic Architect. Briefly describe how you evaluate code structure."),
        ("lea", "Lea - Implementation Reviewer",
         "You are Lea, the Implementation Reviewer. In one sentence, what do you look for in code?"),
        ("phil", "Phil - Forecast Analyst",
         "You are Phil, the Forecast Analyst. Briefly explain calibration in predictions."),
        ("david", "David - Metacognitive Guardian",
         "You are David, the Metacognitive Guardian. What cognitive bias do you watch for most?"),
        ("milton", "Milton - Ops Caretaker",
         "You are Milton, the Ops Caretaker. What's your approach to proposing config changes?"),
    ]

    results = []
    for agent_id, agent_name, prompt in agents:
        result = await demo_system_agent(agent_id, agent_name, prompt)
        results.append(result)
        await asyncio.sleep(0.5)  # Small delay between agents

    success_count = sum(results)
    print(f"\n  ✅ {success_count}/{len(agents)} agents responded successfully!")
    return success_count == len(agents)


async def main():
    """Run the full integration demo."""
    print("=" * 60)
    print("🦋 CHRYSALIS INTEGRATION DEMO")
    print("=" * 60)
    print("\nChecking services...")

    # Check services
    services_ok = True
    go_ok = await check_service("Go Gateway", GO_GATEWAY_URL, "/healthz")
    ollama_ok = await check_service("Ollama", "http://localhost:11434", "/api/version")
    memory_ok = await check_service("Memory API", MEMORY_API_URL, "/health")

    if not go_ok:
        print("\n⚠️  Go Gateway not running. Start with:")
        print("    cd go-services && go run cmd/gateway/main.go")
        services_ok = False

    if not ollama_ok:
        print("\n⚠️  Ollama not running. Start with:")
        print("    ollama serve")
        services_ok = False

    if not memory_ok:
        print("\n⚠️  Memory API not running. Start with:")
        print("    python3 -m uvicorn memory_system.http_api:app --port 8082")
        services_ok = False

    if not services_ok:
        print("\n❌ Some services are not running. Please start them and try again.")
        return 1

    print("\n✅ All services running!")

    # Run demos
    results = []

    results.append(await demo_go_gateway())
    results.append(await demo_universal_adapter())
    results.append(await demo_memory_api())
    results.append(await demo_all_agents())

    # Summary
    print("\n" + "=" * 60)
    print("📊 DEMO SUMMARY")
    print("=" * 60)

    success_count = sum(results)
    total = len(results)

    if success_count == total:
        print(f"\n🎉 All {total} demos passed!")
        print("\n✅ Chrysalis integration is working end-to-end:")
        print("   - Go LLM Gateway → Ollama")
        print("   - Python Universal Adapter → Ollama")
        print("   - Python Memory API (BeadsService)")
        print("   - System Agents (Ada, Lea, Phil, David, Milton)")
        return 0
    else:
        print(f"\n⚠️ {success_count}/{total} demos passed")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

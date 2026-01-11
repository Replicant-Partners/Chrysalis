# Chrysalis API Integration Quick Start

**Version**: 1.0  
**Last Updated**: 2026-01-11  
**Status**: Production

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start: Complete Agent Creation](#quick-start-complete-agent-creation)
4. [Multi-Service Workflows](#multi-service-workflows)
5. [Common Integration Patterns](#common-integration-patterns)
6. [Error Handling Strategies](#error-handling-strategies)
7. [Performance Optimization](#performance-optimization)
8. [Production Deployment](#production-deployment)
9. [Troubleshooting](#troubleshooting)

---

## Overview

This guide demonstrates how to integrate all three Chrysalis services to build complete AI agents with knowledge and skills. You'll learn:

- **End-to-end agent creation** across AgentBuilder, KnowledgeBuilder, and SkillBuilder
- **Multi-service orchestration** patterns
- **Error handling** and retry strategies
- **Performance optimization** techniques
- **Production deployment** best practices

### Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Application                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              AgentBuilder (Port 5000)                        │
│              Orchestrates agent creation                     │
└────────┬──────────────────────────────────┬─────────────────┘
         │                                   │
         ▼                                   ▼
┌──────────────────────┐          ┌──────────────────────┐
│ KnowledgeBuilder     │          │ SkillBuilder         │
│ (Port 5002)          │          │ (Port 5001)          │
│ Generates knowledge  │          │ Generates skills     │
└──────────────────────┘          └──────────────────────┘
```

### Integration Approaches

**1. High-Level (Recommended)**: Use AgentBuilder API
- Single API call creates complete agent
- Automatic service orchestration
- Built-in error handling
- Simplified integration

**2. Low-Level**: Direct service calls
- Fine-grained control
- Custom orchestration logic
- Manual error handling
- Advanced use cases

---

## Prerequisites

### 1. Service Setup

Ensure all three services are running:

```bash
# Terminal 1: AgentBuilder
cd projects/AgentBuilder
python server.py
# Listening on http://localhost:5000

# Terminal 2: SkillBuilder
cd projects/SkillBuilder
python server.py
# Listening on http://localhost:5001

# Terminal 3: KnowledgeBuilder
cd projects/KnowledgeBuilder
python server.py
# Listening on http://localhost:5002
```

### 2. Authentication

Obtain an API key (see [Authentication Guide](AUTHENTICATION.md)):

```bash
# Bootstrap initial API key
curl -X POST http://localhost:5000/api/v1/auth/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"name": "admin"}'

# Save the returned token
export CHRYSALIS_API_KEY="admin-key-001.a1b2c3d4e5f6g7h8i9j0"
```

### 3. Verify Connectivity

Test each service:

```bash
# AgentBuilder
curl http://localhost:5000/health

# SkillBuilder
curl http://localhost:5001/health

# KnowledgeBuilder
curl http://localhost:5002/health
```

All should return `{"success": true, "data": {"status": "healthy", ...}}`.

---

## Quick Start: Complete Agent Creation

### Scenario: Create an AI Agent for Bob Ross

This example creates a complete agent with knowledge and skills in **one API call**.

#### Step 1: Create Agent

```bash
curl -X POST http://localhost:5000/api/v1/agents \
  -H "Authorization: Bearer ${CHRYSALIS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent-bob-ross-001",
    "role_model": {
      "name": "Bob Ross",
      "occupation": "Artist"
    },
    "deepening_cycles": 3
  }'
```

**What Happens Behind the Scenes**:

1. **AgentBuilder** validates your request
2. **AgentBuilder** → **KnowledgeBuilder**: Generates knowledge about Bob Ross
3. **KnowledgeBuilder** performs 3 deepening cycles to enrich knowledge
4. **AgentBuilder** aggregates knowledge into a corpus
5. **AgentBuilder** → **SkillBuilder**: Generates skills based on occupation and knowledge
6. **AgentBuilder** stores complete agent and returns result

#### Step 2: Verify Agent Creation

```bash
curl -X GET http://localhost:5000/api/v1/agents/agent-bob-ross-001 \
  -H "Authorization: Bearer ${CHRYSALIS_API_KEY}"
```

**Expected Response**:

```json
{
  "success": true,
  "data": {
    "agent_id": "agent-bob-ross-001",
    "role_model": {
      "name": "Bob Ross",
      "occupation": "Artist"
    },
    "generated_skills": [
      {
        "skill_id": "skill-001",
        "name": "Color Theory",
        "description": "Understanding of color relationships and harmonies",
        "category": "Technical"
      },
      {
        "skill_id": "skill-002",
        "name": "Brush Techniques",
        "description": "Various painting brush methods",
        "category": "Technical"
      }
    ],
    "generated_knowledge": [
      {
        "knowledge_id": "knowledge-001",
        "entity": {
          "text": "Bob Ross was an American painter, art instructor, and television host.",
          "type": "Person"
        },
        "source": "Wikipedia",
        "confidence": 0.95
      }
    ],
    "status": "completed"
  },
  "meta": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-01-11T05:00:00.000Z",
    "version": "v1"
  }
}
```

#### Step 3: Query Agent Capabilities

```bash
curl -X GET http://localhost:5000/api/v1/agents/agent-bob-ross-001/capabilities \
  -H "Authorization: Bearer ${CHRYSALIS_API_KEY}"
```

**Response**: Returns only skills and knowledge (filtered view).

---

## Multi-Service Workflows

### Workflow 1: Agent Creation with Custom Knowledge

**Use Case**: Create agent with pre-existing knowledge from your database.

#### Python Implementation

```python
import os
import requests
from typing import Dict, Any, List

API_KEY = os.getenv("CHRYSALIS_API_KEY")
BASE_URL = "http://localhost:5000"

def create_agent_with_custom_knowledge(
    agent_id: str,
    name: str,
    occupation: str,
    custom_knowledge: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Create agent with custom knowledge items.
    
    Args:
        agent_id: Unique agent identifier
        name: Role model name
        occupation: Role model occupation
        custom_knowledge: List of knowledge items to add
        
    Returns:
        Complete agent data
    """
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Step 1: Create base agent
    print(f"Creating agent: {agent_id}")
    response = requests.post(
        f"{BASE_URL}/api/v1/agents",
        headers=headers,
        json={
            "agent_id": agent_id,
            "role_model": {"name": name, "occupation": occupation},
            "deepening_cycles": 0  # Skip automatic knowledge generation
        }
    )
    response.raise_for_status()
    agent = response.json()["data"]
    print(f"✓ Agent created: {agent['agent_id']}")
    
    # Step 2: Add custom knowledge via KnowledgeBuilder
    print(f"Adding {len(custom_knowledge)} custom knowledge items...")
    for item in custom_knowledge:
        kb_response = requests.post(
            "http://localhost:5002/api/v1/knowledge",
            headers=headers,
            json={
                "identifier": agent_id,
                "entity_type": item.get("entity_type", "Custom"),
                "text": item["text"],
                "source": item.get("source", "Custom"),
                "confidence": item.get("confidence", 1.0)
            }
        )
        kb_response.raise_for_status()
    print(f"✓ Custom knowledge added")
    
    # Step 3: Regenerate skills based on new knowledge
    print("Regenerating skills...")
    
    # Get updated knowledge
    kb_list = requests.get(
        f"http://localhost:5002/api/v1/knowledge?filter[identifier]={agent_id}",
        headers=headers
    )
    kb_list.raise_for_status()
    knowledge_items = kb_list.json()["data"]
    
    # Build corpus
    corpus = " ".join([k["entity"]["text"] for k in knowledge_items])
    
    # Generate skills
    skill_response = requests.post(
        "http://localhost:5001/api/v1/skills",
        headers=headers,
        json={
            "occupation": occupation,
            "deepening_cycles": 2,
            "corpus_text": corpus
        }
    )
    skill_response.raise_for_status()
    skills = skill_response.json()["data"]
    print(f"✓ Generated {len(skills)} skills")
    
    # Step 4: Update agent with new capabilities
    update_response = requests.patch(
        f"{BASE_URL}/api/v1/agents/{agent_id}",
        headers=headers,
        json={
            "generated_skills": skills,
            "generated_knowledge": knowledge_items
        }
    )
    update_response.raise_for_status()
    
    return update_response.json()["data"]


# Usage
custom_knowledge = [
    {
        "text": "Expert in wet-on-wet oil painting technique",
        "entity_type": "Skill",
        "source": "Custom Database",
        "confidence": 1.0
    },
    {
        "text": "Hosted 'The Joy of Painting' TV show for 11 years",
        "entity_type": "Achievement",
        "source": "Custom Database",
        "confidence": 1.0
    }
]

agent = create_agent_with_custom_knowledge(
    agent_id="agent-bob-ross-custom",
    name="Bob Ross",
    occupation="Artist",
    custom_knowledge=custom_knowledge
)

print(f"\n✓ Agent created with custom knowledge: {agent['agent_id']}")
```

---

### Workflow 2: Batch Agent Creation

**Use Case**: Create multiple agents efficiently.

#### Python Implementation

```python
import os
import requests
from typing import List, Dict, Any
from concurrent.futures import ThreadPoolExecutor, as_completed

API_KEY = os.getenv("CHRYSALIS_API_KEY")
BASE_URL = "http://localhost:5000"

def create_agent(agent_data: Dict[str, Any]) -> Dict[str, Any]:
    """Create single agent."""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    response = requests.post(
        f"{BASE_URL}/api/v1/agents",
        headers=headers,
        json=agent_data,
        timeout=300  # 5 minutes for knowledge/skill generation
    )
    response.raise_for_status()
    return response.json()["data"]


def create_agents_batch(agents: List[Dict[str, Any]], max_workers: int = 3) -> List[Dict[str, Any]]:
    """
    Create multiple agents in parallel.
    
    Args:
        agents: List of agent specifications
        max_workers: Maximum parallel requests (default: 3)
        
    Returns:
        List of created agents
    """
    results = []
    errors = []
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all tasks
        future_to_agent = {
            executor.submit(create_agent, agent): agent
            for agent in agents
        }
        
        # Collect results
        for future in as_completed(future_to_agent):
            agent_spec = future_to_agent[future]
            try:
                result = future.result()
                results.append(result)
                print(f"✓ Created: {result['agent_id']}")
            except Exception as e:
                errors.append({
                    "agent_id": agent_spec.get("agent_id"),
                    "error": str(e)
                })
                print(f"✗ Failed: {agent_spec.get('agent_id')} - {e}")
    
    return results, errors


# Usage
agents_to_create = [
    {
        "agent_id": "agent-einstein-001",
        "role_model": {"name": "Albert Einstein", "occupation": "Physicist"},
        "deepening_cycles": 3
    },
    {
        "agent_id": "agent-curie-001",
        "role_model": {"name": "Marie Curie", "occupation": "Chemist"},
        "deepening_cycles": 3
    },
    {
        "agent_id": "agent-turing-001",
        "role_model": {"name": "Alan Turing", "occupation": "Mathematician"},
        "deepening_cycles": 3
    }
]

print("Creating agents in parallel...")
created_agents, errors = create_agents_batch(agents_to_create, max_workers=3)

print(f"\n✓ Successfully created: {len(created_agents)} agents")
if errors:
    print(f"✗ Failed: {len(errors)} agents")
    for error in errors:
        print(f"  - {error['agent_id']}: {error['error']}")
```

---

### Workflow 3: Knowledge Enrichment Pipeline

**Use Case**: Continuously enrich agent knowledge over time.

#### Python Implementation

```python
import os
import requests
import time
from typing import Dict, Any

API_KEY = os.getenv("CHRYSALIS_API_KEY")

def enrich_agent_knowledge(
    agent_id: str,
    additional_cycles: int = 2
) -> Dict[str, Any]:
    """
    Enrich existing agent with additional knowledge cycles.
    
    Args:
        agent_id: Agent to enrich
        additional_cycles: Number of deepening cycles to add
        
    Returns:
        Updated agent data
    """
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Step 1: Get current agent
    print(f"Fetching agent: {agent_id}")
    response = requests.get(
        f"http://localhost:5000/api/v1/agents/{agent_id}",
        headers=headers
    )
    response.raise_for_status()
    agent = response.json()["data"]
    
    current_knowledge_count = len(agent.get("generated_knowledge", []))
    print(f"Current knowledge items: {current_knowledge_count}")
    
    # Step 2: Generate additional knowledge
    print(f"Generating {additional_cycles} additional deepening cycles...")
    kb_response = requests.post(
        "http://localhost:5002/api/v1/knowledge",
        headers=headers,
        json={
            "identifier": agent["role_model"]["name"],
            "entity_type": "Person",
            "deepening_cycles": additional_cycles
        }
    )
    kb_response.raise_for_status()
    new_knowledge = kb_response.json()["data"]
    print(f"✓ Generated {len(new_knowledge)} new knowledge items")
    
    # Step 3: Merge with existing knowledge
    all_knowledge = agent.get("generated_knowledge", []) + new_knowledge
    
    # Step 4: Regenerate skills with enriched knowledge
    print("Regenerating skills with enriched knowledge...")
    corpus = " ".join([k["entity"]["text"] for k in all_knowledge])
    
    skill_response = requests.post(
        "http://localhost:5001/api/v1/skills",
        headers=headers,
        json={
            "occupation": agent["role_model"]["occupation"],
            "deepening_cycles": 2,
            "corpus_text": corpus
        }
    )
    skill_response.raise_for_status()
    new_skills = skill_response.json()["data"]
    print(f"✓ Generated {len(new_skills)} skills")
    
    # Step 5: Update agent
    update_response = requests.patch(
        f"http://localhost:5000/api/v1/agents/{agent_id}",
        headers=headers,
        json={
            "generated_knowledge": all_knowledge,
            "generated_skills": new_skills
        }
    )
    update_response.raise_for_status()
    
    updated_agent = update_response.json()["data"]
    new_knowledge_count = len(updated_agent["generated_knowledge"])
    
    print(f"\n✓ Knowledge enrichment complete:")
    print(f"  Before: {current_knowledge_count} items")
    print(f"  After: {new_knowledge_count} items")
    print(f"  Added: {new_knowledge_count - current_knowledge_count} items")
    
    return updated_agent


# Usage
enriched_agent = enrich_agent_knowledge(
    agent_id="agent-bob-ross-001",
    additional_cycles=2
)
```

---

## Common Integration Patterns

### Pattern 1: Client SDK

Create a reusable client for all Chrysalis services:

```python
import os
import requests
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

@dataclass
class ChrysalisConfig:
    """Configuration for Chrysalis services."""
    api_key: str
    agent_builder_url: str = "http://localhost:5000"
    skill_builder_url: str = "http://localhost:5001"
    knowledge_builder_url: str = "http://localhost:5002"
    timeout: int = 300


class ChrysalisClient:
    """Unified client for Chrysalis services."""
    
    def __init__(self, config: Optional[ChrysalisConfig] = None):
        """Initialize client with configuration."""
        if config is None:
            config = ChrysalisConfig(
                api_key=os.getenv("CHRYSALIS_API_KEY", "")
            )
        
        if not config.api_key:
            raise ValueError("API key required. Set CHRYSALIS_API_KEY or provide config.")
        
        self.config = config
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {config.api_key}",
            "Content-Type": "application/json"
        })
    
    # Agent Operations
    
    def create_agent(
        self,
        agent_id: str,
        name: str,
        occupation: str,
        deepening_cycles: int = 0
    ) -> Dict[str, Any]:
        """Create a new agent."""
        response = self.session.post(
            f"{self.config.agent_builder_url}/api/v1/agents",
            json={
                "agent_id": agent_id,
                "role_model": {"name": name, "occupation": occupation},
                "deepening_cycles": deepening_cycles
            },
            timeout=self.config.timeout
        )
        response.raise_for_status()
        return response.json()["data"]
    
    def get_agent(self, agent_id: str) -> Dict[str, Any]:
        """Get agent by ID."""
        response = self.session.get(
            f"{self.config.agent_builder_url}/api/v1/agents/{agent_id}"
        )
        response.raise_for_status()
        return response.json()["data"]
    
    def list_agents(
        self,
        page: int = 1,
        per_page: int = 20,
        sort: Optional[str] = None
    ) -> Dict[str, Any]:
        """List agents with pagination."""
        params = {"page": page, "per_page": per_page}
        if sort:
            params["sort"] = sort
        
        response = self.session.get(
            f"{self.config.agent_builder_url}/api/v1/agents",
            params=params
        )
        response.raise_for_status()
        return response.json()
    
    def update_agent(
        self,
        agent_id: str,
        updates: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Partially update agent."""
        response = self.session.patch(
            f"{self.config.agent_builder_url}/api/v1/agents/{agent_id}",
            json=updates
        )
        response.raise_for_status()
        return response.json()["data"]
    
    def delete_agent(self, agent_id: str) -> bool:
        """Delete agent."""
        response = self.session.delete(
            f"{self.config.agent_builder_url}/api/v1/agents/{agent_id}"
        )
        response.raise_for_status()
        return response.json()["data"]["deleted"]
    
    # Knowledge Operations
    
    def create_knowledge(
        self,
        identifier: str,
        entity_type: str,
        deepening_cycles: int = 0,
        text: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Generate knowledge for entity."""
        payload = {
            "identifier": identifier,
            "entity_type": entity_type,
            "deepening_cycles": deepening_cycles
        }
        if text:
            payload["text"] = text
        
        response = self.session.post(
            f"{self.config.knowledge_builder_url}/api/v1/knowledge",
            json=payload,
            timeout=self.config.timeout
        )
        response.raise_for_status()
        return response.json()["data"]
    
    def search_knowledge(
        self,
        query: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Semantic search for knowledge."""
        response = self.session.post(
            f"{self.config.knowledge_builder_url}/api/v1/knowledge/search",
            json={"query": query, "limit": limit}
        )
        response.raise_for_status()
        return response.json()["data"]
    
    # Skill Operations
    
    def create_skills(
        self,
        occupation: str,
        deepening_cycles: int = 0,
        corpus_text: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Generate skills for occupation."""
        payload = {
            "occupation": occupation,
            "deepening_cycles": deepening_cycles
        }
        if corpus_text:
            payload["corpus_text"] = corpus_text
        
        response = self.session.post(
            f"{self.config.skill_builder_url}/api/v1/skills",
            json=payload,
            timeout=self.config.timeout
        )
        response.raise_for_status()
        return response.json()["data"]
    
    # Health Checks
    
    def health_check(self) -> Dict[str, bool]:
        """Check health of all services."""
        services = {
            "agent_builder": self.config.agent_builder_url,
            "skill_builder": self.config.skill_builder_url,
            "knowledge_builder": self.config.knowledge_builder_url
        }
        
        health = {}
        for name, url in services.items():
            try:
                response = self.session.get(f"{url}/health", timeout=5)
                health[name] = response.status_code == 200
            except Exception:
                health[name] = False
        
        return health


# Usage
client = ChrysalisClient()

# Check service health
health = client.health_check()
print(f"Services: {health}")

# Create agent
agent = client.create_agent(
    agent_id="agent-example",
    name="Example Person",
    occupation="Example Occupation",
    deepening_cycles=3
)
print(f"Created: {agent['agent_id']}")

# List agents
agents = client.list_agents(page=1, per_page=10, sort="-created_at")
print(f"Total agents: {agents['meta']['pagination']['total']}")

# Search knowledge
results = client.search_knowledge("painting techniques", limit=5)
print(f"Found {len(results)} knowledge items")
```

---

### Pattern 2: Async/Await (Python asyncio)

For high-performance applications:

```python
import os
import asyncio
import aiohttp
from typing import Dict, Any, List

API_KEY = os.getenv("CHRYSALIS_API_KEY")

class AsyncChrysalisClient:
    """Async client for Chrysalis services."""
    
    def __init__(self, api_key: str = API_KEY):
        self.api_key = api_key
        self.base_url = "http://localhost:5000"
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    async def create_agent(
        self,
        session: aiohttp.ClientSession,
        agent_id: str,
        name: str,
        occupation: str,
        deepening_cycles: int = 0
    ) -> Dict[str, Any]:
        """Create agent asynchronously."""
        async with session.post(
            f"{self.base_url}/api/v1/agents",
            headers=self.headers,
            json={
                "agent_id": agent_id,
                "role_model": {"name": name, "occupation": occupation},
                "deepening_cycles": deepening_cycles
            },
            timeout=aiohttp.ClientTimeout(total=300)
        ) as response:
            response.raise_for_status()
            data = await response.json()
            return data["data"]
    
    async def create_agents_parallel(
        self,
        agents: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Create multiple agents in parallel."""
        async with aiohttp.ClientSession() as session:
            tasks = [
                self.create_agent(
                    session,
                    agent["agent_id"],
                    agent["role_model"]["name"],
                    agent["role_model"]["occupation"],
                    agent.get("deepening_cycles", 0)
                )
                for agent in agents
            ]
            return await asyncio.gather(*tasks, return_exceptions=True)


# Usage
async def main():
    client = AsyncChrysalisClient()
    
    agents = [
        {
            "agent_id": f"agent-async-{i}",
            "role_model": {"name": f"Person {i}", "occupation": "Occupation"},
            "deepening_cycles": 2
        }
        for i in range(5)
    ]
    
    print("Creating agents asynchronously...")
    results = await client.create_agents_parallel(agents)
    
    successful = [r for r in results if not isinstance(r, Exception)]
    failed = [r for r in results if isinstance(r, Exception)]
    
    print(f"✓ Created: {len(successful)} agents")
    print(f"✗ Failed: {len(failed)} agents")

# Run
asyncio.run(main())
```

---

## Error Handling Strategies

### Strategy 1: Retry with Exponential Backoff

```python
import time
import requests
from typing import Dict, Any, Callable

def retry_with_backoff(
    func: Callable,
    max_retries: int = 3,
    initial_delay: float = 1.0,
    backoff_factor: float = 2.0
) -> Any:
    """
    Retry function with exponential backoff.
    
    Args:
        func: Function to retry
        max_retries: Maximum retry attempts
        initial_delay: Initial delay in seconds
        backoff_factor: Multiplier for each retry
        
    Returns:
        Function result
        
    Raises:
        Last exception if all retries fail
    """
    delay = initial_delay
    last_exception = None
    
    for attempt in range(max_retries + 1):
        try:
            return func()
        except requests.exceptions.RequestException as e:
            last_exception = e
            
            # Don't retry on client errors (4xx except 429)
            if hasattr(e, 'response') and e.response is not None:
                status = e.response.status_code
                if 400 <= status < 500 and status != 429:
                    raise
            
            if attempt < max_retries:
                print(f"Attempt {attempt + 1} failed: {e}")
                print(f"Retrying in {delay:.1f}s...")
                time.sleep(delay)
                delay *= backoff_factor
            else:
                print(f"All {max_retries + 1} attempts failed")
                raise last_exception


# Usage
def create_agent_with_retry():
    return retry_with_backoff(
        lambda: requests.post(
            "http://localhost:5000/api/v1/agents",
            headers={"Authorization": f"Bearer {API_KEY}"},
            json={
                "agent_id": "agent-retry-example",
                "role_model": {"name": "Example", "occupation": "Example"},
                "deepening_cycles": 3
            },
            timeout=300
        ).json(),
        max_retries=3,
        initial_delay=1.0,
        backoff_factor=2.0
    )

try:
    result = create_agent_with_retry()
    print(f"✓ Agent created: {result['data']['agent_id']}")
except Exception as e:
    print(f"✗ Failed after retries: {e}")
```

---

### Strategy 2: Circuit Breaker Pattern

```python
import time
from enum import Enum
from typing import Callable, Any

class CircuitState(Enum):
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing if recovered

class CircuitBreaker:
    """Circuit breaker for service calls."""
    
    def __init__(
        self,
        failure_threshold: int = 5,
        timeout: float = 60.0,
        recovery_timeout: float = 30.0
    ):
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.recovery_timeout = recovery_timeout
        
        self.failure_count = 0
        self.last_failure_time = None
        self.state = CircuitState.CLOSED
    
    def call(self, func: Callable) -> Any:
        """Execute function with circuit breaker protection."""
        if self.state == CircuitState.OPEN:
            if time.time() - self.last_failure_time >= self.recovery_timeout:
                self.state = CircuitState.HALF_OPEN
                print("Circuit breaker: HALF_OPEN (testing recovery)")
            else:
                raise Exception("Circuit breaker OPEN - service unavailable")
        
        try:
            result = func()
            
            # Success - reset if in HALF_OPEN
            if self.state == CircuitState.HALF_OPEN:
                self.state = CircuitState.CLOSED
                self.failure_count = 0
                print("Circuit breaker: CLOSED (recovered)")
            
            return result
            
        except Exception as e:
            self.failure_count += 1
            self.last_failure_time = time.time()
            
            if self.failure_count >= self.failure_threshold:
                self.state = CircuitState.OPEN
                print(f"Circuit breaker: OPEN (threshold reached: {self.failure_count})")
            
            raise


# Usage
breaker = CircuitBreaker(failure_threshold=5, recovery_timeout=30.0)

def call_agent_service():
    return breaker.call(
        lambda: requests.post(
            "http://localhost:5000/api/v1/agents",
            headers={"Authorization": f"Bearer {API_KEY}"},
            json={
                "agent_id": "agent-example",
                "role_model": {"name": "Example", "occupation": "Example"},
                "deepening_cycles": 3
            },
            timeout=300
        ).json()
    )

try:
    result = call_agent_service()
    print(f"✓ Success: {result['data']['agent_id']}")
except Exception as e:
    print(f"✗ Failed: {e}")
```

---

## Performance Optimization

### Optimization 1: Connection Pooling

Reuse HTTP connections for better performance:

```python
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

def create_session_with_retries() -> requests.Session:
    """Create session with connection pooling and retries."""
    session = requests.Session()
    
    # Configure retries
    retry_strategy = Retry(
        total=3,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["HEAD", "GET", "PUT", "DELETE", "OPTIONS", "TRACE", "POST"]
    )
    
    # Configure adapter with connection pooling
    adapter = HTTPAdapter(
        max_retries=retry_strategy,
        pool_connections=10,
        pool_maxsize=20
    )
    
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    
    return session

# Usage
session = create_session_with_retries()
session.headers.update({
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
})

# Reuse session for multiple requests
for i in range(10):
    response = session.post(
        "http://localhost:5000/api/v1/agents",
        json={
            "agent_id": f"agent-{i}",
            "role_model": {"name": f"Person {i}", "occupation": "Occupation"},
            "deepening_cycles": 2
        },
        timeout=300
    )
    print(f"Created agent {i}: {response.status_code}")
```

---

### Optimization 2: Caching

Cache frequently accessed data:

```python
from functools import lru_cache
import time

class CachedChrysalisClient:
    """Client with caching support."""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "http://localhost:5000"
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        })
    
    @lru_cache(maxsize=128)
    def get_agent_cached(self, agent_id: str) -> Dict[str, Any]:
        """Get agent with caching (5 minute TTL)."""
        response = self.session.get(
            f"{self.base_url}/api/v1/agents/{agent_id}"
        )
        response.raise_for_status()
        return response.json()["data"]
    
    def invalidate_cache(self, agent_id: str):
        """Invalidate cache for specific agent."""
        self.get_agent_cached.cache_clear()

# Usage
client = CachedChrysalisClient(API_KEY)

# First call - hits API
agent = client.get_agent_cached("agent-bob-ross-001")

# Second call - returns cached result
agent = client.get_agent_cached("agent-bob-ross-001")  # Fast!

# After update, invalidate cache
client.invalidate_cache("agent-bob-ross-001")
```

---

### Optimization 3: Batch Operations

Minimize API calls with batch operations:

```python
def batch_create_agents(
    agents: List[Dict[str, Any]],
    batch_size: int = 5
) -> List[Dict[str, Any]]:
    """
    Create agents in batches to avoid overwhelming services.
    
    Args:
        agents: List of agent specifications
        batch_size: Number of agents per batch
        
    Returns:
        List of created agents
    """
    results = []
    
    for i in range(0, len(agents), batch_size):
        batch = agents[i:i + batch_size]
        print(f"Processing batch {i//batch_size + 1} ({len(batch)} agents)...")
        
        # Process batch in parallel
        with ThreadPoolExecutor(max_workers=batch_size) as executor:
            futures = [executor.submit(create_agent, agent) for agent in batch]
            batch_results = [f.result() for f in futures]
        
        results.extend(batch_results)
        
        # Rate limiting between batches
        if i + batch_size < len(agents):
            time.sleep(1)  # 1 second between batches
    
    return results
```

---

## Production Deployment

### Deployment Checklist

**Pre-Deployment**:
- [ ] All services health checks passing
- [ ] API keys generated and stored securely
- [ ] Environment variables configured
- [ ] Database migrations completed (if applicable)
- [ ] SSL/TLS certificates installed
- [ ] Monitoring and logging configured
- [ ] Rate limits configured appropriately
- [ ] Backup and recovery procedures tested

**Deployment**:
- [ ] Deploy services in order: KnowledgeBuilder → SkillBuilder → AgentBuilder
- [ ] Verify each service before deploying next
- [ ] Run smoke tests after each deployment
- [ ] Monitor error rates and latency
- [ ] Keep previous version available for rollback

**Post-Deployment**:
- [ ] Verify all endpoints responding
- [ ] Check service-to-service communication
- [ ] Monitor resource usage (CPU, memory, network)
- [ ] Review logs for errors or warnings
- [ ] Test critical workflows end-to-end
- [ ] Update documentation with any changes

---

### Environment Configuration

**Production `.env` file**:

```bash
# Service URLs
AGENT_BUILDER_URL=https://api.chrysalis.prod/agentbuilder
SKILL_BUILDER_URL=https://api.chrysalis.prod/skillbuilder
KNOWLEDGE_BUILDER_URL=https://api.chrysalis.prod/knowledgebuilder

# Authentication
JWT_SECRET=<strong-random-secret-min-32-chars>
JWT_EXPIRATION_HOURS=24
ADMIN_KEY_IDS=<comma-separated-admin-key-ids>

# Database (if applicable)
DATABASE_URL=postgresql://user:pass@host:5432/chrysalis

# Monitoring
SENTRY_DSN=<sentry-dsn>
LOG_LEVEL=INFO

# Performance
REQUEST_TIMEOUT=300
MAX_WORKERS=10
RATE_LIMIT_ENABLED=true

# Feature Flags
ENABLE_CACHING=true
ENABLE_METRICS=true
```

---

### Docker Compose Deployment

```yaml
version: '3.8'

services:
  agentbuilder:
    build: ./projects/AgentBuilder
    ports:
      - "5000:5000"
    environment:
      - SKILL_BUILDER_URL=http://skillbuilder:5001
      - KNOWLEDGE_BUILDER_URL=http://knowledgebuilder:5002
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - skillbuilder
      - knowledgebuilder
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

  skillbuilder:
    build: ./projects/SkillBuilder
    ports:
      - "5001:5001"
    environment:
      - JWT_SECRET=${JWT_SECRET}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

  knowledgebuilder:
    build: ./projects/KnowledgeBuilder
    ports:
      - "5002:5002"
    environment:
      - JWT_SECRET=${JWT_SECRET}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5002/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

networks:
  default:
    name: chrysalis-network
```

**Deploy**:

```bash
# Build and start services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

---

## Troubleshooting

### Issue 1: Service Unavailable (502/503)

**Symptoms**:
- `UPSTREAM_ERROR.SERVICE_UNAVAILABLE` errors
- Timeout errors
- Connection refused

**Diagnosis**:

```bash
# Check service health
curl http://localhost:5000/health
curl http://localhost:5001/health
curl http://localhost:5002/health

# Check if services are running
ps aux | grep python | grep server.py

# Check port availability
netstat -an | grep -E '5000|5001|5002'
```

**Solutions**:

1. **Restart services**:
   ```bash
   # Kill existing processes
   pkill -f "python.*server.py"
   
   # Restart services
   cd projects/AgentBuilder && python server.py &
   cd projects/SkillBuilder && python server.py &
   cd projects/KnowledgeBuilder && python server.py &
   ```

2. **Check service URLs**:
   ```bash
   # Verify environment variables
   echo $SKILL_BUILDER_URL
   echo $KNOWLEDGE_BUILDER_URL
   ```

3. **Review logs**:
   ```bash
   # Check for errors in service logs
   tail -f projects/AgentBuilder/logs/server.log
   ```

---

### Issue 2: Authentication Failures (401)

**Symptoms**:
- `AUTHENTICATION_ERROR.MISSING_AUTHORIZATION`
- `AUTHENTICATION_ERROR.INVALID_TOKEN`

**Diagnosis**:

```bash
# Verify API key format
echo $CHRYSALIS_API_KEY | grep -E '^[^.]+\.[^.]+$'

# Test authentication
curl -X GET http://localhost:5000/api/v1/agents \
  -H "Authorization: Bearer ${CHRYSALIS_API_KEY}" \
  -v
```

**Solutions**:

1. **Regenerate API key**:
   ```bash
   curl -X POST http://localhost:5000/api/v1/auth/bootstrap \
     -H "Content-Type: application/json" \
     -d '{"name": "admin"}'
   ```

2. **Check for whitespace**:
   ```bash
   # Remove any whitespace
   export CHRYSALIS_API_KEY=$(echo $CHRYSALIS_API_KEY | tr -d '[:space:]')
   ```

3. **Verify JWT secret matches across services**:
   ```bash
   # All services must use same JWT_SECRET
   grep JWT_SECRET projects/*/server.py
   ```

---

### Issue 3: Slow Response Times

**Symptoms**:
- Requests taking >30 seconds
- Timeout errors
- High CPU/memory usage

**Diagnosis**:

```bash
# Monitor resource usage
top -p $(pgrep -f "python.*server.py")

# Check request timing
time curl -X POST http://localhost:5000/api/v1/agents \
  -H "Authorization: Bearer ${CHRYSALIS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "test", "role_model": {"name": "Test", "occupation": "Test"}, "deepening_cycles": 0}'
```

**Solutions**:

1. **Reduce deepening cycles**:
   ```python
   # Use fewer cycles for faster responses
   agent = client.create_agent(
       agent_id="agent-fast",
       name="Example",
       occupation="Example",
       deepening_cycles=1  # Instead of 3+
   )
   ```

2. **Enable caching**:
   ```python
   # Cache frequently accessed agents
   client = CachedChrysalisClient(API_KEY)
   ```

3. **Use async operations**:
   ```python
   # Process multiple agents in parallel
   client = AsyncChrysalisClient()
   results = await client.create_agents_parallel(agents)
   ```

---

### Issue 4: Duplicate Agent Errors (409)

**Symptoms**:
- `CONFLICT_ERROR.DUPLICATE_RESOURCE`
- Agent already exists errors

**Solutions**:

1. **Check if agent exists first**:
   ```python
   try:
       agent = client.get_agent(agent_id)
       print(f"Agent exists: {agent['agent_id']}")
   except requests.exceptions.HTTPError as e:
       if e.response.status_code == 404:
           # Agent doesn't exist, create it
           agent = client.create_agent(agent_id, name, occupation)
   ```

2. **Use update instead of create**:
   ```python
   # Update existing agent
   agent = client.update_agent(
       agent_id="existing-agent",
       updates={"deepening_cycles": 5}
   )
   ```

3. **Delete and recreate**:
   ```python
   # Delete existing agent
   client.delete_agent(agent_id)
   
   # Create new agent
   agent = client.create_agent(agent_id, name, occupation)
   ```

---

## Related Documentation

- [Authentication Guide](AUTHENTICATION.md) - Complete authentication documentation
- [AgentBuilder API](services/AGENTBUILDER_COMPLETE_SPEC.md) - AgentBuilder endpoint reference
- [SkillBuilder API](services/SKILLBUILDER_API_SPEC.md) - SkillBuilder endpoint reference
- [KnowledgeBuilder API](services/KNOWLEDGEBUILDER_API_SPEC.md) - KnowledgeBuilder endpoint reference
- [Error Handling Guide](ERROR_HANDLING.md) - Error codes and resolution strategies

---

## Support

**Documentation**: https://docs.chrysalis.dev
**Issues**: https://github.com/chrysalis/chrysalis/issues
**Community**: https://discord.gg/chrysalis
**Email**: support@chrysalis.dev

---

**Document Version**: 1.0
**Last Updated**: 2026-01-11
**Next Review**: 2026-02-11
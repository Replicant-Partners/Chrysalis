# AgentBuilder Service - Complete API Specification (Part 2)

**Continuation of**: [AGENTBUILDER_COMPLETE_SPEC.md](./AGENTBUILDER_COMPLETE_SPEC.md)

---

## Error Handling (Continued)

### Error Code Taxonomy (Continued)

#### Authentication Errors (401)

| Code | Description | Resolution |
|------|-------------|------------|
| `AUTHENTICATION_ERROR.MISSING_AUTHORIZATION` | No auth header | Add Authorization header |
| `AUTHENTICATION_ERROR.INVALID_TOKEN` | Token invalid/malformed | Use valid token format |
| `AUTHENTICATION_ERROR.EXPIRED_TOKEN` | Token expired | Obtain new token |

#### Not Found Errors (404)

| Code | Description | Resolution |
|------|-------------|------------|
| `NOT_FOUND_ERROR.RESOURCE_NOT_FOUND` | Agent doesn't exist | Verify agent_id is correct |
| `NOT_FOUND_ERROR.ENDPOINT_NOT_FOUND` | Invalid endpoint | Check API documentation |

#### Conflict Errors (409)

| Code | Description | Resolution |
|------|-------------|------------|
| `CONFLICT_ERROR.DUPLICATE_RESOURCE` | Agent already exists | Use different agent_id or update existing |

#### Upstream Errors (502)

| Code | Description | Resolution |
|------|-------------|------------|
| `UPSTREAM_ERROR.SERVICE_UNAVAILABLE` | Downstream service unavailable | Check service health, retry |
| `UPSTREAM_ERROR.SERVICE_TIMEOUT` | Downstream service timeout | Retry with backoff |

#### Internal Errors (500)

| Code | Description | Resolution |
|------|-------------|------------|
| `SERVICE_ERROR.INTERNAL_ERROR` | Unexpected server error | Contact support with request_id |

### Error Response Structure

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CATEGORY.SPECIFIC_CODE",
    "message": "Human-readable description",
    "category": "ERROR_CATEGORY",
    "details": [
      {
        "field": "field_name",
        "code": "SPECIFIC_CODE",
        "message": "Field-specific message",
        "path": ["nested", "field", "path"]
      }
    ],
    "request_id": "uuid",
    "timestamp": "ISO 8601",
    "documentation_url": "https://docs.chrysalis.dev/errors/...",
    "retry_after": 60,
    "suggestions": [
      "Actionable suggestion 1",
      "Actionable suggestion 2"
    ]
  },
  "meta": {
    "request_id": "uuid",
    "timestamp": "ISO 8601"
  }
}
```

### Retry Strategies

**Exponential Backoff**:
```python
import time
import requests

def create_agent_with_retry(payload, max_retries=3):
    for attempt in range(max_retries):
        try:
            response = requests.post(
                "http://localhost:5000/api/v1/agents",
                json=payload,
                headers={"Authorization": f"Bearer {token}"},
                timeout=300
            )
            
            if response.status_code == 502:
                # Upstream error - retry with backoff
                wait_time = 2 ** attempt  # 1s, 2s, 4s
                time.sleep(wait_time)
                continue
            
            return response.json()
            
        except requests.exceptions.Timeout:
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
                continue
            raise
    
    raise Exception("Max retries exceeded")
```

**Rate Limit Handling**:
```python
def handle_rate_limit(response):
    if response.status_code == 429:
        retry_after = response.json()["error"].get("retry_after", 60)
        print(f"Rate limited. Waiting {retry_after} seconds...")
        time.sleep(retry_after)
        return True
    return False
```

---

## Usage Examples

### Python Examples

#### Complete Agent Creation Workflow

```python
import requests
import json
from typing import Dict, Any

class AgentBuilderClient:
    """Python client for AgentBuilder API."""
    
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        })
    
    def create_agent(
        self,
        agent_id: str,
        name: str,
        occupation: str,
        deepening_cycles: int = 0
    ) -> Dict[str, Any]:
        """Create a new agent."""
        payload = {
            "agent_id": agent_id,
            "role_model": {
                "name": name,
                "occupation": occupation
            },
            "deepening_cycles": deepening_cycles
        }
        
        response = self.session.post(
            f"{self.base_url}/api/v1/agents",
            json=payload,
            timeout=300
        )
        response.raise_for_status()
        return response.json()
    
    def get_agent(self, agent_id: str) -> Dict[str, Any]:
        """Retrieve agent by ID."""
        response = self.session.get(
            f"{self.base_url}/api/v1/agents/{agent_id}"
        )
        response.raise_for_status()
        return response.json()
    
    def list_agents(
        self,
        page: int = 1,
        per_page: int = 20,
        status: str = None
    ) -> Dict[str, Any]:
        """List agents with pagination."""
        params = {"page": page, "per_page": per_page}
        if status:
            params["filter[status]"] = status
        
        response = self.session.get(
            f"{self.base_url}/api/v1/agents",
            params=params
        )
        response.raise_for_status()
        return response.json()
    
    def update_agent(
        self,
        agent_id: str,
        **updates
    ) -> Dict[str, Any]:
        """Partially update agent."""
        response = self.session.patch(
            f"{self.base_url}/api/v1/agents/{agent_id}",
            json=updates
        )
        response.raise_for_status()
        return response.json()
    
    def delete_agent(self, agent_id: str) -> Dict[str, Any]:
        """Delete agent."""
        response = self.session.delete(
            f"{self.base_url}/api/v1/agents/{agent_id}"
        )
        response.raise_for_status()
        return response.json()
    
    def get_capabilities(self, agent_id: str) -> Dict[str, Any]:
        """Get agent capabilities."""
        response = self.session.get(
            f"{self.base_url}/api/v1/agents/{agent_id}/capabilities"
        )
        response.raise_for_status()
        return response.json()


# Usage Example
if __name__ == "__main__":
    # Initialize client
    client = AgentBuilderClient(
        base_url="http://localhost:5000",
        api_key="admin-key-001.secret123"
    )
    
    # Create agent
    print("Creating agent...")
    result = client.create_agent(
        agent_id="agent-bob-ross-001",
        name="Bob Ross",
        occupation="Artist",
        deepening_cycles=3
    )
    print(f"Created agent: {result['data']['agent_id']}")
    print(f"Skills: {len(result['data']['generated_skills'])}")
    print(f"Knowledge items: {len(result['data']['generated_knowledge'])}")
    
    # Get agent details
    print("\nRetrieving agent...")
    agent = client.get_agent("agent-bob-ross-001")
    print(f"Agent status: {agent['data']['status']}")
    
    # Update agent
    print("\nUpdating agent...")
    updated = client.update_agent(
        "agent-bob-ross-001",
        deepening_cycles=5
    )
    print(f"Updated deepening_cycles: {updated['data']['deepening_cycles']}")
    
    # Get capabilities
    print("\nGetting capabilities...")
    caps = client.get_capabilities("agent-bob-ross-001")
    print(f"Skills: {len(caps['data']['skills'])}")
    print(f"Knowledge: {len(caps['data']['knowledge'])}")
    
    # List all agents
    print("\nListing agents...")
    agents = client.list_agents(page=1, per_page=10)
    print(f"Total agents: {agents['meta']['pagination']['total']}")
```

#### Error Handling Example

```python
from requests.exceptions import HTTPError, Timeout, ConnectionError

def create_agent_safe(client, agent_id, name, occupation):
    """Create agent with comprehensive error handling."""
    try:
        result = client.create_agent(
            agent_id=agent_id,
            name=name,
            occupation=occupation,
            deepening_cycles=3
        )
        return result
        
    except HTTPError as e:
        response = e.response
        error_data = response.json()
        
        if response.status_code == 409:
            # Agent already exists
            print(f"Agent {agent_id} already exists")
            # Try to retrieve existing agent
            return client.get_agent(agent_id)
        
        elif response.status_code == 422:
            # Validation error
            error = error_data['error']
            print(f"Validation error: {error['message']}")
            if 'details' in error:
                for detail in error['details']:
                    print(f"  - {detail['field']}: {detail['message']}")
            return None
        
        elif response.status_code == 502:
            # Upstream service error
            print("Upstream service unavailable. Retrying...")
            time.sleep(5)
            return create_agent_safe(client, agent_id, name, occupation)
        
        else:
            print(f"HTTP Error {response.status_code}: {error_data}")
            return None
    
    except Timeout:
        print("Request timed out. The operation may still complete.")
        # Poll for agent creation
        time.sleep(10)
        try:
            return client.get_agent(agent_id)
        except:
            return None
    
    except ConnectionError:
        print("Cannot connect to AgentBuilder service")
        return None
```

### JavaScript/TypeScript Examples

#### TypeScript Client

```typescript
import axios, { AxiosInstance, AxiosError } from 'axios';

interface RoleModel {
  name: string;
  occupation: string;
  [key: string]: any;
}

interface Agent {
  agent_id: string;
  role_model: RoleModel;
  generated_skills: Skill[];
  generated_knowledge: KnowledgeItem[];
  status: 'completed' | 'pending' | 'failed';
  deepening_cycles?: number;
  created_at?: string;
  updated_at?: string;
}

interface Skill {
  skill_id: string;
  name: string;
  description: string;
  category: string;
}

interface KnowledgeItem {
  knowledge_id: string;
  entity: {
    text: string;
    type: string;
  };
  source: string;
  confidence: number;
}

interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: APIError;
  meta: {
    request_id: string;
    timestamp: string;
    version: string;
    pagination?: PaginationMeta;
  };
}

interface APIError {
  code: string;
  message: string;
  category: string;
  details?: Array<{
    field?: string;
    code?: string;
    message: string;
  }>;
  suggestions?: string[];
}

interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

class AgentBuilderClient {
  private client: AxiosInstance;

  constructor(baseURL: string, apiKey: string) {
    this.client = axios.create({
      baseURL: baseURL.replace(/\/$/, ''),
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 300000 // 5 minutes
    });
  }

  async createAgent(
    agentId: string,
    name: string,
    occupation: string,
    deepeningCycles: number = 0
  ): Promise<APIResponse<Agent>> {
    const response = await this.client.post<APIResponse<Agent>>(
      '/api/v1/agents',
      {
        agent_id: agentId,
        role_model: { name, occupation },
        deepening_cycles: deepeningCycles
      }
    );
    return response.data;
  }

  async getAgent(agentId: string): Promise<APIResponse<Agent>> {
    const response = await this.client.get<APIResponse<Agent>>(
      `/api/v1/agents/${agentId}`
    );
    return response.data;
  }

  async listAgents(
    page: number = 1,
    perPage: number = 20,
    status?: string
  ): Promise<APIResponse<Agent[]>> {
    const params: any = { page, per_page: perPage };
    if (status) params['filter[status]'] = status;

    const response = await this.client.get<APIResponse<Agent[]>>(
      '/api/v1/agents',
      { params }
    );
    return response.data;
  }

  async updateAgent(
    agentId: string,
    updates: Partial<{
      role_model: Partial<RoleModel>;
      deepening_cycles: number;
    }>
  ): Promise<APIResponse<Agent>> {
    const response = await this.client.patch<APIResponse<Agent>>(
      `/api/v1/agents/${agentId}`,
      updates
    );
    return response.data;
  }

  async deleteAgent(agentId: string): Promise<APIResponse<{ deleted: boolean; agent_id: string }>> {
    const response = await this.client.delete(
      `/api/v1/agents/${agentId}`
    );
    return response.data;
  }

  async getCapabilities(
    agentId: string
  ): Promise<APIResponse<{ skills: Skill[]; knowledge: KnowledgeItem[] }>> {
    const response = await this.client.get(
      `/api/v1/agents/${agentId}/capabilities`
    );
    return response.data;
  }
}

// Usage Example
async function main() {
  const client = new AgentBuilderClient(
    'http://localhost:5000',
    'admin-key-001.secret123'
  );

  try {
    // Create agent
    console.log('Creating agent...');
    const result = await client.createAgent(
      'agent-bob-ross-001',
      'Bob Ross',
      'Artist',
      3
    );
    console.log(`Created: ${result.data?.agent_id}`);
    console.log(`Skills: ${result.data?.generated_skills.length}`);

    // Get agent
    const agent = await client.getAgent('agent-bob-ross-001');
    console.log(`Status: ${agent.data?.status}`);

    // Update agent
    await client.updateAgent('agent-bob-ross-001', {
      deepening_cycles: 5
    });
    console.log('Agent updated');

  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<APIResponse<any>>;
      if (axiosError.response) {
        const apiError = axiosError.response.data.error;
        console.error(`API Error: ${apiError?.message}`);
        if (apiError?.suggestions) {
          console.error('Suggestions:', apiError.suggestions);
        }
      }
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

main();
```

### cURL Examples

#### Create Agent

```bash
curl -X POST http://localhost:5000/api/v1/agents \
  -H "Authorization: Bearer admin-key-001.secret123" \
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

#### Get Agent

```bash
curl -X GET http://localhost:5000/api/v1/agents/agent-bob-ross-001 \
  -H "Authorization: Bearer admin-key-001.secret123"
```

#### List Agents with Pagination

```bash
curl -X GET "http://localhost:5000/api/v1/agents?page=1&per_page=20&sort=-created_at" \
  -H "Authorization: Bearer admin-key-001.secret123"
```

#### Update Agent (PATCH)

```bash
curl -X PATCH http://localhost:5000/api/v1/agents/agent-bob-ross-001 \
  -H "Authorization: Bearer admin-key-001.secret123" \
  -H "Content-Type: application/json" \
  -d '{
    "deepening_cycles": 5
  }'
```

#### Replace Agent (PUT)

```bash
curl -X PUT http://localhost:5000/api/v1/agents/agent-bob-ross-001 \
  -H "Authorization: Bearer admin-key-001.secret123" \
  -H "Content-Type: application/json" \
  -d '{
    "role_model": {
      "name": "Bob Ross",
      "occupation": "Painter and Instructor"
    },
    "deepening_cycles": 7
  }'
```

#### Delete Agent

```bash
curl -X DELETE http://localhost:5000/api/v1/agents/agent-bob-ross-001 \
  -H "Authorization: Bearer admin-key-001.secret123"
```

#### Get Capabilities

```bash
curl -X GET http://localhost:5000/api/v1/agents/agent-bob-ross-001/capabilities \
  -H "Authorization: Bearer admin-key-001.secret123"
```

---

## Integration Patterns

### Synchronous Agent Creation

**Pattern**: Wait for complete agent creation before proceeding

```python
def create_agent_sync(client, agent_id, name, occupation):
    """Synchronous agent creation with full validation."""
    # Create agent (blocks until complete)
    result = client.create_agent(
        agent_id=agent_id,
        name=name,
        occupation=occupation,
        deepening_cycles=3
    )
    
    # Verify creation
    assert result['success'] == True
    assert result['data']['status'] == 'completed'
    
    # Validate capabilities
    caps = client.get_capabilities(agent_id)
    assert len(caps['data']['skills']) > 0
    assert len(caps['data']['knowledge']) > 0
    
    return result['data']
```

**Use Cases**:
- Interactive applications
- Small-scale agent creation
- Development/testing

**Limitations**:
- Blocks for 30-300 seconds
- Not suitable for bulk operations
- Single point of failure

### Asynchronous Agent Creation (Recommended for Production)

**Pattern**: Submit creation request and poll for completion

```python
import asyncio
from typing import Optional

async def create_agent_async(
    client,
    agent_id: str,
    name: str,
    occupation: str,
    poll_interval: int = 5,
    max_wait: int = 600
) -> Optional[Dict]:
    """Asynchronous agent creation with polling."""
    
    # Submit creation request (non-blocking)
    try:
        result = await asyncio.to_thread(
            client.create_agent,
            agent_id=agent_id,
            name=name,
            occupation=occupation,
            deepening_cycles=3
        )
        return result['data']
    except Exception as e:
        print(f"Creation failed: {e}")
        return None

async def create_multiple_agents(client, agents_data):
    """Create multiple agents concurrently."""
    tasks = [
        create_agent_async(
            client,
            agent['id'],
            agent['name'],
            agent['occupation']
        )
        for agent in agents_data
    ]
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    successful = [r for r in results if r and not isinstance(r, Exception)]
    failed = [r for r in results if isinstance(r, Exception)]
    
    return {
        'successful': successful,
        'failed': failed,
        'total': len(agents_data)
    }
```

### Batch Agent Creation

**Pattern**: Create multiple agents efficiently

```python
def batch_create_agents(client, agents_data, batch_size=5):
    """Create agents in batches to avoid overwhelming services."""
    results = []
    errors = []
    
    for i in range(0, len(agents_data), batch_size):
        batch = agents_data[i:i + batch_size]
        print(f"Processing batch {i//batch_size + 1}...")
        
        for agent_data in batch:
            try:
                result = client.create_agent(
                    agent_id=agent_data['id'],
                    name=agent_data['name'],
                    occupation=agent_data['occupation'],
                    deepening_cycles=agent_data.get('cycles', 0)
                )
                results.append(result['data'])
            except Exception as e:
                errors.append({
                    'agent_id': agent_data['id'],
                    'error': str(e)
                })
        
        # Rate limiting: wait between batches
        if i + batch_size < len(agents_data):
            time.sleep(2)
    
    return {
        'created': len(results),
        'failed': len(errors),
        'results': results,
        'errors': errors
    }
```

### Service Health Monitoring

**Pattern**: Monitor service health before operations

```python
def check_service_health(base_url: str) -> bool:
    """Check if AgentBuilder service is healthy."""
    try:
        response = requests.get(
            f"{base_url}/health",
            timeout=5
        )
        data = response.json()
        return (
            response.status_code == 200 and
            data.get('success') == True and
            data.get('data', {}).get('status') == 'healthy'
        )
    except:
        return False

def create_agent_with_health_check(client, *args, **kwargs):
    """Create agent only if service is healthy."""
    if not check_service_health(client.base_url):
        raise Exception("AgentBuilder service is unhealthy")
    
    return client.create_agent(*args, **kwargs)
```

---

## Performance & Rate Limiting

### Performance Characteristics

**Agent Creation Timing**:
- Minimum: 10-30 seconds (no deepening)
- Typical: 30-120 seconds (3-5 deepening cycles)
- Maximum: 300 seconds (11 deepening cycles)

**Factors Affecting Performance**:
1. **Deepening Cycles**: Linear impact on duration
2. **Knowledge Complexity**: Entity type and available data
3. **Corpus Size**: Larger corpus = longer skill generation
4. **Network Latency**: Upstream service communication
5. **Concurrent Load**: Shared resource contention

### Rate Limiting

**Default Limits**:
- 100 requests per minute per API key
- 20 burst requests allowed
- Applies to all authenticated endpoints

**Rate Limit Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1641945600
```

**429 Response**:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_ERROR.TOO_MANY_REQUESTS",
    "message": "Rate limit exceeded",
    "category": "RATE_LIMIT_ERROR",
    "retry_after": 60
  }
}
```

### Optimization Strategies

**1. Minimize Deepening Cycles**:
```python
# Use appropriate deepening for use case
agent = client.create_agent(
    agent_id="quick-agent",
    name="Test Agent",
    occupation="Developer",
    deepening_cycles=0  # Fastest creation
)
```

**2. Implement Caching**:
```python
from functools import lru_cache
import hashlib

@lru_cache(maxsize=100)
def get_agent_cached(client, agent_id):
    """Cache agent retrievals."""
    return client.get_agent(agent_id)
```

**3. Use Connection Pooling**:
```python
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry

session = requests.Session()
retry = Retry(total=3, backoff_factor=1)
adapter = HTTPAdapter(
    max_retries=retry,
    pool_connections=10,
    pool_maxsize=20
)
session.mount('http://', adapter)
session.mount('https://', adapter)
```

---

## Troubleshooting Guide

### Common Issues and Solutions

#### Issue 1: Agent Creation Timeout

**Symptoms**:
- Request times out after 300 seconds
- No response received
- Connection appears hung

**Causes**:
- Upstream services (KnowledgeBuilder/SkillBuilder) are slow
- High deepening_cycles value
- Network connectivity issues

**Solutions**:

1. **Reduce deepening cycles**:
```python
# Instead of:
deepening_cycles=11  # Takes 5+ minutes

# Use:
deepening_cycles=3  # Takes 30-60 seconds
```

2. **Check upstream service health**:
```bash
curl http://localhost:5002/health  # KnowledgeBuilder
curl http://localhost:5001/health  # SkillBuilder
```

3. **Increase client timeout**:
```python
client.session.timeout = 600  # 10 minutes
```

4. **Monitor service logs**:
```bash
# Check AgentBuilder logs
tail -f /var/log/agentbuilder/server.log

# Check for upstream errors
grep "UPSTREAM_ERROR" /var/log/agentbuilder/server.log
```

#### Issue 2: 409 Conflict - Duplicate Agent

**Symptoms**:
```json
{
  "error": {
    "code": "CONFLICT_ERROR.DUPLICATE_RESOURCE",
    "message": "Agent with id 'agent-001' already exists"
  }
}
```

**Solutions**:

1. **Use unique agent_id**:
```python
import uuid
agent_id = f"agent-{uuid.uuid4()}"
```

2. **Check if agent exists first**:
```python
try:
    agent = client.get_agent(agent_id)
    print(f"Agent {agent_id} already exists")
except:
    # Agent doesn't exist, create it
    agent = client.create_agent(...)
```

3. **Update existing agent instead**:
```python
try:
    result = client.create_agent(...)
except HTTPError as e:
    if e.response.status_code == 409:
        # Update instead
        result = client.update_agent(agent_id, ...)
```

#### Issue 3: 502 Bad Gateway - Upstream Service Unavailable

**Symptoms**:
```json
{
  "error": {
    "code": "UPSTREAM_ERROR.SERVICE_UNAVAILABLE",
    "message": "Failed to connect to builder service"
  }
}
```

**Diagnosis**:

1. **Check service status**:
```bash
# Check if services are running
ps aux | grep -E "(KnowledgeBuilder|SkillBuilder)"

# Check ports
netstat -an | grep -E "(5001|5002)"
```

2. **Verify environment variables**:
```bash
echo $SKILL_BUILDER_URL
echo $KNOWLEDGE_BUILDER_URL
```

3. **Test direct connectivity**:
```bash
curl http://localhost:5001/health
curl http://localhost:5002/health
```

**Solutions**:

1. **Start missing services**:
```bash
cd projects/SkillBuilder && python server.py &
cd projects/KnowledgeBuilder && python server.py &
```

2. **Update service URLs**:
```bash
export SKILL_BUILDER_URL=http://localhost:5001
export KNOWLEDGE_BUILDER_URL=http://localhost:5002
```

3. **Implement retry logic**:
```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10)
)
def create_agent_with_retry(client, *args, **kwargs):
    return client.create_agent(*args, **kwargs)
```

#### Issue 4: 401 Unauthorized

**Symptoms**:
```json
{
  "error": {
    "code": "AUTHENTICATION_ERROR.MISSING_AUTHORIZATION",
    "message": "Authentication required"
  }
}
```

**Solutions**:

1. **Verify API key format**:
```python
# Correct format: keyId.secret
api_key = "admin-key-001.a1b2c3d4e5f6"

# Incorrect formats:
# api_key = "admin-key-001"  # Missing secret
# api_key = "a1b2c3d4e5f6"   # Missing keyId
```

2. **Check Authorization header**:
```python
# Correct:
headers = {"Authorization": f"Bearer {api_key}"}

# Incorrect:
# headers = {"Authorization": api_key}  # Missing "Bearer"
# headers = {"Auth": f"Bearer {api_key}"}  # Wrong header name
```

3. **Verify API key is valid**:
```bash
# Test with curl
curl -X GET http://localhost:5000/api/v1/agents \
  -H "Authorization: Bearer admin-key-001.secret123" \
  -v  # Verbose output shows auth details
```

#### Issue 5: Empty Skills or Knowledge

**Symptoms**:
- Agent created successfully
- `generated_skills` array is empty
- `generated_knowledge` array is empty

**Causes**:
- Upstream services returned no data
- Invalid entity identifier
- Network issues during upstream calls

**Diagnosis**:

1. **Check agent status**:
```python
agent = client.get_agent(agent_id)
print(f"Status: {agent['data']['status']}")
print(f"Skills: {len(agent['data']['generated_skills'])}")
print(f"Knowledge: {len(agent['data']['generated_knowledge'])}")
```

2. **Test upstream services directly**:
```bash
# Test KnowledgeBuilder
curl -X POST http://localhost:5002/api/v1/knowledge \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "Bob Ross", "entity_type": "Person"}'

# Test SkillBuilder
curl -X POST http://localhost:5001/api/v1/skills \
  -H "Authorization
# Chrysalis API Authentication Guide

**Version**: 1.0  
**Last Updated**: 2026-01-11  
**Status**: Production

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication Methods](#authentication-methods)
3. [Getting Started](#getting-started)
4. [Making Authenticated Requests](#making-authenticated-requests)
5. [API Key Management](#api-key-management)
6. [Authorization and Permissions](#authorization-and-permissions)
7. [Security Best Practices](#security-best-practices)
8. [Troubleshooting](#troubleshooting)
9. [Code Examples](#code-examples)

---

## Overview

Chrysalis APIs use **Bearer token authentication** to secure all protected endpoints. The system supports two authentication mechanisms:

1. **API Keys** - Recommended for service-to-service communication
2. **JWT Tokens** - For user-based authentication (optional)

### Authentication vs. Authorization

- **Authentication**: Verifies *who* you are (identity)
- **Authorization**: Determines *what* you can do (permissions)

All Chrysalis services use a unified authentication framework located in [`shared/api_core/auth.py`](../../shared/api_core/auth.py).

---

## Authentication Methods

### Method 1: API Keys (Recommended)

API keys are the primary authentication method for Chrysalis services. They provide:
- Simple integration
- No expiration (unless manually revoked)
- Role-based access control
- Service-to-service authentication

**Format**: `<keyId>.<secret>`

**Example**: `admin-key-001.a1b2c3d4e5f6g7h8i9j0`

### Method 2: JWT Tokens (Optional)

JWT (JSON Web Token) authentication is available for user-based scenarios:
- Time-limited access (default: 24 hours)
- User identity tracking
- Fine-grained permissions
- Token refresh capabilities

**Format**: Standard JWT (3-part base64-encoded string)

**Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwicm9sZXMiOlsiYWRtaW4iXX0.signature`

---

## Getting Started

### Step 1: Bootstrap Initial API Key

For new installations, create your first API key using the bootstrap endpoint:

```bash
curl -X POST http://localhost:5000/api/v1/auth/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"name": "admin"}'
```

**Response**:
```json
{
  "success": true,
  "data": {
    "token": "admin-key-001.a1b2c3d4e5f6g7h8i9j0",
    "key": {
      "id": "admin-key-001",
      "secret": "a1b2c3d4e5f6g7h8i9j0",
      "name": "admin",
      "roles": ["admin"],
      "created_at": "2026-01-11T04:00:00.000Z"
    }
  },
  "meta": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-01-11T04:00:00.000Z",
    "version": "v1"
  }
}
```

**⚠️ Important**: 
- Bootstrap endpoint is **one-time use only**
- Save the returned token immediately - it cannot be retrieved later
- Store the token securely (environment variables, secrets manager)
- Bootstrap is disabled after first use

### Step 2: Store Your API Key Securely

**Environment Variable (Recommended)**:
```bash
export CHRYSALIS_API_KEY="admin-key-001.a1b2c3d4e5f6g7h8i9j0"
```

**Configuration File** (`.env`):
```bash
CHRYSALIS_API_KEY=admin-key-001.a1b2c3d4e5f6g7h8i9j0
```

**Never**:
- ❌ Commit API keys to version control
- ❌ Share keys in chat/email
- ❌ Hardcode keys in source code
- ❌ Log keys in application logs

### Step 3: Verify Authentication

Test your API key with a simple request:

```bash
curl -X GET http://localhost:5000/api/v1/agents \
  -H "Authorization: Bearer admin-key-001.a1b2c3d4e5f6g7h8i9j0"
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": [],
  "meta": {
    "request_id": "...",
    "timestamp": "2026-01-11T04:00:00.000Z",
    "version": "v1",
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total": 0,
      "total_pages": 0,
      "has_next": false,
      "has_prev": false
    }
  }
}
```

---

## Making Authenticated Requests

### Authorization Header Format

All authenticated requests must include the `Authorization` header:

```
Authorization: Bearer <token>
```

**Components**:
- **Scheme**: `Bearer` (case-insensitive, but conventionally capitalized)
- **Token**: Your API key or JWT token
- **Separator**: Single space between scheme and token

### Request Examples

#### cURL
```bash
curl -X POST http://localhost:5000/api/v1/agents \
  -H "Authorization: Bearer ${CHRYSALIS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent-001",
    "role_model": {
      "name": "Bob Ross",
      "occupation": "Artist"
    },
    "deepening_cycles": 3
  }'
```

#### Python (requests)
```python
import os
import requests

API_KEY = os.getenv("CHRYSALIS_API_KEY")
BASE_URL = "http://localhost:5000"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

response = requests.post(
    f"{BASE_URL}/api/v1/agents",
    headers=headers,
    json={
        "agent_id": "agent-001",
        "role_model": {
            "name": "Bob Ross",
            "occupation": "Artist"
        },
        "deepening_cycles": 3
    }
)

if response.status_code == 201:
    agent = response.json()
    print(f"Agent created: {agent['data']['agent_id']}")
else:
    print(f"Error: {response.status_code} - {response.text}")
```

#### JavaScript (fetch)
```javascript
const API_KEY = process.env.CHRYSALIS_API_KEY;
const BASE_URL = 'http://localhost:5000';

async function createAgent() {
  const response = await fetch(`${BASE_URL}/api/v1/agents`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      agent_id: 'agent-001',
      role_model: {
        name: 'Bob Ross',
        occupation: 'Artist'
      },
      deepening_cycles: 3
    })
  });

  if (response.ok) {
    const agent = await response.json();
    console.log('Agent created:', agent.data.agent_id);
  } else {
    const error = await response.json();
    console.error('Error:', error);
  }
}

createAgent();
```

#### TypeScript (axios)
```typescript
import axios, { AxiosError } from 'axios';

const API_KEY = process.env.CHRYSALIS_API_KEY!;
const BASE_URL = 'http://localhost:5000';

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  }
});

interface AgentCreateRequest {
  agent_id: string;
  role_model: {
    name: string;
    occupation: string;
  };
  deepening_cycles: number;
}

async function createAgent(request: AgentCreateRequest) {
  try {
    const response = await client.post('/api/v1/agents', request);
    console.log('Agent created:', response.data.data.agent_id);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('API Error:', error.response?.data);
    }
    throw error;
  }
}
```

---

## API Key Management

### Key Structure

API keys follow the format: `<keyId>.<secret>`

**Components**:
- **keyId**: Unique identifier (e.g., `admin-key-001`)
- **secret**: Cryptographic secret (e.g., `a1b2c3d4e5f6g7h8i9j0`)
- **Separator**: Single period (`.`)

### Key Roles

Chrysalis supports role-based access control:

| Role | Permissions | Use Case |
|------|-------------|----------|
| `admin` | Full access to all resources | System administration |
| `service` | Service-to-service communication | Backend services |
| `user` | Limited access based on ownership | End-user applications |

### Creating Additional Keys

After bootstrapping, create additional keys via the admin interface or programmatically:

```python
# Using admin key to create service key
import requests

ADMIN_KEY = os.getenv("CHRYSALIS_ADMIN_KEY")

response = requests.post(
    "http://localhost:5000/api/v1/auth/keys",
    headers={"Authorization": f"Bearer {ADMIN_KEY}"},
    json={
        "name": "knowledge-service",
        "roles": ["service"],
        "permissions": ["knowledge:read", "knowledge:write"]
    }
)

new_key = response.json()["data"]["token"]
print(f"New service key: {new_key}")
```

### Key Rotation

**Best Practice**: Rotate API keys every 90 days

**Rotation Process**:
1. Create new API key
2. Update applications with new key
3. Verify all services using new key
4. Revoke old key
5. Monitor for authentication errors

```bash
# 1. Create new key
NEW_KEY=$(curl -X POST http://localhost:5000/api/v1/auth/keys \
  -H "Authorization: Bearer ${ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"name": "rotated-key", "roles": ["service"]}' \
  | jq -r '.data.token')

# 2. Update environment
export CHRYSALIS_API_KEY="${NEW_KEY}"

# 3. Test new key
curl -X GET http://localhost:5000/health \
  -H "Authorization: Bearer ${NEW_KEY}"

# 4. Revoke old key (after verification)
curl -X DELETE http://localhost:5000/api/v1/auth/keys/${OLD_KEY_ID} \
  -H "Authorization: Bearer ${ADMIN_KEY}"
```

### Key Revocation

Immediately revoke compromised keys:

```bash
curl -X DELETE http://localhost:5000/api/v1/auth/keys/${KEY_ID} \
  -H "Authorization: Bearer ${ADMIN_KEY}"
```

**When to Revoke**:
- ✅ Key exposed in logs or version control
- ✅ Employee departure
- ✅ Service decommissioning
- ✅ Security incident
- ✅ Routine rotation schedule

---

## Authorization and Permissions

### Permission Model

Chrysalis uses a hierarchical permission model:

```
admin (role)
  └─ * (all permissions)

service (role)
  ├─ agents:read
  ├─ agents:write
  ├─ knowledge:read
  ├─ knowledge:write
  ├─ skills:read
  └─ skills:write

user (role)
  ├─ agents:read (own)
  ├─ agents:write (own)
  └─ knowledge:read (own)
```

### Checking Permissions

The authentication context includes role and permission information:

```python
from shared.api_core.auth import get_current_user

# In Flask route handler
@app.route('/api/v1/agents', methods=['POST'])
@require_auth
def create_agent():
    auth_context = get_current_user()
    
    # Check role
    if auth_context.has_role('admin'):
        # Admin can create agents for anyone
        pass
    
    # Check permission
    if auth_context.has_permission('agents:write'):
        # User can create their own agents
        pass
    
    # ... rest of handler
```

### Role-Based Decorators

Use decorators to enforce role requirements:

```python
from shared.api_core.auth import require_role, require_permission

@app.route('/api/v1/admin/users', methods=['GET'])
@require_role('admin')
def list_users():
    # Only admins can access this endpoint
    pass

@app.route('/api/v1/agents/<agent_id>', methods=['DELETE'])
@require_permission('agents:delete')
def delete_agent(agent_id):
    # Requires specific permission
    pass
```

---

## Security Best Practices

### 1. Secure Storage

**✅ DO**:
- Store keys in environment variables
- Use secrets management systems (AWS Secrets Manager, HashiCorp Vault)
- Encrypt keys at rest
- Use separate keys per environment (dev, staging, prod)

**❌ DON'T**:
- Hardcode keys in source code
- Commit keys to version control
- Share keys via email/chat
- Reuse keys across environments

### 2. Key Rotation

**Recommended Schedule**:
- **Production**: Every 90 days
- **Staging**: Every 180 days
- **Development**: Annually or on-demand

**Automated Rotation**:
```bash
#!/bin/bash
# rotate-api-key.sh

OLD_KEY="${CHRYSALIS_API_KEY}"
NEW_KEY=$(create_new_key)

# Update all services
update_service_config "service-1" "${NEW_KEY}"
update_service_config "service-2" "${NEW_KEY}"

# Verify services healthy
verify_services

# Revoke old key
revoke_key "${OLD_KEY}"
```

### 3. Network Security

**Transport Security**:
- ✅ Use HTTPS in production
- ✅ Enable TLS 1.2 or higher
- ✅ Validate SSL certificates
- ❌ Never send keys over HTTP

**Network Isolation**:
- Use VPCs or private networks
- Implement firewall rules
- Restrict API access by IP (if applicable)
- Use API gateways for public access

### 4. Monitoring and Auditing

**Log Authentication Events**:
```python
import logging

logger = logging.getLogger(__name__)

@app.route('/api/v1/agents', methods=['POST'])
@require_auth
def create_agent():
    auth_context = get_current_user()
    logger.info(
        "Agent creation requested",
        extra={
            "user_id": auth_context.user_id,
            "roles": auth_context.roles,
            "ip_address": request.remote_addr
        }
    )
    # ... handler logic
```

**Monitor for**:
- Failed authentication attempts
- Unusual access patterns
- API key usage from unexpected IPs
- High-volume requests from single key

### 5. Least Privilege Principle

Grant minimum necessary permissions:

```python
# ❌ BAD: Overly permissive
create_key(name="app", roles=["admin"])

# ✅ GOOD: Minimal permissions
create_key(
    name="app",
    roles=["service"],
    permissions=["agents:read", "agents:write"]
)
```

---

## Troubleshooting

### Common Authentication Errors

#### Error: Missing Authorization Header

**HTTP 401 Unauthorized**
```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_ERROR.MISSING_AUTHORIZATION",
    "message": "Authentication required",
    "category": "AUTHENTICATION_ERROR",
    "timestamp": "2026-01-11T04:00:00.000Z",
    "documentation_url": "https://docs.chrysalis.dev/auth",
    "suggestions": [
      "Include 'Authorization: Bearer <token>' header in your request",
      "Obtain an API key from /auth/bootstrap endpoint"
    ]
  }
}
```

**Solution**:
```bash
# Add Authorization header
curl -X GET http://localhost:5000/api/v1/agents \
  -H "Authorization: Bearer ${CHRYSALIS_API_KEY}"
```

#### Error: Invalid Token

**HTTP 401 Unauthorized**
```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_ERROR.INVALID_TOKEN",
    "message": "Invalid authorization: token format invalid",
    "category": "AUTHENTICATION_ERROR",
    "timestamp": "2026-01-11T04:00:00.000Z"
  }
}
```

**Common Causes**:
1. **Malformed token**: Missing `.` separator
2. **Expired JWT**: Token past expiration time
3. **Wrong token**: Using token from different environment
4. **Typo**: Copy-paste error in token

**Solution**:
```bash
# Verify token format
echo "${CHRYSALIS_API_KEY}" | grep -E '^[^.]+\.[^.]+$'

# Check for whitespace
echo "${CHRYSALIS_API_KEY}" | od -c

# Regenerate if needed
curl -X POST http://localhost:5000/api/v1/auth/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"name": "admin"}'
```

#### Error: Insufficient Permissions

**HTTP 403 Forbidden**
```json
{
  "success": false,
  "error": {
    "code": "AUTHORIZATION_ERROR.INSUFFICIENT_PERMISSIONS",
    "message": "Role 'admin' required",
    "category": "AUTHORIZATION_ERROR",
    "timestamp": "2026-01-11T04:00:00.000Z"
  }
}
```

**Solution**:
- Use API key with appropriate role
- Request admin to grant necessary permissions
- Use different endpoint with lower permission requirements

#### Error: Bootstrap Already Used

**HTTP 409 Conflict**
```json
{
  "success": false,
  "error": {
    "code": "CONFLICT_ERROR.DUPLICATE_RESOURCE",
    "message": "API keys already initialized",
    "category": "CONFLICT_ERROR",
    "timestamp": "2026-01-11T04:00:00.000Z"
  }
}
```

**Solution**:
- Bootstrap is one-time only
- Use existing admin key to create additional keys
- Contact system administrator if admin key is lost

### Debugging Authentication Issues

**Enable Debug Logging**:
```python
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger('shared.api_core.auth')
logger.setLevel(logging.DEBUG)
```

**Test Authentication Manually**:
```python
from shared.api_core.auth import verify_api_key

# Test key verification
result = verify_api_key("admin-key-001.a1b2c3d4e5f6g7h8i9j0")
print(f"Valid: {result is not None}")
print(f"Details: {result}")
```

**Check Environment Variables**:
```bash
# Verify key is set
echo "Key set: ${CHRYSALIS_API_KEY:+YES}"

# Check for hidden characters
echo "${CHRYSALIS_API_KEY}" | xxd
```

---

## Code Examples

### Complete Python Client

```python
import os
import requests
from typing import Optional, Dict, Any

class ChrysalisClient:
    """Chrysalis API client with authentication."""
    
    def __init__(self, base_url: str, api_key: Optional[str] = None):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key or os.getenv('CHRYSALIS_API_KEY')
        
        if not self.api_key:
            raise ValueError("API key required. Set CHRYSALIS_API_KEY environment variable.")
        
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        })
    
    def create_agent(self, agent_id: str, name: str, occupation: str, 
                     deepening_cycles: int = 0) -> Dict[str, Any]:
        """Create a new agent."""
        response = self.session.post(
            f'{self.base_url}/api/v1/agents',
            json={
                'agent_id': agent_id,
                'role_model': {
                    'name': name,
                    'occupation': occupation
                },
                'deepening_cycles': deepening_cycles
            }
        )
        response.raise_for_status()
        return response.json()
    
    def get_agent(self, agent_id: str) -> Dict[str, Any]:
        """Get agent by ID."""
        response = self.session.get(f'{self.base_url}/api/v1/agents/{agent_id}')
        response.raise_for_status()
        return response.json()
    
    def list_agents(self, page: int = 1, per_page: int = 20) -> Dict[str, Any]:
        """List all agents with pagination."""
        response = self.session.get(
            f'{self.base_url}/api/v1/agents',
            params={'page': page, 'per_page': per_page}
        )
        response.raise_for_status()
        return response.json()

# Usage
client = ChrysalisClient('http://localhost:5000')

# Create agent
agent = client.create_agent(
    agent_id='agent-bob-ross',
    name='Bob Ross',
    occupation='Artist',
    deepening_cycles=3
)
print(f"Created: {agent['data']['agent_id']}")

# Get agent
agent = client.get_agent('agent-bob-ross')
print(f"Retrieved: {agent['data']['role_model']['name']}")

# List agents
agents = client.list_agents(page=1, per_page=10)
print(f"Total agents: {agents['meta']['pagination']['total']}")
```

### Complete JavaScript Client

```javascript
class ChrysalisClient {
  constructor(baseUrl, apiKey = null) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey || process.env.CHRYSALIS_API_KEY;
    
    if (!this.apiKey) {
      throw new Error('API key required. Set CHRYSALIS_API_KEY environment variable.');
    }
    
    this.headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }
  
  async createAgent(agentId, name, occupation, deepeningCycles = 0) {
    const response = await fetch(`${this.baseUrl}/api/v1/agents`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        agent_id: agentId,
        role_model: { name, occupation },
        deepening_cycles: deepeningCycles
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API Error: ${error.error.message}`);
    }
    
    return response.json();
  }
  
  async getAgent(agentId) {
    const response = await fetch(`${this.baseUrl}/api/v1/agents/${agentId}`, {
      headers: this.headers
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API Error: ${error.error.message}`);
    }
    
    return response.json();
  }
  
  async listAgents(page = 1, perPage = 20) {
    const url = new URL(`${this.baseUrl}/api/v1/agents`);
    url.searchParams.set('page', page);
    url.searchParams.set('per_page', perPage);
    
    const response = await fetch(url, { headers: this.headers });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API Error: ${error.error.message}`);
    }
    
    return response.json();
  }
}

// Usage
const client = new ChrysalisClient('http://localhost:5000');

// Create agent
const agent = await client.createAgent(
  'agent-bob-ross',
  'Bob Ross',
  'Artist',
  3
);
console.log('Created:', agent.data.agent_id);

// Get agent
const retrieved = await client.getAgent('agent-bob-ross');
console.log('Retrieved:', retrieved.data.role_model.name);

// List agents
const agents = await client.listAgents(1, 10);
console.log('Total agents:', agents.meta.pagination.total);
```

---

## Configuration Reference

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `CHRYSALIS_API_KEY` | Your API key | - | Yes |
| `JWT_SECRET` | JWT signing secret | `dev-secret-change-in-production` | Production |
| `JWT_EXPIRATION_HOURS` | JWT token lifetime | `24` | No |
| `ADMIN_KEY_IDS` | Comma-separated admin key IDs | - | No |

### Configuration Example

```bash
# .env file
CHRYSALIS_API_KEY=admin-key-001.a1b2c3d4e5f6g7h8i9j0
JWT_SECRET=your-production-secret-min-32-chars
JWT_EXPIRATION_HOURS=24
ADMIN_KEY_IDS=admin-key-001,admin-key-002
```

---

## Related Documentation

- [API Reference](openapi-template.yaml) - Complete API specification
- [Error Handling](ERROR_HANDLING.md) - Error codes and troubleshooting
- [Integration Guide](INTEGRATION_GUIDE.md) - End-to-end workflows
- [Rate Limiting](RATE_LIMITS.md) - Request quotas and throttling

---

## Support

**Documentation**: https://docs.chrysalis.dev  
**Issues**: https://github.com/chrysalis/chrysalis/issues  
**Security**: security@chrysalis.dev

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-11  
**Next Review**: 2026-02-11

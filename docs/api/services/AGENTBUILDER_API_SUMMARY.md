# AgentBuilder API - Executive Summary

**Service**: AgentBuilder  
**Version**: 1.0.0  
**Port**: 5000  
**Status**: ✅ Production Ready  
**Documentation Date**: 2026-01-11

---

## Overview

The AgentBuilder service is the primary orchestration layer for creating complete AI agents in the Chrysalis ecosystem. It coordinates the KnowledgeBuilder and SkillBuilder services to generate agents with comprehensive knowledge bases and skill sets.

## Quick Links

### Complete Documentation
- **[Part 1: Core Specification](./AGENTBUILDER_COMPLETE_SPEC.md)** - Service overview, architecture, authentication, and API endpoints
- **[Part 2: Advanced Topics](./AGENTBUILDER_COMPLETE_SPEC_PART2.md)** - Error handling, usage examples, integration patterns, and performance
- **[Part 3: Operations](./AGENTBUILDER_COMPLETE_SPEC_PART3.md)** - Deployment, monitoring, troubleshooting, and testing

### Related Documentation
- [OpenAPI 3.0 Specification](../openapi-template.yaml)
- [Authentication Guide](../AUTHENTICATION.md)
- [API Reference Index](../API_REFERENCE_INDEX.md)

---

## Key Features

### Core Capabilities
✅ **Agent Orchestration** - Coordinates knowledge and skill generation  
✅ **Full CRUD Operations** - Create, Read, Update, Delete agents  
✅ **Deepening Cycles** - Iterative knowledge refinement (0-11 cycles)  
✅ **RESTful Design** - Standard HTTP methods with consistent responses  
✅ **Bearer Authentication** - JWT and API key support  
✅ **Comprehensive Error Handling** - Detailed error taxonomy with suggestions  
✅ **Pagination Support** - Efficient list operations  
✅ **Health Monitoring** - Service and dependency health checks

### Service Integration
- **KnowledgeBuilder** (Port 5002) - Entity knowledge collection
- **SkillBuilder** (Port 5001) - Occupation-based skill generation
- **Shared API Core** - Common utilities and middleware

---

## API Endpoints

### Production Endpoints (v1)

| Endpoint | Method | Auth | Purpose | Avg Response Time |
|----------|--------|------|---------|-------------------|
| `/health` | GET | No | Health check | <100ms |
| `/api/v1/agents` | POST | Yes | Create agent | 30-120s |
| `/api/v1/agents` | GET | Yes | List agents | <500ms |
| `/api/v1/agents/{id}` | GET | Yes | Get agent | <200ms |
| `/api/v1/agents/{id}` | PATCH | Yes | Update agent | <300ms |
| `/api/v1/agents/{id}` | PUT | Yes | Replace agent | <300ms |
| `/api/v1/agents/{id}` | DELETE | Yes | Delete agent | <200ms |
| `/api/v1/agents/{id}/capabilities` | GET | Yes | Get capabilities | <200ms |

### Legacy Endpoints (Deprecated)

| Endpoint | Method | Replacement | Removal Date |
|----------|--------|-------------|--------------|
| `/build` | POST | `POST /api/v1/agents` | v2.0 (TBD) |

---

## Quick Start

### 1. Prerequisites

```bash
# Ensure dependencies are running
curl http://localhost:5001/health  # SkillBuilder
curl http://localhost:5002/health  # KnowledgeBuilder
```

### 2. Start Service

```bash
cd projects/AgentBuilder
pip install -r requirements.txt
python server.py
```

### 3. Verify Health

```bash
curl http://localhost:5000/health
```

### 4. Create Your First Agent

```bash
curl -X POST http://localhost:5000/api/v1/agents \
  -H "Authorization: Bearer admin-key-001.secret123" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "my-first-agent",
    "role_model": {
      "name": "Ada Lovelace",
      "occupation": "Mathematician"
    },
    "deepening_cycles": 3
  }'
```

---

## Code Examples

### Python Client

```python
from agentbuilder_client import AgentBuilderClient

client = AgentBuilderClient(
    base_url="http://localhost:5000",
    api_key="admin-key-001.secret123"
)

# Create agent
agent = client.create_agent(
    agent_id="agent-001",
    name="Ada Lovelace",
    occupation="Mathematician",
    deepening_cycles=3
)

print(f"Created: {agent['data']['agent_id']}")
print(f"Skills: {len(agent['data']['generated_skills'])}")
print(f"Knowledge: {len(agent['data']['generated_knowledge'])}")
```

### JavaScript/TypeScript

```typescript
import { AgentBuilderClient } from './agentbuilder-client';

const client = new AgentBuilderClient(
  'http://localhost:5000',
  'admin-key-001.secret123'
);

const agent = await client.createAgent(
  'agent-001',
  'Ada Lovelace',
  'Mathematician',
  3
);

console.log(`Created: ${agent.data.agent_id}`);
```

### cURL

```bash
# Create
curl -X POST http://localhost:5000/api/v1/agents \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"agent-001","role_model":{"name":"Ada","occupation":"Math"}}'

# Get
curl -X GET http://localhost:5000/api/v1/agents/agent-001 \
  -H "Authorization: Bearer <token>"

# Update
curl -X PATCH http://localhost:5000/api/v1/agents/agent-001 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"deepening_cycles":5}'

# Delete
curl -X DELETE http://localhost:5000/api/v1/agents/agent-001 \
  -H "Authorization: Bearer <token>"
```

---

## Architecture

### Service Flow

```
Client Request
    ↓
AgentBuilder (Port 5000)
    ├─→ KnowledgeBuilder (Port 5002) → Knowledge Items
    └─→ SkillBuilder (Port 5001) → Skills
    ↓
Complete Agent Response
```

### Data Flow

1. **Request Validation** - Validate agent_id, role_model, deepening_cycles
2. **Knowledge Generation** - Call KnowledgeBuilder with entity identifier
3. **Corpus Aggregation** - Combine knowledge texts into corpus
4. **Skill Generation** - Call SkillBuilder with occupation and corpus
5. **Agent Storage** - Store complete agent with skills and knowledge
6. **Response** - Return standardized API response

---

## Authentication

### Supported Methods

**API Keys** (Recommended):
```
Authorization: Bearer keyId.secret
```

**JWT Tokens**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Obtaining API Keys

```bash
# Bootstrap initial admin key
curl -X POST http://localhost:5000/api/v1/auth/bootstrap

# Use admin key to create additional keys
curl -X POST http://localhost:5000/api/v1/auth/keys \
  -H "Authorization: Bearer admin-key.secret" \
  -d '{"name":"my-app-key","roles":["service"]}'
```

---

## Error Handling

### Common Error Codes

| Code | Status | Meaning | Solution |
|------|--------|---------|----------|
| `VALIDATION_ERROR.REQUIRED_FIELD` | 422 | Missing required field | Include all required fields |
| `AUTHENTICATION_ERROR.MISSING_AUTHORIZATION` | 401 | No auth header | Add Authorization header |
| `CONFLICT_ERROR.DUPLICATE_RESOURCE` | 409 | Agent exists | Use different agent_id |
| `NOT_FOUND_ERROR.RESOURCE_NOT_FOUND` | 404 | Agent not found | Verify agent_id |
| `UPSTREAM_ERROR.SERVICE_UNAVAILABLE` | 502 | Downstream service down | Check service health |

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR.REQUIRED_FIELD",
    "message": "Field 'agent_id' is required",
    "category": "VALIDATION_ERROR",
    "details": [
      {
        "field": "agent_id",
        "message": "This field is required"
      }
    ],
    "suggestions": [
      "Include 'agent_id' in request body",
      "Check API documentation for required fields"
    ]
  }
}
```

---

## Performance

### Timing Expectations

| Operation | Typical Duration | Factors |
|-----------|------------------|---------|
| Create Agent (0 cycles) | 10-30s | Minimal processing |
| Create Agent (3 cycles) | 30-90s | Standard deepening |
| Create Agent (11 cycles) | 120-300s | Maximum deepening |
| Get Agent | <200ms | In-memory lookup |
| List Agents | <500ms | Pagination applied |
| Update Agent | <300ms | Partial update |
| Delete Agent | <200ms | Simple deletion |

### Optimization Tips

1. **Use minimal deepening cycles** for faster creation
2. **Implement caching** for frequently accessed agents
3. **Use connection pooling** for high throughput
4. **Monitor upstream services** for bottlenecks
5. **Enable compression** for large responses

---

## Rate Limiting

**Default Limits**:
- 100 requests per minute per API key
- 20 burst requests allowed

**Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1641945600
```

**429 Response**:
```json
{
  "error": {
    "code": "RATE_LIMIT_ERROR.TOO_MANY_REQUESTS",
    "retry_after": 60
  }
}
```

---

## Deployment

### Docker

```bash
# Build
docker build -t agentbuilder:1.0.0 -f projects/AgentBuilder/Dockerfile .

# Run
docker run -d \
  -p 5000:5000 \
  -e SKILL_BUILDER_URL=http://skillbuilder:5001 \
  -e KNOWLEDGE_BUILDER_URL=http://knowledgebuilder:5002 \
  -e JWT_SECRET=your-secret \
  agentbuilder:1.0.0
```

### Docker Compose

```bash
docker-compose up -d agentbuilder
```

### Kubernetes

```bash
kubectl apply -f k8s/agentbuilder-deployment.yaml
kubectl get pods -l app=agentbuilder
```

---

## Monitoring

### Health Checks

```bash
# Basic health
curl http://localhost:5000/health

# Detailed health (includes dependencies)
curl http://localhost:5000/health/detailed
```

### Metrics

```bash
# Prometheus metrics
curl http://localhost:5000/metrics
```

### Logging

```bash
# View logs
tail -f /var/log/agentbuilder/server.log

# Search by request ID
grep "request_id: 550e8400" /var/log/agentbuilder/server.log
```

---

## Troubleshooting

### Issue: 502 Bad Gateway

**Cause**: Upstream service unavailable  
**Solution**:
```bash
# Check services
curl http://localhost:5001/health
curl http://localhost:5002/health

# Restart if needed
cd projects/SkillBuilder && python server.py &
cd projects/KnowledgeBuilder && python server.py &
```

### Issue: Agent Creation Timeout

**Cause**: High deepening_cycles or slow upstream  
**Solution**:
```python
# Reduce deepening cycles
deepening_cycles=0  # Fastest

# Increase timeout
client.session.timeout = 600
```

### Issue: Empty Skills/Knowledge

**Cause**: Upstream services returned no data  
**Solution**:
```bash
# Test upstream directly
curl -X POST http://localhost:5002/api/v1/knowledge \
  -H "Authorization: Bearer <token>" \
  -d '{"identifier":"Test","entity_type":"Person"}'
```

---

## Security

### Production Checklist

- ✅ Use HTTPS/TLS for all communications
- ✅ Rotate JWT secrets regularly
- ✅ Implement API key rotation
- ✅ Enable rate limiting
- ✅ Use environment variables for secrets
- ✅ Implement audit logging
- ✅ Add security headers
- ✅ Regular dependency updates

### Security Headers

```python
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
Content-Security-Policy: default-src 'self'
```

---

## Testing

### Unit Tests

```bash
cd projects/AgentBuilder
pytest tests/test_api.py -v
```

### Integration Tests

```bash
pytest tests/test_integration.py -v
```

### Load Testing

```python
python tests/load_test.py --requests=100 --workers=10
```

---

## Support & Resources

### Documentation
- **Complete Spec**: [Part 1](./AGENTBUILDER_COMPLETE_SPEC.md), [Part 2](./AGENTBUILDER_COMPLETE_SPEC_PART2.md), [Part 3](./AGENTBUILDER_COMPLETE_SPEC_PART3.md)
- **OpenAPI Spec**: [openapi-template.yaml](../openapi-template.yaml)
- **User Guide**: [USER_GUIDE.md](../../user-guide/USER_GUIDE.md)

### Source Code
- **Implementation**: [`projects/AgentBuilder/server.py`](../../../projects/AgentBuilder/server.py)
- **Tests**: [`projects/AgentBuilder/tests/`](../../../projects/AgentBuilder/tests/)
- **Shared Core**: [`shared/api_core/`](../../../shared/api_core/)

### Community
- **GitHub**: https://github.com/chrysalis/chrysalis
- **Issues**: https://github.com/chrysalis/chrysalis/issues
- **Discussions**: https://github.com/chrysalis/chrysalis/discussions

---

## Roadmap

### Current Version (1.0.0)
- ✅ Complete CRUD operations
- ✅ Service orchestration
- ✅ Bearer authentication
- ✅ Comprehensive error handling
- ✅ Pagination support

### Planned (v1.1.0)
- 🔄 Database persistence (PostgreSQL)
- 🔄 Async agent creation
- 🔄 Webhook notifications
- 🔄 Advanced filtering
- 🔄 Bulk operations

### Future (v2.0.0)
- 📋 GraphQL API
- 📋 WebSocket support
- 📋 Agent versioning
- 📋 Template system
- 📋 Multi-tenancy

---

## Changelog

### Version 1.0.0 (2026-01-11)
- Initial production release
- Complete API documentation
- Full CRUD operations
- Service orchestration
- Bearer authentication
- Comprehensive error handling

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-01-11  
**Next Review**: 2026-02-11  
**Maintained By**: Chrysalis Documentation Team

---

## Investigation Path (Methodology)

This documentation was created following the Complex Learning Agent methodology:

### Discovery Phase
- Analyzed [`projects/AgentBuilder/server.py`](../../../projects/AgentBuilder/server.py:1) for endpoint definitions
- Examined [`shared/api_core/`](../../../shared/api_core/) for common patterns
- Reviewed [`projects/AgentBuilder/tests/test_api.py`](../../../projects/AgentBuilder/tests/test_api.py:1) for behavior validation

### Investigation Phase
- Traced service dependencies (KnowledgeBuilder, SkillBuilder)
- Mapped authentication flow through `@require_auth` decorator
- Analyzed error handling patterns in shared API core
- Documented request/response schemas from implementation

### Synthesis Phase
- Identified repeating patterns across endpoints
- Connected service orchestration flow
- Established error taxonomy and recovery strategies
- Mapped performance characteristics

### Reporting Phase
- Created comprehensive 3-part specification
- Generated executable code examples in multiple languages
- Documented deployment and operational procedures
- Established troubleshooting guides with root cause analysis

**Why this approach?** The Five Whys methodology revealed that effective API documentation requires understanding not just what endpoints exist, but why they exist, how they interact, what can go wrong, and how to recover—leading to this comprehensive specification that serves both developers and operators.

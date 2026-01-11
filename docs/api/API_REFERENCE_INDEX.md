# Chrysalis API Reference - Master Index

**Version**: 1.0  
**Last Updated**: 2026-01-11  
**Status**: Production

---

## Overview

Complete API documentation for the Chrysalis multi-agent system, including implemented services, extensibility patterns, and user guides.

---

## Documentation Structure

### 📘 Core API Documentation (Implemented Services)

#### Builder Services
1. **[AgentBuilder API](AGENTBUILDER_API.md)** - Agent orchestration and creation
   - Port: 5000
   - Endpoints: 10 (9 v1 + 1 legacy)
   - Status: ✅ Production

2. **[KnowledgeBuilder API](KNOWLEDGEBUILDER_API.md)** - Entity knowledge collection
   - Port: 5002
   - Endpoints: 10 (9 v1 + 1 legacy)
   - Status: ✅ Production

3. **[SkillBuilder API](SKILLBUILDER_API.md)** - Occupation-based skill generation
   - Port: 5001
   - Endpoints: 10 (9 v1 + 1 legacy)
   - Status: ✅ Production

#### Gateway Services
4. **[CapabilityGateway API](CAPABILITY_GATEWAY_API.md)** - API gateway and routing
   - Endpoints: 5
   - Status: ✅ Production

### 🔧 Infrastructure Documentation

5. **[Authentication Guide](AUTHENTICATION.md)** - Complete auth documentation
   - API keys and JWT tokens
   - Role-based access control
   - Security best practices

6. **[Error Handling Reference](ERROR_HANDLING.md)** - Error codes and troubleshooting
   - Complete error taxonomy
   - HTTP status code mapping
   - Retry strategies

7. **[Integration Workflows](INTEGRATION_GUIDE.md)** - End-to-end integration patterns
   - Complete agent creation workflow
   - Service orchestration patterns
   - Best practices

### 🚀 Extensibility Documentation (Future Services)

8. **[System Extensibility Guide](EXTENSIBILITY_ARCHITECTURE.md)** - Extension patterns
   - Service registration patterns
   - Interface contracts
   - Integration requirements

9. **[Future Services Specifications](FUTURE_SERVICES_SPECS.md)** - Architectural examples
   - TaskExecutionService
   - MemoryManagementService
   - LearningOptimizationService
   - InterAgentCommunicationService
   - MonitoringService
   - And 7 more...

### 👥 User Documentation

10. **[User Guide](../user-guide/USER_GUIDE.md)** - Complete user documentation
    - Getting started
    - Common workflows
    - Troubleshooting

11. **[Quick Start Guide](../user-guide/QUICK_START.md)** - 15-minute onboarding
    - First API call
    - Authentication setup
    - Basic operations

12. **[FAQ and Troubleshooting](../user-guide/FAQ.md)** - Common questions
    - Frequently asked questions
    - Common issues and solutions
    - Best practices

### 📚 Reference Materials

13. **[OpenAPI Specifications](openapi-template.yaml)** - Machine-readable specs
14. **[Data Models Reference](DATA_MODELS.md)** - Complete schema documentation
15. **[Code Examples Library](../examples/)** - Working code samples
16. **[Postman Collection](postman/)** - Interactive API testing

---

## Quick Navigation

### By Use Case

**I want to...**
- **Create an agent** → [AgentBuilder API](AGENTBUILDER_API.md#create-agent)
- **Add knowledge** → [KnowledgeBuilder API](KNOWLEDGEBUILDER_API.md#create-knowledge)
- **Generate skills** → [SkillBuilder API](SKILLBUILDER_API.md#create-skills)
- **Authenticate** → [Authentication Guide](AUTHENTICATION.md#getting-started)
- **Handle errors** → [Error Handling](ERROR_HANDLING.md)
- **Integrate my app** → [Integration Guide](INTEGRATION_GUIDE.md)
- **Extend the system** → [Extensibility Guide](EXTENSIBILITY_ARCHITECTURE.md)

### By Role

**For Developers:**
- [Quick Start Guide](../user-guide/QUICK_START.md)
- [Authentication Guide](AUTHENTICATION.md)
- [Integration Workflows](INTEGRATION_GUIDE.md)
- [Code Examples](../examples/)

**For Architects:**
- [System Architecture](../../ARCHITECTURE.md)
- [Extensibility Guide](EXTENSIBILITY_ARCHITECTURE.md)
- [Future Services Specs](FUTURE_SERVICES_SPECS.md)
- [Design Patterns](../../docs/DESIGN_PATTERN_ANALYSIS.md)

**For Operations:**
- [Deployment Guide](../ops/DEPLOYMENT.md)
- [Monitoring Guide](../ops/MONITORING.md)
- [Security Guide](../ops/SECURITY.md)

**For End Users:**
- [User Guide](../user-guide/USER_GUIDE.md)
- [FAQ](../user-guide/FAQ.md)
- [Video Tutorials](../user-guide/tutorials/)

---

## API Endpoint Summary

### AgentBuilder Service (Port 5000)

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/health` | GET | Health check | No |
| `/api/v1/agents` | POST | Create agent | Yes |
| `/api/v1/agents` | GET | List agents | Yes |
| `/api/v1/agents/{id}` | GET | Get agent | Yes |
| `/api/v1/agents/{id}` | PATCH | Update agent | Yes |
| `/api/v1/agents/{id}` | PUT | Replace agent | Yes |
| `/api/v1/agents/{id}` | DELETE | Delete agent | Yes |
| `/api/v1/agents/{id}/build` | POST | Build agent | Yes |
| `/api/v1/agents/{id}/capabilities` | GET | Get capabilities | Yes |
| `/build` | POST | Legacy create | Yes |

### KnowledgeBuilder Service (Port 5002)

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/health` | GET | Health check | No |
| `/api/v1/knowledge` | POST | Create knowledge | Yes |
| `/api/v1/knowledge` | GET | List knowledge | Yes |
| `/api/v1/knowledge/{id}` | GET | Get knowledge | Yes |
| `/api/v1/knowledge/{id}` | PATCH | Update knowledge | Yes |
| `/api/v1/knowledge/{id}` | PUT | Replace knowledge | Yes |
| `/api/v1/knowledge/{id}` | DELETE | Delete knowledge | Yes |
| `/api/v1/knowledge/search` | POST | Search knowledge | Yes |
| `/api/v1/knowledge/entities/{id}` | GET | Get by entity | Yes |
| `/knowledge` | POST | Legacy create | Yes |

### SkillBuilder Service (Port 5001)

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/health` | GET | Health check | No |
| `/api/v1/skills` | POST | Create skills | Yes |
| `/api/v1/skills` | GET | List skills | Yes |
| `/api/v1/skills/{id}` | GET | Get skills | Yes |
| `/api/v1/skills/{id}` | PATCH | Update skills | Yes |
| `/api/v1/skills/{id}` | PUT | Replace skills | Yes |
| `/api/v1/skills/{id}` | DELETE | Delete skills | Yes |
| `/api/v1/skills/modes` | GET | List modes | Yes |
| `/api/v1/skills/modes/{id}` | GET | Get mode | Yes |
| `/skills` | POST | Legacy create | Yes |

### CapabilityGateway Service

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/health` | GET | Health check | No |
| `/api/v1/auth/bootstrap` | POST | Create first API key | No |
| `/api/v1/capabilities` | GET | List capabilities | Yes |
| `/api/v1/capabilities` | POST | Build capability | Yes |
| `/api/v1/capabilities/{id}` | GET | Get capability | Yes |

**Total**: 35 endpoints across 4 services

---

## Authentication Quick Reference

All protected endpoints require Bearer token authentication:

```bash
Authorization: Bearer <api_key>
```

**API Key Format**: `<keyId>.<secret>`

**Example**:
```bash
curl -X GET http://localhost:5000/api/v1/agents \
  -H "Authorization: Bearer admin-key-001.a1b2c3d4e5f6g7h8i9j0"
```

See [Authentication Guide](AUTHENTICATION.md) for complete details.

---

## Common Response Format

All API responses follow a standardized format:

**Success Response**:
```json
{
  "success": true,
  "data": { /* response data */ },
  "meta": {
    "request_id": "uuid",
    "timestamp": "ISO 8601",
    "version": "v1"
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "category": "ERROR_CATEGORY",
    "details": [],
    "timestamp": "ISO 8601"
  },
  "meta": {
    "request_id": "uuid",
    "timestamp": "ISO 8601"
  }
}
```

---

## Versioning

**Current Version**: v1  
**API Prefix**: `/api/v1/`  
**Versioning Strategy**: URL-based

See [Versioning Strategy](VERSIONING.md) for details on API evolution and deprecation policies.

---

## Rate Limiting

**Default Limits**:
- 100 requests per minute per API key
- Burst allowance: 20 requests

**Rate Limit Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1641945600
```

See [Rate Limiting Guide](RATE_LIMITS.md) for complete details.

---

## Support and Resources

**Documentation**: https://docs.chrysalis.dev  
**API Status**: https://status.chrysalis.dev  
**GitHub**: https://github.com/chrysalis/chrysalis  
**Issues**: https://github.com/chrysalis/chrysalis/issues  
**Security**: security@chrysalis.dev  
**Support**: support@chrysalis.dev

---

## Contributing to Documentation

We welcome documentation improvements! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

**Documentation Source**: All documentation is maintained in the `/docs` directory of the main repository.

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-11 | Initial comprehensive API documentation |
| 0.9 | 2026-01-09 | Beta documentation release |

See [CHANGELOG.md](../../CHANGELOG.md) for complete version history.

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-11  
**Next Review**: 2026-02-11  
**Maintained By**: Documentation Team

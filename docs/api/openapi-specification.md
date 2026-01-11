# OpenAPI 3.0 Specification

**Version**: 1.0.0
**Last Updated**: 2025-01-XX
**Status**: Current

## Overview

This document provides comprehensive OpenAPI 3.0 specifications for all Chrysalis API services. Following the complex learner pattern, API documentation serves as a learning interface that helps both the system and its users understand patterns, relationships, and evolution over time.

## Services

The Chrysalis project includes three main API services:

1. **AgentBuilder** (`projects/AgentBuilder/server.py`)
   - Builds complete agents by orchestrating KnowledgeBuilder and SkillBuilder
   - Endpoints: `/api/v1/agents`

2. **KnowledgeBuilder** (`projects/KnowledgeBuilder/server.py`)
   - Collects and structures knowledge about entities
   - Endpoints: `/api/v1/knowledge`

3. **SkillBuilder** (`projects/SkillBuilder/server.py`)
   - Generates agent skills from occupation and corpus text
   - Endpoints: `/api/v1/skills`

## Common Patterns

All services follow the **Unified API Standard** with consistent patterns:

### Authentication
- **Type**: Bearer Token (JWT or API Key)
- **Header**: `Authorization: Bearer <token>`
- **Scope**: All endpoints except `/health`, `/healthz`, `/ready`, `/live`, `/metrics`

### Response Format
All responses follow the standard format:

```json
{
  "success": true,
  "data": { ... },
  "pagination": { ... },
  "meta": {
    "timestamp": "2025-01-XXT...",
    "request_id": "req_..."
  }
}
```

### Error Format
All errors follow the standard format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "category": "ERROR_CATEGORY",
    "details": { ... }
  },
  "meta": {
    "timestamp": "2025-01-XXT...",
    "request_id": "req_..."
  }
}
```

### Pagination
List endpoints support pagination:

- **Query Parameters**:
  - `page` (default: 1)
  - `per_page` (default: 20, max: 100)
  - `offset` (alternative to page)
- **Response Headers**:
  - `X-Pagination-Total`
  - `X-Pagination-Pages`
  - `X-Pagination-Current-Page`
  - `X-Pagination-Per-Page`

### Filtering and Sorting
List endpoints support filtering and sorting:

- **Filtering**: `filter[field]=value` or `filter[field][operator]=value`
- **Sorting**: `sort=field1,field2` or `sort=-field1,field2` (descending)

## AgentBuilder API

### Base URL
```
http://localhost:5000
```

### Endpoints

#### Health Check
- **GET** `/health`
- **GET** `/healthz` (Kubernetes convention)
- **GET** `/ready` (Readiness check)
- **GET** `/live` (Liveness check)

#### Metrics
- **GET** `/metrics` (Prometheus-format metrics)

#### Agent Management

##### Create Agent
- **POST** `/api/v1/agents`
- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "agent_id": "string",
    "role_model": {
      "name": "string",
      "occupation": "string",
      ...
    },
    "deepening_cycles": 0
  }
  ```
- **Response**: 201 Created
  ```json
  {
    "success": true,
    "data": {
      "agent_id": "string",
      "role_model": { ... },
      "generated_skills": [ ... ],
      "generated_knowledge": [ ... ]
    }
  }
  ```

##### Get Agent
- **GET** `/api/v1/agents/{agent_id}`
- **Authentication**: Required
- **Response**: 200 OK

##### List Agents
- **GET** `/api/v1/agents`
- **Authentication**: Required
- **Query Parameters**: `page`, `per_page`, `filter[...]`, `sort`
- **Response**: 200 OK with pagination

##### Update Agent (Partial)
- **PATCH** `/api/v1/agents/{agent_id}`
- **Authentication**: Required
- **Request Body**: Partial agent object
- **Response**: 200 OK

##### Replace Agent (Full)
- **PUT** `/api/v1/agents/{agent_id}`
- **Authentication**: Required
- **Request Body**: Complete agent object
- **Response**: 200 OK

##### Delete Agent
- **DELETE** `/api/v1/agents/{agent_id}`
- **Authentication**: Required
- **Response**: 204 No Content

##### Build Agent
- **POST** `/api/v1/agents/{agent_id}/build`
- **Authentication**: Required
- **Response**: 200 OK (triggers rebuild)

##### Get Agent Capabilities
- **GET** `/api/v1/agents/{agent_id}/capabilities`
- **Authentication**: Required
- **Response**: 200 OK
  ```json
  {
    "skills": [ ... ],
    "knowledge": [ ... ]
  }
  ```

## KnowledgeBuilder API

### Base URL
```
http://localhost:5002
```

### Endpoints

#### Create Knowledge
- **POST** `/api/v1/knowledge`
- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "identifier": "string",
    "entity_type": "string",
    "deepening_cycles": 0
  }
  ```
- **Response**: 201 Created

#### Get Knowledge
- **GET** `/api/v1/knowledge/{knowledge_id}`
- **Authentication**: Required
- **Response**: 200 OK

#### List Knowledge
- **GET** `/api/v1/knowledge`
- **Authentication**: Required
- **Query Parameters**: `page`, `per_page`, `filter[...]`, `sort`
- **Response**: 200 OK with pagination

#### Search Knowledge
- **POST** `/api/v1/knowledge/search`
- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "query": "string",
    "filters": { ... },
    "limit": 20
  }
  ```
- **Response**: 200 OK

#### Get Knowledge by Entity
- **GET** `/api/v1/knowledge/entities/{entity_id}`
- **Authentication**: Required
- **Response**: 200 OK

#### Update Knowledge (Partial)
- **PATCH** `/api/v1/knowledge/{knowledge_id}`
- **Authentication**: Required
- **Response**: 200 OK

#### Replace Knowledge (Full)
- **PUT** `/api/v1/knowledge/{knowledge_id}`
- **Authentication**: Required
- **Response**: 200 OK

#### Delete Knowledge
- **DELETE** `/api/v1/knowledge/{knowledge_id}`
- **Authentication**: Required
- **Response**: 204 No Content

## SkillBuilder API

### Base URL
```
http://localhost:5001
```

### Endpoints

#### Create Skills
- **POST** `/api/v1/skills`
- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "occupation": "string",
    "corpus_text": "string",
    "deepening_cycles": 0
  }
  ```
- **Response**: 201 Created

#### Get Skills
- **GET** `/api/v1/skills/{skill_id}`
- **Authentication**: Required
- **Response**: 200 OK

#### List Skills
- **GET** `/api/v1/skills`
- **Authentication**: Required
- **Query Parameters**: `page`, `per_page`, `filter[...]`, `sort`
- **Response**: 200 OK with pagination

#### Update Skills (Partial)
- **PATCH** `/api/v1/skills/{skill_id}`
- **Authentication**: Required
- **Response**: 200 OK

#### Replace Skills (Full)
- **PUT** `/api/v1/skills/{skill_id}`
- **Authentication**: Required
- **Response**: 200 OK

#### Delete Skills
- **DELETE** `/api/v1/skills/{skill_id}`
- **Authentication**: Required
- **Response**: 204 No Content

#### List Modes
- **GET** `/api/v1/skills/modes`
- **Authentication**: Required
- **Query Parameters**: `page`, `per_page`
- **Response**: 200 OK

#### Get Mode
- **GET** `/api/v1/skills/modes/{mode_id}`
- **Authentication**: Required
- **Response**: 200 OK

## OpenAPI Specification Files

Each service generates its OpenAPI specification:

- **AgentBuilder**: `/api/v1/openapi.json`
- **KnowledgeBuilder**: `/api/v1/openapi.json`
- **SkillBuilder**: `/api/v1/openapi.json`

Interactive documentation is available at:

- **AgentBuilder**: `/api/v1/docs`
- **KnowledgeBuilder**: `/api/v1/docs`
- **SkillBuilder**: `/api/v1/docs`

## Error Codes

### Standard Error Codes

- `VALIDATION_ERROR`: Request validation failed
- `RESOURCE_NOT_FOUND`: Resource not found
- `DUPLICATE_RESOURCE`: Resource already exists
- `AUTHENTICATION_ERROR`: Authentication failed
- `AUTHORIZATION_ERROR`: Authorization failed
- `RATE_LIMIT_ERROR`: Rate limit exceeded
- `INTERNAL_ERROR`: Internal server error
- `UPSTREAM_ERROR`: Upstream service error

### Error Categories

- `VALIDATION_ERROR`: Validation errors
- `NOT_FOUND_ERROR`: Resource not found
- `CONFLICT_ERROR`: Resource conflicts
- `AUTHENTICATION_ERROR`: Authentication errors
- `AUTHORIZATION_ERROR`: Authorization errors
- `RATE_LIMIT_ERROR`: Rate limiting errors
- `SERVICE_ERROR`: Service errors
- `UPSTREAM_ERROR`: Upstream service errors

## Rate Limiting

All endpoints are rate-limited:

- **Default**: 1000 requests per hour per IP
- **Headers**:
  - `X-RateLimit-Limit`: Request limit
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset timestamp
- **Response**: 429 Too Many Requests when exceeded
- **Retry-After**: Seconds until retry allowed

## Security Headers

All responses include security headers:

- `Strict-Transport-Security`: HSTS policy
- `Content-Security-Policy`: CSP policy
- `X-Frame-Options`: Frame protection
- `X-Content-Type-Options`: MIME type protection
- `X-XSS-Protection`: XSS protection
- `Referrer-Policy`: Referrer policy
- `Permissions-Policy`: Permissions policy

## Versioning

- **Current Version**: `v1`
- **Version Header**: `X-API-Version: v1`
- **Version Path**: `/api/v1/...`

## Request/Response Headers

### Request Headers
- `Authorization`: Bearer token (required for authenticated endpoints)
- `X-Request-ID`: Request ID for correlation (optional)
- `X-Client-Version`: Client version (optional)
- `Content-Type`: `application/json`

### Response Headers
- `X-API-Version`: API version
- `X-Request-ID`: Request ID for correlation
- `Content-Type`: `application/json`
- Security headers (see above)
- Rate limit headers (see above)
- Pagination headers (see above)

## Examples

### Example: Create Agent

```bash
curl -X POST http://localhost:5000/api/v1/agents \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "example-agent",
    "role_model": {
      "name": "Example Agent",
      "occupation": "Software Engineer"
    },
    "deepening_cycles": 2
  }'
```

### Example: List Agents with Pagination

```bash
curl -X GET "http://localhost:5000/api/v1/agents?page=1&per_page=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Example: Filter and Sort

```bash
curl -X GET "http://localhost:5000/api/v1/agents?filter[status]=active&sort=-created_at" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Interactive Documentation

Each service provides interactive Swagger UI documentation:

1. Start the service
2. Navigate to `/api/v1/docs`
3. Use the interactive interface to explore endpoints
4. Test endpoints directly from the UI

## Generating OpenAPI Specifications

OpenAPI specifications are automatically generated from code using `flasgger`:

```python
from shared.api_core.swagger import setup_swagger, create_swagger_config

swagger_config = create_swagger_config(
    title="Service API",
    version="1.0.0",
    description="Service description",
    api_version="v1"
)
setup_swagger(app, swagger_config)
```

## Schema Definitions

See individual service documentation for detailed schema definitions:

- Agent schemas: See AgentBuilder service
- Knowledge schemas: See KnowledgeBuilder service
- Skill schemas: See SkillBuilder service

## Changelog

- **1.0.0** (2025-01-XX): Initial comprehensive documentation

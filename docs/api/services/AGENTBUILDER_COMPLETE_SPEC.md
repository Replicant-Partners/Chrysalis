# AgentBuilder Service - Complete API Specification

**Version**: 1.0.0  
**Service Port**: 5000  
**API Version**: v1  
**Last Updated**: 2026-01-11  
**Status**: ✅ Production

---

## Table of Contents

1. [Service Overview](#service-overview)
2. [Architecture & Dependencies](#architecture--dependencies)
3. [Authentication & Security](#authentication--security)
4. [API Endpoints](#api-endpoints)
5. [Request/Response Schemas](#requestresponse-schemas)
6. [Error Handling](#error-handling)
7. [Usage Examples](#usage-examples)
8. [Integration Patterns](#integration-patterns)
9. [Performance & Rate Limiting](#performance--rate-limiting)
10. [Troubleshooting Guide](#troubleshooting-guide)
11. [Deployment & Operations](#deployment--operations)

---

## Service Overview

### Purpose

The AgentBuilder service orchestrates the creation of complete AI agents by coordinating the KnowledgeBuilder and SkillBuilder services. It provides a unified interface for agent lifecycle management including creation, retrieval, updating, and deletion.

### Key Capabilities

- **Agent Orchestration**: Coordinates knowledge and skill generation across multiple services
- **Lifecycle Management**: Full CRUD operations for agent resources
- **Capability Aggregation**: Combines knowledge clouds and skill sets into unified agent profiles
- **Deepening Cycles**: Supports iterative knowledge refinement (0-11 cycles)
- **RESTful Design**: Standard HTTP methods with consistent response formats

### Service Dependencies

```
AgentBuilder (Port 5000)
    ├── KnowledgeBuilder (Port 5002) - Knowledge cloud generation
    ├── SkillBuilder (Port 5001) - Skill set generation
    └── shared/api_core - Common API utilities
```

### Technology Stack

- **Framework**: Flask 3.0.0
- **HTTP Client**: requests 2.31.0
- **Documentation**: flasgger (Swagger/OpenAPI)
- **Authentication**: Bearer token (JWT/API Key)
- **Data Store**: In-memory (production should use database)

---

## Architecture & Dependencies

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Application                      │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/REST
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    AgentBuilder Service                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Middleware Layer                                     │  │
│  │  - Request ID generation                              │  │
│  │  - Authentication (@require_auth)                     │  │
│  │  - Error handling                                     │  │
│  │  - Response formatting                                │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Business Logic Layer                                 │  │
│  │  - Agent validation                                   │  │
│  │  - Service orchestration                              │  │
│  │  - Data aggregation                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Data Layer                                           │  │
│  │  - agents_store (in-memory dict)                      │  │
│  │  - TODO: Replace with database                        │  │
│  └──────────────────────────────────────────────────────┘  │
└────────┬──────────────────────────────────┬────────────────┘
         │                                   │
         ▼                                   ▼
┌──────────────────────┐          ┌──────────────────────┐
│ KnowledgeBuilder     │          │ SkillBuilder         │
│ Service (Port 5002)  │          │ Service (Port 5001)  │
└──────────────────────┘          └──────────────────────┘
```

### Service Communication Flow

**Agent Creation Process**:

```
1. Client → POST /api/v1/agents
   ├─ Validate request (agent_id, role_model)
   ├─ Check for duplicates
   └─ Extract authentication headers

2. AgentBuilder → KnowledgeBuilder
   ├─ POST /api/v1/knowledge
   ├─ Payload: {identifier, entity_type, deepening_cycles}
   ├─ Headers: Forward Authorization
   └─ Response: knowledge_items[]

3. AgentBuilder (Internal Processing)
   ├─ Aggregate knowledge texts into corpus
   └─ Prepare skill generation payload

4. AgentBuilder → SkillBuilder
   ├─ POST /api/v1/skills
   ├─ Payload: {occupation, deepening_cycles, corpus_text}
   ├─ Headers: Forward Authorization
   └─ Response: skills[]

5. AgentBuilder → Client
   ├─ Store complete agent
   └─ Return: {agent_id, role_model, skills, knowledge}
```

### Shared Dependencies

The service uses the `shared/api_core` module for standardized functionality:

**From [`shared/api_core/models.py`](../../../shared/api_core/models.py:1)**:
- `APIResponse` - Standard response wrapper
- `APIError` - Error structure
- `ErrorCode` / `ErrorCategory` - Error taxonomy
- `ValidationError` - Request validation errors
- `RequestValidator` - Field validation utilities
- `PaginationParams` / `PaginationMeta` - Pagination support
- `FilterParams` / `SortParams` - Query parameter handling

**From [`shared/api_core/auth.py`](../../../shared/api_core/auth.py:1)**:
- `require_auth` - Authentication decorator
- `authenticate_request` - Token verification
- `AuthContext` - User context object

**From [`shared/api_core/middleware.py`](../../../shared/api_core/middleware.py)**:
- `create_error_handler` - Global error handling
- `create_all_middleware` - Request/response middleware

### Environment Configuration

```bash
# Service URLs (defaults shown)
SKILL_BUILDER_URL=http://localhost:5001
KNOWLEDGE_BUILDER_URL=http://localhost:5002

# Authentication
JWT_SECRET=dev-secret-change-in-production
JWT_EXPIRATION_HOURS=24
ADMIN_KEY_IDS=admin-key-001,admin-key-002

# Service Configuration
FLASK_ENV=development
FLASK_DEBUG=True
PORT=5000
```

---

## Authentication & Security

### Authentication Methods

All protected endpoints require Bearer token authentication:

```http
Authorization: Bearer <token>
```

**Supported Token Types**:

1. **API Keys** (Format: `keyId.secret`)
   ```bash
   Authorization: Bearer admin-key-001.a1b2c3d4e5f6g7h8
   ```

2. **JWT Tokens** (Signed with HS256)
   ```bash
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

### Security Features

- **Token Validation**: All tokens verified before request processing
- **Header Forwarding**: Authorization headers forwarded to downstream services
- **Request ID Tracking**: Unique ID per request for audit trails
- **Error Sanitization**: Sensitive data removed from error responses
- **CORS Support**: Configurable cross-origin policies

### Authentication Flow

```python
# From server.py:96-97
@app.route('/api/v1/agents', methods=['POST'])
@require_auth  # Enforces authentication
def create_agent():
    # Authentication context available via flask.g.auth_context
    # Contains: user_id, token_type, roles, permissions
```

**Authentication Decorator Behavior**:
- Extracts token from `Authorization` header
- Validates token format and signature
- Populates `g.auth_context` with user information
- Returns 401 error if authentication fails

### Security Best Practices

1. **Never log tokens**: Tokens are excluded from request logs
2. **Use HTTPS in production**: Encrypt all traffic
3. **Rotate API keys regularly**: Implement key rotation policies
4. **Validate downstream responses**: Don't trust upstream services blindly
5. **Rate limit by token**: Prevent abuse per API key

---

## API Endpoints

### Endpoint Summary

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/health` | GET | No | Health check |
| `/api/v1/agents` | POST | Yes | Create agent |
| `/api/v1/agents` | GET | Yes | List agents |
| `/api/v1/agents/{agent_id}` | GET | Yes | Get agent |
| `/api/v1/agents/{agent_id}` | PATCH | Yes | Update agent |
| `/api/v1/agents/{agent_id}` | PUT | Yes | Replace agent |
| `/api/v1/agents/{agent_id}` | DELETE | Yes | Delete agent |
| `/api/v1/agents/{agent_id}/build` | POST | Yes | Rebuild agent |
| `/api/v1/agents/{agent_id}/capabilities` | GET | Yes | Get capabilities |
| `/build` | POST | Yes | Legacy create (deprecated) |

---

### 1. Health Check

**Endpoint**: `GET /health`  
**Authentication**: None  
**Purpose**: Service health verification

#### Request

```bash
curl -X GET http://localhost:5000/health
```

#### Response

**Status**: 200 OK

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "service": "agentbuilder"
  },
  "meta": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-01-11T05:00:00.000Z",
    "version": "v1"
  }
}
```

**Response Headers**:
```
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000
X-API-Version: v1
Content-Type: application/json
```

---

### 2. Create Agent

**Endpoint**: `POST /api/v1/agents`  
**Authentication**: Required  
**Purpose**: Create a new agent with knowledge and skills

#### Request

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body**:
```json
{
  "agent_id": "agent-bob-ross-001",
  "role_model": {
    "name": "Bob Ross",
    "occupation": "Artist"
  },
  "deepening_cycles": 3
}
```

**Field Specifications**:

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `agent_id` | string | Yes | 1-100 chars, unique | Unique agent identifier |
| `role_model` | object | Yes | - | Role model definition |
| `role_model.name` | string | Yes | 1-200 chars | Name of role model |
| `role_model.occupation` | string | Yes | 1-200 chars | Occupation/profession |
| `deepening_cycles` | integer | No | 0-11, default: 0 | Knowledge deepening iterations |

#### Response

**Status**: 201 Created

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
    ]
  },
  "meta": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-01-11T05:00:00.000Z",
    "version": "v1"
  }
}
```

#### Error Responses

**409 Conflict** - Agent already exists:
```json
{
  "success": false,
  "error": {
    "code": "CONFLICT_ERROR.DUPLICATE_RESOURCE",
    "message": "Agent with id 'agent-bob-ross-001' already exists",
    "category": "CONFLICT_ERROR",
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-01-11T05:00:00.000Z",
    "suggestions": [
      "Use a different agent_id",
      "Update existing agent with PATCH /api/v1/agents/{agent_id}"
    ]
  }
}
```

**422 Validation Error** - Missing required field:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR.REQUIRED_FIELD",
    "message": "Field 'role_model' is required",
    "category": "VALIDATION_ERROR",
    "details": [
      {
        "field": "role_model",
        "code": "REQUIRED_FIELD",
        "message": "This field is required"
      }
    ],
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-01-11T05:00:00.000Z"
  }
}
```

**502 Bad Gateway** - Upstream service failure:
```json
{
  "success": false,
  "error": {
    "code": "UPSTREAM_ERROR.SERVICE_UNAVAILABLE",
    "message": "Failed to connect to builder service: Connection refused",
    "category": "UPSTREAM_ERROR",
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-01-11T05:00:00.000Z",
    "retry_after": 30
  }
}
```

#### Implementation Details

**Source**: [`projects/AgentBuilder/server.py:95-196`](../../../projects/AgentBuilder/server.py:95)

**Process Flow**:
1. Validate request body (lines 100-109)
2. Check for duplicate agent_id (lines 112-118)
3. Call KnowledgeBuilder service (lines 123-137)
4. Aggregate knowledge into corpus (lines 140-144)
5. Call SkillBuilder service (lines 147-160)
6. Store agent data (lines 163-170)
7. Return standardized response (lines 173-178)

**Timeout Configuration**: 300 seconds for upstream calls

---

### 3. List Agents

**Endpoint**: `GET /api/v1/agents`  
**Authentication**: Required  
**Purpose**: Retrieve paginated list of agents

#### Request

**Headers**:
```
Authorization: Bearer <token>
```

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-indexed) |
| `per_page` | integer | 20 | Items per page (max 100) |
| `sort` | string | - | Sort fields (comma-separated, prefix `-` for desc) |
| `filter[status]` | string | - | Filter by status (completed, pending, failed) |

**Example**:
```bash
curl -X GET "http://localhost:5000/api/v1/agents?page=1&per_page=20&sort=-created_at" \
  -H "Authorization: Bearer <token>"
```

#### Response

**Status**: 200 OK

```json
{
  "success": true,
  "data": [
    {
      "agent_id": "agent-bob-ross-001",
      "role_model": {
        "name": "Bob Ross",
        "occupation": "Artist"
      },
      "generated_skills": [...],
      "generated_knowledge": [...],
      "status": "completed"
    }
  ],
  "meta": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-01-11T05:00:00.000Z",
    "version": "v1",
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total": 150,
      "total_pages": 8,
      "has_next": true,
      "has_prev": false
    }
  }
}
```

#### Implementation Details

**Source**: [`projects/AgentBuilder/server.py:205-218`](../../../projects/AgentBuilder/server.py:205)

Uses `process_list_request()` helper from shared API core for:
- Pagination calculation
- Filter application
- Sort ordering
- Metadata generation

---

### 4. Get Agent

**Endpoint**: `GET /api/v1/agents/{agent_id}`  
**Authentication**: Required  
**Purpose**: Retrieve specific agent by ID

#### Request

```bash
curl -X GET http://localhost:5000/api/v1/agents/agent-bob-ross-001 \
  -H "Authorization: Bearer <token>"
```

#### Response

**Status**: 200 OK

```json
{
  "success": true,
  "data": {
    "agent_id": "agent-bob-ross-001",
    "role_model": {
      "name": "Bob Ross",
      "occupation": "Artist"
    },
    "generated_skills": [...],
    "generated_knowledge": [...],
    "status": "completed",
    "created_at": "2026-01-11T04:00:00.000Z",
    "updated_at": "2026-01-11T04:00:00.000Z"
  },
  "meta": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-01-11T05:00:00.000Z",
    "version": "v1"
  }
}
```

**404 Not Found**:
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND_ERROR.RESOURCE_NOT_FOUND",
    "message": "Agent 'agent-bob-ross-001' not found",
    "category": "NOT_FOUND_ERROR",
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-01-11T05:00:00.000Z"
  }
}
```

#### Implementation Details

**Source**: [`projects/AgentBuilder/server.py:198-203`](../../../projects/AgentBuilder/server.py:198)

Uses `require_resource_exists()` helper to validate agent existence before returning.

---

### 5. Update Agent (Partial)

**Endpoint**: `PATCH /api/v1/agents/{agent_id}`  
**Authentication**: Required  
**Purpose**: Partially update agent fields

#### Request

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body** (all fields optional):
```json
{
  "role_model": {
    "name": "Bob Ross Jr."
  },
  "deepening_cycles": 5
}
```

**Behavior**:
- Only provided fields are updated
- `role_model` fields are merged (not replaced)
- Other fields remain unchanged
- `updated_at` timestamp is automatically set

#### Response

**Status**: 200 OK

```json
{
  "success": true,
  "data": {
    "agent_id": "agent-bob-ross-001",
    "role_model": {
      "name": "Bob Ross Jr.",
      "occupation": "Artist"  // Preserved from original
    },
    "deepening_cycles": 5,
    "generated_skills": [...],  // Preserved
    "generated_knowledge": [...],  // Preserved
    "updated_at": "2026-01-11T05:30:00.000Z"
  },
  "meta": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-01-11T05:30:00.000Z",
    "version": "v1"
  }
}
```

#### Validation Rules

**deepening_cycles**:
- Must be integer between 0 and 11
- Returns 422 if out of range

**role_model**:
- Must be object/dictionary
- Fields are merged with existing values
- Returns 422 if not an object

#### Implementation Details

**Source**: [`projects/AgentBuilder/server.py:240-290`](../../../projects/AgentBuilder/server.py:240)

**Merge Logic** (lines 250-262):
```python
if 'role_model' in data:
    if isinstance(data['role_model'], dict):
        if 'role_model' not in agent:
            agent['role_model'] = {}
        agent['role_model'].update(data['role_model'])  # Merge
```

---

### 6. Replace Agent (Full)

**Endpoint**: `PUT /api/v1/agents/{agent_id}`  
**Authentication**: Required  
**Purpose**: Completely replace agent data

#### Request

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body** (all required fields must be provided):
```json
{
  "role_model": {
    "name": "New Name",
    "occupation": "New Occupation"
  },
  "deepening_cycles": 7
}
```

**Behavior**:
- Replaces entire agent resource
- All required fields must be provided
- Generated skills/knowledge are preserved
- Creates agent if doesn't exist (upsert behavior)

#### Response

**Status**: 200 OK

```json
{
  "success": true,
  "data": {
    "agent_id": "agent-bob-ross-001",
    "role_model": {
      "name": "New Name",
      "occupation": "New Occupation"
    },
    "deepening_cycles": 7,
    "generated_skills": [...],  // Preserved
    "generated_knowledge": [...],  // Preserved
    "status": "updated",
    "updated_at": "2026-01-11T05:45:00.000Z"
  },
  "meta": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-01-11T05:45:00.000Z",
    "version": "v1"
  }
}
```

#### Implementation Details

**Source**: [`projects/AgentBuilder/server.py:292-329`](../../../projects/AgentBuilder/server.py:292)

**Difference from PATCH**:
- PUT requires all fields
- PUT replaces entire resource
- PATCH only updates provided fields

---

### 7. Delete Agent

**Endpoint**: `DELETE /api/v1/agents/{agent_id}`  
**Authentication**: Required  
**Purpose**: Permanently delete agent

#### Request

```bash
curl -X DELETE http://localhost:5000/api/v1/agents/agent-bob-ross-001 \
  -H "Authorization: Bearer <token>"
```

#### Response

**Status**: 200 OK

```json
{
  "success": true,
  "data": {
    "deleted": true,
    "agent_id": "agent-bob-ross-001"
  },
  "meta": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-01-11T06:00:00.000Z",
    "version": "v1"
  }
}
```

**404 Not Found** - Agent doesn't exist:
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND_ERROR.RESOURCE_NOT_FOUND",
    "message": "Agent 'agent-bob-ross-001' not found",
    "category": "NOT_FOUND_ERROR"
  }
}
```

#### Implementation Details

**Source**: [`projects/AgentBuilder/server.py:331-339`](../../../projects/AgentBuilder/server.py:331)

**Warning**: Deletion is permanent and cannot be undone. In production, consider:
- Soft deletes with `deleted_at` timestamp
- Archival to separate storage
- Audit logging of deletions

---

### 8. Get Agent Capabilities

**Endpoint**: `GET /api/v1/agents/{agent_id}/capabilities`  
**Authentication**: Required  
**Purpose**: Retrieve agent's skills and knowledge

#### Request

```bash
curl -X GET http://localhost:5000/api/v1/agents/agent-bob-ross-001/capabilities \
  -H "Authorization: Bearer <token>"
```

#### Response

**Status**: 200 OK

```json
{
  "success": true,
  "data": {
    "skills": [
      {
        "skill_id": "skill-001",
        "name": "Color Theory",
        "description": "Understanding of color relationships",
        "category": "Technical"
      }
    ],
    "knowledge": [
      {
        "knowledge_id": "knowledge-001",
        "entity": {
          "text": "Bob Ross was an American painter...",
          "type": "Person"
        },
        "source": "Wikipedia",
        "confidence": 0.95
      }
    ]
  },
  "meta": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-01-11T06:15:00.000Z",
    "version": "v1"
  }
}
```

#### Implementation Details

**Source**: [`projects/AgentBuilder/server.py:228-238`](../../../projects/AgentBuilder/server.py:228)

Extracts and returns only the `generated_skills` and `generated_knowledge` fields from the agent record.

---

### 9. Legacy Create Endpoint (Deprecated)

**Endpoint**: `POST /build`  
**Authentication**: Required  
**Purpose**: Legacy agent creation (backward compatibility)

#### Deprecation Notice

⚠️ **This endpoint is deprecated and will be removed in v2.0**

**Migration Path**: Use `POST /api/v1/agents` instead

#### Request

**Body** (legacy format):
```json
{
  "agentId": "agent-001",
  "roleModel": {
    "name": "Bob Ross",
    "occupation": "Artist"
  },
  "deepeningCycles": 3
}
```

#### Response

**Status**: 201 Created

Response includes deprecation warning:
```json
{
  "success": true,
  "data": {...},
  "meta": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-01-11T06:30:00.000Z",
    "version": "v1",
    "deprecated": true,
    "deprecation_notice": "Use POST /api/v1/agents instead"
  }
}
```

#### Implementation Details

**Source**: [`projects/AgentBuilder/server.py:342-381`](../../../projects/AgentBuilder/server.py:342)

Transforms legacy camelCase format to snake_case and delegates to `create_agent()`.

---

## Request/Response Schemas

### Standard Response Envelope

All responses follow this structure:

```typescript
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: APIError;
  meta: ResponseMeta;
}

interface ResponseMeta {
  request_id: string;  // UUID v4
  timestamp: string;   // ISO 8601
  version: string;     // API version (e.g., "v1")
  deprecated?: boolean;
  deprecation_notice?: string;
  pagination?: PaginationMeta;
}
```

### Agent Schema

```typescript
interface Agent {
  agent_id: string;
  role_model: RoleModel;
  generated_skills: Skill[];
  generated_knowledge: KnowledgeItem[];
  status: 'completed' | 'pending' | 'failed';
  deepening_cycles?: number;
  created_at?: string;  // ISO 8601
  updated_at?: string;  // ISO 8601
}

interface RoleModel {
  name: string;
  occupation: string;
  [key: string]: any;  // Additional properties allowed
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
  confidence: number;  // 0.0 to 1.0
}
```

### Error Schema

```typescript
interface APIError {
  code: string;           // e.g., "VALIDATION_ERROR.REQUIRED_FIELD"
  message: string;        // Human-readable message
  category: ErrorCategory;
  details?: ErrorDetail[];
  request_id?: string;
  timestamp: string;
  documentation_url?: string;
  retry_after?: number;   // Seconds (for rate limits)
  suggestions?: string[];
}

interface ErrorDetail {
  field?: string;
  code?: string;
  message: string;
  path?: string[];
}

enum ErrorCategory {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR = "AUTHORIZATION_ERROR",
  NOT_FOUND_ERROR = "NOT_FOUND_ERROR",
  CONFLICT_ERROR = "CONFLICT_ERROR",
  RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR",
  SERVICE_ERROR = "SERVICE_ERROR",
  UPSTREAM_ERROR = "UPSTREAM_ERROR"
}
```

### Pagination Schema

```typescript
interface PaginationMeta {
  page: number;        // Current page (1-indexed)
  per_page: number;    // Items per page
  total: number;       // Total items
  total_pages: number; // Total pages
  has_next: boolean;   // Has next page
  has_prev: boolean;   // Has previous page
}
```

---

## Error Handling

### Error Code Taxonomy

#### Validation Errors (422)

| Code | Description | Resolution |
|------|-------------|------------|
| `VALIDATION_ERROR.REQUIRED_FIELD` | Required field missing | Include required field in request |
| `VALIDATION_ERROR.INVALID_FORMAT` | Invalid data format | Check field format/type |
| `VALIDATION_ERROR.INVALID_TYPE` | Wrong data type | Use correct type (string, int, etc.) |
| `VALIDATION_ERROR.INVALID_RANGE` | Value out of range | Use value within allowed range |

#### Authentication Errors (401)

| Code | Description | Resolution |
|------|-------------|------------|
| `AUTHENTICATION_ERROR
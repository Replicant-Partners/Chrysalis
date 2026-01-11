# SkillBuilder API Specification

**Version**: 1.0.0  
**Base URL**: `http://localhost:5001`  
**API Version**: v1  
**Date**: 2026-01-11

---

## Overview

The SkillBuilder service generates agent skills from occupation and corpus text using exemplar-driven research. It provides RESTful endpoints for creating, managing, and retrieving skill sets with support for deepening cycles to enhance skill quality.

### Key Features

- **Occupation-based skill generation**: Generate skills from occupation descriptions
- **Corpus text integration**: Enhance skills with custom corpus text
- **Deepening cycles**: Iterative refinement (0-11 cycles)
- **Skill embeddings**: Vector representations for semantic search
- **Mode management**: Query available skill generation modes
- **Full CRUD operations**: Create, read, update, and delete skill sets

### Architecture

SkillBuilder uses the unified API standard with:
- Standardized request/response formats via [`shared/api_core`](../../../shared/api_core/)
- Bearer token authentication
- Comprehensive error handling
- Pagination, filtering, and sorting support
- Rate limiting and monitoring

---

## Authentication

All endpoints except `/health` require authentication using Bearer tokens.

**Header Format**:
```
Authorization: Bearer <api_key>
```

**API Key Format**: `<keyId>.<secret>`

See [`AUTHENTICATION.md`](../AUTHENTICATION.md) for detailed authentication documentation.

---

## Endpoints

### Health Check

#### `GET /health`

Returns service health status.

**Authentication**: None required

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "service": "skillbuilder"
  },
  "meta": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-01-11T04:00:00.000Z",
    "version": "v1"
  }
}
```

---

### Create Skills

#### `POST /api/v1/skills`

Generates skills for a specified occupation with optional corpus text and deepening cycles.

**Authentication**: Required

**Request Body**:
```json
{
  "occupation": "Software Engineer",
  "deepening_cycles": 3,
  "corpus_text": "Optional text to enhance skill generation"
}
```

**Request Schema**:

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `occupation` | string | Yes | min: 1 char | Occupation or profession for skill generation |
| `deepening_cycles` | integer | No | 0-11, default: 0 | Number of iterative refinement cycles |
| `corpus_text` | string | No | - | Additional text to inform skill generation |

**Process Flow**:
1. Validates request parameters
2. Creates [`FrontendSpec`](../../../projects/SkillBuilder/skill_builder/pipeline/models.py) with occupation and configuration
3. Runs skill generation pipeline via [`run_pipeline()`](../../../projects/SkillBuilder/skill_builder/pipeline/runner.py)
4. Generates skill embeddings for semantic search
5. Stores skills with unique ID
6. Returns complete skill set with embeddings

**Response**: `201 Created`
```json
{
  "success": true,
  "data": {
    "skill_id": "550e8400-e29b-41d4-a716-446655440000",
    "occupation": "Software Engineer",
    "skills": [
      {
        "skill": "name: Algorithm Design\ndescription: Design efficient algorithms...",
        "embedding": [0.123, 0.456, ...]
      },
      {
        "skill": "name: Code Review\ndescription: Review code for quality...",
        "embedding": [0.789, 0.012, ...]
      }
    ],
    "total_skills": 2
  },
  "meta": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-01-11T04:00:00.000Z",
    "version": "v1"
  }
}
```

**Error Responses**:

- `401 Unauthorized`: Missing or invalid authentication
- `422 Unprocessable Entity`: Validation error (invalid occupation, deepening_cycles out of range)
- `500 Internal Server Error`: Skill generation pipeline failure

**Example cURL**:
```bash
curl -X POST http://localhost:5001/api/v1/skills \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "occupation": "Software Engineer",
    "deepening_cycles": 3
  }'
```

**Example Python**:
```python
import requests

response = requests.post(
    "http://localhost:5001/api/v1/skills",
    headers={"Authorization": f"Bearer {api_key}"},
    json={
        "occupation": "Software Engineer",
        "deepening_cycles": 3
    }
)
skill_data = response.json()
```

---

### Get Skills by ID

#### `GET /api/v1/skills/{skill_id}`

Retrieves a specific skill set by its unique identifier.

**Authentication**: Required

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `skill_id` | string | Yes | Unique skill set identifier (UUID) |

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "skill_id": "550e8400-e29b-41d4-a716-446655440000",
    "occupation": "Software Engineer",
    "skills": [...],
    "deepening_cycles": 3,
    "total_skills": 15
  },
  "meta": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-01-11T04:00:00.000Z",
    "version": "v1"
  }
}
```

**Error Responses**:

- `401 Unauthorized`: Missing or invalid authentication
- `404 Not Found`: Skill set with specified ID does not exist
- `500 Internal Server Error`: Retrieval failure

**Example cURL**:
```bash
curl -X GET http://localhost:5001/api/v1/skills/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <api_key>"
```

---

### List Skills

#### `GET /api/v1/skills`

Retrieves a paginated list of all skill sets with optional filtering and sorting.

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-indexed) |
| `per_page` | integer | 20 | Items per page (max: 100) |
| `sort` | string | - | Comma-separated sort fields (prefix `-` for descending) |
| `filter[field]` | string | - | Filter by field value |

**Sorting Examples**:
- `sort=occupation` - Sort by occupation ascending
- `sort=-total_skills` - Sort by skill count descending
- `sort=occupation,-total_skills` - Multi-field sort

**Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "skill_id": "550e8400-e29b-41d4-a716-446655440000",
      "occupation": "Software Engineer",
      "skills": [...],
      "deepening_cycles": 3,
      "total_skills": 15
    },
    {
      "skill_id": "660e8400-e29b-41d4-a716-446655440001",
      "occupation": "Data Scientist",
      "skills": [...],
      "deepening_cycles": 5,
      "total_skills": 20
    }
  ],
  "meta": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-01-11T04:00:00.000Z",
    "version": "v1",
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total": 42,
      "total_pages": 3,
      "has_next": true,
      "has_prev": false
    }
  }
}
```

**Error Responses**:

- `401 Unauthorized`: Missing or invalid authentication
- `500 Internal Server Error`: List retrieval failure

**Example cURL**:
```bash
curl -X GET "http://localhost:5001/api/v1/skills?page=1&per_page=20&sort=-total_skills" \
  -H "Authorization: Bearer <api_key>"
```

---

### Update Skills (Partial)

#### `PATCH /api/v1/skills/{skill_id}`

Partially updates a skill set. Only provided fields are modified.

**Authentication**: Required

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `skill_id` | string | Yes | Unique skill set identifier |

**Request Body** (all fields optional):
```json
{
  "occupation": "Senior Software Engineer",
  "skills": [
    {
      "skill": "updated skill YAML",
      "embedding": [0.1, 0.2, ...]
    }
  ],
  "deepening_cycles": 5
}
```

**Updatable Fields**:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `occupation` | string | min: 1 char | Updated occupation |
| `skills` | array | must be array | Updated skills list |
| `deepening_cycles` | integer | 0-11 | Updated cycle count |

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "skill_id": "550e8400-e29b-41d4-a716-446655440000",
    "occupation": "Senior Software Engineer",
    "skills": [...],
    "deepening_cycles": 5,
    "total_skills": 15,
    "updated_at": "2026-01-11T05:00:00.000Z"
  },
  "meta": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-01-11T05:00:00.000Z",
    "version": "v1"
  }
}
```

**Error Responses**:

- `401 Unauthorized`: Missing or invalid authentication
- `404 Not Found`: Skill set not found
- `422 Unprocessable Entity`: Validation error (invalid field types or values)
- `500 Internal Server Error`: Update failure

**Example cURL**:
```bash
curl -X PATCH http://localhost:5001/api/v1/skills/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "occupation": "Senior Software Engineer",
    "deepening_cycles": 5
  }'
```

---

### Replace Skills (Full Update)

#### `PUT /api/v1/skills/{skill_id}`

Completely replaces a skill set with new data. All fields must be provided.

**Authentication**: Required

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `skill_id` | string | Yes | Unique skill set identifier |

**Request Body**:
```json
{
  "occupation": "Software Engineer",
  "skills": [
    {
      "skill": "complete skill YAML",
      "embedding": [0.1, 0.2, ...]
    }
  ],
  "deepening_cycles": 3
}
```

**Required Fields**:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `occupation` | string | min: 1 char | Occupation name |
| `skills` | array | - | Complete skills array |
| `deepening_cycles` | integer | 0-11, default: 0 | Deepening cycles |

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "skill_id": "550e8400-e29b-41d4-a716-446655440000",
    "occupation": "Software Engineer",
    "skills": [...],
    "deepening_cycles": 3,
    "total_skills": 10,
    "updated_at": "2026-01-11T05:00:00.000Z"
  },
  "meta": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-01-11T05:00:00.000Z",
    "version": "v1"
  }
}
```

**Error Responses**:

- `401 Unauthorized`: Missing or invalid authentication
- `404 Not Found`: Skill set not found (creates new if ID doesn't exist)
- `422 Unprocessable Entity`: Validation error
- `500 Internal Server Error`: Replace failure

---

### Delete Skills

#### `DELETE /api/v1/skills/{skill_id}`

Permanently deletes a skill set.

**Authentication**: Required

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `skill_id` | string | Yes | Unique skill set identifier |

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "deleted": true,
    "skill_id": "550e8400-e29b-41d4-a716-446655440000"
  },
  "meta": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-01-11T05:00:00.000Z",
    "version": "v1"
  }
}
```

**Error Responses**:

- `401 Unauthorized`: Missing or invalid authentication
- `404 Not Found`: Skill set not found
- `500 Internal Server Error`: Deletion failure

**Example cURL**:
```bash
curl -X DELETE http://localhost:5001/api/v1/skills/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <api_key>"
```

---

### List Skill Modes

#### `GET /api/v1/skills/modes`

Retrieves available skill generation modes from the mode registry.

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `per_page` | integer | 20 | Items per page (max: 100) |

**Response**: `200 OK`
```json
{
  "success": true,
  "data": [],
  "meta": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-01-11T05:00:00.000Z",
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

**Note**: Currently returns empty list. Mode registry integration is planned for future release.

**Error Responses**:

- `401 Unauthorized`: Missing or invalid authentication
- `500 Internal Server Error`: Mode retrieval failure

---

### Get Skill Mode by ID

#### `GET /api/v1/skills/modes/{mode_id}`

Retrieves a specific skill mode configuration.

**Authentication**: Required

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `mode_id` | string | Yes | Unique mode identifier |

**Response**: `404 Not Found`
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Mode 'mode-123' not found",
    "category": "NOT_FOUND_ERROR",
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-01-11T05:00:00.000Z"
  }
}
```

**Note**: Mode registry integration is planned. Currently always returns 404.

**Error Responses**:

- `401 Unauthorized`: Missing or invalid authentication
- `404 Not Found`: Mode not found (always, until registry implemented)

---

## Legacy Endpoints

### Create Skills (Legacy)

#### `POST /skills`

**⚠️ DEPRECATED**: Use `POST /api/v1/skills` instead.

Legacy endpoint maintained for backward compatibility. Will be removed in v2.0.

**Authentication**: None (legacy behavior)

**Request Body**:
```json
{
  "occupation": "Software Engineer",
  "deepening_cycles": 3,
  "corpus_text": "Optional text",
  "apiKeys": {
    "OPENAI_API_KEY": "sk-...",
    "ANTHROPIC_API_KEY": "sk-ant-..."
  }
}
```

**Response**: `201 Created`
```json
{
  "skills": [...],
  "meta": {
    "deprecated": true,
    "deprecation_notice": "Use POST /api/v1/skills instead"
  }
}
```

**Migration Guide**:
1. Remove `apiKeys` from request body
2. Add `Authorization: Bearer <api_key>` header
3. Use `/api/v1/skills` endpoint
4. Handle standardized response format

---

## Error Handling

All errors follow the standardized [`APIError`](../../../shared/api_core/models.py) format.

### Error Response Structure

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE.SPECIFIC_ERROR",
    "message": "Human-readable error message",
    "category": "ERROR_CATEGORY",
    "details": [
      {
        "field": "occupation",
        "code": "REQUIRED_FIELD",
        "message": "This field is required"
      }
    ],
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-01-11T05:00:00.000Z",
    "suggestions": [
      "Ensure 'occupation' field is present in request body"
    ]
  }
}
```

### Error Categories

| Category | HTTP Status | Description |
|----------|-------------|-------------|
| `VALIDATION_ERROR` | 422 | Invalid request data |
| `AUTHENTICATION_ERROR` | 401 | Missing or invalid authentication |
| `AUTHORIZATION_ERROR` | 403 | Insufficient permissions |
| `NOT_FOUND_ERROR` | 404 | Resource does not exist |
| `CONFLICT_ERROR` | 409 | Resource already exists |
| `RATE_LIMIT_ERROR` | 429 | Too many requests |
| `SERVICE_ERROR` | 500 | Internal server error |
| `UPSTREAM_ERROR` | 502 | Dependency service failure |

### Common Error Codes

#### Validation Errors (422)

- `REQUIRED_FIELD`: Required field missing
- `INVALID_TYPE`: Field has wrong data type
- `INVALID_RANGE`: Value outside allowed range (e.g., deepening_cycles > 11)
- `INVALID_FORMAT`: Field format incorrect

#### Authentication Errors (401)

- `MISSING_AUTHORIZATION`: No Authorization header
- `INVALID_TOKEN`: Token format invalid
- `EXPIRED_TOKEN`: Token has expired
- `REVOKED_TOKEN`: Token has been revoked

#### Not Found Errors (404)

- `RESOURCE_NOT_FOUND`: Skill set or mode not found

#### Service Errors (500)

- `INTERNAL_ERROR`: Unexpected server error
- `PIPELINE_ERROR`: Skill generation pipeline failure

### Error Handling Best Practices

1. **Check HTTP status code** first
2. **Parse error.code** for programmatic handling
3. **Display error.message** to users
4. **Log error.request_id** for support tickets
5. **Follow error.suggestions** for resolution
6. **Implement retry logic** for 5xx errors with exponential backoff

**Example Error Handling (Python)**:
```python
try:
    response = requests.post(url, headers=headers, json=data)
    response.raise_for_status()
    return response.json()
except requests.exceptions.HTTPError as e:
    error_data = e.response.json()
    error = error_data.get('error', {})
    
    if error.get('category') == 'VALIDATION_ERROR':
        # Handle validation errors
        print(f"Validation failed: {error['message']}")
        for detail in error.get('details', []):
            print(f"  - {detail['field']}: {detail['message']}")
    elif error.get('category') == 'SERVICE_ERROR':
        # Retry with backoff
        print(f"Service error (request_id: {error['request_id']})")
    else:
        # Generic error handling
        print(f"Error: {error['message']}")
```

---

## Data Models

### Skill Object

```yaml
skill_id: string (UUID)
occupation: string
skills: array of SkillItem
deepening_cycles: integer (0-11)
total_skills: integer
created_at: string (ISO 8601) [optional]
updated_at: string (ISO 8601) [optional]
```

### SkillItem Object

```yaml
skill: string (YAML-formatted skill definition)
embedding: array of float (vector representation)
```

**Skill YAML Format**:
```yaml
name: Algorithm Design
description: Design and implement efficient algorithms for complex problems
category: Technical
proficiency: Expert
examples:
  - Dynamic programming solutions
  - Graph algorithms
  - Optimization techniques
```

### PaginationMeta Object

```yaml
page: integer (current page, 1-indexed)
per_page: integer (items per page)
total: integer (total items)
total_pages: integer (total pages)
has_next: boolean (has next page)
has_prev: boolean (has previous page)
```

---

## Rate Limiting

SkillBuilder implements rate limiting via [`shared/api_core/rate_limiting.py`](../../../shared/api_core/rate_limiting.py).

### Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /api/v1/skills` | 10 requests | per minute |
| All other endpoints | 100 requests | per minute |

### Rate Limit Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1641859200
```

### Rate Limit Exceeded Response

**Status**: `429 Too Many Requests`
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_ERROR.QUOTA_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 45 seconds.",
    "category": "RATE_LIMIT_ERROR",
    "retry_after": 45,
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-01-11T05:00:00.000Z"
  }
}
```

### Handling Rate Limits

1. **Check rate limit headers** in responses
2. **Implement exponential backoff** when rate limited
3. **Use `retry_after`** value from error response
4. **Batch requests** when possible
5. **Cache responses** to reduce API calls

---

## Pagination

All list endpoints support pagination using query parameters.

### Pagination Parameters

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page` | integer | 1 | - | Page number (1-indexed) |
| `per_page` | integer | 20 | 100 | Items per page |

### Pagination Response

```json
{
  "data": [...],
  "meta": {
    "pagination": {
      "page": 2,
      "per_page": 20,
      "total": 150,
      "total_pages": 8,
      "has_next": true,
      "has_prev": true
    }
  }
}
```

### Pagination Best Practices

1. **Start with page=1** (1-indexed, not 0-indexed)
2. **Use reasonable per_page** values (20-50 recommended)
3. **Check has_next** before requesting next page
4. **Handle total_pages** for progress indicators
5. **Implement cursor-based pagination** for large datasets (future enhancement)

---

## Filtering and Sorting

### Filtering

Use `filter[field]=value` query parameter syntax:

```bash
# Filter by occupation
GET /api/v1/skills?filter[occupation]=Software Engineer

# Multiple filters (AND logic)
GET /api/v1/skills?filter[occupation]=Engineer&filter[deepening_cycles]=3
```

### Sorting

Use `sort` parameter with comma-separated fields:

```bash
# Sort by occupation ascending
GET /api/v1/skills?sort=occupation

# Sort by total_skills descending
GET /api/v1/skills?sort=-total_skills

# Multi-field sort
GET /api/v1/skills?sort=occupation,-total_skills
```

**Sort Syntax**:
- `field` - Ascending order
- `-field` - Descending order
- `field1,field2` - Multiple fields (priority order)

---

## Code Examples

### Python

```python
import requests
from typing import Dict, List, Optional

class SkillBuilderClient:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    def create_skills(
        self,
        occupation: str,
        deepening_cycles: int = 0,
        corpus_text: Optional[str] = None
    ) -> Dict:
        """Create new skill set."""
        response = requests.post(
            f"{self.base_url}/api/v1/skills",
            headers=self.headers,
            json={
                "occupation": occupation,
                "deepening_cycles": deepening_cycles,
                "corpus_text": corpus_text
            }
        )
        response.raise_for_status()
        return response.json()
    
    def get_skills(self, skill_id: str) -> Dict:
        """Get skill set by ID."""
        response = requests.get(
            f"{self.base_url}/api/v1/skills/{skill_id}",
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()
    
    def list_skills(
        self,
        page: int = 1,
        per_page: int = 20,
        sort: Optional[str] = None
    ) -> Dict:
        """List all skill sets."""
        params = {"page": page, "per_page": per_page}
        if sort:
            params["sort"] = sort
        
        response = requests.get(
            f"{self.base_url}/api/v1/skills",
            headers=self.headers,
            params=params
        )
        response.raise_for_status()
        return response.json()
    
    def update_skills(self, skill_id: str, updates: Dict) -> Dict:
        """Partially update skill set."""
        response = requests.patch(
            f"{self.base_url}/api/v1/skills/{skill_id}",
            headers=self.headers,
            json=updates
        )
        response.raise_for_status()
        return response.json()
    
    def delete_skills(self, skill_id: str) -> Dict:
        """Delete skill set."""
        response = requests.delete(
            f"{self.base_url}/api/v1/skills/{skill_id}",
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()

# Usage
client = SkillBuilderClient("http://localhost:5001", "your-api-key")

# Create skills
result = client.create_skills(
    occupation="Software Engineer",
    deepening_cycles=3
)
skill_id = result["data"]["skill_id"]

# Get skills
skills = client.get_skills(skill_id)

# List all skills
all_skills = client.list_skills(page=1, per_page=20, sort="-total_skills")

# Update skills
updated = client.update_skills(skill_id, {
    "deepening_cycles": 5
})

# Delete skills
client.delete_skills(skill_id)
```

### JavaScript/TypeScript

```typescript
interface SkillCreateRequest {
  occupation: string;
  deepening_cycles?: number;
  corpus_text?: string;
}

interface SkillResponse {
  success: boolean;
  data: {
    skill_id: string;
    occupation: string;
    skills: Array<{
      skill: string;
      embedding: number[];
    }>;
    total_skills: number;
  };
  meta: {
    request_id: string;
    timestamp: string;
    version: string;
  };
}

class SkillBuilderClient {
  constructor(
    private baseUrl: string,
    private apiKey: string
  ) {}

  private get headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  async createSkills(request: SkillCreateRequest): Promise<SkillResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/skills`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return response.json();
  }

  async getSkills(skillId: string): Promise<SkillResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/skills/${skillId}`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return response.json();
  }

  async listSkills(
    page: number = 1,
    perPage: number = 20,
    sort?: string
  ): Promise<SkillResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString()
    });
    if (sort) params.append('sort', sort);

    const response = await fetch(
      `${this.baseUrl}/api/v1/skills?${params}`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return response.json();
  }

  async updateSkills(
    skillId: string,
    updates: Partial<SkillCreateRequest>
  ): Promise<SkillResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/skills/${skillId}`,
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return response.json();
  }

  async deleteSkills(skillId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/skills/${skillId}`,
      {
        method: 'DELETE',
        headers: this.headers
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
  }
}

// Usage
const client = new SkillBuilderClient('http://localhost:5001', 'your-api-key');

// Create skills
const result = await client.createSkills({
  occupation: 'Software Engineer',
  deepening_cycles: 3
});

// Get skills
const skills = await client.getSkills(result.data.skill_id);

// List skills
const allSkills = await client.listSkills(1, 20, '-total_skills');

// Update skills
await client.updateSkills(result.data.skill_id, {
  deepening_cycles: 5
});

// Delete skills
await client.deleteSkills(result.data.skill_id);
```

---

## Related Documentation

- [`AUTHENTICATION.md`](../AUTHENTICATION.md) - Authentication and authorization guide
- [`API_REFERENCE_INDEX.md`](../API_REFERENCE_INDEX.md) - Complete API documentation index
- [`AGENTBUILDER_API_SPEC.md`](AGENTBUILDER_COMPLETE_SPEC.md) - AgentBuilder API specification
- [`KNOWLEDGEBUILDER_API_SPEC.md`](KNOWLEDGEBUILDER_API_SPEC.md) - KnowledgeBuilder API specification
- [`shared/api_core/`](../../../shared/api_core/) - Shared API core implementation
- [`projects/SkillBuilder/`](../../../projects/SkillBuilder/) - SkillBuilder service implementation

---

## Changelog

### Version 1.0.0 (2026-01-11)

**Added**:
- Complete REST API with 10 endpoints
- Bearer token authentication
- Pagination, filtering, and sorting support
- Comprehensive error handling
- Rate limiting
- Skill embeddings for semantic search
- Mode registry endpoints (placeholder)
- Legacy endpoint for backward compatibility

**Documentation**:
- Complete endpoint documentation with examples
- Error handling guide
- Code examples in Python and TypeScript
- Data model specifications
- Rate limiting documentation

---

## Support

For issues, questions, or feature requests:

1. **Documentation**: Check this specification and related docs
2. **GitHub Issues**: Report bugs or request features
3. **API Support**: Include `request_id` from error responses
4. **Community**: Join discussions on GitHub Discussions

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-01-11  
**Maintained By**: Chrysalis Documentation Team  
**Next Review**: 2026-02-11

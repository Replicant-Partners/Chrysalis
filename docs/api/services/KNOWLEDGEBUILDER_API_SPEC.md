# KnowledgeBuilder API Specification

**Version**: 1.0.0  
**Base URL**: `http://localhost:5002`  
**API Version**: v1  
**Date**: 2026-01-11

---

## Overview

The KnowledgeBuilder service collects and structures knowledge about entities using multi-source search and fact extraction. It provides RESTful endpoints for creating, managing, and searching knowledge clouds with support for deepening cycles to enhance knowledge quality.

### Key Features

- **Entity-based knowledge generation**: Generate knowledge from entity identifiers
- **Multi-source search**: Aggregate information from multiple sources
- **Deepening cycles**: Iterative knowledge refinement (0-11 cycles)
- **Semantic search**: Query knowledge using natural language
- **Entity lookup**: Retrieve knowledge by entity identifier
- **Full CRUD operations**: Create, read, update, and delete knowledge entries

### Architecture

KnowledgeBuilder uses the unified API standard with:
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
    "service": "knowledgebuilder"
  },
  "meta": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-01-11T04:00:00.000Z",
    "version": "v1"
  }
}
```

---

### Create Knowledge

#### `POST /api/v1/knowledge`

Generates knowledge cloud for a specified entity with optional deepening cycles.

**Authentication**: Required

**Request Body**:
```json
{
  "identifier": "Bob Ross",
  "entity_type": "Person",
  "deepening_cycles": 3
}
```

**Request Schema**:

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `identifier` | string | Yes | min: 1 char | Entity identifier (name, ID, etc.) |
| `entity_type` | string | No | - | Type of entity (Person, Organization, etc.) |
| `deepening_cycles` | integer | No | ≥0, default: 0 | Number of iterative refinement cycles |

**Process Flow**:
1. Validates request parameters
2. Runs knowledge pipeline via [`run_knowledge_pipeline()`](../../../projects/KnowledgeBuilder/src/pipeline/simple_pipeline.py)
3. Collects facts from multiple sources
4. Applies deepening cycles for refinement
5. Stores knowledge with generated ID
6. Returns complete knowledge cloud

**Response**: `201 Created`
```json
{
  "success": true,
  "data": {
    "knowledge_id": "person:bob_ross",
    "identifier": "Bob Ross",
    "entity_type": "Person",
    "knowledge_items": [
      {
        "text": "Bob Ross was an American painter, art instructor, and television host.",
        "source": "Wikipedia",
        "confidence": 0.95,
        "timestamp": "2026-01-11T04:00:00.000Z"
      },
      {
        "text": "He was the creator and host of The Joy of Painting.",
        "source": "Biography.com",
        "confidence": 0.92,
        "timestamp": "2026-01-11T04:00:00.000Z"
      }
    ]
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
- `422 Unprocessable Entity`: Validation error (missing identifier, invalid deepening_cycles)
- `500 Internal Server Error`: Knowledge pipeline failure

**Example cURL**:
```bash
curl -X POST http://localhost:5002/api/v1/knowledge \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "Bob Ross",
    "entity_type": "Person",
    "deepening_cycles": 3
  }'
```

**Example Python**:
```python
import requests

response = requests.post(
    "http://localhost:5002/api/v1/knowledge",
    headers={"Authorization": f"Bearer {api_key}"},
    json={
        "identifier": "Bob Ross",
        "entity_type": "Person",
        "deepening_cycles": 3
    }
)
knowledge_data = response.json()
```

---

### Get Knowledge by ID

#### `GET /api/v1/knowledge/{knowledge_id}`

Retrieves a specific knowledge entry by its unique identifier.

**Authentication**: Required

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `knowledge_id` | string | Yes | Unique knowledge identifier |

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "knowledge_id": "person:bob_ross",
    "identifier": "Bob Ross",
    "entity_type": "Person",
    "knowledge_items": [...],
    "deepening_cycles": 3
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
- `404 Not Found`: Knowledge entry with specified ID does not exist
- `500 Internal Server Error`: Retrieval failure

**Example cURL**:
```bash
curl -X GET http://localhost:5002/api/v1/knowledge/person:bob_ross \
  -H "Authorization: Bearer <api_key>"
```

---

### List Knowledge

#### `GET /api/v1/knowledge`

Retrieves a paginated list of all knowledge entries with optional filtering and sorting.

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-indexed) |
| `per_page` | integer | 20 | Items per page (max: 100) |
| `sort` | string | - | Comma-separated sort fields (prefix `-` for descending) |
| `filter[field]` | string | - | Filter by field value |

**Sorting Examples**:
- `sort=identifier` - Sort by identifier ascending
- `sort=-deepening_cycles` - Sort by cycles descending
- `sort=entity_type,-identifier` - Multi-field sort

**Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "knowledge_id": "person:bob_ross",
      "identifier": "Bob Ross",
      "entity_type": "Person",
      "knowledge_items": [...],
      "deepening_cycles": 3
    },
    {
      "knowledge_id": "organization:nasa",
      "identifier": "NASA",
      "entity_type": "Organization",
      "knowledge_items": [...],
      "deepening_cycles": 5
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
curl -X GET "http://localhost:5002/api/v1/knowledge?page=1&per_page=20&sort=-deepening_cycles" \
  -H "Authorization: Bearer <api_key>"
```

---

### Search Knowledge

#### `POST /api/v1/knowledge/search`

Advanced semantic search for knowledge entries using natural language queries.

**Authentication**: Required

**Request Body**:
```json
{
  "query": "American painters from the 20th century",
  "entity_type": "Person",
  "limit": 10
}
```

**Request Schema**:

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `query` | string | Yes | min: 1 char | Natural language search query |
| `entity_type` | string | No | - | Filter by entity type |
| `limit` | integer | No | default: 10 | Maximum results to return |

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "query": "American painters from the 20th century",
    "results": [
      {
        "knowledge_id": "person:bob_ross",
        "identifier": "Bob Ross",
        "entity_type": "Person",
        "relevance_score": 0.94,
        "knowledge_items": [...]
      },
      {
        "knowledge_id": "person:andy_warhol",
        "identifier": "Andy Warhol",
        "entity_type": "Person",
        "relevance_score": 0.89,
        "knowledge_items": [...]
      }
    ]
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
- `422 Unprocessable Entity`: Validation error (missing query)
- `500 Internal Server Error`: Search failure

**Example cURL**:
```bash
curl -X POST http://localhost:5002/api/v1/knowledge/search \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "American painters from the 20th century",
    "entity_type": "Person",
    "limit": 10
  }'
```

---

### Get Knowledge by Entity

#### `GET /api/v1/knowledge/entities/{entity_id}`

Retrieves knowledge entries for a specific entity identifier.

**Authentication**: Required

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `entity_id` | string | Yes | Entity identifier (case-insensitive) |

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "knowledge_id": "person:bob_ross",
    "identifier": "Bob Ross",
    "entity_type": "Person",
    "knowledge_items": [...],
    "deepening_cycles": 3
  },
  "meta": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-01-11T04:00:00.000Z",
    "version": "v1"
  }
}
```

**Note**: If multiple knowledge entries exist for the same entity, returns an array.

**Error Responses**:

- `401 Unauthorized`: Missing or invalid authentication
- `404 Not Found`: No knowledge found for entity
- `500 Internal Server Error`: Retrieval failure

**Example cURL**:
```bash
curl -X GET http://localhost:5002/api/v1/knowledge/entities/bob_ross \
  -H "Authorization: Bearer <api_key>"
```

---

### Update Knowledge (Partial)

#### `PATCH /api/v1/knowledge/{knowledge_id}`

Partially updates a knowledge entry. Only provided fields are modified.

**Authentication**: Required

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `knowledge_id` | string | Yes | Unique knowledge identifier |

**Request Body** (all fields optional):
```json
{
  "identifier": "Robert Norman Ross",
  "entity_type": "Person",
  "knowledge_items": [
    {
      "text": "Updated knowledge item",
      "source": "New Source",
      "confidence": 0.98
    }
  ],
  "deepening_cycles": 5
}
```

**Updatable Fields**:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `identifier` | string | min: 1 char | Updated identifier |
| `entity_type` | string | - | Updated entity type |
| `knowledge_items` | array | must be array | Updated knowledge items |
| `deepening_cycles` | integer | ≥0 | Updated cycle count |

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "knowledge_id": "person:bob_ross",
    "identifier": "Robert Norman Ross",
    "entity_type": "Person",
    "knowledge_items": [...],
    "deepening_cycles": 5,
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
- `404 Not Found`: Knowledge entry not found
- `422 Unprocessable Entity`: Validation error (invalid field types or values)
- `500 Internal Server Error`: Update failure

**Example cURL**:
```bash
curl -X PATCH http://localhost:5002/api/v1/knowledge/person:bob_ross \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "Robert Norman Ross",
    "deepening_cycles": 5
  }'
```

---

### Replace Knowledge (Full Update)

#### `PUT /api/v1/knowledge/{knowledge_id}`

Completely replaces a knowledge entry with new data. All fields must be provided.

**Authentication**: Required

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `knowledge_id` | string | Yes | Unique knowledge identifier |

**Request Body**:
```json
{
  "identifier": "Bob Ross",
  "entity_type": "Person",
  "knowledge_items": [
    {
      "text": "Complete knowledge item",
      "source": "Source",
      "confidence": 0.95
    }
  ],
  "deepening_cycles": 3
}
```

**Required Fields**:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `identifier` | string | min: 1 char | Entity identifier |
| `entity_type` | string | - | Entity type |
| `knowledge_items` | array | - | Complete knowledge items array |
| `deepening_cycles` | integer | ≥0, default: 0 | Deepening cycles |

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "knowledge_id": "person:bob_ross",
    "identifier": "Bob Ross",
    "entity_type": "Person",
    "knowledge_items": [...],
    "deepening_cycles": 3,
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
- `404 Not Found`: Knowledge entry not found (creates new if ID doesn't exist)
- `422 Unprocessable Entity`: Validation error
- `500 Internal Server Error`: Replace failure

---

### Delete Knowledge

#### `DELETE /api/v1/knowledge/{knowledge_id}`

Permanently deletes a knowledge entry.

**Authentication**: Required

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `knowledge_id` | string | Yes | Unique knowledge identifier |

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "deleted": true,
    "knowledge_id": "person:bob_ross"
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
- `404 Not Found`: Knowledge entry not found
- `500 Internal Server Error`: Deletion failure

**Example cURL**:
```bash
curl -X DELETE http://localhost:5002/api/v1/knowledge/person:bob_ross \
  -H "Authorization: Bearer <api_key>"
```

---

## Legacy Endpoints

### Create Knowledge (Legacy)

#### `POST /knowledge`

**⚠️ DEPRECATED**: Use `POST /api/v1/knowledge` instead.

Legacy endpoint maintained for backward compatibility. Will be removed in v2.0.

**Authentication**: None (legacy behavior)

**Request Body**:
```json
{
  "identifier": "Bob Ross",
  "entity_type": "Person",
  "deepening_cycles": 3,
  "apiKeys": {
    "OPENAI_API_KEY": "sk-...",
    "ANTHROPIC_API_KEY": "sk-ant-..."
  }
}
```

**Response**: `201 Created`
```json
{
  "knowledge_items": [...],
  "meta": {
    "deprecated": true,
    "deprecation_notice": "Use POST /api/v1/knowledge instead"
  }
}
```

**Migration Guide**:
1. Remove `apiKeys` from request body
2. Add `Authorization: Bearer <api_key>` header
3. Use `/api/v1/knowledge` endpoint
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
        "field": "identifier",
        "code": "REQUIRED_FIELD",
        "message": "This field is required"
      }
    ],
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-01-11T05:00:00.000Z",
    "suggestions": [
      "Ensure 'identifier' field is present in request body"
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
- `INVALID_RANGE`: Value outside allowed range
- `INVALID_FORMAT`: Field format incorrect

#### Authentication Errors (401)

- `MISSING_AUTHORIZATION`: No Authorization header
- `INVALID_TOKEN`: Token format invalid
- `EXPIRED_TOKEN`: Token has expired
- `REVOKED_TOKEN`: Token has been revoked

#### Not Found Errors (404)

- `RESOURCE_NOT_FOUND`: Knowledge entry not found

#### Service Errors (500)

- `INTERNAL_ERROR`: Unexpected server error
- `PIPELINE_ERROR`: Knowledge pipeline failure

---

## Data Models

### Knowledge Object

```yaml
knowledge_id: string (generated from entity_type:identifier)
identifier: string
entity_type: string
knowledge_items: array of KnowledgeItem
deepening_cycles: integer (≥0)
created_at: string (ISO 8601) [optional]
updated_at: string (ISO 8601) [optional]
```

### KnowledgeItem Object

```yaml
text: string (fact or information)
source: string (source URL or name)
confidence: float (0.0 to 1.0)
timestamp: string (ISO 8601)
metadata: object [optional]
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

KnowledgeBuilder implements rate limiting via [`shared/api_core/rate_limiting.py`](../../../shared/api_core/rate_limiting.py).

### Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /api/v1/knowledge` | 10 requests | per minute |
| `POST /api/v1/knowledge/search` | 30 requests | per minute |
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

---

## Code Examples

### Python

```python
import requests
from typing import Dict, List, Optional

class KnowledgeBuilderClient:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    def create_knowledge(
        self,
        identifier: str,
        entity_type: Optional[str] = None,
        deepening_cycles: int = 0
    ) -> Dict:
        """Create new knowledge entry."""
        response = requests.post(
            f"{self.base_url}/api/v1/knowledge",
            headers=self.headers,
            json={
                "identifier": identifier,
                "entity_type": entity_type,
                "deepening_cycles": deepening_cycles
            }
        )
        response.raise_for_status()
        return response.json()
    
    def get_knowledge(self, knowledge_id: str) -> Dict:
        """Get knowledge entry by ID."""
        response = requests.get(
            f"{self.base_url}/api/v1/knowledge/{knowledge_id}",
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()
    
    def search_knowledge(
        self,
        query: str,
        entity_type: Optional[str] = None,
        limit: int = 10
    ) -> Dict:
        """Search knowledge entries."""
        response = requests.post(
            f"{self.base_url}/api/v1/knowledge/search",
            headers=self.headers,
            json={
                "query": query,
                "entity_type": entity_type,
                "limit": limit
            }
        )
        response.raise_for_status()
        return response.json()
    
    def get_by_entity(self, entity_id: str) -> Dict:
        """Get knowledge by entity identifier."""
        response = requests.get(
            f"{self.base_url}/api/v1/knowledge/entities/{entity_id}",
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()
    
    def list_knowledge(
        self,
        page: int = 1,
        per_page: int = 20,
        sort: Optional[str] = None
    ) -> Dict:
        """List all knowledge entries."""
        params = {"page": page, "per_page": per_page}
        if sort:
            params["sort"] = sort
        
        response = requests.get(
            f"{self.base_url}/api/v1/knowledge",
            headers=self.headers,
            params=params
        )
        response.raise_for_status()
        return response.json()
    
    def update_knowledge(self, knowledge_id: str, updates: Dict) -> Dict:
        """Partially update knowledge entry."""
        response = requests.patch(
            f"{self.base_url}/api/v1/knowledge/{knowledge_id}",
            headers=self.headers,
            json=updates
        )
        response.raise_for_status()
        return response.json()
    
    def delete_knowledge(self, knowledge_id: str) -> Dict:
        """Delete knowledge entry."""
        response = requests.delete(
            f"{self.base_url}/api/v1/knowledge/{knowledge_id}",
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()

# Usage
client = KnowledgeBuilderClient("http://localhost:5002", "your-api-key")

# Create knowledge
result = client.create_knowledge(
    identifier="Bob Ross",
    entity_type="Person",
    deepening_cycles=3
)
knowledge_id = result["data"]["knowledge_id"]

# Search knowledge
search_results = client.search_knowledge(
    query="American painters",
    entity_type="Person",
    limit=10
)

# Get by entity
entity_knowledge = client.get_by_entity("bob_ross")

# List all knowledge
all_knowledge = client.list_knowledge(page=1, per_page=20)

# Update knowledge
updated = client.update_knowledge(knowledge_id, {
    "deepening_cycles": 5
})

# Delete knowledge
client.delete_knowledge(knowledge_id)
```

### JavaScript/TypeScript

```typescript
interface KnowledgeCreateRequest {
  identifier: string;
  entity_type?: string;
  deepening_cycles?: number;
}

interface KnowledgeSearchRequest {
  query: string;
  entity_type?: string;
  limit?: number;
}

interface KnowledgeResponse {
  success: boolean;
  data: {
    knowledge_id: string;
    identifier: string;
    entity_type: string;
    knowledge_items: Array<{
      text: string;
      source: string;
      confidence: number;
      timestamp: string;
    }>;
    deepening_cycles: number;
  };
  meta: {
    request_id: string;
    timestamp: string;
    version: string;
  };
}

class KnowledgeBuilderClient {
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

  async createKnowledge(request: KnowledgeCreateRequest): Promise<KnowledgeResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/knowledge`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return response.json();
  }

  async getKnowledge(knowledgeId: string): Promise<KnowledgeResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/knowledge/${knowledgeId}`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return response.json();
  }

  async searchKnowledge(request: KnowledgeSearchRequest): Promise<KnowledgeResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/knowledge/search`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return response.json();
  }

  async getByEntity(entityId: string): Promise<KnowledgeResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/knowledge/entities/${entityId}`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return response.json();
  }

  async listKnowledge(
    page: number = 1,
    perPage: number = 20,
    sort?: string
  ): Promise<KnowledgeResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString()
    });
    if (sort) params.append('sort', sort);

    const response = await fetch(
      `${this.baseUrl}/api/v1/knowledge?${params}`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return response.json();
  }

  async updateKnowledge(
    knowledgeId: string,
    updates: Partial<KnowledgeCreateRequest>
  ): Promise<KnowledgeResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/knowledge/${knowledgeId}`,
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return response.json();
  }

  async deleteKnowledge(knowledgeId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/knowledge/${knowledgeId}`,
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
const client = new KnowledgeBuilderClient('http://localhost:5002', 'your-api-key');

// Create knowledge
const result = await client.createKnowledge({
  identifier: 'Bob Ross',
  entity_type: 'Person',
  deepening_cycles: 3
});

// Search knowledge
const searchResults = await client.searchKnowledge({
  query: 'American painters',
  entity_type: 'Person',
  limit: 10
});

// Get by entity
const entityKnowledge = await client.getByEntity('bob_ross');

// List knowledge
const allKnowledge = await client.listKnowledge(1, 20, '-deepening_cycles');

// Update knowledge
await client.updateKnowledge(result.data.knowledge_id, {
  deepening_cycles: 5
});

// Delete knowledge
await client.deleteKnowledge(result.data.knowledge_id);
```

---

## Related Documentation

- [`AUTHENTICATION.md`](../AUTHENTICATION.md) - Authentication and authorization guide
- [`API_REFERENCE_INDEX.md`](../API_REFERENCE_INDEX.md) - Complete API documentation index
- [`AGENTBUILDER_API_SPEC.md`](AGENTBUILDER_COMPLETE_SPEC.md) - AgentBuilder API specification
- [`SKILLBUILDER_API_SPEC.md`](SKILLBUILDER_API_SPEC.md) - SkillBuilder API specification
- [`shared/api_core/`](../../../shared/api_core/) - Shared API core implementation
- [`projects/KnowledgeBuilder/`](../../../projects/KnowledgeBuilder/) - KnowledgeBuilder service implementation

---

## Changelog

### Version 1.0.0 (2026-01-11)

**Added**:
- Complete REST API with 10 endpoints
- Bearer token authentication
- Semantic search capability
- Entity-based knowledge lookup
- Pagination, filtering, and sorting support
- Comprehensive error handling
- Rate limiting
- Legacy endpoint for backward compatibility

**Documentation**:
- Complete endpoint documentation with examples
- Error handling guide
- Code examples in Python and TypeScript
- Data model specifications
- Rate limiting documentation
- Search functionality documentation

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

# API Endpoint Documentation Template

**Version**: 1.0.0  
**Date**: 2026-01-11  
**Purpose**: Standardized template for documenting Chrysalis REST API endpoints

---

## Template Usage

This template follows OpenAPI 3.0 specification principles and should be used for documenting all REST API endpoints. Copy the relevant sections and fill in the details based on the actual implementation.

---

## Endpoint Template

### [HTTP METHOD] [Endpoint Path]

**Service**: [AgentBuilder | KnowledgeBuilder | SkillBuilder]  
**Version**: v1  
**Authentication**: Required  
**Rate Limit**: [Specify if different from default]

#### Summary

[One-line description of what this endpoint does]

#### Description

[Detailed description of the endpoint's purpose, behavior, and use cases. Include:
- What the endpoint does
- When to use it
- Any important constraints or limitations
- Relationship to other endpoints]

---

### Request

#### HTTP Method and Path

```
[METHOD] /api/v1/[resource]/[path]
```

#### Path Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `param_name` | string | Yes | Description of parameter | `example-value` |

#### Query Parameters

| Parameter | Type | Required | Default | Description | Example |
|-----------|------|----------|---------|-------------|---------|
| `page` | integer | No | 1 | Page number for pagination | `1` |
| `per_page` | integer | No | 20 | Items per page (max 100) | `20` |
| `sort` | string | No | - | Sort field | `created_at` |
| `order` | string | No | `asc` | Sort order (`asc` or `desc`) | `desc` |

#### Request Headers

| Header | Required | Description | Example |
|--------|----------|-------------|---------|
| `Authorization` | Yes | Bearer token or API key | `Bearer <token>` |
| `Content-Type` | Yes | Must be `application/json` | `application/json` |

#### Request Body

**Content-Type**: `application/json`

**Schema**:

```json
{
  "field_name": "string",
  "required_field": "string",
  "optional_field": "string",
  "nested_object": {
    "sub_field": "string"
  },
  "array_field": ["string"]
}
```

**Field Descriptions**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `field_name` | string | Yes | min: 1, max: 255 | Description of field |
| `required_field` | string | Yes | - | Description |
| `optional_field` | string | No | - | Description |
| `nested_object` | object | No | - | Description |
| `nested_object.sub_field` | string | No | - | Description |
| `array_field` | array[string] | No | - | Description |

**Example Request**:

```bash
curl -X [METHOD] \
  'https://api.chrysalis.example.com/api/v1/[resource]' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "field_name": "example value",
    "required_field": "required value"
  }'
```

---

### Response

#### Success Response

**Status Code**: `[200 | 201 | 204]`

**Response Body**:

```json
{
  "success": true,
  "data": {
    "id": "string",
    "field": "value"
  },
  "meta": {
    "timestamp": "2026-01-11T00:00:00Z",
    "version": "v1"
  },
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 100,
    "total_pages": 5
  }
}
```

**Field Descriptions**:

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `true` for successful responses |
| `data` | object/array | Response payload |
| `meta` | object | Response metadata |
| `meta.timestamp` | string | ISO 8601 timestamp |
| `meta.version` | string | API version |
| `pagination` | object | Pagination metadata (list endpoints only) |

**Example Response**:

```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "name": "Example Resource",
    "created_at": "2026-01-11T00:00:00Z"
  },
  "meta": {
    "timestamp": "2026-01-11T00:00:00Z",
    "version": "v1"
  }
}
```

---

### Error Responses

#### 400 Bad Request

**Cause**: Invalid request format or missing required fields

**Response Body**:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid request format",
    "category": "VALIDATION_ERROR",
    "details": {
      "field": "field_name",
      "issue": "Field is required"
    }
  },
  "meta": {
    "timestamp": "2026-01-11T00:00:00Z",
    "version": "v1"
  }
}
```

#### 401 Unauthorized

**Cause**: Missing or invalid authentication credentials

**Response Body**:

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required",
    "category": "AUTH_ERROR"
  }
}
```

#### 404 Not Found

**Cause**: Resource does not exist

**Response Body**:

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Resource 'resource_id' not found",
    "category": "NOT_FOUND_ERROR"
  }
}
```

#### 422 Unprocessable Entity

**Cause**: Validation failed on request data

**Response Body**:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "category": "VALIDATION_ERROR",
    "details": {
      "field": "field_name",
      "constraint": "min_length",
      "value": 1
    }
  }
}
```

#### 429 Too Many Requests

**Cause**: Rate limit exceeded

**Response Body**:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded",
    "category": "RATE_LIMIT_ERROR"
  }
}
```

**Response Headers**:

| Header | Description | Example |
|--------|-------------|---------|
| `X-RateLimit-Limit` | Maximum requests allowed | `60` |
| `X-RateLimit-Remaining` | Requests remaining | `0` |
| `X-RateLimit-Reset` | Unix timestamp when limit resets | `1704931200` |
| `Retry-After` | Seconds until retry allowed | `60` |

#### 500 Internal Server Error

**Cause**: Server-side error

**Response Body**:

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Internal server error",
    "category": "SERVICE_ERROR"
  }
}
```

#### 502 Bad Gateway

**Cause**: Upstream service failure (AgentBuilder only)

**Response Body**:

```json
{
  "success": false,
  "error": {
    "code": "UPSTREAM_ERROR",
    "message": "Failed to connect to builder service",
    "category": "UPSTREAM_ERROR"
  }
}
```

---

### Error Code Reference

| Code | Category | HTTP Status | Description |
|------|----------|-------------|-------------|
| `REQUIRED_FIELD` | VALIDATION_ERROR | 400 | Required field missing |
| `INVALID_TYPE` | VALIDATION_ERROR | 422 | Field has wrong type |
| `INVALID_RANGE` | VALIDATION_ERROR | 422 | Value outside allowed range |
| `INVALID_FORMAT` | VALIDATION_ERROR | 422 | Invalid format (e.g., email, URL) |
| `UNAUTHORIZED` | AUTH_ERROR | 401 | Authentication required |
| `FORBIDDEN` | AUTH_ERROR | 403 | Insufficient permissions |
| `RESOURCE_NOT_FOUND` | NOT_FOUND_ERROR | 404 | Resource doesn't exist |
| `DUPLICATE_RESOURCE` | CONFLICT_ERROR | 409 | Resource already exists |
| `RATE_LIMIT_EXCEEDED` | RATE_LIMIT_ERROR | 429 | Too many requests |
| `INTERNAL_ERROR` | SERVICE_ERROR | 500 | Server error |
| `UPSTREAM_ERROR` | UPSTREAM_ERROR | 502 | Upstream service failed |

---

### Usage Examples

#### JavaScript (fetch)

```javascript
const response = await fetch('https://api.chrysalis.example.com/api/v1/[resource]', {
  method: '[METHOD]',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    field_name: 'example value',
    required_field: 'required value'
  })
});

const data = await response.json();

if (data.success) {
  console.log('Success:', data.data);
} else {
  console.error('Error:', data.error);
}
```

#### Python (requests)

```python
import requests

url = 'https://api.chrysalis.example.com/api/v1/[resource]'
headers = {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
}
payload = {
    'field_name': 'example value',
    'required_field': 'required value'
}

response = requests.[method](url, headers=headers, json=payload)
data = response.json()

if data['success']:
    print('Success:', data['data'])
else:
    print('Error:', data['error'])
```

#### cURL

```bash
curl -X [METHOD] \
  'https://api.chrysalis.example.com/api/v1/[resource]' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: 'application/json' \
  -d '{
    "field_name": "example value",
    "required_field": "required value"
  }'
```

---

### Related Endpoints

- `[METHOD] /api/v1/[related-resource]` - [Description]
- `[METHOD] /api/v1/[another-resource]` - [Description]

---

### Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-11 | Initial endpoint documentation |

---

### Notes

- [Any additional notes, caveats, or important information]
- [Performance considerations]
- [Common pitfalls]
- [Best practices]

---

## Quick Reference Checklist

When documenting an endpoint, ensure you include:

- [ ] HTTP method and full path
- [ ] Service name and version
- [ ] Authentication requirements
- [ ] Summary and detailed description
- [ ] All path parameters with types and examples
- [ ] All query parameters with defaults
- [ ] Request headers
- [ ] Request body schema with field descriptions
- [ ] Success response with example
- [ ] All possible error responses (400, 401, 404, 422, 429, 500, 502)
- [ ] Error code reference
- [ ] Usage examples in 3 languages (JavaScript, Python, cURL)
- [ ] Related endpoints
- [ ] Changelog entry
- [ ] Additional notes if applicable

---

## Template Sections Explained

### Summary vs Description

- **Summary**: One sentence, action-oriented (e.g., "Create a new agent")
- **Description**: 2-4 paragraphs explaining purpose, use cases, constraints

### Field Descriptions

Always include:
- **Type**: Exact JSON type (string, number, boolean, object, array)
- **Required**: Yes/No
- **Validation**: Constraints (min/max length, range, format, pattern)
- **Description**: What the field represents and how it's used

### Example Quality

Examples should be:
- **Realistic**: Use plausible values, not "foo" or "bar"
- **Complete**: Include all required fields
- **Consistent**: Use same example data across request/response
- **Tested**: Verify examples actually work

### Error Documentation

Document errors that:
- **Can occur**: Based on actual implementation
- **Are actionable**: User can fix the issue
- **Are specific**: Include exact error codes and messages

---

## OpenAPI 3.0 Mapping

This template maps to OpenAPI 3.0 as follows:

| Template Section | OpenAPI 3.0 Component |
|------------------|----------------------|
| Summary | `summary` |
| Description | `description` |
| Path Parameters | `parameters` (in: path) |
| Query Parameters | `parameters` (in: query) |
| Request Headers | `parameters` (in: header) |
| Request Body | `requestBody.content` |
| Success Response | `responses.200.content` |
| Error Responses | `responses.4xx/5xx.content` |
| Examples | `examples` |

---

**Template Version**: 1.0.0  
**Last Updated**: 2026-01-11  
**Maintainer**: Chrysalis Documentation Team

# Chrysalis Shared API Core Documentation

**Version:** 1.0.0  
**Last Updated:** 2026-01-11  
**Status:** Production Ready

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Request/Response Models](#requestresponse-models)
5. [Authentication & Authorization](#authentication--authorization)
6. [Validation](#validation)
7. [Result Type Pattern](#result-type-pattern)
8. [Middleware Stack](#middleware-stack)
9. [Rate Limiting](#rate-limiting)
10. [Monitoring & Observability](#monitoring--observability)
11. [Security](#security)
12. [List Endpoint Helpers](#list-endpoint-helpers)
13. [OpenAPI & Swagger](#openapi--swagger)
14. [Testing Utilities](#testing-utilities)
15. [Best Practices](#best-practices)
16. [Migration Guide](#migration-guide)

---

## Overview

The Chrysalis Shared API Core (`shared/api_core`) is a unified framework providing consistent patterns, error handling, authentication, and utilities for all Chrysalis backend services. It eliminates code duplication and ensures API consistency across AgentBuilder, KnowledgeBuilder, and SkillBuilder services.

### Key Features

- **Unified Error Taxonomy**: 8 standardized error categories with machine-readable codes
- **Result Type Pattern**: Monadic error handling for type-safe operations
- **Authentication Framework**: JWT and API key support with role-based access control
- **Rate Limiting**: Token bucket algorithm with per-IP and per-endpoint limits
- **Middleware Stack**: Request ID tracking, CORS, security headers, error handling
- **Monitoring**: Health checks, metrics collection, observability
- **Validation**: Both exception-based and Result-returning validators
- **List Helpers**: Pagination, filtering, sorting for list endpoints
- **OpenAPI Support**: Automatic spec generation and Swagger UI integration

### Design Principles

1. **Framework Agnostic Core**: Domain models independent of Flask
2. **Optional Dependencies**: Graceful degradation when Flask/Pydantic unavailable
3. **Type Safety**: Full type hints for IDE support and static analysis
4. **Composability**: Small, focused modules that work together
5. **Production Ready**: Battle-tested patterns with comprehensive error handling

---

## Architecture

### Module Structure

```
shared/api_core/
├── __init__.py              # Public API exports
├── models.py                # Core data models (APIResponse, APIError, etc.)
├── result.py                # Result type pattern (Success/Failure)
├── auth.py                  # Authentication & authorization
├── validation.py            # Request validation utilities
├── middleware.py            # Flask middleware (CORS, error handling, etc.)
├── rate_limiting.py         # Rate limiting middleware
├── monitoring.py            # Health checks & metrics
├── security_headers.py      # Security headers middleware
├── error_tracking.py        # Error tracking integration
├── audit_logging.py         # Audit logging for security events
├── filtering.py             # Filter & sort operations
├── list_helpers.py          # List endpoint helpers
├── utils.py                 # Flask utility functions
├── schemas.py               # Pydantic request schemas
├── openapi.py               # OpenAPI spec generation
├── swagger.py               # Swagger UI setup
├── test_utils.py            # Testing utilities
└── tests/                   # Unit tests
```

### Dependency Layers

```
┌─────────────────────────────────────┐
│   Flask Application Layer           │
│   (AgentBuilder, KnowledgeBuilder)  │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Middleware Layer                  │
│   (auth, rate limit, CORS, etc.)    │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Utilities Layer                   │
│   (validation, list helpers, etc.)  │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Core Models Layer                 │
│   (APIResponse, APIError, Result)   │
└─────────────────────────────────────┘
```

---

## Core Components

### 1. models.py - Core Data Models

Provides the foundational data structures for all API responses and errors.

#### APIResponse

Standard wrapper for all API responses.

```python
from shared.api_core import APIResponse, PaginationMeta

# Success response
response = APIResponse.success_response(
    data={'id': '123', 'name': 'Test'},
    pagination=None,
    request_id='req_abc123'
)

# Error response
error = APIError(
    code=ErrorCode.RESOURCE_NOT_FOUND,
    message="Agent not found",
    category=ErrorCategory.NOT_FOUND_ERROR
)
response, status = APIResponse.error_response(error, status_code=404)
```

**Response Structure:**

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2026-01-11T12:00:00Z",
    "version": "v1",
    "pagination": { ... }
  }
}
```

#### APIError

Structured error representation with taxonomy.

```python
from shared.api_core import APIError, ErrorCode, ErrorCategory, ErrorDetail

error = APIError(
    code=ErrorCode.REQUIRED_FIELD,
    message="Field 'name' is required",
    category=ErrorCategory.VALIDATION_ERROR,
    details=[
        ErrorDetail(
            field='name',
            code='VALIDATION_ERROR.REQUIRED_FIELD',
            message="Field 'name' is required"
        )
    ],
    request_id='req_abc123',
    documentation_url='https://docs.chrysalis.dev/errors/required-field',
    suggestions=[
        "Provide a 'name' field in the request body",
        "Check the API documentation for required fields"
    ]
)
```

**Error Categories:**

| Category | HTTP Status | Use Case |
|----------|-------------|----------|
| `VALIDATION_ERROR` | 422 | Invalid input data |
| `AUTHENTICATION_ERROR` | 401 | Missing/invalid credentials |
| `AUTHORIZATION_ERROR` | 403 | Insufficient permissions |
| `NOT_FOUND_ERROR` | 404 | Resource doesn't exist |
| `CONFLICT_ERROR` | 409 | Resource already exists |
| `RATE_LIMIT_ERROR` | 429 | Too many requests |
| `SERVICE_ERROR` | 500 | Internal server error |
| `UPSTREAM_ERROR` | 502 | External service failure |

#### Pagination Models

```python
from shared.api_core import PaginationParams, PaginationMeta

# Extract from Flask request
pagination = PaginationParams.from_request(request)
# PaginationParams(page=1, per_page=20)

# Create metadata
meta = PaginationMeta.create(pagination, total=150)
# PaginationMeta(page=1, per_page=20, total=150, total_pages=8, 
#                has_next=True, has_prev=False)
```

#### Validation Models

```python
from shared.api_core import RequestValidator, ValidationError

# Require field
name = RequestValidator.require_field(data, 'name')

# Require string with length validation
email = RequestValidator.require_string(
    data, 'email', 
    min_length=5, 
    max_length=100
)

# Require integer with range validation
age = RequestValidator.require_integer(
    data, 'age',
    min_value=0,
    max_value=150
)
```

---

### 2. result.py - Result Type Pattern

Monadic error handling for type-safe operations without exceptions.

#### Basic Usage

```python
from shared.api_core import Result, Success, Failure, success, failure

def divide(a: int, b: int) -> Result[float, str]:
    if b == 0:
        return failure("Division by zero")
    return success(a / b)

result = divide(10, 2)
if result.is_success():
    print(result.unwrap())  # 5.0
else:
    print(result.unwrap_error())  # Error message
```

#### Chaining Operations

```python
from shared.api_core import success, failure

def parse_int(s: str) -> Result[int, str]:
    try:
        return success(int(s))
    except ValueError:
        return failure(f"'{s}' is not a valid integer")

def double(x: int) -> Result[int, str]:
    return success(x * 2)

# Chain operations
result = (
    parse_int("42")
    .map(lambda x: x * 2)      # Transform success value
    .flat_map(double)           # Chain Result-returning function
)

print(result.unwrap())  # 168
```

#### Pattern Matching

```python
result = divide(10, 0)

# Using fold (pattern match)
message = result.fold(
    on_success=lambda v: f"Result: {v}",
    on_failure=lambda e: f"Error: {e}"
)

# Using get_or_else
value = result.get_or_else(0.0)  # Returns 0.0 on failure
```

#### Combining Results

```python
from shared.api_core import sequence, traverse, zip_results

# Sequence: Convert List[Result] to Result[List]
results = [success(1), success(2), success(3)]
combined = sequence(results)  # Success([1, 2, 3])

# Traverse: Map with Result-returning function
items = ["1", "2", "3"]
parsed = traverse(items, parse_int)  # Success([1, 2, 3])

# Zip: Combine two Results
r1 = success(10)
r2 = success(20)
zipped = zip_results(r1, r2)  # Success((10, 20))
```

#### APIError Integration

```python
from shared.api_core import validation_failure, not_found_failure, service_failure

# Validation failure
result = validation_failure(
    "Field 'email' is required",
    field_name='email',
    code=ErrorCode.REQUIRED_FIELD
)

# Not found failure
result = not_found_failure('Agent', 'agent-123')

# Service failure
result = service_failure(
    "Database connection failed",
    original_error=ConnectionError("Timeout")
)
```

#### Result Do Notation

```python
from shared.api_core import ResultDo, validate_required_string, validate_required_integer

# Compose multiple validations
do = ResultDo()
do.bind('name', validate_required_string(data, 'name', min_length=1))
do.bind('age', validate_required_integer(data, 'age', min_value=0))
do.bind('email', validate_required_string(data, 'email', min_length=5))

result = do.result()  # Result[Dict[str, Any], APIError]

if result.is_success():
    validated_data = result.unwrap()
    # {'name': 'Alice', 'age': 30, 'email': 'alice@example.com'}
```

---

### 3. auth.py - Authentication & Authorization

JWT and API key authentication with role-based access control.

#### Configuration

```python
# Environment variables
JWT_SECRET=your-secret-key-here
JWT_EXPIRATION_HOURS=24
ADMIN_KEY_IDS=admin-key-1,admin-key-2
```

#### Authentication Decorator

```python
from shared.api_core import require_auth, get_current_user
from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/api/v1/protected', methods=['GET'])
@require_auth
def protected_endpoint():
    auth_context = get_current_user()
    return jsonify({
        'user_id': auth_context.user_id,
        'roles': auth_context.roles
    })
```

#### Role-Based Access Control

```python
from shared.api_core import require_role, require_permission

@app.route('/api/v1/admin', methods=['GET'])
@require_role('admin')
def admin_endpoint():
    return jsonify({'message': 'Admin access granted'})

@app.route('/api/v1/write', methods=['POST'])
@require_permission('write:agents')
def write_endpoint():
    return jsonify({'message': 'Write permission granted'})
```

#### Manual Authentication

```python
from shared.api_core import authenticate_request, AuthContext

@app.route('/api/v1/custom', methods=['GET'])
def custom_auth():
    try:
        auth_context = authenticate_request(optional=False)
        # Proceed with authenticated request
        return jsonify({'user_id': auth_context.user_id})
    except APIError as e:
        return error_response(e, status=401)
```

#### Creating JWT Tokens

```python
from shared.api_core import create_jwt_token

token = create_jwt_token(
    user_id='user-123',
    roles=['user', 'developer'],
    permissions=['read:agents', 'write:agents'],
    expires_in_hours=24
)

# Use in Authorization header: Bearer <token>
```

#### API Key Management

```python
from shared.api_core import register_api_key

# Register API key (for testing/dev)
register_api_key(
    key_id='service-1',
    secret='secret-key-here',
    roles=['service'],
    permissions=['read:*', 'write:*']
)

# Use in Authorization header: Bearer service-1.secret-key-here
```

#### AuthContext

```python
from shared.api_core import AuthContext

auth_context = AuthContext(
    user_id='user-123',
    token_type='bearer',  # or 'api_key'
    roles=['user', 'developer'],
    permissions=['read:agents', 'write:agents']
)

# Check permissions
if auth_context.has_role('admin'):
    # Admin-only logic
    pass

if auth_context.has_permission('write:agents'):
    # Write permission logic
    pass
```

---

### 4. validation.py - Request Validation

Both exception-based and Result-returning validators.

#### Exception-Based Validation (Legacy)

```python
from shared.api_core import RequestValidator, ValidationError

try:
    name = RequestValidator.require_string(data, 'name', min_length=1, max_length=100)
    age = RequestValidator.require_integer(data, 'age', min_value=0, max_value=150)
except ValidationError as e:
    # Handle validation error
    return error_response(APIError.from_exception(e), status=422)
```

#### Result-Based Validation (Recommended)

```python
from shared.api_core import (
    validate_required_string,
    validate_required_integer,
    validate_email,
    ResultValidator
)

# Individual validators
name_result = validate_required_string(data, 'name', min_length=1)
age_result = validate_required_integer(data, 'age', min_value=0)

# Fluent API
result = (
    ResultValidator(data)
    .require_string('name', min_length=1, max_length=100)
    .require_integer('age', min_value=0, max_value=150)
    .require_string('email', min_length=5)
    .validate()
)

if result.is_success():
    validated_data = result.unwrap()
    # Proceed with validated data
else:
    error = result.unwrap_error()
    return error_response(error, status=422)
```

#### Custom Validators

```python
from shared.api_core import validate_pattern, validate_one_of, validate_optional

# Pattern validation
username_result = validate_pattern(
    username,
    r'^[a-zA-Z0-9_-]{3,20}$',
    field_name='username',
    message='Username must be 3-20 alphanumeric characters'
)

# Enum validation
status_result = validate_one_of(
    status,
    ['active', 'inactive', 'pending'],
    field_name='status'
)

# Optional field validation
bio_result = validate_optional(
    data,
    'bio',
    lambda v: validate_max_length(v, 500, 'bio'),
    default=''
)
```

---

### 5. middleware.py - Middleware Stack

Flask middleware for error handling, CORS, request tracking, and more.

#### Complete Middleware Setup

```python
from flask import Flask
from shared.api_core import create_all_middleware, create_error_handler

app = Flask(__name__)

# Create error handlers
create_error_handler(app)

# Create all middleware
create_all_middleware(
    app,
    api_version='v1',
    enable_rate_limiting=True,
    rate_limit_config={
        'limit': 1000,
        'window': 3600,  # 1 hour
        'per_ip': True
    }
)
```

#### Individual Middleware Components

```python
from shared.api_core import (
    create_request_id_middleware,
    create_cors_middleware,
    create_response_headers_middleware,
    create_auth_middleware
)

# Request ID tracking
create_request_id_middleware(app)

# CORS
create_cors_middleware(app)

# Standard response headers
create_response_headers_middleware(app, api_version='v1')

# Authentication (optional, usually handled by decorators)
create_auth_middleware(app)
```

#### Middleware Execution Order

```
Request Flow:
1. Request ID Middleware (before_request)
2. Rate Limiting Middleware (before_request)
3. Authentication Middleware (before_request)
4. Route Handler
5. Security Headers Middleware (after_request)
6. Response Headers Middleware (after_request)
7. CORS Middleware (after_request)
8. Rate Limit Headers (after_request)
9. Error Handlers (on exception)
```

---

### 6. rate_limiting.py - Rate Limiting

Token bucket rate limiting with configurable limits.

#### Basic Setup

```python
from flask import Flask
from shared.api_core import create_rate_limit_middleware, RateLimitConfig

app = Flask(__name__)

# Default rate limit
default_config = RateLimitConfig(
    limit=1000,      # 1000 requests
    window=3600,     # per hour
    per_ip=True,     # per IP address
    per_endpoint=False
)

create_rate_limit_middleware(app, default_config=default_config)
```

#### Per-Endpoint Rate Limits

```python
from shared.api_core import RateLimitConfig, create_rate_limit_middleware

# Different limits for different endpoints
endpoint_configs = {
    '/api/v1/agents': RateLimitConfig(
        limit=10,      # 10 requests
        window=60,     # per minute
        per_ip=True
    ),
    '/api/v1/search': RateLimitConfig(
        limit=100,     # 100 requests
        window=60,     # per minute
        per_ip=True
    )
}

create_rate_limit_middleware(
    app,
    default_config=default_config,
    endpoint_configs=endpoint_configs
)
```

#### Rate Limit Headers

All responses include rate limit headers:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1704988800
```

On rate limit exceeded (429):

```
Retry-After: 3600
```

#### Custom Identifier Function

```python
def custom_identifier(request):
    # Rate limit by user ID instead of IP
    auth_context = get_current_user()
    if auth_context:
        return f"user:{auth_context.user_id}"
    return f"ip:{request.remote_addr}"

config = RateLimitConfig(
    limit=1000,
    window=3600,
    identifier_func=custom_identifier
)
```

---

### 7. monitoring.py - Monitoring & Observability

Health checks, metrics collection, and observability.

#### Health Checks

```python
from flask import Flask
from shared.api_core import (
    create_health_check_middleware,
    register_health_check,
    HealthCheck
)

app = Flask(__name__)

# Create health check endpoints
create_health_check_middleware(app)

# Register custom health check
def check_database() -> tuple[bool, Optional[str]]:
    try:
        # Check database connection
        db.ping()
        return (True, None)
    except Exception as e:
        return (False, str(e))

register_health_check(
    app,
    HealthCheck('database', check_database, required=True)
)
```

**Health Endpoints:**

- `GET /health` - Overall health status
- `GET /healthz` - Kubernetes health check
- `GET /ready` - Readiness check
- `GET /readiness` - Kubernetes readiness check
- `GET /live` - Liveness check (minimal)
- `GET /liveness` - Kubernetes liveness check

**Health Response:**

```json
{
  "status": "healthy",
  "timestamp": "2026-01-11T12:00:00Z",
  "checks": {
    "default": {
      "status": "healthy",
      "error": null
    },
    "database": {
      "status": "healthy",
      "error": null
    }
  }
}
```

#### Metrics Collection

```python
from shared.api_core import create_metrics_middleware

app = Flask(__name__)

# Create metrics middleware
metrics = create_metrics_middleware(app)

# Manual metrics
metrics.increment('custom_counter')
metrics.set_gauge('active_connections', 42)
metrics.observe_histogram('processing_time_ms', 123.45)
```

**Metrics Endpoint:**

`GET /metrics` returns:

```json
{
  "counters": {
    "http_requests_total": 1000,
    "http_requests_total_2xx": 950,
    "http_requests_total_4xx": 30,
    "http_requests_total_5xx": 20
  },
  "gauges": {
    "active_connections": 42
  },
  "histograms": {
    "http_request_duration_ms": {
      "count": 1000,
      "sum": 50000,
      "min": 10,
      "max": 500,
      "avg": 50
    }
  }
}
```

---

### 8. security_headers.py - Security Headers

OWASP-recommended security headers.

#### Basic Setup

```python
from flask import Flask
from shared.api_core import (
    create_security_headers_middleware,
    SecurityHeadersConfig
)

app = Flask(__name__)

# Use default security headers
create_security_headers_middleware(app)

# Or customize
config = SecurityHeadersConfig(
    strict_transport_security=True,
    hsts_max_age=31536000,  # 1 year
    hsts_include_subdomains=True,
    hsts_preload=False,
    content_security_policy="default-src 'self'",
    x_frame_options='DENY',
    x_content_type_options='nosniff',
    x_xss_protection='1; mode=block',
    referrer_policy='strict-origin-when-cross-origin',
    permissions_policy='geolocation=(), microphone=()'
)

create_security_headers_middleware(app, config)
```

**Headers Added:**

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=()
```

---

### 9. list_helpers.py - List Endpoint Helpers

Pagination, filtering, and sorting for list endpoints.

#### Quick Start

```python
from flask import Flask, request
from shared.api_core import process_list_request, json_response, require_auth

app = Flask(__name__)

@app.route('/api/v1/agents', methods=['GET'])
@require_auth
def list_agents():
    # Get all agents
    all_agents = list(agents_store.values())
    
    # Apply pagination, filtering, sorting
    agents_page, pagination_meta = process_list_request(all_agents)
    
    return json_response(agents_page, pagination=pagination_meta)
```

#### Manual Processing

```python
from shared.api_core import (
    PaginationParams,
    FilterParams,
    SortParams,
    process_list_items
)

# Extract parameters
pagination = PaginationParams.from_request(request)
filters = FilterParams.from_request(request)
sort_params = SortParams.from_request(request)

# Process items
items_page, pagination_meta = process_list_items(
    items=all_items,
    pagination=pagination,
    filters=filters,
    sort_params=sort_params
)
```

#### Query Parameters

**Pagination:**
```
GET /api/v1/agents?page=2&per_page=20
```

**Filtering:**
```
# Simple equality
GET /api/v1/agents?filter[status]=active

# Operators
GET /api/v1/agents?filter[age][gte]=18&filter[age][lte]=65

# Supported operators: eq, ne, gt, gte, lt, lte, in, contains
```

**Sorting:**
```
# Ascending
GET /api/v1/agents?sort=created_at

# Descending (prefix with -)
GET /api/v1/agents?sort=-created_at

# Multiple fields
GET /api/v1/agents?sort=-created_at,name
```

**Combined:**
```
GET /api/v1/agents?page=1&per_page=20&filter[status]=active&sort=-created_at
```

---

### 10. utils.py - Flask Utilities

Helper functions to reduce boilerplate.

#### json_response

```python
from shared.api_core import json_response

@app.route('/api/v1/agent/<agent_id>', methods=['GET'])
@require_auth
def get_agent(agent_id: str):
    agent = agents_store.get(agent_id)
    if not agent:
        error = APIError(
            code=ErrorCode.RESOURCE_NOT_FOUND,
            message=f"Agent '{agent_id}' not found",
            category=ErrorCategory.NOT_FOUND_ERROR
        )
        return error_response(error, status=404)
    
    return json_response(agent, status=200)
```

#### error_response

```python
from shared.api_core import error_response, APIError, ErrorCode, ErrorCategory

@app.route('/api/v1/agent', methods=['POST'])
@require_auth
def create_agent():
    data = request.get_json()
    
    if 'agent_id' not in data:
        error = APIError(
            code=ErrorCode.REQUIRED_FIELD,
            message="Field 'agent_id' is required",
            category=ErrorCategory.VALIDATION_ERROR
        )
        return error_response(error, status=422)
    
    # Create agent...
    return json_response(agent, status=201)
```

#### require_resource_exists

```python
from shared.api_core import require_resource_exists, json_response

@app.route('/api/v1/agent/<agent_id>', methods=['GET'])
@require_auth
def get_agent(agent_id: str):
    # Automatically raises 404 if not found
    agent = require_resource_exists(agents_store, agent_id, "Agent")
    return json_response(agent)
```

---

### 11. schemas.py - Pydantic Schemas

Type-safe request validation with Pydantic.

#### Using Pydantic Schemas

```python
from shared.api_core import (
    AgentCreateRequest,
    validate_with_pydantic,
    json_response,
    error_response
)

@app.route('/api/v1/agents', methods=['POST'])
@require_auth
def create_agent():
    data = request.get_json()
    
    try:
        # Validate with Pydantic
        validated = validate_with_pydantic(AgentCreateRequest, data)
        
        # Use validated data
        agent = {
            'agent_id': validated.agent_id,
            'role_model': validated.role_model.dict(),
            'deepening_cycles': validated.deepening_cycles
        }
        
        agents_store[agent['agent_id']] = agent
        return json_response(agent, status=201)
        
    except ValidationError as e:
        error = APIError.from_exception(e)
        return error_response(error, status=422)
```

#### Available Schemas

- `AgentCreateRequest` - Create agent
- `AgentUpdateRequest` - Partial update (PATCH)
- `AgentReplaceRequest` - Full replacement (PUT)
- `KnowledgeCreateRequest` - Create knowledge
- `KnowledgeUpdateRequest` - Partial update
- `KnowledgeReplaceRequest` - Full replacement
- `SkillCreateRequest` - Create skills
- `SkillUpdateRequest` - Partial update
- `SkillReplaceRequest` - Full replacement

---

### 12. openapi.py & swagger.py - OpenAPI & Swagger

Automatic OpenAPI spec generation and Swagger UI.

#### OpenAPI Spec Generation

```python
from shared.api_core import get_base_openapi_spec, create_openapi_endpoint_spec

# Get base spec
base_spec = get_base_openapi_spec(
    title='AgentBuilder API',
    version='1.0.0',
    description='API for managing AI agents'
)

# Create endpoint spec
endpoint_spec = create_openapi_endpoint_spec(
    path='/api/v1/agents',
    method='post',
    summary='Create a new agent',
    description='Creates a new agent with the specified configuration',
    request_body_schema=AgentCreateRequest.model_json_schema(),
    response_schema={'type': 'object', 'properties': {...}},
    tags=['Agents']
)
```

#### Swagger UI Setup

```python
from flask import Flask
from shared.api_core import setup_swagger, create_swagger_config

app = Flask(__name__)

# Create Swagger configuration
swagger_config = create_swagger_config(
    title='AgentBuilder API',
    version='1.0.0',
    description='API for managing AI agents',
    base_path='/api/v1'
)

# Setup Swagger UI
setup_swagger(app, swagger_config)

# Swagger UI available at: http://localhost:5000/api/docs
```

---

### 13. test_utils.py - Testing Utilities

Utilities for testing API endpoints.

#### Mock Request/Response

```python
from shared.api_core import MockRequest, MockResponse, create_mock_auth_context

# Create mock request
mock_request = MockRequest(
    method='POST',
    path='/api/v1/agents',
    json_data={'agent_id': 'test-123'},
    headers={'Authorization': 'Bearer test-token'}
)

# Create mock auth context
auth_context = create_mock_auth_context(
    user_id='test-user',
    roles=['admin'],
    permissions=['write:agents']
)
```

#### Authentication Fixtures

```python
from shared.api_core import pytest_auth_fixture, create_test_app_with_auth_bypass

# Create test app with auth bypass
app = create_test_app_with_auth_bypass()

# Use pytest fixture
@pytest.fixture
def auth_fixture():
    return pytest_auth_fixture()
```

---

## Best Practices

### 1. Error Handling

**Always use structured errors:**

```python
# ❌ Bad
return jsonify({'error': 'Not found'}), 404

# ✅ Good
error = APIError(
    code=ErrorCode.RESOURCE_NOT_FOUND,
    message=f"Agent '{agent_id}' not found",
    category=ErrorCategory.NOT_FOUND_ERROR
)
return error_response(error, status=404)
```

### 2. Validation

**Prefer Result-based validation for new code:**

```python
# ❌ Legacy (exception-based)
try:
    name = RequestValidator.require_string(data, 'name')
except ValidationError as e:
    return error_response(APIError.from_exception(e), status=422)

# ✅ Modern (Result-based)
result = (
    ResultValidator(data)
    .require_string('name', min_length=1)
    .validate()
)
if result.is_failure():
    return error_response(result.unwrap_error(), status=422)
```

### 3. Authentication

**Use decorators for protected endpoints:**

```python
# ✅ Simple authentication
@app.route('/api/v1/agents', methods=['GET'])
@require_auth
def list_agents():
    pass

# ✅ Role-based access
@app.route('/api/v1/admin', methods=['GET'])
@require_role('admin')
def admin_endpoint():
    pass
```

### 4. List Endpoints

**Use process_list_request for consistency:**

```python
# ✅ Consistent list endpoint
@app.route('/api/v1/agents', methods=['GET'])
@require_auth
def list_agents():
    all_agents = list(agents_store.values())
    agents_page, pagination_meta = process_list_request(all_agents)
    return json_response(agents_page, pagination=pagination_meta)
```

### 5. Middleware Setup

**Use create_all_middleware for complete setup:**

```python
# ✅ Complete middleware stack
from shared.api_core import create_all_middleware, create_error_handler

app = Flask(__name__)
create_error_handler(app)
create_all_middleware(app, api_version='v1', enable_rate_limiting=True)
```

### 6. Result Type Usage

**Chain operations for cleaner code:**

```python
# ✅ Functional composition
result = (
    validate_required_string(data, 'email')
    .flat_map(lambda email: validate_email(email, 'email'))
    .map(lambda email: email.lower())
)
```

### 7. Testing

**Use test utilities for consistent tests:**

```python
from shared.api_core import MockRequest, create_mock_auth_context

def test_endpoint():
    mock_request = MockRequest(
        method='POST',
        path='/api/v1/agents',
        json_data={'agent_id': 'test-123'}
    )
    
    auth_context = create_mock_auth_context(
        user_id='test-user',
        roles=['admin']
    )
```

---

## Migration Guide

### From Legacy to Shared API Core

#### Step 1: Update Imports

```python
# Before
from flask import jsonify

# After
from shared.api_core import json_response, error_response
```

#### Step 2: Standardize Error Handling

```python
# Before
return jsonify({'error': 'Not found'}), 404

# After
error = APIError(
    code=ErrorCode.RESOURCE_NOT_FOUND,
    message="Resource not found",
    category=ErrorCategory.NOT_FOUND_ERROR
)
return error_response(error, status=404)
```

#### Step 3: Add Middleware

```python
# Add to server.py
from shared.api_core import create_all_middleware, create_error_handler

app = Flask(__name__)
create_error_handler(app)
create_all_middleware(app, api_version='v1')
```

#### Step 4: Migrate List Endpoints

```python
# Before
@app.route('/api/v1/agents', methods=['GET'])
def list_agents():
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    # Manual pagination logic...

# After
@app.route('/api/v1/agents', methods=['GET'])
@require_auth
def list_agents():
    all_agents = list(agents_store.values())
    agents_page, pagination_meta = process_list_request(all_agents)
    return json_response(agents_page, pagination=pagination_meta)
```

#### Step 5: Add Authentication

```python
# Add to protected endpoints
from shared.api_core import require_auth

@app.route('/api/v1/agents', methods=['POST'])
@require_auth
def create_agent():
    # Endpoint logic
    pass
```

---

## Component Reference

### Complete Module List

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| `models.py` | Core data models | `APIResponse`, `APIError`, `ErrorCode`, `ErrorCategory`, `PaginationParams`, `PaginationMeta` |
| `result.py` | Result type pattern | `Result`, `Success`, `Failure`, `success`, `failure`, `sequence`, `traverse` |
| `auth.py` | Authentication | `require_auth`, `require_role`, `require_permission`, `AuthContext`, `create_jwt_token` |
| `validation.py` | Request validation | `validate_required_string`, `validate_required_integer`, `ResultValidator` |
| `middleware.py` | Flask middleware | `create_all_middleware`, `create_error_handler`, `create_cors_middleware` |
| `rate_limiting.py` | Rate limiting | `RateLimitConfig`, `RateLimiter`, `create_rate_limit_middleware` |
| `monitoring.py` | Health & metrics | `HealthCheck`, `create_health_check_middleware`, `create_metrics_middleware` |
| `security_headers.py` | Security headers | `SecurityHeadersConfig`, `create_security_headers_middleware` |
| `list_helpers.py` | List operations | `process_list_request`, `process_list_items`, `apply_list_filters` |
| `filtering.py` | Filter & sort | `apply_filter`, `apply_sorting` |
| `utils.py` | Flask utilities | `json_response`, `error_response`, `require_resource_exists` |
| `schemas.py` | Pydantic schemas | `AgentCreateRequest`, `KnowledgeCreateRequest`, `SkillCreateRequest` |
| `openapi.py` | OpenAPI generation | `get_base_openapi_spec`, `create_openapi_endpoint_spec` |
| `swagger.py` | Swagger UI | `setup_swagger`, `create_swagger_config` |
| `test_utils.py` | Testing utilities | `MockRequest`, `MockResponse`, `create_mock_auth_context` |

---

## Performance Considerations

### Rate Limiting

- Token bucket algorithm: O(1) per request
- Memory usage: ~100 bytes per unique identifier
- Automatic cleanup of expired buckets every hour

### Pagination

- In-memory pagination: O(n) for filtering/sorting
- Consider database-level pagination for large datasets
- Default limit: 20 items per page, max 100

### Validation

- Result-based validation: Zero-cost abstractions
- Pydantic validation: ~10-50μs per request
- Cache compiled validators when possible

### Middleware

- Request ID: ~1μs overhead
- Rate limiting: ~10-50μs overhead
- Security headers: ~5μs overhead
- Total middleware overhead: <100μs per request

---

## Troubleshooting

### Common Issues

#### 1. Flask Not Available

**Error:** `RuntimeError: Flask is required for...`

**Solution:** Install Flask:
```bash
pip install Flask
```

#### 2. Pydantic Not Available

**Error:** `RuntimeError: Pydantic is required for...`

**Solution:** Install Pydantic:
```bash
pip install pydantic
```

#### 3. Rate Limit Not Working

**Issue:** Rate limits not being enforced

**Solution:** Ensure middleware is created before routes:
```python
create_rate_limit_middleware(app, default_config)
# Then define routes
```

#### 4. CORS Errors

**Issue:** CORS preflight requests failing

**Solution:** Ensure CORS middleware is enabled:
```python
create_cors_middleware(app)
```

#### 5. Authentication Failing

**Issue:** Valid tokens being rejected

**Solution:** Check JWT_SECRET environment variable:
```bash
export JWT_SECRET=your-secret-key
```

---

## Examples

### Complete Service Setup

```python
from flask import Flask, request
from shared.api_core import (
    create_all_middleware,
    create_error_handler,
    require_auth,
    json_response,
    error_response,
    process_list_request,
    APIError,
    ErrorCode,
    ErrorCategory
)

# Create Flask app
app = Flask(__name__)

# Setup error handlers
create_error_handler(app)

# Setup middleware
create_all_middleware(
    app,
    api_version='v1',
    enable_rate_limiting=True,
    rate_limit_config={
        'limit': 1000,
        'window': 3600,
        'per_ip': True
    }
)

# In-memory store
agents_store = {}

# List endpoint
@app.route('/api/v1/agents', methods=['GET'])
@require_auth
def list_agents():
    all_agents = list(agents_store.values())
    agents_page, pagination_meta = process_list_request(all_agents)
    return json_response(agents_page, pagination=pagination_meta)

# Get endpoint
@app.route('/api/v1/agents/<agent_id>', methods=['GET'])
@require_auth
def get_agent(agent_id: str):
    agent = agents_store.get(agent_id)
    if not agent:
        error = APIError(
            code=ErrorCode.RESOURCE_NOT_FOUND,
            message=f"Agent '{agent_id}' not found",
            category=ErrorCategory.NOT_FOUND_ERROR
        )
        return error_response(error, status=404)
    return json_response(agent)

# Create endpoint
@app.route('/api/v1/agents', methods=['POST'])
@require_auth
def create_agent():
    data = request.get_json()
    
    if 'agent_id' not in data:
        error = APIError(
            code=ErrorCode.REQUIRED_FIELD,
            message="Field 'agent_id' is required",
            category=ErrorCategory.VALIDATION_ERROR
        )
        return error_response(error, status=422)
    
    agent_id = data['agent_id']
    if agent_id in agents_store:
        error = APIError(
            code=ErrorCode.DUPLICATE_RESOURCE,
            message=f"Agent '{agent_id}' already exists",
            category=ErrorCategory.CONFLICT_ERROR
        )
        return error_response(error, status=409)
    
    agents_store[agent_id] = data
    return json_response(data, status=201)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

---

## Additional Resources

### Documentation

- [AgentBuilder API Spec](./services/AGENTBUILDER_COMPLETE_SPEC.md)
- [KnowledgeBuilder API Spec](./services/KNOWLEDGEBUILDER_API_SPEC.md)
- [SkillBuilder API Spec](./services/SKILLBUILDER_API_SPEC.md)
- [Authentication Guide](./AUTHENTICATION.md)
- [Integration Quick Start](./INTEGRATION_QUICK_START.md)
- [OpenAPI Documentation](./openapi/README.md)
- [Swagger UI Deployment](./SWAGGER_UI_DEPLOYMENT.md)

### Source Code

- GitHub: [Chrysalis Repository](https://github.com/chrysalis/chrysalis)
- Shared API Core: `shared/api_core/`
- Tests: `shared/api_core/tests/`

### Support

- Documentation: https://docs.chrysalis.dev
- Issues: https://github.com/chrysalis/chrysalis/issues
- Discussions: https://github.com/chrysalis/chrysalis/discussions

---

## Changelog

### Version 1.0.0 (2026-01-11)

**Initial Release:**

- Complete API response/error models
- Result type pattern for monadic error handling
- JWT and API key authentication
- Role-based access control
- Request validation (exception-based and Result-based)
- Flask middleware stack (CORS, rate limiting, security headers)
- Health checks and metrics collection
- List endpoint helpers (pagination, filtering, sorting)
- OpenAPI 3.0 spec generation
- Swagger UI integration
- Pydantic request schemas
- Testing utilities
- Comprehensive documentation

---

**End of Shared API Core Documentation**

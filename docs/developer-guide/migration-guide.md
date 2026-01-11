# Migration Guide

**Version**: 1.0.0
**Last Updated**: 2025-01-XX
**Status**: Current

## Overview

This guide helps developers migrate existing code to use the new shared API core library and follow the Unified API Standard. Following the complex learner pattern, migration is treated as a learning opportunity that helps the system understand patterns and improve over time.

## Migration Strategy

### Phase 1: Adopt Shared API Core

Migrate to use the shared API core library for common functionality:

- Request/response models
- Error handling
- Middleware
- Authentication
- Validation

### Phase 2: Standardize Endpoints

Update endpoints to follow the Unified API Standard:

- Consistent URL structure (`/api/v1/...`)
- Standard response format
- Standard error format
- Consistent pagination, filtering, sorting

### Phase 3: Add Observability

Add monitoring, error tracking, and audit logging:

- Health checks
- Metrics
- Error tracking (Sentry)
- Audit logging

## Migration Steps

### Step 1: Install Shared API Core

```bash
cd shared/api_core
pip install -e .
cd ../..
```

### Step 2: Update Imports

**Before**:
```python
from flask import Flask, request, jsonify
```

**After**:
```python
from flask import Flask, request
from shared.api_core import (
    APIResponse,
    APIError,
    json_response,
    error_response,
    create_all_middleware,
)
```

### Step 3: Replace Response Helpers

**Before**:
```python
@app.route('/api/v1/endpoint')
def my_endpoint():
    return jsonify({"data": "value"}), 200
```

**After**:
```python
@app.route('/api/v1/endpoint')
def my_endpoint():
    return json_response({"data": "value"})
```

### Step 4: Replace Error Responses

**Before**:
```python
return jsonify({"error": "Not found"}), 404
```

**After**:
```python
from shared.api_core import APIError, ErrorCode, ErrorCategory

error = APIError(
    code=ErrorCode.RESOURCE_NOT_FOUND,
    message="Resource not found",
    category=ErrorCategory.NOT_FOUND_ERROR,
)
return error_response(error, status=404)
```

### Step 5: Use Standard Middleware

**Before**:
```python
app = Flask(__name__)
# Manual middleware setup
```

**After**:
```python
app = Flask(__name__)
create_all_middleware(app, api_version="v1")
# Automatically includes:
# - Request ID tracking
# - CORS
# - Response headers
# - Rate limiting (optional)
# - Health checks
# - Metrics
# - Security headers
# - Error tracking
# - Audit logging
```

### Step 6: Use Resource Helpers

**Before**:
```python
@app.route('/api/v1/resources/<resource_id>')
def get_resource(resource_id):
    if resource_id not in store:
        return jsonify({"error": "Not found"}), 404
    resource = store[resource_id]
    return jsonify(resource), 200
```

**After**:
```python
from shared.api_core import require_resource_exists

@app.route('/api/v1/resources/<resource_id>')
def get_resource(resource_id):
    resource = require_resource_exists(store, resource_id, "Resource")
    return json_response(resource)
```

### Step 7: Use List Helpers

**Before**:
```python
@app.route('/api/v1/resources')
def list_resources():
    items = list(store.values())
    # Manual pagination, filtering, sorting
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    # ... manual implementation
    return jsonify({"items": items}), 200
```

**After**:
```python
from shared.api_core import process_list_request

@app.route('/api/v1/resources')
def list_resources():
    all_items = list(store.values())
    paginated_items, pagination_meta = process_list_request(all_items)
    return json_response(paginated_items, pagination=pagination_meta)
```

### Step 8: Add Authentication

**Before**:
```python
@app.route('/api/v1/protected')
def protected_endpoint():
    # Manual authentication check
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return jsonify({"error": "Unauthorized"}), 401
    # ... manual token verification
    return jsonify({"data": "value"}), 200
```

**After**:
```python
from shared.api_core import require_auth

@app.route('/api/v1/protected')
@require_auth
def protected_endpoint():
    return json_response({"data": "value"})
```

### Step 9: Use Request Validation

**Before**:
```python
@app.route('/api/v1/endpoint', methods=['POST'])
def create_endpoint():
    data = request.get_json() or {}
    # Manual validation
    if 'name' not in data:
        return jsonify({"error": "name required"}), 400
    if not isinstance(data['name'], str):
        return jsonify({"error": "name must be string"}), 400
    # ...
```

**After**:
```python
from shared.api_core import RequestValidator, ValidationError

@app.route('/api/v1/endpoint', methods=['POST'])
def create_endpoint():
    try:
        data = request.get_json() or {}
        name = RequestValidator.require_string(data, 'name', min_length=1)
        # ...
    except ValidationError as e:
        error = APIError.from_exception(e)
        return error_response(error, status=422)
```

Or with Pydantic:

```python
from shared.api_core import validate_with_pydantic
from shared.api_core.schemas import AgentCreateRequest

@app.route('/api/v1/endpoint', methods=['POST'])
def create_endpoint():
    try:
        data = validate_with_pydantic(AgentCreateRequest, request.get_json())
        # data is validated and typed
    except ValidationError as e:
        error = APIError.from_exception(e)
        return error_response(error, status=422)
```

### Step 10: Add OpenAPI Documentation

**Before**:
```python
@app.route('/api/v1/endpoint')
def my_endpoint():
    return jsonify({"data": "value"}), 200
```

**After**:
```python
@app.route('/api/v1/endpoint')
def my_endpoint():
    """
    My endpoint description.
    ---
    tags:
      - TagName
    summary: Endpoint summary
    description: Detailed endpoint description
    parameters:
      - in: query
        name: param
        type: string
    responses:
      200:
        description: Success
        schema:
          type: object
          properties:
            data:
              type: string
    """
    return json_response({"data": "value"})
```

## Common Migration Patterns

### Pattern 1: Error Handling

**Before**: Inconsistent error formats
**After**: Standard `APIError` format

```python
# Standard error creation
error = APIError(
    code=ErrorCode.RESOURCE_NOT_FOUND,
    message="Resource not found",
    category=ErrorCategory.NOT_FOUND_ERROR,
)
return error_response(error, status=404)
```

### Pattern 2: Response Format

**Before**: Inconsistent response formats
**After**: Standard `APIResponse` format

```python
# Standard response
return json_response({"data": "value"})

# With pagination
return json_response(items, pagination=pagination_meta)
```

### Pattern 3: Authentication

**Before**: Manual authentication checks
**After**: Decorator-based authentication

```python
# Simple authentication
@require_auth
def protected_endpoint():
    return json_response({"data": "value"})

# With optional authentication
def optional_auth_endpoint():
    user = authenticate_request(optional=True)
    if user:
        # Authenticated user logic
        pass
    # Public logic
    return json_response({"data": "value"})
```

### Pattern 4: List Endpoints

**Before**: Manual pagination, filtering, sorting
**After**: Automatic via `process_list_request()`

```python
@app.route('/api/v1/resources')
def list_resources():
    all_items = list(store.values())
    paginated_items, pagination_meta = process_list_request(all_items)
    return json_response(paginated_items, pagination=pagination_meta)
```

## Testing Migration

### Test Standard Responses

```python
def test_endpoint_returns_standard_format(client):
    response = client.get('/api/v1/endpoint')
    assert response.status_code == 200
    data = response.get_json()
    assert 'success' in data
    assert data['success'] is True
    assert 'data' in data
```

### Test Error Responses

```python
def test_error_returns_standard_format(client):
    response = client.get('/api/v1/nonexistent')
    assert response.status_code == 404
    data = response.get_json()
    assert 'success' in data
    assert data['success'] is False
    assert 'error' in data
    assert 'code' in data['error']
    assert 'message' in data['error']
```

### Test Authentication

```python
def test_authentication_required(client):
    response = client.get('/api/v1/protected')
    assert response.status_code == 401

def test_authenticated_request(client, auth_token):
    response = client.get(
        '/api/v1/protected',
        headers={'Authorization': f'Bearer {auth_token}'}
    )
    assert response.status_code == 200
```

## Rollback Strategy

If migration causes issues:

1. **Revert Code**: Use Git to revert changes
2. **Keep Dependencies**: Shared API core can coexist with old code
3. **Gradual Migration**: Migrate endpoints one at a time
4. **Feature Flags**: Use feature flags to enable/disable new code

## Migration Checklist

- [ ] Install shared API core
- [ ] Update imports
- [ ] Replace response helpers
- [ ] Replace error responses
- [ ] Use standard middleware
- [ ] Use resource helpers
- [ ] Use list helpers
- [ ] Add authentication
- [ ] Use request validation
- [ ] Add OpenAPI documentation
- [ ] Update tests
- [ ] Update API documentation
- [ ] Test in development
- [ ] Test in staging
- [ ] Deploy to production

## Troubleshooting

### Import Errors

If you see import errors:

```bash
# Ensure shared API core is installed
cd shared/api_core
pip install -e .
cd ../..
```

### Middleware Conflicts

If middleware conflicts occur:

```python
# Disable specific middleware
create_all_middleware(
    app,
    api_version="v1",
    enable_rate_limiting=False,  # Disable rate limiting
)
```

### Response Format Issues

If responses don't match expected format:

```python
# Ensure using json_response helper
from shared.api_core import json_response

return json_response({"data": "value"})  # Correct
# Not: return jsonify({"data": "value"}), 200  # Wrong
```

## Support

For migration help:

- **Documentation**: See `docs/developer-guide/getting-started.md`
- **Examples**: See `examples/` directory
- **Issues**: Report issues on GitHub
- **Discussions**: Join discussions on GitHub

## Learning from Migration

Following the complex learner pattern, treat migration as a learning opportunity:

1. **Discovery**: Understand existing code patterns
2. **Investigation**: Identify migration opportunities
3. **Synthesis**: Plan migration strategy
4. **Reporting**: Execute migration and document learnings

Each migration teaches us about patterns, relationships, and improvements.

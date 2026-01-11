# Code Review Checklist

**Project**: Chrysalis API Services (AgentBuilder, KnowledgeBuilder, SkillBuilder)
**Language**: Python
**Framework**: Flask
**Complexity**: Moderate to Complex
**Security Tier**: Elevated
**Codebase Age**: Modern
**Deployment Environment**: Cloud

---

## 🔴 MAJOR ISSUES (Must Fix Before Merge)

### 1.1 Security Vulnerabilities

**Python-Specific Security Checks**:
- [ ] 🔴 No SQL injection vulnerabilities (use parameterized queries if raw SQL)
- [ ] 🔴 No pickle deserialization of untrusted data
- [ ] 🔴 No command injection (no `os.system()`, `subprocess` with user input without validation)
- [ ] 🔴 No SSRF vulnerabilities (validate URLs before fetching)
- [ ] 🔴 No path traversal vulnerabilities (sanitize file paths)
- [ ] 🔴 No insecure random number generation (use `secrets` module, not `random` for crypto)

**API-Specific Security Checks**:
- [ ] 🔴 Rate limiting implemented on all endpoints
- [ ] 🔴 Input validation on all request parameters
- [ ] 🔴 Authentication/authorization properly implemented via `@require_auth`
- [ ] 🔴 API keys not exposed in logs or error messages
- [ ] 🔴 CORS configured correctly (no wildcard for production)
- [ ] 🔴 No sensitive data in error responses (stack traces disabled in production)

**Elevated Security Requirements**:
- [ ] 🔴 Security headers properly configured (HSTS, CSP, X-Frame-Options)
- [ ] 🔴 Rate limiting configured on sensitive endpoints (using `RateLimitConfig`)
- [ ] 🔴 Audit logging for security-relevant events (authentication failures, privilege escalations)
- [ ] 🔴 Threat modeling reviewed for new features
- [ ] 🔴 Dependencies scanned for known vulnerabilities (`pip-audit` or `safety check`)
- [ ] 🔴 Secrets management uses environment variables or secret stores (no hardcoded secrets)

### 1.2 Logic Errors

- [ ] 🔴 Business logic correctly implements requirements
- [ ] 🔴 Edge cases handled:
  - [ ] Null/None values
  - [ ] Empty strings/arrays
  - [ ] Boundary values (max/min limits)
  - [ ] Unicode issues (special characters in identifiers)
  - [ ] Timezone handling (use UTC consistently)
- [ ] 🔴 Error handling covers all failure modes:
  - [ ] External API failures (using `error_response()` helper)
  - [ ] Validation errors (using `ValidationError`)
  - [ ] Resource not found (using `require_resource_exists()` helper)
  - [ ] Database connection failures
- [ ] 🔴 Race conditions prevented in concurrent code (if using async/threading)
- [ ] 🔴 State mutations are intentional and controlled
- [ ] 🔴 Loop termination conditions are correct
- [ ] 🔴 Off-by-one errors checked in array/string operations
- [ ] 🔴 Floating-point precision issues addressed where applicable
- [ ] 🔴 Boolean logic correctness verified

### 1.3 Breaking Changes

- [ ] 🔴 API contracts maintained (no unintended breaking changes to request/response formats)
- [ ] 🔴 Database migrations are backward compatible (if applicable)
- [ ] 🔴 Configuration changes documented and communicated
- [ ] 🔴 Deprecation warnings added before removal of endpoints/features
- [ ] 🔴 Version bumps follow semantic versioning (`/api/v1/` endpoints)
- [ ] 🔴 Shared API core changes don't break dependent services

### 1.4 Critical Performance Issues

- [ ] 🔴 No N+1 query patterns (if using database ORMs)
- [ ] 🔴 No unbounded memory growth (streaming for large datasets)
- [ ] 🔴 No blocking operations in async contexts (if using async Flask)
- [ ] 🔴 Resource cleanup:
  - [ ] Database connections closed properly
  - [ ] File handles closed (use context managers)
  - [ ] HTTP connections pooled/reused
- [ ] 🔴 Timeout handling for external calls (pipeline execution, API calls)
- [ ] 🔴 Rate limiting doesn't block legitimate users unnecessarily
- [ ] 🔴 Memory leaks in long-running processes (check for global state accumulation)

---

## 🟡 MINOR RECOMMENDATIONS (Should Fix)

### 2.1 Python Coding Standards

- [ ] 🟡 Type hints on all public functions (using `typing` module)
- [ ] 🟡 PEP 8 style compliance (line length ≤ 88/100, naming conventions)
- [ ] 🟡 Context managers used for resource handling (`with` statements)
- [ ] 🟡 List comprehensions preferred over map/filter where readable
- [ ] 🟡 f-strings used for string formatting (not `.format()` or `%`)
- [ ] 🟡 Dataclasses or Pydantic models for data structures (as in `schemas.py`)
- [ ] 🟡 Virtual environments and dependency pinning (`requirements.txt` with versions)
- [ ] 🟡 Black formatter used (or equivalent auto-formatter)
- [ ] 🟡 Import statements organized (standard library, third-party, local)
- [ ] 🟡 Docstrings follow Google or NumPy style for public APIs

### 2.2 Flask API Best Practices

- [ ] 🟡 RESTful conventions followed consistently:
  - [ ] GET for retrieval (idempotent)
  - [ ] POST for creation (non-idempotent)
  - [ ] PUT for full replacement (idempotent)
  - [ ] PATCH for partial updates (idempotent)
  - [ ] DELETE for deletion (idempotent)
- [ ] 🟡 Pagination implemented for list endpoints (using `PaginationParams`, `PaginationMeta`)
- [ ] 🟡 Consistent error response format (using `error_response()` helper)
- [ ] 🟡 API versioning strategy applied (`/api/v1/` prefix)
- [ ] 🟡 OpenAPI/Swagger documentation updated (using `setup_swagger()`)
- [ ] 🟡 Filtering and sorting implemented (using `FilterParams`, `SortParams`)
- [ ] 🟡 Helper functions used consistently:
  - [ ] `json_response()` for success responses
  - [ ] `error_response()` for error responses
  - [ ] `require_resource_exists()` for 404 checks
  - [ ] `process_list_request()` for list endpoints

### 2.3 Shared API Core Usage

- [ ] 🟡 Shared utilities used from `shared.api_core` instead of duplicate code:
  - [ ] `json_response()` instead of `APIResponse.success_response() + jsonify()`
  - [ ] `error_response()` instead of `APIResponse.error_response() + jsonify()`
  - [ ] `require_resource_exists()` instead of manual `if not in store` checks
  - [ ] `process_list_request()` for list endpoints
  - [ ] `apply_filter()`, `apply_sorting()` for filtering/sorting
- [ ] 🟡 Middleware configured consistently (`create_all_middleware()`)
- [ ] 🟡 Error handlers registered (`create_error_handler()`)
- [ ] 🟡 Authentication decorators used (`@require_auth`)

### 2.4 Code Organization

- [ ] 🟡 Single responsibility principle (each function/class does one thing)
- [ ] 🟡 DRY principle followed (no duplicate code across services)
- [ ] 🟡 Functions are focused and cohesive (not doing too many things)
- [ ] 🟡 Magic numbers replaced with named constants
- [ ] 🟡 Configuration values in config files, not hardcoded
- [ ] 🟡 Business logic separated from request handling
- [ ] 🟡 Pipeline logic separated from Flask route handlers

### 2.5 Documentation

- [ ] 🟡 Public APIs documented with docstrings:
  - [ ] Route handlers have docstrings describing endpoint behavior
  - [ ] Helper functions documented (parameters, return values, exceptions)
  - [ ] Complex algorithms explained in comments
- [ ] 🟡 README updated if behavior changes
- [ ] 🟡 CHANGELOG entry added for user-facing changes
- [ ] 🟡 Architecture decision records (ADRs) for significant choices
- [ ] 🟡 Inline comments for non-obvious code
- [ ] 🟡 Swagger/OpenAPI documentation accurate and complete

### 2.6 Testing

- [ ] 🟡 Unit tests cover new functionality:
  - [ ] Helper functions tested (`shared/api_core/tests/`)
  - [ ] Route handlers have integration tests
  - [ ] Edge cases have test coverage
- [ ] 🟡 Integration tests for external dependencies:
  - [ ] Pipeline execution tests
  - [ ] Authentication flow tests
  - [ ] Error handling tests
- [ ] 🟡 Test names describe behavior, not implementation
- [ ] 🟡 Mocks/stubs used appropriately:
  - [ ] Mock requests using `MockRequest` from `test_utils.py`
  - [ ] Mock authentication using `mock_authenticate_request`
  - [ ] Not over-mocked (prefer real implementations when possible)
- [ ] 🟡 Test fixtures used for common setup (`AuthenticationFixture`)
- [ ] 🟡 Tests are isolated (don't depend on each other)

### 2.7 Code Metrics

- [ ] 🟡 Cyclomatic complexity under 10 for methods
- [ ] 🟡 Method length under 50 lines (ideally under 30)
- [ ] 🟡 Class cohesion maintained (methods in class use class state)
- [ ] 🟡 Coupling minimized between modules:
  - [ ] Services don't import from each other directly
  - [ ] Shared code in `shared/api_core`
  - [ ] Pipeline logic in service-specific modules

---

## 💡 REFACTORING OPPORTUNITIES (Consider for Future)

### 4.1 Code Smells to Address

- [ ] 💡 Long methods (>50 lines) that could be extracted:
  - [ ] Route handlers with complex logic should delegate to service classes
  - [ ] Pipeline execution logic should be in separate modules
- [ ] 💡 Deep nesting (>3 levels) that could be flattened:
  - [ ] Use early returns for error cases
  - [ ] Extract nested logic into helper functions
- [ ] 💡 Duplicate code that could be abstracted:
  - [ ] Similar validation logic across services
  - [ ] Common pipeline patterns
- [ ] 💡 Magic numbers replaced with named constants:
  - [ ] HTTP status codes
  - [ ] Default values (pagination, timeouts)
  - [ ] Configuration limits
- [ ] 💡 Large functions (>100 lines) split into smaller functions

### 4.2 Design Pattern Opportunities

- [ ] 💡 Service layer pattern for business logic (separate from route handlers)
- [ ] 💡 Repository pattern for data access (if using databases)
- [ ] 💡 Factory pattern for creating pipeline instances
- [ ] 💡 Strategy pattern for different pipeline types
- [ ] 💡 Decorator pattern for cross-cutting concerns (logging, timing)
- [ ] 💡 Builder pattern for complex request construction

### 4.3 Preferred Implementation Examples

**Error Handling**:

```
Instead of:
  if resource_id not in store:
      error = APIError(
          code=ErrorCode.RESOURCE_NOT_FOUND,
          message=f"Resource '{resource_id}' not found",
          category=ErrorCategory.NOT_FOUND_ERROR,
      )
      return error_response(error, status=404)
  resource = store[resource_id]

Prefer:
  resource = require_resource_exists(store, resource_id, "Resource")
```

**Response Formatting**:

```
Instead of:
  response = APIResponse.success_response(data)
  return jsonify(response.to_dict()), 200

Prefer:
  return json_response(data)
```

**Error Responses**:

```
Instead of:
  response, status = APIResponse.error_response(error, status_code=404)
  return jsonify(response.to_dict()), status

Prefer:
  return error_response(error, status=404)
```

**List Endpoints**:

```
Instead of:
  all_items = list(store.values())
  filtered_items = [item for item in all_items if item.get('field') == value]
  sorted_items = sorted(filtered_items, key=lambda x: x.get('sort_field'))
  paginated_items = sorted_items[offset:offset+per_page]
  pagination_meta = PaginationMeta.create(...)
  response = APIResponse.success_response(paginated_items, pagination=pagination_meta)
  return jsonify(response.to_dict()), 200

Prefer:
  all_items = list(store.values())
  paginated_items, pagination_meta = process_list_request(all_items)
  return json_response(paginated_items, pagination=pagination_meta)
```

---

## 🚀 DEPLOYMENT AND INFRASTRUCTURE

- [ ] 🚀 Configuration management secure (no secrets in code):
  - [ ] Environment variables for API keys, database URLs
  - [ ] Secrets in secret stores (AWS Secrets Manager, etc.)
- [ ] 🚀 Environment-specific settings handled:
  - [ ] Development, staging, production configs
  - [ ] Feature flags for new functionality
- [ ] 🚀 Rollback strategy documented:
  - [ ] Database migrations reversible
  - [ ] Service versioning
- [ ] 🚀 Monitoring and logging configured:
  - [ ] Structured logging (JSON format)
  - [ ] Request ID tracking (using `create_request_id_middleware()`)
  - [ ] Error tracking (Sentry, etc.)
  - [ ] Performance metrics (response times, error rates)
- [ ] 🚀 CI/CD pipeline reviewed:
  - [ ] Automated tests run on PR
  - [ ] Linting/formatting checks
  - [ ] Security scanning
  - [ ] Deployment automation
- [ ] 🚀 Dependency updates automated or regularly reviewed:
  - [ ] Dependabot or similar
  - [ ] Security patches applied promptly

---

## ✅ POSITIVE OBSERVATIONS

When code is done well, acknowledge:

- [ ] ✅ Consistent use of helper functions (`json_response`, `error_response`, `require_resource_exists`)
- [ ] ✅ Shared API core library used effectively
- [ ] ✅ Clean separation of concerns (routes, business logic, pipelines)
- [ ] ✅ Good error handling patterns
- [ ] ✅ Consistent API response format
- [ ] ✅ Authentication/authorization properly implemented
- [ ] ✅ Rate limiting configured
- [ ] ✅ OpenAPI documentation present
- [ ] ✅ Type hints used
- [ ] ✅ Tests written

---

## SUMMARY TEMPLATE

```markdown
## Code Review Summary

**PR**: [PR Title/Number]
**Reviewer**: [Name]
**Date**: [Date]
**Services Affected**: [AgentBuilder/KnowledgeBuilder/SkillBuilder]

### Statistics

| Category                    | Count |
| --------------------------- | ----- |
| 🔴 Major Issues              | X     |
| 🟡 Minor Recommendations     | Y     |
| 💡 Refactoring Opportunities | Z     |
| 🚀 Deployment Issues         | W     |

### Key Findings

**Security**:
- [Summary of security issues found]

**Code Quality**:
- [Summary of code quality issues]

**Performance**:
- [Summary of performance concerns]

**Documentation**:
- [Summary of documentation gaps]

### Recommendation

[ ] ✅ **Approve** - Ready to merge
[ ] 🔄 **Request Changes** - Address major issues before merge
[ ] 💬 **Needs Discussion** - Clarification needed on design decisions

### Next Steps

1. [Action item 1]
2. [Action item 2]
3. [Action item 3]
```

---

## QUICK REFERENCE

### Helper Functions Location

- `json_response()`: `shared/api_core/utils.py`
- `error_response()`: `shared/api_core/utils.py`
- `require_resource_exists()`: `shared/api_core/utils.py`
- `process_list_request()`: `shared/api_core/list_helpers.py`
- `apply_filter()`, `apply_sorting()`: `shared/api_core/filtering.py`

### Common Patterns

**Success Response**:
```python
return json_response(data, status=200)
return json_response(data, pagination=pagination_meta)
```

**Error Response**:
```python
return error_response(error, status=404)
```

**Resource Existence Check**:
```python
resource = require_resource_exists(store, resource_id, "ResourceName")
```

**List Endpoint**:
```python
all_items = list(store.values())
paginated_items, pagination_meta = process_list_request(all_items)
return json_response(paginated_items, pagination=pagination_meta)
```

---

## RESOURCES

### Python/Flask
- [Flask Documentation](https://flask.palletsprojects.com/)
- [PEP 8 Style Guide](https://peps.python.org/pep-0008/)
- [Python Type Hints](https://docs.python.org/3/library/typing.html)
- [Flask Best Practices](https://flask.palletsprojects.com/en/2.3.x/patterns/)

### API Design
- [RESTful API Design](https://restfulapi.net/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [API Versioning Best Practices](https://www.baeldung.com/rest-versioning)

### Security
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Python Security Best Practices](https://python.readthedocs.io/en/stable/library/security_warnings.html)

### Testing
- [pytest Documentation](https://docs.pytest.org/)
- [Flask Testing](https://flask.palletsprojects.com/en/2.3.x/testing/)

---

*This checklist should be used for all code reviews in the Chrysalis API services. Customize as needed for specific PRs.*

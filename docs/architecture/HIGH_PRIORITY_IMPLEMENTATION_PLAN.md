# High & Medium Priority Implementation Plan

**Date**: 2026-01-09
**Status**: Planning → Implementation

## Task 1: Requirements Analysis & Acceptance Criteria

### Batch 1: Foundation Layer (Independent, Parallel)

#### 1.1 Rate Limiting Headers Middleware

**Requirements:**
- Add `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers to all API responses
- Integrate with existing rate limiting logic (token bucket from `scripts/rate_limiter.py`)
- Support per-endpoint rate limits (configurable)
- Support per-client/IP rate limiting
- Return 429 status code when rate limit exceeded
- Include `Retry-After` header in 429 responses

**Acceptance Criteria:**
- ✅ All API responses include rate limit headers
- ✅ Rate limiting enforced per IP/client
- ✅ Different limits configurable per endpoint
- ✅ 429 responses include proper error format and retry-after
- ✅ Rate limit state persisted across requests (in-memory for now, Redis-ready)
- ✅ Tests verify headers present and limits enforced

**Dependencies:** None

**Interdependencies:** Can be implemented independently

---

#### 1.2 Request Validation with Pydantic Models

**Requirements:**
- Add Pydantic models for common request types (Agent, Knowledge, Skill creation/update)
- Integrate Pydantic validation with existing RequestValidator
- Maintain backward compatibility with current validation
- Provide detailed validation error messages with field paths
- Support nested validation and custom validators

**Acceptance Criteria:**
- ✅ Pydantic models for Agent, Knowledge, Skill requests
- ✅ Validation errors include field paths and detailed messages
- ✅ Existing endpoints work without changes (backward compatible)
- ✅ New endpoints can use Pydantic validation
- ✅ Tests verify validation works correctly
- ✅ Performance impact minimal (<10ms overhead)

**Dependencies:** None (but improves quality of future work)

**Interdependencies:** Benefits Batch 2 & 3

---

#### 1.3 Authentication Testing Fixtures

**Requirements:**
- Create test fixtures that work without full Flask setup
- Mock authentication decorators for unit tests
- Provide test utilities for integration tests
- Support testing auth logic independently

**Acceptance Criteria:**
- ✅ Test fixtures work without Flask installed
- ✅ Can test authentication logic in isolation
- ✅ Integration tests can mock authentication easily
- ✅ All existing tests continue to pass
- ✅ New tests demonstrate usage patterns

**Dependencies:** None

**Interdependencies:** Improves quality of all test suites

---

### Batch 2: Data Access Layer (Depends on Batch 1)

#### 2.1 Pagination Improvements

**Requirements:**
- Ensure all list endpoints (`GET /api/v1/agents`, `/knowledge`, `/skills`) use pagination
- Add cursor-based pagination option (in addition to page-based)
- Improve pagination metadata (total, has_next, has_prev, next_cursor)
- Support default pagination when not specified

**Acceptance Criteria:**
- ✅ All list endpoints return paginated results
- ✅ Cursor-based pagination works alongside page-based
- ✅ Pagination metadata includes all required fields
- ✅ Default pagination applies (page=1, per_page=20)
- ✅ Tests verify pagination behavior
- ✅ Performance: pagination adds <5ms overhead

**Dependencies:** None (but benefits from 1.2 Request Validation)

**Interdependencies:** Prerequisite for 2.2 Filtering/Sorting

---

#### 2.2 Filtering and Sorting

**Requirements:**
- Parse query parameters for filtering: `?status=active&created_after=2024-01-01`
- Parse sorting: `?sort=created_at&order=desc`
- Validate filter/sort parameters
- Support multiple filters (AND logic)
- Support multiple sort fields
- Return validation errors for invalid filters

**Acceptance Criteria:**
- ✅ Filter parameters parsed and validated
- ✅ Sort parameters parsed and validated
- ✅ Invalid filters return 422 with detailed errors
- ✅ Filters work with pagination
- ✅ Performance: filtering adds <10ms overhead
- ✅ Tests cover all filter/sort scenarios

**Dependencies:** Requires 2.1 Pagination Improvements

**Interdependencies:** Builds on pagination infrastructure

---

### Batch 3: Service Layer (Depends on Batch 1)

#### 3.1 TypeScript Service Migrations

**Requirements:**
- Apply shared API core to GroundingService, ProjectionService, SkillForgeService
- Ensure consistent error handling across all TypeScript services
- Use shared models from `shared/api-core`
- Standardize response formats

**Acceptance Criteria:**
- ✅ All TypeScript services use shared API core
- ✅ Consistent error handling across services
- ✅ All services return standardized responses
- ✅ Tests verify consistency
- ✅ No breaking changes to existing clients

**Dependencies:** None (but benefits from 1.2 Request Validation patterns)

**Interdependencies:** Independent, but should coordinate with 3.2

---

#### 3.2 Response Consistency Audit

**Requirements:**
- Audit all endpoints for consistent response format
- Ensure all use `APIResponse.success_response()` / `error_response()`
- Standardize error response structure
- Fix any inconsistencies found

**Acceptance Criteria:**
- ✅ All endpoints use standardized response format
- ✅ All errors use APIError structure
- ✅ Response metadata consistent (request_id, timestamp, version)
- ✅ Documentation updated with examples
- ✅ Tests verify consistency

**Dependencies:** Requires Batch 1 complete

**Interdependencies:** Should be done alongside 3.1

---

### Batch 4: Documentation Layer (Depends on All Batches)

#### 4.1 API Documentation (OpenAPI/Swagger)

**Requirements:**
- Generate OpenAPI 3.0 spec from Flask routes
- Include all endpoints with request/response schemas
- Document authentication requirements
- Include examples for all endpoints
- Serve docs at `/api/docs` endpoint

**Acceptance Criteria:**
- ✅ OpenAPI spec generated and validated
- ✅ All endpoints documented
- ✅ Request/response schemas match implementation
- ✅ Authentication documented
- ✅ Examples provided for common use cases
- ✅ Docs accessible via web UI

**Dependencies:** Requires all implementations complete

**Interdependencies:** Final step after all functionality implemented

---

## Task 2: Technical Design

### Architecture Alignment

**Shared Libraries:**
- Python: `shared/api_core/` - Already established pattern
- TypeScript: `shared/api-core/` - Already established pattern

**Rate Limiting Design:**
```python
# shared/api_core/rate_limiting.py
class RateLimitConfig:
    limit: int = 1000  # requests per window
    window: int = 3600  # seconds
    per_ip: bool = True
    per_endpoint: bool = False

def create_rate_limit_middleware(
    app: Flask,
    config: Dict[str, RateLimitConfig] = None
) -> None:
    """Create rate limiting middleware with headers."""
```

**Pydantic Integration Design:**
```python
# shared/api_core/schemas/__init__.py
from pydantic import BaseModel, Field

class AgentCreateRequest(BaseModel):
    agent_id: str = Field(..., min_length=1, max_length=100)
    role_model: RoleModelRequest
    deepening_cycles: int = Field(default=0, ge=0, le=11)

    class Config:
        extra = "forbid"  # Strict validation
```

**Maintainability:**
- Keep shared libraries framework-agnostic where possible
- Use dependency injection for rate limiting storage (in-memory → Redis)
- Make Pydantic optional (graceful fallback to RequestValidator)

**Security:**
- Rate limiting prevents abuse
- Pydantic validation prevents injection attacks
- Input sanitization via validation

**Scalability:**
- Rate limiting storage pluggable (in-memory → Redis → distributed)
- Pagination supports large datasets
- Filtering optimized with indexes (future: database indexes)

---

## Implementation Order

1. **Batch 1** (Parallel - Foundation)
   - Rate Limiting Headers (1-2 hours)
   - Request Validation (2-3 hours)
   - Auth Testing (1 hour)

2. **Batch 2** (Sequential - Data Layer)
   - Pagination Improvements (2 hours)
   - Filtering/Sorting (3-4 hours)

3. **Batch 3** (Parallel - Service Layer)
   - TypeScript Migrations (4-5 hours)
   - Response Consistency Audit (2-3 hours)

4. **Batch 4** (Documentation)
   - OpenAPI Generation (3-4 hours)

**Total Estimated Time:** 20-24 hours

---

## Testing Strategy

### Unit Tests
- Each component tested in isolation
- Mock dependencies
- Test edge cases and error scenarios

### Integration Tests
- Test middleware integration
- Test request/response flow
- Verify header presence and correctness

### End-to-End Tests
- Full API request flow
- Rate limiting enforcement
- Validation error handling

### Manual Verification
- API response inspection
- Rate limit behavior under load
- Documentation completeness

---

## Quality Gates

Before merge:
- ✅ All tests passing
- ✅ Code coverage >80% for new code
- ✅ Linter passing (no errors)
- ✅ Documentation updated
- ✅ Changelog updated
- ✅ Performance impact <10% overhead
- ✅ Backward compatibility maintained

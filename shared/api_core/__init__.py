"""
Chrysalis Unified API Core Library (Python)

Provides shared request/response models, error handling, validation, authentication,
and Result type pattern for all Chrysalis backend services.

Usage:
    from shared.api_core import (
        APIResponse, APIError, ErrorCode, ErrorCategory,
        PaginationParams, PaginationMeta, FilterParams, SortParams,
        authenticate_request, validate_request,
        Result, Success, Failure, success, failure
    )
"""

from .models import (
    APIResponse,
    APIError,
    ErrorCode,
    ErrorCategory,
    PaginationParams,
    PaginationMeta,
    FilterParams,
    SortParams,
    ValidationError,
    RequestValidator,
)
from .result import (
    Result,
    Success,
    Failure,
    success,
    failure,
    validation_failure,
    not_found_failure,
    service_failure,
    map_result,
    map_error,
    flat_map,
    fold,
    get_or_else,
    sequence,
    traverse,
    zip_results,
    zip3_results,
    try_catch,
    try_catch_async,
    ResultDo,
    from_predicate,
    from_optional,
    from_exception,
)
from .filtering import apply_filter, apply_sorting
from .list_helpers import apply_list_filters, process_list_items, process_list_request
from .credentials import (
    ProviderCredentials,
    CredentialProvider,
    HeaderCredentialProvider,
    create_credentials_middleware,
    get_request_credentials,
    enforce_credentials,
)

# Flask-specific utilities (optional, requires Flask)
try:
    from .utils import json_response, error_response, require_resource_exists
    _UTILS_AVAILABLE = True
except (ImportError, RuntimeError):
    # Flask not available - stub functions
    _UTILS_AVAILABLE = False
    def json_response(*args, **kwargs):
        raise RuntimeError("Flask is required for json_response. Install Flask.")
    def error_response(*args, **kwargs):
        raise RuntimeError("Flask is required for error_response. Install Flask.")
    def require_resource_exists(*args, **kwargs):
        raise RuntimeError("Flask is required for require_resource_exists. Install Flask.")
from .validation import validate_request
# Conditional import for auth - requires Flask
try:
    from .auth import authenticate_request, get_current_user, require_auth, AuthContext
except ImportError:
    # If Flask not available, create stubs
    AuthContext = None
    def authenticate_request(*args, **kwargs):
        raise RuntimeError("Flask required for authentication. Install Flask to use authentication features.")
    def get_current_user():
        return None
    def require_auth(f):
        return f
from .middleware import (
    create_error_handler,
    create_auth_middleware,
    create_cors_middleware,
    create_request_id_middleware,
    create_response_headers_middleware,
    create_all_middleware,
)
from .rate_limiting import (
    RateLimitConfig,
    RateLimiter,
    create_rate_limit_middleware,
    get_rate_limit_info,
)

# Optional Pydantic schemas (gracefully handle if not installed)
try:
    from .schemas import (
        AgentCreateRequest,
        AgentUpdateRequest,
        AgentReplaceRequest,
        KnowledgeCreateRequest,
        KnowledgeUpdateRequest,
        KnowledgeReplaceRequest,
        SkillCreateRequest,
        SkillUpdateRequest,
        SkillReplaceRequest,
        RoleModelRequest,
        validate_with_pydantic,
    )
    PYDANTIC_AVAILABLE = True
except (ImportError, ModuleNotFoundError):
    # Pydantic not available - create stubs
    AgentCreateRequest = None
    AgentUpdateRequest = None
    AgentReplaceRequest = None
    KnowledgeCreateRequest = None
    KnowledgeUpdateRequest = None
    KnowledgeReplaceRequest = None
    SkillCreateRequest = None
    SkillUpdateRequest = None
    SkillReplaceRequest = None
    RoleModelRequest = None
    PYDANTIC_AVAILABLE = False

    def validate_with_pydantic(*args, **kwargs):
        raise RuntimeError("Pydantic is required for request validation. Install with: pip install pydantic")

__version__ = "1.0.0"

__all__ = [
    # Models
    "APIResponse",
    "APIError",
    "ErrorCode",
    "ErrorCategory",
    "PaginationParams",
    "PaginationMeta",
    "FilterParams",
    "SortParams",
    "ValidationError",
    "RequestValidator",
    # Credentials
    "ProviderCredentials",
    "CredentialProvider",
    "HeaderCredentialProvider",
    "create_credentials_middleware",
    "get_request_credentials",
    "enforce_credentials",
    # Result Types (monadic error handling)
    "Result",
    "Success",
    "Failure",
    "success",
    "failure",
    "validation_failure",
    "not_found_failure",
    "service_failure",
    "map_result",
    "map_error",
    "flat_map",
    "fold",
    "get_or_else",
    "sequence",
    "traverse",
    "zip_results",
    "zip3_results",
    "try_catch",
    "try_catch_async",
    "ResultDo",
    "from_predicate",
    "from_optional",
    "from_exception",
    # Filtering and sorting
    "apply_filter",
    "apply_sorting",
    # List endpoint helpers
    "apply_list_filters",
    "process_list_items",
    "process_list_request",
    # Flask utilities (optional, requires Flask)
    "json_response",
    "error_response",
    "require_resource_exists",
    # Authentication
    "authenticate_request",
    "get_current_user",
    "require_auth",
    "AuthContext",
    # Validation
    "validate_request",
    # Middleware
    "create_error_handler",
    "create_auth_middleware",
    "create_cors_middleware",
    "create_request_id_middleware",
    "create_response_headers_middleware",
    "create_all_middleware",
    # Rate Limiting
    "RateLimitConfig",
    "RateLimiter",
    "create_rate_limit_middleware",
    "get_rate_limit_info",
    # Pydantic Schemas (optional)
    "AgentCreateRequest",
    "AgentUpdateRequest",
    "AgentReplaceRequest",
    "KnowledgeCreateRequest",
    "KnowledgeUpdateRequest",
    "KnowledgeReplaceRequest",
    "SkillCreateRequest",
    "SkillUpdateRequest",
    "SkillReplaceRequest",
    "RoleModelRequest",
    "validate_with_pydantic",
    "PYDANTIC_AVAILABLE",
]

# Test utilities (optional - can be imported separately)
try:
    from .test_utils import (
        MockRequest,
        MockResponse,
        create_mock_auth_context,
        AuthenticationFixture,
        mock_authenticate_request,
        pytest_auth_fixture,
        create_test_app_with_auth_bypass,
    )
    __all__.extend([
        "MockRequest",
        "MockResponse",
        "create_mock_auth_context",
        "AuthenticationFixture",
        "mock_authenticate_request",
        "pytest_auth_fixture",
        "create_test_app_with_auth_bypass",
    ])
except ImportError:
    # Test utils may have dependencies, that's ok
    pass

# OpenAPI/Swagger utilities (optional - requires flasgger)
try:
    from .swagger import create_swagger_config, setup_swagger
    from .openapi import get_base_openapi_spec, create_openapi_endpoint_spec
    __all__.extend([
        "create_swagger_config",
        "setup_swagger",
        "get_base_openapi_spec",
        "create_openapi_endpoint_spec",
    ])
except ImportError:
    # flasgger may not be installed, that's ok
    pass

# Monitoring (optional - may not be available if Flask is not installed)
try:
    from .monitoring import (
        HealthStatus,
        HealthCheck,
        HealthRegistry,
        create_health_check_middleware,
        register_health_check,
        MetricsCollector,
        create_metrics_middleware,
    )
    __all__.extend([
        'HealthStatus',
        'HealthCheck',
        'HealthRegistry',
        'create_health_check_middleware',
        'register_health_check',
        'MetricsCollector',
        'create_metrics_middleware',
    ])
except (ImportError, RuntimeError):
    # Monitoring not available (Flask not installed)
    pass

# Security headers (optional - may not be available if Flask is not installed)
try:
    from .security_headers import (
        SecurityHeadersConfig,
        create_security_headers_middleware,
    )
    __all__.extend([
        'SecurityHeadersConfig',
        'create_security_headers_middleware',
    ])
except (ImportError, RuntimeError):
    # Security headers not available (Flask not installed)
    pass

# Error tracking (optional - may not be available if Flask is not installed)
try:
    from .error_tracking import (
        ErrorTrackingConfig,
        create_error_tracking_middleware,
        capture_message,
        capture_exception,
    )
    __all__.extend([
        'ErrorTrackingConfig',
        'create_error_tracking_middleware',
        'capture_message',
        'capture_exception',
    ])
except (ImportError, RuntimeError):
    # Error tracking not available (Flask not installed)
    pass

# Audit logging (optional - may not be available if Flask is not installed)
try:
    from .audit_logging import (
        AuditEvent,
        AuditLogger,
        create_audit_logging_middleware,
        get_audit_logger,
    )
    __all__.extend([
        'AuditEvent',
        'AuditLogger',
        'create_audit_logging_middleware',
        'get_audit_logger',
    ])
except (ImportError, RuntimeError):
    # Audit logging not available (Flask not installed)
    pass

# Circuit breaker (for resilient downstream calls)
try:
    from .circuit_breaker import (
        CircuitBreaker,
        CircuitBreakerConfig,
        CircuitBreakerError,
        CircuitBreakerRegistry,
        CircuitState,
        circuit_breaker,
        call_with_circuit_breaker,
    )
    __all__.extend([
        'CircuitBreaker',
        'CircuitBreakerConfig',
        'CircuitBreakerError',
        'CircuitBreakerRegistry',
        'CircuitState',
        'circuit_breaker',
        'call_with_circuit_breaker',
    ])
except (ImportError, RuntimeError):
    # Circuit breaker dependencies not available
    pass

# Retry logic
try:
    from .retry import (
        RetryConfig,
        RetryExhaustedError,
        retry,
        retry_call,
        retry_async,
        retry_with_circuit_breaker,
    )
    __all__.extend([
        'RetryConfig',
        'RetryExhaustedError',
        'retry',
        'retry_call',
        'retry_async',
        'retry_with_circuit_breaker',
    ])
except (ImportError, RuntimeError):
    # Retry dependencies not available
    pass

# JSON Schema validation
try:
    from .json_schema import (
        validate_json_schema,
        validate_request_schema,
        get_all_validation_errors,
        register_schema,
        get_schema,
        list_schemas,
        SCHEMA_REGISTRY,
        SchemaValidationError,
    )
    __all__.extend([
        'validate_json_schema',
        'validate_request_schema',
        'get_all_validation_errors',
        'register_schema',
        'get_schema',
        'list_schemas',
        'SCHEMA_REGISTRY',
        'SchemaValidationError',
    ])
except (ImportError, RuntimeError):
    # JSON Schema dependencies not available
    pass

# Caching
try:
    from .caching import (
        CacheConfig,
        CacheEntry,
        InMemoryCache,
        get_cache,
        generate_cache_key,
        cached,
        cache_response,
        invalidate_cache_pattern,
    )
    __all__.extend([
        'CacheConfig',
        'CacheEntry',
        'InMemoryCache',
        'get_cache',
        'generate_cache_key',
        'cached',
        'cache_response',
        'invalidate_cache_pattern',
    ])
except (ImportError, RuntimeError):
    # Caching dependencies not available
    pass

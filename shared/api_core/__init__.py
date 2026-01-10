"""
Chrysalis Unified API Core Library (Python)

Provides shared request/response models, error handling, validation, and authentication
for all Chrysalis backend services.

Usage:
    from shared.api_core import (
        APIResponse, APIError, ErrorCode, ErrorCategory,
        PaginationParams, PaginationMeta, FilterParams, SortParams,
        authenticate_request, validate_request
    )
"""

from .models import (
    APIResponse,
    APIError,
    ErrorCode,
    ErrorCategory,
    SuccessResponse,
    ErrorResponse,
    PaginationParams,
    PaginationMeta,
    FilterParams,
    SortParams,
)
from .auth import authenticate_request, get_current_user, require_auth, AuthContext
from .validation import validate_request, ValidationError, RequestValidator
from .middleware import (
    create_error_handler,
    create_auth_middleware,
    create_cors_middleware,
    create_request_id_middleware,
    create_response_headers_middleware,
    create_all_middleware,
)

__version__ = "1.0.0"

__all__ = [
    # Models
    "APIResponse",
    "APIError",
    "ErrorCode",
    "ErrorCategory",
    "SuccessResponse",
    "ErrorResponse",
    "PaginationParams",
    "PaginationMeta",
    "FilterParams",
    "SortParams",
    # Authentication
    "authenticate_request",
    "get_current_user",
    "require_auth",
    "AuthContext",
    # Validation
    "validate_request",
    "ValidationError",
    "RequestValidator",
    # Middleware
    "create_error_handler",
    "create_auth_middleware",
    "create_cors_middleware",
    "create_request_id_middleware",
    "create_response_headers_middleware",
    "create_all_middleware",
]

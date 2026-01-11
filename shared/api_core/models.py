"""
Standard request/response models for Chrysalis API.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from uuid import uuid4


class ErrorCategory(str, Enum):
    """Error category taxonomy."""
    VALIDATION_ERROR = "VALIDATION_ERROR"
    AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR"
    AUTHORIZATION_ERROR = "AUTHORIZATION_ERROR"
    NOT_FOUND_ERROR = "NOT_FOUND_ERROR"
    CONFLICT_ERROR = "CONFLICT_ERROR"
    RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR"
    SERVICE_ERROR = "SERVICE_ERROR"
    UPSTREAM_ERROR = "UPSTREAM_ERROR"


class ErrorCode(str, Enum):
    """Specific error codes."""
    # Validation
    REQUIRED_FIELD = "VALIDATION_ERROR.REQUIRED_FIELD"
    INVALID_FORMAT = "VALIDATION_ERROR.INVALID_FORMAT"
    INVALID_TYPE = "VALIDATION_ERROR.INVALID_TYPE"
    INVALID_RANGE = "VALIDATION_ERROR.INVALID_RANGE"

    # Authentication
    INVALID_TOKEN = "AUTHENTICATION_ERROR.INVALID_TOKEN"
    EXPIRED_TOKEN = "AUTHENTICATION_ERROR.EXPIRED_TOKEN"
    MISSING_AUTH = "AUTHENTICATION_ERROR.MISSING_AUTHORIZATION"

    # Authorization
    INSUFFICIENT_PERMISSIONS = "AUTHORIZATION_ERROR.INSUFFICIENT_PERMISSIONS"
    FORBIDDEN_RESOURCE = "AUTHORIZATION_ERROR.FORBIDDEN_RESOURCE"

    # Not Found
    RESOURCE_NOT_FOUND = "NOT_FOUND_ERROR.RESOURCE_NOT_FOUND"
    ENDPOINT_NOT_FOUND = "NOT_FOUND_ERROR.ENDPOINT_NOT_FOUND"

    # Conflict
    DUPLICATE_RESOURCE = "CONFLICT_ERROR.DUPLICATE_RESOURCE"
    RESOURCE_CONFLICT = "CONFLICT_ERROR.RESOURCE_CONFLICT"

    # Rate Limit
    TOO_MANY_REQUESTS = "RATE_LIMIT_ERROR.TOO_MANY_REQUESTS"

    # Service
    INTERNAL_ERROR = "SERVICE_ERROR.INTERNAL_ERROR"
    SERVICE_UNAVAILABLE = "SERVICE_ERROR.SERVICE_UNAVAILABLE"

    # Upstream
    UPSTREAM_ERROR = "UPSTREAM_ERROR.SERVICE_UNAVAILABLE"
    UPSTREAM_TIMEOUT = "UPSTREAM_ERROR.SERVICE_TIMEOUT"


@dataclass
class ErrorDetail:
    """Detailed error information."""
    field: Optional[str] = None
    code: Optional[str] = None
    message: str = ""
    path: Optional[List[str]] = None


@dataclass
class APIError:
    """Standard API error structure."""
    code: ErrorCode
    message: str
    category: ErrorCategory
    details: List[ErrorDetail] = field(default_factory=list)
    request_id: Optional[str] = None
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    documentation_url: Optional[str] = None
    retry_after: Optional[int] = None
    suggestions: List[str] = field(default_factory=list)

    @classmethod
    def from_exception(
        cls,
        exc: Exception,
        code: Optional[ErrorCode] = None,
        category: Optional[ErrorCategory] = None,
        request_id: Optional[str] = None,
    ) -> "APIError":
        """Create APIError from exception."""
        if isinstance(exc, ValidationError):
            error_code = code or ErrorCode.REQUIRED_FIELD
            error_category = category or ErrorCategory.VALIDATION_ERROR
            return cls(
                code=error_code,
                message=str(exc),
                category=error_category,
                details=[ErrorDetail(field=exc.field, message=str(exc))],
                request_id=request_id,
            )

        error_code = code or ErrorCode.INTERNAL_ERROR
        error_category = category or ErrorCategory.SERVICE_ERROR
        return cls(
            code=error_code,
            message=str(exc),
            category=error_category,
            request_id=request_id,
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "code": self.code.value,
            "message": self.message,
            "category": self.category.value,
            "details": [
                {
                    "field": d.field,
                    "code": d.code,
                    "message": d.message,
                    "path": d.path,
                }
                for d in self.details
            ],
            "request_id": self.request_id,
            "timestamp": self.timestamp,
            "documentation_url": self.documentation_url,
            "retry_after": self.retry_after,
            "suggestions": self.suggestions,
        }


@dataclass
class PaginationParams:
    """Pagination query parameters."""
    page: int = 1
    per_page: int = 20

    def __post_init__(self):
        """Validate pagination parameters."""
        self.page = max(1, self.page)
        self.per_page = max(1, min(100, self.per_page))  # Limit to 100 max

    @classmethod
    def from_request(cls, request) -> "PaginationParams":
        """Extract pagination from Flask request."""
        try:
            page = int(request.args.get("page", 1))
        except (ValueError, TypeError):
            page = 1

        try:
            per_page = int(request.args.get("per_page", 20))
        except (ValueError, TypeError):
            per_page = 20

        return cls(page=page, per_page=per_page)

    @property
    def offset(self) -> int:
        """Calculate offset for database queries."""
        return (self.page - 1) * self.per_page


@dataclass
class PaginationMeta:
    """Pagination metadata for responses."""
    page: int
    per_page: int
    total: int
    total_pages: int
    has_next: bool
    has_prev: bool

    @classmethod
    def create(cls, pagination: PaginationParams, total: int) -> "PaginationMeta":
        """Create pagination metadata."""
        total_pages = (total + pagination.per_page - 1) // pagination.per_page if total > 0 else 0
        return cls(
            page=pagination.page,
            per_page=pagination.per_page,
            total=total,
            total_pages=total_pages,
            has_next=pagination.page < total_pages,
            has_prev=pagination.page > 1,
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "page": self.page,
            "per_page": self.per_page,
            "total": self.total,
            "total_pages": self.total_pages,
            "has_next": self.has_next,
            "has_prev": self.has_prev,
        }


@dataclass
class FilterParams:
    """Filter query parameters."""
    filters: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_request(cls, request) -> "FilterParams":
        """Extract filters from Flask request."""
        filters = {}
        for key, value in request.args.items():
            if key.startswith("filter["):
                # Parse filter[field] or filter[field][op]
                field_match = key[7:-1].split("][")
                if len(field_match) == 1:
                    filters[field_match[0]] = value
                elif len(field_match) == 2:
                    field, op = field_match
                    if field not in filters:
                        filters[field] = {}
                    filters[field][op] = value
        return cls(filters=filters)


@dataclass
class SortParams:
    """Sort query parameters."""
    sort_fields: List[str] = field(default_factory=list)
    order: str = "asc"

    @classmethod
    def from_request(cls, request) -> "SortParams":
        """Extract sort from Flask request."""
        sort_str = request.args.get("sort", "")
        if not sort_str:
            return cls()

        fields = [f.strip() for f in sort_str.split(",")]
        return cls(sort_fields=fields)

    def to_sql_order_by(self) -> List[str]:
        """Convert to SQL ORDER BY clauses."""
        result = []
        for field in self.sort_fields:
            if field.startswith("-"):
                result.append(f"{field[1:]} DESC")
            else:
                result.append(f"{field} ASC")
        return result


@dataclass
class APIResponse:
    """Base API response structure."""
    success: bool
    data: Optional[Any] = None
    error: Optional[APIError] = None
    meta: Optional[Dict[str, Any]] = None

    @classmethod
    def success_response(
        cls,
        data: Any,
        request_id: Optional[str] = None,
        pagination: Optional[PaginationMeta] = None,
        version: str = "v1",
    ) -> "APIResponse":
        """Create success response."""
        # Try to get request_id from Flask g if not provided
        if request_id is None:
            try:
                from flask import g
                request_id = getattr(g, "request_id", None)
            except (RuntimeError, ImportError):
                # Not in Flask context or Flask not available
                pass

        meta = {
            "request_id": request_id or str(uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "version": version,
        }

        if pagination:
            meta["pagination"] = pagination.to_dict()

        return cls(
            success=True,
            data=data,
            meta=meta,
        )

    @classmethod
    def error_response(
        cls,
        error: APIError,
        status_code: int = 400,
    ) -> tuple["APIResponse", int]:
        """Create error response with status code."""
        response = cls(
            success=False,
            error=error,
            meta={
                "request_id": error.request_id or str(uuid4()),
                "timestamp": error.timestamp,
            },
        )
        return response, status_code

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        result = {
            "success": self.success,
        }

        if self.data is not None:
            result["data"] = self.data

        if self.error:
            result["error"] = self.error.to_dict()

        if self.meta:
            result["meta"] = self.meta

        return result


class ValidationError(Exception):
    """Validation error with field information."""

    def __init__(self, message: str, field: Optional[str] = None, code: Optional[str] = None):
        super().__init__(message)
        self.message = message
        self.field = field
        self.code = code or ErrorCode.REQUIRED_FIELD.value

    def __str__(self):
        """Return error message."""
        return self.message


class RequestValidator:
    """Request validation helper."""

    @staticmethod
    def require_field(data: Dict[str, Any], field: str, field_name: Optional[str] = None) -> Any:
        """Require field in request data."""
        if field not in data or data[field] is None:
            raise ValidationError(
                f"Field '{field_name or field}' is required",
                field=field,
                code=ErrorCode.REQUIRED_FIELD.value,
            )
        return data[field]

    @staticmethod
    def require_string(data: Dict[str, Any], field: str, min_length: Optional[int] = None, max_length: Optional[int] = None) -> str:
        """Require string field with length validation."""
        value = RequestValidator.require_field(data, field)
        if not isinstance(value, str):
            raise ValidationError(
                f"Field '{field}' must be a string",
                field=field,
                code=ErrorCode.INVALID_TYPE.value,
            )
        if min_length is not None and len(value) < min_length:
            raise ValidationError(
                f"Field '{field}' must be at least {min_length} characters",
                field=field,
                code=ErrorCode.INVALID_RANGE.value,
            )
        if max_length is not None and len(value) > max_length:
            raise ValidationError(
                f"Field '{field}' must be at most {max_length} characters",
                field=field,
                code=ErrorCode.INVALID_RANGE.value,
            )
        return value

    @staticmethod
    def require_integer(data: Dict[str, Any], field: str, min_value: Optional[int] = None, max_value: Optional[int] = None) -> int:
        """Require integer field with range validation."""
        value = RequestValidator.require_field(data, field)
        try:
            value = int(value)
        except (ValueError, TypeError):
            raise ValidationError(
                f"Field '{field}' must be an integer",
                field=field,
                code=ErrorCode.INVALID_TYPE.value,
            )
        if min_value is not None and value < min_value:
            raise ValidationError(
                f"Field '{field}' must be at least {min_value}",
                field=field,
                code=ErrorCode.INVALID_RANGE.value,
            )
        if max_value is not None and value > max_value:
            raise ValidationError(
                f"Field '{field}' must be at most {max_value}",
                field=field,
                code=ErrorCode.INVALID_RANGE.value,
            )
        return value

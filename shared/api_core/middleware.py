"""
Flask middleware for error handling, CORS, request tracking, etc.
"""

import logging
import uuid
from functools import wraps
from typing import Optional, Dict, Any

try:
    from flask import jsonify, request, g, Flask
    FLASK_AVAILABLE = True
except ImportError:
    FLASK_AVAILABLE = False
    # Stub Flask types for type checking
    Flask = None
    jsonify = None
    request = None
    g = None

from .models import APIResponse, APIError, ErrorCode, ErrorCategory, ValidationError

logger = logging.getLogger(__name__)


def create_error_handler(app):
    """Create error handler for Flask app."""
    if not FLASK_AVAILABLE:
        raise RuntimeError("Flask required for error handlers. Install Flask.")

    @app.errorhandler(ValidationError)
    def handle_validation_error(e):
        """Handle validation errors."""
        error = APIError.from_exception(e, category=ErrorCategory.VALIDATION_ERROR)
        response, status = APIResponse.error_response(error, status_code=422)
        return jsonify(response.to_dict()), status

    @app.errorhandler(APIError)
    def handle_api_error(e):
        """Handle API errors."""
        status_code = 400
        if e.category == ErrorCategory.AUTHENTICATION_ERROR:
            status_code = 401
        elif e.category == ErrorCategory.AUTHORIZATION_ERROR:
            status_code = 403
        elif e.category == ErrorCategory.NOT_FOUND_ERROR:
            status_code = 404
        elif e.category == ErrorCategory.CONFLICT_ERROR:
            status_code = 409
        elif e.category == ErrorCategory.RATE_LIMIT_ERROR:
            status_code = 429
        elif e.category == ErrorCategory.SERVICE_ERROR:
            status_code = 500
        elif e.category == ErrorCategory.UPSTREAM_ERROR:
            status_code = 502

        response, status = APIResponse.error_response(e, status_code=status_code)
        return jsonify(response.to_dict()), status

    @app.errorhandler(404)
    def handle_not_found(e):
        """Handle 404 errors."""
        error = APIError(
            code=ErrorCode.ENDPOINT_NOT_FOUND,
            message=f"Endpoint not found: {request.path}",
            category=ErrorCategory.NOT_FOUND_ERROR,
        )
        response, status = APIResponse.error_response(error, status_code=404)
        return jsonify(response.to_dict()), status

    @app.errorhandler(500)
    def handle_internal_error(e):
        """Handle internal server errors."""
        logger.exception("Internal server error")
        error = APIError(
            code=ErrorCode.INTERNAL_ERROR,
            message="Internal server error",
            category=ErrorCategory.SERVICE_ERROR,
        )
        response, status = APIResponse.error_response(error, status_code=500)
        return jsonify(response.to_dict()), status

    @app.errorhandler(Exception)
    def handle_generic_error(e):
        """Handle generic exceptions."""
        logger.exception("Unhandled exception")
        error = APIError(
            code=ErrorCode.INTERNAL_ERROR,
            message=str(e) or "Internal server error",
            category=ErrorCategory.SERVICE_ERROR,
        )
        response, status = APIResponse.error_response(error, status_code=500)
        return jsonify(response.to_dict()), status


def create_auth_middleware(app):
    """Create authentication middleware (optional, can use decorators instead)."""
    @app.before_request
    def authenticate():
        """Authenticate request if endpoint requires it."""
        # Skip authentication for public endpoints
        if request.endpoint in ["health", "docs", "openapi"]:
            return


def create_request_id_middleware(app):
    """Create request ID tracking middleware."""
    if not FLASK_AVAILABLE:
        raise RuntimeError("Flask required for request ID middleware. Install Flask.")

    @app.before_request
    def extract_request_id():
        """Extract or generate request ID from headers."""
        from flask import request, g
        # Extract from X-Request-ID header if present
        request_id = request.headers.get("X-Request-ID") or f"req_{uuid.uuid4().hex[:16]}"

        # Store in Flask g for access in handlers
        g.request_id = request_id

        # Log request with request ID
        logger.debug(f"Request [{request_id}]: {request.method} {request.path}")

    @app.after_request
    def add_request_id_header(response):
        """Add request ID to response headers."""
        from flask import g
        request_id = getattr(g, "request_id", None)
        if request_id:
            response.headers["X-Request-ID"] = request_id
        return response


def create_response_headers_middleware(app, api_version: str = "v1"):
    """Create middleware to add standard response headers."""
    if not FLASK_AVAILABLE:
        raise RuntimeError("Flask required for response headers middleware. Install Flask.")

    @app.after_request
    def add_standard_headers(response):
        """Add standard API response headers."""
        from flask import request, g
        # API Version
        response.headers["X-API-Version"] = api_version

        # Request ID (if not already added)
        if "X-Request-ID" not in response.headers:
            request_id = getattr(g, "request_id", None)
            if request_id:
                response.headers["X-Request-ID"] = request_id

        # Content Type (ensure JSON)
        if request.path.startswith("/api/") and "application/json" not in response.headers.get("Content-Type", ""):
            response.headers["Content-Type"] = "application/json"

        return response


def create_cors_middleware(app, allowed_origins: Optional[list] = None):
    """
    Create CORS middleware with configurable origins.

    Args:
        app: Flask application
        allowed_origins: List of allowed origins. If None or empty, reads from
                        CORS_ALLOWED_ORIGINS environment variable. If that's also
                        not set, defaults to localhost only in development.

    Security Note:
        NEVER use "*" (wildcard) in production. Always specify explicit origins.
        The wildcard origin is only acceptable for local development.
    """
    import os

    if not FLASK_AVAILABLE:
        raise RuntimeError("Flask required for CORS middleware. Install Flask.")

    # Determine allowed origins from config or environment
    if not allowed_origins:
        env_origins = os.environ.get("CORS_ALLOWED_ORIGINS", "")
        if env_origins:
            allowed_origins = [o.strip() for o in env_origins.split(",") if o.strip()]
        else:
            # Default to localhost for development safety
            # Production deployments MUST set CORS_ALLOWED_ORIGINS
            is_production = os.environ.get("FLASK_ENV") == "production" or \
                           os.environ.get("NODE_ENV") == "production"
            if is_production:
                logger.warning(
                    "CORS_ALLOWED_ORIGINS not set in production. "
                    "Defaulting to empty (blocking all cross-origin requests). "
                    "Set CORS_ALLOWED_ORIGINS environment variable."
                )
                allowed_origins = []
            else:
                allowed_origins = ["http://localhost:3000", "http://localhost:8080", "http://127.0.0.1:3000"]

    try:
        from flask_cors import CORS
        CORS(app, resources={
            r"/api/*": {
                "origins": allowed_origins or [],
                "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
                "allow_headers": ["Content-Type", "Authorization", "X-Request-ID", "X-Client-Version"],
            }
        })
    except ImportError:
        # Fallback CORS headers if flask-cors not installed
        @app.after_request
        def add_cors_headers(response):
            """Add CORS headers to response."""
            from flask import request
            origin = request.headers.get("Origin", "")
            if origin in allowed_origins:
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
                response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Request-ID, X-Client-Version"
            return response


def create_all_middleware(
    app,
    api_version: str = "v1",
    enable_rate_limiting: bool = True,
    rate_limit_config: Optional[Dict[str, Any]] = None
):
    """
    Create all standard middleware in correct order.

    Args:
        app: Flask application
        api_version: API version string
        enable_rate_limiting: Whether to enable rate limiting
        rate_limit_config: Optional rate limit configuration
    """
    if not FLASK_AVAILABLE:
        raise RuntimeError("Flask required for middleware. Install Flask.")

    # Order matters:
    # 1. Request ID (before_request - must be first so rate limit errors have request IDs)
    # 2. Rate limiting (before_request - needs request ID from previous middleware)
    # 3. CORS (after_request - runs first)
    # 4. Response headers (after_request - runs second)

    # Request ID must come first so rate limit errors can include it
    create_request_id_middleware(app)

    if enable_rate_limiting:
        try:
            from .rate_limiting import create_rate_limit_middleware, RateLimitConfig

            if rate_limit_config:
                default_config = RateLimitConfig(**rate_limit_config)
            else:
                # Use sensible defaults
                default_config = RateLimitConfig(
                    limit=1000,
                    window=3600,  # 1 hour
                    per_ip=True,
                    per_endpoint=False
                )
            create_rate_limit_middleware(app, default_config=default_config)
        except ImportError:
            logger.warning("Rate limiting not available - skipping")

    create_cors_middleware(app)
    create_response_headers_middleware(app, api_version=api_version)

    # Health checks and metrics (optional, at end)
    try:
        from .monitoring import create_health_check_middleware, create_metrics_middleware
        create_health_check_middleware(app)
        create_metrics_middleware(app)
    except (ImportError, RuntimeError):
        # Monitoring not available or Flask not installed
        pass

    # Security headers (should be after all other middleware)
    try:
        from .security_headers import create_security_headers_middleware, SecurityHeadersConfig
        create_security_headers_middleware(app, SecurityHeadersConfig())
    except (ImportError, RuntimeError):
        # Security headers not available or Flask not installed
        pass

    # Error tracking (should be last, after all middleware setup)
    try:
        from .error_tracking import create_error_tracking_middleware, ErrorTrackingConfig
        create_error_tracking_middleware(app, ErrorTrackingConfig())
    except (ImportError, RuntimeError):
        # Error tracking not available or Flask not installed
        pass

    # Audit logging (for security events)
    try:
        from .audit_logging import create_audit_logging_middleware
        create_audit_logging_middleware(app)
    except (ImportError, RuntimeError):
        # Audit logging not available or Flask not installed
        pass

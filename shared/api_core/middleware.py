"""
Flask middleware for error handling, CORS, request tracking, etc.
"""

import logging
import uuid
from functools import wraps
from flask import jsonify, request, g
from .models import APIResponse, APIError, ErrorCode, ErrorCategory, ValidationError

logger = logging.getLogger(__name__)


def create_error_handler(app):
    """Create error handler for Flask app."""

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
            message=str(e) if str(e) else "Internal server error",
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

        # Authentication handled by decorators
        pass


def create_request_id_middleware(app):
    """Create request ID tracking middleware."""
    @app.before_request
    def extract_request_id():
        """Extract or generate request ID from headers."""
        # Extract from X-Request-ID header if present
        request_id = request.headers.get("X-Request-ID")
        if not request_id:
            # Generate new request ID
            request_id = f"req_{uuid.uuid4().hex[:16]}"

        # Store in Flask g for access in handlers
        g.request_id = request_id

        # Log request with request ID
        logger.debug(f"Request [{request_id}]: {request.method} {request.path}")

    @app.after_request
    def add_request_id_header(response):
        """Add request ID to response headers."""
        request_id = getattr(g, "request_id", None)
        if request_id:
            response.headers["X-Request-ID"] = request_id
        return response


def create_response_headers_middleware(app, api_version: str = "v1"):
    """Create middleware to add standard response headers."""
    @app.after_request
    def add_standard_headers(response):
        """Add standard API response headers."""
        # API Version
        response.headers["X-API-Version"] = api_version

        # Request ID (if not already added)
        if "X-Request-ID" not in response.headers:
            request_id = getattr(g, "request_id", None)
            if request_id:
                response.headers["X-Request-ID"] = request_id

        # Content Type (ensure JSON)
        if request.path.startswith("/api/"):
            if "application/json" not in response.headers.get("Content-Type", ""):
                response.headers["Content-Type"] = "application/json"

        return response


def create_cors_middleware(app):
    """Create CORS middleware."""
    try:
        from flask_cors import CORS
        CORS(app, resources={
            r"/api/*": {
                "origins": "*",  # Configure appropriately for production
                "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
                "allow_headers": ["Content-Type", "Authorization", "X-Request-ID", "X-Client-Version"],
            }
        })
    except ImportError:
        # Fallback CORS headers if flask-cors not installed
        @app.after_request
        def add_cors_headers(response):
            """Add CORS headers to response."""
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Request-ID, X-Client-Version"
            return response


def create_all_middleware(app, api_version: str = "v1"):
    """Create all standard middleware in correct order."""
    # Order matters:
    # 1. Request ID (before_request)
    # 2. CORS (after_request - runs first)
    # 3. Response headers (after_request - runs second)

    create_request_id_middleware(app)
    create_cors_middleware(app)
    create_response_headers_middleware(app, api_version=api_version)

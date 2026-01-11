"""
Unified authentication framework for Chrysalis services.
"""

import os
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from functools import wraps

try:
    import jwt
except ImportError:
    # Fallback for environments without PyJWT
    jwt = None
    import logging
    logger = logging.getLogger(__name__)
    logger.warning("PyJWT not installed - JWT authentication will be unavailable")

# Flask is optional - only needed when using decorators/middleware
try:
    import flask
    FLASK_AVAILABLE = True
except ImportError:
    FLASK_AVAILABLE = False

from .models import APIError, ErrorCode, ErrorCategory


@dataclass
class AuthContext:
    """Authentication context for request."""
    user_id: Optional[str] = None
    token_type: str = "bearer"  # bearer, api_key, agent
    roles: List[str] = None
    permissions: List[str] = None

    def __post_init__(self):
        """Initialize default values."""
        if self.roles is None:
            self.roles = []
        if self.permissions is None:
            self.permissions = []

    def has_role(self, role: str) -> bool:
        """Check if context has role."""
        return role in self.roles

    def has_permission(self, permission: str) -> bool:
        """Check if context has permission."""
        return permission in self.permissions or "admin" in self.roles


# Configuration
JWT_SECRET = os.getenv("JWT_SECRET", os.getenv("CHRYSALIS_JWT_SECRET", "dev-secret-change-in-production"))
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", "24"))

# API Key validation (simple for now, can be enhanced with database)
API_KEYS: Dict[str, Dict[str, Any]] = {}
ADMIN_KEY_IDS = set(os.getenv("ADMIN_KEY_IDS", "").split(",") if os.getenv("ADMIN_KEY_IDS") else [])


def get_bearer_token(req) -> Optional[str]:
    """Extract Bearer token from request headers."""
    if not hasattr(req, 'headers'):
        return None
    auth_header = req.headers.get("Authorization", "")
    if not auth_header or not isinstance(auth_header, str) or not auth_header.startswith("Bearer "):
        return None
    return auth_header[7:].strip()


def verify_jwt_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify and decode JWT token."""
    if jwt is None:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def verify_api_key(key: str) -> Optional[Dict[str, Any]]:
    """Verify API key (format: keyId.secret)."""
    if "." not in key:
        return None

    key_id, secret = key.split(".", 1)

    # Check in-memory store (can be replaced with database)
    if key_id in API_KEYS:
        stored_key = API_KEYS[key_id]
        if stored_key["secret"] == secret:
            return {
                "key_id": key_id,
                "roles": stored_key.get("roles", ["service"]),
                "permissions": stored_key.get("permissions", []),
            }

    # Check admin keys from environment
    if key_id in ADMIN_KEY_IDS:
        return {
            "key_id": key_id,
            "roles": ["admin"],
            "permissions": ["*"],
        }

    return None


def authenticate_request(optional: bool = False, req=None) -> Optional[AuthContext]:
    """
    Authenticate request and return AuthContext.

    Args:
        optional: If True, return None instead of raising error when auth missing
        req: Request object (Flask request if not provided and Flask available)

    Returns:
        AuthContext if authenticated, None if optional and not authenticated

    Raises:
        APIError if authentication fails (unless optional=True)
    """
    if req is None:
        if FLASK_AVAILABLE:
            from flask import request as flask_request
            req = flask_request
        else:
            raise RuntimeError("Request object required when Flask is not available. Pass req parameter explicitly.")

    # Try Bearer token (JWT)
    bearer_token = get_bearer_token(req)
    if bearer_token:
        payload = verify_jwt_token(bearer_token)
        if payload:
            return AuthContext(
                user_id=payload.get("sub") or payload.get("user_id"),
                token_type="bearer",
                roles=payload.get("roles", []),
                permissions=payload.get("permissions", []),
            )

    # Try API key
    if bearer_token and "." in bearer_token:
        api_key_data = verify_api_key(bearer_token)
        if api_key_data:
            return AuthContext(
                user_id=api_key_data["key_id"],
                token_type="api_key",
                roles=api_key_data.get("roles", []),
                permissions=api_key_data.get("permissions", []),
            )

    # No authentication found
    if optional:
        return None

    raise APIError(
        code=ErrorCode.MISSING_AUTH,
        message="Authentication required",
        category=ErrorCategory.AUTHENTICATION_ERROR,
        documentation_url="https://docs.chrysalis.dev/auth",
    )


def get_current_user() -> Optional[AuthContext]:
    """Get current authenticated user from Flask g context."""
    if FLASK_AVAILABLE:
        from flask import g as flask_g
        return getattr(flask_g, "auth_context", None)
    return None


def require_auth(f):
    """Decorator to require authentication."""
    if not FLASK_AVAILABLE:
        raise RuntimeError("require_auth decorator requires Flask. Install Flask to use this decorator.")

    @wraps(f)
    def decorated_function(*args, **kwargs):
        from flask import request as flask_request, g as flask_g
        auth_context = authenticate_request(optional=False, req=flask_request)
        flask_g.auth_context = auth_context
        return f(*args, **kwargs)
    return decorated_function


def require_role(role: str):
    """Decorator to require specific role."""
    if not FLASK_AVAILABLE:
        raise RuntimeError("require_role decorator requires Flask. Install Flask to use this decorator.")

    def decorator(f):
        @wraps(f)
        @require_auth
        def decorated_function(*args, **kwargs):
            from flask import jsonify
            auth_context = get_current_user()
            if not auth_context or not auth_context.has_role(role):
                error = APIError(
                    code=ErrorCode.INSUFFICIENT_PERMISSIONS,
                    message=f"Role '{role}' required",
                    category=ErrorCategory.AUTHORIZATION_ERROR,
                )
                from .models import APIResponse
                response, status = APIResponse.error_response(error, status_code=403)
                return jsonify(response.to_dict()), status
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def require_permission(permission: str):
    """Decorator to require specific permission."""
    if not FLASK_AVAILABLE:
        raise RuntimeError("require_permission decorator requires Flask. Install Flask to use this decorator.")

    def decorator(f):
        @wraps(f)
        @require_auth
        def decorated_function(*args, **kwargs):
            from flask import jsonify
            auth_context = get_current_user()
            if not auth_context or not auth_context.has_permission(permission):
                error = APIError(
                    code=ErrorCode.INSUFFICIENT_PERMISSIONS,
                    message=f"Permission '{permission}' required",
                    category=ErrorCategory.AUTHORIZATION_ERROR,
                )
                from .models import APIResponse
                response, status = APIResponse.error_response(error, status_code=403)
                return jsonify(response.to_dict()), status
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def create_jwt_token(
    user_id: str,
    roles: Optional[List[str]] = None,
    permissions: Optional[List[str]] = None,
    expires_in_hours: int = JWT_EXPIRATION_HOURS,
) -> str:
    """Create JWT token for user."""
    if jwt is None:
        raise ImportError("PyJWT is required for JWT token creation. Install with: pip install PyJWT")
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "user_id": user_id,
        "roles": roles or [],
        "permissions": permissions or [],
        "iat": now,
        "exp": now + timedelta(hours=expires_in_hours),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def register_api_key(key_id: str, secret: str, roles: Optional[List[str]] = None, permissions: Optional[List[str]] = None) -> None:
    """Register API key in memory store (for testing/dev, use database in production)."""
    API_KEYS[key_id] = {
        "secret": secret,
        "roles": roles or ["service"],
        "permissions": permissions or [],
    }

"""
Unified authentication framework for Chrysalis services.
"""

import os
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from functools import wraps
import hmac

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
ENVIRONMENT = os.getenv("CHRYSALIS_ENV") or os.getenv("NODE_ENV") or "development"
if CONFIGURED_SECRET := os.getenv("JWT_SECRET") or os.getenv(
    "CHRYSALIS_JWT_SECRET"
):
    JWT_SECRET = CONFIGURED_SECRET

elif ENVIRONMENT == "production":
    raise RuntimeError("JWT_SECRET is required in production. Set JWT_SECRET or CHRYSALIS_JWT_SECRET environment variable.")
elif ENVIRONMENT == "development":
    import logging
    logging.warning("⚠️  Using insecure development JWT secret - DO NOT use in production! Set JWT_SECRET environment variable.")
    JWT_SECRET = "dev-secret-for-local-testing-only-change-in-production"
else:
    raise RuntimeError(f"JWT_SECRET must be explicitly configured for environment: {ENVIRONMENT}")
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
    """
    Verify and decode JWT token with algorithm validation.
    
    Args:
        token: JWT token string
        
    Returns:
        Decoded payload if valid, None otherwise
        
    Security:
        - Explicitly validates algorithm to prevent confusion attacks
        - Verifies expiration and issued-at timestamps
    """
    if jwt is None:
        return None
    try:
        # First, check the algorithm in the header without verifying signature
        header = jwt.get_unverified_header(token)

        # Enforce strict algorithm whitelist to prevent confusion attacks
        if header.get("alg") != JWT_ALGORITHM:
            import logging
            logging.warning(f"JWT algorithm mismatch: expected {JWT_ALGORITHM}, got {header.get('alg')}")
            return None

        return jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_iat": True,
                "require": ["exp", "iat"],  # Require expiration and issued-at
            },
        )
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def verify_api_key(key: str) -> Optional[Dict[str, Any]]:
    """
    Verify API key (format: keyId.secret).
    
    Args:
        key: API key string in format "keyId.secret"
        
    Returns:
        Dict with key_id, roles, and permissions if valid, None otherwise
    """
    # Input validation to prevent DoS and injection attacks
    if not key or not isinstance(key, str):
        return None
    
    # Length limits to prevent memory exhaustion
    if len(key) > 512:  # Reasonable maximum
        return None
    
    # Restrict to ASCII characters (alphanumeric + dot + underscore + hyphen)
    if not all(c.isalnum() or c in '._-' for c in key):
        return None
    
    # Verify format
    if "." not in key:
        return None
    
    parts = key.split(".", 1)
    if len(parts) != 2:
        return None
        
    key_id, secret = parts
    
    # Validate component lengths
    if len(key_id) > 64 or len(secret) > 256:
        return None
    
    # Prevent empty components
    if not key_id or not secret:
        return None

    # Check in-memory store (can be replaced with database)
    if key_id in API_KEYS:
        stored_key = API_KEYS[key_id]
        # Use constant-time comparison to prevent timing attacks
        if hmac.compare_digest(stored_key["secret"], secret):
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
        if payload := verify_jwt_token(bearer_token):
            return AuthContext(
                user_id=payload.get("sub") or payload.get("user_id"),
                token_type="bearer",
                roles=payload.get("roles", []),
                permissions=payload.get("permissions", []),
            )

    # Try API key
    if bearer_token and "." in bearer_token:
        if api_key_data := verify_api_key(bearer_token):
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

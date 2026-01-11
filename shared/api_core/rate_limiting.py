"""
Rate limiting middleware for Flask applications.

Provides rate limiting with X-RateLimit-* headers and 429 responses.
Uses token bucket algorithm compatible with existing rate_limiter.py pattern.
"""

import time
from typing import Optional, Dict, Callable, Tuple, Any
from dataclasses import dataclass, field
from threading import Lock
import logging

try:
    from flask import request, g
    FLASK_AVAILABLE = True
except ImportError:
    FLASK_AVAILABLE = False

from .models import APIError, ErrorCode, ErrorCategory

logger = logging.getLogger(__name__)


@dataclass
class RateLimitConfig:
    """Configuration for rate limiting."""
    limit: int = 1000  # Requests per window
    window: int = 3600  # Window size in seconds (default: 1 hour)
    per_ip: bool = True  # Limit per IP address
    per_endpoint: bool = False  # Limit per endpoint path
    identifier_func: Optional[Callable] = None  # Custom identifier function

    def __post_init__(self):
        """Validate configuration values."""
        if self.limit <= 0:
            raise ValueError(f"Rate limit 'limit' must be positive, got {self.limit}")
        if self.window <= 0:
            raise ValueError(f"Rate limit 'window' must be positive, got {self.window}")
        if self.identifier_func is not None and not callable(self.identifier_func):
            raise ValueError("Rate limit 'identifier_func' must be callable or None")


@dataclass
class RateLimitState:
    """State for a rate limit bucket."""
    tokens: float
    last_refill: float
    window_start: float  # Track when current window started (for accurate reset_time)
    reset_time: float

    def __init__(self, limit: int, window: int):
        self.tokens = float(limit)
        self.limit = limit
        self.window = window
        now = time.time()
        self.last_refill = now
        self.window_start = now  # Window starts now
        self.reset_time = now + window


class RateLimiter:
    """
    Token bucket rate limiter for Flask middleware.

    Thread-safe implementation using locks.
    """

    def __init__(self, config: RateLimitConfig):
        """Initialize rate limiter with configuration."""
        self.config = config
        self.buckets: Dict[str, RateLimitState] = {}
        self.lock = Lock()
        self.cleanup_interval = 3600  # Cleanup old buckets every hour
        self.last_cleanup = time.time()

    def _get_identifier(self, req) -> str:
        """Get identifier for rate limiting (IP, endpoint, or custom)."""
        if self.config.identifier_func:
            return self.config.identifier_func(req)

        parts = []

        if self.config.per_ip:
            # Get client IP - works with Flask request or mock
            ip = 'unknown'
            if hasattr(req, 'remote_addr') and req.remote_addr:
                ip = req.remote_addr
            elif hasattr(req, 'headers') and req.headers:
                if 'X-Forwarded-For' in req.headers:
                    # Handle proxy headers
                    forwarded = req.headers['X-Forwarded-For']
                    if forwarded:
                        ip = str(forwarded).split(',')[0].strip()
                elif 'X-Real-Ip' in req.headers:
                    ip = req.headers['X-Real-Ip']
            parts.append(f"ip:{ip}")

        if self.config.per_endpoint:
            if hasattr(req, 'path') and req.path:
                parts.append(f"path:{req.path}")
            elif hasattr(req, 'endpoint') and req.endpoint:
                parts.append(f"endpoint:{req.endpoint}")

        return "|".join(parts) if parts else "default"

    def _refill_tokens(self, state: RateLimitState) -> None:
        """Refill tokens based on time elapsed."""
        now = time.time()
        elapsed_since_refill = now - state.last_refill
        elapsed_since_window_start = now - state.window_start

        if elapsed_since_window_start >= state.window:
            # Full refill - start new window
            state.tokens = float(state.limit)
            state.window_start = now  # Reset window start time
            state.reset_time = now + state.window
        else:
            # Partial refill based on time since last refill
            # Tokens refill at rate of limit/window per second
            tokens_to_add = (elapsed_since_refill / state.window) * state.limit
            state.tokens = min(state.limit, state.tokens + tokens_to_add)
            # Reset time is fixed relative to window start (don't drift)
            state.reset_time = state.window_start + state.window

        state.last_refill = now

    def _cleanup_old_buckets(self) -> None:
        """Remove expired buckets to prevent memory leak."""
        now = time.time()
        if now - self.last_cleanup < self.cleanup_interval:
            return

        with self.lock:
            expired = []
            for key, state in self.buckets.items():
                # Bucket is expired if reset_time has passed + grace period (1 window)
                if now > state.reset_time + self.config.window:
                    expired.append(key)
            for key in expired:
                del self.buckets[key]

        self.last_cleanup = now

    def check_rate_limit(self, req) -> Tuple[bool, Dict[str, Any]]:
        """
        Check if request is within rate limit.

        Returns:
            (allowed: bool, headers: dict)

        Headers dict contains:
            - X-RateLimit-Limit: Maximum requests per window
            - X-RateLimit-Remaining: Remaining requests in current window
            - X-RateLimit-Reset: Unix timestamp when limit resets
        """
        identifier = self._get_identifier(req)

        with self.lock:
            self._cleanup_old_buckets()

            # Get or create bucket for this identifier
            if identifier not in self.buckets:
                self.buckets[identifier] = RateLimitState(
                    self.config.limit,
                    self.config.window
                )

            state = self.buckets[identifier]
            self._refill_tokens(state)

            # Check if request is allowed
            allowed = state.tokens >= 1.0

            if allowed:
                state.tokens -= 1.0

            # Calculate headers
            remaining = max(0, int(state.tokens))
            reset_timestamp = int(state.reset_time)

            headers = {
                'X-RateLimit-Limit': str(self.config.limit),
                'X-RateLimit-Remaining': str(remaining),
                'X-RateLimit-Reset': str(reset_timestamp),
            }

            if not allowed:
                # Add Retry-After header for 429 responses
                retry_after = max(0, int(state.reset_time - time.time()))
                headers['Retry-After'] = str(retry_after)

        return allowed, headers

    def get_limit_info(self, req) -> Dict[str, Any]:
        """Get rate limit information without consuming a token (for headers)."""
        identifier = self._get_identifier(req)

        with self.lock:
            if identifier not in self.buckets:
                return {
                    'X-RateLimit-Limit': str(self.config.limit),
                    'X-RateLimit-Remaining': str(self.config.limit),
                    'X-RateLimit-Reset': str(int(time.time() + self.config.window)),
                }

            state = self.buckets[identifier]
            self._refill_tokens(state)  # Update state but don't consume token

            return {
                'X-RateLimit-Limit': str(self.config.limit),
                'X-RateLimit-Remaining': str(max(0, int(state.tokens))),
                'X-RateLimit-Reset': str(int(state.reset_time)),
            }


def create_rate_limit_middleware(
    app,
    default_config: Optional[RateLimitConfig] = None,
    endpoint_configs: Optional[Dict[str, RateLimitConfig]] = None
) -> None:
    """
    Create rate limiting middleware for Flask app.

    Args:
        app: Flask application instance
        default_config: Default rate limit configuration
        endpoint_configs: Per-endpoint configurations (keyed by route pattern)
    """
    if not FLASK_AVAILABLE:
        raise RuntimeError("Flask required for rate limiting middleware. Install Flask.")

    # Store limiters in app.extensions to avoid global state issues
    # This allows multiple Flask apps to have separate rate limiters
    if not hasattr(app, 'extensions'):
        app.extensions = {}

    # Create default limiter
    if default_config is None:
        default_config = RateLimitConfig(
            limit=1000,
            window=3600,  # 1 hour
            per_ip=True,
            per_endpoint=False
        )
    default_limiter = RateLimiter(default_config)

    # Create endpoint-specific limiters
    endpoint_limiters = {}
    if endpoint_configs:
        endpoint_limiters = {
            pattern: RateLimiter(config)
            for pattern, config in endpoint_configs.items()
        }

    # Store in app.extensions for per-app isolation
    app.extensions['rate_limiter'] = {
        'default': default_limiter,
        'endpoints': endpoint_limiters
    }

    @app.before_request
    def check_rate_limit_before_request():
        """Check rate limit before processing request."""
        # Skip rate limiting for certain paths (health, docs, etc.)
        if request.path in ['/health', '/api/docs', '/api/openapi.json']:
            return

        # Get limiters from app.extensions (per-app isolation)
        limiters = app.extensions.get('rate_limiter', {})
        limiter = limiters.get('default')

        if not limiter:
            # Fallback if not initialized (shouldn't happen)
            logger.warning("Rate limiter not initialized, skipping rate limit check")
            return

        # Check if there's an endpoint-specific limiter
        endpoint_limiters = limiters.get('endpoints', {})
        for pattern, endpoint_limiter in endpoint_limiters.items():
            if pattern in request.path or (request.endpoint and request.endpoint == pattern):
                limiter = endpoint_limiter
                break

        allowed, headers = limiter.check_rate_limit(request)

        # Store headers in Flask g for response middleware
        g.rate_limit_headers = headers

        if not allowed:
            # Rate limit exceeded
            error = APIError(
                code=ErrorCode.TOO_MANY_REQUESTS,
                message=f"Rate limit exceeded. Try again after {headers.get('Retry-After', '60')} seconds.",
                category=ErrorCategory.RATE_LIMIT_ERROR,
                request_id=getattr(g, 'request_id', None),
                retry_after=int(headers.get('Retry-After', 60)),
                documentation_url="https://docs.chrysalis.dev/rate-limits",
                suggestions=[
                    "Reduce request frequency",
                    f"Retry after {headers.get('Retry-After', '60')} seconds",
                    "Consider upgrading your API plan for higher limits"
                ]
            )

            from .models import APIResponse
            response, status = APIResponse.error_response(error, status_code=429)

            from flask import jsonify
            resp = jsonify(response.to_dict())
            resp.status_code = 429

            # Add rate limit headers
            for key, value in headers.items():
                resp.headers[key] = value

            return resp

    @app.after_request
    def add_rate_limit_headers(response):
        """Add rate limit headers to all responses."""
        # Add rate limit headers if available
        rate_limit_headers = getattr(g, 'rate_limit_headers', None)
        if rate_limit_headers:
            for key, value in rate_limit_headers.items():
                # Don't overwrite existing headers
                if key not in response.headers:
                    response.headers[key] = value
        else:
            # Even if no rate limit check, add informational headers
            limiters = getattr(app, 'extensions', {}).get('rate_limiter', {})
            limiter = limiters.get('default')
            if limiter:
                info = limiter.get_limit_info(request)
                for key, value in info.items():
                    if key not in response.headers:
                        response.headers[key] = value

        return response


def get_rate_limit_info(req, app=None) -> Dict[str, Any]:
    """
    Get rate limit information for a request (for manual header addition).

    Args:
        req: Request object
        app: Optional Flask app instance (required if not in request context)

    Returns:
        Dictionary with rate limit headers
    """
    if FLASK_AVAILABLE and hasattr(req, 'app'):
        # Try to get from request's app context
        app = req.app
    elif app is None:
        # Try to get from Flask current_app
        try:
            from flask import current_app
            app = current_app
        except (ImportError, RuntimeError):
            return {}

    if app:
        limiters = getattr(app, 'extensions', {}).get('rate_limiter', {})
        limiter = limiters.get('default')
        if limiter:
            return limiter.get_limit_info(req)

    return {}

"""
Testing utilities for API core components.

Provides test fixtures and helpers that work without Flask for unit testing,
and can also be used with Flask for integration testing.
"""

from typing import Optional, Dict, Any, Callable
from unittest.mock import Mock, MagicMock, patch

try:
    from .auth import AuthContext
    AUTH_CONTEXT_AVAILABLE = True
except ImportError:
    AUTH_CONTEXT_AVAILABLE = False
    # Stub for when auth not available
    class AuthContext:
        pass


class MockRequest:
    """Mock request object for testing without Flask."""

    def __init__(
        self,
        method: str = "GET",
        path: str = "/test",
        headers: Optional[Dict[str, str]] = None,
        json_data: Optional[Dict[str, Any]] = None,
        remote_addr: str = "127.0.0.1",
        endpoint: Optional[str] = None
    ):
        self.method = method
        self.path = path
        self.headers = headers or {}
        self.remote_addr = remote_addr
        self.endpoint = endpoint
        self._json = json_data
        self.args = {}
        self.form = {}

    def get_json(self, force: bool = False, silent: bool = False, cache: bool = True):
        """Mock get_json method."""
        return self._json


class MockResponse:
    """Mock response object for testing."""

    def __init__(self, status_code: int = 200, data: Optional[Dict[str, Any]] = None):
        self.status_code = status_code
        self.data = data or {}
        self.headers = {}

    def get_json(self):
        """Mock get_json method."""
        return self.data


def create_mock_auth_context(
    user_id: str = "test-user",
    token_type: str = "bearer",
    roles: Optional[list] = None,
    permissions: Optional[list] = None
) -> AuthContext:
    """
    Create a mock AuthContext for testing.

    Works without Flask - returns AuthContext that can be used in tests.
    """
    if not AUTH_CONTEXT_AVAILABLE:
        # Return a simple mock if AuthContext not available
        mock = Mock()
        mock.user_id = user_id
        mock.token_type = token_type
        mock.roles = roles or ["user"]
        mock.permissions = permissions or []
        mock.has_role = lambda r: r in (roles or ["user"])
        mock.has_permission = lambda p: p in (permissions or []) or "admin" in (roles or [])
        return mock

    return AuthContext(
        user_id=user_id,
        token_type=token_type,
        roles=roles or ["user"],
        permissions=permissions or []
    )


def mock_authenticate_request(return_value: Optional[AuthContext] = None):
    """
    Create a mock for authenticate_request function.

    Usage:
        @patch('shared.api_core.auth.authenticate_request')
        def test_something(mock_auth):
            mock_auth.return_value = create_mock_auth_context()
            # Test code
    """
    if return_value is None:
        return_value = create_mock_auth_context()

    def _mock_authenticate(optional: bool = False, req=None):
        return return_value

    return _mock_authenticate


class AuthenticationFixture:
    """
    Test fixture for authentication that works without Flask.

    Provides helpers for mocking authentication in tests.
    """

    def __init__(self, auth_context: Optional[AuthContext] = None):
        """Initialize fixture with optional auth context."""
        self.auth_context = auth_context or create_mock_auth_context()
        self.patches = []

    def patch_authenticate_request(self, target_module: str = "shared.api_core.auth"):
        """
        Patch authenticate_request in the specified module.

        Args:
            target_module: Module path to patch (e.g., "AgentBuilder.server")

        Returns:
            Context manager for the patch
        """
        return patch(f"{target_module}.authenticate_request", return_value=self.auth_context)

    def patch_get_current_user(self, target_module: str = "shared.api_core.auth"):
        """
        Patch get_current_user to return the auth context.

        Args:
            target_module: Module path to patch

        Returns:
            Context manager for the patch
        """
        return patch(f"{target_module}.get_current_user", return_value=self.auth_context)

    def patch_require_auth_decorator(self, target_module: str):
        """
        Patch the require_auth decorator to bypass authentication.

        Args:
            target_module: Module where require_auth is imported

        Returns:
            Context manager that makes require_auth a no-op
        """
        def noop_decorator(f):
            return f

        return patch(f"{target_module}.require_auth", noop_decorator)

    def create_request_with_auth(self, **kwargs) -> MockRequest:
        """
        Create a MockRequest with authentication headers.

        Args:
            **kwargs: Additional arguments for MockRequest

        Returns:
            MockRequest with Authorization header set
        """
        headers = kwargs.pop('headers', {})
        headers['Authorization'] = f"Bearer test-token-{self.auth_context.user_id}"
        return MockRequest(headers=headers, **kwargs)


# Convenience fixtures for pytest
def pytest_auth_fixture():
    """
    Pytest fixture factory for authentication.

    Usage in conftest.py:
        @pytest.fixture
        def mock_auth():
            return pytest_auth_fixture()
    """
    return AuthenticationFixture()


def create_test_app_with_auth_bypass(app):
    """
    Modify Flask app to bypass authentication for testing.

    This modifies the app in-place to remove @require_auth decorators.
    Useful for integration tests where you want to test business logic
    without authentication concerns.

    Args:
        app: Flask application instance

    Returns:
        Modified app (same instance)
    """
    # Import here to avoid circular dependencies
    try:
        from flask import Flask
    except ImportError:
        raise RuntimeError("Flask required for test app modification")

    # Find all routes with @require_auth and remove the check
    # This is a bit hacky but works for testing
    for rule in app.url_map.iter_rules():
        endpoint_func = app.view_functions.get(rule.endpoint)
        if endpoint_func and hasattr(endpoint_func, '__wrapped__'):
            # Check if wrapped by require_auth
            original_func = endpoint_func
            while hasattr(original_func, '__wrapped__'):
                original_func = original_func.__wrapped__
            # Replace with original (unwrapped) function
            app.view_functions[rule.endpoint] = original_func

    return app


def mock_jwt_token(user_id: str, roles: Optional[list] = None, permissions: Optional[list] = None) -> str:
    """
    Create a mock JWT token for testing.

    Note: This is not a valid JWT, but can be used to test token parsing logic.
    For actual JWT testing, use create_jwt_token from auth module.

    Args:
        user_id: User ID
        roles: List of roles
        permissions: List of permissions

    Returns:
        Mock token string
    """
    # Return a simple mock token (not a real JWT)
    # In real tests, use create_jwt_token from auth module if available
    return f"mock.jwt.token.{user_id}"


def create_mock_flask_g(auth_context: Optional[AuthContext] = None):
    """
    Create a mock Flask g object for testing.

    Args:
        auth_context: Optional auth context to store in g

    Returns:
        Mock object with g-like attributes
    """
    mock_g = MagicMock()
    if auth_context:
        mock_g.auth_context = auth_context
    mock_g.request_id = "test-request-123"
    return mock_g

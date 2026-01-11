"""
Tests for authentication testing utilities.
"""

import sys
from pathlib import Path
import pytest

# Add shared directory to path
PROJECT_ROOT = Path(__file__).resolve().parents[3]
SHARED_PATH = PROJECT_ROOT / "shared"
if str(SHARED_PATH) not in sys.path:
    sys.path.insert(0, str(SHARED_PATH))

from api_core.test_utils import (
    MockRequest,
    MockResponse,
    create_mock_auth_context,
    AuthenticationFixture,
    MockResponse as TestMockResponse,
)


class TestMockRequest:
    """Tests for MockRequest."""

    def test_basic_request(self):
        """Test creating basic mock request."""
        req = MockRequest()
        assert req.method == "GET"
        assert req.path == "/test"
        assert req.remote_addr == "127.0.0.1"

    def test_request_with_headers(self):
        """Test request with custom headers."""
        req = MockRequest(headers={"Authorization": "Bearer token123"})
        assert req.headers["Authorization"] == "Bearer token123"

    def test_request_with_json(self):
        """Test request with JSON data."""
        data = {"test": "data"}
        req = MockRequest(json_data=data)
        assert req.get_json() == data

    def test_request_custom_values(self):
        """Test request with custom values."""
        req = MockRequest(
            method="POST",
            path="/api/v1/test",
            remote_addr="192.168.1.1",
            endpoint="test_endpoint"
        )
        assert req.method == "POST"
        assert req.path == "/api/v1/test"
        assert req.remote_addr == "192.168.1.1"
        assert req.endpoint == "test_endpoint"


class TestMockAuthContext:
    """Tests for mock authentication context creation."""

    def test_create_default_auth_context(self):
        """Test creating default auth context."""
        ctx = create_mock_auth_context()
        assert ctx.user_id == "test-user"
        assert ctx.token_type == "bearer"
        assert "user" in ctx.roles
        assert ctx.has_role("user")

    def test_create_custom_auth_context(self):
        """Test creating custom auth context."""
        ctx = create_mock_auth_context(
            user_id="custom-user",
            roles=["admin", "user"],
            permissions=["read", "write"]
        )
        assert ctx.user_id == "custom-user"
        assert "admin" in ctx.roles
        assert ctx.has_role("admin")
        assert ctx.has_permission("read")

    def test_auth_context_permissions(self):
        """Test auth context permission checking."""
        ctx = create_mock_auth_context(roles=["admin"])
        assert ctx.has_permission("anything")  # Admin has all permissions


class TestAuthenticationFixture:
    """Tests for AuthenticationFixture."""

    def test_fixture_creation(self):
        """Test creating authentication fixture."""
        fixture = AuthenticationFixture()
        assert fixture.auth_context is not None
        assert fixture.auth_context.user_id == "test-user"

    def test_fixture_with_custom_context(self):
        """Test fixture with custom auth context."""
        ctx = create_mock_auth_context(user_id="fixture-user")
        fixture = AuthenticationFixture(auth_context=ctx)
        assert fixture.auth_context.user_id == "fixture-user"

    def test_create_request_with_auth(self):
        """Test creating request with authentication."""
        fixture = AuthenticationFixture()
        req = fixture.create_request_with_auth(path="/api/v1/test")

        assert "Authorization" in req.headers
        assert req.headers["Authorization"].startswith("Bearer")
        assert req.path == "/api/v1/test"

    def test_patch_authenticate_request(self):
        """Test patching authenticate_request."""
        fixture = AuthenticationFixture()

        # Test that patch context manager works
        with fixture.patch_authenticate_request("api_core.auth") as mock_func:
            from api_core.auth import authenticate_request
            result = authenticate_request(optional=False, req=MockRequest())
            assert result.user_id == "test-user"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

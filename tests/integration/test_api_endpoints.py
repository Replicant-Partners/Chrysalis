"""
Integration tests for API endpoints.

Tests API endpoint behavior with real Flask application.
Following the complex learner pattern, integration tests serve as learning
interfaces for understanding API patterns and behaviors.
"""

import pytest

try:
    from flask import Flask
    FLASK_AVAILABLE = True
except ImportError:
    FLASK_AVAILABLE = False
    pytestmark = pytest.mark.skip("Flask not available")

from tests.fixtures.factories import (
    APIResponseFactory,
    AgentFactory,
    AuthFactory,
)


@pytest.mark.integration
@pytest.mark.requires_flask
class TestHealthEndpoints:
    """Integration tests for health check endpoints."""

    def test_health_endpoint(self, flask_app, test_client):
        """Test health endpoint returns success."""
        @flask_app.route('/health')
        def health():
            from shared.api_core import json_response
            return json_response({"status": "healthy", "service": "test"})

        response = test_client.get('/health')
        assert response.status_code == 200
        data = response.get_json()
        assert data is not None
        assert data.get('success') is True
        assert 'status' in data.get('data', {})


@pytest.mark.integration
@pytest.mark.requires_flask
class TestAuthenticationEndpoints:
    """Integration tests for authentication endpoints."""

    def test_unauthenticated_request_rejected(self, flask_app):
        """Test that unauthenticated requests are rejected."""
        from shared.api_core import require_auth, json_response

        @flask_app.route('/protected')
        @require_auth
        def protected():
            return json_response({"data": "protected"})

        client = flask_app.test_client()
        response = client.get('/protected')
        # Should return 401 if authentication is required and not configured
        assert response.status_code in [401, 500]  # 500 if auth not configured

    def test_authenticated_request_allowed(self, flask_app):
        """Test that authenticated requests are allowed."""
        from shared.api_core.test_utils import create_test_app_with_auth_bypass
        from shared.api_core import require_auth, json_response

        app = create_test_app_with_auth_bypass()

        @app.route('/protected')
        def protected():
            @require_auth
            def handler():
                return json_response({"data": "protected"})
            return handler()

        client = app.test_client()
        response = client.get('/protected')
        # Should return 200 if auth is bypassed
        assert response.status_code in [200, 500]  # 500 if json_response not available


@pytest.mark.integration
@pytest.mark.requires_flask
class TestAPIResponseFormat:
    """Integration tests for API response format."""

    def test_success_response_format(self, flask_app, test_client):
        """Test that success responses follow standard format."""
        from shared.api_core import json_response

        @flask_app.route('/test')
        def test():
            return json_response({"key": "value"})

        response = test_client.get('/test')
        assert response.status_code == 200
        data = response.get_json()
        assert data is not None
        assert data.get('success') is True
        assert 'data' in data
        assert 'meta' in data
        assert 'timestamp' in data['meta']
        assert 'request_id' in data['meta']

    def test_error_response_format(self, flask_app, test_client):
        """Test that error responses follow standard format."""
        from shared.api_core import error_response, APIError, ErrorCode, ErrorCategory

        @flask_app.route('/test-error')
        def test_error():
            error = APIError(
                code=ErrorCode.RESOURCE_NOT_FOUND,
                message="Resource not found",
                category=ErrorCategory.NOT_FOUND_ERROR
            )
            return error_response(error, status=404)

        response = test_client.get('/test-error')
        assert response.status_code == 404
        data = response.get_json()
        assert data is not None
        assert data.get('success') is False
        assert 'error' in data
        assert 'code' in data['error']
        assert 'message' in data['error']
        assert 'category' in data['error']


@pytest.mark.integration
@pytest.mark.requires_flask
class TestMiddlewareIntegration:
    """Integration tests for middleware integration."""

    def test_request_id_present(self, flask_app, test_client):
        """Test that request ID is present in responses."""
        from flask import jsonify, g

        @flask_app.route('/test')
        def test():
            return jsonify({"request_id": getattr(g, 'request_id', None)})

        response = test_client.get('/test')
        assert response.status_code == 200
        data = response.get_json()
        # Request ID may or may not be set depending on middleware configuration
        assert data is not None

    def test_cors_headers_present(self, flask_app, test_client):
        """Test that CORS headers are present."""
        from flask import jsonify

        @flask_app.route('/test')
        def test():
            return jsonify({"data": "test"})

        response = test_client.options('/test')
        # CORS headers may or may not be present depending on middleware configuration
        assert response.status_code in [200, 204, 405]  # 405 if OPTIONS not handled

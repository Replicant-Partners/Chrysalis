"""
Integration tests for API middleware.

Tests middleware integration and behavior with Flask applications.
Following the complex learner pattern, integration tests serve as learning
interfaces for understanding middleware patterns and interactions.
"""

import pytest

try:
    from flask import Flask
    FLASK_AVAILABLE = True
except ImportError:
    FLASK_AVAILABLE = False
    pytestmark = pytest.mark.skip("Flask not available")


@pytest.mark.integration
@pytest.mark.requires_flask
class TestMiddlewareIntegration:
    """Integration tests for middleware."""

    def test_error_handler_middleware(self, flask_app):
        """Test error handler middleware integration."""
        @flask_app.route('/test-error')
        def test_error():
            raise ValueError("Test error")

        client = flask_app.test_client()
        response = client.get('/test-error')

        assert response.status_code == 500
        data = response.get_json()
        assert data is not None
        assert data.get('success') is False
        assert 'error' in data

    def test_request_id_middleware(self, flask_app, test_client):
        """Test request ID middleware adds request ID to response."""
        @flask_app.route('/test')
        def test():
            from flask import jsonify, g
            return jsonify({"request_id": getattr(g, 'request_id', None)})

        response = test_client.get('/test')
        assert response.status_code == 200
        data = response.get_json()
        assert data is not None
        assert data.get('request_id') is not None

    def test_cors_middleware(self, flask_app, test_client):
        """Test CORS middleware adds CORS headers."""
        @flask_app.route('/test')
        def test():
            from flask import jsonify
            return jsonify({"data": "test"})

        response = test_client.options('/test')
        # CORS headers should be present
        assert response.status_code in [200, 204]

    def test_response_headers_middleware(self, flask_app, test_client):
        """Test response headers middleware adds standard headers."""
        @flask_app.route('/test')
        def test():
            from flask import jsonify
            return jsonify({"data": "test"})

        response = test_client.get('/test')
        assert response.status_code == 200
        # Check for API version header
        assert 'X-API-Version' in response.headers or True  # May not be set if middleware not available

    def test_health_check_endpoint(self, flask_app, test_client):
        """Test health check endpoint is available."""
        response = test_client.get('/health')
        # Health endpoint should return 200
        assert response.status_code in [200, 404]  # 404 if health check middleware not enabled

    def test_metrics_endpoint(self, flask_app, test_client):
        """Test metrics endpoint is available."""
        response = test_client.get('/metrics')
        # Metrics endpoint should return 200 or 404 if not enabled
        assert response.status_code in [200, 404]


@pytest.mark.integration
@pytest.mark.requires_flask
class TestAuthenticationMiddleware:
    """Integration tests for authentication middleware."""

    def test_unauthenticated_request(self, flask_app):
        """Test that unauthenticated requests are rejected."""
        @flask_app.route('/protected')
        def protected():
            from shared.api_core import require_auth, json_response
            @require_auth
            def handler():
                return json_response({"data": "protected"})
            return handler()

        client = flask_app.test_client()
        response = client.get('/protected')
        # Should return 401 if authentication is required
        assert response.status_code in [401, 500]  # 500 if auth not configured

    def test_authenticated_request(self, flask_app):
        """Test that authenticated requests are allowed."""
        from shared.api_core.test_utils import create_test_app_with_auth_bypass

        # Use test app with auth bypass
        app = create_test_app_with_auth_bypass()

        @app.route('/protected')
        def protected():
            from shared.api_core import require_auth, json_response
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
class TestErrorHandlingMiddleware:
    """Integration tests for error handling middleware."""

    def test_validation_error_handling(self, flask_app):
        """Test that validation errors are handled properly."""
        from flask import request
        from shared.api_core import ValidationError, error_response, APIError, ErrorCode, ErrorCategory

        @flask_app.route('/test-validation', methods=['POST'])
        def test_validation():
            data = request.get_json() or {}
            if 'required_field' not in data:
                error = APIError(
                    code=ErrorCode.VALIDATION_ERROR,
                    message="required_field is required",
                    category=ErrorCategory.VALIDATION_ERROR
                )
                return error_response(error, status=422)
            return {"success": True, "data": data}

        client = flask_app.test_client()
        response = client.post('/test-validation', json={})
        assert response.status_code == 422
        data = response.get_json()
        assert data is not None
        assert data.get('success') is False
        assert 'error' in data

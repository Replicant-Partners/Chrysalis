"""
Tests for API core middleware.
"""

import pytest
from flask import Flask, request
from shared.api_core.middleware import (
    create_request_id_middleware,
    create_response_headers_middleware,
    create_all_middleware,
    create_error_handler,
)
from shared.api_core.models import APIResponse, APIError, ErrorCode, ErrorCategory


class TestRequestIDMiddleware:
    """Tests for request ID tracking middleware."""
    
    def test_request_id_extraction(self):
        """Test extracting request ID from headers."""
        app = Flask(__name__)
        create_request_id_middleware(app)
        
        @app.route("/test")
        def test():
            from flask import g
            return {"request_id": g.request_id}
        
        with app.test_client() as client:
            response = client.get("/test", headers={"X-Request-ID": "custom-req-123"})
            assert response.status_code == 200
            data = response.get_json()
            assert data["request_id"] == "custom-req-123"
            assert response.headers.get("X-Request-ID") == "custom-req-123"
    
    def test_request_id_generation(self):
        """Test generating request ID if not in headers."""
        app = Flask(__name__)
        create_request_id_middleware(app)
        
        @app.route("/test")
        def test():
            from flask import g
            return {"request_id": g.request_id}
        
        with app.test_client() as client:
            response = client.get("/test")
            assert response.status_code == 200
            data = response.get_json()
            assert data["request_id"] is not None
            assert data["request_id"].startswith("req_")
            assert response.headers.get("X-Request-ID") == data["request_id"]


class TestResponseHeadersMiddleware:
    """Tests for response headers middleware."""
    
    def test_api_version_header(self):
        """Test adding API version header."""
        app = Flask(__name__)
        create_response_headers_middleware(app, api_version="v2")
        
        @app.route("/test")
        def test():
            return {"status": "ok"}
        
        with app.test_client() as client:
            response = client.get("/test")
            assert response.headers.get("X-API-Version") == "v2"
    
    def test_content_type_header(self):
        """Test setting content type for API endpoints."""
        app = Flask(__name__)
        create_response_headers_middleware(app)
        
        @app.route("/api/v1/test")
        def test():
            return {"status": "ok"}
        
        with app.test_client() as client:
            response = client.get("/api/v1/test")
            assert "application/json" in response.headers.get("Content-Type", "")


class TestAllMiddleware:
    """Tests for combined middleware."""
    
    def test_all_middleware_integration(self):
        """Test that all middleware works together."""
        app = Flask(__name__)
        create_all_middleware(app, api_version="v1")
        
        @app.route("/api/v1/test")
        def test():
            return APIResponse.success_response({"test": "data"}).to_dict()
        
        with app.test_client() as client:
            response = client.get("/api/v1/test", headers={"X-Request-ID": "test-123"})
            assert response.status_code == 200
            assert response.headers.get("X-Request-ID") == "test-123"
            assert response.headers.get("X-API-Version") == "v1"
            assert "application/json" in response.headers.get("Content-Type", "")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

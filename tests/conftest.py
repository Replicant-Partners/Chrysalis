"""
Pytest configuration and shared fixtures for Chrysalis tests.

Following the complex learner pattern, test fixtures serve as learning interfaces
that help the system understand its own behavior and patterns.
"""

import pytest
import sys
from pathlib import Path
from typing import Generator, Dict, Any, Optional
from unittest.mock import Mock, MagicMock, patch

# Add shared directory to path for imports
PROJECT_ROOT = Path(__file__).resolve().parent.parent
SHARED_PATH = PROJECT_ROOT / "shared"
if str(SHARED_PATH) not in sys.path:
    sys.path.insert(0, str(SHARED_PATH))

# Try to import Flask-related modules
try:
    from flask import Flask, g
    FLASK_AVAILABLE = True
except ImportError:
    FLASK_AVAILABLE = False
    Flask = None
    g = None

# Try to import shared API core
try:
    from shared.api_core import (
        create_all_middleware,
        create_error_handler,
        json_response,
        error_response,
    )
    API_CORE_AVAILABLE = True
except ImportError:
    API_CORE_AVAILABLE = False


# ============================================================================
# Pytest Configuration
# ============================================================================

def pytest_configure(config):
    """Configure pytest markers."""
    config.addinivalue_line(
        "markers", "unit: marks tests as unit tests (deselect with '-m \"not unit\"')"
    )
    config.addinivalue_line(
        "markers", "integration: marks tests as integration tests"
    )
    config.addinivalue_line(
        "markers", "e2e: marks tests as end-to-end tests"
    )
    config.addinivalue_line(
        "markers", "slow: marks tests as slow (deselect with '-m \"not slow\"')"
    )
    config.addinivalue_line(
        "markers", "requires_api: marks tests that require API keys"
    )
    config.addinivalue_line(
        "markers", "requires_network: marks tests that require network access"
    )
    config.addinivalue_line(
        "markers", "requires_flask: marks tests that require Flask"
    )


# ============================================================================
# Flask Application Fixtures
# ============================================================================

@pytest.fixture(scope="session")
def flask_available() -> bool:
    """Check if Flask is available."""
    return FLASK_AVAILABLE


@pytest.fixture
def flask_app() -> Generator[Flask, None, None]:
    """
    Create a Flask application for testing.

    Following complex learner pattern: test app serves as learning interface
    for understanding Flask application behavior and patterns.
    """
    if not FLASK_AVAILABLE:
        pytest.skip("Flask not available")

    app = Flask(__name__)
    app.config['TESTING'] = True
    app.config['SECRET_KEY'] = 'test-secret-key'

    # Setup error handler and middleware if available
    if API_CORE_AVAILABLE:
        create_error_handler(app)
        create_all_middleware(
            app,
            api_version="v1",
            enable_rate_limiting=False,  # Disable rate limiting in tests
        )

    yield app


@pytest.fixture
def test_client(flask_app: Flask):
    """
    Create a Flask test client.

    Provides a test client for making HTTP requests to the Flask app.
    """
    return flask_app.test_client()


@pytest.fixture
def test_client_with_auth(test_client):
    """
    Create a Flask test client with authentication headers.

    Automatically adds Authorization header to requests.
    """
    client = test_client
    client.environ_base['HTTP_AUTHORIZATION'] = 'Bearer test-auth-token'
    return client


# ============================================================================
# Authentication Fixtures
# ============================================================================

@pytest.fixture
def auth_token() -> str:
    """Provide a test authentication token."""
    return "test-auth-token"


@pytest.fixture
def mock_auth_context():
    """
    Create a mock authentication context.

    Following complex learner pattern: mock auth serves as learning interface
    for understanding authentication patterns and behaviors.
    """
    from shared.api_core.test_utils import create_mock_auth_context
    return create_mock_auth_context(
        user_id="test-user",
        token_type="bearer",
        roles=["user"],
        permissions=["read", "write"]
    )


@pytest.fixture
def admin_auth_context():
    """Create a mock admin authentication context."""
    from shared.api_core.test_utils import create_mock_auth_context
    return create_mock_auth_context(
        user_id="admin-user",
        token_type="bearer",
        roles=["admin"],
        permissions=["read", "write", "admin"]
    )


# ============================================================================
# Request/Response Fixtures
# ============================================================================

@pytest.fixture
def mock_request():
    """
    Create a mock request object.

    Following complex learner pattern: mock requests serve as learning interface
    for understanding request patterns and behaviors.
    """
    from shared.api_core.test_utils import MockRequest
    return MockRequest(
        method="GET",
        path="/test",
        headers={"Content-Type": "application/json"},
        remote_addr="127.0.0.1"
    )


@pytest.fixture
def mock_json_request():
    """Create a mock JSON request object."""
    from shared.api_core.test_utils import MockRequest
    return MockRequest(
        method="POST",
        path="/test",
        headers={"Content-Type": "application/json"},
        json_data={"key": "value"},
        remote_addr="127.0.0.1"
    )


# ============================================================================
# Database Fixtures (if needed)
# ============================================================================

@pytest.fixture
def mock_database():
    """Create a mock database connection."""
    mock_db = Mock()
    mock_db.execute = Mock(return_value=Mock())
    mock_db.commit = Mock()
    mock_db.rollback = Mock()
    mock_db.close = Mock()
    return mock_db


# ============================================================================
# Environment Fixtures
# ============================================================================

@pytest.fixture
def mock_env_vars(monkeypatch):
    """
    Mock environment variables for testing.

    Following complex learner pattern: environment mocks serve as learning
    interface for understanding configuration patterns.
    """
    env_vars = {
        'ENVIRONMENT': 'test',
        'API_VERSION': 'v1',
        'ERROR_TRACKING_ENABLED': 'false',
        'AUDIT_LOG_ENABLED': 'false',
    }

    for key, value in env_vars.items():
        monkeypatch.setenv(key, value)

    return env_vars


# ============================================================================
# API Response Fixtures
# ============================================================================

@pytest.fixture
def sample_api_response() -> Dict[str, Any]:
    """Provide a sample API response structure."""
    return {
        "success": True,
        "data": {
            "id": "test-id",
            "name": "test-name"
        },
        "meta": {
            "timestamp": "2025-01-01T00:00:00Z",
            "request_id": "test-request-id"
        }
    }


@pytest.fixture
def sample_api_error() -> Dict[str, Any]:
    """Provide a sample API error structure."""
    return {
        "success": False,
        "error": {
            "code": "RESOURCE_NOT_FOUND",
            "message": "Resource not found",
            "category": "NOT_FOUND_ERROR",
            "timestamp": "2025-01-01T00:00:00Z"
        },
        "meta": {
            "timestamp": "2025-01-01T00:00:00Z",
            "request_id": "test-request-id"
        }
    }


# ============================================================================
# Service Fixtures
# ============================================================================

@pytest.fixture
def mock_knowledge_builder_service():
    """Mock KnowledgeBuilder service."""
    mock = Mock()
    mock.create_knowledge = Mock(return_value={"knowledge_id": "test-kb-id"})
    mock.get_knowledge = Mock(return_value={"id": "test-kb-id", "data": {}})
    return mock


@pytest.fixture
def mock_skill_builder_service():
    """Mock SkillBuilder service."""
    mock = Mock()
    mock.create_skills = Mock(return_value={"skill_id": "test-skill-id"})
    mock.get_skills = Mock(return_value={"id": "test-skill-id", "skills": []})
    return mock


# ============================================================================
# Cleanup Fixtures
# ============================================================================

@pytest.fixture(autouse=True)
def cleanup_after_test():
    """
    Automatic cleanup after each test.

    Following complex learner pattern: cleanup ensures test isolation,
    enabling reliable pattern discovery and learning.
    """
    yield
    # Cleanup code here if needed
    # Reset global state, close connections, etc.
    pass


# ============================================================================
# Test Utilities
# ============================================================================

@pytest.fixture
def assert_api_response():
    """
    Assert helper for API responses.

    Following complex learner pattern: assertion helpers serve as learning
    interfaces for understanding response patterns and structures.
    """
    def _assert_response(response, expected_status: int = 200, expected_success: bool = True):
        """Assert API response structure and status."""
        assert response.status_code == expected_status
        data = response.get_json()
        assert data is not None
        assert data.get('success') == expected_success

        if expected_success:
            assert 'data' in data
        else:
            assert 'error' in data

        assert 'meta' in data
        return data

    return _assert_response


@pytest.fixture
def assert_error_response():
    """Assert helper for error responses."""
    def _assert_error(response, expected_status: int, expected_code: str):
        """Assert error response structure and code."""
        assert response.status_code == expected_status
        data = response.get_json()
        assert data is not None
        assert data.get('success') is False
        assert 'error' in data
        assert data['error'].get('code') == expected_code
        return data

    return _assert_error

"""
Pytest configuration and fixtures for integration tests.

Integration tests test component interactions and API endpoints.
Following the complex learner pattern, integration tests serve as learning
interfaces for understanding system interactions and patterns.
"""

import pytest
import sys
from pathlib import Path
from typing import Generator

# Add shared directory to path
PROJECT_ROOT = Path(__file__).resolve().parents[2]
SHARED_PATH = PROJECT_ROOT / "shared"
if str(SHARED_PATH) not in sys.path:
    sys.path.insert(0, str(SHARED_PATH))

try:
    from flask import Flask
    FLASK_AVAILABLE = True
except ImportError:
    FLASK_AVAILABLE = False
    Flask = None


@pytest.fixture(scope="module")
def integration_app() -> Generator[Flask, None, None]:
    """
    Create a Flask application for integration testing.

    Integration tests use a more complete application setup than unit tests.
    """
    if not FLASK_AVAILABLE:
        pytest.skip("Flask not available for integration tests")

    app = Flask(__name__)
    app.config['TESTING'] = True
    app.config['SECRET_KEY'] = 'integration-test-secret-key'

    # Setup middleware and error handlers
    try:
        from shared.api_core import create_error_handler, create_all_middleware
        create_error_handler(app)
        create_all_middleware(
            app,
            api_version="v1",
            enable_rate_limiting=False,  # Disable rate limiting in tests
        )
    except ImportError:
        pass

    yield app


@pytest.fixture(scope="module")
def integration_client(integration_app: Flask):
    """Create a Flask test client for integration tests."""
    return integration_app.test_client()


@pytest.fixture
def authenticated_integration_client(integration_client):
    """Create an authenticated Flask test client for integration tests."""
    client = integration_client
    client.environ_base['HTTP_AUTHORIZATION'] = 'Bearer integration-test-token'
    return client

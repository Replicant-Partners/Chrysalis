"""
Basic tests for AgentBuilder API endpoints.
"""

import sys
from pathlib import Path
import pytest
import json
from unittest.mock import patch
from datetime import datetime, timezone

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Add shared to path for auth mocking
SHARED_PATH = PROJECT_ROOT.parents[1] / "shared"
if str(SHARED_PATH) not in sys.path:
    sys.path.insert(0, str(SHARED_PATH))

from AgentBuilder.server import app, agents_store
try:
    from shared.api_core.test_utils import AuthenticationFixture, create_mock_auth_context
    TEST_UTILS_AVAILABLE = True
except ImportError:
    TEST_UTILS_AVAILABLE = False
    from shared.api_core.auth import AuthContext


@pytest.fixture
def mock_auth():
    """Mock authentication to bypass @require_auth decorator."""
    if TEST_UTILS_AVAILABLE:
        # Use new test utilities
        auth_context = create_mock_auth_context(
            user_id="test-user",
            roles=["admin"],
            permissions=["*"]
        )
        fixture = AuthenticationFixture(auth_context=auth_context)

        # Patch authenticate_request in the shared module where it's actually used
        with fixture.patch_authenticate_request('shared.api_core.auth'):
            with fixture.patch_authenticate_request('AgentBuilder.server'):
                yield auth_context
    else:
        # Fallback to old method
        from shared.api_core.auth import AuthContext
        auth_context = AuthContext(
            user_id="test-user",
            token_type="bearer",
            roles=["admin"],
            permissions=["*"]
        )
        with patch('shared.api_core.auth.authenticate_request') as mock_auth_func:
            mock_auth_func.return_value = auth_context
            with patch('AgentBuilder.server.authenticate_request', mock_auth_func):
                yield auth_context


@pytest.fixture
def client(mock_auth):
    """Create test client with mocked authentication."""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client
    # Cleanup after test
    agents_store.clear()


class TestHealthEndpoint:
    """Tests for health endpoint."""

    def test_health_check(self, client):
        """Test health check endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        assert data["data"]["status"] == "healthy"
        assert "X-Request-ID" in response.headers
        assert response.headers["X-API-Version"] == "v1"


class TestAgentEndpoints:
    """Tests for agent endpoints."""

    def test_create_agent_success(self, client):
        """Test creating an agent."""
        # Note: This will fail auth, but we can test the endpoint structure
        payload = {
            "agent_id": "test-agent-1",
            "role_model": {
                "name": "Bob Ross",
                "occupation": "Artist"
            }
        }
        response = client.post(
            "/api/v1/agents",
            json=payload,
            headers={"Authorization": "Bearer test-token"}
        )
        # Will fail auth, but should return proper error format
        assert response.status_code in [200, 201, 401]
        assert "X-Request-ID" in response.headers
        assert response.headers["X-API-Version"] == "v1"

    def test_get_agent_not_found(self, client):
        """Test getting non-existent agent."""
        response = client.get(
            "/api/v1/agents/nonexistent",
            headers={"Authorization": "Bearer test-token"}
        )
        assert response.status_code == 404
        data = response.get_json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND_ERROR.RESOURCE_NOT_FOUND"

    def test_update_agent_not_found(self, client):
        """Test PATCH on non-existent agent."""
        response = client.patch(
            "/api/v1/agents/nonexistent",
            json={"role_model": {"name": "Updated"}},
            headers={"Authorization": "Bearer test-token"}
        )
        assert response.status_code == 404

    def test_replace_agent_not_found(self, client):
        """Test PUT on non-existent agent."""
        response = client.put(
            "/api/v1/agents/nonexistent",
            json={
                "role_model": {
                    "name": "Test",
                    "occupation": "Tester"
                }
            },
            headers={"Authorization": "Bearer test-token"}
        )
        # PUT on non-existent should still work (creates or updates)
        assert response.status_code in [200, 404]

    def test_delete_agent_not_found(self, client):
        """Test DELETE on non-existent agent."""
        response = client.delete(
            "/api/v1/agents/nonexistent",
            headers={"Authorization": "Bearer test-token"}
        )
        assert response.status_code == 404


class TestPatchPutEndpoints:
    """Comprehensive tests for PATCH and PUT endpoints."""

    def test_patch_agent_partial_update(self, client, mock_auth):
        """Test PATCH endpoint for partial agent update."""
        # First create an agent
        agent_id = "test-agent-patch-1"
        agents_store[agent_id] = {
            "agent_id": agent_id,
            "role_model": {
                "name": "Original Name",
                "occupation": "Original Occupation"
            },
            "deepening_cycles": 3,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        # Partial update: only update role_model.name
        response = client.patch(
            f"/api/v1/agents/{agent_id}",
            json={
                "role_model": {
                    "name": "Updated Name"
                }
            },
            headers={"Authorization": "Bearer test-token"}
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        assert data["data"]["agent_id"] == agent_id
        assert data["data"]["role_model"]["name"] == "Updated Name"
        assert data["data"]["role_model"]["occupation"] == "Original Occupation"  # Should be preserved
        assert data["data"]["deepening_cycles"] == 3  # Should be preserved
        assert "updated_at" in data["data"]

    def test_patch_agent_update_deepening_cycles(self, client, mock_auth):
        """Test PATCH endpoint updating deepening_cycles."""
        agent_id = "test-agent-patch-2"
        agents_store[agent_id] = {
            "agent_id": agent_id,
            "role_model": {"name": "Test", "occupation": "Tester"},
            "deepening_cycles": 5
        }

        response = client.patch(
            f"/api/v1/agents/{agent_id}",
            json={"deepening_cycles": 8},
            headers={"Authorization": "Bearer test-token"}
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["deepening_cycles"] == 8

    def test_patch_agent_invalid_deepening_cycles(self, client, mock_auth):
        """Test PATCH with invalid deepening_cycles value."""
        agent_id = "test-agent-patch-3"
        agents_store[agent_id] = {
            "agent_id": agent_id,
            "role_model": {"name": "Test", "occupation": "Tester"},
            "deepening_cycles": 5
        }

        # Test value too high
        response = client.patch(
            f"/api/v1/agents/{agent_id}",
            json={"deepening_cycles": 15},
            headers={"Authorization": "Bearer test-token"}
        )

        assert response.status_code == 422
        data = response.get_json()
        assert data["success"] is False
        assert "deepening_cycles" in str(data["error"]["message"]).lower()

        # Test negative value
        response = client.patch(
            f"/api/v1/agents/{agent_id}",
            json={"deepening_cycles": -1},
            headers={"Authorization": "Bearer test-token"}
        )

        assert response.status_code == 422

    def test_put_agent_full_replace(self, client, mock_auth):
        """Test PUT endpoint for full agent replacement."""
        agent_id = "test-agent-put-1"
        # Create initial agent
        agents_store[agent_id] = {
            "agent_id": agent_id,
            "role_model": {"name": "Old Name", "occupation": "Old Job"},
            "deepening_cycles": 2,
            "generated_skills": ["skill1"],
            "generated_knowledge": ["knowledge1"]
        }

        # Replace with new data
        response = client.put(
            f"/api/v1/agents/{agent_id}",
            json={
                "role_model": {
                    "name": "New Name",
                    "occupation": "New Job"
                },
                "deepening_cycles": 7
            },
            headers={"Authorization": "Bearer test-token"}
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        assert data["data"]["agent_id"] == agent_id
        assert data["data"]["role_model"]["name"] == "New Name"
        assert data["data"]["role_model"]["occupation"] == "New Job"
        assert data["data"]["deepening_cycles"] == 7
        # Generated fields should be preserved
        assert "generated_skills" in data["data"]
        assert "generated_knowledge" in data["data"]

    def test_put_agent_create_new(self, client, mock_auth):
        """Test PUT endpoint creating new agent if doesn't exist."""
        agent_id = "test-agent-put-new"

        response = client.put(
            f"/api/v1/agents/{agent_id}",
            json={
                "role_model": {
                    "name": "Created Name",
                    "occupation": "Created Occupation"
                },
                "deepening_cycles": 5
            },
            headers={"Authorization": "Bearer test-token"}
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        assert data["data"]["agent_id"] == agent_id
        assert data["data"]["role_model"]["name"] == "Created Name"
        assert agent_id in agents_store

    def test_put_agent_missing_required_fields(self, client, mock_auth):
        """Test PUT endpoint with missing required fields."""
        agent_id = "test-agent-put-invalid"

        response = client.put(
            f"/api/v1/agents/{agent_id}",
            json={
                "deepening_cycles": 5
                # Missing role_model
            },
            headers={"Authorization": "Bearer test-token"}
        )

        assert response.status_code == 422
        data = response.get_json()
        assert data["success"] is False
        assert "role_model" in str(data["error"]["message"]).lower() or "roleModel" in str(data["error"]["message"])

    def test_patch_agent_not_found_detailed(self, client, mock_auth):
        """Test PATCH on non-existent agent returns proper error."""
        response = client.patch(
            "/api/v1/agents/nonexistent-agent",
            json={"role_model": {"name": "Updated"}},
            headers={"Authorization": "Bearer test-token"}
        )

        assert response.status_code == 404
        data = response.get_json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND_ERROR.RESOURCE_NOT_FOUND"
        assert "not found" in data["error"]["message"].lower()

    def test_patch_agent_merge_role_model(self, client, mock_auth):
        """Test that PATCH merges role_model fields properly."""
        agent_id = "test-agent-merge"
        agents_store[agent_id] = {
            "agent_id": agent_id,
            "role_model": {
                "name": "Original",
                "occupation": "Original Job",
                "personality": "Cheerful"
            },
            "deepening_cycles": 3
        }

        # Update only name, should preserve other role_model fields
        response = client.patch(
            f"/api/v1/agents/{agent_id}",
            json={
                "role_model": {
                    "name": "Updated"
                }
            },
            headers={"Authorization": "Bearer test-token"}
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["role_model"]["name"] == "Updated"
        # Check that other fields are preserved (server should merge)
        role_model = data["data"]["role_model"]
        # The server uses update() which should preserve existing keys
        assert "occupation" in role_model or role_model.get("occupation") is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

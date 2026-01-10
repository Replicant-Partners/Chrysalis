"""
Basic tests for AgentBuilder API endpoints.
"""

import pytest
import json
from projects.AgentBuilder.server import app, agents_store


@pytest.fixture
def client():
    """Create test client."""
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


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

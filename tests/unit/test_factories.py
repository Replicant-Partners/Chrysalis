"""
Tests for test factories.

Following the complex learner pattern, factory tests serve as learning interfaces
for understanding data patterns and factory behavior.
"""

import pytest
from tests.fixtures.factories import (
    APIResponseFactory,
    AgentFactory,
    KnowledgeFactory,
    SkillFactory,
    PaginationFactory,
    AuthFactory,
)


class TestAPIResponseFactory:
    """Tests for APIResponseFactory."""

    def test_success_response_default(self):
        """Test creating default success response."""
        response = APIResponseFactory.success_response()
        assert response["success"] is True
        assert "data" in response
        assert "meta" in response
        assert "timestamp" in response["meta"]
        assert "request_id" in response["meta"]

    def test_success_response_with_data(self):
        """Test creating success response with data."""
        data = {"key": "value"}
        response = APIResponseFactory.success_response(data=data)
        assert response["success"] is True
        assert response["data"] == data

    def test_success_response_with_pagination(self):
        """Test creating success response with pagination."""
        pagination = PaginationFactory.create_pagination(page=1, per_page=20, total=100)
        response = APIResponseFactory.success_response(pagination=pagination)
        assert response["success"] is True
        assert response["pagination"] == pagination

    def test_error_response(self):
        """Test creating error response."""
        response = APIResponseFactory.error_response(
            code="TEST_ERROR",
            message="Test error message",
            category="TEST_ERROR"
        )
        assert response["success"] is False
        assert "error" in response
        assert response["error"]["code"] == "TEST_ERROR"
        assert response["error"]["message"] == "Test error message"
        assert response["error"]["category"] == "TEST_ERROR"


class TestAgentFactory:
    """Tests for AgentFactory."""

    def test_create_agent_default(self):
        """Test creating default agent."""
        agent = AgentFactory.create_agent()
        assert "agent_id" in agent
        assert agent["role_model"]["name"] == "Test Agent"
        assert agent["role_model"]["occupation"] == "Software Engineer"
        assert agent["status"] == "completed"

    def test_create_agent_custom(self):
        """Test creating custom agent."""
        agent = AgentFactory.create_agent(
            agent_id="custom-id",
            name="Custom Agent",
            occupation="Data Scientist"
        )
        assert agent["agent_id"] == "custom-id"
        assert agent["role_model"]["name"] == "Custom Agent"
        assert agent["role_model"]["occupation"] == "Data Scientist"

    def test_create_role_model(self):
        """Test creating role model."""
        role_model = AgentFactory.create_role_model(
            name="Test Person",
            occupation="Engineer"
        )
        assert role_model["name"] == "Test Person"
        assert role_model["occupation"] == "Engineer"


class TestKnowledgeFactory:
    """Tests for KnowledgeFactory."""

    def test_create_knowledge_default(self):
        """Test creating default knowledge."""
        knowledge = KnowledgeFactory.create_knowledge()
        assert "knowledge_id" in knowledge
        assert knowledge["identifier"] == "test-entity"
        assert knowledge["entity_type"] == "Person"

    def test_create_entity(self):
        """Test creating entity."""
        entity = KnowledgeFactory.create_entity(
            name="Test Entity",
            entity_type="Person",
            text="Test description"
        )
        assert entity["entity"]["name"] == "Test Entity"
        assert entity["entity"]["type"] == "Person"
        assert entity["entity"]["text"] == "Test description"


class TestSkillFactory:
    """Tests for SkillFactory."""

    def test_create_skill_default(self):
        """Test creating default skill."""
        skill = SkillFactory.create_skill()
        assert "skill_id" in skill
        assert skill["occupation"] == "Software Engineer"

    def test_create_skill_item(self):
        """Test creating skill item."""
        skill_item = SkillFactory.create_skill_item(
            name="Python",
            description="Python programming",
            proficiency=0.9
        )
        assert skill_item["name"] == "Python"
        assert skill_item["description"] == "Python programming"
        assert skill_item["proficiency"] == 0.9


class TestPaginationFactory:
    """Tests for PaginationFactory."""

    def test_create_pagination(self):
        """Test creating pagination."""
        pagination = PaginationFactory.create_pagination(page=1, per_page=20, total=100)
        assert pagination["page"] == 1
        assert pagination["per_page"] == 20
        assert pagination["total"] == 100
        assert pagination["pages"] == 5
        assert pagination["has_next"] is True
        assert pagination["has_prev"] is False

    def test_create_pagination_last_page(self):
        """Test creating pagination for last page."""
        pagination = PaginationFactory.create_pagination(page=5, per_page=20, total=100)
        assert pagination["page"] == 5
        assert pagination["has_next"] is False
        assert pagination["has_prev"] is True


class TestAuthFactory:
    """Tests for AuthFactory."""

    def test_create_token(self):
        """Test creating token."""
        token = AuthFactory.create_token(user_id="test-user")
        assert token.startswith("test-token-")
        assert "test-user" in token

    def test_create_auth_header(self):
        """Test creating auth header."""
        header = AuthFactory.create_auth_header()
        assert "Authorization" in header
        assert header["Authorization"].startswith("Bearer ")

    def test_create_user_context(self):
        """Test creating user context."""
        context = AuthFactory.create_user_context(
            user_id="test-user",
            roles=["admin"],
            permissions=["admin"]
        )
        assert context["user_id"] == "test-user"
        assert context["roles"] == ["admin"]
        assert context["permissions"] == ["admin"]

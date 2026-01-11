"""
Tests for Pydantic request validation schemas.
"""

import sys
from pathlib import Path
import pytest

# Add shared directory to path
PROJECT_ROOT = Path(__file__).resolve().parents[3]
SHARED_PATH = PROJECT_ROOT / "shared"
if str(SHARED_PATH) not in sys.path:
    sys.path.insert(0, str(SHARED_PATH))

try:
    from api_core.schemas import (
        AgentCreateRequest,
        AgentUpdateRequest,
        AgentReplaceRequest,
        KnowledgeCreateRequest,
        KnowledgeUpdateRequest,
        KnowledgeReplaceRequest,
        SkillCreateRequest,
        SkillUpdateRequest,
        SkillReplaceRequest,
        RoleModelRequest,
        validate_with_pydantic,
        PYDANTIC_AVAILABLE,
    )
except ImportError:
    pytest.skip("Pydantic not available", allow_module_level=True)


class TestAgentSchemas:
    """Tests for Agent request schemas."""

    def test_agent_create_request_valid(self):
        """Test valid agent creation request."""
        data = {
            "agent_id": "test-agent-1",
            "role_model": {
                "name": "Bob Ross",
                "occupation": "Artist"
            },
            "deepening_cycles": 3
        }
        request = AgentCreateRequest.model_validate(data)

        assert request.agent_id == "test-agent-1"
        assert request.role_model.name == "Bob Ross"
        assert request.role_model.occupation == "Artist"
        assert request.deepening_cycles == 3

    def test_agent_create_request_missing_fields(self):
        """Test agent creation request with missing required fields."""
        data = {"agent_id": "test"}

        with pytest.raises(Exception):  # Pydantic ValidationError
            AgentCreateRequest.model_validate(data)

    def test_agent_create_request_invalid_deepening_cycles(self):
        """Test agent creation with invalid deepening_cycles."""
        data = {
            "agent_id": "test",
            "role_model": {"name": "Test", "occupation": "Tester"},
            "deepening_cycles": 15  # Too high
        }

        with pytest.raises(Exception):  # Pydantic ValidationError
            AgentCreateRequest.model_validate(data)

    def test_agent_update_request_partial(self):
        """Test partial agent update request."""
        data = {
            "role_model": {
                "name": "Updated Name"
            }
        }
        request = AgentUpdateRequest.model_validate(data)

        assert request.role_model is not None
        assert request.deepening_cycles is None

    def test_agent_update_request_empty(self):
        """Test agent update request with no fields."""
        data = {}

        with pytest.raises(Exception):  # Pydantic ValidationError - at least one field required
            AgentUpdateRequest.model_validate(data)

    def test_validate_with_pydantic_helper(self):
        """Test validate_with_pydantic helper function."""
        data = {
            "agent_id": "test-123",
            "role_model": {"name": "Test", "occupation": "Tester"},
            "deepening_cycles": 5
        }

        validated = validate_with_pydantic(AgentCreateRequest, data)
        assert isinstance(validated, AgentCreateRequest)
        assert validated.agent_id == "test-123"


class TestKnowledgeSchemas:
    """Tests for Knowledge request schemas."""

    def test_knowledge_create_request_valid(self):
        """Test valid knowledge creation request."""
        data = {
            "identifier": "Bob Ross",
            "entity_type": "Person",
            "deepening_cycles": 2
        }
        request = KnowledgeCreateRequest.model_validate(data)

        assert request.identifier == "Bob Ross"
        assert request.entity_type == "Person"
        assert request.deepening_cycles == 2

    def test_knowledge_create_request_minimal(self):
        """Test knowledge creation with minimal required fields."""
        data = {
            "identifier": "Test Entity"
        }
        request = KnowledgeCreateRequest.model_validate(data)

        assert request.identifier == "Test Entity"
        assert request.entity_type is None
        assert request.deepening_cycles == 0

    def test_knowledge_update_request_invalid_knowledge_items(self):
        """Test knowledge update with invalid knowledge_items type."""
        data = {
            "knowledge_items": "not a list"  # Should be list
        }

        with pytest.raises(Exception):  # Pydantic ValidationError
            KnowledgeUpdateRequest.model_validate(data)


class TestSkillSchemas:
    """Tests for Skill request schemas."""

    def test_skill_create_request_valid(self):
        """Test valid skill creation request."""
        data = {
            "occupation": "Software Engineer",
            "deepening_cycles": 5,
            "corpus_text": "Some corpus text..."
        }
        request = SkillCreateRequest.model_validate(data)

        assert request.occupation == "Software Engineer"
        assert request.deepening_cycles == 5
        assert request.corpus_text == "Some corpus text..."

    def test_skill_create_request_minimal(self):
        """Test skill creation with minimal required fields."""
        data = {
            "occupation": "Engineer"
        }
        request = SkillCreateRequest.model_validate(data)

        assert request.occupation == "Engineer"
        assert request.deepening_cycles == 0
        assert request.corpus_text is None

    def test_skill_update_request_partial(self):
        """Test partial skill update."""
        data = {
            "occupation": "Updated Occupation"
        }
        request = SkillUpdateRequest.model_validate(data)

        assert request.occupation == "Updated Occupation"
        assert request.deepening_cycles is None
        assert request.skills is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

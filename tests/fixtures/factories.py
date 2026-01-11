"""
Test factories for creating test data.

Following the complex learner pattern, test factories serve as learning interfaces
that help the system understand data patterns and relationships.
"""

from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
import uuid


class APIResponseFactory:
    """Factory for creating API response test data."""

    @staticmethod
    def success_response(data: Any = None, pagination: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Create a successful API response.

        Following complex learner pattern: factory methods serve as learning
        interfaces for understanding response patterns and structures.
        """
        response = {
            "success": True,
            "data": data if data is not None else {},
            "meta": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "request_id": f"req_{uuid.uuid4().hex[:16]}",
            }
        }
        if pagination:
            response["pagination"] = pagination
        return response

    @staticmethod
    def error_response(
        code: str,
        message: str,
        category: str,
        details: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create an error API response."""
        response = {
            "success": False,
            "error": {
                "code": code,
                "message": message,
                "category": category,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            "meta": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "request_id": f"req_{uuid.uuid4().hex[:16]}",
            }
        }
        if details:
            response["error"]["details"] = details
        return response


class AgentFactory:
    """Factory for creating agent test data."""

    @staticmethod
    def create_agent(
        agent_id: Optional[str] = None,
        name: str = "Test Agent",
        occupation: str = "Software Engineer",
        skills: Optional[List[Dict[str, Any]]] = None,
        knowledge: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Create an agent for testing."""
        return {
            "agent_id": agent_id or f"agent_{uuid.uuid4().hex[:8]}",
            "role_model": {
                "name": name,
                "occupation": occupation,
            },
            "generated_skills": skills or [],
            "generated_knowledge": knowledge or [],
            "status": "completed",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

    @staticmethod
    def create_role_model(
        name: str = "Test Person",
        occupation: str = "Software Engineer",
        **kwargs
    ) -> Dict[str, Any]:
        """Create a role model for testing."""
        return {
            "name": name,
            "occupation": occupation,
            **kwargs
        }


class KnowledgeFactory:
    """Factory for creating knowledge test data."""

    @staticmethod
    def create_knowledge(
        knowledge_id: Optional[str] = None,
        identifier: str = "test-entity",
        entity_type: str = "Person",
        entities: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Create knowledge for testing."""
        return {
            "knowledge_id": knowledge_id or f"kb_{uuid.uuid4().hex[:8]}",
            "identifier": identifier,
            "entity_type": entity_type,
            "knowledge_items": entities or [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

    @staticmethod
    def create_entity(
        name: str = "Test Entity",
        entity_type: str = "Person",
        text: str = "Test entity description",
        **kwargs
    ) -> Dict[str, Any]:
        """Create an entity for testing."""
        return {
            "entity": {
                "name": name,
                "type": entity_type,
                "text": text,
                **kwargs
            }
        }


class SkillFactory:
    """Factory for creating skill test data."""

    @staticmethod
    def create_skill(
        skill_id: Optional[str] = None,
        occupation: str = "Software Engineer",
        skills: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Create skills for testing."""
        return {
            "skill_id": skill_id or f"skill_{uuid.uuid4().hex[:8]}",
            "occupation": occupation,
            "skills": skills or [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

    @staticmethod
    def create_skill_item(
        name: str = "Test Skill",
        description: str = "Test skill description",
        proficiency: float = 0.8,
        **kwargs
    ) -> Dict[str, Any]:
        """Create a skill item for testing."""
        return {
            "name": name,
            "description": description,
            "proficiency": proficiency,
            **kwargs
        }


class PaginationFactory:
    """Factory for creating pagination test data."""

    @staticmethod
    def create_pagination(
        page: int = 1,
        per_page: int = 20,
        total: int = 100,
    ) -> Dict[str, Any]:
        """Create pagination metadata."""
        pages = (total + per_page - 1) // per_page
        return {
            "page": page,
            "per_page": per_page,
            "total": total,
            "pages": pages,
            "has_next": page < pages,
            "has_prev": page > 1,
        }


class AuthFactory:
    """Factory for creating authentication test data."""

    @staticmethod
    def create_token(user_id: str = "test-user") -> str:
        """Create a test token."""
        return f"test-token-{user_id}"

    @staticmethod
    def create_auth_header(token: Optional[str] = None) -> Dict[str, str]:
        """Create Authorization header."""
        if token is None:
            token = AuthFactory.create_token()
        return {"Authorization": f"Bearer {token}"}

    @staticmethod
    def create_user_context(
        user_id: str = "test-user",
        roles: Optional[List[str]] = None,
        permissions: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Create user context."""
        return {
            "user_id": user_id,
            "roles": roles or ["user"],
            "permissions": permissions or ["read", "write"],
        }

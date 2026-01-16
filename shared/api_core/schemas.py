"""
Pydantic models for request validation.

These models provide type-safe request validation with detailed error messages.
Can be used alongside or instead of RequestValidator for enhanced validation.

This module requires Pydantic to be installed. If Pydantic is not available,
imports from this module will fail, which is handled gracefully in __init__.py.
"""

from typing import Optional, Dict, Any, List, Type

# Pydantic is required for this module - let ImportError propagate to __init__.py
from pydantic import BaseModel, Field, field_validator, model_validator, ValidationError as PydanticValidationError

# Mark Pydantic as available (since we got here, import succeeded)
PYDANTIC_AVAILABLE = True


class RoleModelRequest(BaseModel):
    """Role model data for agent creation."""
    name: str = Field(..., min_length=1, max_length=200, description="Agent name")
    occupation: str = Field(..., min_length=1, max_length=200, description="Agent occupation")

    class Config:
        """Pydantic configuration."""
        extra = "allow"  # Allow additional fields for backward compatibility
        json_schema_extra = {
            "example": {
                "name": "Bob Ross",
                "occupation": "Artist"
            }
        }


class AgentCreateRequest(BaseModel):
    """Request model for creating an agent."""
    agent_id: str = Field(..., min_length=1, max_length=100, description="Unique agent identifier")
    role_model: RoleModelRequest = Field(..., description="Role model defining agent characteristics")
    deepening_cycles: int = Field(default=0, ge=0, le=11, description="Number of deepening cycles (0-11)")

    class Config:
        """Pydantic configuration."""
        extra = "forbid"  # Strict validation - reject unknown fields
        json_schema_extra = {
            "example": {
                "agent_id": "agent-123",
                "role_model": {
                    "name": "Bob Ross",
                    "occupation": "Artist"
                },
                "deepening_cycles": 3
            }
        }


class AgentUpdateRequest(BaseModel):
    """Request model for partial agent update (PATCH)."""
    role_model: Optional[Dict[str, Any]] = Field(default=None, description="Partial role model updates")
    deepening_cycles: Optional[int] = Field(default=None, ge=0, le=11, description="Number of deepening cycles (0-11)")

    @field_validator('role_model')
    @classmethod
    def validate_role_model(cls, v):
        """Validate role_model is a dictionary."""
        if v is not None and not isinstance(v, dict):
            raise ValueError("role_model must be an object/dictionary")
        return v

    @model_validator(mode='after')
    def at_least_one_field(self):
        """Ensure at least one field is provided for update."""
        if self.role_model is None and self.deepening_cycles is None:
            raise ValueError("At least one field (role_model, deepening_cycles) must be provided for update")
        return self

    class Config:
        """Pydantic configuration."""
        extra = "forbid"


class AgentReplaceRequest(BaseModel):
    """Request model for full agent replacement (PUT)."""
    role_model: RoleModelRequest = Field(..., description="Complete role model")
    deepening_cycles: int = Field(default=0, ge=0, le=11, description="Number of deepening cycles (0-11)")

    class Config:
        """Pydantic configuration."""
        extra = "forbid"


class KnowledgeCreateRequest(BaseModel):
    """Request model for creating a knowledge entry."""
    identifier: str = Field(..., min_length=1, max_length=200, description="Entity identifier/name")
    entity_type: Optional[str] = Field(default=None, max_length=100, description="Entity type (Person, Organization, etc.)")
    deepening_cycles: int = Field(default=0, ge=0, description="Number of deepening cycles (non-negative)")
    knowledge_items: Optional[List[Dict[str, Any]]] = Field(default=None, description="Optional pre-existing knowledge items")

    class Config:
        """Pydantic configuration."""
        extra = "forbid"
        json_schema_extra = {
            "example": {
                "identifier": "Bob Ross",
                "entity_type": "Person",
                "deepening_cycles": 3
            }
        }


class KnowledgeUpdateRequest(BaseModel):
    """Request model for partial knowledge update (PATCH)."""
    identifier: Optional[str] = Field(default=None, min_length=1, max_length=200, description="Entity identifier")
    entity_type: Optional[str] = Field(default=None, max_length=100, description="Entity type")
    deepening_cycles: Optional[int] = Field(default=None, ge=0, description="Number of deepening cycles")
    knowledge_items: Optional[List[Dict[str, Any]]] = Field(default=None, description="Knowledge items list")

    @field_validator('knowledge_items')
    @classmethod
    def validate_knowledge_items(cls, v):
        """Validate knowledge_items is a list."""
        if v is not None and not isinstance(v, list):
            raise ValueError("knowledge_items must be a list")
        return v

    @model_validator(mode='after')
    def at_least_one_field(self):
        """Ensure at least one field is provided for update."""
        if all(v is None for v in [self.identifier, self.entity_type, self.deepening_cycles, self.knowledge_items]):
            raise ValueError("At least one field must be provided for update")
        return self

    class Config:
        """Pydantic configuration."""
        extra = "forbid"


class KnowledgeReplaceRequest(BaseModel):
    """Request model for full knowledge replacement (PUT)."""
    identifier: str = Field(..., min_length=1, max_length=200, description="Entity identifier")
    entity_type: Optional[str] = Field(default=None, max_length=100, description="Entity type")
    deepening_cycles: int = Field(default=0, ge=0, description="Number of deepening cycles")
    knowledge_items: List[Dict[str, Any]] = Field(default_factory=list, description="Knowledge items list")

    @field_validator('knowledge_items')
    @classmethod
    def validate_knowledge_items(cls, v):
        """Validate knowledge_items is a list."""
        if not isinstance(v, list):
            raise ValueError("knowledge_items must be a list")
        return v

    class Config:
        """Pydantic configuration."""
        extra = "forbid"


class SkillCreateRequest(BaseModel):
    """Request model for creating skills."""
    occupation: str = Field(..., min_length=1, max_length=200, description="Occupation name")
    deepening_cycles: int = Field(default=0, ge=0, le=11, description="Number of deepening cycles (0-11)")
    corpus_text: Optional[str] = Field(default=None, description="Optional corpus text for skill generation")

    class Config:
        """Pydantic configuration."""
        extra = "forbid"
        json_schema_extra = {
            "example": {
                "occupation": "Software Engineer",
                "deepening_cycles": 5,
                "corpus_text": "Optional corpus text..."
            }
        }


class SkillUpdateRequest(BaseModel):
    """Request model for partial skill update (PATCH)."""
    occupation: Optional[str] = Field(default=None, min_length=1, max_length=200, description="Occupation name")
    deepening_cycles: Optional[int] = Field(default=None, ge=0, le=11, description="Number of deepening cycles (0-11)")
    skills: Optional[List[Dict[str, Any]]] = Field(default=None, description="Skills list")

    @field_validator('skills')
    @classmethod
    def validate_skills(cls, v):
        """Validate skills is a list."""
        if v is not None and not isinstance(v, list):
            raise ValueError("skills must be a list")
        return v

    @model_validator(mode='after')
    def at_least_one_field(self):
        """Ensure at least one field is provided for update."""
        if all(v is None for v in [self.occupation, self.deepening_cycles, self.skills]):
            raise ValueError("At least one field (occupation, deepening_cycles, skills) must be provided for update")
        return self

    class Config:
        """Pydantic configuration."""
        extra = "forbid"


class SkillReplaceRequest(BaseModel):
    """Request model for full skill replacement (PUT)."""
    occupation: str = Field(..., min_length=1, max_length=200, description="Occupation name")
    deepening_cycles: int = Field(default=0, ge=0, le=11, description="Number of deepening cycles (0-11)")
    skills: List[Dict[str, Any]] = Field(default_factory=list, description="Skills list")

    @field_validator('skills')
    @classmethod
    def validate_skills(cls, v):
        """Validate skills is a list."""
        if not isinstance(v, list):
            raise ValueError("skills must be a list")
        return v

    class Config:
        """Pydantic configuration."""
        extra = "forbid"


class JobRecord(BaseModel):
    """Placeholder schema for durable job records."""
    job_id: str = Field(..., min_length=1, description="Job identifier")
    job_type: str = Field(..., min_length=1, description="Job type")
    subject_type: Optional[str] = Field(default=None, description="Subject type (photo, session, etc.)")
    subject_id: Optional[str] = Field(default=None, description="Subject identifier")
    status: str = Field(default="queued", description="Job status")
    attempts: int = Field(default=0, ge=0, description="Attempt count")
    max_attempts: int = Field(default=3, ge=1, description="Max attempts")
    idempotency_key: Optional[str] = Field(default=None, description="Idempotency key")
    created_at: Optional[str] = Field(default=None, description="Creation timestamp")
    updated_at: Optional[str] = Field(default=None, description="Update timestamp")

    class Config:
        extra = "allow"


class JobEvent(BaseModel):
    """Placeholder schema for durable job events."""
    event_id: str = Field(..., min_length=1, description="Event identifier")
    job_id: str = Field(..., min_length=1, description="Job identifier")
    timestamp: str = Field(..., min_length=1, description="Event timestamp")
    type: str = Field(..., min_length=1, description="Event type")
    level: str = Field(default="info", description="Event level")
    message: Optional[str] = Field(default=None, description="Human readable message")
    data: Optional[Dict[str, Any]] = Field(default=None, description="Event payload")

    class Config:
        extra = "allow"


def validate_with_pydantic(model_class: Type[BaseModel], data: Dict[str, Any]) -> BaseModel:
    """
    Validate request data using Pydantic model.

    Args:
        model_class: Pydantic model class to validate against
        data: Request data dictionary

    Returns:
        Validated model instance

    Raises:
        ValidationError: If validation fails, converts Pydantic ValidationError to our ValidationError
    """
    if not PYDANTIC_AVAILABLE:
        raise RuntimeError("Pydantic is required for request validation. Install with: pip install pydantic")

    try:
        return model_class.model_validate(data)
    except PydanticValidationError as e:
        # Convert Pydantic validation errors to our ValidationError format
        from .models import ValidationError, ErrorCode

        errors = []
        for error in e.errors():
            field = ".".join(str(loc) for loc in error.get("loc", []))
            message = error.get("msg", "Validation error")
            errors.append(ValidationError(
                message=f"{field}: {message}",
                field=field,
                code=ErrorCode.INVALID_FORMAT.value if "type" in message.lower() else ErrorCode.REQUIRED_FIELD.value
            ))

        # Return the first error (or create a summary)
        if errors:
            raise errors[0]
        raise ValidationError(str(e), code=ErrorCode.INVALID_FORMAT.value)
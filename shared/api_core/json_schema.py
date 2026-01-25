"""
JSON Schema Validation

Design Pattern: Specification Pattern
- Validates request data against JSON Schema
- Provides detailed error messages
- Supports schema composition

References:
- JSON Schema Specification: https://json-schema.org/
- Python jsonschema library: https://python-jsonschema.readthedocs.io/
"""

import json
import logging
from typing import Dict, Any, Optional, List
from pathlib import Path
from functools import wraps

logger = logging.getLogger(__name__)

# Try to import jsonschema - optional dependency
try:
    from jsonschema import validate, ValidationError as JsonSchemaValidationError, Draft7Validator
    JSONSCHEMA_AVAILABLE = True
except ImportError:
    JSONSCHEMA_AVAILABLE = False
    JsonSchemaValidationError = Exception
    Draft7Validator = None

from .models import APIError, ErrorCode, ErrorCategory, ValidationError


# Common schema definitions
COMMON_SCHEMAS = {
    "uuid": {
        "type": "string",
        "pattern": "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$"
    },
    "email": {
        "type": "string",
        "format": "email",
        "maxLength": 255
    },
    "url": {
        "type": "string",
        "format": "uri",
        "maxLength": 2048
    },
    "timestamp": {
        "type": "string",
        "format": "date-time"
    },
    "positive_integer": {
        "type": "integer",
        "minimum": 1
    },
    "non_negative_integer": {
        "type": "integer",
        "minimum": 0
    },
    "percentage": {
        "type": "number",
        "minimum": 0,
        "maximum": 100
    },
    "confidence_score": {
        "type": "number",
        "minimum": 0,
        "maximum": 1
    },
}

# Service-specific schemas
AGENT_SCHEMAS = {
    "create_agent": {
        "type": "object",
        "required": ["agent_id", "role_model"],
        "properties": {
            "agent_id": {
                "type": "string",
                "minLength": 1,
                "maxLength": 255,
                "pattern": "^[a-zA-Z0-9_-]+$"
            },
            "role_model": {
                "type": "object",
                "required": ["name", "occupation"],
                "properties": {
                    "name": {
                        "type": "string",
                        "minLength": 1,
                        "maxLength": 255
                    },
                    "occupation": {
                        "type": "string",
                        "minLength": 1,
                        "maxLength": 255
                    },
                    "description": {
                        "type": "string",
                        "maxLength": 5000
                    },
                    "traits": {
                        "type": "array",
                        "items": {"type": "string", "maxLength": 100},
                        "maxItems": 50
                    }
                },
                "additionalProperties": False
            },
            "deepening_cycles": {
                "type": "integer",
                "minimum": 0,
                "maximum": 11,
                "default": 0
            }
        },
        "additionalProperties": False
    },
    "update_agent": {
        "type": "object",
        "properties": {
            "role_model": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "minLength": 1,
                        "maxLength": 255
                    },
                    "occupation": {
                        "type": "string",
                        "minLength": 1,
                        "maxLength": 255
                    },
                    "description": {
                        "type": "string",
                        "maxLength": 5000
                    }
                }
            },
            "deepening_cycles": {
                "type": "integer",
                "minimum": 0,
                "maximum": 11
            }
        },
        "additionalProperties": False
    }
}

KNOWLEDGE_SCHEMAS = {
    "create_knowledge": {
        "type": "object",
        "required": ["identifier"],
        "properties": {
            "identifier": {
                "type": "string",
                "minLength": 1,
                "maxLength": 500
            },
            "entity_type": {
                "type": "string",
                "enum": ["Person", "Organization", "Concept", "Event", "Place", "Thing"],
                "default": "Person"
            },
            "deepening_cycles": {
                "type": "integer",
                "minimum": 0,
                "maximum": 11,
                "default": 0
            }
        },
        "additionalProperties": False
    }
}

SKILL_SCHEMAS = {
    "create_skills": {
        "type": "object",
        "required": ["occupation"],
        "properties": {
            "occupation": {
                "type": "string",
                "minLength": 1,
                "maxLength": 255
            },
            "deepening_cycles": {
                "type": "integer",
                "minimum": 0,
                "maximum": 11,
                "default": 0
            },
            "corpus_text": {
                "type": "string",
                "maxLength": 100000  # 100KB max
            }
        },
        "additionalProperties": False
    }
}

# Registry of all schemas
SCHEMA_REGISTRY: Dict[str, Dict[str, Any]] = {
    **{f"agent.{k}": v for k, v in AGENT_SCHEMAS.items()},
    **{f"knowledge.{k}": v for k, v in KNOWLEDGE_SCHEMAS.items()},
    **{f"skill.{k}": v for k, v in SKILL_SCHEMAS.items()},
}


class SchemaValidationError(ValidationError):
    """Validation error with schema details."""
    def __init__(
        self,
        message: str,
        field: Optional[str] = None,
        schema_path: Optional[str] = None,
        errors: Optional[List[Dict[str, Any]]] = None
    ):
        super().__init__(message, field)
        self.schema_path = schema_path
        self.validation_errors = errors or []


def validate_json_schema(
    data: Dict[str, Any],
    schema: Dict[str, Any],
    schema_name: Optional[str] = None
) -> None:
    """
    Validate data against JSON schema.
    
    Args:
        data: Data to validate
        schema: JSON schema
        schema_name: Optional name for error messages
        
    Raises:
        SchemaValidationError: If validation fails
    """
    if not JSONSCHEMA_AVAILABLE:
        logger.warning("jsonschema not installed, skipping validation")
        return

    try:
        validate(instance=data, schema=schema)
    except JsonSchemaValidationError as e:
        # Extract field path
        field_path = ".".join(str(p) for p in e.absolute_path) if e.absolute_path else None

        # Create detailed error
        raise SchemaValidationError(
            message=e.message,
            field=field_path,
            schema_path=schema_name,
            errors=[
                {
                    "path": field_path,
                    "message": e.message,
                    "schema_path": (
                        ".".join(str(p) for p in e.schema_path)
                        if e.schema_path
                        else None
                    ),
                }
            ],
        ) from e


def validate_request_schema(schema_name: str):
    """
    Decorator to validate request body against schema.
    
    Args:
        schema_name: Name of schema in registry (e.g., "agent.create_agent")
        
    Usage:
        @app.route('/api/v1/agents', methods=['POST'])
        @validate_request_schema('agent.create_agent')
        def create_agent():
            ...
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                from flask import request
            except ImportError:
                return func(*args, **kwargs)
            
            # Get schema
            schema = SCHEMA_REGISTRY.get(schema_name)
            if not schema:
                logger.warning(f"Schema not found: {schema_name}")
                return func(*args, **kwargs)
            
            # Get request data
            data = request.get_json(silent=True) or {}
            
            # Validate
            try:
                validate_json_schema(data, schema, schema_name)
            except SchemaValidationError as e:
                from .models import APIError, ErrorCode, ErrorCategory
                from .utils import error_response
                
                error = APIError(
                    code=ErrorCode.INVALID_FIELD,
                    message=f"Schema validation failed: {e.message}",
                    category=ErrorCategory.VALIDATION_ERROR,
                    field=e.field,
                    details={
                        "schema": schema_name,
                        "errors": e.validation_errors
                    }
                )
                return error_response(error, status=422)
            
            return func(*args, **kwargs)
        return wrapper
    return decorator


def get_all_validation_errors(
    data: Dict[str, Any],
    schema: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """
    Get all validation errors (not just first).
    
    Args:
        data: Data to validate
        schema: JSON schema
        
    Returns:
        List of validation error details
    """
    if not JSONSCHEMA_AVAILABLE or Draft7Validator is None:
        return []

    validator = Draft7Validator(schema)
    return [
        {
            "path": ".".join(str(p) for p in error.absolute_path),
            "message": error.message,
            "schema_path": ".".join(str(p) for p in error.schema_path),
        }
        for error in validator.iter_errors(data)
    ]


def register_schema(name: str, schema: Dict[str, Any]) -> None:
    """
    Register a custom schema.
    
    Args:
        name: Schema name
        schema: JSON schema definition
    """
    SCHEMA_REGISTRY[name] = schema


def get_schema(name: str) -> Optional[Dict[str, Any]]:
    """
    Get schema by name.
    
    Args:
        name: Schema name
        
    Returns:
        Schema if found, None otherwise
    """
    return SCHEMA_REGISTRY.get(name)


def list_schemas() -> List[str]:
    """List all registered schema names."""
    return list(SCHEMA_REGISTRY.keys())

"""
OpenAPI/Swagger specification generation utilities for Chrysalis services.

Provides helpers for generating OpenAPI 3.0 specifications from Flask routes.
"""

from typing import Dict, Any, Optional, List
import json

try:
    from flask import Flask
    FLASK_AVAILABLE = True
except ImportError:
    FLASK_AVAILABLE = False
    Flask = None


def get_base_openapi_spec(
    title: str = "Chrysalis API",
    version: str = "1.0.0",
    description: str = "Chrysalis Unified API Standard",
    api_version: str = "v1"
) -> Dict[str, Any]:
    """
    Generate base OpenAPI 3.0 specification.

    Args:
        title: API title
        version: API version
        description: API description
        api_version: API version path (e.g., "v1")

    Returns:
        Base OpenAPI specification dictionary
    """
    return {
        "openapi": "3.0.3",
        "info": {
            "title": title,
            "version": version,
            "description": description,
            "contact": {
                "name": "Chrysalis API Support",
                "url": "https://docs.chrysalis.dev",
            },
        },
        "servers": [
            {
                "url": f"http://localhost:5000/api/{api_version}",
                "description": "Development server"
            },
            {
                "url": f"https://api.chrysalis.dev/api/{api_version}",
                "description": "Production server"
            },
        ],
        "paths": {},
        "components": {
            "schemas": {
                "APIResponse": {
                    "type": "object",
                    "properties": {
                        "success": {
                            "type": "boolean",
                            "description": "Indicates if the request was successful"
                        },
                        "data": {
                            "description": "Response data (present if success is true)"
                        },
                        "error": {
                            "$ref": "#/components/schemas/APIError"
                        },
                        "meta": {
                            "$ref": "#/components/schemas/ResponseMeta"
                        }
                    },
                    "required": ["success"]
                },
                "APIError": {
                    "type": "object",
                    "properties": {
                        "code": {
                            "type": "string",
                            "description": "Error code"
                        },
                        "message": {
                            "type": "string",
                            "description": "Human-readable error message"
                        },
                        "category": {
                            "type": "string",
                            "enum": [
                                "VALIDATION_ERROR",
                                "AUTHENTICATION_ERROR",
                                "AUTHORIZATION_ERROR",
                                "NOT_FOUND_ERROR",
                                "CONFLICT_ERROR",
                                "RATE_LIMIT_ERROR",
                                "SERVICE_ERROR",
                                "UPSTREAM_ERROR"
                            ],
                            "description": "Error category"
                        },
                        "details": {
                            "type": "array",
                            "items": {
                                "$ref": "#/components/schemas/ErrorDetail"
                            }
                        },
                        "request_id": {
                            "type": "string",
                            "description": "Request ID for tracing"
                        },
                        "timestamp": {
                            "type": "string",
                            "format": "date-time",
                            "description": "Error timestamp"
                        },
                        "documentation_url": {
                            "type": "string",
                            "format": "uri"
                        },
                        "retry_after": {
                            "type": "integer",
                            "description": "Seconds to wait before retrying (rate limit errors)"
                        }
                    },
                    "required": ["code", "message", "category", "timestamp"]
                },
                "ErrorDetail": {
                    "type": "object",
                    "properties": {
                        "field": {"type": "string"},
                        "code": {"type": "string"},
                        "message": {"type": "string"},
                        "path": {
                            "type": "array",
                            "items": {"type": "string"}
                        }
                    }
                },
                "ResponseMeta": {
                    "type": "object",
                    "properties": {
                        "request_id": {"type": "string"},
                        "timestamp": {
                            "type": "string",
                            "format": "date-time"
                        },
                        "version": {"type": "string"},
                        "pagination": {
                            "$ref": "#/components/schemas/PaginationMeta"
                        }
                    }
                },
                "PaginationMeta": {
                    "type": "object",
                    "properties": {
                        "page": {
                            "type": "integer",
                            "minimum": 1
                        },
                        "per_page": {
                            "type": "integer",
                            "minimum": 1,
                            "maximum": 100
                        },
                        "total": {"type": "integer"},
                        "total_pages": {"type": "integer"},
                        "has_next": {"type": "boolean"},
                        "has_prev": {"type": "boolean"}
                    },
                    "required": ["page", "per_page", "total", "total_pages", "has_next", "has_prev"]
                },
                "PaginationParams": {
                    "type": "object",
                    "properties": {
                        "page": {
                            "type": "integer",
                            "minimum": 1,
                            "default": 1,
                            "description": "Page number (1-indexed)"
                        },
                        "per_page": {
                            "type": "integer",
                            "minimum": 1,
                            "maximum": 100,
                            "default": 20,
                            "description": "Items per page"
                        }
                    }
                },
                "FilterParams": {
                    "type": "object",
                    "description": "Filter parameters. Use filter[field]=value for equality, filter[field][op]=value for operators (eq, ne, gt, gte, lt, lte, in, contains)",
                    "additionalProperties": True
                },
                "SortParams": {
                    "type": "object",
                    "properties": {
                        "sort": {
                            "type": "string",
                            "description": "Comma-separated field names. Prefix with '-' for descending order (e.g., '-created_at,name')"
                        }
                    }
                }
            },
            "securitySchemes": {
                "bearerAuth": {
                    "type": "http",
                    "scheme": "bearer",
                    "bearerFormat": "JWT",
                    "description": "JWT token or API key in Bearer format"
                }
            }
        },
        "security": [
            {
                "bearerAuth": []
            }
        ]
    }


def create_openapi_endpoint_spec(
    method: str,
    summary: str,
    description: Optional[str] = None,
    tags: Optional[List[str]] = None,
    request_body: Optional[Dict[str, Any]] = None,
    parameters: Optional[List[Dict[str, Any]]] = None,
    responses: Optional[Dict[str, Dict[str, Any]]] = None,
    security: Optional[List[Dict[str, List[str]]]] = None
) -> Dict[str, Any]:
    """
    Create OpenAPI endpoint specification.

    Args:
        method: HTTP method (lowercase)
        summary: Endpoint summary
        description: Endpoint description
        tags: Tags for grouping endpoints
        request_body: Request body schema
        parameters: Query/path parameters
        responses: Response schemas by status code
        security: Security requirements (None = inherit from global)

    Returns:
        OpenAPI path item specification
    """
    spec: Dict[str, Any] = {
        "summary": summary,
    }

    if description:
        spec["description"] = description

    if tags:
        spec["tags"] = tags

    if parameters:
        spec["parameters"] = parameters

    if request_body:
        spec["requestBody"] = {
            "required": True,
            "content": {
                "application/json": {
                    "schema": request_body
                }
            }
        }

    if responses is None:
        responses = {
            "200": {
                "description": "Successful response",
                "content": {
                    "application/json": {
                        "schema": {"$ref": "#/components/schemas/APIResponse"}
                    }
                }
            },
            "400": {
                "description": "Bad request",
                "content": {
                    "application/json": {
                        "schema": {"$ref": "#/components/schemas/APIResponse"}
                    }
                }
            },
            "401": {
                "description": "Unauthorized",
                "content": {
                    "application/json": {
                        "schema": {"$ref": "#/components/schemas/APIResponse"}
                    }
                }
            },
            "500": {
                "description": "Internal server error",
                "content": {
                    "application/json": {
                        "schema": {"$ref": "#/components/schemas/APIResponse"}
                    }
                }
            }
        }

    spec["responses"] = responses

    if security is not None:
        spec["security"] = security

    return spec


def generate_openapi_spec_from_flask(app: Flask, title: str, version: str) -> Dict[str, Any]:
    """
    Generate OpenAPI specification from Flask app routes.

    **Note**: This is an alternative approach for manual OpenAPI spec generation.
    Most services use `flasgger` (via `setup_swagger()`) which auto-generates
    specs from docstrings. This function is provided for cases where manual
    control over the spec is needed or when flasgger is not available.

    This is a basic implementation that extracts routes and methods but does not
    include detailed request/response schemas. For production use, consider:
    - Using `flasgger` with docstring-based spec generation (recommended)
    - Manually maintaining OpenAPI specs using `get_base_openapi_spec()` and
      `create_openapi_endpoint_spec()` helpers

    Args:
        app: Flask application
        title: API title
        version: API version

    Returns:
        OpenAPI specification dictionary
    """
    if not FLASK_AVAILABLE:
        raise RuntimeError("Flask is required for OpenAPI generation")

    spec = get_base_openapi_spec(title=title, version=version)

    # Add paths from Flask routes
    for rule in app.url_map.iter_rules():
        if rule.endpoint == 'static':
            continue

        path = rule.rule
        methods = [m.lower() for m in rule.methods if m not in ['HEAD', 'OPTIONS']]

        for method in methods:
            if path not in spec["paths"]:
                spec["paths"][path] = {}

            # Basic endpoint spec (can be enhanced with route metadata)
            spec["paths"][path][method] = {
                "summary": f"{method.upper()} {path}",
                "responses": {
                    "200": {
                        "description": "Success",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/APIResponse"}
                            }
                        }
                    }
                }
            }

    return spec


def save_openapi_spec(spec: Dict[str, Any], filepath: str) -> None:
    """
    Save OpenAPI specification to file.

    Args:
        spec: OpenAPI specification dictionary
        filepath: Path to save the spec file
    """
    with open(filepath, 'w') as f:
        json.dump(spec, f, indent=2)

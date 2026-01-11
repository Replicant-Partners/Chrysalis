"""
Utility functions for Flask API endpoints.

Provides helper functions to reduce boilerplate in endpoint implementations.
"""

from typing import Any, Optional, Dict
from .models import APIResponse, APIError, ErrorCode, ErrorCategory, PaginationMeta

try:
    from flask import jsonify
    FLASK_AVAILABLE = True
except ImportError:
    FLASK_AVAILABLE = False
    jsonify = None


def json_response(
    data: Any,
    status: int = 200,
    pagination: Optional[PaginationMeta] = None,
    request_id: Optional[str] = None
):
    """
    Create a JSON response from data.

    Helper function to reduce boilerplate: replaces the pattern
    `response = APIResponse.success_response(data); return jsonify(response.to_dict()), 200`

    Args:
        data: Response data
        status: HTTP status code (default: 200)
        pagination: Optional pagination metadata
        request_id: Optional request ID

    Returns:
        Tuple of (jsonified response, status code) for Flask routes

    Example:
        @app.route('/api/v1/resource', methods=['GET'])
        def get_resource():
            data = {'id': 1, 'name': 'Test'}
            return json_response(data, status=200)

        # Equivalent to:
        # response = APIResponse.success_response(data)
        # return jsonify(response.to_dict()), 200
    """
    if not FLASK_AVAILABLE:
        raise RuntimeError("Flask is required for json_response. Install Flask.")

    response = APIResponse.success_response(data, pagination=pagination, request_id=request_id)
    return jsonify(response.to_dict()), status


def error_response(
    error: APIError,
    status: int = 400
):
    """
    Create an error JSON response.

    Helper function to reduce boilerplate: replaces the pattern
    `response, status = APIResponse.error_response(error, status_code=404); return jsonify(response.to_dict()), status`

    Args:
        error: APIError instance
        status: HTTP status code (default: 400)

    Returns:
        Tuple of (jsonified response, status code) for Flask routes

    Example:
        @app.route('/api/v1/resource/<id>', methods=['GET'])
        def get_resource(id):
            if id not in store:
                error = APIError(
                    code=ErrorCode.RESOURCE_NOT_FOUND,
                    message=f"Resource '{id}' not found",
                    category=ErrorCategory.NOT_FOUND_ERROR,
                )
                return error_response(error, status=404)
    """
    if not FLASK_AVAILABLE:
        raise RuntimeError("Flask is required for error_response. Install Flask.")

    response, _ = APIResponse.error_response(error, status_code=status)
    return jsonify(response.to_dict()), status


def require_resource_exists(
    store: Dict[str, Any],
    resource_id: str,
    resource_name: str = "Resource"
) -> Any:
    """
    Check if a resource exists in a store, or raise a 404 error.

    Helper function to reduce boilerplate for resource existence checks.

    Args:
        store: Dictionary store containing resources
        resource_id: ID of the resource to check
        resource_name: Name of the resource type (e.g., "Agent", "Knowledge")

    Returns:
        The resource if found

    Raises:
        APIError: If resource is not found (category=NOT_FOUND_ERROR, code=RESOURCE_NOT_FOUND)

    Example:
        @app.route('/api/v1/agents/<agent_id>', methods=['GET'])
        def get_agent(agent_id: str):
            agent = require_resource_exists(agents_store, agent_id, "Agent")
            return json_response(agent)

        # Equivalent to:
        # if agent_id not in agents_store:
        #     error = APIError(...)
        #     return error_response(error, status=404)
        # agent = agents_store[agent_id]
    """
    if resource_id not in store:
        raise APIError(
            code=ErrorCode.RESOURCE_NOT_FOUND,
            message=f"{resource_name} '{resource_id}' not found",
            category=ErrorCategory.NOT_FOUND_ERROR,
        )
    return store[resource_id]

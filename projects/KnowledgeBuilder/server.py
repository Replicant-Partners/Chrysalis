"""
KnowledgeBuilder Service - Unified API Standard

Collects and structures knowledge about entities using multi-source search and fact extraction.
"""

import sys
from pathlib import Path
from flask import Flask, request, jsonify, g
from datetime import datetime, timezone
import os
from typing import Optional, Dict, List, Any

# Add shared directory to path
PROJECT_ROOT = Path(__file__).resolve().parents[3]
SHARED_PATH = PROJECT_ROOT / "shared"
if str(SHARED_PATH) not in sys.path:
    sys.path.insert(0, str(SHARED_PATH))

from shared.api_core import (
    APIResponse,
    APIError,
    ErrorCode,
    ErrorCategory,
    ValidationError,
    RequestValidator,
    PaginationParams,
    PaginationMeta,
    FilterParams,
    SortParams,
    process_list_request,
    json_response,
    error_response,
    require_resource_exists,
    require_auth,
    authenticate_request,
    create_error_handler,
    create_all_middleware,
)

from src.pipeline.simple_pipeline import run_knowledge_pipeline, SimplePipeline

app = Flask(__name__)

# Setup middleware
create_error_handler(app)
create_all_middleware(app, api_version="v1")

# Setup Swagger/OpenAPI documentation
try:
    from shared.api_core.swagger import setup_swagger, create_swagger_config
    swagger_config = create_swagger_config(
        title="KnowledgeBuilder API",
        version="1.0.0",
        description="KnowledgeBuilder Service - Collects and structures knowledge about entities using multi-source search and fact extraction.",
        api_version="v1"
    )
    setup_swagger(app, swagger_config)
except ImportError:
    # flasgger not installed - skip Swagger UI
    pass

# In-memory knowledge store (replace with database in production)
knowledge_store: Dict[str, Dict[str, Any]] = {}

@app.route('/health', methods=['GET'])
def health():
    """
    Health check endpoint.
    ---
    tags:
      - Health
    summary: Health check
    description: Returns service health status
    responses:
      200:
        description: Service is healthy
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/APIResponse'
        examples:
          application/json:
            success: true
            data:
              status: healthy
              service: knowledgebuilder
    """
    return jsonify(APIResponse.success_response(
        {"status": "healthy", "service": "knowledgebuilder"}
    ).to_dict()), 200

@app.route('/api/v1/knowledge', methods=['POST'])
@require_auth
def create_knowledge():
    """Create knowledge entry for an entity."""
    try:
        data = request.get_json() or {}

        # Validate request
        identifier = RequestValidator.require_string(data, 'identifier', min_length=1)
        entity_type = data.get('entity_type')
        deepening_cycles = data.get('deepening_cycles', 0)
        if not isinstance(deepening_cycles, int) or deepening_cycles < 0:
            deepening_cycles = 0

        # Extract API keys from Authorization header (not request body)
        # For now, we'll keep the legacy support but log a warning
        api_keys = data.get('apiKeys', {})
        if api_keys:
            # Log warning but still process (for backwards compatibility during transition)
            import logging
            logger = logging.getLogger(__name__)
            logger.warning("API keys passed in request body - use Authorization header instead")
            # Set API keys as environment variables (legacy behavior)
            for key, value in api_keys.items():
                os.environ[key] = value

        # Run knowledge pipeline
        results = run_knowledge_pipeline(identifier, entity_type, deepening_cycles)

        # Store knowledge entries
        knowledge_id = f"{entity_type or 'Entity'}:{identifier}".lower().replace(' ', '_')
        knowledge_store[knowledge_id] = {
            'knowledge_id': knowledge_id,
            'identifier': identifier,
            'entity_type': entity_type,
            'knowledge_items': results,
            'deepening_cycles': deepening_cycles,
        }

        # Return standardized response
        return json_response({
            'knowledge_id': knowledge_id,
            'identifier': identifier,
            'entity_type': entity_type,
            'knowledge_items': results,
        })

    except ValidationError as e:
        error = APIError.from_exception(e)
        return error_response(error, status=422)
    except Exception as e:
        error = APIError(
            code=ErrorCode.INTERNAL_ERROR,
            message=f"Internal server error: {str(e)}",
            category=ErrorCategory.SERVICE_ERROR,
        )
        return error_response(error, status=500)

@app.route('/api/v1/knowledge/<knowledge_id>', methods=['GET'])
@require_auth
def get_knowledge(knowledge_id: str):
    """Get knowledge entry by ID."""
    knowledge = require_resource_exists(knowledge_store, knowledge_id, "Knowledge")
    return json_response(knowledge)

@app.route('/api/v1/knowledge', methods=['GET'])
@require_auth
def list_knowledge():
    """List all knowledge entries."""
    # Get all knowledge entries
    all_knowledge = list(knowledge_store.values())

    # Apply filters, sorting, and pagination
    knowledge_page, pagination_meta = process_list_request(all_knowledge)

    return json_response(knowledge_page,
        pagination=pagination_meta)

@app.route('/api/v1/knowledge/search', methods=['POST'])
@require_auth
def search_knowledge():
    """Advanced search for knowledge entries."""
    try:
        data = request.get_json() or {}

        query = RequestValidator.require_string(data, 'query', min_length=1)
        entity_type = data.get('entity_type')
        limit = data.get('limit', 10)

        # Use SimplePipeline search if available
        pipeline = SimplePipeline()
        results = pipeline.search(query, k=limit, entity_type=entity_type)

        return json_response({
            'query': query,
            'results': results,
        })

    except ValidationError as e:
        error = APIError.from_exception(e)
        return error_response(error, status=422)
    except Exception as e:
        error = APIError(
            code=ErrorCode.INTERNAL_ERROR,
            message=f"Search failed: {str(e)}",
            category=ErrorCategory.SERVICE_ERROR,
        )
        return error_response(error, status=500)

@app.route('/api/v1/knowledge/entities/<entity_id>', methods=['GET'])
@require_auth
def get_knowledge_by_entity(entity_id: str):
    """Get knowledge entries for a specific entity."""
    # Find knowledge by entity identifier
    matching_knowledge = [
        k for k in knowledge_store.values()
        if k.get('identifier', '').lower() == entity_id.lower()
    ]

    if not matching_knowledge:
        error = APIError(
            code=ErrorCode.RESOURCE_NOT_FOUND,
            message=f"No knowledge found for entity '{entity_id}'",
            category=ErrorCategory.NOT_FOUND_ERROR,
        )
        return error_response(error, status=404)

    return json_response(matching_knowledge[0] if len(matching_knowledge) == 1 else matching_knowledge)

@app.route('/api/v1/knowledge/<knowledge_id>', methods=['PATCH'])
@require_auth
def update_knowledge(knowledge_id: str):
    """Partially update knowledge entry."""
    knowledge = require_resource_exists(knowledge_store, knowledge_id, "Knowledge")

    try:
        data = request.get_json() or {}

        # Update allowed fields
        if 'identifier' in data:
            knowledge['identifier'] = RequestValidator.require_string(data, 'identifier', min_length=1)

        if 'entity_type' in data:
            knowledge['entity_type'] = data['entity_type']

        if 'knowledge_items' in data:
            if isinstance(data['knowledge_items'], list):
                knowledge['knowledge_items'] = data['knowledge_items']
            else:
                error = APIError(
                    code=ErrorCode.INVALID_TYPE,
                    message="knowledge_items must be a list",
                    category=ErrorCategory.VALIDATION_ERROR,
                )
                return error_response(error, status=422)

        if 'deepening_cycles' in data:
            deepening_cycles = data['deepening_cycles']
            if isinstance(deepening_cycles, int) and deepening_cycles >= 0:
                knowledge['deepening_cycles'] = deepening_cycles
            else:
                error = APIError(
                    code=ErrorCode.INVALID_RANGE,
                    message="deepening_cycles must be a non-negative integer",
                    category=ErrorCategory.VALIDATION_ERROR,
                )
                return error_response(error, status=422)

        # Update timestamp
        knowledge['updated_at'] = datetime.now(timezone.utc).isoformat()

        return json_response(knowledge)

    except ValidationError as e:
        error = APIError.from_exception(e)
        return error_response(error, status=422)
    except Exception as e:
        error = APIError(
            code=ErrorCode.INTERNAL_ERROR,
            message=f"Update failed: {str(e)}",
            category=ErrorCategory.SERVICE_ERROR,
        )
        return error_response(error, status=500)

@app.route('/api/v1/knowledge/<knowledge_id>', methods=['PUT'])
@require_auth
def replace_knowledge(knowledge_id: str):
    """Replace knowledge entry (full update)."""
    try:
        data = request.get_json() or {}

        # Validate required fields
        identifier = RequestValidator.require_string(data, 'identifier', min_length=1)
        entity_type = data.get('entity_type')
        deepening_cycles = data.get('deepening_cycles', 0)
        if not isinstance(deepening_cycles, int) or deepening_cycles < 0:
            deepening_cycles = 0

        knowledge_items = data.get('knowledge_items', [])
        if not isinstance(knowledge_items, list):
            knowledge_items = []

        # Replace entire knowledge entry
        knowledge_store[knowledge_id] = {
            'knowledge_id': knowledge_id,
            'identifier': identifier,
            'entity_type': entity_type,
            'knowledge_items': knowledge_items,
            'deepening_cycles': deepening_cycles,
            'updated_at': datetime.now(timezone.utc).isoformat(),
        }

        return json_response(knowledge_store[knowledge_id])

    except ValidationError as e:
        error = APIError.from_exception(e)
        return error_response(error, status=422)
    except Exception as e:
        error = APIError(
            code=ErrorCode.INTERNAL_ERROR,
            message=f"Replace failed: {str(e)}",
            category=ErrorCategory.SERVICE_ERROR,
        )
        return error_response(error, status=500)

@app.route('/api/v1/knowledge/<knowledge_id>', methods=['DELETE'])
@require_auth
def delete_knowledge(knowledge_id: str):
    """Delete knowledge entry."""
    knowledge = require_resource_exists(knowledge_store, knowledge_id, "Knowledge")

    del knowledge_store[knowledge_id]

    return json_response({'deleted': True, 'knowledge_id': knowledge_id})

# Backwards compatibility endpoint (deprecated)
@app.route('/knowledge', methods=['POST'])
def create_knowledge_legacy():
    """Legacy endpoint (deprecated - use POST /api/v1/knowledge)."""
    data = request.get_json() or {}

    identifier = data.get('identifier')
    if not identifier:
        error = APIError(
            code=ErrorCode.REQUIRED_FIELD,
            message="Missing 'identifier' field",
            category=ErrorCategory.VALIDATION_ERROR,
        )
        return error_response(error, status=400)

    # Convert to new format and call new endpoint
    new_data = {
        'identifier': identifier,
        'entity_type': data.get('entity_type'),
        'deepening_cycles': data.get('deepening_cycles', 0),
        'apiKeys': data.get('apiKeys', {}),
    }

    # Store original request data temporarily
    request._cached_json = (new_data, new_data)

    # Call new endpoint
    response_data = create_knowledge()
    if isinstance(response_data, tuple):
        json_response, status_code = response_data
        if isinstance(json_response, dict):
            json_response.setdefault('meta', {})['deprecated'] = True
            json_response['meta']['deprecation_notice'] = "Use POST /api/v1/knowledge instead"
            # Transform response to legacy format
            if 'data' in json_response and 'knowledge_items' in json_response['data']:
                return jsonify({'knowledge_items': json_response['data']['knowledge_items']}), status_code
            return jsonify(json_response), status_code

    return response_data

if __name__ == '__main__':
    print('--- KnowledgeBuilder Server Starting ---')
    print('API Version: v1')
    print('Health: http://localhost:5002/health')
    print('API Base: http://localhost:5002/api/v1')
    app.run(port=5002, debug=True)

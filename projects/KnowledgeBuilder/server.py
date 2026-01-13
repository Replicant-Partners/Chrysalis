"""
KnowledgeBuilder Service - Unified API Standard

Collects and structures knowledge about entities using multi-source search and fact extraction.
"""

import logging
import sys
from pathlib import Path
from flask import Flask, request, jsonify
from datetime import datetime, timezone
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
    create_credentials_middleware,
    get_request_credentials,
)

from memory_system.ports import KnowledgeArtifactBatch
from src.memory import (
    builder_memory_enabled,
    strict_memory_persistence_enabled,
    create_memory_port,
    run_async_task,
    store_knowledge_async,
    new_run_id,
    builder_version,
    builder_agent_id,
    artifacts_from_results,
)
from src.pipeline.simple_pipeline import run_knowledge_pipeline, SimplePipeline

app = Flask(__name__)
logger = logging.getLogger(__name__)

# Setup middleware
create_error_handler(app)
create_all_middleware(app, api_version="v1")
create_credentials_middleware(app)

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


def _persist_results_to_memory(results: List[Dict[str, Any]], knowledge_id: str, run_id: str) -> bool:
    """Persist pipeline results into the shared memory stack when enabled."""

    if not builder_memory_enabled():
        return False

    try:
        agent_id = builder_agent_id()
        artifacts = artifacts_from_results(agent_id, results)
        if not artifacts:
            logger.info(
                "KnowledgeBuilder memory persistence skipped (no artifacts)",
                extra={"knowledge_id": knowledge_id, "run_id": run_id},
            )
            return False

        batch = KnowledgeArtifactBatch(
            agent_id=agent_id,
            artifacts=artifacts,
            run_id=run_id,
            builder_version=builder_version(),
        )

        port = create_memory_port(agent_id=agent_id)
        warn_message = (
            f"KnowledgeBuilder memory persistence failed for knowledge_id={knowledge_id}, run_id={run_id}"
        )
        run_async_task(
            store_knowledge_async(port, batch),
            warn_message=warn_message,
        )
        return True
    except Exception as exc:  # noqa: BLE001
        if strict_memory_persistence_enabled():
            raise
        logger.warning(
            "KnowledgeBuilder memory persistence encountered an error",
            extra={"error": str(exc), "knowledge_id": knowledge_id, "run_id": run_id},
        )
        return False

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
        run_id = new_run_id()

        # Validate request
        identifier = RequestValidator.require_string(data, 'identifier', min_length=1)
        entity_type = data.get('entity_type')
        deepening_cycles = data.get('deepening_cycles', 0)
        if not isinstance(deepening_cycles, int) or deepening_cycles < 0:
            deepening_cycles = 0

        credentials = get_request_credentials()

        api_keys = data.get('apiKeys', {})
        if api_keys:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(
                "apiKeys passed in request body are ignored; supply Authorization header instead",
                extra={"path": request.path}
            )

        # Run knowledge pipeline
        results = run_knowledge_pipeline(identifier, entity_type, deepening_cycles)

        # Store knowledge entries
        knowledge_id = f"{entity_type or 'Entity'}:{identifier}".lower().replace(' ', '_')
        memory_persisted = _persist_results_to_memory(results, knowledge_id, run_id)
        knowledge_store[knowledge_id] = {
            'knowledge_id': knowledge_id,
            'identifier': identifier,
            'entity_type': entity_type,
            'knowledge_items': results,
            'deepening_cycles': deepening_cycles,
            'run_id': run_id,
            'memory_persisted': memory_persisted,
        }

        # Return standardized response
        return json_response({
            'knowledge_id': knowledge_id,
            'identifier': identifier,
            'entity_type': entity_type,
            'knowledge_items': results,
            'run_id': run_id,
            'memory_persisted': memory_persisted,
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

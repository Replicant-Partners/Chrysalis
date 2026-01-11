"""
AgentBuilder Service - Unified API Standard

Builds complete agents by orchestrating KnowledgeBuilder and SkillBuilder services.
"""

import sys
from pathlib import Path
from flask import Flask, request, jsonify, g
from datetime import datetime, timezone
from typing import Any, Dict, List
import requests
import os

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
    require_auth,
    authenticate_request,
    create_error_handler,
    create_all_middleware,
)

app = Flask(__name__)

# Configure services
SKILL_BUILDER_URL = os.getenv("SKILL_BUILDER_URL", "http://localhost:5001")
KNOWLEDGE_BUILDER_URL = os.getenv("KNOWLEDGE_BUILDER_URL", "http://localhost:5002")

# Setup middleware
create_error_handler(app)
create_all_middleware(app, api_version="v1")

# Setup Swagger/OpenAPI documentation
try:
    from shared.api_core.swagger import setup_swagger, create_swagger_config
    swagger_config = create_swagger_config(
        title="AgentBuilder API",
        version="1.0.0",
        description="AgentBuilder Service - Builds complete agents by orchestrating KnowledgeBuilder and SkillBuilder services.",
        api_version="v1"
    )
    setup_swagger(app, swagger_config)
except ImportError:
    # flasgger not installed - skip Swagger UI
    pass

# In-memory agent store (replace with database in production)
agents_store = {}

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
              service: agentbuilder
    """
    return json_response(
        {"status": "healthy", "service": "agentbuilder"}
    ), 200

@app.route('/api/v1/agents', methods=['POST'])
@require_auth
def create_agent():
    """Create a new agent."""
    try:
        data = request.get_json() or {}

        # Validate request
        role_model = RequestValidator.require_field(data, 'role_model', 'roleModel')
        agent_id = RequestValidator.require_field(data, 'agent_id', 'agentId')
        model_name = RequestValidator.require_string(role_model, 'name', min_length=1)
        occupation = RequestValidator.require_string(role_model, 'occupation', min_length=1)
        deepening_cycles = data.get('deepening_cycles', 0)
        if not isinstance(deepening_cycles, int) or deepening_cycles < 0:
            deepening_cycles = 0

        # Check if agent already exists
        if agent_id in agents_store:
            error = APIError(
                code=ErrorCode.DUPLICATE_RESOURCE,
                message=f"Agent with id '{agent_id}' already exists",
                category=ErrorCategory.CONFLICT_ERROR,
            )
            return error_response(error, status=409)

        # Get API keys from Authorization header (not request body)
        api_keys = _extract_api_keys_from_headers(request)

        # Step 1: Build Knowledge Cloud
        knowledge_payload = {
            'identifier': model_name,
            'entity_type': 'Person',
            'deepening_cycles': deepening_cycles,
        }
        knowledge_response = requests.post(
            f"{KNOWLEDGE_BUILDER_URL}/api/v1/knowledge",
            json=knowledge_payload,
            headers=_get_forward_headers(request),
            timeout=300
        )
        knowledge_response.raise_for_status()
        knowledge_data = knowledge_response.json()
        knowledge_items = knowledge_data.get('data', {}).get('knowledge_items', []) if isinstance(knowledge_data.get('data'), dict) else []

        # Step 2: Aggregate text from knowledge items to create a corpus
        corpus_text = "\n\n".join([
            item.get('entity', {}).get('text', '')
            for item in knowledge_items
            if isinstance(item, dict) and 'entity' in item and isinstance(item['entity'], dict) and 'text' in item['entity']
        ])

        # Step 3: Build Skills from the aggregated corpus
        skill_payload = {
            'occupation': occupation,
            'deepening_cycles': deepening_cycles,
            'corpus_text': corpus_text
        }
        skill_response = requests.post(
            f"{SKILL_BUILDER_URL}/api/v1/skills",
            json=skill_payload,
            headers=_get_forward_headers(request),
            timeout=300
        )
        skill_response.raise_for_status()
        skill_data = skill_response.json()
        skills = skill_data.get('data', {}).get('skills', []) if isinstance(skill_data.get('data'), dict) else []

        # Store agent
        agent_data = {
            'agent_id': agent_id,
            'role_model': role_model,
            'generated_skills': skills,
            'generated_knowledge': knowledge_items,
            'status': 'completed',
        }
        agents_store[agent_id] = agent_data

        # Return standardized response
        return json_response({
            'agent_id': agent_id,
            'role_model': role_model,
            'generated_skills': skills,
            'generated_knowledge': knowledge_items,
        }), 201

    except ValidationError as e:
        error = APIError.from_exception(e)
        return error_response(error, status=422)
    except requests.exceptions.RequestException as e:
        error = APIError(
            code=ErrorCode.UPSTREAM_ERROR,
            message=f"Failed to connect to builder service: {str(e)}",
            category=ErrorCategory.UPSTREAM_ERROR,
        )
        return error_response(error, status=502)
    except Exception as e:
        error = APIError(
            code=ErrorCode.INTERNAL_ERROR,
            message=f"Internal server error: {str(e)}",
            category=ErrorCategory.SERVICE_ERROR,
        )
        return error_response(error, status=500)

@app.route('/api/v1/agents/<agent_id>', methods=['GET'])
@require_auth
def get_agent(agent_id: str):
    """Get agent by ID."""
    agent = require_resource_exists(agents_store, agent_id, "Agent")
    return json_response(agent), 200

@app.route('/api/v1/agents', methods=['GET'])
@require_auth
def list_agents():
    """List all agents."""
    # Get agents (in production, this would query a database with pagination)
    all_agents = list(agents_store.values())

    # Apply filters, sorting, and pagination
    agents_page, pagination_meta = process_list_request(all_agents)

    return json_response(
        agents_page,
        pagination=pagination_meta
    ), 200

@app.route('/api/v1/agents/<agent_id>/build', methods=['POST'])
@require_auth
def build_agent(agent_id: str):
    """Trigger build for existing agent (same as create, but for existing agent)."""
    # This is essentially the same as create_agent but for existing agents
    # For now, redirect to create if not exists
    return create_agent()

@app.route('/api/v1/agents/<agent_id>/capabilities', methods=['GET'])
@require_auth
def get_agent_capabilities(agent_id: str):
    """Get agent capabilities (skills and knowledge)."""
    agent = require_resource_exists(agents_store, agent_id, "Agent")
    capabilities = {
        'skills': agent.get('generated_skills', []),
        'knowledge': agent.get('generated_knowledge', []),
    }

    return json_response(capabilities), 200

@app.route('/api/v1/agents/<agent_id>', methods=['PATCH'])
@require_auth
def update_agent(agent_id: str):
    """Partially update agent."""
    agent = require_resource_exists(agents_store, agent_id, "Agent")

    try:
        data = request.get_json() or {}

        # Update allowed fields
        if 'role_model' in data:
            if isinstance(data['role_model'], dict):
                # Merge role_model updates
                if 'role_model' not in agent:
                    agent['role_model'] = {}
                agent['role_model'].update(data['role_model'])
            else:
                error = APIError(
                    code=ErrorCode.INVALID_TYPE,
                    message="role_model must be an object",
                    category=ErrorCategory.VALIDATION_ERROR,
                )
                return error_response(error, status=422)

        if 'deepening_cycles' in data:
            deepening_cycles = data['deepening_cycles']
            if isinstance(deepening_cycles, int) and 0 <= deepening_cycles <= 11:
                agent['deepening_cycles'] = deepening_cycles
            else:
                error = APIError(
                    code=ErrorCode.INVALID_RANGE,
                    message="deepening_cycles must be an integer between 0 and 11",
                    category=ErrorCategory.VALIDATION_ERROR,
                )
                return error_response(error, status=422)

        # Update timestamp
        agent['updated_at'] = datetime.now(timezone.utc).isoformat()

        return json_response(agent), 200

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

@app.route('/api/v1/agents/<agent_id>', methods=['PUT'])
@require_auth
def replace_agent(agent_id: str):
    """Replace agent (full update)."""
    try:
        data = request.get_json() or {}

        # Validate required fields
        role_model = RequestValidator.require_field(data, 'role_model', 'roleModel')
        model_name = RequestValidator.require_string(role_model, 'name', min_length=1)
        occupation = RequestValidator.require_string(role_model, 'occupation', min_length=1)
        deepening_cycles = data.get('deepening_cycles', 0)
        if not isinstance(deepening_cycles, int) or not (0 <= deepening_cycles <= 11):
            deepening_cycles = 0

        # Replace entire agent
        agents_store[agent_id] = {
            'agent_id': agent_id,
            'role_model': role_model,
            'deepening_cycles': deepening_cycles,
            'generated_skills': agents_store.get(agent_id, {}).get('generated_skills', []),
            'generated_knowledge': agents_store.get(agent_id, {}).get('generated_knowledge', []),
            'status': 'updated',
            'updated_at': datetime.now(timezone.utc).isoformat(),
        }

        return json_response(agents_store[agent_id]), 200

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

@app.route('/api/v1/agents/<agent_id>', methods=['DELETE'])
@require_auth
def delete_agent(agent_id: str):
    """Delete agent."""
    agent = require_resource_exists(agents_store, agent_id, "Agent")

    del agents_store[agent_id]

    return json_response({'deleted': True, 'agent_id': agent_id}), 200

# Backwards compatibility endpoint (deprecated)
@app.route('/build', methods=['POST'])
def build_agent_legacy():
    """Legacy endpoint (deprecated - use POST /api/v1/agents)."""
    data = request.get_json() or {}

    # Transform legacy format to new format
    role_model = data.get('roleModel') or {}
    agent_id = data.get('agentId')

    if not agent_id:
        error = APIError(
            code=ErrorCode.REQUIRED_FIELD,
            message="Missing 'agentId' field",
            category=ErrorCategory.VALIDATION_ERROR,
        )
        return error_response(error, status=400)

    # Convert to new format and call new endpoint
    new_data = {
        'agent_id': agent_id,
        'role_model': role_model,
        'deepening_cycles': data.get('deepeningCycles', 0),
    }

    # Store original request data temporarily
    request._cached_json = (new_data, new_data)

    # Add deprecation warning in response
    response_data = create_agent()
    if isinstance(response_data, tuple):
        response_obj, status_code = response_data
        if isinstance(response_obj, tuple):
            json_response, _ = response_obj
            if isinstance(json_response, dict):
                json_response['meta'] = json_response.get('meta', {})
                json_response['meta']['deprecated'] = True
                json_response['meta']['deprecation_notice'] = "Use POST /api/v1/agents instead"
                return jsonify(json_response), status_code

    return response_data

def _extract_api_keys_from_headers(request) -> dict:
    """Extract API keys from Authorization header (not request body)."""
    # API keys should be in Authorization header, not body
    # For now, return empty dict - services should handle auth via headers
    return {}

def _get_forward_headers(request) -> dict:
    """Get headers to forward to downstream services."""
    headers = {
        'Content-Type': 'application/json',
    }

    # Forward Authorization header if present
    auth_header = request.headers.get('Authorization')
    if auth_header:
        headers['Authorization'] = auth_header

    return headers

if __name__ == '__main__':
    print('--- AgentBuilder Server Starting ---')
    print('API Version: v1')
    print('Health: http://localhost:5000/health')
    print('API Base: http://localhost:5000/api/v1')
    app.run(port=5000, debug=True)

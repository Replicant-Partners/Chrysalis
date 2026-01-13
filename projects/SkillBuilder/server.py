"""
SkillBuilder Service - Unified API Standard

Generates agent skills from occupation and corpus text using exemplar-driven research.
"""

import logging
import sys
from pathlib import Path
from flask import Flask, request, jsonify
from datetime import datetime, timezone
from typing import Optional, Dict, List, Any, Sequence
import uuid

# Add shared directory to path (search up the tree)
CURRENT_PATH = Path(__file__).resolve()
SHARED_PATH = None
PROJECT_ROOT = None
for parent in CURRENT_PATH.parents:
    candidate = parent / "shared"
    if candidate.exists():
        SHARED_PATH = candidate
        PROJECT_ROOT = parent
        break

if SHARED_PATH is None or PROJECT_ROOT is None:
    raise RuntimeError("Unable to locate 'shared' directory for SkillBuilder server")

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

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

from skill_builder.pipeline.models import FrontendSpec, SkillCard, SemanticMapEntry
from skill_builder.pipeline.runner import run_pipeline
from skill_builder.pipeline.consolidation import consolidate_skill_cards
from skill_builder.memory import (
    builder_memory_enabled,
    strict_memory_persistence_enabled,
    create_memory_port,
    run_async_task,
    store_skills_async,
    new_run_id,
    builder_version,
    builder_agent_id,
    skill_artifacts_from_result,
)
from memory_system.ports import SkillArtifactBatch

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
        title="SkillBuilder API",
        version="1.0.0",
        description="SkillBuilder Service - Generates agent skills from occupation and corpus text using exemplar-driven research.",
        api_version="v1"
    )
    setup_swagger(app, swagger_config)
except ImportError:
    # flasgger not installed - skip Swagger UI
    pass

# In-memory skill store (replace with database in production)
skills_store: Dict[str, Dict[str, Any]] = {}


def _serialize_skill_cards(skills: Sequence[SkillCard]) -> List[dict[str, Any]]:
    serialized: List[dict[str, Any]] = []
    for skill in skills:
        serialized.append(
            {
                "name": skill.name,
                "description": skill.description,
                "triggers": list(skill.triggers),
                "artifacts": list(skill.artifacts),
                "constraints": list(skill.constraints),
                "evidence_urls": list(skill.evidence_urls),
                "confidence": skill.confidence,
                "acquired_details": {
                    "provenance": "skillbuilder-server",
                },
            }
        )
    return serialized


def _serialize_semantic_map(entries: Sequence[SemanticMapEntry]) -> List[dict[str, Any]]:
    serialized: List[dict[str, Any]] = []
    for entry in entries:
        serialized.append(
            {
                "schema_type": entry.schema_type,
                "name": entry.name,
                "description": entry.description,
                "properties": entry.properties,
                "source_urls": list(entry.source_urls),
            }
        )
    return serialized


def _persist_skills_to_memory(
    *,
    skills: Sequence[SkillCard],
    embeddings: Sequence[Sequence[float]],
    semantic_map: Sequence[SemanticMapEntry],
    run_id: str,
    occupation: str,
) -> bool:
    if not skills or not builder_memory_enabled():
        return False

    try:
        agent_id = builder_agent_id()
        artifacts = skill_artifacts_from_result(
            agent_id=agent_id,
            skills=_serialize_skill_cards(skills),
            embeddings=embeddings,
            semantic_map=_serialize_semantic_map(semantic_map),
            occupation=occupation,
        )

        if not artifacts:
            logger.info(
                "SkillBuilder memory persistence skipped (no artifacts)",
                extra={"run_id": run_id, "occupation": occupation},
            )
            return False

        batch = SkillArtifactBatch(
            agent_id=agent_id,
            skills=artifacts,
            run_id=run_id,
            builder_version=builder_version(),
        )

        port = create_memory_port(agent_id=agent_id)
        warn_message = (
            f"SkillBuilder memory persistence failed for occupation={occupation}, run_id={run_id}"
        )
        run_async_task(
            store_skills_async(port, batch),
            warn_message=warn_message,
        )
        return True
    except Exception as exc:  # noqa: BLE001
        if strict_memory_persistence_enabled():
            raise
        logger.warning(
            "SkillBuilder memory persistence encountered an error",
            extra={"error": str(exc), "run_id": run_id, "occupation": occupation},
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
              service: skillbuilder
    """
    return jsonify(APIResponse.success_response(
        {"status": "healthy", "service": "skillbuilder"}
    ).to_dict()), 200

@app.route('/api/v1/skills', methods=['POST'])
@require_auth
def create_skills():
    """Generate skills for an occupation."""
    try:
        data = request.get_json() or {}
        run_id = new_run_id()

        # Validate request
        occupation = RequestValidator.require_string(data, 'occupation', min_length=1)
        deepening_cycles = data.get('deepening_cycles', 0)
        if not isinstance(deepening_cycles, int) or deepening_cycles < 0 or deepening_cycles > 11:
            deepening_cycles = max(0, min(11, deepening_cycles))

        corpus_text = data.get('corpus_text')

        credentials = get_request_credentials()

        api_keys = data.get('apiKeys', {})
        if api_keys:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(
                "apiKeys passed in request body are ignored; supply Authorization header instead",
                extra={"path": request.path}
            )

        # Create spec
        spec = FrontendSpec(
            mode_name=occupation.replace(' ', '-'),
            purpose=f'Skills for {occupation}',
            deepening_cycles=deepening_cycles,
            corpus_text=corpus_text
        )

        # Run pipeline
        result = run_pipeline(spec, run_id=run_id)

        skills_tuple = consolidate_skill_cards(result.skills)
        embeddings = result.embeddings
        semantic_map = result.semantic_map

        # Combine skills and their embeddings
        response_skills = []
        for skill, embedding in zip(skills_tuple, embeddings):
            response_skills.append({
                "skill": skill.to_yaml_block(),
                "embedding": embedding
            })

        memory_persisted = _persist_skills_to_memory(
            skills=skills_tuple,
            embeddings=embeddings,
            semantic_map=semantic_map,
            run_id=run_id,
            occupation=occupation,
        )

        # Store skills
        skill_id = str(uuid.uuid4())
        skills_store[skill_id] = {
            'skill_id': skill_id,
            'occupation': occupation,
            'skills': response_skills,
            'deepening_cycles': deepening_cycles,
            'total_skills': len(response_skills),
            'run_id': run_id,
            'memory_persisted': memory_persisted,
        }

        # Return standardized response
        return json_response({
            'skill_id': skill_id,
            'occupation': occupation,
            'skills': response_skills,
            'total_skills': len(response_skills),
            'run_id': run_id,
            'memory_persisted': memory_persisted,
        }, status=201)

    except ValidationError as e:
        error = APIError.from_exception(e)
        return error_response(error, status=422)
    except Exception as e:
        error = APIError(
            code=ErrorCode.INTERNAL_ERROR,
            message=f"Failed to generate skills: {str(e)}",
            category=ErrorCategory.SERVICE_ERROR,
        )
        return error_response(error, status=500)

@app.route('/api/v1/skills/<skill_id>', methods=['GET'])
@require_auth
def get_skills(skill_id: str):
    """Get skills by ID."""
    skill = require_resource_exists(skills_store, skill_id, "Skill")
    return json_response(skill)

@app.route('/api/v1/skills', methods=['GET'])
@require_auth
def list_skills():
    """List all skills entries."""
    # Get all skills entries
    all_skill = list(skills_store.values())

    # Apply filters, sorting, and pagination
    skills_page, pagination_meta = process_list_request(all_skills)

    return json_response(
        skills_page,
        pagination=pagination_meta
    )

@app.route('/api/v1/skills/<skill_id>', methods=['PATCH'])
@require_auth
def update_skills(skill_id: str):
    """Partially update skills entry."""
    skill = require_resource_exists(skills_store, skill_id, "Skill")

    try:
        data = request.get_json() or {}

        # Update allowed fields
        if 'occupation' in data:
            skill['occupation'] = RequestValidator.require_string(data, 'occupation', min_length=1)

        if 'skills' in data:
            if isinstance(data['skills'], list):
                skill['skills'] = data['skills']
                skill['total_skills'] = len(data['skills'])
            else:
                error = APIError(
                    code=ErrorCode.INVALID_TYPE,
                    message="skills must be a list",
                    category=ErrorCategory.VALIDATION_ERROR,
                )
                return error_response(error, status=422)

        if 'deepening_cycles' in data:
            deepening_cycles = data['deepening_cycles']
            if isinstance(deepening_cycles, int) and 0 <= deepening_cycles <= 11:
                skill['deepening_cycles'] = deepening_cycles
            else:
                error = APIError(
                    code=ErrorCode.INVALID_RANGE,
                    message="deepening_cycles must be an integer between 0 and 11",
                    category=ErrorCategory.VALIDATION_ERROR,
                )
                return error_response(error, status=422)

        # Update timestamp
        skill['updated_at'] = datetime.now(timezone.utc).isoformat()

        return json_response(skill)

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

@app.route('/api/v1/skills/<skill_id>', methods=['PUT'])
@require_auth
def replace_skills(skill_id: str):
    """Replace skills entry (full update)."""
    try:
        data = request.get_json() or {}

        # Validate required fields
        occupation = RequestValidator.require_string(data, 'occupation', min_length=1)
        deepening_cycles = data.get('deepening_cycles', 0)
        if not isinstance(deepening_cycles, int) or not (0 <= deepening_cycles <= 11):
            deepening_cycles = 0

        skills_list = data.get('skills', [])
        if not isinstance(skills_list, list):
            skills_list = []

        # Replace entire skills entry
        skills_store[skill_id] = {
            'skill_id': skill_id,
            'occupation': occupation,
            'skills': skills_list,
            'deepening_cycles': deepening_cycles,
            'total_skills': len(skills_list),
            'updated_at': datetime.now(timezone.utc).isoformat(),
        }

        return json_response(skills_store[skill_id])

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

@app.route('/api/v1/skills/<skill_id>', methods=['DELETE'])
@require_auth
def delete_skills(skill_id: str):
    """Delete skills entry."""
    skill = require_resource_exists(skills_store, skill_id, "Skill")
    del skills_store[skill_id]

    return json_response({'deleted': True, 'skill_id': skill_id})

@app.route('/api/v1/skills/modes', methods=['GET'])
@require_auth
def list_modes():
    """List available skill modes."""
    pagination = PaginationParams.from_request(request)

    # This would query the mode database/registry
    # For now, return empty list or placeholder
    all_modes = []  # Would be populated from mode registry
    total = len(all_modes)

    # Apply pagination
    start = pagination.offset
    end = start + pagination.per_page
    modes_page = all_modes[start:end]

    pagination_meta = PaginationMeta.create(pagination, total)

    return json_response(
        modes_page,
        pagination=pagination_meta
    )

@app.route('/api/v1/skills/modes/<mode_id>', methods=['GET'])
@require_auth
def get_mode(mode_id: str):
    """Get skill mode by ID."""
    # This would query the mode database/registry
    # For now, return not found
    error = APIError(
        code=ErrorCode.RESOURCE_NOT_FOUND,
        message=f"Mode '{mode_id}' not found",
        category=ErrorCategory.NOT_FOUND_ERROR,
    )
    return error_response(error, status=404)

# Backwards compatibility endpoint (deprecated)
@app.route('/skills', methods=['POST'])
def create_skills_legacy():
    """Legacy endpoint (deprecated - use POST /api/v1/skills)."""
    data = request.get_json() or {}

    occupation = data.get('occupation')
    if not occupation:
        error = APIError(
            code=ErrorCode.REQUIRED_FIELD,
            message="Missing 'occupation' field",
            category=ErrorCategory.VALIDATION_ERROR,
        )
        return error_response(error, status=400)

    # Convert to new format and call new endpoint
    new_data = {
        'occupation': occupation,
        'deepening_cycles': data.get('deepening_cycles', 0),
        'corpus_text': data.get('corpus_text'),
        'apiKeys': data.get('apiKeys', {}),
    }

    # Store original request data temporarily
    request._cached_json = (new_data, new_data)

    # Call new endpoint
    response_data = create_skills()
    if isinstance(response_data, tuple):
        json_response, status_code = response_data
        if isinstance(json_response, dict):
            json_response.setdefault('meta', {})['deprecated'] = True
            json_response['meta']['deprecation_notice'] = "Use POST /api/v1/skills instead"
            # Transform response to legacy format
            if 'data' in json_response and 'skills' in json_response['data']:
                return jsonify({'skills': json_response['data']['skills']}), status_code
            return jsonify(json_response), status_code

    return response_data

if __name__ == '__main__':
    print('--- SkillBuilder Server Starting ---')
    print('API Version: v1')
    print('Health: http://localhost:5001/health')
    print('API Base: http://localhost:5001/api/v1')
    app.run(port=5001, debug=True)

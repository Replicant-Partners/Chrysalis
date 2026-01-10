"""
SkillBuilder Service - Unified API Standard

Generates agent skills from occupation and corpus text using exemplar-driven research.
"""

import sys
from pathlib import Path
from flask import Flask, request, jsonify, g
from datetime import datetime, timezone
import os
from typing import Optional, Dict, List, Any
import uuid

# Add shared directory to path
PROJECT_ROOT = Path(__file__).resolve().parents[4]
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
    require_auth,
    authenticate_request,
    create_error_handler,
    create_all_middleware,
)

from skill_builder.pipeline.models import FrontendSpec
from skill_builder.pipeline.runner import run_pipeline

app = Flask(__name__)

# Setup middleware
create_error_handler(app)
create_all_middleware(app, api_version="v1")

# In-memory skill store (replace with database in production)
skills_store: Dict[str, Dict[str, Any]] = {}

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify(APIResponse.success_response(
        {"status": "healthy", "service": "skillbuilder"}
    ).to_dict()), 200

@app.route('/api/v1/skills', methods=['POST'])
@require_auth
def create_skills():
    """Generate skills for an occupation."""
    try:
        data = request.get_json() or {}

        # Validate request
        occupation = RequestValidator.require_string(data, 'occupation', min_length=1)
        deepening_cycles = data.get('deepening_cycles', 0)
        if not isinstance(deepening_cycles, int) or deepening_cycles < 0 or deepening_cycles > 11:
            deepening_cycles = max(0, min(11, deepening_cycles))

        corpus_text = data.get('corpus_text')

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

        # Create spec
        spec = FrontendSpec(
            mode_name=occupation.replace(' ', '-'),
            purpose=f'Skills for {occupation}',
            deepening_cycles=deepening_cycles,
            corpus_text=corpus_text
        )

        # Run pipeline
        result = run_pipeline(spec)

        # Combine skills and their embeddings
        response_skills = []
        for skill, embedding in zip(result.skills, result.embeddings):
            response_skills.append({
                "skill": skill.to_yaml_block(),
                "embedding": embedding
            })

        # Store skills
        skill_id = str(uuid.uuid4())
        skills_store[skill_id] = {
            'skill_id': skill_id,
            'occupation': occupation,
            'skills': response_skills,
            'deepening_cycles': deepening_cycles,
            'total_skills': len(response_skills),
        }

        # Return standardized response
        response = APIResponse.success_response({
            'skill_id': skill_id,
            'occupation': occupation,
            'skills': response_skills,
            'total_skills': len(response_skills),
        })
        return jsonify(response.to_dict()), 201

    except ValidationError as e:
        error = APIError.from_exception(e)
        response, status = APIResponse.error_response(error, status_code=422)
        return jsonify(response.to_dict()), status
    except Exception as e:
        error = APIError(
            code=ErrorCode.INTERNAL_ERROR,
            message=f"Failed to generate skills: {str(e)}",
            category=ErrorCategory.SERVICE_ERROR,
        )
        response, status = APIResponse.error_response(error, status_code=500)
        return jsonify(response.to_dict()), status

@app.route('/api/v1/skills/<skill_id>', methods=['GET'])
@require_auth
def get_skills(skill_id: str):
    """Get skills by ID."""
    if skill_id not in skills_store:
        error = APIError(
            code=ErrorCode.RESOURCE_NOT_FOUND,
            message=f"Skills entry '{skill_id}' not found",
            category=ErrorCategory.NOT_FOUND_ERROR,
        )
        response, status = APIResponse.error_response(error, status_code=404)
        return jsonify(response.to_dict()), status

    response = APIResponse.success_response(skills_store[skill_id])
    return jsonify(response.to_dict()), 200

@app.route('/api/v1/skills', methods=['GET'])
@require_auth
def list_skills():
    """List all skills entries."""
    pagination = PaginationParams.from_request(request)
    filters = FilterParams.from_request(request)

    # Get all skills entries
    all_skills = list(skills_store.values())

    # Apply filters
    filtered_skills = all_skills
    if filters.filters:
        for field, value in filters.filters.items():
            if isinstance(value, dict):
                for op, op_value in value.items():
                    filtered_skills = [
                        s for s in filtered_skills
                        if _apply_filter(s.get(field), op, op_value)
                    ]
            else:
                filtered_skills = [
                    s for s in filtered_skills
                    if s.get(field) == value
                ]

    total = len(filtered_skills)

    # Apply pagination
    start = pagination.offset
    end = start + pagination.per_page
    skills_page = filtered_skills[start:end]

    pagination_meta = PaginationMeta.create(pagination, total)

    response = APIResponse.success_response(
        skills_page,
        pagination=pagination_meta
    )
    return jsonify(response.to_dict()), 200

@app.route('/api/v1/skills/<skill_id>', methods=['PATCH'])
@require_auth
def update_skills(skill_id: str):
    """Partially update skills entry."""
    if skill_id not in skills_store:
        error = APIError(
            code=ErrorCode.RESOURCE_NOT_FOUND,
            message=f"Skills entry '{skill_id}' not found",
            category=ErrorCategory.NOT_FOUND_ERROR,
        )
        response, status = APIResponse.error_response(error, status_code=404)
        return jsonify(response.to_dict()), status
    
    try:
        data = request.get_json() or {}
        skills = skills_store[skill_id]
        
        # Update allowed fields
        if 'occupation' in data:
            skills['occupation'] = RequestValidator.require_string(data, 'occupation', min_length=1)
        
        if 'skills' in data:
            if isinstance(data['skills'], list):
                skills['skills'] = data['skills']
                skills['total_skills'] = len(data['skills'])
            else:
                error = APIError(
                    code=ErrorCode.INVALID_TYPE,
                    message="skills must be a list",
                    category=ErrorCategory.VALIDATION_ERROR,
                )
                response, status = APIResponse.error_response(error, status_code=422)
                return jsonify(response.to_dict()), status
        
        if 'deepening_cycles' in data:
            deepening_cycles = data['deepening_cycles']
            if isinstance(deepening_cycles, int) and 0 <= deepening_cycles <= 11:
                skills['deepening_cycles'] = deepening_cycles
            else:
                error = APIError(
                    code=ErrorCode.INVALID_RANGE,
                    message="deepening_cycles must be an integer between 0 and 11",
                    category=ErrorCategory.VALIDATION_ERROR,
                )
                response, status = APIResponse.error_response(error, status_code=422)
                return jsonify(response.to_dict()), status
        
        # Update timestamp
        skills['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        response = APIResponse.success_response(skills)
        return jsonify(response.to_dict()), 200
        
    except ValidationError as e:
        error = APIError.from_exception(e)
        response, status = APIResponse.error_response(error, status_code=422)
        return jsonify(response.to_dict()), status
    except Exception as e:
        error = APIError(
            code=ErrorCode.INTERNAL_ERROR,
            message=f"Update failed: {str(e)}",
            category=ErrorCategory.SERVICE_ERROR,
        )
        response, status = APIResponse.error_response(error, status_code=500)
        return jsonify(response.to_dict()), status

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
        
        response = APIResponse.success_response(skills_store[skill_id])
        return jsonify(response.to_dict()), 200
        
    except ValidationError as e:
        error = APIError.from_exception(e)
        response, status = APIResponse.error_response(error, status_code=422)
        return jsonify(response.to_dict()), status
    except Exception as e:
        error = APIError(
            code=ErrorCode.INTERNAL_ERROR,
            message=f"Replace failed: {str(e)}",
            category=ErrorCategory.SERVICE_ERROR,
        )
        response, status = APIResponse.error_response(error, status_code=500)
        return jsonify(response.to_dict()), status

@app.route('/api/v1/skills/<skill_id>', methods=['DELETE'])
@require_auth
def delete_skills(skill_id: str):
    """Delete skills entry."""
    if skill_id not in skills_store:
        error = APIError(
            code=ErrorCode.RESOURCE_NOT_FOUND,
            message=f"Skills entry '{skill_id}' not found",
            category=ErrorCategory.NOT_FOUND_ERROR,
        )
        response, status = APIResponse.error_response(error, status_code=404)
        return jsonify(response.to_dict()), status
    
    del skills_store[skill_id]
    
    response = APIResponse.success_response({'deleted': True, 'skill_id': skill_id})
    return jsonify(response.to_dict()), 200

@app.route('/api/v1/skills/modes', methods=['GET'])
@require_auth
def list_modes():
    """List available skill modes."""
    # This would query the mode database/registry
    # For now, return empty list or placeholder
    modes = []  # Would be populated from mode registry

    response = APIResponse.success_response(modes)
    return jsonify(response.to_dict()), 200

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
    response, status = APIResponse.error_response(error, status_code=404)
    return jsonify(response.to_dict()), status

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
        response, status = APIResponse.error_response(error, status_code=400)
        return jsonify(response.to_dict()), status

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

def _apply_filter(value: Any, op: str, op_value: Any) -> bool:
    """Apply filter operation."""
    if op == 'eq':
        return value == op_value
    elif op == 'ne':
        return value != op_value
    elif op == 'gt':
        return value > op_value
    elif op == 'gte':
        return value >= op_value
    elif op == 'lt':
        return value < op_value
    elif op == 'lte':
        return value <= op_value
    elif op == 'in':
        return value in (op_value if isinstance(op_value, list) else [op_value])
    elif op == 'contains':
        return op_value in str(value)
    return False

if __name__ == '__main__':
    print('--- SkillBuilder Server Starting ---')
    print('API Version: v1')
    print('Health: http://localhost:5001/health')
    print('API Base: http://localhost:5001/api/v1')
    app.run(port=5001, debug=True)

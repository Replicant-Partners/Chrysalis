"""
Simple tests for API core models (no Flask dependency).
"""

import sys
from pathlib import Path

# Add shared directory to path
PROJECT_ROOT = Path(__file__).resolve().parents[3]
SHARED_PATH = PROJECT_ROOT / "shared"
if str(SHARED_PATH) not in sys.path:
    sys.path.insert(0, str(SHARED_PATH))

from api_core.models import (
    APIResponse,
    APIError,
    ErrorCode,
    ErrorCategory,
    PaginationParams,
    PaginationMeta,
    ValidationError,
    RequestValidator,
)


def test_api_response_success():
    """Test creating success response."""
    response = APIResponse.success_response({"test": "data"})

    assert response.success is True
    assert response.data == {"test": "data"}
    assert response.error is None
    assert response.meta is not None
    assert "request_id" in response.meta
    assert "timestamp" in response.meta
    assert response.meta["version"] == "v1"
    print("✓ APIResponse.success_response works")


def test_api_response_with_pagination():
    """Test success response with pagination."""
    pagination = PaginationParams(page=1, per_page=20)
    pagination_meta = PaginationMeta.create(pagination, total=100)
    response = APIResponse.success_response(
        [{"item": 1}],
        pagination=pagination_meta
    )

    assert response.success is True
    assert "pagination" in response.meta
    assert response.meta["pagination"]["page"] == 1
    assert response.meta["pagination"]["total"] == 100
    print("✓ APIResponse with pagination works")


def test_api_error():
    """Test creating error response."""
    error = APIError(
        code=ErrorCode.REQUIRED_FIELD,
        message="Field required",
        category=ErrorCategory.VALIDATION_ERROR,
    )
    response, status = APIResponse.error_response(error, status_code=422)

    assert response.success is False
    assert response.data is None
    assert response.error is not None
    assert response.error.code == ErrorCode.REQUIRED_FIELD
    assert status == 422
    print("✓ APIError works")


def test_pagination_params():
    """Test pagination parameters."""
    params = PaginationParams(page=3, per_page=20)

    assert params.page == 3
    assert params.per_page == 20
    assert params.offset == 40  # (3-1) * 20
    print("✓ PaginationParams works")


def test_pagination_meta():
    """Test pagination metadata."""
    pagination = PaginationParams(page=2, per_page=20)
    meta = PaginationMeta.create(pagination, total=100)

    assert meta.page == 2
    assert meta.total == 100
    assert meta.total_pages == 5
    assert meta.has_next is True
    assert meta.has_prev is True
    print("✓ PaginationMeta works")


def test_validation_error():
    """Test validation error."""
    error = ValidationError("Field is required", field="test_field")

    assert str(error) == "Field is required"
    assert error.field == "test_field"
    assert error.code is not None
    print("✓ ValidationError works")


def test_request_validator():
    """Test request validator."""
    data = {"test_field": "value"}
    value = RequestValidator.require_field(data, "test_field")

    assert value == "value"
    print("✓ RequestValidator.require_field works")

    # Test missing field
    try:
        RequestValidator.require_field({}, "missing_field")
        assert False, "Should have raised ValidationError"
    except ValidationError as e:
        assert e.field == "missing_field"
        print("✓ RequestValidator raises ValidationError for missing fields")


if __name__ == "__main__":
    print("Running simple model tests...")
    test_api_response_success()
    test_api_response_with_pagination()
    test_api_error()
    test_pagination_params()
    test_pagination_meta()
    test_validation_error()
    test_request_validator()
    print("\n✅ All basic model tests passed!")

"""
Tests for API core models.
"""

import pytest
from datetime import datetime, timezone
from shared.api_core.models import (
    APIResponse,
    APIError,
    ErrorCode,
    ErrorCategory,
    PaginationParams,
    PaginationMeta,
    ValidationError,
    RequestValidator,
)


class TestAPIResponse:
    """Tests for APIResponse model."""
    
    def test_success_response(self):
        """Test creating success response."""
        response = APIResponse.success_response({"test": "data"})
        
        assert response.success is True
        assert response.data == {"test": "data"}
        assert response.error is None
        assert response.meta is not None
        assert "request_id" in response.meta
        assert "timestamp" in response.meta
        assert response.meta["version"] == "v1"
    
    def test_success_response_with_pagination(self):
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
    
    def test_error_response(self):
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


class TestAPIError:
    """Tests for APIError model."""
    
    def test_error_from_exception(self):
        """Test creating error from exception."""
        exc = ValidationError("Field is required", field="test_field")
        error = APIError.from_exception(exc)
        
        assert error.code == ErrorCode.REQUIRED_FIELD
        assert error.category == ErrorCategory.VALIDATION_ERROR
        assert len(error.details) > 0
        assert error.details[0].field == "test_field"
    
    def test_error_to_dict(self):
        """Test converting error to dictionary."""
        error = APIError(
            code=ErrorCode.INVALID_FORMAT,
            message="Invalid format",
            category=ErrorCategory.VALIDATION_ERROR,
            request_id="test-req-123",
        )
        error_dict = error.to_dict()
        
        assert error_dict["code"] == ErrorCode.INVALID_FORMAT.value
        assert error_dict["message"] == "Invalid format"
        assert error_dict["category"] == ErrorCategory.VALIDATION_ERROR.value
        assert error_dict["request_id"] == "test-req-123"


class TestPaginationParams:
    """Tests for PaginationParams."""
    
    def test_pagination_params_defaults(self):
        """Test default pagination parameters."""
        params = PaginationParams()
        
        assert params.page == 1
        assert params.per_page == 20
    
    def test_pagination_params_validation(self):
        """Test pagination parameter validation."""
        params = PaginationParams(page=0, per_page=200)
        
        # Should be clamped to valid values
        assert params.page == 1  # Min is 1
        assert params.per_page == 100  # Max is 100
    
    def test_pagination_offset(self):
        """Test pagination offset calculation."""
        params = PaginationParams(page=3, per_page=20)
        
        assert params.offset == 40  # (3-1) * 20


class TestPaginationMeta:
    """Tests for PaginationMeta."""
    
    def test_pagination_meta_creation(self):
        """Test creating pagination metadata."""
        pagination = PaginationParams(page=2, per_page=20)
        meta = PaginationMeta.create(pagination, total=100)
        
        assert meta.page == 2
        assert meta.per_page == 20
        assert meta.total == 100
        assert meta.total_pages == 5
        assert meta.has_next is True
        assert meta.has_prev is True
    
    def test_pagination_meta_no_next(self):
        """Test pagination metadata on last page."""
        pagination = PaginationParams(page=5, per_page=20)
        meta = PaginationMeta.create(pagination, total=100)
        
        assert meta.has_next is False
        assert meta.has_prev is True
    
    def test_pagination_meta_no_prev(self):
        """Test pagination metadata on first page."""
        pagination = PaginationParams(page=1, per_page=20)
        meta = PaginationMeta.create(pagination, total=100)
        
        assert meta.has_next is True
        assert meta.has_prev is False


class TestRequestValidator:
    """Tests for RequestValidator."""
    
    def test_require_field(self):
        """Test requiring field in request."""
        data = {"test_field": "value"}
        value = RequestValidator.require_field(data, "test_field")
        
        assert value == "value"
    
    def test_require_field_missing(self):
        """Test requiring missing field raises error."""
        data = {}
        
        with pytest.raises(ValidationError) as exc_info:
            RequestValidator.require_field(data, "test_field")
        
        assert exc_info.value.field == "test_field"
        assert "required" in str(exc_info.value).lower()
    
    def test_require_string(self):
        """Test requiring string field."""
        data = {"name": "test"}
        value = RequestValidator.require_string(data, "name", min_length=1, max_length=10)
        
        assert value == "test"
    
    def test_require_string_too_short(self):
        """Test string validation with min length."""
        data = {"name": ""}
        
        with pytest.raises(ValidationError) as exc_info:
            RequestValidator.require_string(data, "name", min_length=1)
        
        assert exc_info.value.field == "name"
    
    def test_require_string_too_long(self):
        """Test string validation with max length."""
        data = {"name": "a" * 100}
        
        with pytest.raises(ValidationError) as exc_info:
            RequestValidator.require_string(data, "name", max_length=10)
        
        assert exc_info.value.field == "name"
    
    def test_require_integer(self):
        """Test requiring integer field."""
        data = {"count": 5}
        value = RequestValidator.require_integer(data, "count", min_value=0, max_value=10)
        
        assert value == 5
    
    def test_require_integer_out_of_range(self):
        """Test integer validation with range."""
        data = {"count": 15}
        
        with pytest.raises(ValidationError) as exc_info:
            RequestValidator.require_integer(data, "count", max_value=10)
        
        assert exc_info.value.field == "count"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

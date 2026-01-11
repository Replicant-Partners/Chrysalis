"""
Request validation utilities.

Provides both exception-based validators (legacy) and Result-returning validators (recommended).
Result-returning validators integrate with the Result type pattern for type-safe error handling.
"""

from typing import Any, Callable, Dict, List, Optional, TypeVar

from .models import ValidationError, RequestValidator, ErrorCode, APIError
from .result import (
    Result,
    Success,
    Failure,
    success,
    failure,
    validation_failure,
    sequence,
    ResultDo,
)

T = TypeVar('T')

__all__ = [
    # Legacy exception-based
    "validate_request",
    "ValidationError",
    "RequestValidator",
    # Result-based validators
    "validate_required",
    "validate_required_string",
    "validate_required_integer",
    "validate_optional",
    "validate_email",
    "validate_min_length",
    "validate_max_length",
    "validate_range",
    "validate_pattern",
    "validate_one_of",
    "validate_all",
    "ResultValidator",
]

# Re-export for convenience (legacy)
validate_request = RequestValidator


# ============================================================================
# Result-returning Validators
# ============================================================================

def validate_required(
    data: Dict[str, Any],
    field: str,
    field_name: Optional[str] = None
) -> Result[Any, APIError]:
    """
    Validate that a required field is present and not None.
    
    Args:
        data: Dictionary containing the data to validate
        field: Key to look up in the data
        field_name: Human-readable field name for error messages
        
    Returns:
        Success with the field value, or Failure with validation error
        
    Example:
        >>> result = validate_required({'name': 'Alice'}, 'name')
        >>> result.is_success()  # True
        >>> result.unwrap()  # 'Alice'
    """
    display_name = field_name or field
    if field not in data or data[field] is None:
        return validation_failure(
            f"Field '{display_name}' is required",
            field_name=field,
            code=ErrorCode.REQUIRED_FIELD
        )
    return success(data[field])


def validate_required_string(
    data: Dict[str, Any],
    field: str,
    min_length: Optional[int] = None,
    max_length: Optional[int] = None,
    field_name: Optional[str] = None
) -> Result[str, APIError]:
    """
    Validate a required string field with optional length constraints.
    
    Args:
        data: Dictionary containing the data to validate
        field: Key to look up in the data
        min_length: Minimum string length (optional)
        max_length: Maximum string length (optional)
        field_name: Human-readable field name for error messages
        
    Returns:
        Success with the string value, or Failure with validation error
    """
    display_name = field_name or field
    
    # First check required
    required_result = validate_required(data, field, field_name)
    if required_result.is_failure():
        return required_result  # type: ignore
    
    value = required_result.unwrap()
    
    # Check type
    if not isinstance(value, str):
        return validation_failure(
            f"Field '{display_name}' must be a string",
            field_name=field,
            code=ErrorCode.INVALID_TYPE
        )
    
    # Check min length
    if min_length is not None and len(value) < min_length:
        return validation_failure(
            f"Field '{display_name}' must be at least {min_length} characters",
            field_name=field,
            code=ErrorCode.INVALID_RANGE
        )
    
    # Check max length
    if max_length is not None and len(value) > max_length:
        return validation_failure(
            f"Field '{display_name}' must be at most {max_length} characters",
            field_name=field,
            code=ErrorCode.INVALID_RANGE
        )
    
    return success(value)


def validate_required_integer(
    data: Dict[str, Any],
    field: str,
    min_value: Optional[int] = None,
    max_value: Optional[int] = None,
    field_name: Optional[str] = None
) -> Result[int, APIError]:
    """
    Validate a required integer field with optional range constraints.
    
    Args:
        data: Dictionary containing the data to validate
        field: Key to look up in the data
        min_value: Minimum value (optional)
        max_value: Maximum value (optional)
        field_name: Human-readable field name for error messages
        
    Returns:
        Success with the integer value, or Failure with validation error
    """
    display_name = field_name or field
    
    # First check required
    required_result = validate_required(data, field, field_name)
    if required_result.is_failure():
        return required_result  # type: ignore
    
    value = required_result.unwrap()
    
    # Try to convert to int
    try:
        int_value = int(value)
    except (ValueError, TypeError):
        return validation_failure(
            f"Field '{display_name}' must be an integer",
            field_name=field,
            code=ErrorCode.INVALID_TYPE
        )
    
    # Check min value
    if min_value is not None and int_value < min_value:
        return validation_failure(
            f"Field '{display_name}' must be at least {min_value}",
            field_name=field,
            code=ErrorCode.INVALID_RANGE
        )
    
    # Check max value
    if max_value is not None and int_value > max_value:
        return validation_failure(
            f"Field '{display_name}' must be at most {max_value}",
            field_name=field,
            code=ErrorCode.INVALID_RANGE
        )
    
    return success(int_value)


def validate_optional(
    data: Dict[str, Any],
    field: str,
    validator: Callable[[Any], Result[T, APIError]],
    default: Optional[T] = None
) -> Result[Optional[T], APIError]:
    """
    Validate an optional field, applying validator only if field is present.
    
    Args:
        data: Dictionary containing the data to validate
        field: Key to look up in the data
        validator: Validator function to apply if field is present
        default: Default value to use if field is not present
        
    Returns:
        Success with the validated value or default, or Failure with validation error
    """
    if field not in data or data[field] is None:
        return success(default)
    
    return validator(data[field])


def validate_email(value: str, field_name: str = 'email') -> Result[str, APIError]:
    """
    Validate that a string is a valid email address format.
    
    Args:
        value: The string to validate
        field_name: Field name for error messages
        
    Returns:
        Success with the email, or Failure with validation error
    """
    import re
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    
    if not isinstance(value, str):
        return validation_failure(
            f"Field '{field_name}' must be a string",
            field_name=field_name,
            code=ErrorCode.INVALID_TYPE
        )
    
    if not re.match(email_pattern, value):
        return validation_failure(
            f"Field '{field_name}' must be a valid email address",
            field_name=field_name,
            code=ErrorCode.INVALID_FORMAT
        )
    
    return success(value)


def validate_min_length(
    value: str,
    min_len: int,
    field_name: str = 'value'
) -> Result[str, APIError]:
    """
    Validate minimum string length.
    
    Args:
        value: The string to validate
        min_len: Minimum length
        field_name: Field name for error messages
        
    Returns:
        Success with the string, or Failure if too short
    """
    if len(value) < min_len:
        return validation_failure(
            f"Field '{field_name}' must be at least {min_len} characters",
            field_name=field_name,
            code=ErrorCode.INVALID_RANGE
        )
    return success(value)


def validate_max_length(
    value: str,
    max_len: int,
    field_name: str = 'value'
) -> Result[str, APIError]:
    """
    Validate maximum string length.
    
    Args:
        value: The string to validate
        max_len: Maximum length
        field_name: Field name for error messages
        
    Returns:
        Success with the string, or Failure if too long
    """
    if len(value) > max_len:
        return validation_failure(
            f"Field '{field_name}' must be at most {max_len} characters",
            field_name=field_name,
            code=ErrorCode.INVALID_RANGE
        )
    return success(value)


def validate_range(
    value: int,
    min_val: Optional[int] = None,
    max_val: Optional[int] = None,
    field_name: str = 'value'
) -> Result[int, APIError]:
    """
    Validate that a number is within a range.
    
    Args:
        value: The number to validate
        min_val: Minimum value (optional)
        max_val: Maximum value (optional)
        field_name: Field name for error messages
        
    Returns:
        Success with the number, or Failure if out of range
    """
    if min_val is not None and value < min_val:
        return validation_failure(
            f"Field '{field_name}' must be at least {min_val}",
            field_name=field_name,
            code=ErrorCode.INVALID_RANGE
        )
    if max_val is not None and value > max_val:
        return validation_failure(
            f"Field '{field_name}' must be at most {max_val}",
            field_name=field_name,
            code=ErrorCode.INVALID_RANGE
        )
    return success(value)


def validate_pattern(
    value: str,
    pattern: str,
    field_name: str = 'value',
    message: Optional[str] = None
) -> Result[str, APIError]:
    """
    Validate that a string matches a regex pattern.
    
    Args:
        value: The string to validate
        pattern: Regex pattern to match
        field_name: Field name for error messages
        message: Custom error message (optional)
        
    Returns:
        Success with the string, or Failure if pattern doesn't match
    """
    import re
    if not re.match(pattern, value):
        error_message = message or f"Field '{field_name}' has invalid format"
        return validation_failure(
            error_message,
            field_name=field_name,
            code=ErrorCode.INVALID_FORMAT
        )
    return success(value)


def validate_one_of(
    value: T,
    allowed_values: List[T],
    field_name: str = 'value'
) -> Result[T, APIError]:
    """
    Validate that a value is one of an allowed set.
    
    Args:
        value: The value to validate
        allowed_values: List of allowed values
        field_name: Field name for error messages
        
    Returns:
        Success with the value, or Failure if not in allowed set
    """
    if value not in allowed_values:
        allowed_str = ', '.join(str(v) for v in allowed_values)
        return validation_failure(
            f"Field '{field_name}' must be one of: {allowed_str}",
            field_name=field_name,
            code=ErrorCode.INVALID_FORMAT
        )
    return success(value)


def validate_all(
    results: List[Result[Any, APIError]]
) -> Result[List[Any], APIError]:
    """
    Validate that all results are successful.
    
    Returns the first failure encountered, or Success with all values.
    This is an alias for sequence() specialized for validation.
    
    Args:
        results: List of validation results
        
    Returns:
        Success with list of values, or first Failure
    """
    return sequence(results)


class ResultValidator:
    """
    Builder class for composing multiple validations using Result types.
    
    Provides a fluent API for building complex validation pipelines.
    
    Example:
        >>> result = (
        ...     ResultValidator(data)
        ...     .require('name')
        ...     .require_string('email', min_length=5)
        ...     .require_integer('age', min_value=0, max_value=150)
        ...     .validate()
        ... )
        >>> if result.is_success():
        ...     validated_data = result.unwrap()
    """
    
    def __init__(self, data: Dict[str, Any]):
        self._data = data
        self._do = ResultDo()
    
    def require(self, field: str, field_name: Optional[str] = None) -> 'ResultValidator':
        """Add a required field validation."""
        result = validate_required(self._data, field, field_name)
        self._do.bind(field, result)
        return self
    
    def require_string(
        self,
        field: str,
        min_length: Optional[int] = None,
        max_length: Optional[int] = None,
        field_name: Optional[str] = None
    ) -> 'ResultValidator':
        """Add a required string field validation."""
        result = validate_required_string(
            self._data, field, min_length, max_length, field_name
        )
        self._do.bind(field, result)
        return self
    
    def require_integer(
        self,
        field: str,
        min_value: Optional[int] = None,
        max_value: Optional[int] = None,
        field_name: Optional[str] = None
    ) -> 'ResultValidator':
        """Add a required integer field validation."""
        result = validate_required_integer(
            self._data, field, min_value, max_value, field_name
        )
        self._do.bind(field, result)
        return self
    
    def validate(self) -> Result[Dict[str, Any], APIError]:
        """
        Execute all validations and return the result.
        
        Returns:
            Success with dictionary of validated values, or Failure with first error
        """
        return self._do.result()

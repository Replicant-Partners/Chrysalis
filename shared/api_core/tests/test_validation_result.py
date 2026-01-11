"""
Tests for Result-returning validation utilities.
"""

import pytest
from ..validation import (
    validate_required,
    validate_required_string,
    validate_required_integer,
    validate_optional,
    validate_email,
    validate_min_length,
    validate_max_length,
    validate_range,
    validate_pattern,
    validate_one_of,
    validate_all,
    ResultValidator,
)
from ..result import success, failure
from ..models import ErrorCode


class TestValidateRequired:
    """Tests for validate_required function."""

    def test_present_field_returns_success(self):
        """Present non-None field returns Success with value."""
        data = {'name': 'Alice'}
        result = validate_required(data, 'name')
        assert result.is_success()
        assert result.unwrap() == 'Alice'

    def test_missing_field_returns_failure(self):
        """Missing field returns Failure with validation error."""
        data = {'other': 'value'}
        result = validate_required(data, 'name')
        assert result.is_failure()
        error = result.error
        assert 'name' in error.message
        assert 'required' in error.message.lower()

    def test_none_value_returns_failure(self):
        """Field with None value returns Failure."""
        data = {'name': None}
        result = validate_required(data, 'name')
        assert result.is_failure()

    def test_custom_field_name_in_error(self):
        """Custom field name appears in error message."""
        data = {}
        result = validate_required(data, 'user_name', field_name='User Name')
        assert result.is_failure()
        assert 'User Name' in result.error.message

    def test_empty_string_is_valid(self):
        """Empty string is valid (present but empty)."""
        data = {'name': ''}
        result = validate_required(data, 'name')
        assert result.is_success()
        assert result.unwrap() == ''


class TestValidateRequiredString:
    """Tests for validate_required_string function."""

    def test_valid_string_returns_success(self):
        """Valid string returns Success."""
        data = {'name': 'Alice'}
        result = validate_required_string(data, 'name')
        assert result.is_success()
        assert result.unwrap() == 'Alice'

    def test_non_string_returns_failure(self):
        """Non-string value returns Failure."""
        data = {'name': 123}
        result = validate_required_string(data, 'name')
        assert result.is_failure()
        assert 'string' in result.error.message.lower()

    def test_min_length_enforced(self):
        """Min length constraint is enforced."""
        data = {'name': 'Al'}
        result = validate_required_string(data, 'name', min_length=3)
        assert result.is_failure()
        assert '3' in result.error.message

    def test_max_length_enforced(self):
        """Max length constraint is enforced."""
        data = {'name': 'Alexander'}
        result = validate_required_string(data, 'name', max_length=5)
        assert result.is_failure()
        assert '5' in result.error.message

    def test_within_length_bounds_success(self):
        """String within bounds returns Success."""
        data = {'name': 'Alice'}
        result = validate_required_string(data, 'name', min_length=3, max_length=10)
        assert result.is_success()

    def test_missing_field_returns_failure(self):
        """Missing field returns Failure."""
        data = {}
        result = validate_required_string(data, 'name')
        assert result.is_failure()


class TestValidateRequiredInteger:
    """Tests for validate_required_integer function."""

    def test_valid_integer_returns_success(self):
        """Valid integer returns Success."""
        data = {'age': 25}
        result = validate_required_integer(data, 'age')
        assert result.is_success()
        assert result.unwrap() == 25

    def test_string_integer_converts(self):
        """String integer is converted."""
        data = {'age': '25'}
        result = validate_required_integer(data, 'age')
        assert result.is_success()
        assert result.unwrap() == 25

    def test_non_numeric_returns_failure(self):
        """Non-numeric value returns Failure."""
        data = {'age': 'twenty-five'}
        result = validate_required_integer(data, 'age')
        assert result.is_failure()
        assert 'integer' in result.error.message.lower()

    def test_min_value_enforced(self):
        """Min value constraint is enforced."""
        data = {'age': -5}
        result = validate_required_integer(data, 'age', min_value=0)
        assert result.is_failure()
        assert '0' in result.error.message

    def test_max_value_enforced(self):
        """Max value constraint is enforced."""
        data = {'age': 200}
        result = validate_required_integer(data, 'age', max_value=150)
        assert result.is_failure()
        assert '150' in result.error.message

    def test_within_range_success(self):
        """Integer within range returns Success."""
        data = {'age': 25}
        result = validate_required_integer(data, 'age', min_value=0, max_value=150)
        assert result.is_success()


class TestValidateOptional:
    """Tests for validate_optional function."""

    def test_missing_field_returns_default(self):
        """Missing field returns default value."""
        data = {}
        result = validate_optional(data, 'name', lambda v: success(v), default='Unknown')
        assert result.is_success()
        assert result.unwrap() == 'Unknown'

    def test_none_field_returns_default(self):
        """None field returns default value."""
        data = {'name': None}
        result = validate_optional(data, 'name', lambda v: success(v), default='Unknown')
        assert result.is_success()
        assert result.unwrap() == 'Unknown'

    def test_present_field_validates(self):
        """Present field passes through validator."""
        data = {'name': 'Alice'}
        result = validate_optional(data, 'name', lambda v: success(v.upper()))
        assert result.is_success()
        assert result.unwrap() == 'ALICE'

    def test_validator_failure_propagates(self):
        """Validator failure propagates."""
        data = {'name': 'invalid'}
        result = validate_optional(
            data, 'name', 
            lambda v: failure(Exception('Invalid value'))
        )
        assert result.is_failure()


class TestValidateEmail:
    """Tests for validate_email function."""

    def test_valid_email_returns_success(self):
        """Valid email returns Success."""
        result = validate_email('user@example.com')
        assert result.is_success()
        assert result.unwrap() == 'user@example.com'

    def test_invalid_email_returns_failure(self):
        """Invalid email returns Failure."""
        result = validate_email('not-an-email')
        assert result.is_failure()
        assert 'email' in result.error.message.lower()

    def test_email_without_at_fails(self):
        """Email without @ fails."""
        result = validate_email('userexample.com')
        assert result.is_failure()

    def test_email_without_domain_fails(self):
        """Email without domain fails."""
        result = validate_email('user@')
        assert result.is_failure()

    def test_non_string_fails(self):
        """Non-string value fails."""
        result = validate_email(123)  # type: ignore
        assert result.is_failure()


class TestValidateMinLength:
    """Tests for validate_min_length function."""

    def test_string_at_min_length_success(self):
        """String at min length returns Success."""
        result = validate_min_length('abc', 3)
        assert result.is_success()

    def test_string_above_min_length_success(self):
        """String above min length returns Success."""
        result = validate_min_length('abcdef', 3)
        assert result.is_success()

    def test_string_below_min_length_failure(self):
        """String below min length returns Failure."""
        result = validate_min_length('ab', 3)
        assert result.is_failure()
        assert '3' in result.error.message


class TestValidateMaxLength:
    """Tests for validate_max_length function."""

    def test_string_at_max_length_success(self):
        """String at max length returns Success."""
        result = validate_max_length('abc', 3)
        assert result.is_success()

    def test_string_below_max_length_success(self):
        """String below max length returns Success."""
        result = validate_max_length('ab', 3)
        assert result.is_success()

    def test_string_above_max_length_failure(self):
        """String above max length returns Failure."""
        result = validate_max_length('abcd', 3)
        assert result.is_failure()
        assert '3' in result.error.message


class TestValidateRange:
    """Tests for validate_range function."""

    def test_value_within_range_success(self):
        """Value within range returns Success."""
        result = validate_range(5, min_val=0, max_val=10)
        assert result.is_success()

    def test_value_at_min_success(self):
        """Value at min boundary returns Success."""
        result = validate_range(0, min_val=0, max_val=10)
        assert result.is_success()

    def test_value_at_max_success(self):
        """Value at max boundary returns Success."""
        result = validate_range(10, min_val=0, max_val=10)
        assert result.is_success()

    def test_value_below_min_failure(self):
        """Value below min returns Failure."""
        result = validate_range(-1, min_val=0, max_val=10)
        assert result.is_failure()

    def test_value_above_max_failure(self):
        """Value above max returns Failure."""
        result = validate_range(11, min_val=0, max_val=10)
        assert result.is_failure()

    def test_only_min_constraint(self):
        """Only min constraint works."""
        result = validate_range(100, min_val=0)
        assert result.is_success()

    def test_only_max_constraint(self):
        """Only max constraint works."""
        result = validate_range(-100, max_val=0)
        assert result.is_success()


class TestValidatePattern:
    """Tests for validate_pattern function."""

    def test_matching_pattern_success(self):
        """Value matching pattern returns Success."""
        result = validate_pattern('ABC123', r'^[A-Z]+\d+$')
        assert result.is_success()

    def test_non_matching_pattern_failure(self):
        """Value not matching pattern returns Failure."""
        result = validate_pattern('abc123', r'^[A-Z]+\d+$')
        assert result.is_failure()

    def test_custom_error_message(self):
        """Custom error message is used."""
        result = validate_pattern('invalid', r'^\d+$', message='Must be numeric')
        assert result.is_failure()
        assert 'Must be numeric' in result.error.message


class TestValidateOneOf:
    """Tests for validate_one_of function."""

    def test_value_in_set_success(self):
        """Value in allowed set returns Success."""
        result = validate_one_of('red', ['red', 'green', 'blue'])
        assert result.is_success()

    def test_value_not_in_set_failure(self):
        """Value not in allowed set returns Failure."""
        result = validate_one_of('yellow', ['red', 'green', 'blue'])
        assert result.is_failure()
        assert 'red' in result.error.message
        assert 'green' in result.error.message
        assert 'blue' in result.error.message

    def test_integer_values(self):
        """Integer values work correctly."""
        result = validate_one_of(2, [1, 2, 3])
        assert result.is_success()


class TestValidateAll:
    """Tests for validate_all function."""

    def test_all_success_returns_success(self):
        """All successes returns Success with values."""
        results = [success(1), success(2), success(3)]
        result = validate_all(results)
        assert result.is_success()
        assert result.unwrap() == [1, 2, 3]

    def test_one_failure_returns_failure(self):
        """One failure returns that Failure."""
        results = [success(1), failure(Exception('Error')), success(3)]
        result = validate_all(results)
        assert result.is_failure()

    def test_empty_list_returns_success(self):
        """Empty list returns Success with empty list."""
        result = validate_all([])
        assert result.is_success()
        assert result.unwrap() == []


class TestResultValidator:
    """Tests for ResultValidator builder class."""

    def test_single_required_field_valid(self):
        """Single required field validates correctly."""
        data = {'name': 'Alice'}
        result = ResultValidator(data).require('name').validate()
        assert result.is_success()
        assert result.unwrap()['name'] == 'Alice'

    def test_single_required_field_missing(self):
        """Missing required field fails."""
        data = {}
        result = ResultValidator(data).require('name').validate()
        assert result.is_failure()

    def test_multiple_fields_valid(self):
        """Multiple valid fields pass."""
        data = {'name': 'Alice', 'email': 'alice@example.com', 'age': 25}
        result = (
            ResultValidator(data)
            .require('name')
            .require_string('email', min_length=5)
            .require_integer('age', min_value=0)
            .validate()
        )
        assert result.is_success()
        validated = result.unwrap()
        assert validated['name'] == 'Alice'
        assert validated['email'] == 'alice@example.com'
        assert validated['age'] == 25

    def test_first_failure_reported(self):
        """First failing field is reported."""
        data = {'name': '', 'email': 'invalid'}
        result = (
            ResultValidator(data)
            .require_string('name', min_length=1)
            .require_string('email', min_length=10)
            .validate()
        )
        assert result.is_failure()
        # First failure should be name (min_length 1)
        assert 'name' in result.error.message.lower()

    def test_chained_validation_fluent(self):
        """Fluent API chains correctly."""
        data = {'username': 'alice', 'password': 'secret123', 'port': '8080'}
        result = (
            ResultValidator(data)
            .require_string('username', min_length=3, max_length=20)
            .require_string('password', min_length=8)
            .require_integer('port', min_value=1, max_value=65535)
            .validate()
        )
        assert result.is_success()
        validated = result.unwrap()
        assert validated['username'] == 'alice'
        assert validated['password'] == 'secret123'
        assert validated['port'] == 8080  # Converted to int


class TestIntegrationValidation:
    """Integration tests combining multiple validators."""

    def test_user_registration_validation(self):
        """Simulate user registration validation."""
        data = {
            'username': 'alice_smith',
            'email': 'alice@example.com',
            'password': 'securepassword123',
            'age': 25,
            'role': 'user'
        }
        
        # Validate username
        username_result = validate_required_string(
            data, 'username', min_length=3, max_length=30
        )
        
        # Validate email
        email_result = validate_required(data, 'email').flat_map(
            lambda v: validate_email(v)
        )
        
        # Validate password
        password_result = validate_required_string(
            data, 'password', min_length=8
        )
        
        # Validate age
        age_result = validate_required_integer(
            data, 'age', min_value=13, max_value=120
        )
        
        # Validate role
        role_result = validate_required(data, 'role').flat_map(
            lambda v: validate_one_of(v, ['admin', 'user', 'guest'])
        )
        
        # All should pass
        assert username_result.is_success()
        assert email_result.is_success()
        assert password_result.is_success()
        assert age_result.is_success()
        assert role_result.is_success()

    def test_api_request_validation_failure(self):
        """Simulate API request validation with failures."""
        data = {
            'query': 'a',  # Too short
            'limit': 0,    # Below minimum
            'format': 'xml'  # Not allowed
        }
        
        query_result = validate_required_string(
            data, 'query', min_length=3, field_name='Search Query'
        )
        limit_result = validate_required_integer(
            data, 'limit', min_value=1, max_value=100
        )
        format_result = validate_required(data, 'format').flat_map(
            lambda v: validate_one_of(v, ['json', 'csv'])
        )
        
        # All should fail
        assert query_result.is_failure()
        assert limit_result.is_failure()
        assert format_result.is_failure()
        
        # Error messages should be descriptive
        assert 'Search Query' in query_result.error.message
        assert '1' in limit_result.error.message
        assert 'json' in format_result.error.message

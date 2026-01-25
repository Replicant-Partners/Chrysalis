"""
Comprehensive Unit Tests for Result Type Pattern Implementation

Tests cover:
- Core type definitions (Success, Failure)
- Type guards (is_success, is_failure)
- Constructors (success, failure)
- Functor operations (map, map_error)
- Monad operations (flat_map, chain, and_then)
- Catamorphism (fold, match)
- Utility operations (get_or_else, to_optional, unwrap)
- Combining operations (sequence, traverse, zip_results)
- Exception bridge functions (try_catch, try_catch_async)
- Builder pattern (ResultDo)
- Predicate-based constructors
"""

import pytest
from unittest.mock import MagicMock

from ..result import (
    Result,
    Success,
    Failure,
    success,
    failure,
    validation_failure,
    not_found_failure,
    service_failure,
    map_result,
    map_error,
    flat_map,
    fold,
    get_or_else,
    sequence,
    traverse,
    zip_results,
    zip3_results,
    try_catch,
    try_catch_async,
    ResultDo,
    from_predicate,
    from_optional,
    from_exception,
)
from ..models import APIError, ErrorCode, ErrorCategory


# ============================================================================
# Core Type Tests
# ============================================================================

class TestSuccessType:
    """Tests for Success variant."""
    
    def test_success_is_success(self):
        """Success.is_success() returns True."""
        result = Success(42)
        assert result.is_success() is True
    
    def test_success_is_not_failure(self):
        """Success.is_failure() returns False."""
        result = Success(42)
        assert result.is_failure() is False
    
    def test_success_contains_value(self):
        """Success stores the wrapped value."""
        result = Success("test value")
        assert result.value == "test value"
    
    def test_success_repr(self):
        """Success has useful repr."""
        result = Success(42)
        assert repr(result) == "Success(42)"
    
    def test_success_is_immutable(self):
        """Success is frozen/immutable."""
        result = Success(42)
        with pytest.raises((AttributeError, TypeError)):
            result.value = 100  # type: ignore


class TestFailureType:
    """Tests for Failure variant."""
    
    def test_failure_is_not_success(self):
        """Failure.is_success() returns False."""
        result = Failure("error")
        assert result.is_success() is False
    
    def test_failure_is_failure(self):
        """Failure.is_failure() returns True."""
        result = Failure("error")
        assert result.is_failure() is True
    
    def test_failure_contains_error(self):
        """Failure stores the wrapped error."""
        result = Failure("error message")
        assert result.error == "error message"
    
    def test_failure_repr(self):
        """Failure has useful repr."""
        result = Failure("error")
        assert repr(result) == "Failure('error')"


# ============================================================================
# Constructor Function Tests
# ============================================================================

class TestConstructors:
    """Tests for constructor functions."""
    
    def test_success_function(self):
        """success() creates Success instance."""
        result = success(42)
        assert isinstance(result, Success)
        assert result.value == 42
    
    def test_failure_function(self):
        """failure() creates Failure instance."""
        result = failure("error")
        assert isinstance(result, Failure)
        assert result.error == "error"
    
    def test_success_with_none(self):
        """success() can wrap None."""
        result = success(None)
        assert result.is_success()
        assert result.value is None
    
    def test_success_with_complex_object(self):
        """success() can wrap complex objects."""
        obj = {"key": "value", "list": [1, 2, 3]}
        result = success(obj)
        assert result.value == obj


# ============================================================================
# APIError Factory Tests
# ============================================================================

class TestAPIErrorFactories:
    """Tests for APIError factory functions."""
    
    def test_validation_failure_basic(self):
        """validation_failure creates proper error structure."""
        result = validation_failure("Invalid input")
        assert result.is_failure()
        assert result.error.category == ErrorCategory.VALIDATION_ERROR
        assert result.error.message == "Invalid input"
    
    def test_validation_failure_with_field(self):
        """validation_failure includes field name in details."""
        result = validation_failure("Required", field_name="username")
        assert result.error.details[0].field == "username"
    
    def test_validation_failure_with_code(self):
        """validation_failure uses specified error code."""
        result = validation_failure("Bad format", code=ErrorCode.INVALID_FORMAT)
        assert result.error.code == ErrorCode.INVALID_FORMAT
    
    def test_not_found_failure(self):
        """not_found_failure creates proper error structure."""
        result = not_found_failure("User", "user-123")
        assert result.is_failure()
        assert result.error.category == ErrorCategory.NOT_FOUND_ERROR
        assert result.error.code == ErrorCode.RESOURCE_NOT_FOUND
        assert "user-123" in result.error.message
    
    def test_service_failure_basic(self):
        """service_failure creates proper error structure."""
        result = service_failure("Database connection failed")
        assert result.is_failure()
        assert result.error.category == ErrorCategory.SERVICE_ERROR
        assert result.error.code == ErrorCode.INTERNAL_ERROR
    
    def test_service_failure_with_original_error(self):
        """service_failure includes original error details."""
        original = ValueError("Original error")
        result = service_failure("Wrapped error", original_error=original)
        assert len(result.error.details) > 0


# ============================================================================
# Functor Operation Tests (map)
# ============================================================================

class TestMapOperation:
    """Tests for map operations."""
    
    def test_map_success_transforms_value(self):
        """map on Success applies function to value."""
        result = success(5)
        mapped = result.map(lambda x: x * 2)
        assert mapped.is_success()
        assert mapped.value == 10
    
    def test_map_failure_returns_failure(self):
        """map on Failure returns same Failure."""
        result = failure("error")
        mapped = result.map(lambda x: x * 2)
        assert mapped.is_failure()
        assert mapped.error == "error"
    
    def test_map_result_function(self):
        """Standalone map_result function works."""
        result = success(5)
        mapped = map_result(result, lambda x: x * 2)
        assert mapped.value == 10
    
    def test_map_error_transforms_error(self):
        """map_error on Failure transforms error."""
        result: Result[int, str] = failure("error")
        mapped = result.map_error(lambda e: f"Wrapped: {e}")
        assert mapped.is_failure()
        assert mapped.error == "Wrapped: error"
    
    def test_map_error_on_success(self):
        """map_error on Success returns same Success."""
        result: Result[int, str] = success(42)
        mapped = result.map_error(lambda e: f"Wrapped: {e}")
        assert mapped.is_success()
        assert mapped.value == 42


# ============================================================================
# Monad Operation Tests (flatMap/chain)
# ============================================================================

class TestFlatMapOperation:
    """Tests for flatMap/chain operations."""
    
    def test_flat_map_success_chains(self):
        """flat_map on Success chains to new Result."""
        result = success(5)
        chained = result.flat_map(lambda x: success(x * 2))
        assert chained.is_success()
        assert chained.value == 10
    
    def test_flat_map_success_can_return_failure(self):
        """flat_map function can return Failure."""
        result = success(5)
        chained = result.flat_map(lambda x: failure("failed") if x < 10 else success(x))
        assert chained.is_failure()
        assert chained.error == "failed"
    
    def test_flat_map_failure_short_circuits(self):
        """flat_map on Failure returns same Failure without calling function."""
        called = []
        result = failure("error")
        chained = result.flat_map(lambda x: (called.append(x), success(x * 2))[1])
        assert chained.is_failure()
        assert not called
    
    def test_chain_alias(self):
        """chain is alias for flat_map."""
        result = success(5)
        chained = result.chain(lambda x: success(x * 2))
        assert chained.value == 10
    
    def test_and_then_alias(self):
        """and_then is alias for flat_map."""
        result = success(5)
        chained = result.and_then(lambda x: success(x * 2))
        assert chained.value == 10
    
    def test_flat_map_function(self):
        """Standalone flat_map function works."""
        result = success(5)
        chained = flat_map(result, lambda x: success(x * 2))
        assert chained.value == 10


# ============================================================================
# Catamorphism Tests (fold/match)
# ============================================================================

class TestFoldOperation:
    """Tests for fold/match operations."""
    
    def test_fold_success(self):
        """fold applies success function on Success."""
        result = success(5)
        output = result.fold(
            on_success=lambda x: f"Value: {x}",
            on_failure=lambda e: f"Error: {e}"
        )
        assert output == "Value: 5"
    
    def test_fold_failure(self):
        """fold applies failure function on Failure."""
        result = failure("oops")
        output = result.fold(
            on_success=lambda x: f"Value: {x}",
            on_failure=lambda e: f"Error: {e}"
        )
        assert output == "Error: oops"
    
    def test_match_alias(self):
        """match is alias for fold."""
        result = success(5)
        output = result.match(
            on_success=lambda x: x * 2,
            on_failure=lambda e: 0
        )
        assert output == 10
    
    def test_fold_function(self):
        """Standalone fold function works."""
        result = success(5)
        output = fold(result, lambda x: x * 2, lambda e: 0)
        assert output == 10


# ============================================================================
# Utility Operation Tests
# ============================================================================

class TestUtilityOperations:
    """Tests for utility operations."""
    
    def test_get_or_else_success(self):
        """get_or_else returns value on Success."""
        result = success(42)
        assert result.get_or_else(0) == 42
    
    def test_get_or_else_failure(self):
        """get_or_else returns default on Failure."""
        result = failure("error")
        assert result.get_or_else(0) == 0
    
    def test_get_or_else_lazy_success(self):
        """get_or_else_lazy returns value on Success."""
        result = success(42)
        assert result.get_or_else_lazy(lambda e: 0) == 42
    
    def test_get_or_else_lazy_failure(self):
        """get_or_else_lazy computes default on Failure."""
        result = failure("error")
        assert result.get_or_else_lazy(lambda e: len(e)) == 5
    
    def test_to_optional_success(self):
        """to_optional returns value on Success."""
        result = success(42)
        assert result.to_optional() == 42
    
    def test_to_optional_failure(self):
        """to_optional returns None on Failure."""
        result = failure("error")
        assert result.to_optional() is None
    
    def test_unwrap_success(self):
        """unwrap returns value on Success."""
        result = success(42)
        assert result.unwrap() == 42
    
    def test_unwrap_failure_raises(self):
        """unwrap raises on Failure."""
        result = failure(ValueError("test error"))
        with pytest.raises(ValueError):
            result.unwrap()
    
    def test_unwrap_error_success_raises(self):
        """unwrap_error raises on Success."""
        result = success(42)
        with pytest.raises(ValueError):
            result.unwrap_error()
    
    def test_unwrap_error_failure(self):
        """unwrap_error returns error on Failure."""
        result = failure("error")
        assert result.unwrap_error() == "error"
    
    def test_get_or_else_function(self):
        """Standalone get_or_else function works."""
        result = failure("error")
        assert get_or_else(result, 0) == 0


# ============================================================================
# Combining Results Tests
# ============================================================================

class TestCombiningResults:
    """Tests for combining multiple Results."""
    
    def test_sequence_all_success(self):
        """sequence combines list of Success into Success of list."""
        results = [success(1), success(2), success(3)]
        combined = sequence(results)
        assert combined.is_success()
        assert combined.value == [1, 2, 3]
    
    def test_sequence_with_failure(self):
        """sequence returns first Failure encountered."""
        results = [success(1), failure("error"), success(3)]
        combined = sequence(results)
        assert combined.is_failure()
        assert combined.error == "error"
    
    def test_sequence_empty_list(self):
        """sequence of empty list returns Success of empty list."""
        combined = sequence([])
        assert combined.is_success()
        assert combined.value == []
    
    def test_traverse_all_success(self):
        """traverse maps and sequences."""
        items = [1, 2, 3]
        combined = traverse(items, lambda x: success(x * 2))
        assert combined.is_success()
        assert combined.value == [2, 4, 6]
    
    def test_traverse_with_failure(self):
        """traverse short-circuits on failure."""
        items = [1, 2, 3]
        combined = traverse(items, lambda x: failure("nope") if x == 2 else success(x))
        assert combined.is_failure()
    
    def test_zip_results_both_success(self):
        """zip_results combines two Success into tuple."""
        combined = zip_results(success(1), success("a"))
        assert combined.is_success()
        assert combined.value == (1, "a")
    
    def test_zip_results_first_failure(self):
        """zip_results returns first Failure."""
        combined = zip_results(failure("error1"), success("a"))
        assert combined.is_failure()
        assert combined.error == "error1"
    
    def test_zip_results_second_failure(self):
        """zip_results returns second Failure if first is Success."""
        combined = zip_results(success(1), failure("error2"))
        assert combined.is_failure()
        assert combined.error == "error2"
    
    def test_zip3_results_all_success(self):
        """zip3_results combines three Success into tuple."""
        combined = zip3_results(success(1), success("a"), success(True))
        assert combined.is_success()
        assert combined.value == (1, "a", True)


# ============================================================================
# Exception Bridge Tests
# ============================================================================

class TestExceptionBridge:
    """Tests for exception bridge functions."""
    
    def test_try_catch_success(self):
        """try_catch wraps successful execution."""
        result = try_catch(lambda: 42)
        assert result.is_success()
        assert result.value == 42
    
    def test_try_catch_failure(self):
        """try_catch catches exception and wraps in Failure."""
        def raise_error():
            raise ValueError("test error")
        
        result = try_catch(raise_error)
        assert result.is_failure()
    
    def test_try_catch_with_error_mapper(self):
        """try_catch uses error mapper when provided."""
        def raise_error():
            raise ValueError("test")
        
        result = try_catch(
            raise_error,
            error_mapper=lambda e: f"Caught: {e}"
        )
        assert result.is_failure()
        assert result.error == "Caught: test"
    
    @pytest.mark.asyncio
    async def test_try_catch_async_success(self):
        """try_catch_async wraps successful async execution."""
        async def async_fn():
            return 42
        
        result = await try_catch_async(async_fn)
        assert result.is_success()
        assert result.value == 42
    
    @pytest.mark.asyncio
    async def test_try_catch_async_failure(self):
        """try_catch_async catches async exception."""
        async def async_fn():
            raise ValueError("async error")
        
        result = await try_catch_async(async_fn)
        assert result.is_failure()


# ============================================================================
# ResultDo Builder Tests
# ============================================================================

class TestResultDoBuilder:
    """Tests for ResultDo builder pattern."""
    
    def test_result_do_all_success(self):
        """ResultDo accumulates success values."""
        do = ResultDo()
        do.bind('a', success(1))
        do.bind('b', success(2))
        do.bind('c', success(3))
        
        result = do.result()
        assert result.is_success()
        assert result.value == {'a': 1, 'b': 2, 'c': 3}
    
    def test_result_do_with_failure(self):
        """ResultDo short-circuits on failure."""
        do = ResultDo()
        do.bind('a', success(1))
        do.bind('b', failure("error"))
        do.bind('c', success(3))  # Should not be processed
        
        result = do.result()
        assert result.is_failure()
        assert result.error == "error"
    
    def test_result_do_map(self):
        """ResultDo.map transforms accumulated values."""
        do = ResultDo()
        do.bind('x', success(5))
        do.bind('y', success(10))
        
        result = do.map(lambda d: d['x'] + d['y'])
        assert result.is_success()
        assert result.value == 15
    
    def test_result_do_chaining(self):
        """ResultDo supports method chaining."""
        result = (
            ResultDo()
            .bind('a', success(1))
            .bind('b', success(2))
            .result()
        )
        assert result.value == {'a': 1, 'b': 2}


# ============================================================================
# Predicate-based Constructor Tests
# ============================================================================

class TestPredicateConstructors:
    """Tests for predicate-based constructors."""
    
    def test_from_predicate_true(self):
        """from_predicate returns Success when predicate is True."""
        result = from_predicate(10, lambda x: x > 5, "Too small")
        assert result.is_success()
        assert result.value == 10
    
    def test_from_predicate_false(self):
        """from_predicate returns Failure when predicate is False."""
        result = from_predicate(3, lambda x: x > 5, "Too small")
        assert result.is_failure()
        assert result.error == "Too small"
    
    def test_from_optional_with_value(self):
        """from_optional returns Success for non-None value."""
        result = from_optional(42, "No value")
        assert result.is_success()
        assert result.value == 42
    
    def test_from_optional_with_none(self):
        """from_optional returns Failure for None."""
        result = from_optional(None, "No value")
        assert result.is_failure()
        assert result.error == "No value"
    
    def test_from_exception_success(self):
        """from_exception returns Success for non-raising function."""
        result = from_exception(lambda: 42)
        assert result.is_success()
        assert result.value == 42
    
    def test_from_exception_catches(self):
        """from_exception catches specified exception type."""
        result = from_exception(lambda: int("not a number"), ValueError)
        assert result.is_failure()
        assert isinstance(result.error, ValueError)


# ============================================================================
# Integration Tests
# ============================================================================

class TestIntegration:
    """Integration tests demonstrating real-world usage patterns."""
    
    def test_validation_pipeline(self):
        """Demonstrate validation pipeline using Result."""
        def validate_name(name: str) -> Result[str, str]:
            if not name:
                return failure("Name is required")
            return failure("Name too short") if len(name) < 2 else success(name.strip())

        def validate_age(age: int) -> Result[int, str]:
            if age < 0:
                return failure("Age cannot be negative")
            if age > 150:
                return failure("Age is unrealistic")
            return success(age)

        # Valid input
        name_result = validate_name("John")
        age_result = validate_age(30)

        combined = zip_results(name_result, age_result)
        assert combined.is_success()
        assert combined.value == ("John", 30)

        # Invalid input
        invalid_name = validate_name("")
        assert invalid_name.is_failure()
    
    def test_chained_operations(self):
        """Demonstrate chained operations with map and flat_map."""
        def fetch_user_id(token: str) -> Result[int, str]:
            return success(123) if token == "valid" else failure("Invalid token")

        def fetch_user_data(user_id: int) -> Result[dict, str]:
            if user_id == 123:
                return success({"id": 123, "name": "John"})
            return failure("User not found")

        # Success path
        result = (
            fetch_user_id("valid")
            .flat_map(fetch_user_data)
            .map(lambda user: user["name"])
        )
        assert result.is_success()
        assert result.value == "John"

        # Failure path (stops at first failure)
        result = (
            fetch_user_id("invalid")
            .flat_map(fetch_user_data)
            .map(lambda user: user["name"])
        )
        assert result.is_failure()
        assert result.error == "Invalid token"
    
    def test_error_recovery(self):
        """Demonstrate error recovery pattern."""
        def risky_operation() -> Result[int, str]:
            return failure("Primary failed")
        
        def fallback_operation() -> Result[int, str]:
            return success(42)
        
        # Using fold for recovery
        result = risky_operation()
        recovered = result.fold(
            on_success=lambda x: success(x),
            on_failure=lambda _: fallback_operation()
        )
        
        assert recovered.is_success()
        assert recovered.value == 42


# ============================================================================
# Property-Based Tests (if hypothesis is available)
# ============================================================================

try:
    from hypothesis import given, strategies as st
    
    class TestResultProperties:
        """Property-based tests for Result laws."""
        
        @given(st.integers())
        def test_success_identity_law(self, x):
            """Success.map(identity) == Success."""
            result = success(x)
            mapped = result.map(lambda y: y)
            assert mapped.value == x
        
        @given(st.integers())
        def test_flat_map_left_identity(self, x):
            """flat_map(success(x), f) == f(x)."""
            f = lambda y: success(y * 2)
            result = success(x).flat_map(f)
            direct = f(x)
            assert result.value == direct.value
        
        @given(st.integers())
        def test_flat_map_right_identity(self, x):
            """m.flat_map(success) == m."""
            m = success(x)
            result = m.flat_map(success)
            assert result.value == m.value
            
except ImportError:
    # hypothesis not available, skip property tests
    pass

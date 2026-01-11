"""
Result Type Pattern Implementation for Chrysalis API (Python)

Provides monadic error handling as an alternative to exception-based patterns.
Implements Success/Failure pattern with functional combinators.

Design Rationale:
- Aligns with Decision 4 (ValidationStrategy) - enables runtime selection between
  imperative validation (raising) and functional validation (Result-returning)
- Aligns with Decision 7 (Hexagonal Architecture) - Result types are framework-agnostic
  and belong in the domain layer
- Complements existing APIError taxonomy for consistent error representation

Usage:
    >>> from shared.api_core.result import Result, Success, Failure, success, failure
    >>> 
    >>> def parse_integer(input: str) -> Result[int, str]:
    ...     try:
    ...         return success(int(input))
    ...     except ValueError:
    ...         return failure("Not a valid integer")
    >>> 
    >>> result = parse_integer("42")
    >>> doubled = result.map(lambda x: x * 2)
    >>> print(doubled.unwrap())  # 84
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import (
    Any,
    Callable,
    Generic,
    List,
    Optional,
    TypeVar,
    Union,
    Awaitable,
    overload,
)

from .models import APIError, ErrorCode, ErrorCategory, ErrorDetail

# Type variables for generic Result type
T = TypeVar('T')  # Success value type
E = TypeVar('E')  # Error type
U = TypeVar('U')  # Transformed value type
F = TypeVar('F')  # Transformed error type

# Default error type is APIError
DefaultE = APIError


# ============================================================================
# Core Result Type Definitions
# ============================================================================

class Result(ABC, Generic[T, E]):
    """
    Abstract base class for Result type.
    
    Result represents either a successful computation (Success) or a failed
    computation (Failure). This enables explicit error handling without
    exceptions while maintaining type safety.
    
    Generic Parameters:
        T: The type of the success value
        E: The type of the error (defaults to APIError)
    
    Example:
        >>> def divide(a: int, b: int) -> Result[float, str]:
        ...     if b == 0:
        ...         return failure("Division by zero")
        ...     return success(a / b)
        >>> 
        >>> result = divide(10, 2)
        >>> print(result.unwrap())  # 5.0
    """
    
    @abstractmethod
    def is_success(self) -> bool:
        """Check if this Result is a Success."""
        ...
    
    @abstractmethod
    def is_failure(self) -> bool:
        """Check if this Result is a Failure."""
        ...
    
    @abstractmethod
    def map(self, fn: Callable[[T], U]) -> Result[U, E]:
        """
        Transform the success value using the provided function.
        
        If this is a Success, applies fn to the value and returns Success(fn(value)).
        If this is a Failure, returns the Failure unchanged.
        
        This is the Functor 'map' operation.
        
        Args:
            fn: Function to transform the success value
            
        Returns:
            Result with transformed value or original error
        """
        ...
    
    @abstractmethod
    def map_error(self, fn: Callable[[E], F]) -> Result[T, F]:
        """
        Transform the error value using the provided function.
        
        If this is a Failure, applies fn to the error and returns Failure(fn(error)).
        If this is a Success, returns the Success unchanged.
        
        Args:
            fn: Function to transform the error value
            
        Returns:
            Result with original value or transformed error
        """
        ...
    
    @abstractmethod
    def flat_map(self, fn: Callable[[T], Result[U, E]]) -> Result[U, E]:
        """
        Chain Result-returning operations.
        
        If this is a Success, applies fn to the value (fn returns a Result).
        If this is a Failure, returns the Failure unchanged.
        
        This is the Monad 'bind' / 'flatMap' / 'chain' operation.
        
        Args:
            fn: Function that takes the success value and returns a Result
            
        Returns:
            The Result from fn if Success, or the original Failure
        """
        ...
    
    # Alias for flat_map
    def and_then(self, fn: Callable[[T], Result[U, E]]) -> Result[U, E]:
        """Alias for flat_map."""
        return self.flat_map(fn)
    
    # Alias for flat_map
    def chain(self, fn: Callable[[T], Result[U, E]]) -> Result[U, E]:
        """Alias for flat_map."""
        return self.flat_map(fn)
    
    @abstractmethod
    def fold(
        self,
        on_success: Callable[[T], U],
        on_failure: Callable[[E], U]
    ) -> U:
        """
        Pattern match on the Result and apply the appropriate function.
        
        This is a catamorphism that collapses the Result into a single value.
        
        Args:
            on_success: Function to apply if Success
            on_failure: Function to apply if Failure
            
        Returns:
            The result of applying the appropriate function
        """
        ...
    
    # Alias for fold
    def match(
        self,
        on_success: Callable[[T], U],
        on_failure: Callable[[E], U]
    ) -> U:
        """Alias for fold."""
        return self.fold(on_success, on_failure)
    
    @abstractmethod
    def get_or_else(self, default: T) -> T:
        """
        Extract the value or return a default.
        
        Args:
            default: Default value if this is a Failure
            
        Returns:
            The success value or the default
        """
        ...
    
    @abstractmethod
    def get_or_else_lazy(self, fn: Callable[[E], T]) -> T:
        """
        Extract the value or compute a default from the error.
        
        Args:
            fn: Function to compute default from error
            
        Returns:
            The success value or computed default
        """
        ...
    
    @abstractmethod
    def to_optional(self) -> Optional[T]:
        """
        Convert to Optional (None if Failure).
        
        Returns:
            The success value or None
        """
        ...
    
    @abstractmethod
    def unwrap(self) -> T:
        """
        Extract the success value or raise the error.
        
        Use sparingly - prefer staying in Result context.
        
        Returns:
            The success value
            
        Raises:
            The error if this is a Failure
        """
        ...
    
    @abstractmethod
    def unwrap_error(self) -> E:
        """
        Extract the error value or raise an exception.
        
        Returns:
            The error value
            
        Raises:
            ValueError if this is a Success
        """
        ...


@dataclass(frozen=True)
class Success(Result[T, E]):
    """
    Success variant of Result type.
    
    Contains a value of type T representing successful computation.
    Immutable by design (frozen=True).
    """
    value: T
    
    def is_success(self) -> bool:
        return True
    
    def is_failure(self) -> bool:
        return False
    
    def map(self, fn: Callable[[T], U]) -> Result[U, E]:
        return Success(fn(self.value))
    
    def map_error(self, fn: Callable[[E], F]) -> Result[T, F]:
        # Type coercion needed since we're changing error type
        return Success(self.value)  # type: ignore
    
    def flat_map(self, fn: Callable[[T], Result[U, E]]) -> Result[U, E]:
        return fn(self.value)
    
    def fold(
        self,
        on_success: Callable[[T], U],
        on_failure: Callable[[E], U]
    ) -> U:
        return on_success(self.value)
    
    def get_or_else(self, default: T) -> T:
        return self.value
    
    def get_or_else_lazy(self, fn: Callable[[E], T]) -> T:
        return self.value
    
    def to_optional(self) -> Optional[T]:
        return self.value
    
    def unwrap(self) -> T:
        return self.value
    
    def unwrap_error(self) -> E:
        raise ValueError(f"Called unwrap_error on Success: {self.value}")
    
    def __repr__(self) -> str:
        return f"Success({self.value!r})"


@dataclass(frozen=True)
class Failure(Result[T, E]):
    """
    Failure variant of Result type.
    
    Contains an error of type E representing failed computation.
    Immutable by design (frozen=True).
    """
    error: E
    
    def is_success(self) -> bool:
        return False
    
    def is_failure(self) -> bool:
        return True
    
    def map(self, fn: Callable[[T], U]) -> Result[U, E]:
        return Failure(self.error)
    
    def map_error(self, fn: Callable[[E], F]) -> Result[T, F]:
        return Failure(fn(self.error))
    
    def flat_map(self, fn: Callable[[T], Result[U, E]]) -> Result[U, E]:
        return Failure(self.error)
    
    def fold(
        self,
        on_success: Callable[[T], U],
        on_failure: Callable[[E], U]
    ) -> U:
        return on_failure(self.error)
    
    def get_or_else(self, default: T) -> T:
        return default
    
    def get_or_else_lazy(self, fn: Callable[[E], T]) -> T:
        return fn(self.error)
    
    def to_optional(self) -> Optional[T]:
        return None
    
    def unwrap(self) -> T:
        if isinstance(self.error, Exception):
            raise self.error
        raise ValueError(f"Unwrap called on Failure: {self.error}")
    
    def unwrap_error(self) -> E:
        return self.error
    
    def __repr__(self) -> str:
        return f"Failure({self.error!r})"


# ============================================================================
# Constructor Functions
# ============================================================================

def success(value: T) -> Success[T, Any]:
    """
    Create a Success Result containing the given value.
    
    Args:
        value: The success value to wrap
        
    Returns:
        A Success Result containing the value
    """
    return Success(value)


def failure(error: E) -> Failure[Any, E]:
    """
    Create a Failure Result containing the given error.
    
    Args:
        error: The error to wrap
        
    Returns:
        A Failure Result containing the error
    """
    return Failure(error)


# ============================================================================
# APIError Factory Functions
# ============================================================================

def validation_failure(
    message: str,
    field_name: Optional[str] = None,
    code: ErrorCode = ErrorCode.REQUIRED_FIELD
) -> Failure[Any, APIError]:
    """
    Create a validation error wrapped in a Failure Result.
    
    Args:
        message: The error message
        field_name: Optional field name that failed validation
        code: Error code (defaults to REQUIRED_FIELD)
        
    Returns:
        A Failure Result containing an APIError
    """
    details = [ErrorDetail(
        field=field_name,
        message=message,
        code=code.value
    )] if field_name else [ErrorDetail(message=message)]
    
    return failure(APIError(
        code=code,
        message=message,
        category=ErrorCategory.VALIDATION_ERROR,
        details=details,
    ))


def not_found_failure(
    resource_type: str,
    identifier: str
) -> Failure[Any, APIError]:
    """
    Create a not-found error wrapped in a Failure Result.
    
    Args:
        resource_type: The type of resource not found
        identifier: The identifier used in the search
        
    Returns:
        A Failure Result containing an APIError
    """
    return failure(APIError(
        code=ErrorCode.RESOURCE_NOT_FOUND,
        message=f"{resource_type} with identifier '{identifier}' not found",
        category=ErrorCategory.NOT_FOUND_ERROR,
        details=[ErrorDetail(
            message=f"Resource type: {resource_type}, Identifier: {identifier}"
        )],
    ))


def service_failure(
    message: str,
    original_error: Optional[Exception] = None
) -> Failure[Any, APIError]:
    """
    Create an internal service error wrapped in a Failure Result.
    
    Args:
        message: The error message
        original_error: Optional original exception for debugging
        
    Returns:
        A Failure Result containing an APIError
    """
    details = [ErrorDetail(message=str(original_error))] if original_error else []
    
    return failure(APIError(
        code=ErrorCode.INTERNAL_ERROR,
        message=message,
        category=ErrorCategory.SERVICE_ERROR,
        details=details,
    ))


# ============================================================================
# Standalone Functions (Functional API)
# ============================================================================

def map_result(result: Result[T, E], fn: Callable[[T], U]) -> Result[U, E]:
    """
    Functional version of Result.map.
    
    Transform the value inside a Success Result using the provided function.
    """
    return result.map(fn)


def map_error(result: Result[T, E], fn: Callable[[E], F]) -> Result[T, F]:
    """
    Functional version of Result.map_error.
    
    Transform the error inside a Failure Result using the provided function.
    """
    return result.map_error(fn)


def flat_map(result: Result[T, E], fn: Callable[[T], Result[U, E]]) -> Result[U, E]:
    """
    Functional version of Result.flat_map.
    
    Chain Result-returning operations together.
    """
    return result.flat_map(fn)


def fold(
    result: Result[T, E],
    on_success: Callable[[T], U],
    on_failure: Callable[[E], U]
) -> U:
    """
    Functional version of Result.fold.
    
    Pattern match on the Result and apply the appropriate function.
    """
    return result.fold(on_success, on_failure)


def get_or_else(result: Result[T, E], default: T) -> T:
    """
    Functional version of Result.get_or_else.
    
    Extract the value or return a default.
    """
    return result.get_or_else(default)


# ============================================================================
# Combining Results
# ============================================================================

def sequence(results: List[Result[T, E]]) -> Result[List[T], E]:
    """
    Combine a list of Results into a Result of a list.
    
    If all Results are Success, returns Success with list of values.
    If any Result is Failure, returns the first Failure encountered.
    
    Args:
        results: List of Results to combine
        
    Returns:
        A single Result containing list of values or first error
        
    Example:
        >>> results = [success(1), success(2), success(3)]
        >>> combined = sequence(results)
        >>> print(combined.unwrap())  # [1, 2, 3]
    """
    values: List[T] = []
    for result in results:
        if result.is_failure():
            return result  # type: ignore
        values.append(result.unwrap())
    return success(values)


def traverse(
    items: List[T],
    fn: Callable[[T], Result[U, E]]
) -> Result[List[U], E]:
    """
    Map over a list with a Result-returning function, then sequence.
    
    Short-circuits on first failure for optimal performance.
    
    Args:
        items: List of items to transform
        fn: Function that returns a Result for each item
        
    Returns:
        A Result containing list of transformed values or first error
    """
    values: List[U] = []
    for item in items:
        result = fn(item)
        if result.is_failure():
            return result  # type: ignore  # Short-circuit on first failure
        values.append(result.unwrap())
    return success(values)


def zip_results(
    r1: Result[T, E],
    r2: Result[U, E]
) -> Result[tuple[T, U], E]:
    """
    Combine two Results into a Result of tuple.
    
    Args:
        r1: First Result
        r2: Second Result
        
    Returns:
        Result containing tuple of both values or first error
    """
    if r1.is_failure():
        return r1  # type: ignore
    if r2.is_failure():
        return r2  # type: ignore
    return success((r1.unwrap(), r2.unwrap()))


def zip3_results(
    r1: Result[T, E],
    r2: Result[U, E],
    r3: Result[Any, E]  # Using Any for third type
) -> Result[tuple[T, U, Any], E]:
    """
    Combine three Results into a Result of tuple.
    """
    if r1.is_failure():
        return r1  # type: ignore
    if r2.is_failure():
        return r2  # type: ignore
    if r3.is_failure():
        return r3  # type: ignore
    return success((r1.unwrap(), r2.unwrap(), r3.unwrap()))


# ============================================================================
# Exception Bridge Functions
# ============================================================================

def try_catch(
    fn: Callable[[], T],
    error_mapper: Optional[Callable[[Exception], E]] = None
) -> Result[T, E]:
    """
    Wrap a potentially raising function into a Result-returning function.
    
    Catches exceptions and converts them to Failure.
    
    Args:
        fn: Function that may raise
        error_mapper: Optional function to convert caught exception to E
        
    Returns:
        A Result containing the return value or caught error
        
    Example:
        >>> def risky():
        ...     return int("not a number")
        >>> result = try_catch(risky)
        >>> print(result.is_failure())  # True
    """
    try:
        return success(fn())
    except Exception as e:
        if error_mapper:
            return failure(error_mapper(e))
        # Default error mapping to APIError
        api_error = APIError(
            code=ErrorCode.INTERNAL_ERROR,
            message=str(e),
            category=ErrorCategory.SERVICE_ERROR,
            details=[ErrorDetail(message=str(e))],
        )
        return failure(api_error)  # type: ignore


async def try_catch_async(
    fn: Callable[[], Awaitable[T]],
    error_mapper: Optional[Callable[[Exception], E]] = None
) -> Result[T, E]:
    """
    Wrap an async function that may raise into one returning Result.
    
    Args:
        fn: Async function that may raise
        error_mapper: Optional function to convert caught exception to E
        
    Returns:
        A Result containing the value or caught error
    """
    try:
        value = await fn()
        return success(value)
    except Exception as e:
        if error_mapper:
            return failure(error_mapper(e))
        api_error = APIError(
            code=ErrorCode.INTERNAL_ERROR,
            message=str(e),
            category=ErrorCategory.SERVICE_ERROR,
            details=[ErrorDetail(message=str(e))],
        )
        return failure(api_error)  # type: ignore


# ============================================================================
# Do Notation Helper (Builder Pattern)
# ============================================================================

class ResultDo(Generic[E]):
    """
    Builder class for composing multiple Result operations.
    
    Provides a cleaner syntax for sequential Result operations.
    Uses a dictionary to accumulate bound values.
    
    Example:
        >>> do = ResultDo()
        >>> do.bind('name', validate_name(input_name))
        >>> do.bind('age', validate_age(input_age))
        >>> result = do.result()  # Result containing {'name': ..., 'age': ...}
    """
    
    def __init__(self) -> None:
        self._values: dict[str, Any] = {}
        self._error: Optional[E] = None
    
    def bind(self, key: str, result: Result[Any, E]) -> 'ResultDo[E]':
        """
        Bind a new value to the accumulator.
        
        If any previous bind failed, subsequent binds are ignored.
        
        Args:
            key: The key to bind the value to
            result: The Result to extract value from
            
        Returns:
            self for method chaining
        """
        if self._error is not None:
            return self
        
        if result.is_failure():
            self._error = result.unwrap_error()
            return self
        
        self._values[key] = result.unwrap()
        return self
    
    def result(self) -> Result[dict[str, Any], E]:
        """
        Return the accumulated Result.
        
        Returns:
            Success with accumulated values or Failure with first error
        """
        if self._error is not None:
            return failure(self._error)
        return success(self._values)
    
    def map(self, fn: Callable[[dict[str, Any]], T]) -> Result[T, E]:
        """
        Map over the accumulated values.
        
        Args:
            fn: Function to transform the accumulated dictionary
            
        Returns:
            Result with transformed value or original error
        """
        return self.result().map(fn)


# ============================================================================
# Predicate-based constructors
# ============================================================================

def from_predicate(
    value: T,
    predicate: Callable[[T], bool],
    error: E
) -> Result[T, E]:
    """
    Create a Result based on a predicate.
    
    Args:
        value: The value to test
        predicate: Predicate function
        error: Error to use if predicate returns False
        
    Returns:
        Success(value) if predicate passes, Failure(error) otherwise
    """
    if predicate(value):
        return success(value)
    return failure(error)


def from_optional(
    value: Optional[T],
    error: E
) -> Result[T, E]:
    """
    Create a Result from an Optional value.
    
    Args:
        value: The optional value
        error: Error to use if value is None
        
    Returns:
        Success(value) if not None, Failure(error) otherwise
    """
    if value is not None:
        return success(value)
    return failure(error)


def from_exception(
    fn: Callable[[], T],
    exception_type: type[Exception] = Exception
) -> Result[T, Exception]:
    """
    Convert a potentially raising function to Result, catching specific exception.
    
    Args:
        fn: Function that may raise
        exception_type: Type of exception to catch
        
    Returns:
        Success with value or Failure with caught exception
    """
    try:
        return success(fn())
    except exception_type as e:
        return failure(e)


# ============================================================================
# Module exports
# ============================================================================

__all__ = [
    # Core types
    'Result',
    'Success', 
    'Failure',
    
    # Constructors
    'success',
    'failure',
    
    # APIError factory functions
    'validation_failure',
    'not_found_failure',
    'service_failure',
    
    # Functional API
    'map_result',
    'map_error',
    'flat_map',
    'fold',
    'get_or_else',
    
    # Combining
    'sequence',
    'traverse',
    'zip_results',
    'zip3_results',
    
    # Exception bridge
    'try_catch',
    'try_catch_async',
    
    # Builder
    'ResultDo',
    
    # Predicate constructors
    'from_predicate',
    'from_optional',
    'from_exception',
]

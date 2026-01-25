"""
Retry Logic with Exponential Backoff

Design Pattern: Retry Pattern (Azure Architecture)
- Handles transient failures gracefully
- Exponential backoff prevents thundering herd
- Configurable retry policies

References:
- Microsoft Azure Architecture Patterns
  https://docs.microsoft.com/en-us/azure/architecture/patterns/retry
- AWS Well-Architected Framework - Reliability Pillar
"""

import time
import random
import logging
from typing import Callable, TypeVar, Optional, Tuple, Type
from dataclasses import dataclass
from functools import wraps

logger = logging.getLogger(__name__)

T = TypeVar('T')


@dataclass
class RetryConfig:
    """Configuration for retry behavior."""
    max_retries: int = 3
    base_delay: float = 1.0          # Base delay in seconds
    max_delay: float = 60.0          # Maximum delay in seconds
    exponential_base: float = 2.0    # Exponential multiplier
    jitter: bool = True              # Add random jitter to delay
    jitter_factor: float = 0.25      # Jitter range (±25%)
    retryable_exceptions: Tuple[Type[Exception], ...] = (Exception,)
    non_retryable_exceptions: Tuple[Type[Exception], ...] = ()


class RetryExhaustedError(Exception):
    """Exception raised when all retries are exhausted."""
    def __init__(self, message: str, last_exception: Exception):
        super().__init__(message)
        self.last_exception = last_exception


def calculate_delay(
    attempt: int,
    config: RetryConfig
) -> float:
    """
    Calculate delay for retry attempt using exponential backoff.
    
    Args:
        attempt: Current attempt number (0-based)
        config: Retry configuration
        
    Returns:
        Delay in seconds
    """
    # Exponential backoff: base_delay * (exponential_base ^ attempt)
    delay = config.base_delay * (config.exponential_base ** attempt)
    
    # Cap at maximum delay
    delay = min(delay, config.max_delay)
    
    # Add jitter
    if config.jitter:
        jitter_range = delay * config.jitter_factor
        delay += random.uniform(-jitter_range, jitter_range)
        delay = max(0.1, delay)  # Ensure positive delay
    
    return delay


def should_retry(
    exception: Exception,
    config: RetryConfig
) -> bool:
    """
    Determine if exception should trigger a retry.
    
    Args:
        exception: The exception that occurred
        config: Retry configuration
        
    Returns:
        True if should retry, False otherwise
    """
    # Check non-retryable exceptions first
    if isinstance(exception, config.non_retryable_exceptions):
        return False
    
    # Check retryable exceptions
    return isinstance(exception, config.retryable_exceptions)


def retry(
    config: Optional[RetryConfig] = None,
    max_retries: Optional[int] = None,
    base_delay: Optional[float] = None,
    retryable_exceptions: Optional[Tuple[Type[Exception], ...]] = None
):
    """
    Decorator to add retry logic to a function.
    
    Args:
        config: Full retry configuration
        max_retries: Override max_retries (convenience)
        base_delay: Override base_delay (convenience)
        retryable_exceptions: Override retryable exceptions
        
    Usage:
        @retry()
        def call_api():
            return requests.get("http://api.example.com")
            
        @retry(max_retries=5, retryable_exceptions=(ConnectionError, TimeoutError))
        def call_with_config():
            return requests.get("http://api.example.com")
    """
    def decorator(func: Callable[[], T]) -> Callable[[], T]:
        retry_config = config or RetryConfig()
        
        # Apply overrides
        if max_retries is not None:
            retry_config.max_retries = max_retries
        if base_delay is not None:
            retry_config.base_delay = base_delay
        if retryable_exceptions is not None:
            retry_config.retryable_exceptions = retryable_exceptions
        
        @wraps(func)
        def wrapper(*args, **kwargs):
            return retry_call(
                lambda: func(*args, **kwargs),
                retry_config
            )
        
        return wrapper
    return decorator


def retry_call(
    func: Callable[[], T],
    config: Optional[RetryConfig] = None
) -> T:
    """
    Execute function with retry logic.
    
    Args:
        func: Function to execute
        config: Retry configuration
        
    Returns:
        Result of function
        
    Raises:
        RetryExhaustedError: If all retries are exhausted
    """
    retry_config = config or RetryConfig()
    last_exception: Optional[Exception] = None

    for attempt in range(retry_config.max_retries + 1):
        try:
            return func()
        except Exception as e:
            last_exception = e

            # Check if we should retry
            if not should_retry(e, retry_config):
                logger.warning(
                    f"Non-retryable exception: {type(e).__name__}: {e}"
                )
                raise

            # Check if we have retries left
            if attempt >= retry_config.max_retries:
                logger.error(
                    f"Retry exhausted after {attempt + 1} attempts. "
                    f"Last error: {type(e).__name__}: {e}"
                )
                raise RetryExhaustedError(
                    f"Retries exhausted after {attempt + 1} attempts", e
                ) from e

            # Calculate delay
            delay = calculate_delay(attempt, retry_config)

            logger.warning(
                f"Attempt {attempt + 1} failed: {type(e).__name__}: {e}. "
                f"Retrying in {delay:.2f}s..."
            )

            time.sleep(delay)

    # This should never be reached
    raise RetryExhaustedError(
        "Retries exhausted",
        last_exception or Exception("Unknown error")
    )


# Async version for async functions
async def retry_async(
    func: Callable[[], T],
    config: Optional[RetryConfig] = None
) -> T:
    """
    Execute async function with retry logic.
    
    Args:
        func: Async function to execute
        config: Retry configuration
        
    Returns:
        Result of function
        
    Raises:
        RetryExhaustedError: If all retries are exhausted
    """
    import asyncio

    retry_config = config or RetryConfig()
    last_exception: Optional[Exception] = None

    for attempt in range(retry_config.max_retries + 1):
        try:
            return await func()
        except Exception as e:
            last_exception = e

            if not should_retry(e, retry_config):
                raise

            if attempt >= retry_config.max_retries:
                raise RetryExhaustedError(
                    f"Retries exhausted after {attempt + 1} attempts", e
                ) from e

            delay = calculate_delay(attempt, retry_config)
            logger.warning(
                f"Attempt {attempt + 1} failed: {type(e).__name__}: {e}. "
                f"Retrying in {delay:.2f}s..."
            )

            await asyncio.sleep(delay)

    raise RetryExhaustedError(
        "Retries exhausted",
        last_exception or Exception("Unknown error")
    )


# Combined retry with circuit breaker
def retry_with_circuit_breaker(
    circuit_name: str,
    retry_config: Optional[RetryConfig] = None,
    fallback: Optional[Callable[[], T]] = None
):
    """
    Decorator combining retry and circuit breaker patterns.
    
    Retry is applied first (inner), circuit breaker second (outer).
    This means retries happen within the circuit breaker's monitoring.
    
    Args:
        circuit_name: Name for the circuit breaker
        retry_config: Retry configuration
        fallback: Fallback when circuit is open
        
    Usage:
        @retry_with_circuit_breaker("external_api")
        def call_api():
            return requests.get("http://api.example.com")
    """
    from .circuit_breaker import circuit_breaker
    
    def decorator(func: Callable[[], T]) -> Callable[[], T]:
        # Apply retry decorator first (inner)
        retried = retry(config=retry_config)(func)
        
        # Apply circuit breaker second (outer)
        return circuit_breaker(circuit_name, fallback=fallback)(retried)
    
    return decorator

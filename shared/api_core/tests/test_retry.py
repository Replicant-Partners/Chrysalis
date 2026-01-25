"""
Tests for Retry implementation.
"""

import pytest
import time
from unittest.mock import Mock, patch
from ..retry import (
    RetryConfig,
    RetryExhaustedError,
    retry,
    retry_call,
    calculate_delay,
    should_retry,
)


class TestCalculateDelay:
    """Test delay calculation."""

    def test_exponential_backoff(self):
        """Delay increases exponentially."""
        config = RetryConfig(base_delay=1.0, exponential_base=2.0, jitter=False)
        
        delay0 = calculate_delay(0, config)
        delay1 = calculate_delay(1, config)
        delay2 = calculate_delay(2, config)
        
        assert delay0 == 1.0
        assert delay1 == 2.0
        assert delay2 == 4.0

    def test_max_delay_cap(self):
        """Delay is capped at max_delay."""
        config = RetryConfig(base_delay=1.0, max_delay=5.0, jitter=False)
        
        delay = calculate_delay(10, config)  # Would be 1024 without cap
        
        assert delay == 5.0

    def test_jitter_varies_delay(self):
        """Jitter adds variation to delay."""
        config = RetryConfig(base_delay=1.0, jitter=True, jitter_factor=0.25)
        
        delays = [calculate_delay(0, config) for _ in range(10)]
        
        # With jitter, delays should vary
        assert len(set(delays)) > 1
        # But stay within jitter range
        for d in delays:
            assert 0.75 <= d <= 1.25


class TestShouldRetry:
    """Test retry decision logic."""

    def test_retries_retryable_exceptions(self):
        """Retries exceptions in retryable_exceptions."""
        config = RetryConfig(retryable_exceptions=(ConnectionError, TimeoutError))
        
        assert should_retry(ConnectionError(), config) is True
        assert should_retry(TimeoutError(), config) is True

    def test_does_not_retry_non_retryable(self):
        """Does not retry non-retryable exceptions."""
        config = RetryConfig(
            retryable_exceptions=(ConnectionError,),
            non_retryable_exceptions=(ValueError,)
        )
        
        assert should_retry(ValueError(), config) is False

    def test_non_retryable_takes_precedence(self):
        """Non-retryable takes precedence over retryable."""
        config = RetryConfig(
            retryable_exceptions=(Exception,),
            non_retryable_exceptions=(ValueError,)
        )
        
        assert should_retry(ValueError(), config) is False


class TestRetryCall:
    """Test retry_call function."""

    def test_returns_on_success(self):
        """Returns result on successful call."""
        result = retry_call(lambda: "success")
        
        assert result == "success"

    def test_retries_on_failure(self):
        """Retries on failure and eventually succeeds."""
        call_count = [0]
        
        def sometimes_fails():
            call_count[0] += 1
            if call_count[0] < 3:
                raise ConnectionError("temp failure")
            return "success"
        
        config = RetryConfig(max_retries=3, base_delay=0.01, jitter=False)
        result = retry_call(sometimes_fails, config)
        
        assert result == "success"
        assert call_count[0] == 3

    def test_exhausts_retries(self):
        """Raises RetryExhaustedError when retries exhausted."""
        config = RetryConfig(max_retries=2, base_delay=0.01)

        with pytest.raises(RetryExhaustedError) as exc_info:
            retry_call(lambda: iter(()).throw(Exception("always fails")), config)

        assert "exhausted" in str(exc_info.value).lower()
        assert exc_info.value.last_exception is not None

    def test_does_not_retry_non_retryable(self):
        """Does not retry non-retryable exceptions."""
        call_count = [0]
        
        def fails():
            call_count[0] += 1
            raise ValueError("not retryable")
        
        config = RetryConfig(
            max_retries=3,
            non_retryable_exceptions=(ValueError,)
        )
        
        with pytest.raises(ValueError):
            retry_call(fails, config)
        
        assert call_count[0] == 1  # Only called once


class TestRetryDecorator:
    """Test retry decorator."""

    def test_decorator_wraps_function(self):
        """Decorator wraps function with retry logic."""
        @retry(max_retries=0)  # No retries for simple test
        def my_function():
            return "result"
        
        result = my_function()
        
        assert result == "result"

    def test_decorator_retries(self):
        """Decorator retries failed calls."""
        call_count = [0]
        
        @retry(max_retries=3, base_delay=0.01)
        def sometimes_fails():
            call_count[0] += 1
            if call_count[0] < 2:
                raise ConnectionError("temp")
            return "success"
        
        result = sometimes_fails()
        
        assert result == "success"
        assert call_count[0] == 2

    def test_decorator_with_custom_exceptions(self):
        """Decorator accepts custom retryable exceptions."""
        call_count = [0]
        
        @retry(
            max_retries=3,
            base_delay=0.01,
            retryable_exceptions=(ConnectionError,)
        )
        def fails_with_connection_error():
            call_count[0] += 1
            if call_count[0] < 2:
                raise ConnectionError()
            return "ok"
        
        result = fails_with_connection_error()
        
        assert result == "ok"
        assert call_count[0] == 2

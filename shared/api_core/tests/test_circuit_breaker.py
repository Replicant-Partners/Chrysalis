"""
Tests for Circuit Breaker implementation.
"""

import pytest
import time
from unittest.mock import Mock, patch
from ..circuit_breaker import (
    CircuitBreaker,
    CircuitBreakerConfig,
    CircuitBreakerError,
    CircuitBreakerRegistry,
    CircuitState,
    circuit_breaker,
    call_with_circuit_breaker,
)


class TestCircuitBreaker:
    """Test CircuitBreaker class."""

    def test_initial_state_is_closed(self):
        """Circuit starts in CLOSED state."""
        breaker = CircuitBreaker("test")
        assert breaker.state == CircuitState.CLOSED

    def test_successful_calls_stay_closed(self):
        """Successful calls keep circuit closed."""
        breaker = CircuitBreaker("test")
        
        result = breaker.call(lambda: "success")
        
        assert result == "success"
        assert breaker.state == CircuitState.CLOSED
        assert breaker.stats.successful_calls == 1

    def test_opens_after_threshold_failures(self):
        """Circuit opens after reaching failure threshold."""
        config = CircuitBreakerConfig(failure_threshold=3)
        breaker = CircuitBreaker("test", config)
        
        def failing_func():
            raise Exception("fail")
        
        for _ in range(3):
            with pytest.raises(Exception):
                breaker.call(failing_func)
        
        assert breaker.state == CircuitState.OPEN
        assert breaker.stats.failed_calls == 3

    def test_rejects_calls_when_open(self):
        """Open circuit rejects calls immediately."""
        config = CircuitBreakerConfig(failure_threshold=1)
        breaker = CircuitBreaker("test", config)

        # Trigger open
        with pytest.raises(Exception):
            breaker.call(lambda: iter(()).throw(Exception("fail")))

        # Verify open and rejecting
        with pytest.raises(CircuitBreakerError) as exc_info:
            breaker.call(lambda: "should not run")

        assert "OPEN" in str(exc_info.value)
        assert breaker.stats.rejected_calls == 1

    def test_transitions_to_half_open_after_timeout(self):
        """Circuit transitions to half-open after timeout."""
        config = CircuitBreakerConfig(failure_threshold=1, timeout=0.1)
        breaker = CircuitBreaker("test", config)

        # Trigger open
        with pytest.raises(Exception):
            breaker.call(lambda: iter(()).throw(Exception("fail")))

        assert breaker.state == CircuitState.OPEN

        # Wait for timeout
        time.sleep(0.15)

        assert breaker.state == CircuitState.HALF_OPEN

    def test_closes_after_successful_half_open_calls(self):
        """Circuit closes after successful calls in half-open state."""
        config = CircuitBreakerConfig(
            failure_threshold=1,
            success_threshold=2,
            timeout=0.1
        )
        breaker = CircuitBreaker("test", config)

        # Trigger open
        with pytest.raises(Exception):
            breaker.call(lambda: iter(()).throw(Exception("fail")))

        # Wait for half-open
        time.sleep(0.15)
        assert breaker.state == CircuitState.HALF_OPEN

        # Successful calls should close
        breaker.call(lambda: "ok")
        breaker.call(lambda: "ok")

        assert breaker.state == CircuitState.CLOSED

    def test_reopens_on_failure_in_half_open(self):
        """Circuit reopens on failure in half-open state."""
        config = CircuitBreakerConfig(failure_threshold=1, timeout=0.1)
        breaker = CircuitBreaker("test", config)

        # Trigger open
        with pytest.raises(Exception):
            breaker.call(lambda: iter(()).throw(Exception("fail")))

        # Wait for half-open
        time.sleep(0.15)
        assert breaker.state == CircuitState.HALF_OPEN

        # Failure should reopen
        with pytest.raises(Exception):
            breaker.call(lambda: iter(()).throw(Exception("fail again")))

        assert breaker.state == CircuitState.OPEN

    def test_reset_clears_state(self):
        """Reset returns circuit to closed state."""
        config = CircuitBreakerConfig(failure_threshold=1)
        breaker = CircuitBreaker("test", config)

        # Trigger open
        with pytest.raises(Exception):
            breaker.call(lambda: iter(()).throw(Exception("fail")))

        assert breaker.state == CircuitState.OPEN

        breaker.reset()

        assert breaker.state == CircuitState.CLOSED
        assert breaker.stats.failed_calls == 0


class TestCircuitBreakerRegistry:
    """Test CircuitBreakerRegistry class."""

    def test_get_or_create_creates_new(self):
        """get_or_create creates new breaker if not exists."""
        registry = CircuitBreakerRegistry()
        
        breaker = registry.get_or_create("new_service")
        
        assert breaker is not None
        assert breaker.name == "new_service"

    def test_get_or_create_returns_existing(self):
        """get_or_create returns existing breaker."""
        registry = CircuitBreakerRegistry()
        
        breaker1 = registry.get_or_create("service")
        breaker2 = registry.get_or_create("service")
        
        assert breaker1 is breaker2

    def test_get_all_stats(self):
        """get_all_stats returns stats for all breakers."""
        registry = CircuitBreakerRegistry()
        
        b1 = registry.get_or_create("service1")
        b2 = registry.get_or_create("service2")
        
        b1.call(lambda: "ok")
        
        stats = registry.get_all_stats()
        
        assert "service1" in stats
        assert "service2" in stats
        assert stats["service1"]["successful_calls"] == 1


class TestCircuitBreakerDecorator:
    """Test circuit_breaker decorator."""

    def test_decorator_wraps_function(self):
        """Decorator wraps function with circuit breaker."""
        @circuit_breaker("test_func")
        def my_function():
            return "result"
        
        result = my_function()
        
        assert result == "result"

    def test_decorator_with_fallback(self):
        """Decorator uses fallback when circuit is open."""
        call_count = [0]
        
        @circuit_breaker(
            "failing_func",
            config=CircuitBreakerConfig(failure_threshold=1),
            fallback=lambda: "fallback"
        )
        def failing_function():
            call_count[0] += 1
            raise Exception("fail")
        
        # First call fails and opens circuit
        with pytest.raises(Exception):
            failing_function()
        
        # Second call should use fallback
        result = failing_function()
        
        assert result == "fallback"
        assert call_count[0] == 1  # Original only called once


class TestCallWithCircuitBreaker:
    """Test call_with_circuit_breaker function."""

    def test_executes_function(self):
        """Executes function through circuit breaker."""
        result = call_with_circuit_breaker(
            "test_call",
            lambda: "executed"
        )
        
        assert result == "executed"

    def test_uses_fallback_on_open(self):
        """Uses fallback when circuit is open."""
        registry = CircuitBreakerRegistry.get_instance()
        breaker = registry.get_or_create(
            "test_fallback",
            CircuitBreakerConfig(failure_threshold=1)
        )

        # Trigger open
        with pytest.raises(Exception):
            breaker.call(lambda: iter(()).throw(Exception("fail")))

        result = call_with_circuit_breaker(
            "test_fallback",
            lambda: "should not run",
            fallback=lambda: "fallback used"
        )

        assert result == "fallback used"

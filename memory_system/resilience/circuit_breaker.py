"""
Circuit Breaker Pattern Implementation

Implements the circuit breaker pattern to prevent cascading failures when cloud services are unavailable.
Based on Michael Nygard's "Release It!" pattern.
"""

import asyncio
import logging
from enum import Enum
from datetime import datetime, timedelta
from typing import Callable, Any, Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


class CircuitState(str, Enum):
    """Circuit breaker states"""
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failures detected, fast-fail
    HALF_OPEN = "half_open"  # Testing if service recovered


@dataclass
class CircuitBreakerConfig:
    """Circuit breaker configuration"""
    failure_threshold: int = 5  # Failures before opening
    success_threshold: int = 2  # Successes in half-open to close
    timeout_seconds: float = 60.0  # Time before trying again
    half_open_timeout_seconds: float = 10.0  # Timeout for half-open attempts


@dataclass
class CircuitBreakerMetrics:
    """Circuit breaker metrics"""
    total_calls: int = 0
    successful_calls: int = 0
    failed_calls: int = 0
    open_count: int = 0
    last_failure_time: Optional[datetime] = None
    last_success_time: Optional[datetime] = None


class CircuitBreaker:
    """
    Circuit breaker for fault tolerance
    
    States:
    - CLOSED: Normal operation, failures counted
    - OPEN: Fast-fail, no calls allowed
    - HALF_OPEN: Test if service recovered
    
    Transitions:
    - CLOSED → OPEN: failure_threshold exceeded
    - OPEN → HALF_OPEN: timeout_seconds elapsed
    - HALF_OPEN → CLOSED: success_threshold successes
    - HALF_OPEN → OPEN: any failure
    """
    
    def __init__(
        self,
        name: str,
        config: Optional[CircuitBreakerConfig] = None
    ):
        """
        Initialize circuit breaker
        
        Args:
            name: Circuit breaker name for logging
            config: Configuration (uses defaults if None)
        """
        self.name = name
        self.config = config or CircuitBreakerConfig()
        self.state = CircuitState.CLOSED
        self.metrics = CircuitBreakerMetrics()
        
        self._failure_count = 0
        self._success_count = 0
        self._last_state_change = datetime.now()
        self._lock = asyncio.Lock()
        
        logger.info(f"CircuitBreaker '{name}' initialized in {self.state.value.upper()} state")
    
    async def can_execute(self) -> bool:
        """
        Check if execution is allowed
        
        Returns:
            True if call can proceed, False if circuit is open
        """
        async with self._lock:
            if (
                self.state == CircuitState.CLOSED
                or self.state != CircuitState.OPEN
                and self.state == CircuitState.HALF_OPEN
            ):
                return True

            elif self.state == CircuitState.OPEN:
                # Check if timeout elapsed
                time_since_open = (datetime.now() - self._last_state_change).total_seconds()
                if time_since_open >= self.config.timeout_seconds:
                    logger.info(f"CircuitBreaker '{self.name}': OPEN → HALF_OPEN (timeout elapsed)")
                    self.state = CircuitState.HALF_OPEN
                    self._success_count = 0
                    self._last_state_change = datetime.now()
                    return True
                else:
                    logger.debug(f"CircuitBreaker '{self.name}': OPEN, fast-failing")
                    return False

            return False
    
    async def record_success(self):
        """Record successful call"""
        async with self._lock:
            self.metrics.total_calls += 1
            self.metrics.successful_calls += 1
            self.metrics.last_success_time = datetime.now()
            
            if self.state == CircuitState.CLOSED:
                # Reset failure count on success
                self._failure_count = 0
                logger.debug(f"CircuitBreaker '{self.name}': Success in CLOSED state")
            
            elif self.state == CircuitState.HALF_OPEN:
                self._success_count += 1
                logger.info(f"CircuitBreaker '{self.name}': Success {self._success_count}/{self.config.success_threshold} in HALF_OPEN")
                
                if self._success_count >= self.config.success_threshold:
                    logger.info(f"CircuitBreaker '{self.name}': HALF_OPEN → CLOSED (threshold met)")
                    self.state = CircuitState.CLOSED
                    self._failure_count = 0
                    self._success_count = 0
                    self._last_state_change = datetime.now()
    
    async def record_failure(self):
        """Record failed call"""
        async with self._lock:
            self.metrics.total_calls += 1
            self.metrics.failed_calls += 1
            self.metrics.last_failure_time = datetime.now()
            
            if self.state == CircuitState.CLOSED:
                self._failure_count += 1
                logger.warning(f"CircuitBreaker '{self.name}': Failure {self._failure_count}/{self.config.failure_threshold} in CLOSED")
                
                if self._failure_count >= self.config.failure_threshold:
                    logger.error(f"CircuitBreaker '{self.name}': CLOSED → OPEN (failure threshold exceeded)")
                    self.state = CircuitState.OPEN
                    self.metrics.open_count += 1
                    self._last_state_change = datetime.now()
            
            elif self.state == CircuitState.HALF_OPEN:
                logger.error(f"CircuitBreaker '{self.name}': HALF_OPEN → OPEN (failure detected)")
                self.state = CircuitState.OPEN
                self.metrics.open_count += 1
                self._failure_count = 0
                self._success_count = 0
                self._last_state_change = datetime.now()
    
    async def call(
        self,
        func: Callable,
        *args: Any,
        **kwargs: Any
    ) -> Any:
        """
        Execute function with circuit breaker protection
        
        Args:
            func: Function to execute
            *args: Positional arguments
            **kwargs: Keyword arguments
            
        Returns:
            Function result
            
        Raises:
            CircuitBreakerOpenError: If circuit is open
            Exception: Any exception from func
        """
        if not await self.can_execute():
            raise CircuitBreakerOpenError(f"Circuit breaker '{self.name}' is OPEN")
        
        try:
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)
            
            await self.record_success()
            return result
        
        except Exception as e:
            await self.record_failure()
            raise
    
    def get_state(self) -> CircuitState:
        """Get current circuit state"""
        return self.state
    
    def get_metrics(self) -> CircuitBreakerMetrics:
        """Get circuit breaker metrics"""
        return self.metrics
    
    async def reset(self):
        """Reset circuit breaker to CLOSED state"""
        async with self._lock:
            logger.info(f"CircuitBreaker '{self.name}': Manual reset to CLOSED")
            self.state = CircuitState.CLOSED
            self._failure_count = 0
            self._success_count = 0
            self._last_state_change = datetime.now()
    
    def __repr__(self) -> str:
        return (
            f"CircuitBreaker(name='{self.name}', state={self.state.value}, "
            f"failures={self._failure_count}/{self.config.failure_threshold})"
        )


class CircuitBreakerOpenError(Exception):
    """Raised when circuit breaker is open"""
    pass


# Example usage
async def example_usage():
    """Example circuit breaker usage"""
    
    # Create circuit breaker
    breaker = CircuitBreaker(
        name="zep-api",
        config=CircuitBreakerConfig(
            failure_threshold=3,
            success_threshold=2,
            timeout_seconds=30.0
        )
    )
    
    # Function that might fail
    async def unstable_api_call():
        import random
        if random.random() < 0.5:  # 50% failure rate
            raise Exception("API error")
        return "Success"
    
    # Use circuit breaker
    for i in range(10):
        if await breaker.can_execute():
            try:
                result = await unstable_api_call()
                await breaker.record_success()
                print(f"Call {i}: {result}")
            except Exception as e:
                await breaker.record_failure()
                print(f"Call {i}: Failed - {e}")
        else:
            print(f"Call {i}: Circuit OPEN, fast-failing")
        
        await asyncio.sleep(1)
    
    # Print metrics
    print(f"\nCircuit Breaker Metrics:")
    print(f"State: {breaker.get_state().value}")
    metrics = breaker.get_metrics()
    print(f"Total calls: {metrics.total_calls}")
    print(f"Successful: {metrics.successful_calls}")
    print(f"Failed: {metrics.failed_calls}")
    print(f"Times opened: {metrics.open_count}")


if __name__ == "__main__":
    asyncio.run(example_usage())

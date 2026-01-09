#!/usr/bin/env python3
"""
Rate Limiter for API Calls

Implements token bucket algorithm to prevent hitting API rate limits.
Addresses Issue #3 from code review.
"""

import time
from datetime import datetime
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    Token bucket rate limiter.
    
    Allows burst traffic up to bucket size, then enforces steady rate.
    Thread-safe for single-process use.
    """
    
    def __init__(
        self,
        calls_per_minute: int = 60,
        burst_size: Optional[int] = None
    ):
        """
        Initialize rate limiter.
        
        Args:
            calls_per_minute: Maximum sustained rate
            burst_size: Maximum burst (default: 2x sustained rate)
        """
        self.calls_per_minute = calls_per_minute
        self.burst_size = burst_size or (calls_per_minute * 2)
        self.tokens = float(self.burst_size)
        self.last_update = datetime.now()
        self.total_calls = 0
        self.total_waits = 0
        self.total_wait_time = 0.0
    
    def acquire(self, tokens: int = 1) -> float:
        """
        Acquire tokens, waiting if necessary.
        
        Args:
            tokens: Number of tokens to acquire
        
        Returns:
            Time waited in seconds
        """
        self._refill_tokens()
        
        if self.tokens >= tokens:
            self.tokens -= tokens
            self.total_calls += 1
            return 0.0
        
        # Need to wait
        tokens_needed = tokens - self.tokens
        wait_time = (tokens_needed / self.calls_per_minute) * 60.0
        
        logger.info(
            f"Rate limit: waiting {wait_time:.2f}s "
            f"(tokens needed: {tokens_needed:.1f}, available: {self.tokens:.1f})"
        )
        
        time.sleep(wait_time)
        self._refill_tokens()
        self.tokens -= tokens
        
        self.total_calls += 1
        self.total_waits += 1
        self.total_wait_time += wait_time
        
        return wait_time
    
    def _refill_tokens(self):
        """Refill tokens based on elapsed time."""
        now = datetime.now()
        elapsed = (now - self.last_update).total_seconds()
        
        # Add tokens based on elapsed time
        new_tokens = (elapsed / 60.0) * self.calls_per_minute
        self.tokens = min(self.burst_size, self.tokens + new_tokens)
        self.last_update = now
    
    def get_stats(self) -> dict:
        """Get rate limiter statistics."""
        return {
            "total_calls": self.total_calls,
            "total_waits": self.total_waits,
            "total_wait_time": self.total_wait_time,
            "average_wait": (
                self.total_wait_time / self.total_waits
                if self.total_waits > 0
                else 0.0
            ),
            "current_tokens": self.tokens,
            "calls_per_minute": self.calls_per_minute,
            "burst_size": self.burst_size,
        }
    
    def reset_stats(self):
        """Reset statistics counters."""
        self.total_calls = 0
        self.total_waits = 0
        self.total_wait_time = 0.0


# Global rate limiters for different API providers
# These can be imported and used throughout the codebase
VOYAGE_RATE_LIMITER = RateLimiter(calls_per_minute=60, burst_size=120)
OPENAI_RATE_LIMITER = RateLimiter(calls_per_minute=60, burst_size=120)
TAVILY_RATE_LIMITER = RateLimiter(calls_per_minute=60, burst_size=120)


def get_rate_limiter(provider: str) -> RateLimiter:
    """
    Get rate limiter for a specific provider.
    
    Args:
        provider: Provider name ('voyage', 'openai', 'tavily')
    
    Returns:
        RateLimiter instance for the provider
    
    Raises:
        ValueError: If provider is unknown
    """
    limiters = {
        'voyage': VOYAGE_RATE_LIMITER,
        'openai': OPENAI_RATE_LIMITER,
        'tavily': TAVILY_RATE_LIMITER,
    }
    
    provider_lower = provider.lower()
    if provider_lower not in limiters:
        raise ValueError(
            f"Unknown provider: {provider}. "
            f"Valid providers: {', '.join(limiters.keys())}"
        )
    
    return limiters[provider_lower]


if __name__ == "__main__":
    # Self-test
    print("Testing RateLimiter...")
    
    limiter = RateLimiter(calls_per_minute=120, burst_size=10)
    
    # Test burst
    print("\nTesting burst (should be fast):")
    start = time.time()
    for i in range(10):
        wait = limiter.acquire()
        print(f"  Call {i+1}: waited {wait:.3f}s")
    burst_time = time.time() - start
    print(f"Burst completed in {burst_time:.3f}s")
    
    # Test rate limiting
    print("\nTesting rate limit (should wait):")
    start = time.time()
    for i in range(5):
        wait = limiter.acquire()
        print(f"  Call {i+11}: waited {wait:.3f}s")
    limited_time = time.time() - start
    print(f"Rate-limited calls completed in {limited_time:.3f}s")
    
    # Print stats
    print("\nStatistics:")
    stats = limiter.get_stats()
    for key, value in stats.items():
        print(f"  {key}: {value}")
    
    print("\n✅ RateLimiter self-test passed!")

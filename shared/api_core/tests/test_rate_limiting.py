"""
Tests for rate limiting middleware.
"""

import sys
from pathlib import Path
import pytest
import time

# Add shared directory to path
PROJECT_ROOT = Path(__file__).resolve().parents[3]
SHARED_PATH = PROJECT_ROOT / "shared"
if str(SHARED_PATH) not in sys.path:
    sys.path.insert(0, str(SHARED_PATH))

from api_core.rate_limiting import RateLimitConfig, RateLimiter


class MockRequest:
    """Mock request object for testing."""
    def __init__(self, remote_addr="127.0.0.1", path="/test", headers=None):
        self.remote_addr = remote_addr
        self.path = path
        self.headers = headers or {}
        self.endpoint = None


class TestRateLimitConfig:
    """Tests for RateLimitConfig."""

    def test_default_config(self):
        """Test default configuration."""
        config = RateLimitConfig()
        assert config.limit == 1000
        assert config.window == 3600
        assert config.per_ip is True
        assert config.per_endpoint is False
        assert config.identifier_func is None

    def test_custom_config(self):
        """Test custom configuration."""
        config = RateLimitConfig(
            limit=100,
            window=60,
            per_ip=False,
            per_endpoint=True
        )
        assert config.limit == 100
        assert config.window == 60
        assert config.per_ip is False
        assert config.per_endpoint is True


class TestRateLimiter:
    """Tests for RateLimiter class."""

    def test_identifier_per_ip(self):
        """Test identifier generation for per-IP limiting."""
        config = RateLimitConfig(per_ip=True, per_endpoint=False)
        limiter = RateLimiter(config)

        req1 = MockRequest(remote_addr="127.0.0.1")
        req2 = MockRequest(remote_addr="192.168.1.1")

        id1 = limiter._get_identifier(req1)
        id2 = limiter._get_identifier(req2)

        assert id1 != id2
        assert "127.0.0.1" in id1
        assert "192.168.1.1" in id2

    def test_identifier_per_endpoint(self):
        """Test identifier generation for per-endpoint limiting."""
        config = RateLimitConfig(per_ip=False, per_endpoint=True)
        limiter = RateLimiter(config)

        req1 = MockRequest(path="/api/v1/agents")
        req2 = MockRequest(path="/api/v1/knowledge")

        id1 = limiter._get_identifier(req1)
        id2 = limiter._get_identifier(req2)

        assert id1 != id2
        assert "/api/v1/agents" in id1
        assert "/api/v1/knowledge" in id2

    def test_identifier_combined(self):
        """Test identifier generation with both IP and endpoint."""
        config = RateLimitConfig(per_ip=True, per_endpoint=True)
        limiter = RateLimiter(config)

        req = MockRequest(remote_addr="127.0.0.1", path="/api/v1/agents")
        identifier = limiter._get_identifier(req)

        assert "127.0.0.1" in identifier
        assert "/api/v1/agents" in identifier

    def test_check_rate_limit_allowed(self):
        """Test rate limit check when request is allowed."""
        config = RateLimitConfig(limit=10, window=60)
        limiter = RateLimiter(config)

        req = MockRequest()
        allowed, headers = limiter.check_rate_limit(req)

        assert allowed is True
        assert headers['X-RateLimit-Limit'] == '10'
        assert int(headers['X-RateLimit-Remaining']) < 10
        assert 'X-RateLimit-Reset' in headers

    def test_check_rate_limit_exceeded(self):
        """Test rate limit check when limit is exceeded."""
        config = RateLimitConfig(limit=2, window=60)
        limiter = RateLimiter(config)

        req = MockRequest()

        # First request - should be allowed
        allowed1, headers1 = limiter.check_rate_limit(req)
        assert allowed1 is True

        # Second request - should be allowed
        allowed2, headers2 = limiter.check_rate_limit(req)
        assert allowed2 is True

        # Third request - should be blocked
        allowed3, headers3 = limiter.check_rate_limit(req)
        assert allowed3 is False
        assert 'Retry-After' in headers3
        assert int(headers3['X-RateLimit-Remaining']) == 0

    def test_token_refill(self):
        """Test that tokens refill over time."""
        config = RateLimitConfig(limit=2, window=1)  # 1 second window
        limiter = RateLimiter(config)

        req = MockRequest()

        # Exhaust limit
        limiter.check_rate_limit(req)
        limiter.check_rate_limit(req)
        allowed, _ = limiter.check_rate_limit(req)
        assert allowed is False

        # Wait for refill (1 second window)
        time.sleep(1.1)

        # Should be allowed again
        allowed, headers = limiter.check_rate_limit(req)
        assert allowed is True
        assert int(headers['X-RateLimit-Remaining']) > 0

    def test_get_limit_info(self):
        """Test getting limit info without consuming token."""
        config = RateLimitConfig(limit=10, window=60)
        limiter = RateLimiter(config)

        req = MockRequest()

        # Get info without consuming
        info1 = limiter.get_limit_info(req)
        assert int(info1['X-RateLimit-Remaining']) == 10

        # Consume a token
        limiter.check_rate_limit(req)

        # Get info again - should show updated remaining
        info2 = limiter.get_limit_info(req)
        assert int(info2['X-RateLimit-Remaining']) == 9

    def test_separate_buckets_per_identifier(self):
        """Test that different identifiers have separate buckets."""
        config = RateLimitConfig(limit=2, window=60, per_ip=True)
        limiter = RateLimiter(config)

        req1 = MockRequest(remote_addr="127.0.0.1")
        req2 = MockRequest(remote_addr="192.168.1.1")

        # Exhaust limit for IP 1
        limiter.check_rate_limit(req1)
        limiter.check_rate_limit(req1)
        allowed1, _ = limiter.check_rate_limit(req1)
        assert allowed1 is False

        # IP 2 should still be allowed
        allowed2, _ = limiter.check_rate_limit(req2)
        assert allowed2 is True

    def test_bucket_cleanup(self):
        """Test that expired buckets are cleaned up."""
        config = RateLimitConfig(limit=10, window=1)  # 1 second window
        limiter = RateLimiter(config)
        limiter.cleanup_interval = 0.1  # Cleanup more frequently for test

        req = MockRequest()

        # Create a bucket
        limiter.check_rate_limit(req)
        assert len(limiter.buckets) == 1

        # Wait for expiration (reset_time + window)
        time.sleep(2.1)  # Wait past reset_time + window

        # Trigger cleanup manually
        limiter._cleanup_old_buckets()

        # Bucket should be removed after expiration
        # Note: cleanup might not happen immediately due to cleanup_interval check
        # So we verify it gets cleaned up eventually
        for _ in range(10):  # Try multiple times
            limiter._cleanup_old_buckets()
            if len(limiter.buckets) == 0:
                break
            time.sleep(0.1)

        # After waiting, bucket should be removed
        assert len(limiter.buckets) == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

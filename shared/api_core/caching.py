"""
Response Caching

Design Pattern: Cache-Aside Pattern
- Provides caching for API responses
- Configurable TTL and cache backends
- Automatic cache key generation

References:
- Microsoft Azure Architecture Patterns
  https://docs.microsoft.com/en-us/azure/architecture/patterns/cache-aside
"""

import hashlib
import json
import time
import logging
import threading
from typing import Dict, Any, Optional, Callable, TypeVar
from functools import wraps
from dataclasses import dataclass

logger = logging.getLogger(__name__)

T = TypeVar('T')


@dataclass
class CacheConfig:
    """Configuration for caching."""
    default_ttl: int = 300           # Default TTL in seconds (5 minutes)
    max_entries: int = 1000          # Maximum cache entries
    enabled: bool = True             # Enable/disable caching
    include_query_params: bool = True # Include query params in cache key
    include_headers: Optional[list] = None  # Headers to include in cache key


@dataclass
class CacheEntry:
    """A cache entry with metadata."""
    value: Any
    expires_at: float
    created_at: float
    hits: int = 0


class InMemoryCache:
    """
    Simple in-memory cache implementation.
    
    For production, consider using Redis or Memcached.
    """
    
    def __init__(self, config: Optional[CacheConfig] = None):
        self.config = config or CacheConfig()
        self._cache: Dict[str, CacheEntry] = {}
        self._lock = threading.RLock()
        self._stats = {
            'hits': 0,
            'misses': 0,
            'evictions': 0,
        }
    
    def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache.
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None if not found/expired
        """
        with self._lock:
            entry = self._cache.get(key)
            
            if entry is None:
                self._stats['misses'] += 1
                return None
            
            # Check expiration
            if time.time() > entry.expires_at:
                del self._cache[key]
                self._stats['misses'] += 1
                return None
            
            entry.hits += 1
            self._stats['hits'] += 1
            return entry.value
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """
        Set value in cache.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds (optional)
        """
        if not self.config.enabled:
            return
        
        with self._lock:
            # Evict if at capacity
            if len(self._cache) >= self.config.max_entries:
                self._evict_lru()
            
            now = time.time()
            self._cache[key] = CacheEntry(
                value=value,
                expires_at=now + (ttl or self.config.default_ttl),
                created_at=now,
            )
    
    def delete(self, key: str) -> bool:
        """
        Delete value from cache.
        
        Args:
            key: Cache key
            
        Returns:
            True if deleted, False if not found
        """
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False
    
    def clear(self) -> None:
        """Clear all cache entries."""
        with self._lock:
            self._cache.clear()
    
    def _evict_lru(self) -> None:
        """Evict least recently used entry."""
        if not self._cache:
            return
        
        # Find entry with oldest access (lowest hits / age ratio)
        oldest_key = min(
            self._cache.keys(),
            key=lambda k: self._cache[k].hits / max(1, time.time() - self._cache[k].created_at)
        )
        del self._cache[oldest_key]
        self._stats['evictions'] += 1
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        with self._lock:
            total = self._stats['hits'] + self._stats['misses']
            hit_rate = self._stats['hits'] / total if total > 0 else 0
            
            return {
                'entries': len(self._cache),
                'hits': self._stats['hits'],
                'misses': self._stats['misses'],
                'evictions': self._stats['evictions'],
                'hit_rate': hit_rate,
            }


# Global cache instance
_default_cache: Optional[InMemoryCache] = None


def get_cache(config: Optional[CacheConfig] = None) -> InMemoryCache:
    """Get or create the default cache instance."""
    global _default_cache
    if _default_cache is None:
        _default_cache = InMemoryCache(config)
    return _default_cache


def generate_cache_key(
    endpoint: str,
    query_params: Optional[Dict[str, Any]] = None,
    headers: Optional[Dict[str, str]] = None,
    config: Optional[CacheConfig] = None
) -> str:
    """
    Generate cache key from request parameters.
    
    Args:
        endpoint: API endpoint path
        query_params: Query parameters
        headers: Request headers
        config: Cache configuration
        
    Returns:
        Cache key string
    """
    cfg = config or CacheConfig()

    key_parts = [endpoint]

    if cfg.include_query_params and query_params:
        sorted_params = sorted(query_params.items())
        key_parts.append(json.dumps(sorted_params))

    if cfg.include_headers and headers:
        if selected_headers := {
            k: v for k, v in headers.items() if k in cfg.include_headers
        }:
            key_parts.append(json.dumps(sorted(selected_headers.items())))

    key_string = "|".join(key_parts)
    return hashlib.sha256(key_string.encode()).hexdigest()[:32]


def cached(
    ttl: Optional[int] = None,
    key_func: Optional[Callable[..., str]] = None,
    cache: Optional[InMemoryCache] = None
):
    """
    Decorator to cache function results.
    
    Args:
        ttl: Time to live in seconds
        key_func: Optional custom key generation function
        cache: Optional cache instance
        
    Usage:
        @cached(ttl=300)
        def get_data(id):
            return expensive_operation(id)
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args, **kwargs):
            cache_instance = cache or get_cache()
            
            # Generate cache key
            if key_func:
                key = key_func(*args, **kwargs)
            else:
                key = hashlib.sha256(
                    f"{func.__name__}:{args}:{kwargs}".encode()
                ).hexdigest()[:32]
            
            # Try to get from cache
            cached_value = cache_instance.get(key)
            if cached_value is not None:
                logger.debug(f"Cache hit for {func.__name__}")
                return cached_value
            
            # Execute function
            result = func(*args, **kwargs)
            
            # Store in cache
            cache_instance.set(key, result, ttl)
            logger.debug(f"Cache miss for {func.__name__}, stored result")
            
            return result
        
        return wrapper
    return decorator


def cache_response(
    ttl: Optional[int] = None,
    vary_on: Optional[list] = None,
    cache: Optional[InMemoryCache] = None
):
    """
    Decorator to cache Flask response.
    
    Args:
        ttl: Time to live in seconds
        vary_on: Query parameters to include in cache key
        cache: Optional cache instance
        
    Usage:
        @app.route('/api/data')
        @cache_response(ttl=300)
        def get_data():
            return jsonify({"data": expensive_query()})
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                from flask import request, Response
            except ImportError:
                return func(*args, **kwargs)
            
            # Only cache GET requests
            if request.method != 'GET':
                return func(*args, **kwargs)
            
            cache_instance = cache or get_cache()
            
            # Generate cache key
            query_params = dict(request.args) if vary_on is None else {
                k: v for k, v in request.args.items() if k in vary_on
            }
            key = generate_cache_key(
                request.path,
                query_params
            )
            
            # Try to get from cache
            cached_response = cache_instance.get(key)
            if cached_response is not None:
                logger.debug(f"Cache hit for {request.path}")
                # Add cache header
                response = Response(
                    cached_response['body'],
                    status=cached_response['status'],
                    headers=cached_response['headers']
                )
                response.headers['X-Cache'] = 'HIT'
                return response
            
            # Execute function
            response = func(*args, **kwargs)
            
            # Handle tuple responses
            if isinstance(response, tuple):
                body, status = response[:2]
                headers = response[2] if len(response) > 2 else {}
            else:
                body = response
                status = 200
                headers = {}
            
            # Get response body
            if hasattr(body, 'get_data'):
                response_body = body.get_data(as_text=True)
            else:
                response_body = str(body)
            
            # Cache successful responses only
            if 200 <= status < 300:
                cache_instance.set(key, {
                    'body': response_body,
                    'status': status,
                    'headers': dict(headers),
                }, ttl)
            
            # Add cache header to response
            if hasattr(body, 'headers'):
                body.headers['X-Cache'] = 'MISS'
            
            return response
        
        return wrapper
    return decorator


def invalidate_cache_pattern(pattern: str, cache: Optional[InMemoryCache] = None) -> int:
    """
    Invalidate cache entries matching a pattern.
    
    Args:
        pattern: Pattern to match (substring match)
        cache: Optional cache instance
        
    Returns:
        Number of entries invalidated
    """
    cache_instance = cache or get_cache()
    
    with cache_instance._lock:
        keys_to_delete = [
            key for key in cache_instance._cache.keys()
            if pattern in key
        ]
        
        for key in keys_to_delete:
            del cache_instance._cache[key]
        
        return len(keys_to_delete)

"""
Configuration for Fireproof integration.

Provides configuration dataclass with environment variable
support and feature flags for gradual rollout.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Optional


def _env_bool(key: str, default: bool = False) -> bool:
    """Get boolean from environment variable."""
    value = os.environ.get(key, str(default)).lower()
    return value in ("true", "1", "yes", "on")


def _env_int(key: str, default: int) -> int:
    """Get integer from environment variable."""
    try:
        return int(os.environ.get(key, default))
    except (ValueError, TypeError):
        return default


def _env_float(key: str, default: float) -> float:
    """Get float from environment variable."""
    try:
        return float(os.environ.get(key, default))
    except (ValueError, TypeError):
        return default


@dataclass
class FireproofConfig:
    """
    Configuration for FireproofService.
    
    Feature flags control gradual rollout of functionality:
    - enabled: Master switch for Fireproof integration
    - sync_enabled: Enable background sync to Zep
    - promotion_enabled: Enable bead promotion from BeadsService
    - metadata_capture: Enable LLM prompt metadata capture
    - local_vector_cache: Enable local caching of small vectors
    """
    
    # Database configuration
    db_name: str = "chrysalis-memory"
    db_path: Optional[str] = None  # Path for SQLite backend, None for in-memory
    
    # Sync configuration
    sync_gateway: Optional[str] = None  # URL for remote sync gateway
    sync_interval_s: int = 60  # Seconds between sync attempts
    sync_batch_size: int = 100  # Documents per sync batch
    
    # Bead promotion configuration
    promotion_threshold: float = 0.7  # Minimum importance for promotion
    promotion_async: bool = True  # Promote beads asynchronously
    
    # Vector caching
    vector_cache_threshold_bytes: int = 10240  # Max vector size to cache (10KB)
    
    # Retention
    ttl_seconds: Optional[int] = None  # TTL for local documents, None for permanent
    max_documents: Optional[int] = None  # Max documents to retain
    
    # Feature flags (environment variable overrides)
    enabled: bool = field(default_factory=lambda: _env_bool("FIREPROOF_ENABLED", False))
    sync_enabled: bool = field(default_factory=lambda: _env_bool("FIREPROOF_SYNC_ENABLED", False))
    promotion_enabled: bool = field(default_factory=lambda: _env_bool("FIREPROOF_PROMOTION_ENABLED", False))
    metadata_capture: bool = field(default_factory=lambda: _env_bool("FIREPROOF_METADATA_CAPTURE", False))
    local_vector_cache: bool = field(default_factory=lambda: _env_bool("FIREPROOF_LOCAL_VECTORS", False))
    
    # CRDT configuration
    crdt_merge_enabled: bool = True
    
    # Encryption (placeholder for Fireproof native encryption)
    encryption_enabled: bool = field(default_factory=lambda: _env_bool("FIREPROOF_ENCRYPTION", False))
    encryption_key: Optional[str] = field(
        default_factory=lambda: os.environ.get("FIREPROOF_ENCRYPTION_KEY")
    )
    
    @classmethod
    def from_env(cls) -> FireproofConfig:
        """
        Create configuration from environment variables.
        
        Environment variables:
            FIREPROOF_ENABLED: Master enable switch
            FIREPROOF_DB_NAME: Database name
            FIREPROOF_DB_PATH: SQLite path (optional)
            FIREPROOF_SYNC_GATEWAY: Sync gateway URL
            FIREPROOF_SYNC_INTERVAL: Sync interval in seconds
            FIREPROOF_SYNC_BATCH_SIZE: Documents per sync batch
            FIREPROOF_SYNC_ENABLED: Enable background sync
            FIREPROOF_PROMOTION_ENABLED: Enable bead promotion
            FIREPROOF_PROMOTION_THRESHOLD: Min importance for promotion
            FIREPROOF_METADATA_CAPTURE: Enable metadata capture
            FIREPROOF_LOCAL_VECTORS: Enable local vector cache
            FIREPROOF_TTL_SECONDS: Document TTL
            FIREPROOF_MAX_DOCUMENTS: Max retained documents
            FIREPROOF_ENCRYPTION: Enable encryption
            FIREPROOF_ENCRYPTION_KEY: Encryption key
        """
        return cls(
            db_name=os.environ.get("FIREPROOF_DB_NAME", "chrysalis-memory"),
            db_path=os.environ.get("FIREPROOF_DB_PATH"),
            sync_gateway=os.environ.get("FIREPROOF_SYNC_GATEWAY"),
            sync_interval_s=_env_int("FIREPROOF_SYNC_INTERVAL", 60),
            sync_batch_size=_env_int("FIREPROOF_SYNC_BATCH_SIZE", 100),
            promotion_threshold=_env_float("FIREPROOF_PROMOTION_THRESHOLD", 0.7),
            ttl_seconds=_env_int("FIREPROOF_TTL_SECONDS", 0) or None,
            max_documents=_env_int("FIREPROOF_MAX_DOCUMENTS", 0) or None,
        )
    
    @classmethod
    def for_testing(cls) -> FireproofConfig:
        """
        Create configuration for testing.
        
        Uses in-memory storage with all features enabled.
        """
        return cls(
            db_name="test-memory",
            db_path=":memory:",
            enabled=True,
            sync_enabled=False,  # Disable network sync in tests
            promotion_enabled=True,
            metadata_capture=True,
            local_vector_cache=True,
            ttl_seconds=None,
            max_documents=1000,
        )
    
    @classmethod
    def minimal(cls) -> FireproofConfig:
        """
        Create minimal configuration with only core features.
        
        Useful for gradual rollout or resource-constrained environments.
        """
        return cls(
            db_name="chrysalis-memory",
            db_path=":memory:",
            enabled=True,
            sync_enabled=False,
            promotion_enabled=False,
            metadata_capture=False,
            local_vector_cache=False,
        )
    
    def validate(self) -> bool:
        """
        Validate configuration settings.
        
        Raises ValueError if configuration is invalid.
        """
        if self.promotion_threshold < 0 or self.promotion_threshold > 1:
            raise ValueError("promotion_threshold must be between 0 and 1")
        
        if self.sync_interval_s < 1:
            raise ValueError("sync_interval_s must be at least 1")
        
        if self.sync_batch_size < 1:
            raise ValueError("sync_batch_size must be at least 1")
        
        if self.sync_enabled and not self.sync_gateway:
            raise ValueError("sync_gateway required when sync_enabled is True")
        
        if self.encryption_enabled and not self.encryption_key:
            raise ValueError("encryption_key required when encryption_enabled is True")
        
        return True

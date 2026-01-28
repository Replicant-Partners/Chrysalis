"""
Unified Exception Hierarchy for Memory System.

Provides structured error handling with error codes for
debugging and observability across all memory system components.

Pattern: Exception hierarchy with error codes and serialization support.
See: docs/DESIGN_PATTERNS.md

Usage:
    from memory_system.exceptions import MemoryError, StorageError
    
    try:
        await store.put(doc)
    except StorageError as e:
        logger.error(f"Storage failed: {e.error_code}", extra=e.details)
"""

from typing import Optional, Dict, Any


class MemoryError(Exception):
    """
    Base exception for all memory system errors.
    
    All memory system exceptions inherit from this class,
    enabling catch-all handling when needed.
    """
    
    def __init__(
        self, 
        message: str, 
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        cause: Optional[Exception] = None,
    ):
        """
        Initialize memory error.
        
        Args:
            message: Human-readable error message
            error_code: Machine-readable error code (e.g., "CONN_FAILED")
            details: Additional context for debugging
            cause: Original exception that caused this error
        """
        super().__init__(message)
        self.message = message
        self.error_code = error_code or self._default_error_code()
        self.details = details or {}
        self.cause = cause
    
    def _default_error_code(self) -> str:
        """Generate default error code from class name."""
        name = self.__class__.__name__
        # Convert CamelCase to UPPER_SNAKE
        import re
        return re.sub(r'(?<!^)(?=[A-Z])', '_', name).upper().replace('_ERROR', '')
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization/logging."""
        result = {
            "error_type": self.__class__.__name__,
            "message": self.message,
            "error_code": self.error_code,
            "details": self.details,
        }
        if self.cause:
            result["cause"] = str(self.cause)
        return result
    
    def __repr__(self) -> str:
        return f"{self.__class__.__name__}({self.error_code}: {self.message})"


# =============================================================================
# Storage Layer Errors
# =============================================================================

class StorageError(MemoryError):
    """
    Raised when storage operations fail.
    
    Error codes:
    - STORAGE_CONN_FAILED: Database connection failed
    - STORAGE_WRITE_FAILED: Write operation failed
    - STORAGE_READ_FAILED: Read operation failed
    - STORAGE_DELETE_FAILED: Delete operation failed
    - STORAGE_SCHEMA_MISMATCH: Schema doesn't match expected
    """
    pass


class ConnectionError(StorageError):
    """Raised when connection to storage backend fails."""
    pass


class ValidationError(MemoryError):
    """
    Raised when data validation fails.
    
    Error codes:
    - VALIDATION_EMPTY_INPUT: Input is empty or whitespace-only
    - VALIDATION_INVALID_FORMAT: Input doesn't match expected format
    - VALIDATION_MISSING_FIELD: Required field is missing
    - VALIDATION_INVALID_VALUE: Field has invalid value
    - VALIDATION_TYPE_MISMATCH: Value type doesn't match schema
    """
    pass


# =============================================================================
# Retrieval Layer Errors
# =============================================================================

class RetrievalError(MemoryError):
    """
    Raised when memory retrieval fails.
    
    Error codes:
    - RETRIEVAL_NOT_FOUND: Requested memory not found
    - RETRIEVAL_QUERY_FAILED: Query execution failed
    - RETRIEVAL_TIMEOUT: Query timed out
    """
    pass


class EmbeddingError(MemoryError):
    """
    Raised when embedding operations fail.
    
    Error codes:
    - EMBEDDING_MODEL_NOT_FOUND: Embedding model not available
    - EMBEDDING_DIMENSION_MISMATCH: Vector dimensions don't match
    - EMBEDDING_SERVICE_UNAVAILABLE: Embedding service unavailable
    - EMBEDDING_BATCH_TOO_LARGE: Batch size exceeds limit
    - EMBEDDING_RATE_LIMITED: Rate limit exceeded
    """
    pass


# =============================================================================
# Sync Layer Errors
# =============================================================================

class SyncError(MemoryError):
    """
    Raised when synchronization fails.
    
    Error codes:
    - SYNC_CONFLICT: Merge conflict detected
    - SYNC_REMOTE_UNAVAILABLE: Remote service unavailable
    - SYNC_VERSION_MISMATCH: Version mismatch detected
    - SYNC_TIMEOUT: Sync operation timed out
    """
    pass


class GossipError(SyncError):
    """
    Raised when gossip protocol operations fail.
    
    Error codes:
    - GOSSIP_NO_PEERS: No peers available
    - GOSSIP_PROPAGATION_FAILED: Failed to propagate to peers
    - GOSSIP_ANTI_ENTROPY_FAILED: Anti-entropy repair failed
    """
    pass


class ByzantineError(SyncError):
    """
    Raised when Byzantine validation fails.
    
    Error codes:
    - BYZANTINE_THRESHOLD_NOT_MET: Not enough votes for consensus
    - BYZANTINE_INVALID_VOTE: Invalid vote detected
    - BYZANTINE_SUSPECTED_ATTACK: Potential Byzantine attack detected
    """
    pass


# =============================================================================
# Resilience Layer Errors
# =============================================================================

class CircuitBreakerError(MemoryError):
    """
    Raised when circuit breaker is open.
    
    Error codes:
    - CIRCUIT_BREAKER_OPEN: Circuit is open, fast-failing
    """
    pass


class RetryExhaustedError(MemoryError):
    """
    Raised when all retry attempts are exhausted.
    
    Error codes:
    - RETRY_EXHAUSTED: All retry attempts failed
    """
    
    def __init__(
        self, 
        message: str, 
        attempts: int,
        last_error: Optional[Exception] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message, 
            error_code="RETRY_EXHAUSTED",
            details={**(details or {}), "attempts": attempts},
            cause=last_error,
        )
        self.attempts = attempts
        self.last_error = last_error


# =============================================================================
# External Service Errors
# =============================================================================

class ExternalServiceError(MemoryError):
    """
    Raised when external service operations fail.
    
    Error codes:
    - EXTERNAL_AUTH_FAILED: Authentication failed
    - EXTERNAL_RATE_LIMITED: Rate limit exceeded
    - EXTERNAL_UNAVAILABLE: Service unavailable
    - EXTERNAL_TIMEOUT: Request timed out
    """
    pass


class ZepError(ExternalServiceError):
    """Raised when Zep operations fail."""
    pass


class FireproofError(MemoryError):
    """
    Raised when Fireproof operations fail.
    
    Error codes:
    - FIREPROOF_NOT_INITIALIZED: Service not initialized
    - FIREPROOF_CRDT_CONFLICT: CRDT merge conflict
    - FIREPROOF_SYNC_FAILED: Sync operation failed
    """
    pass


# =============================================================================
# Configuration Errors
# =============================================================================

class ConfigurationError(MemoryError):
    """
    Raised when configuration is invalid.
    
    Error codes:
    - CONFIG_MISSING_REQUIRED: Required config value missing
    - CONFIG_INVALID_VALUE: Config value is invalid
    - CONFIG_FILE_NOT_FOUND: Config file not found
    """
    pass


# =============================================================================
# Re-export for convenience
# =============================================================================

__all__ = [
    # Base
    "MemoryError",
    
    # Storage
    "StorageError",
    "ConnectionError", 
    "ValidationError",
    
    # Retrieval
    "RetrievalError",
    "EmbeddingError",
    
    # Sync
    "SyncError",
    "GossipError",
    "ByzantineError",
    
    # Resilience
    "CircuitBreakerError",
    "RetryExhaustedError",
    
    # External
    "ExternalServiceError",
    "ZepError",
    "FireproofError",
    
    # Config
    "ConfigurationError",
]

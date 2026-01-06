"""
Exceptions for Semantic Processing Module.

Provides structured error handling with error codes for
debugging and observability.
"""

from typing import Optional, Dict, Any


class SemanticError(Exception):
    """Base exception for all semantic processing errors."""
    
    def __init__(
        self, 
        message: str, 
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        """
        Initialize semantic error.
        
        Args:
            message: Human-readable error message
            error_code: Machine-readable error code for classification
            details: Additional context for debugging
        """
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.details = details or {}
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "error_type": self.__class__.__name__,
            "message": self.message,
            "error_code": self.error_code,
            "details": self.details,
        }


class ValidationError(SemanticError):
    """
    Raised when input validation fails.
    
    Error codes:
    - EMPTY_INPUT: Input text is empty or whitespace-only
    - INVALID_FORMAT: Input doesn't match expected format
    - MISSING_FIELD: Required field is missing
    - INVALID_VALUE: Field has invalid value
    """
    pass


class DecompositionError(SemanticError):
    """
    Raised when decomposition fails.
    
    Error codes:
    - OLLAMA_ERROR: Ollama service error
    - SPACY_ERROR: spaCy processing error
    - INVALID_JSON: Failed to parse JSON response
    - INVALID_FRAME: Semantic frame validation failed
    - TOKEN_LIMIT_EXCEEDED: Input exceeds token limit
    - NO_STRATEGY_AVAILABLE: No decomposition strategy available
    - ALL_STRATEGIES_FAILED: All strategies failed
    """
    pass


class GraphStorageError(SemanticError):
    """
    Raised when graph storage operations fail.
    
    Error codes:
    - CONNECTION_FAILED: Database connection failed
    - QUERY_FAILED: Query execution failed
    - INSERT_FAILED: Insert operation failed
    - SCHEMA_MISMATCH: Schema doesn't match expected
    """
    pass


class EmbeddingError(SemanticError):
    """
    Raised when embedding operations fail.
    
    Error codes:
    - MODEL_NOT_FOUND: Embedding model not found
    - DIMENSION_MISMATCH: Vector dimensions don't match
    - SERVICE_UNAVAILABLE: Embedding service unavailable
    - BATCH_TOO_LARGE: Batch size exceeds limit
    """
    pass


class LSPError(SemanticError):
    """
    Raised when LSP operations fail.
    
    Error codes:
    - SERVER_NOT_FOUND: LSP server not available for language
    - TIMEOUT: LSP request timed out
    - PARSE_ERROR: Failed to parse LSP response
    - WORKSPACE_ERROR: Workspace configuration error
    """
    pass


class ExternalKnowledgeError(SemanticError):
    """
    Raised when external knowledge lookup fails.
    
    Error codes:
    - YAGO_ERROR: YAGO API error
    - SPARQL_ERROR: SPARQL query error
    - RATE_LIMITED: Rate limit exceeded
    - NOT_FOUND: Entity not found in knowledge base
    """
    pass


class ConverterError(SemanticError):
    """
    Raised when content conversion fails.
    
    Error codes:
    - UNSUPPORTED_FORMAT: Format not supported
    - PARSE_ERROR: Failed to parse source content
    - ENCODING_ERROR: Character encoding error
    - FILE_TOO_LARGE: File exceeds size limit
    """
    pass


class AnalysisError(SemanticError):
    """
    Raised when analysis operations fail.
    
    Error codes:
    - INSUFFICIENT_DATA: Not enough data for analysis
    - COMPUTATION_ERROR: Mathematical computation failed
    - INVALID_METRIC: Invalid metric requested
    """
    pass

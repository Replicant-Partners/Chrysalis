"""
Structured Logging Module

Provides JSON-formatted logging with context for better observability and log parsing.
Addresses Issue #10 from code review.

Features:
- JSON-formatted log output
- Contextual logging with metadata
- Metrics logging
- Performance tracking
- Error tracking with stack traces
- Backward compatible with standard logging

Usage:
    from structured_logger import get_structured_logger, log_with_context
    
    logger = get_structured_logger(__name__)
    logger.info("Processing started", extra={"legend": "Bob Ross", "run": 1})
    
    # Or use context manager
    with log_with_context(logger, "processing", legend="Bob Ross"):
        # Your code here
        pass
"""

import json
import logging
import sys
import time
import traceback
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Dict, Optional
from pathlib import Path


class StructuredFormatter(logging.Formatter):
    """
    JSON formatter for structured logging.
    
    Converts log records to JSON format with additional context fields.
    """
    
    def __init__(self, include_timestamp: bool = True, include_level: bool = True):
        """
        Initialize the formatter.
        
        Args:
            include_timestamp: Whether to include timestamp in output
            include_level: Whether to include log level in output
        """
        super().__init__()
        self.include_timestamp = include_timestamp
        self.include_level = include_level
    
    def format(self, record: logging.LogRecord) -> str:
        """
        Format a log record as JSON.
        
        Args:
            record: Log record to format
            
        Returns:
            JSON-formatted log string
        """
        # Base log data
        log_data: Dict[str, Any] = {
            "message": record.getMessage(),
        }
        
        # Add timestamp if requested
        if self.include_timestamp:
            log_data["timestamp"] = datetime.fromtimestamp(record.created).isoformat()
        
        # Add log level if requested
        if self.include_level:
            log_data["level"] = record.levelname
            log_data["level_num"] = record.levelno
        
        # Add logger name
        log_data["logger"] = record.name
        
        # Add source location
        log_data["source"] = {
            "file": record.pathname,
            "line": record.lineno,
            "function": record.funcName,
        }
        
        # Add process/thread info
        log_data["process"] = {
            "pid": record.process,
            "name": record.processName,
        }
        
        log_data["thread"] = {
            "tid": record.thread,
            "name": record.threadName,
        }
        
        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "message": str(record.exc_info[1]) if record.exc_info[1] else None,
                "traceback": traceback.format_exception(*record.exc_info),
            }
        
        # Add custom fields from extra parameter
        if hasattr(record, "custom_fields"):
            log_data["context"] = record.custom_fields
        
        # Add metrics if present
        if hasattr(record, "metrics"):
            log_data["metrics"] = record.metrics
        
        return json.dumps(log_data, default=str)


class StructuredLogger(logging.Logger):
    """
    Enhanced logger with structured logging support.
    
    Extends standard logger with convenience methods for structured logging.
    """
    
    def log_with_context(self, level: int, msg: str, **context: Any) -> None:
        """
        Log a message with additional context fields.
        
        Args:
            level: Log level (e.g., logging.INFO)
            msg: Log message
            **context: Additional context fields
        """
        extra = {"custom_fields": context}
        self.log(level, msg, extra=extra)
    
    def info_with_context(self, msg: str, **context: Any) -> None:
        """Log INFO message with context."""
        self.log_with_context(logging.INFO, msg, **context)
    
    def warning_with_context(self, msg: str, **context: Any) -> None:
        """Log WARNING message with context."""
        self.log_with_context(logging.WARNING, msg, **context)
    
    def error_with_context(self, msg: str, **context: Any) -> None:
        """Log ERROR message with context."""
        self.log_with_context(logging.ERROR, msg, **context)
    
    def debug_with_context(self, msg: str, **context: Any) -> None:
        """Log DEBUG message with context."""
        self.log_with_context(logging.DEBUG, msg, **context)
    
    def log_metrics(self, operation: str, **metrics: Any) -> None:
        """
        Log metrics for an operation.
        
        Args:
            operation: Name of the operation
            **metrics: Metric key-value pairs
        """
        extra = {
            "custom_fields": {"operation": operation},
            "metrics": metrics,
        }
        self.info(f"Metrics for {operation}", extra=extra)


def get_structured_logger(
    name: str,
    level: int = logging.INFO,
    use_json: bool = True,
    log_file: Optional[Path] = None
) -> StructuredLogger:
    """
    Get or create a structured logger.
    
    Args:
        name: Logger name (typically __name__)
        level: Logging level (default: INFO)
        use_json: Whether to use JSON formatting (default: True)
        log_file: Optional file path for file logging
        
    Returns:
        Configured StructuredLogger instance
    """
    # Set custom logger class
    logging.setLoggerClass(StructuredLogger)
    
    # Get logger
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    # Remove existing handlers to avoid duplicates
    logger.handlers.clear()
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    
    if use_json:
        formatter = StructuredFormatter()
    else:
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
    
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # File handler if requested
    if log_file:
        log_file.parent.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(level)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    # Prevent propagation to root logger
    logger.propagate = False
    
    return logger


@contextmanager
def log_with_context(logger: logging.Logger, operation: str, **context: Any):
    """
    Context manager for logging operation start/end with context.
    
    Args:
        logger: Logger instance
        operation: Operation name
        **context: Additional context fields
        
    Yields:
        Dictionary for adding metrics during operation
        
    Example:
        with log_with_context(logger, "processing", legend="Bob Ross") as ctx:
            # Do work
            ctx["items_processed"] = 10
    """
    start_time = time.perf_counter()
    metrics = {}
    
    # Log operation start
    if isinstance(logger, StructuredLogger):
        logger.info_with_context(f"Starting {operation}", operation=operation, **context)
    else:
        logger.info(f"Starting {operation}")
    
    try:
        yield metrics
        
        # Log operation success
        duration = time.perf_counter() - start_time
        metrics["duration_sec"] = round(duration, 3)
        metrics["status"] = "success"
        
        if isinstance(logger, StructuredLogger):
            logger.log_metrics(operation, **metrics)
        else:
            logger.info(f"Completed {operation} in {duration:.3f}s")
            
    except Exception as e:
        # Log operation failure
        duration = time.perf_counter() - start_time
        metrics["duration_sec"] = round(duration, 3)
        metrics["status"] = "error"
        metrics["error_type"] = type(e).__name__
        metrics["error_message"] = str(e)
        
        if isinstance(logger, StructuredLogger):
            logger.error_with_context(
                f"Failed {operation}",
                operation=operation,
                error=str(e),
                **context
            )
            logger.log_metrics(operation, **metrics)
        else:
            logger.error(f"Failed {operation}: {e}")
        
        raise


def log_processing_metrics(
    logger: logging.Logger,
    legend_name: str,
    kb_runs: int,
    sb_runs: int,
    total_duration: float,
    kb_merged: int = 0,
    kb_added: int = 0,
    sb_merged: int = 0,
    sb_added: int = 0
) -> None:
    """
    Log processing metrics for a legend.
    
    Args:
        logger: Logger instance
        legend_name: Name of the legend processed
        kb_runs: Number of KnowledgeBuilder runs
        sb_runs: Number of SkillBuilder runs
        total_duration: Total processing duration in seconds
        kb_merged: Number of KB embeddings merged
        kb_added: Number of KB embeddings added
        sb_merged: Number of SB embeddings merged
        sb_added: Number of SB embeddings added
    """
    metrics = {
        "legend": legend_name,
        "knowledge_builder": {
            "runs": kb_runs,
            "merged": kb_merged,
            "added": kb_added,
        },
        "skill_builder": {
            "runs": sb_runs,
            "merged": sb_merged,
            "added": sb_added,
        },
        "total_duration_sec": round(total_duration, 3),
        "avg_duration_per_run_sec": round(total_duration / (kb_runs + sb_runs), 3) if (kb_runs + sb_runs) > 0 else 0,
    }
    
    if isinstance(logger, StructuredLogger):
        logger.log_metrics("legend_processing", **metrics)
    else:
        logger.info(f"Processed {legend_name} in {total_duration:.3f}s")


# Example usage
if __name__ == "__main__":
    # Example 1: Basic structured logging
    logger = get_structured_logger(__name__)
    logger.info("Application started")
    logger.info_with_context("Processing legend", legend="Bob Ross", run=1)
    
    # Example 2: Context manager
    with log_with_context(logger, "embedding_generation", legend="Bob Ross") as ctx:
        time.sleep(0.1)  # Simulate work
        ctx["embeddings_created"] = 5
    
    # Example 3: Metrics logging
    log_processing_metrics(
        logger,
        legend_name="Bob Ross",
        kb_runs=3,
        sb_runs=3,
        total_duration=45.2,
        kb_merged=2,
        kb_added=1,
        sb_merged=1,
        sb_added=2
    )
    
    # Example 4: Error logging
    try:
        raise ValueError("Example error")
    except Exception as e:
        logger.error_with_context("Operation failed", operation="test", error=str(e))
    
    print("\n" + "="*60)
    print("Structured logging examples complete!")
    print("="*60)

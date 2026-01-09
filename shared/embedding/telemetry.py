"""
Telemetry adapter for embedding service.

Supports both KnowledgeBuilder (TelemetryRecorder) and SkillBuilder (TelemetryWriter) telemetry systems.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional, TYPE_CHECKING

logger = logging.getLogger(__name__)

# Type stubs to avoid circular imports
if TYPE_CHECKING:
    from skill_builder.pipeline.models import TelemetryEvent
    from skill_builder.pipeline.telemetry import TelemetryWriter
    from src.utils.telemetry import TelemetryRecorder, ToolCall


class EmbeddingTelemetry:
    """Telemetry adapter for embedding service.
    
    Works with both KnowledgeBuilder (TelemetryRecorder) and SkillBuilder (TelemetryWriter).
    Handles missing telemetry gracefully.
    """
    
    def __init__(
        self,
        telemetry_writer: Optional[Any] = None,  # SkillBuilder's TelemetryWriter
        telemetry_recorder: Optional[Any] = None,  # KnowledgeBuilder's TelemetryRecorder
    ):
        """Initialize telemetry adapter.
        
        Args:
            telemetry_writer: SkillBuilder TelemetryWriter (JSONL format)
            telemetry_recorder: KnowledgeBuilder TelemetryRecorder (SQLite format)
        """
        self._writer = telemetry_writer
        self._recorder = telemetry_recorder
    
    def record_success(
        self,
        provider: str,
        model: str,
        dimensions: int,
        latency_ms: float,
        text_length: int,
        cost: float,
    ):
        """Record successful embedding generation.
        
        Args:
            provider: Provider name (e.g., "voyage", "openai")
            model: Model name (e.g., "voyage-3")
            dimensions: Embedding dimensions
            latency_ms: Latency in milliseconds
            text_length: Text length in characters
            cost: Estimated cost in USD
        """
        # Emit to SkillBuilder JSONL format
        if self._writer:
            try:
                # Import here to avoid circular dependencies
                from skill_builder.pipeline.models import TelemetryEvent
                
                self._writer.emit(TelemetryEvent(
                    event_type="embedding.success",
                    data={
                        "provider": provider,
                        "model": model,
                        "dimensions": dimensions,
                        "latency_ms": latency_ms,
                        "text_length": text_length,
                        "cost": cost,
                    }
                ))
            except Exception as e:
                logger.debug(f"Failed to emit telemetry to writer: {e}")
        
        # Emit to KnowledgeBuilder SQLite format
        if self._recorder:
            try:
                # Import here to avoid circular dependencies
                from src.utils.telemetry import ToolCall
                
                self._recorder.record(ToolCall(
                    tool="embedding.success",
                    cost=cost,
                    latency_ms=latency_ms,
                    success=True,
                    new_facts=0,  # Embeddings don't extract facts
                    meta={
                        "provider": provider,
                        "model": model,
                        "dimensions": dimensions,
                        "text_length": text_length,
                    }
                ))
            except Exception as e:
                logger.debug(f"Failed to record telemetry: {e}")
    
    def record_error(
        self,
        provider: str,
        model: str,
        error_type: str,
        latency_ms: float,
        text_length: int,
        error_message: str,
    ):
        """Record embedding generation error.
        
        Args:
            provider: Provider name
            model: Model name
            error_type: Error classification (e.g., "timeout", "rate_limit")
            latency_ms: Latency in milliseconds
            text_length: Text length in characters
            error_message: Error message
        """
        # Emit to SkillBuilder JSONL format
        if self._writer:
            try:
                from skill_builder.pipeline.models import TelemetryEvent
                
                self._writer.emit(TelemetryEvent(
                    event_type="embedding.error",
                    data={
                        "provider": provider,
                        "model": model,
                        "error_type": error_type,
                        "latency_ms": latency_ms,
                        "text_length": text_length,
                        "error": error_message,
                    }
                ))
            except Exception as e:
                logger.debug(f"Failed to emit telemetry to writer: {e}")
        
        # Emit to KnowledgeBuilder SQLite format
        if self._recorder:
            try:
                from src.utils.telemetry import ToolCall
                
                self._recorder.record(ToolCall(
                    tool="embedding.error",
                    cost=0.0,
                    latency_ms=latency_ms,
                    success=False,
                    new_facts=0,
                    error=error_message,
                    meta={
                        "provider": provider,
                        "model": model,
                        "error_type": error_type,
                        "text_length": text_length,
                    }
                ))
            except Exception as e:
                logger.debug(f"Failed to record telemetry: {e}")
    
    def record_dimension_mismatch(
        self,
        provider: str,
        model: str,
        expected_dimensions: int,
        actual_dimensions: int,
    ):
        """Record dimension mismatch warning.
        
        Args:
            provider: Provider name
            model: Model name
            expected_dimensions: Expected dimensions
            actual_dimensions: Actual dimensions received
        """
        # Emit to SkillBuilder JSONL format
        if self._writer:
            try:
                from skill_builder.pipeline.models import TelemetryEvent
                
                self._writer.emit(TelemetryEvent(
                    event_type="embedding.dimension_mismatch",
                    data={
                        "provider": provider,
                        "model": model,
                        "expected_dimensions": expected_dimensions,
                        "actual_dimensions": actual_dimensions,
                    }
                ))
            except Exception as e:
                logger.debug(f"Failed to emit telemetry to writer: {e}")
        
        # Emit to KnowledgeBuilder SQLite format
        if self._recorder:
            try:
                from src.utils.telemetry import ToolCall
                
                self._recorder.record(ToolCall(
                    tool="embedding.dimension_mismatch",
                    cost=0.0,
                    latency_ms=None,
                    success=False,
                    new_facts=0,
                    error=f"Dimension mismatch: expected {expected_dimensions}, got {actual_dimensions}",
                    meta={
                        "provider": provider,
                        "model": model,
                        "expected_dimensions": expected_dimensions,
                        "actual_dimensions": actual_dimensions,
                    }
                ))
            except Exception as e:
                logger.debug(f"Failed to record telemetry: {e}")

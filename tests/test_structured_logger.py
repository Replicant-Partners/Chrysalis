"""
Tests for structured logging module.

Tests Issue #10 fix: Structured logging implementation.
"""

import json
import logging
import pytest
import time
from io import StringIO
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from structured_logger import (
    StructuredFormatter,
    StructuredLogger,
    get_structured_logger,
    log_with_context,
    log_processing_metrics,
)


class TestStructuredFormatter:
    """Test StructuredFormatter class."""
    
    def test_formatter_creates_valid_json(self):
        """Test that formatter produces valid JSON."""
        formatter = StructuredFormatter()
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=10,
            msg="Test message",
            args=(),
            exc_info=None,
        )
        
        output = formatter.format(record)
        data = json.loads(output)  # Should not raise
        
        assert data["message"] == "Test message"
        assert data["level"] == "INFO"
        assert "timestamp" in data
    
    def test_formatter_includes_source_info(self):
        """Test that formatter includes source location."""
        formatter = StructuredFormatter()
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="/path/to/test.py",
            lineno=42,
            msg="Test",
            args=(),
            exc_info=None,
            func="test_function",
        )
        
        output = formatter.format(record)
        data = json.loads(output)
        
        assert "source" in data
        assert data["source"]["file"] == "/path/to/test.py"
        assert data["source"]["line"] == 42
        assert data["source"]["function"] == "test_function"
    
    def test_formatter_includes_custom_fields(self):
        """Test that formatter includes custom context fields."""
        formatter = StructuredFormatter()
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=10,
            msg="Test",
            args=(),
            exc_info=None,
        )
        record.custom_fields = {"legend": "Bob Ross", "run": 1}
        
        output = formatter.format(record)
        data = json.loads(output)
        
        assert "context" in data
        assert data["context"]["legend"] == "Bob Ross"
        assert data["context"]["run"] == 1
    
    def test_formatter_includes_metrics(self):
        """Test that formatter includes metrics."""
        formatter = StructuredFormatter()
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=10,
            msg="Test",
            args=(),
            exc_info=None,
        )
        record.metrics = {"duration": 1.5, "items": 10}
        
        output = formatter.format(record)
        data = json.loads(output)
        
        assert "metrics" in data
        assert data["metrics"]["duration"] == 1.5
        assert data["metrics"]["items"] == 10


class TestStructuredLogger:
    """Test StructuredLogger class."""
    
    def test_logger_with_context(self, caplog):
        """Test logging with context."""
        logger = get_structured_logger("test", use_json=False)
        
        with caplog.at_level(logging.INFO):
            logger.info_with_context("Test message", legend="Bob Ross", run=1)
        
        assert len(caplog.records) == 1
        assert caplog.records[0].message == "Test message"
    
    def test_logger_metrics(self, caplog):
        """Test metrics logging."""
        logger = get_structured_logger("test", use_json=False)
        
        with caplog.at_level(logging.INFO):
            logger.log_metrics("test_operation", duration=1.5, items=10)
        
        assert len(caplog.records) == 1
        assert "test_operation" in caplog.records[0].message


class TestGetStructuredLogger:
    """Test get_structured_logger function."""
    
    def test_creates_logger(self):
        """Test that function creates a logger."""
        logger = get_structured_logger("test")
        assert isinstance(logger, StructuredLogger)
        assert logger.name == "test"
    
    def test_json_formatting(self):
        """Test JSON formatting is applied."""
        logger = get_structured_logger("test", use_json=True)
        
        # Check that handler has StructuredFormatter
        assert len(logger.handlers) > 0
        handler = logger.handlers[0]
        assert isinstance(handler.formatter, StructuredFormatter)
    
    def test_standard_formatting(self):
        """Test standard formatting option."""
        logger = get_structured_logger("test", use_json=False)
        
        # Check that handler has standard formatter
        assert len(logger.handlers) > 0
        handler = logger.handlers[0]
        assert isinstance(handler.formatter, logging.Formatter)
        assert not isinstance(handler.formatter, StructuredFormatter)


class TestLogWithContext:
    """Test log_with_context context manager."""
    
    def test_context_manager_success(self, caplog):
        """Test context manager for successful operation."""
        logger = get_structured_logger("test", use_json=False)
        
        with caplog.at_level(logging.INFO):
            with log_with_context(logger, "test_op", legend="Bob Ross") as ctx:
                ctx["items"] = 5
        
        # Should have start and metrics logs
        assert len(caplog.records) >= 1
        assert any("Starting test_op" in r.message for r in caplog.records)
    
    def test_context_manager_error(self, caplog):
        """Test context manager for failed operation."""
        logger = get_structured_logger("test", use_json=False)
        
        with caplog.at_level(logging.ERROR):
            with pytest.raises(ValueError):
                with log_with_context(logger, "test_op") as ctx:
                    raise ValueError("Test error")
        
        # Should have error log
        assert any(r.levelname == "ERROR" for r in caplog.records)
    
    def test_context_manager_tracks_duration(self, caplog):
        """Test that context manager tracks duration."""
        logger = get_structured_logger("test", use_json=False)
        
        with caplog.at_level(logging.INFO):
            with log_with_context(logger, "test_op") as ctx:
                time.sleep(0.01)  # Small delay
        
        # Metrics should be logged
        assert len(caplog.records) >= 1


class TestLogProcessingMetrics:
    """Test log_processing_metrics function."""
    
    def test_logs_metrics(self, caplog):
        """Test that metrics are logged."""
        logger = get_structured_logger("test", use_json=False)
        
        with caplog.at_level(logging.INFO):
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
        
        assert len(caplog.records) >= 1
        assert any("Bob Ross" in r.message for r in caplog.records)


class TestIntegration:
    """Integration tests for structured logging."""
    
    def test_full_workflow(self, tmp_path):
        """Test complete logging workflow."""
        log_file = tmp_path / "test.log"
        logger = get_structured_logger("test", use_json=True, log_file=log_file)
        
        # Log various messages
        logger.info("Starting")
        logger.info_with_context("Processing", legend="Bob Ross", run=1)
        logger.log_metrics("test_op", duration=1.5, items=10)
        
        with log_with_context(logger, "operation") as ctx:
            ctx["result"] = "success"
        
        # Check log file was created
        assert log_file.exists()
        
        # Check log file contains JSON
        with open(log_file) as f:
            lines = f.readlines()
            assert len(lines) > 0
            
            # Each line should be valid JSON
            for line in lines:
                data = json.loads(line)
                assert "message" in data
                assert "timestamp" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

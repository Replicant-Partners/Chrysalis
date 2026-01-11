"""
Integration Tests: Enhanced Quality Metrics Collector

Tests integration between EnhancedQualityMetricsCollector and quality tools.

Design Pattern: Test Pattern (xUnit Test Patterns, Meszaros)
"""

import pytest
import json
import tempfile
from pathlib import Path
import sys

# Add project root to path
project_root = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(project_root))

from scripts.quality.enhanced_quality_metrics import (
    EnhancedQualityMetricsCollector,
    PythonQualityCollector,
    TypeScriptQualityCollector,
    QualityMetrics,
)


class TestEnhancedQualityMetricsCollector:
    """Integration tests for EnhancedQualityMetricsCollector"""

    @pytest.fixture
    def collector(self):
        """Create collector instance"""
        return EnhancedQualityMetricsCollector(project_root)

    @pytest.fixture
    def python_collector(self):
        """Create Python collector instance"""
        return PythonQualityCollector(project_root)

    @pytest.fixture
    def typescript_collector(self):
        """Create TypeScript collector instance"""
        return TypeScriptQualityCollector(project_root)

    def test_collect_all_metrics_structure(self, collector):
        """Test that collect_all_metrics returns correct structure"""
        metrics = collector.collect_all_metrics()

        assert isinstance(metrics, QualityMetrics)
        assert hasattr(metrics, 'timestamp')
        assert hasattr(metrics, 'total_issues')
        assert hasattr(metrics, 'total_errors')
        assert hasattr(metrics, 'total_warnings')
        assert hasattr(metrics, 'tool_metrics')
        assert hasattr(metrics, 'summary')

    def test_python_metrics_collection(self, python_collector):
        """Test Python metrics collection"""
        metrics = python_collector.collect_all_metrics()

        assert isinstance(metrics, dict)
        assert 'flake8' in metrics
        assert 'black' in metrics
        assert 'mypy' in metrics

        # Verify structure
        for tool_name, tool_metrics in metrics.items():
            assert 'tool' in tool_metrics
            assert 'success' in tool_metrics
            assert 'total_issues' in tool_metrics

    def test_typescript_metrics_collection(self, typescript_collector):
        """Test TypeScript metrics collection"""
        metrics = typescript_collector.collect_all_metrics()

        assert isinstance(metrics, dict)
        assert 'eslint' in metrics
        assert 'tsc' in metrics

        # Verify structure
        for tool_name, tool_metrics in metrics.items():
            assert 'tool' in tool_metrics
            assert 'success' in tool_metrics
            assert 'total_issues' in tool_metrics

    def test_metrics_aggregation(self, collector):
        """Test metrics aggregation across all tools"""
        metrics = collector.collect_all_metrics()

        # Verify aggregated metrics
        assert metrics.total_issues >= 0
        assert metrics.total_errors >= 0
        assert metrics.total_warnings >= 0
        assert metrics.total_fixable_issues >= 0
        assert metrics.files_with_issues >= 0

        # Verify summary
        assert metrics.summary['tools_executed'] > 0
        assert metrics.summary['tools_succeeded'] >= 0
        assert metrics.summary['success_rate'] >= 0
        assert metrics.summary['success_rate'] <= 100

    def test_json_serialization(self, collector):
        """Test JSON serialization"""
        json_str = collector.collect_metrics_json()

        assert isinstance(json_str, str)
        assert json_str.strip().startswith('{')

        # Verify valid JSON
        data = json.loads(json_str)
        assert 'timestamp' in data
        assert 'total_issues' in data
        assert 'tool_metrics' in data

    def test_save_metrics(self, collector):
        """Test saving metrics to file"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            output_path = Path(f.name)

        try:
            collector.save_metrics(output_path)

            assert output_path.exists()

            # Verify file content
            with open(output_path, 'r') as f:
                data = json.load(f)

            assert 'timestamp' in data
            assert 'total_issues' in data
            assert 'tool_metrics' in data
        finally:
            if output_path.exists():
                output_path.unlink()

    def test_cli_interface(self, collector):
        """Test CLI interface (basic validation)"""
        # This is a basic test - full CLI testing would require subprocess
        assert hasattr(collector, 'collect_all_metrics')
        assert hasattr(collector, 'collect_metrics_json')
        assert hasattr(collector, 'save_metrics')


class TestPythonQualityCollector:
    """Integration tests for PythonQualityCollector"""

    @pytest.fixture
    def collector(self):
        """Create collector instance"""
        return PythonQualityCollector(project_root)

    def test_collect_flake8_metrics(self, collector):
        """Test flake8 metrics collection"""
        metrics = collector.collect_flake8_metrics()

        assert isinstance(metrics, dict)
        assert metrics['tool'] == 'flake8'
        assert 'success' in metrics
        assert 'total_issues' in metrics

    def test_collect_black_metrics(self, collector):
        """Test black metrics collection"""
        metrics = collector.collect_black_metrics()

        assert isinstance(metrics, dict)
        assert metrics['tool'] == 'black'
        assert 'success' in metrics
        assert 'total_issues' in metrics

    def test_collect_mypy_metrics(self, collector):
        """Test mypy metrics collection"""
        metrics = collector.collect_mypy_metrics()

        assert isinstance(metrics, dict)
        assert metrics['tool'] == 'mypy'
        assert 'success' in metrics
        assert 'total_issues' in metrics


class TestTypeScriptQualityCollector:
    """Integration tests for TypeScriptQualityCollector"""

    @pytest.fixture
    def collector(self):
        """Create collector instance"""
        return TypeScriptQualityCollector(project_root)

    def test_collect_eslint_metrics(self, collector):
        """Test ESLint metrics collection"""
        metrics = collector.collect_eslint_metrics()

        assert isinstance(metrics, dict)
        assert metrics['tool'] == 'eslint'
        assert 'success' in metrics
        assert 'total_issues' in metrics

    def test_collect_tsc_metrics(self, collector):
        """Test TypeScript compiler metrics collection"""
        metrics = collector.collect_tsc_metrics()

        assert isinstance(metrics, dict)
        assert metrics['tool'] == 'tsc'
        assert 'success' in metrics
        assert 'total_issues' in metrics

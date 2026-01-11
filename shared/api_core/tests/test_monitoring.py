"""
Tests for monitoring and health check utilities.
"""

import pytest
from datetime import datetime, timezone

# Skip tests if Flask is not available
try:
    from flask import Flask
    FLASK_AVAILABLE = True
except ImportError:
    FLASK_AVAILABLE = False
    pytestmark = pytest.mark.skip("Flask not available")

from shared.api_core.monitoring import (
    HealthStatus,
    HealthCheck,
    HealthRegistry,
    create_health_check_middleware,
    MetricsCollector,
    create_metrics_middleware,
)


class TestHealthStatus:
    """Tests for HealthStatus enumeration."""

    def test_health_status_values(self):
        """Test that HealthStatus has expected values."""
        assert HealthStatus.HEALTHY == "healthy"
        assert HealthStatus.UNHEALTHY == "unhealthy"
        assert HealthStatus.DEGRADED == "degraded"


class TestHealthCheck:
    """Tests for HealthCheck class."""

    def test_health_check_creation(self):
        """Test creating a health check."""
        def check_func():
            return (True, None)

        check = HealthCheck("test", check_func, required=False)
        assert check.name == "test"
        assert check.check_func == check_func
        assert check.required is False

    def test_health_check_required(self):
        """Test required health check."""
        def check_func():
            return (True, None)

        check = HealthCheck("test", check_func, required=True)
        assert check.required is True


class TestHealthRegistry:
    """Tests for HealthRegistry class."""

    def test_registry_creation(self):
        """Test creating a health registry."""
        registry = HealthRegistry()
        assert len(registry.checks) == 0

    def test_register_check(self):
        """Test registering a health check."""
        registry = HealthRegistry()

        def check_func():
            return (True, None)

        check = HealthCheck("test", check_func)
        registry.register(check)
        assert len(registry.checks) == 1
        assert registry.checks[0] == check

    def test_run_checks_all_healthy(self):
        """Test running checks when all are healthy."""
        registry = HealthRegistry()

        def check1():
            return (True, None)

        def check2():
            return (True, None)

        registry.register(HealthCheck("check1", check1))
        registry.register(HealthCheck("check2", check2))

        result = registry.run_checks()

        assert result["status"] == HealthStatus.HEALTHY
        assert "timestamp" in result
        assert "checks" in result
        assert len(result["checks"]) == 2
        assert result["checks"]["check1"]["status"] == HealthStatus.HEALTHY
        assert result["checks"]["check2"]["status"] == HealthStatus.HEALTHY

    def test_run_checks_some_unhealthy(self):
        """Test running checks when some are unhealthy."""
        registry = HealthRegistry()

        def check1():
            return (True, None)

        def check2():
            return (False, "Error message")

        registry.register(HealthCheck("check1", check1, required=False))
        registry.register(HealthCheck("check2", check2, required=False))

        result = registry.run_checks()

        assert result["status"] == HealthStatus.DEGRADED
        assert result["checks"]["check1"]["status"] == HealthStatus.HEALTHY
        assert result["checks"]["check2"]["status"] == HealthStatus.UNHEALTHY
        assert result["checks"]["check2"]["error"] == "Error message"

    def test_run_checks_required_failed(self):
        """Test running checks when required check fails."""
        registry = HealthRegistry()

        def check1():
            return (True, None)

        def check2():
            return (False, "Critical error")

        registry.register(HealthCheck("check1", check1, required=False))
        registry.register(HealthCheck("check2", check2, required=True))

        result = registry.run_checks()

        assert result["status"] == HealthStatus.UNHEALTHY
        assert result["checks"]["check2"]["status"] == HealthStatus.UNHEALTHY

    def test_run_checks_exception_handling(self):
        """Test that exceptions in check functions are handled."""
        registry = HealthRegistry()

        def check1():
            return (True, None)

        def check2():
            raise ValueError("Check failed")

        registry.register(HealthCheck("check1", check1, required=False))
        registry.register(HealthCheck("check2", check2, required=False))

        result = registry.run_checks()

        assert result["status"] == HealthStatus.DEGRADED
        assert result["checks"]["check2"]["status"] == HealthStatus.UNHEALTHY
        assert "Check failed" in result["checks"]["check2"]["error"]


class TestHealthCheckMiddleware:
    """Tests for health check middleware."""

    def test_create_health_check_middleware(self):
        """Test creating health check middleware."""
        app = Flask(__name__)
        create_health_check_middleware(app)

        # Check that routes are registered
        with app.test_client() as client:
            response = client.get('/health')
            assert response.status_code == 200
            data = response.get_json()
            assert data["status"] == HealthStatus.HEALTHY
            assert "timestamp" in data
            assert "checks" in data

    def test_healthz_endpoint(self):
        """Test /healthz endpoint (Kubernetes convention)."""
        app = Flask(__name__)
        create_health_check_middleware(app)

        with app.test_client() as client:
            response = client.get('/healthz')
            assert response.status_code == 200

    def test_readiness_endpoint(self):
        """Test /ready endpoint."""
        app = Flask(__name__)
        create_health_check_middleware(app)

        with app.test_client() as client:
            response = client.get('/ready')
            assert response.status_code == 200

    def test_liveness_endpoint(self):
        """Test /live endpoint."""
        app = Flask(__name__)
        create_health_check_middleware(app)

        with app.test_client() as client:
            response = client.get('/live')
            assert response.status_code == 200
            data = response.get_json()
            assert data["status"] == HealthStatus.HEALTHY


class TestMetricsCollector:
    """Tests for MetricsCollector class."""

    def test_metrics_collector_creation(self):
        """Test creating a metrics collector."""
        metrics = MetricsCollector()
        assert len(metrics.counters) == 0
        assert len(metrics.gauges) == 0
        assert len(metrics.histograms) == 0

    def test_increment_counter(self):
        """Test incrementing a counter."""
        metrics = MetricsCollector()
        metrics.increment('test_counter')
        assert metrics.counters['test_counter'] == 1

        metrics.increment('test_counter', 5)
        assert metrics.counters['test_counter'] == 6

    def test_set_gauge(self):
        """Test setting a gauge."""
        metrics = MetricsCollector()
        metrics.set_gauge('test_gauge', 42.5)
        assert metrics.gauges['test_gauge'] == 42.5

        metrics.set_gauge('test_gauge', 100.0)
        assert metrics.gauges['test_gauge'] == 100.0

    def test_observe_histogram(self):
        """Test observing histogram values."""
        metrics = MetricsCollector()
        metrics.observe_histogram('test_histogram', 10.0)
        metrics.observe_histogram('test_histogram', 20.0)
        metrics.observe_histogram('test_histogram', 30.0)

        assert len(metrics.histograms['test_histogram']) == 3
        assert metrics.histograms['test_histogram'] == [10.0, 20.0, 30.0]

    def test_get_metrics(self):
        """Test getting all metrics."""
        metrics = MetricsCollector()
        metrics.increment('counter1')
        metrics.set_gauge('gauge1', 50.0)
        metrics.observe_histogram('hist1', 10.0)
        metrics.observe_histogram('hist1', 20.0)

        result = metrics.get_metrics()

        assert 'counters' in result
        assert 'gauges' in result
        assert 'histograms' in result

        assert result['counters']['counter1'] == 1
        assert result['gauges']['gauge1'] == 50.0

        hist_data = result['histograms']['hist1']
        assert hist_data['count'] == 2
        assert hist_data['sum'] == 30.0
        assert hist_data['min'] == 10.0
        assert hist_data['max'] == 20.0
        assert hist_data['avg'] == 15.0


class TestMetricsMiddleware:
    """Tests for metrics middleware."""

    def test_create_metrics_middleware(self):
        """Test creating metrics middleware."""
        app = Flask(__name__)
        metrics = create_metrics_middleware(app)

        assert metrics is not None
        assert 'metrics' in app.extensions

    def test_metrics_endpoint(self):
        """Test /metrics endpoint."""
        app = Flask(__name__)
        create_metrics_middleware(app)

        # Make a request to generate metrics
        @app.route('/test')
        def test():
            return {'status': 'ok'}

        with app.test_client() as client:
            client.get('/test')

            response = client.get('/metrics')
            assert response.status_code == 200
            data = response.get_json()
            assert 'counters' in data
            assert 'gauges' in data
            assert 'histograms' in data

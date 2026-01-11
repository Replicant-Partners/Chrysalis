"""
Monitoring and observability utilities for Flask services.

Provides health checks, metrics collection, and basic observability
for production Flask applications.
"""

from typing import Dict, Any, Optional, Callable
from datetime import datetime, timezone
import sys

try:
    from flask import Flask, jsonify, request, g
    FLASK_AVAILABLE = True
except ImportError:
    FLASK_AVAILABLE = False
    # Stub for when Flask is not available
    class Flask:
        pass


class HealthStatus:
    """Health status enumeration."""
    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    DEGRADED = "degraded"


class HealthCheck:
    """Health check configuration."""

    def __init__(
        self,
        name: str,
        check_func: Callable[[], tuple[bool, Optional[str]]],
        required: bool = False
    ):
        """
        Initialize a health check.

        Args:
            name: Name of the health check
            check_func: Function that returns (is_healthy, error_message)
            required: If True, failure makes overall health unhealthy
        """
        self.name = name
        self.check_func = check_func
        self.required = required


class HealthRegistry:
    """Registry for health checks."""

    def __init__(self):
        self.checks: list[HealthCheck] = []

    def register(self, check: HealthCheck):
        """Register a health check."""
        self.checks.append(check)

    def run_checks(self) -> Dict[str, Any]:
        """
        Run all registered health checks.

        Returns:
            Dictionary with overall status and individual check results
        """
        results = {}
        all_healthy = True
        any_required_failed = False

        for check in self.checks:
            try:
                is_healthy, error_message = check.check_func()
                results[check.name] = {
                    "status": HealthStatus.HEALTHY if is_healthy else HealthStatus.UNHEALTHY,
                    "error": error_message
                }

                if not is_healthy:
                    all_healthy = False
                    if check.required:
                        any_required_failed = True
            except Exception as e:
                results[check.name] = {
                    "status": HealthStatus.UNHEALTHY,
                    "error": str(e)
                }
                all_healthy = False
                if check.required:
                    any_required_failed = True

        overall_status = HealthStatus.UNHEALTHY if any_required_failed else (
            HealthStatus.HEALTHY if all_healthy else HealthStatus.DEGRADED
        )

        return {
            "status": overall_status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "checks": results
        }


def create_health_check_middleware(app: Flask) -> None:
    """
    Create health check endpoint for Flask app.

    Args:
        app: Flask application instance
    """
    if not FLASK_AVAILABLE:
        raise RuntimeError("Flask is required for health check middleware. Install Flask.")

    # Create health registry
    health_registry = HealthRegistry()

    # Register default health check (always healthy)
    def default_check() -> tuple[bool, Optional[str]]:
        return (True, None)

    health_registry.register(HealthCheck("default", default_check, required=True))

    # Store registry in app extensions
    app.extensions['health_registry'] = health_registry

    @app.route('/health', methods=['GET'])
    @app.route('/healthz', methods=['GET'])  # Kubernetes convention
    def health_check():
        """Health check endpoint."""
        registry = app.extensions.get('health_registry', health_registry)
        result = registry.run_checks()

        status_code = 200 if result["status"] == HealthStatus.HEALTHY else (
            503 if result["status"] == HealthStatus.UNHEALTHY else 200  # Degraded returns 200
        )

        return jsonify(result), status_code

    @app.route('/ready', methods=['GET'])
    @app.route('/readiness', methods=['GET'])  # Kubernetes convention
    def readiness_check():
        """Readiness check endpoint (same as health for now)."""
        return health_check()

    @app.route('/live', methods=['GET'])
    @app.route('/liveness', methods=['GET'])  # Kubernetes convention
    def liveness_check():
        """Liveness check endpoint (minimal check)."""
        return jsonify({
            "status": HealthStatus.HEALTHY,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }), 200


def register_health_check(app: Flask, check: HealthCheck):
    """
    Register a health check with the Flask app.

    Args:
        app: Flask application instance
        check: HealthCheck instance
    """
    if not FLASK_AVAILABLE:
        raise RuntimeError("Flask is required for health checks. Install Flask.")

    registry = app.extensions.get('health_registry')
    if registry is None:
        # Initialize if not already created
        create_health_check_middleware(app)
        registry = app.extensions.get('health_registry')

    registry.register(check)


class MetricsCollector:
    """Basic metrics collector for Flask applications."""

    def __init__(self):
        self.counters: Dict[str, int] = {}
        self.gauges: Dict[str, float] = {}
        self.histograms: Dict[str, list[float]] = {}

    def increment(self, metric_name: str, value: int = 1):
        """Increment a counter metric."""
        self.counters[metric_name] = self.counters.get(metric_name, 0) + value

    def set_gauge(self, metric_name: str, value: float):
        """Set a gauge metric."""
        self.gauges[metric_name] = value

    def observe_histogram(self, metric_name: str, value: float):
        """Observe a histogram value."""
        if metric_name not in self.histograms:
            self.histograms[metric_name] = []
        self.histograms[metric_name].append(value)

    def get_metrics(self) -> Dict[str, Any]:
        """Get all metrics in a dictionary format."""
        return {
            "counters": self.counters.copy(),
            "gauges": self.gauges.copy(),
            "histograms": {
                name: {
                    "count": len(values),
                    "sum": sum(values),
                    "min": min(values) if values else 0,
                    "max": max(values) if values else 0,
                    "avg": sum(values) / len(values) if values else 0
                }
                for name, values in self.histograms.items()
            }
        }


def create_metrics_middleware(app: Flask) -> MetricsCollector:
    """
    Create metrics collection middleware for Flask app.

    Args:
        app: Flask application instance

    Returns:
        MetricsCollector instance
    """
    if not FLASK_AVAILABLE:
        raise RuntimeError("Flask is required for metrics middleware. Install Flask.")

    metrics = MetricsCollector()
    app.extensions['metrics'] = metrics

    @app.before_request
    def track_request_start():
        """Track request start time."""
        g.request_start_time = datetime.now(timezone.utc)

    @app.after_request
    def track_request_metrics(response):
        """Track request metrics."""
        # Increment request counter
        metrics.increment('http_requests_total')
        metrics.increment(f'http_requests_total_{response.status_code // 100}xx')

        # Track response time
        if hasattr(g, 'request_start_time'):
            duration_ms = (datetime.now(timezone.utc) - g.request_start_time).total_seconds() * 1000
            metrics.observe_histogram('http_request_duration_ms', duration_ms)

        # Track request size (if available)
        if request.content_length:
            metrics.observe_histogram('http_request_size_bytes', request.content_length)

        # Track response size
        if response.content_length:
            metrics.observe_histogram('http_response_size_bytes', response.content_length)

        return response

    @app.route('/metrics', methods=['GET'])
    def metrics_endpoint():
        """Metrics endpoint (basic JSON format)."""
        return jsonify(metrics.get_metrics()), 200

    return metrics

"""
Error tracking and observability utilities for Flask services.

Implements error tracking with optional Sentry integration, following
the complex learner pattern: errors become learning opportunities.
"""

from typing import Optional, Dict, Any, Callable
import sys

try:
    from flask import Flask, request, g
    FLASK_AVAILABLE = True
except ImportError:
    FLASK_AVAILABLE = False
    # Stub for when Flask is not available
    class Flask:
        pass


class ErrorTrackingConfig:
    """Configuration for error tracking."""

    def __init__(
        self,
        enabled: bool = True,
        sentry_dsn: Optional[str] = None,
        environment: str = "production",
        release: Optional[str] = None,
        sample_rate: float = 1.0,
        traces_sample_rate: float = 0.1,
        before_send: Optional[Callable] = None,
        attach_stacktrace: bool = True,
        send_default_pii: bool = False,
    ):
        """
        Initialize error tracking configuration.

        Args:
            enabled: Enable error tracking
            sentry_dsn: Sentry DSN (Data Source Name) - if None, uses environment variable
            environment: Environment name (production, staging, development)
            release: Release version
            sample_rate: Error sample rate (0.0 to 1.0)
            traces_sample_rate: Performance trace sample rate (0.0 to 1.0)
            before_send: Optional callback to filter/modify events before sending
            attach_stacktrace: Attach stack traces to events
            send_default_pii: Send personally identifiable information
        """
        self.enabled = enabled
        self.sentry_dsn = sentry_dsn
        self.environment = environment
        self.release = release
        self.sample_rate = sample_rate
        self.traces_sample_rate = traces_sample_rate
        self.before_send = before_send
        self.attach_stacktrace = attach_stacktrace
        self.send_default_pii = send_default_pii


def create_error_tracking_middleware(
    app: Flask,
    config: Optional[ErrorTrackingConfig] = None
) -> None:
    """
    Create error tracking middleware for Flask app.

    Follows the complex learner pattern: errors become learning opportunities.
    Each error is contextualized with request information, user context, and
    system state to enable pattern recognition and adaptation.

    Args:
        app: Flask application instance
        config: ErrorTrackingConfig instance (uses defaults if None)
    """
    if not FLASK_AVAILABLE:
        raise RuntimeError("Flask is required for error tracking middleware. Install Flask.")

    if config is None:
        import os
        config = ErrorTrackingConfig(
            enabled=os.getenv("ERROR_TRACKING_ENABLED", "true").lower() == "true",
            sentry_dsn=os.getenv("SENTRY_DSN"),
            environment=os.getenv("ENVIRONMENT", "production"),
            release=os.getenv("RELEASE"),
        )

    if not config.enabled:
        return

    # Try to import and initialize Sentry
    sentry_initialized = False
    try:
        import sentry_sdk
        from sentry_sdk.integrations.flask import FlaskIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

        if config.sentry_dsn:
            sentry_sdk.init(
                dsn=config.sentry_dsn,
                environment=config.environment,
                release=config.release,
                integrations=[
                    FlaskIntegration(),
                    SqlalchemyIntegration(),
                ],
                sample_rate=config.sample_rate,
                traces_sample_rate=config.traces_sample_rate,
                before_send=config.before_send,
                attach_stacktrace=config.attach_stacktrace,
                send_default_pii=config.send_default_pii,
            )
            sentry_initialized = True
    except ImportError:
        # Sentry not installed - use basic error logging
        pass
    except Exception as e:
        # Sentry initialization failed - log and continue with basic logging
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Failed to initialize Sentry: {e}")

    # Context enrichment for error tracking
    # Following complex learner pattern: errors are contextualized with
    # system state, user patterns, and environmental factors
    @app.before_request
    def enrich_error_context():
        """Enrich error context with request information."""
        if sentry_initialized:
            import sentry_sdk
            with sentry_sdk.configure_scope() as scope:
                # Add request context
                scope.set_tag("path", request.path)
                scope.set_tag("method", request.method)

                # Add request ID for correlation
                request_id = getattr(g, "request_id", None)
                if request_id:
                    scope.set_tag("request_id", request_id)

                # Add user context (if available)
                user = getattr(g, "current_user", None)
                if user:
                    scope.set_user({
                        "id": getattr(user, "id", None),
                        "username": getattr(user, "username", None),
                    })

    # Error handler that captures and contextualizes errors
    # Following complex learner pattern: errors are learning signals
    @app.errorhandler(Exception)
    def handle_error(error):
        """Handle errors with tracking and contextualization."""
        import logging
        logger = logging.getLogger(__name__)

        # Log error with context (always, even if Sentry not available)
        logger.error(
            f"Error: {type(error).__name__}: {str(error)}",
            extra={
                "path": request.path,
                "method": request.method,
                "request_id": getattr(g, "request_id", None),
                "error_type": type(error).__name__,
            },
            exc_info=True
        )

        # Send to Sentry if initialized
        if sentry_initialized:
            import sentry_sdk
            sentry_sdk.capture_exception(error)

        # Re-raise to let Flask error handlers process
        raise


def capture_message(
    message: str,
    level: str = "info",
    context: Optional[Dict[str, Any]] = None
) -> None:
    """
    Capture a message for error tracking.

    Following complex learner pattern: messages are learning signals
    that help the system understand its own behavior and patterns.

    Args:
        message: Message to capture
        level: Message level (debug, info, warning, error, fatal)
        context: Additional context dictionary
    """
    try:
        import sentry_sdk
        sentry_sdk.capture_message(message, level=level)
        if context:
            with sentry_sdk.configure_scope() as scope:
                for key, value in context.items():
                    scope.set_tag(key, value)
    except ImportError:
        # Sentry not available - use logging
        import logging
        logger = logging.getLogger(__name__)
        log_level = getattr(logging, level.upper(), logging.INFO)
        logger.log(log_level, message, extra=context or {})


def capture_exception(
    exception: Exception,
    context: Optional[Dict[str, Any]] = None
) -> None:
    """
    Capture an exception for error tracking.

    Following complex learner pattern: exceptions are learning opportunities
    that help the system adapt and improve its behavior.

    Args:
        exception: Exception to capture
        context: Additional context dictionary
    """
    try:
        import sentry_sdk
        if context:
            with sentry_sdk.configure_scope() as scope:
                for key, value in context.items():
                    scope.set_tag(key, value)
        sentry_sdk.capture_exception(exception)
    except ImportError:
        # Sentry not available - use logging
        import logging
        logger = logging.getLogger(__name__)
        logger.exception(
            f"Exception: {type(exception).__name__}: {str(exception)}",
            extra=context or {}
        )

"""
Audit logging utilities for Flask services.

Implements audit logging for security-relevant events following the complex
learner pattern: security events are learning signals that help the system
understand threats, patterns, and adaptation opportunities.
"""

from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import json
import sys

try:
    from flask import Flask, request, g
    FLASK_AVAILABLE = True
except ImportError:
    FLASK_AVAILABLE = False
    # Stub for when Flask is not available
    class Flask:
        pass


class AuditEvent:
    """Audit event model."""

    def __init__(
        self,
        event_type: str,
        user_id: Optional[str] = None,
        username: Optional[str] = None,
        action: str = "",
        resource: Optional[str] = None,
        resource_id: Optional[str] = None,
        outcome: str = "success",
        details: Optional[Dict[str, Any]] = None,
        timestamp: Optional[datetime] = None,
        request_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ):
        """
        Initialize an audit event.

        Args:
            event_type: Type of event (authentication, authorization, data_access, etc.)
            user_id: User ID (if available)
            username: Username (if available)
            action: Action performed
            resource: Resource accessed
            resource_id: ID of resource accessed
            outcome: Outcome (success, failure, error)
            details: Additional details dictionary
            timestamp: Event timestamp (uses current time if None)
            request_id: Request ID for correlation
            ip_address: Client IP address
            user_agent: User agent string
        """
        self.event_type = event_type
        self.user_id = user_id
        self.username = username
        self.action = action
        self.resource = resource
        self.resource_id = resource_id
        self.outcome = outcome
        self.details = details or {}
        self.timestamp = timestamp or datetime.now(timezone.utc)
        self.request_id = request_id
        self.ip_address = ip_address
        self.user_agent = user_agent

    def to_dict(self) -> Dict[str, Any]:
        """Convert audit event to dictionary."""
        return {
            "event_type": self.event_type,
            "timestamp": self.timestamp.isoformat(),
            "user_id": self.user_id,
            "username": self.username,
            "action": self.action,
            "resource": self.resource,
            "resource_id": self.resource_id,
            "outcome": self.outcome,
            "details": self.details,
            "request_id": self.request_id,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
        }

    def to_json(self) -> str:
        """Convert audit event to JSON string."""
        return json.dumps(self.to_dict())


class AuditLogger:
    """Audit logger for security events."""

    def __init__(
        self,
        log_file: Optional[str] = None,
        enable_console: bool = False,
        structured_output: bool = True,
    ):
        """
        Initialize audit logger.

        Args:
            log_file: Path to log file (uses syslog if None)
            enable_console: Enable console output
            structured_output: Use structured JSON output
        """
        self.log_file = log_file
        self.enable_console = enable_console
        self.structured_output = structured_output

        # Open log file if specified
        self.file_handle = None
        if log_file:
            try:
                self.file_handle = open(log_file, 'a')
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Failed to open audit log file {log_file}: {e}")

    def log(self, event: AuditEvent) -> None:
        """
        Log an audit event.

        Following complex learner pattern: audit events are learning signals
        that help the system understand security patterns, threats, and
        adaptation opportunities.

        Args:
            event: AuditEvent instance
        """
        if self.structured_output:
            output = event.to_json()
        else:
            # Human-readable format
            output = (
                f"[{event.timestamp.isoformat()}] "
                f"{event.event_type}: {event.action} "
                f"by {event.username or event.user_id or 'unknown'} "
                f"on {event.resource or 'unknown'} "
                f"({event.outcome})"
            )

        # Write to file
        if self.file_handle:
            try:
                self.file_handle.write(output + "\n")
                self.file_handle.flush()
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Failed to write audit log: {e}")

        # Write to console
        if self.enable_console:
            print(output)

    def close(self) -> None:
        """Close audit logger."""
        if self.file_handle:
            self.file_handle.close()
            self.file_handle = None


def create_audit_logging_middleware(
    app: Flask,
    log_file: Optional[str] = None,
    enable_console: bool = False,
) -> AuditLogger:
    """
    Create audit logging middleware for Flask app.

    Following complex learner pattern: audit logging captures security events
    as learning signals that help the system understand patterns, threats, and
    adaptation opportunities over time.

    Args:
        app: Flask application instance
        log_file: Path to audit log file (uses environment variable if None)
        enable_console: Enable console output

    Returns:
        AuditLogger instance
    """
    if not FLASK_AVAILABLE:
        raise RuntimeError("Flask is required for audit logging middleware. Install Flask.")

    import os

    if log_file is None:
        log_file = os.getenv("AUDIT_LOG_FILE")

    audit_logger = AuditLogger(
        log_file=log_file,
        enable_console=enable_console or os.getenv("AUDIT_LOG_CONSOLE", "false").lower() == "true",
    )

    # Store logger in app extensions
    app.extensions['audit_logger'] = audit_logger

    # Audit logging decorator for endpoints
    def audit_log(event_type: str, action: str, resource: Optional[str] = None):
        """
        Decorator to audit log an endpoint.

        Args:
            event_type: Type of event
            action: Action performed
            resource: Resource accessed
        """
        def decorator(func):
            from functools import wraps

            @wraps(func)
            def wrapper(*args, **kwargs):
                # Get user context
                user = getattr(g, "current_user", None)
                user_id = getattr(user, "id", None) if user else None
                username = getattr(user, "username", None) if user else None

                # Get request context
                request_id = getattr(g, "request_id", None)
                ip_address = request.remote_addr
                user_agent = request.headers.get("User-Agent")

                # Extract resource ID from kwargs if available
                resource_id = None
                if resource:
                    # Try to extract ID from route parameters
                    for key in ['id', 'agent_id', 'knowledge_id', 'skill_id']:
                        if key in kwargs:
                            resource_id = kwargs[key]
                            break

                # Determine outcome (will be set after execution)
                outcome = "success"
                error = None

                try:
                    result = func(*args, **kwargs)

                    # Log success
                    event = AuditEvent(
                        event_type=event_type,
                        user_id=user_id,
                        username=username,
                        action=action,
                        resource=resource,
                        resource_id=resource_id,
                        outcome=outcome,
                        request_id=request_id,
                        ip_address=ip_address,
                        user_agent=user_agent,
                    )
                    audit_logger.log(event)

                    return result
                except Exception as e:
                    # Log failure
                    outcome = "failure"
                    error = str(e)

                    event = AuditEvent(
                        event_type=event_type,
                        user_id=user_id,
                        username=username,
                        action=action,
                        resource=resource,
                        resource_id=resource_id,
                        outcome=outcome,
                        details={"error": error},
                        request_id=request_id,
                        ip_address=ip_address,
                        user_agent=user_agent,
                    )
                    audit_logger.log(event)

                    raise

            return wrapper
        return decorator

    # Store decorator in app
    app.audit_log = audit_log

    # Log authentication events
    @app.before_request
    def log_authentication():
        """Log authentication attempts."""
        # Skip for health checks and docs
        if request.path in ['/health', '/healthz', '/ready', '/live', '/metrics', '/api/docs', '/api/openapi.json']:
            return

        # Check if authentication was attempted
        auth_header = request.headers.get("Authorization")
        if auth_header:
            user = getattr(g, "current_user", None)
            user_id = getattr(user, "id", None) if user else None
            username = getattr(user, "username", None) if user else None

            # Log authentication attempt
            event = AuditEvent(
                event_type="authentication",
                user_id=user_id,
                username=username,
                action="authenticate",
                outcome="success" if user else "failure",
                request_id=getattr(g, "request_id", None),
                ip_address=request.remote_addr,
                user_agent=request.headers.get("User-Agent"),
            )
            audit_logger.log(event)

    # Cleanup on app teardown
    @app.teardown_appcontext
    def close_audit_logger(error):
        """Close audit logger on app teardown."""
        # Logger is shared, don't close it here
        pass

    return audit_logger


def get_audit_logger(app: Flask) -> Optional[AuditLogger]:
    """Get audit logger from Flask app."""
    return app.extensions.get('audit_logger')

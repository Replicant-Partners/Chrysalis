"""
Security headers middleware for Flask applications.

Implements security headers as recommended by OWASP and security best practices.
"""

from typing import Dict, Optional

try:
    from flask import Flask
    FLASK_AVAILABLE = True
except ImportError:
    FLASK_AVAILABLE = False
    # Stub for when Flask is not available
    class Flask:
        pass


class SecurityHeadersConfig:
    """Configuration for security headers."""

    def __init__(
        self,
        strict_transport_security: bool = True,
        hsts_max_age: int = 31536000,  # 1 year in seconds
        hsts_include_subdomains: bool = True,
        hsts_preload: bool = False,
        content_security_policy: Optional[str] = None,
        x_frame_options: str = "DENY",
        x_content_type_options: str = "nosniff",
        x_xss_protection: str = "1; mode=block",
        referrer_policy: str = "strict-origin-when-cross-origin",
        permissions_policy: Optional[str] = None,
    ):
        """
        Initialize security headers configuration.

        Args:
            strict_transport_security: Enable HSTS header
            hsts_max_age: HSTS max-age value in seconds
            hsts_include_subdomains: Include subdomains in HSTS
            hsts_preload: Enable HSTS preload
            content_security_policy: CSP policy string (None to disable)
            x_frame_options: X-Frame-Options value (DENY, SAMEORIGIN, or ALLOW-FROM)
            x_content_type_options: X-Content-Type-Options value
            x_xss_protection: X-XSS-Protection value
            referrer_policy: Referrer-Policy value
            permissions_policy: Permissions-Policy value (None to disable)
        """
        self.strict_transport_security = strict_transport_security
        self.hsts_max_age = hsts_max_age
        self.hsts_include_subdomains = hsts_include_subdomains
        self.hsts_preload = hsts_preload
        self.content_security_policy = content_security_policy
        self.x_frame_options = x_frame_options
        self.x_content_type_options = x_content_type_options
        self.x_xss_protection = x_xss_protection
        self.referrer_policy = referrer_policy
        self.permissions_policy = permissions_policy

    def build_hsts_header(self) -> Optional[str]:
        """Build HSTS header value."""
        if not self.strict_transport_security:
            return None

        parts = [f"max-age={self.hsts_max_age}"]

        if self.hsts_include_subdomains:
            parts.append("includeSubDomains")

        if self.hsts_preload:
            parts.append("preload")

        return "; ".join(parts)


def create_security_headers_middleware(
    app: Flask,
    config: Optional[SecurityHeadersConfig] = None
) -> None:
    """
    Create security headers middleware for Flask app.

    Args:
        app: Flask application instance
        config: SecurityHeadersConfig instance (uses defaults if None)
    """
    if not FLASK_AVAILABLE:
        raise RuntimeError("Flask is required for security headers middleware. Install Flask.")

    if config is None:
        config = SecurityHeadersConfig()

    @app.after_request
    def add_security_headers(response):
        """Add security headers to all responses."""
        # Strict-Transport-Security (HSTS)
        if config.strict_transport_security:
            hsts_value = config.build_hsts_header()
            if hsts_value:
                response.headers['Strict-Transport-Security'] = hsts_value

        # Content-Security-Policy
        if config.content_security_policy:
            response.headers['Content-Security-Policy'] = config.content_security_policy

        # X-Frame-Options
        response.headers['X-Frame-Options'] = config.x_frame_options

        # X-Content-Type-Options
        response.headers['X-Content-Type-Options'] = config.x_content_type_options

        # X-XSS-Protection
        response.headers['X-XSS-Protection'] = config.x_xss_protection

        # Referrer-Policy
        response.headers['Referrer-Policy'] = config.referrer_policy

        # Permissions-Policy (formerly Feature-Policy)
        if config.permissions_policy:
            response.headers['Permissions-Policy'] = config.permissions_policy

        return response

"""Credential provider abstractions for Flask services."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Dict, Optional, Protocol


try:  # Flask is optional for import-time safety
    from flask import Request
except ImportError:  # pragma: no cover - flask not installed
    Request = None  # type: ignore

from .models import APIError, ErrorCode, ErrorCategory


DEFAULT_API_KEY_HEADERS = (
    "X-API-Key",
    "X-Chrysalis-Api-Key",
    "X-Agent-Api-Key",
    "X-Builder-Api-Key",
)


@dataclass
class ProviderCredentials:
    """Structured credential payload populated by providers."""

    bearer_token: Optional[str] = None
    api_keys: Dict[str, str] = field(default_factory=dict)
    raw_headers: Dict[str, str] = field(default_factory=dict)

    def has_auth(self) -> bool:
        return bool(self.bearer_token or self.api_keys)


class CredentialProvider(Protocol):
    """Protocol describing credential provider implementations."""

    def resolve_provider_keys(self, request: Request) -> ProviderCredentials:  # pragma: no cover - protocol
        ...


class HeaderCredentialProvider:
    """Extracts credential material from HTTP headers once per request."""

    def __init__(
        self,
        *,
        api_key_headers: tuple[str, ...] = DEFAULT_API_KEY_HEADERS,
    ) -> None:
        self.api_key_headers = api_key_headers

    def resolve_provider_keys(self, request: Request) -> ProviderCredentials:
        bearer = _extract_bearer_token(request)
        api_keys: Dict[str, str] = {}
        for header in self.api_key_headers:
            value = request.headers.get(header)
            if value:
                api_keys[header.lower()] = value

        return ProviderCredentials(
            bearer_token=bearer,
            api_keys=api_keys,
            raw_headers={k.lower(): v for k, v in request.headers.items()},
        )


def _extract_bearer_token(request: Request) -> Optional[str]:
    auth_header = request.headers.get("Authorization", "")
    if not isinstance(auth_header, str):
        return None
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header[7:].strip()
    return token or None


STRICT_HEADER_FLAG = os.getenv("STRICT_CREDENTIAL_HEADERS", "false").lower() in {"1", "true", "yes"}


def enforce_credentials(credentials: ProviderCredentials, *, request_path: str) -> None:
    """Raise APIError when strict enforcement is enabled and credentials missing."""

    if STRICT_HEADER_FLAG and request_path.startswith("/api/") and not credentials.has_auth():
        raise APIError(
            code=ErrorCode.MISSING_AUTH,
            message="Authorization headers are required. Supply Bearer token or X-API-Key header.",
            category=ErrorCategory.AUTHENTICATION_ERROR,
        )


def create_credentials_middleware(app, provider: Optional[CredentialProvider] = None) -> None:
    """Attach header credential parsing middleware to the Flask app."""

    if Request is None:
        raise RuntimeError("Flask must be installed to use credentials middleware.")

    provider = provider or HeaderCredentialProvider()

    @app.before_request
    def _load_credentials():
        from flask import g, request  # local import to avoid global Flask deps

        creds = provider.resolve_provider_keys(request)
        enforce_credentials(creds, request_path=request.path)
        g.credentials = creds

    return None


def get_request_credentials(default: Optional[ProviderCredentials] = None) -> ProviderCredentials:
    """Fetch credentials parsed by the middleware from Flask's request context."""

    if Request is None:
        raise RuntimeError("Flask must be installed to access request credentials.")

    try:
        from flask import g  # type: ignore
    except ImportError as exc:  # pragma: no cover - Flask missing
        raise RuntimeError("Flask must be installed to access request credentials.") from exc

    creds = getattr(g, "credentials", None)
    if isinstance(creds, ProviderCredentials):
        return creds
    return default or ProviderCredentials()


__all__ = [
    "ProviderCredentials",
    "CredentialProvider",
    "HeaderCredentialProvider",
    "create_credentials_middleware",
    "get_request_credentials",
    "enforce_credentials",
]

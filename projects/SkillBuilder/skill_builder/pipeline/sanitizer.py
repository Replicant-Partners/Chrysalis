"""
Security and sanitization controls for SkillBuilder.

Semantic Requirements:
- Defense-in-depth for prompt injection
- Secrets redaction from env-derived values

Note: Core source-level sanitization has been moved to Go (pkg/search/sanitizer.go)
for maximum performance. This module handles Python-specific redaction and 
LLM prompt preparation.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import Sequence


# Environment variable prefixes that typically contain secrets
SECRET_ENV_PREFIXES: tuple[str, ...] = (
    "API_KEY", "SECRET", "TOKEN", "PASSWORD", "CREDENTIAL",
    "AUTH", "PRIVATE", "OPENAI", "ANTHROPIC", "TAVILY",
    "BRAVE", "AWS_", "AZURE_", "GCP_", "GITHUB_TOKEN",
)


@dataclass(frozen=True)
class SanitizationResult:
    """Result of sanitization with metadata for debugging."""
    text: str
    secrets_redacted: int = 0


def redact_secrets(text: str) -> tuple[str, int]:
    """Redact any env-derived secrets found in text."""
    redacted_count = 0
    result = text
    
    for key, value in os.environ.items():
        is_secret = any(
            key.upper().startswith(prefix) or prefix in key.upper()
            for prefix in SECRET_ENV_PREFIXES
        )
        
        if is_secret and value and len(value) >= 8:
            if value in result:
                result = result.replace(value, "[REDACTED]")
                redacted_count += 1
    
    return result, redacted_count


def sanitize_for_prompt(text: str, max_length: int = 4000) -> str:
    """Prepare text for inclusion in LLM prompts."""
    cleaned, _ = redact_secrets(text)
    
    if len(cleaned) > max_length:
        return cleaned[:max_length] + "... [truncated]"
    
    return cleaned


def wrap_untrusted_content(content: str) -> str:
    """Wrap content with untrusted policy marker for LLM consumption."""
    sanitized = sanitize_for_prompt(content)
    return f"--- UNTRUSTED CONTENT ---\n{sanitized}\n--- END UNTRUSTED CONTENT ---"

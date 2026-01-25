"""
Universal Adapter Configuration

Default LLM configuration for the Universal Adapter.
Uses GPT5.2-codex via OpenRouter for task execution.

Environment Variables:
    OPENROUTER_API_KEY: API key for OpenRouter
    UNIVERSAL_ADAPTER_MODEL: Override default model
    UNIVERSAL_ADAPTER_PROVIDER: Override default provider (openrouter, ollama)
    OLLAMA_BASE_URL: Base URL for Ollama (default: http://localhost:11434)
"""

from __future__ import annotations
import os
from dataclasses import dataclass, field
from typing import Literal

# ============================================================================
# Configuration Types
# ============================================================================

ProviderType = Literal["openrouter", "ollama", "anthropic", "openai"]


@dataclass
class LLMConfig:
    """Configuration for LLM provider."""
    provider: ProviderType
    model: str
    base_url: str
    api_key: str | None = None
    temperature: float = 0.1
    max_tokens: int = 8192
    timeout_ms: int = 60000


# ============================================================================
# Default Configuration
# ============================================================================

# Default model for Universal Adapter: GPT5.2-codex via OpenRouter
DEFAULT_MODEL = os.environ.get("UNIVERSAL_ADAPTER_MODEL", "openai/gpt-5.2-codex")
DEFAULT_PROVIDER: ProviderType = os.environ.get("UNIVERSAL_ADAPTER_PROVIDER", "openrouter")  # type: ignore

# Provider base URLs
PROVIDER_URLS = {
    "openrouter": "https://openrouter.ai/api/v1",
    "ollama": os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434"),
    "anthropic": "https://api.anthropic.com/v1",
    "openai": "https://api.openai.com/v1",
}

# API keys from environment
API_KEYS = {
    "openrouter": os.environ.get("OPENROUTER_API_KEY"),
    "anthropic": os.environ.get("ANTHROPIC_API_KEY"),
    "openai": os.environ.get("OPENAI_API_KEY"),
}


def get_default_config() -> LLMConfig:
    """Get the default LLM configuration for Universal Adapter."""
    return LLMConfig(
        provider=DEFAULT_PROVIDER,
        model=DEFAULT_MODEL,
        base_url=PROVIDER_URLS.get(DEFAULT_PROVIDER, PROVIDER_URLS["openrouter"]),
        api_key=API_KEYS.get(DEFAULT_PROVIDER),
        temperature=0.1,  # Low temperature for deterministic task execution
        max_tokens=8192,
        timeout_ms=60000,
    )


# ============================================================================
# Model Presets
# ============================================================================

MODEL_PRESETS = {
    # Default: GPT5.2-codex for high-quality task execution
    "default": LLMConfig(
        provider="openrouter",
        model="openai/gpt-5.2-codex",
        base_url=PROVIDER_URLS["openrouter"],
        api_key=API_KEYS.get("openrouter"),
        temperature=0.1,
        max_tokens=8192,
    ),
    # Fast: Claude Haiku for quick tasks
    "fast": LLMConfig(
        provider="openrouter",
        model="anthropic/claude-3-haiku",
        base_url=PROVIDER_URLS["openrouter"],
        api_key=API_KEYS.get("openrouter"),
        temperature=0.1,
        max_tokens=4096,
    ),
    # Local: Phi4-mini via Ollama for offline operation
    "local": LLMConfig(
        provider="ollama",
        model="phi4-mini",
        base_url=PROVIDER_URLS["ollama"],
        api_key=None,
        temperature=0.1,
        max_tokens=4096,
    ),
    # Local alternatives
    "local-mistral": LLMConfig(
        provider="ollama",
        model="mistral3:3b",
        base_url=PROVIDER_URLS["ollama"],
        api_key=None,
        temperature=0.1,
        max_tokens=4096,
    ),
    "local-gemma": LLMConfig(
        provider="ollama",
        model="gemma3n",
        base_url=PROVIDER_URLS["ollama"],
        api_key=None,
        temperature=0.1,
        max_tokens=4096,
    ),
    # Premium: Claude Sonnet for complex tasks
    "premium": LLMConfig(
        provider="openrouter",
        model="anthropic/claude-sonnet-4",
        base_url=PROVIDER_URLS["openrouter"],
        api_key=API_KEYS.get("openrouter"),
        temperature=0.05,
        max_tokens=16384,
    ),
}


def get_config(preset: str = "default") -> LLMConfig:
    """
    Get LLM configuration by preset name.
    
    Args:
        preset: One of 'default', 'fast', 'local', 'local-mistral', 
                'local-gemma', 'premium'
    
    Returns:
        LLMConfig for the specified preset
    """
    if preset not in MODEL_PRESETS:
        raise ValueError(f"Unknown preset: {preset}. Available: {list(MODEL_PRESETS.keys())}")
    return MODEL_PRESETS[preset]


# ============================================================================
# ResourceLLM Builder
# ============================================================================

def build_resource_llm(config: LLMConfig | None = None) -> dict:
    """
    Build a ResourceLLM dictionary for task.json specifications.
    
    Args:
        config: LLM configuration (uses default if None)
    
    Returns:
        Dictionary compatible with task.json resource_llm field
    """
    if config is None:
        config = get_default_config()
    
    return {
        "provider": config.provider,
        "model": config.model,
        "base_url": config.base_url,
        "api_key_env": _get_api_key_env(config.provider),
        "temperature": config.temperature,
        "max_tokens": config.max_tokens,
    }


def _get_api_key_env(provider: ProviderType) -> str:
    """Get environment variable name for provider API key."""
    env_map = {
        "openrouter": "OPENROUTER_API_KEY",
        "anthropic": "ANTHROPIC_API_KEY",
        "openai": "OPENAI_API_KEY",
        "ollama": "",  # Ollama doesn't need API key
    }
    return env_map.get(provider, "")


# ============================================================================
# Convenience exports
# ============================================================================

# Default configuration instance
DEFAULT_CONFIG = get_default_config()

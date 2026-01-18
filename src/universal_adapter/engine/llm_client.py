"""
LLM Client Abstraction

Provider-agnostic interface for LLM communication.
Supports multiple backends through a factory pattern.

The client handles:
- Request construction from ResourceLLM config
- API key resolution from environment
- Response normalization
- Error handling and retries
"""

from __future__ import annotations
import os
import json
import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Mapping, Sequence, Protocol, Literal
from enum import Enum, auto

from ..schema import ResourceLLM


class MessageRole(Enum):
    """Standard message roles across providers."""
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"


@dataclass(frozen=True)
class Message:
    """A single message in a conversation."""
    role: MessageRole
    content: str

    @classmethod
    def system(cls, content: str) -> Message:
        return cls(role=MessageRole.SYSTEM, content=content)

    @classmethod
    def user(cls, content: str) -> Message:
        return cls(role=MessageRole.USER, content=content)

    @classmethod
    def assistant(cls, content: str) -> Message:
        return cls(role=MessageRole.ASSISTANT, content=content)

    def to_dict(self) -> dict[str, str]:
        """Convert to API-compatible dictionary."""
        return {"role": self.role.value, "content": self.content}


@dataclass(frozen=True)
class LLMRequest:
    """
    Request to an LLM provider.

    Immutable structure containing all parameters needed for an LLM call.
    """
    messages: tuple[Message, ...]
    model: str
    temperature: float = 0.7
    max_tokens: int = 4096
    stop_sequences: tuple[str, ...] = ()
    metadata: Mapping[str, Any] = field(default_factory=dict)

    @classmethod
    def simple(cls, prompt: str, model: str, **kwargs: Any) -> LLMRequest:
        """Create a simple single-message request."""
        return cls(
            messages=(Message.user(prompt),),
            model=model,
            **kwargs
        )

    @classmethod
    def with_system(
        cls,
        system: str,
        prompt: str,
        model: str,
        **kwargs: Any
    ) -> LLMRequest:
        """Create a request with system message."""
        return cls(
            messages=(Message.system(system), Message.user(prompt)),
            model=model,
            **kwargs
        )

    def with_message(self, message: Message) -> LLMRequest:
        """Create new request with an additional message."""
        return LLMRequest(
            messages=self.messages + (message,),
            model=self.model,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            stop_sequences=self.stop_sequences,
            metadata=self.metadata
        )


@dataclass(frozen=True)
class LLMResponse:
    """
    Response from an LLM provider.

    Normalized structure across all providers.
    """
    content: str
    model: str
    finish_reason: str
    usage: Mapping[str, int]
    raw_response: Any = None  # Provider-specific raw response

    @property
    def prompt_tokens(self) -> int:
        return self.usage.get("prompt_tokens", 0)

    @property
    def completion_tokens(self) -> int:
        return self.usage.get("completion_tokens", 0)

    @property
    def total_tokens(self) -> int:
        return self.usage.get("total_tokens", 0)


class LLMError(Exception):
    """Base error for LLM operations."""
    pass


class LLMAuthError(LLMError):
    """Authentication error (missing or invalid API key)."""
    pass


class LLMRateLimitError(LLMError):
    """Rate limit exceeded."""
    pass


class LLMConnectionError(LLMError):
    """Connection or network error."""
    pass


class LLMProvider(ABC):
    """
    Abstract base for LLM providers.

    Each provider implements this interface to handle
    provider-specific API details.
    """

    @abstractmethod
    async def complete(self, request: LLMRequest) -> LLMResponse:
        """Execute an LLM completion request."""
        ...

    @abstractmethod
    def validate_config(self, config: ResourceLLM) -> tuple[bool, list[str]]:
        """Validate provider-specific configuration."""
        ...


class OpenAIProvider(LLMProvider):
    """OpenAI API provider."""

    def __init__(self, api_key: str, endpoint: str | None = None) -> None:
        self.api_key = api_key
        self.endpoint = endpoint or "https://api.openai.com/v1"

    async def complete(self, request: LLMRequest) -> LLMResponse:
        """Execute completion via OpenAI API."""
        # Import httpx lazily to avoid hard dependency
        try:
            import httpx
        except ImportError:
            raise LLMError("httpx not installed. Run: pip install httpx")

        url = f"{self.endpoint}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        body = {
            "model": request.model,
            "messages": [m.to_dict() for m in request.messages],
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
        }

        if request.stop_sequences:
            body["stop"] = list(request.stop_sequences)

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    url,
                    headers=headers,
                    json=body,
                    timeout=120.0
                )
                response.raise_for_status()
                data = response.json()

                return LLMResponse(
                    content=data["choices"][0]["message"]["content"],
                    model=data["model"],
                    finish_reason=data["choices"][0]["finish_reason"],
                    usage=data.get("usage", {}),
                    raw_response=data
                )

            except httpx.HTTPStatusError as e:
                if e.response.status_code == 401:
                    raise LLMAuthError("Invalid OpenAI API key")
                elif e.response.status_code == 429:
                    raise LLMRateLimitError("OpenAI rate limit exceeded")
                raise LLMError(f"OpenAI API error: {e}")
            except httpx.RequestError as e:
                raise LLMConnectionError(f"Connection error: {e}")

    def validate_config(self, config: ResourceLLM) -> tuple[bool, list[str]]:
        errors: list[str] = []
        if not self.api_key:
            errors.append("OpenAI API key is required")
        if not config.model.startswith(("gpt-", "o1-")):
            errors.append(f"Invalid OpenAI model: {config.model}")
        return (len(errors) == 0, errors)


class AnthropicProvider(LLMProvider):
    """Anthropic Claude API provider."""

    def __init__(self, api_key: str, endpoint: str | None = None) -> None:
        self.api_key = api_key
        self.endpoint = endpoint or "https://api.anthropic.com/v1"

    async def complete(self, request: LLMRequest) -> LLMResponse:
        """Execute completion via Anthropic API."""
        try:
            import httpx
        except ImportError:
            raise LLMError("httpx not installed. Run: pip install httpx")

        url = f"{self.endpoint}/messages"
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json"
        }

        # Anthropic uses separate system parameter
        system_content = None
        messages = []
        for msg in request.messages:
            if msg.role == MessageRole.SYSTEM:
                system_content = msg.content
            else:
                messages.append(msg.to_dict())

        body: dict[str, Any] = {
            "model": request.model,
            "messages": messages,
            "max_tokens": request.max_tokens,
        }

        if system_content:
            body["system"] = system_content

        if request.stop_sequences:
            body["stop_sequences"] = list(request.stop_sequences)

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    url,
                    headers=headers,
                    json=body,
                    timeout=120.0
                )
                response.raise_for_status()
                data = response.json()

                # Extract content from Anthropic's response format
                content = ""
                for block in data.get("content", []):
                    if block.get("type") == "text":
                        content += block.get("text", "")

                return LLMResponse(
                    content=content,
                    model=data.get("model", request.model),
                    finish_reason=data.get("stop_reason", "end_turn"),
                    usage={
                        "prompt_tokens": data.get("usage", {}).get("input_tokens", 0),
                        "completion_tokens": data.get("usage", {}).get("output_tokens", 0),
                        "total_tokens": (
                            data.get("usage", {}).get("input_tokens", 0) +
                            data.get("usage", {}).get("output_tokens", 0)
                        )
                    },
                    raw_response=data
                )

            except httpx.HTTPStatusError as e:
                if e.response.status_code == 401:
                    raise LLMAuthError("Invalid Anthropic API key")
                elif e.response.status_code == 429:
                    raise LLMRateLimitError("Anthropic rate limit exceeded")
                raise LLMError(f"Anthropic API error: {e}")
            except httpx.RequestError as e:
                raise LLMConnectionError(f"Connection error: {e}")

    def validate_config(self, config: ResourceLLM) -> tuple[bool, list[str]]:
        errors: list[str] = []
        if not self.api_key:
            errors.append("Anthropic API key is required")
        if not config.model.startswith("claude-"):
            errors.append(f"Invalid Anthropic model: {config.model}")
        return (len(errors) == 0, errors)


class TemplateProvider(LLMProvider):
    """
    Template provider - returns the interpolated prompt as-is.

    Useful for deterministic tasks that only need variable expansion
    without calling an external LLM.
    """

    async def complete(self, request: LLMRequest) -> LLMResponse:
        content = request.messages[-1].content if request.messages else ""
        return LLMResponse(
            content=content,
            model=request.model,
            finish_reason="stop",
            usage={"prompt_tokens": len(content.split()), "completion_tokens": 0, "total_tokens": len(content.split())}
        )

    def validate_config(self, config: ResourceLLM) -> tuple[bool, list[str]]:
        return (True, [])


class OllamaProvider(LLMProvider):
    """Ollama local LLM provider."""

    def __init__(self, api_key: str = "", endpoint: str | None = None) -> None:
        # api_key not needed for Ollama but kept for interface compatibility
        self.endpoint = endpoint or "http://localhost:11434"

    async def complete(self, request: LLMRequest) -> LLMResponse:
        """Execute completion via Ollama API."""
        try:
            import httpx
        except ImportError:
            raise LLMError("httpx package required: pip install httpx")

        messages = [
            {"role": msg.role.value, "content": msg.content}
            for msg in request.messages
        ]

        body = {
            "model": request.model,
            "messages": messages,
            "stream": False,
        }

        if request.temperature is not None:
            body["options"] = body.get("options", {})
            body["options"]["temperature"] = request.temperature
        if request.max_tokens is not None:
            body["options"] = body.get("options", {})
            body["options"]["num_predict"] = request.max_tokens

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{self.endpoint}/api/chat",
                    json=body,
                )
                resp.raise_for_status()
                data = resp.json()

                return LLMResponse(
                    content=data.get("message", {}).get("content", ""),
                    model=data.get("model", request.model),
                    finish_reason=data.get("done_reason", "stop"),
                    usage={
                        "prompt_tokens": data.get("prompt_eval_count", 0),
                        "completion_tokens": data.get("eval_count", 0),
                        "total_tokens": data.get("prompt_eval_count", 0) + data.get("eval_count", 0),
                    }
                )
        except httpx.HTTPStatusError as e:
            raise LLMError(f"Ollama error: {e.response.status_code} - {e.response.text}")
        except httpx.ConnectError as e:
            raise LLMConnectionError(f"Cannot connect to Ollama at {self.endpoint}: {e}")
        except Exception as e:
            raise LLMError(f"Ollama request failed: {e}")

    def validate_config(self, config: ResourceLLM) -> tuple[bool, list[str]]:
        # No API key needed for Ollama
        return (True, [])


class LLMClient:
    """
    High-level LLM client that routes requests to appropriate providers.

    Factory pattern for creating provider instances from ResourceLLM config.
    """

    PROVIDERS = {
        "openai": OpenAIProvider,
        "anthropic": AnthropicProvider,
        "ollama": OllamaProvider,
        "template": TemplateProvider,
    }

    def __init__(self, config: ResourceLLM) -> None:
        self.config = config
        self.provider = self._create_provider()

    def _create_provider(self) -> LLMProvider:
        """Create appropriate provider from config."""
        provider_name = self.config.provider.lower()

        if provider_name not in self.PROVIDERS:
            raise LLMError(f"Unknown provider: {provider_name}")

        # Resolve API key from environment
        api_key = ""
        if self.config.api_key_env:
            api_key = os.environ.get(self.config.api_key_env, "")
        else:
            # Try common environment variable names
            env_vars = {
                "openai": "OPENAI_API_KEY",
                "anthropic": "ANTHROPIC_API_KEY",
            }
            env_var = env_vars.get(provider_name)
            if env_var:
                api_key = os.environ.get(env_var, "")

        provider_class = self.PROVIDERS[provider_name]

        if provider_name == "template":
            return provider_class()  # type: ignore[arg-type]
        else:
            return provider_class(api_key=api_key, endpoint=self.config.endpoint)  # type: ignore[arg-type]

    async def complete(self, request: LLMRequest) -> LLMResponse:
        """Execute a completion request."""
        return await self.provider.complete(request)

    async def prompt(self, prompt: str) -> str:
        """Simple prompt execution, returns content only."""
        request = LLMRequest.simple(
            prompt=prompt,
            model=self.config.model,
            temperature=self.config.temperature,
            max_tokens=self.config.max_tokens
        )
        response = await self.complete(request)
        return response.content

    def validate(self) -> tuple[bool, list[str]]:
        """Validate the client configuration."""
        return self.provider.validate_config(self.config)

    @classmethod
    def from_config(cls, config: ResourceLLM) -> LLMClient:
        """Create client from ResourceLLM configuration."""
        return cls(config)

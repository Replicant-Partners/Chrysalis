"""
Core embedding service with provider abstraction, telemetry, and enhanced logging.
"""

import hashlib
import logging
import os
import time
from typing import List, Optional, Dict, Any

from .exceptions import (
    EmbeddingError,
    EmbeddingProviderError,
    EmbeddingDimensionMismatchError,
)
from .providers.base import EmbeddingProvider
from .providers.voyage import VoyageProvider
from .providers.openai import OpenAIProvider
from .providers.deterministic import DeterministicProvider
from .telemetry import EmbeddingTelemetry

logger = logging.getLogger(__name__)


class EmbeddingService:
    """
    Embedding service with provider abstraction, telemetry, and enhanced logging.

    Features:
    - Provider abstraction (Strategy pattern)
    - Automatic fallback between providers
    - Telemetry integration (KnowledgeBuilder and SkillBuilder)
    - Structured logging with error classification
    - Dimension validation
    - Cost estimation

    Provider priority:
    1. Voyage AI (primary - Anthropic's recommended)
    2. OpenAI (fallback)
    3. Deterministic (for tests/offline)
    """

    def __init__(
        self,
        model: str = "voyage-3",
        dimensions: int = 1024,
        fallback_model: str = "text-embedding-3-large",
        fallback_dimensions: int = 3072,
        telemetry: Optional[EmbeddingTelemetry] = None,
        forced_provider: Optional[str] = None,
    ):
        """
        Initialize embedding service.

        Args:
            model: Voyage AI model name (default: voyage-3)
            dimensions: Voyage embedding dimensions (default: 1024)
            fallback_model: OpenAI fallback model name
            fallback_dimensions: OpenAI fallback dimensions
            telemetry: Optional telemetry adapter for tracking
            forced_provider: Force provider ("voyage", "openai", "deterministic")
        """
        self.model = model
        self.dimensions = dimensions
        self.fallback_model = fallback_model
        self.fallback_dimensions = fallback_dimensions
        self._telemetry = telemetry

        # Provider instances (initialized for fallback support)
        self._voyage_provider: Optional[VoyageProvider] = None
        self._openai_provider: Optional[OpenAIProvider] = None
        self._deterministic_provider: Optional[DeterministicProvider] = None

        # Primary provider (selected based on availability and configuration)
        self._primary_provider: Optional[EmbeddingProvider] = None
        self._fallback_providers: List[EmbeddingProvider] = []

        # Check for forced provider override
        forced = forced_provider or os.getenv("EMBEDDING_PROVIDER", "").lower()
        if forced == "deterministic":
            self._initialize_deterministic_only()
            return

        # Initialize all available providers (for fallback support)
        self._initialize_providers(forced)

        # Select primary provider
        self._select_primary_provider(forced)

    def _initialize_deterministic_only(self):
        """Initialize only deterministic provider (forced mode)."""
        try:
            self._deterministic_provider = DeterministicProvider(dimensions=self.dimensions)
            self._primary_provider = self._deterministic_provider
            logger.info("Embedding provider: deterministic (forced)")
        except Exception as e:
            raise EmbeddingError(f"Failed to initialize deterministic provider: {e}") from e

    def _initialize_providers(self, forced_provider: str):
        """Initialize all available providers for fallback support."""
        # Initialize Voyage provider if available and not forced otherwise
        if forced_provider in ("", "voyage"):
            voyage_api_key = os.getenv("VOYAGE_API_KEY")
            if voyage_api_key:
                try:
                    self._voyage_provider = VoyageProvider(
                        api_key=voyage_api_key,
                        model=self.model,
                        dimensions=self.dimensions,
                        use_sdk=True,
                    )
                    logger.debug("Voyage provider initialized (available for fallback)")
                except Exception as e:
                    logger.debug(f"Voyage provider not available: {e}")

        # Initialize OpenAI provider if available and not forced otherwise
        if forced_provider in ("", "openai"):
            openai_api_key = os.getenv("OPENAI_API_KEY") or os.getenv("GPT_API_KEY")
            if openai_api_key:
                try:
                    self._openai_provider = OpenAIProvider(
                        api_key=openai_api_key,
                        model=self.fallback_model,
                        dimensions=self.fallback_dimensions,
                    )
                    logger.debug("OpenAI provider initialized (available for fallback)")
                except Exception as e:
                    logger.debug(f"OpenAI provider not available: {e}")

        # Always initialize deterministic provider (for final fallback in test mode)
        try:
            # Use appropriate dimensions based on what other providers use
            det_dims = self.dimensions if self._voyage_provider else self.fallback_dimensions
            self._deterministic_provider = DeterministicProvider(dimensions=det_dims)
            logger.debug("Deterministic provider initialized (available for fallback)")
        except Exception as e:
            logger.warning(f"Deterministic provider not available: {e}")

    def _select_primary_provider(self, forced_provider: str):
        """Select primary provider based on availability and configuration."""
        # Priority: Voyage > OpenAI > Deterministic

        # Try Voyage first
        if self._voyage_provider and (forced_provider in ("", "voyage")):
            self._primary_provider = self._voyage_provider
            self.dimensions = self._voyage_provider.get_dimensions()
            self.model = self._voyage_provider.get_model_name()

            # Set up fallbacks (OpenAI, then Deterministic if allowed)
            if self._openai_provider and forced_provider != "voyage":
                self._fallback_providers.append(self._openai_provider)
            if self._deterministic_provider:
                self._fallback_providers.append(self._deterministic_provider)

            logger.info(f"Embedding provider: Voyage AI ({self.model}, {self.dimensions} dimensions)")
            return

        # Try OpenAI as fallback
        if self._openai_provider and (forced_provider in ("", "openai")):
            self._primary_provider = self._openai_provider
            self.dimensions = self._openai_provider.get_dimensions()
            self.model = self._openai_provider.get_model_name()

            # Set up fallbacks (Deterministic if allowed)
            if self._deterministic_provider and forced_provider != "openai":
                self._fallback_providers.append(self._deterministic_provider)

            logger.info(f"Embedding provider: OpenAI ({self.model}, {self.dimensions} dimensions)")
            return

        # Try Deterministic as last resort
        if self._deterministic_provider and (forced_provider in ("", "deterministic")):
            self._primary_provider = self._deterministic_provider
            self.dimensions = self._deterministic_provider.get_dimensions()
            self.model = self._deterministic_provider.get_model_name()
            logger.info(f"Embedding provider: Deterministic ({self.dimensions} dimensions)")
            return

        # No provider available - try deterministic as last resort
        if self._deterministic_provider:
            self._primary_provider = self._deterministic_provider
            self.dimensions = self._deterministic_provider.get_dimensions()
            self.model = self._deterministic_provider.get_model_name()
            logger.warning("No API providers available, using deterministic provider")
            return

        # Truly no provider available
        raise EmbeddingError(
            "No embedding provider available. "
            "Set VOYAGE_API_KEY or OPENAI_API_KEY, "
            "or force EMBEDDING_PROVIDER=deterministic for tests."
        )

    def embed(self, text: str) -> List[float]:
        """
        Generate embedding for text with telemetry and logging.

        Provider fallback order:
        1. Primary provider (Voyage/OpenAI/Deterministic)
        2. Fallback providers (in order)
        3. RuntimeError if all fail

        Args:
            text: Text to embed

        Returns:
            Embedding vector as list of floats

        Raises:
            EmbeddingError: If all providers fail
            EmbeddingDimensionMismatchError: If dimensions don't match (strict mode only)
        """
        # Build log context
        log_context = self._build_log_context(text)
        logger.info("Generating embedding", extra=log_context)

        start_time = time.perf_counter()
        last_error: Optional[Exception] = None

        # Try primary provider first
        try:
            embedding = self._primary_provider.embed(text)
            elapsed_ms = (time.perf_counter() - start_time) * 1000

            # Validate dimensions
            self._validate_dimensions(embedding, log_context)

            # Log success
            provider_name = self._primary_provider.get_provider_name()
            model_name = self._primary_provider.get_model_name()
            logger.info(
                f"Embedding generated successfully in {elapsed_ms:.2f}ms",
                extra={
                    **log_context,
                    "latency_ms": elapsed_ms,
                    "provider_used": provider_name,
                }
            )

            # Telemetry
            if self._telemetry:
                cost = self._primary_provider.estimate_cost(text)
                self._telemetry.record_success(
                    provider=provider_name,
                    model=model_name,
                    dimensions=len(embedding),
                    latency_ms=elapsed_ms,
                    text_length=len(text),
                    cost=cost,
                )

            return embedding

        except Exception as exc:
            last_error = exc
            provider_name = self._primary_provider.get_provider_name()
            model_name = self._primary_provider.get_model_name()
            error_class = self._classify_error(exc)

            logger.warning(
                f"Primary provider ({provider_name}) failed, trying fallbacks: {error_class}",
                exc_info=False,
                extra={**log_context, "error_type": error_class.__name__, "error": str(exc)}
            )

            # Try fallback providers
            for fallback in self._fallback_providers:
                try:
                    embedding = fallback.embed(text)
                    elapsed_ms = (time.perf_counter() - start_time) * 1000

                    # Validate dimensions (note: fallback may have different dimensions - just log, don't error)
                    # Update dimensions if fallback has different dimensions
                    actual_dims = len(embedding)
                    if actual_dims != self.dimensions:
                        logger.info(
                            f"Fallback provider uses different dimensions: {actual_dims} (primary: {self.dimensions})",
                            extra={
                                **log_context,
                                "fallback_dimensions": actual_dims,
                                "primary_dimensions": self.dimensions,
                            }
                        )
                        # Don't raise error for fallback dimension mismatch - just log
                        if self._telemetry:
                            self._telemetry.record_dimension_mismatch(
                                provider=fallback_name,
                                model=fallback_model,
                                expected_dimensions=self.dimensions,
                                actual_dimensions=actual_dims,
                            )

                    # Log fallback success
                    fallback_name = fallback.get_provider_name()
                    fallback_model = fallback.get_model_name()
                    logger.info(
                        f"Embedding generated using fallback ({fallback_name}) in {elapsed_ms:.2f}ms",
                        extra={
                            **log_context,
                            "latency_ms": elapsed_ms,
                            "provider_used": fallback_name,
                            "fallback_from": provider_name,
                        }
                    )

                    # Telemetry
                    if self._telemetry:
                        cost = fallback.estimate_cost(text)
                        self._telemetry.record_success(
                            provider=fallback_name,
                            model=fallback_model,
                            dimensions=len(embedding),
                            latency_ms=elapsed_ms,
                            text_length=len(text),
                            cost=cost,
                        )

                    return embedding

                except Exception as fallback_exc:
                    last_error = fallback_exc
                    fallback_name = fallback.get_provider_name()
                    error_class = self._classify_error(fallback_exc)

                    logger.warning(
                        f"Fallback provider ({fallback_name}) failed: {error_class}",
                        exc_info=False,
                        extra={
                            **log_context,
                            "error_type": error_class.__name__,
                            "error": str(fallback_exc),
                        }
                    )

            # All providers failed
            elapsed_ms = (time.perf_counter() - start_time) * 1000

            logger.error(
                "All embedding providers failed",
                exc_info=True,
                extra={**log_context, "latency_ms": elapsed_ms}
            )

            # Telemetry
            if self._telemetry:
                self._telemetry.record_error(
                    provider=provider_name,
                    model=model_name,
                    error_type=self._classify_error(last_error).__name__ if last_error else "unknown",
                    latency_ms=elapsed_ms,
                    text_length=len(text),
                    error_message=str(last_error) if last_error else "All providers failed",
                )

            raise EmbeddingError(
                f"All embedding providers failed. Last error: {last_error}"
            ) from last_error

    def _build_log_context(self, text: str) -> Dict[str, Any]:
        """Build structured log context for embedding operation."""
        provider_name = self._primary_provider.get_provider_name() if self._primary_provider else "unknown"
        model_name = self._primary_provider.get_model_name() if self._primary_provider else "unknown"

        return {
            "provider": provider_name,
            "model": model_name,
            "dimensions": self.dimensions,
            "text_length": len(text),
            "text_hash": hashlib.sha256(text.encode()).hexdigest()[:8],  # Privacy-safe
        }

    def _classify_error(self, exc: Exception) -> type[EmbeddingProviderError]:
        """Classify exception for better observability."""
        from .exceptions import (
            EmbeddingAuthenticationError,
            EmbeddingNetworkError,
            EmbeddingQuotaExceededError,
            EmbeddingRateLimitError,
            EmbeddingTimeoutError,
            EmbeddingProviderError,
        )

        exc_str = str(exc).lower()

        if "401" in exc_str or "unauthorized" in exc_str or "authentication" in exc_str:
            return EmbeddingAuthenticationError
        elif "403" in exc_str or "forbidden" in exc_str:
            return EmbeddingAuthenticationError
        elif "429" in exc_str or "rate limit" in exc_str:
            return EmbeddingRateLimitError
        elif "timeout" in exc_str or "timed out" in exc_str:
            return EmbeddingTimeoutError
        elif "quota" in exc_str or "insufficient" in exc_str:
            return EmbeddingQuotaExceededError
        elif "network" in exc_str or "connection" in exc_str:
            return EmbeddingNetworkError
        else:
            return EmbeddingProviderError

    def _validate_dimensions(
        self,
        embedding: List[float],
        log_context: Dict[str, Any],
        expected: Optional[int] = None,
    ):
        """Validate embedding dimensions.

        Args:
            embedding: Generated embedding vector
            log_context: Log context for structured logging
            expected: Expected dimensions (defaults to self.dimensions)
        """
        expected_dims = expected or self.dimensions
        actual_dims = len(embedding)

        if actual_dims != expected_dims:
            provider_name = self._primary_provider.get_provider_name() if self._primary_provider else "unknown"
            model_name = self._primary_provider.get_model_name() if self._primary_provider else "unknown"

            logger.warning(
                f"Dimension mismatch: expected {expected_dims}, got {actual_dims}",
                extra={
                    **log_context,
                    "expected_dimensions": expected_dims,
                    "actual_dimensions": actual_dims,
                    "provider": provider_name,
                    "model": model_name,
                }
            )

            # Telemetry
            if self._telemetry:
                self._telemetry.record_dimension_mismatch(
                    provider=provider_name,
                    model=model_name,
                    expected_dimensions=expected_dims,
                    actual_dimensions=actual_dims,
                )

            # Strict mode: raise error if enabled
            if os.getenv("EMBEDDING_STRICT_DIMENSIONS", "false").lower() == "true":
                raise EmbeddingDimensionMismatchError(
                    expected=expected_dims,
                    actual=actual_dims,
                    provider=provider_name,
                    model=model_name,
                )

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts.

        Args:
            texts: List of texts to embed

        Returns:
            List of embedding vectors
        """
        # Use provider's batch method if available, otherwise sequential
        if self._primary_provider:
            return self._primary_provider.embed_batch(texts)

        # Fallback to sequential
        return [self.embed(text) for text in texts]

    def get_provider_info(self) -> Dict[str, Any]:
        """Return information about the current embedding provider and fallbacks."""
        primary_info = {}
        if self._primary_provider:
            primary_info = {
                "provider": self._primary_provider.get_provider_name(),
                "model": self._primary_provider.get_model_name(),
                "dimensions": self._primary_provider.get_dimensions(),
            }

        fallback_info = []
        for fallback in self._fallback_providers:
            fallback_info.append({
                "provider": fallback.get_provider_name(),
                "model": fallback.get_model_name(),
                "dimensions": fallback.get_dimensions(),
            })

        return {
            **primary_info,
            "fallbacks": fallback_info,
            "has_voyage": self._voyage_provider is not None,
            "has_openai": self._openai_provider is not None,
            "has_deterministic": self._deterministic_provider is not None,
        }

    def estimate_cost(self, text: str) -> float:
        """Estimate cost for embedding generation.

        Args:
            text: Text to estimate cost for

        Returns:
            Estimated cost in USD
        """
        if self._primary_provider:
            return self._primary_provider.estimate_cost(text)
        return 0.0

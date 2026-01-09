"""
Embedding service for SkillBuilder pipeline.

Primary Provider: Voyage AI (Anthropic's recommended embedding provider)
Fallback: OpenAI text-embedding-3-large
Offline: Deterministic hash-based vectors for testing

Environment variables:
- VOYAGE_API_KEY: Voyage AI API key (primary)
- OPENAI_API_KEY: OpenAI API key (fallback)
- EMBEDDING_PROVIDER: Force provider ("voyage", "openai", "deterministic")
"""
import hashlib
import json
import logging
import os
import urllib.request
import urllib.error
from typing import List, Optional

import numpy as np

logger = logging.getLogger(__name__)

# === Voyage AI Client ===

_VOYAGE_AVAILABLE = False
try:
    import voyageai
    _VOYAGE_AVAILABLE = True
except ImportError:
    voyageai = None  # type: ignore


def _call_voyage_http(text: str, api_key: str, model: str = "voyage-3") -> Optional[List[float]]:
    """HTTP fallback for Voyage AI without SDK."""
    url = "https://api.voyageai.com/v1/embeddings"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    data = {
        "model": model,
        "input": [text]
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers=headers,
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            result = json.loads(response.read().decode("utf-8"))
            return result["data"][0]["embedding"]
    except Exception as e:
        logger.warning(f"Voyage HTTP call failed: {e}")
        return None


# === OpenAI Client (Fallback) ===

_OPENAI_AVAILABLE = False
try:
    from openai import OpenAI
    _OPENAI_AVAILABLE = True
except ImportError:
    OpenAI = None  # type: ignore


class EmbeddingService:
    """
    Embedding service with Voyage AI as primary, OpenAI as fallback, deterministic for offline.

    Provider priority:
    1. Voyage AI (if VOYAGE_API_KEY is set) - Anthropic's recommended provider
    2. OpenAI (if OPENAI_API_KEY is set) - Fallback
    3. Deterministic hash-based (for tests/offline)
    """

    def __init__(
        self,
        model: str = "voyage-3",
        dimensions: int = 1024,
        fallback_model: str = "text-embedding-3-large",
        fallback_dimensions: int = 3072,
    ) -> None:
        """
        Initialize embedding service.

        Args:
            model: Voyage AI model name (default: voyage-3)
            dimensions: Voyage embedding dimensions (default: 1024)
            fallback_model: OpenAI fallback model name
            fallback_dimensions: OpenAI fallback dimensions
        """
        self.model = model
        self.dimensions = dimensions
        self.fallback_model = fallback_model
        self.fallback_dimensions = fallback_dimensions

        # Initialize clients
        self._voyage_client = None
        self._openai_client = None
        self._provider = None

        # Check for forced provider override
        forced_provider = os.getenv("EMBEDDING_PROVIDER", "").lower()
        if forced_provider == "deterministic":
            self._provider = "deterministic"
            logger.info("Embedding provider: deterministic (forced)")
            return

        # Try Voyage AI first (primary)
        voyage_api_key = os.getenv("VOYAGE_API_KEY")
        if voyage_api_key and (forced_provider in ("", "voyage")):
            if _VOYAGE_AVAILABLE:
                try:
                    self._voyage_client = voyageai.Client(api_key=voyage_api_key)
                    self._provider = "voyage"
                    logger.info(f"Embedding provider: Voyage AI ({model})")
                except Exception as e:
                    logger.warning(f"Voyage AI client init failed: {e}")
            else:
                # Use HTTP fallback
                self._voyage_api_key = voyage_api_key
                self._provider = "voyage_http"
                logger.info(f"Embedding provider: Voyage AI HTTP ({model})")

        # Try OpenAI as fallback
        if self._provider is None:
            openai_api_key = os.getenv("OPENAI_API_KEY") or os.getenv("GPT_API_KEY")
            if openai_api_key and _OPENAI_AVAILABLE and (forced_provider in ("", "openai")):
                try:
                    self._openai_client = OpenAI(api_key=openai_api_key)
                    self._provider = "openai"
                    self.dimensions = self.fallback_dimensions
                    self.model = self.fallback_model
                    logger.info(f"Embedding provider: OpenAI fallback ({self.fallback_model})")
                except Exception as e:
                    logger.warning(f"OpenAI client init failed: {e}")

        # No implicit deterministic fallback
        if self._provider is None:
            raise RuntimeError(
                "No embedding provider available (set VOYAGE_API_KEY or OPENAI_API_KEY, or force EMBEDDING_PROVIDER=deterministic for tests)."
            )

    def embed(self, text: str) -> List[float]:
        """
        Generate embedding for text.

        Provider priority:
        1. Voyage AI (primary - Anthropic's recommended)
        2. OpenAI (fallback)
        3. Deterministic hash-based (for tests/offline)
        """
        # Voyage AI SDK
        if self._provider == "voyage" and self._voyage_client:
            try:
                result = self._voyage_client.embed([text], model=self.model)
                return result.embeddings[0]
            except Exception as exc:
                logger.warning(f"Voyage AI embedding failed, trying fallback: {exc}")

        # Voyage AI HTTP
        if self._provider == "voyage_http":
            api_key = getattr(self, "_voyage_api_key", os.getenv("VOYAGE_API_KEY", ""))
            if api_key:
                result = _call_voyage_http(text, api_key, self.model)
                if result:
                    return result
                logger.warning("Voyage HTTP embedding failed, trying fallback")

        # OpenAI fallback
        if self._openai_client:
            try:
                resp = self._openai_client.embeddings.create(
                    model=self.fallback_model,
                    input=text,
                    dimensions=self.fallback_dimensions
                )
                return resp.data[0].embedding
            except Exception as exc:
                logger.warning(f"OpenAI embedding failed, using deterministic: {exc}")

        if self._provider == "deterministic":
            return self._deterministic_embed(text)

        raise RuntimeError("Embedding failed after provider attempts; aborting instead of downgrading.")

    def _deterministic_embed(self, text: str) -> List[float]:
        """Generate deterministic embedding for offline/test mode."""
        h = hashlib.sha256(text.encode("utf-8")).hexdigest()
        seed = int(h[:8], 16)
        rng = np.random.default_rng(seed)
        vec = rng.random(self.dimensions, dtype=np.float32)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec.tolist()

    def get_provider_info(self) -> dict:
        """Return information about the current embedding provider."""
        return {
            "provider": self._provider,
            "model": self.model,
            "dimensions": self.dimensions,
            "has_voyage": self._voyage_client is not None or self._provider == "voyage_http",
            "has_openai": self._openai_client is not None,
        }

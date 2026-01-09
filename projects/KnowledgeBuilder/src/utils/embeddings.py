"""
Embedding service for KnowledgeBuilder pipeline.

This module provides a backward-compatible wrapper around the shared embedding service.
New code should import directly from shared.embedding for full functionality.

Deprecated: Import from shared.embedding instead for full functionality.
"""

import logging
import sys
from pathlib import Path
from typing import List, Optional

# Add shared directory to path for imports
# Go up from: projects/KnowledgeBuilder/src/utils/embeddings.py
# To: Chrysalis/shared/
# Path structure: Chrysalis/projects/KnowledgeBuilder/src/utils/embeddings.py
# parents[0] = utils, [1] = src, [2] = KnowledgeBuilder, [3] = projects, [4] = Chrysalis
PROJECT_ROOT = Path(__file__).resolve().parents[4]  # Go up 4 levels to project root
SHARED_PATH = PROJECT_ROOT / "shared"
# Add both the shared directory and its parent (for 'shared' module import)
if str(SHARED_PATH.parent) not in sys.path:
    sys.path.insert(0, str(SHARED_PATH.parent))
if str(SHARED_PATH) not in sys.path:
    sys.path.insert(0, str(SHARED_PATH))

logger = logging.getLogger(__name__)

# Import from shared library
try:
    from shared.embedding import EmbeddingService as _EmbeddingService, EmbeddingTelemetry
    from shared.embedding.exceptions import EmbeddingError

    # Re-export for backward compatibility
    class EmbeddingService(_EmbeddingService):
        """
        Embedding service wrapper for backward compatibility.

        This class wraps the shared EmbeddingService to maintain backward compatibility
        with existing KnowledgeBuilder code. All functionality is delegated to the
        shared implementation.

        For new code, import directly from shared.embedding:
            from shared.embedding import EmbeddingService, EmbeddingTelemetry
        """

        def __init__(
            self,
            model: str = "voyage-3",
            dimensions: int = 1024,
            fallback_model: str = "text-embedding-3-large",
            fallback_dimensions: int = 3072,
            telemetry: Optional[EmbeddingTelemetry] = None,
        ):
            """
            Initialize embedding service (backward compatible wrapper).

            Args:
                model: Voyage AI model name (default: voyage-3)
                dimensions: Voyage embedding dimensions (default: 1024)
                fallback_model: OpenAI fallback model name
                fallback_dimensions: OpenAI fallback dimensions
                telemetry: Optional telemetry adapter
            """
            # Get forced provider from env if set
            import os
            forced_provider = os.getenv("EMBEDDING_PROVIDER", "").lower()
            if not forced_provider:
                forced_provider = None

            super().__init__(
                model=model,
                dimensions=dimensions,
                fallback_model=fallback_model,
                fallback_dimensions=fallback_dimensions,
                telemetry=telemetry,
                forced_provider=forced_provider,
            )

            # Expose _provider for backward compatibility with old tests
            # Map new provider info to old _provider format
            provider_info = self.get_provider_info()
            provider_name = provider_info.get("provider", "unknown")
            if provider_name == "voyage":
                # Check if using HTTP fallback
                if self._voyage_provider and hasattr(self._voyage_provider, '_use_http') and self._voyage_provider._use_http:
                    self._provider = "voyage_http"
                else:
                    self._provider = "voyage"
            elif provider_name == "openai":
                self._provider = "openai"
            elif provider_name == "deterministic":
                self._provider = "deterministic"
            else:
                self._provider = provider_name

            # Expose old-style client references for backward compatibility
            self._voyage_client = getattr(self._voyage_provider, '_client', None) if self._voyage_provider else None
            self._openai_client = getattr(self._openai_provider, '_client', None) if self._openai_provider else None

    # Re-export exceptions for backward compatibility
    EmbeddingError = EmbeddingError

except ImportError as e:
    logger.error(f"Failed to import shared embedding service: {e}")
    logger.error("Falling back to deprecated local implementation")

    # Fallback to old implementation if shared library not available
    # This should only happen during transition
    import hashlib
    import json
    import os
    import urllib.request
    import urllib.error
    from typing import List, Optional

    import numpy as np

    # Old implementation as fallback (deprecated)
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

    _OPENAI_AVAILABLE = False
    try:
        from openai import OpenAI
        _OPENAI_AVAILABLE = True
    except ImportError:
        OpenAI = None  # type: ignore

    class EmbeddingService:
        """Fallback implementation (deprecated)."""

        def __init__(
            self,
            model: str = "voyage-3",
            dimensions: int = 1024,
            fallback_model: str = "text-embedding-3-large",
            fallback_dimensions: int = 3072,
        ):
            logger.warning("Using deprecated fallback EmbeddingService implementation")
            self.model = model
            self.dimensions = dimensions
            self.fallback_model = fallback_model
            self.fallback_dimensions = fallback_dimensions
            self._voyage_client = None
            self._openai_client = None
            self._provider = None

            forced_provider = os.getenv("EMBEDDING_PROVIDER", "").lower()
            if forced_provider == "deterministic":
                self._provider = "deterministic"
                return

            voyage_api_key = os.getenv("VOYAGE_API_KEY")
            if voyage_api_key and (forced_provider in ("", "voyage")):
                if _VOYAGE_AVAILABLE:
                    try:
                        self._voyage_client = voyageai.Client(api_key=voyage_api_key)
                        self._provider = "voyage"
                    except Exception as e:
                        logger.warning(f"Voyage AI client init failed: {e}")
                else:
                    self._voyage_api_key = voyage_api_key
                    self._provider = "voyage_http"

            if self._provider is None:
                openai_api_key = os.getenv("OPENAI_API_KEY") or os.getenv("GPT_API_KEY")
                if openai_api_key and _OPENAI_AVAILABLE and (forced_provider in ("", "openai")):
                    try:
                        self._openai_client = OpenAI(api_key=openai_api_key)
                        self._provider = "openai"
                        self.dimensions = self.fallback_dimensions
                        self.model = self.fallback_model
                    except Exception as e:
                        logger.warning(f"OpenAI client init failed: {e}")

            if self._provider is None:
                raise RuntimeError(
                    "No embedding provider available (set VOYAGE_API_KEY or OPENAI_API_KEY, "
                    "or force EMBEDDING_PROVIDER=deterministic for tests)."
                )

        def embed(self, text: str) -> List[float]:
            """Generate embedding (fallback implementation)."""
            if self._provider == "voyage" and self._voyage_client:
                try:
                    result = self._voyage_client.embed([text], model=self.model)
                    return result.embeddings[0]
                except Exception as exc:
                    logger.warning(f"Voyage AI embedding failed, trying fallback: {exc}")

            if self._provider == "voyage_http":
                api_key = getattr(self, "_voyage_api_key", os.getenv("VOYAGE_API_KEY", ""))
                if api_key:
                    result = _call_voyage_http(text, api_key, self.model)
                    if result:
                        return result
                    logger.warning("Voyage HTTP embedding failed, trying fallback")

            if self._openai_client:
                try:
                    resp = self._openai_client.embeddings.create(
                        model=self.fallback_model,
                        input=text,
                        dimensions=self.fallback_dimensions
                    )
                    return resp.data[0].embedding
                except Exception as exc:
                    logger.warning(f"OpenAI embedding failed: {exc}")

            if self._provider == "deterministic":
                return self._deterministic_embed(text)

            raise RuntimeError("Embedding failed after provider attempts; aborting instead of downgrading.")

        def _deterministic_embed(self, text: str) -> List[float]:
            """Generate deterministic embedding."""
            h = hashlib.sha256(text.encode("utf-8")).hexdigest()
            seed = int(h[:8], 16)
            rng = np.random.default_rng(seed)
            vec = rng.random(self.dimensions, dtype=np.float32)
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm
            return vec.tolist()

        def get_provider_info(self) -> dict:
            """Return provider information."""
            return {
                "provider": self._provider,
                "model": self.model,
                "dimensions": self.dimensions,
                "has_voyage": self._voyage_client is not None or self._provider == "voyage_http",
                "has_openai": self._openai_client is not None,
            }

    class EmbeddingError(Exception):
        """Base embedding error."""
        pass

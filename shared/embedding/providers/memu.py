import os
import logging
from typing import List, Optional

import requests

from .base import EmbeddingProvider
from ..exceptions import (
    EmbeddingAuthenticationError,
    EmbeddingNetworkError,
    EmbeddingQuotaExceededError,
    EmbeddingRateLimitError,
    EmbeddingTimeoutError,
    EmbeddingProviderError,
)

logger = logging.getLogger(__name__)


class MemuProvider(EmbeddingProvider):
    """
    Memu (Nevamind) embedding provider.

    Expects MEMU_API_KEY and MEMU_ENDPOINT (default: https://api.memu.ai/v1/embeddings).
    Response is expected to include an embedding array; dimensions are inferred from response.
    """

    DEFAULT_ENDPOINT = "https://api.memu.ai/v1/embeddings"
    DEFAULT_MODEL = "memu-embed-v1"

    def __init__(
        self,
        api_key: Optional[str] = None,
        endpoint: Optional[str] = None,
        model: str = DEFAULT_MODEL,
    ):
        self._api_key = api_key or os.getenv("MEMU_API_KEY")
        if not self._api_key:
            raise ValueError("Memu API key required (set MEMU_API_KEY)")
        self._endpoint = endpoint or os.getenv("MEMU_ENDPOINT") or self.DEFAULT_ENDPOINT
        self._model = model
        self._dimensions: Optional[int] = None

    def embed(self, text: str) -> List[float]:
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        payload = {"model": self._model, "input": text}
        try:
            resp = requests.post(self._endpoint, headers=headers, json=payload, timeout=30)
            if resp.status_code == 401 or resp.status_code == 403:
                raise EmbeddingAuthenticationError(f"Memu auth failed: {resp.text}")
            if resp.status_code == 429:
                raise EmbeddingRateLimitError(f"Memu rate limited: {resp.text}")
            if resp.status_code == 408:
                raise EmbeddingTimeoutError(f"Memu timeout: {resp.text}")
            if resp.status_code == 402:
                raise EmbeddingQuotaExceededError(f"Memu quota exceeded: {resp.text}")
            if resp.status_code >= 500:
                raise EmbeddingNetworkError(f"Memu server error: {resp.text}")
            resp.raise_for_status()
        except (EmbeddingProviderError, EmbeddingAuthenticationError, EmbeddingRateLimitError,
                EmbeddingTimeoutError, EmbeddingQuotaExceededError, EmbeddingNetworkError):
            raise
        except Exception as exc:
            raise EmbeddingProviderError(f"Memu request failed: {exc}") from exc

        try:
            data = resp.json()
            # Accept either {data:[{embedding:[]}]}, {embedding:[]}, or {vector:[]}
            if isinstance(data, dict):
                if "data" in data and isinstance(data["data"], list) and data["data"]:
                    embedding = data["data"][0].get("embedding") or data["data"][0].get("vector")
                else:
                    embedding = data.get("embedding") or data.get("vector")
            else:
                embedding = None
            if not embedding or not isinstance(embedding, list):
                raise EmbeddingProviderError(f"Memu response missing embedding: {data}")
            self._dimensions = len(embedding)
            return embedding
        except Exception as exc:
            raise EmbeddingProviderError(f"Memu parse failed: {exc}") from exc

    def get_dimensions(self) -> int:
        if self._dimensions:
            return self._dimensions
        # Fallback if not set yet
        return int(os.getenv("MEMU_DIMENSIONS") or 1024)

    def get_provider_name(self) -> str:
        return "memu"

    def get_model_name(self) -> str:
        return self._model

    def estimate_cost(self, text: str) -> float:
        # Unknown cost model; return 0.0 as placeholder
        return 0.0
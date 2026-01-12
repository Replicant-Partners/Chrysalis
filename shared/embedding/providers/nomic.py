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


class NomicProvider(EmbeddingProvider):
    """
    Nomic embedding provider.

    Expects NOMIC_API_KEY (required) and optional NOMIC_API_BASE (default https://api.nomic.ai/v1).
    Supports a configurable model via NOMIC_MODEL (default: nomic-embed-text-v1).
    """

    DEFAULT_API_BASE = "https://api.nomic.ai/v1"
    DEFAULT_MODEL = "nomic-embed-text-v1"

    def __init__(
        self,
        api_key: Optional[str] = None,
        api_base: Optional[str] = None,
        model: str = DEFAULT_MODEL,
        dimensions: Optional[int] = None,
    ):
        self._api_key = api_key or os.getenv("NOMIC_API_KEY")
        if not self._api_key:
            raise ValueError("Nomic API key required (set NOMIC_API_KEY)")
        self._api_base = api_base or os.getenv("NOMIC_API_BASE") or self.DEFAULT_API_BASE
        self._model = model or os.getenv("NOMIC_MODEL") or self.DEFAULT_MODEL
        self._dimensions = dimensions  # If None, will be inferred from first response

    def embed(self, text: str) -> List[float]:
        url = f"{self._api_base.rstrip('/')}/embed"
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self._model,
            "input": [text],
        }
        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=30)
            if resp.status_code in (401, 403):
                raise EmbeddingAuthenticationError(f"Nomic auth failed: {resp.text}")
            if resp.status_code == 429:
                raise EmbeddingRateLimitError(f"Nomic rate limited: {resp.text}")
            if resp.status_code == 408:
                raise EmbeddingTimeoutError(f"Nomic timeout: {resp.text}")
            if resp.status_code == 402:
                raise EmbeddingQuotaExceededError(f"Nomic quota exceeded: {resp.text}")
            if resp.status_code >= 500:
                raise EmbeddingNetworkError(f"Nomic server error: {resp.text}")
            resp.raise_for_status()
        except (
            EmbeddingProviderError,
            EmbeddingAuthenticationError,
            EmbeddingRateLimitError,
            EmbeddingTimeoutError,
            EmbeddingQuotaExceededError,
            EmbeddingNetworkError,
        ):
            raise
        except Exception as exc:
            raise EmbeddingProviderError(f"Nomic request failed: {exc}") from exc

        try:
            data = resp.json()
            # Accept shapes: {data:[{embedding:[]}]}, {embedding:[[]]}, {embedding:[]}
            embedding: Optional[List[float]] = None
            if isinstance(data, dict):
                if "data" in data and isinstance(data["data"], list) and data["data"]:
                    first = data["data"][0]
                    if isinstance(first, dict):
                        embedding = first.get("embedding") or first.get("vector")
                if embedding is None:
                    emb_field = data.get("embedding") or data.get("vector")
                    if isinstance(emb_field, list):
                        # Some responses may wrap embedding in a list of lists
                        if emb_field and isinstance(emb_field[0], list):
                            embedding = emb_field[0]
                        else:
                            embedding = emb_field
            if not embedding or not isinstance(embedding, list):
                raise EmbeddingProviderError(f"Nomic response missing embedding: {data}")
            self._dimensions = len(embedding)
            return embedding
        except Exception as exc:
            raise EmbeddingProviderError(f"Nomic parse failed: {exc}") from exc

    def get_dimensions(self) -> int:
        if self._dimensions:
            return self._dimensions
        # Default to known Nomic text embedding dim (768) if unspecified
        return int(os.getenv("NOMIC_DIMENSIONS") or 768)

    def get_provider_name(self) -> str:
        return "nomic"

    def get_model_name(self) -> str:
        return self._model

    def estimate_cost(self, text: str) -> float:
        # Nomic public pricing not embedded; return 0 as placeholder
        return 0.0
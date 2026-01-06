import hashlib
import logging
import os
from typing import List

import numpy as np

logger = logging.getLogger(__name__)

try:
    from openai import OpenAI

    _OPENAI_AVAILABLE = True
except ImportError:  # pragma: no cover - optional dependency
    _OPENAI_AVAILABLE = False
    OpenAI = None  # type: ignore


class EmbeddingService:
    """
    Embedding helper with OpenAI if available, deterministic fallback otherwise.
    """

    def __init__(self, model: str = "text-embedding-3-large", dimensions: int = 3072) -> None:
        self.model = model
        self.dimensions = dimensions
        self._client = None

        api_key = os.getenv("OPENAI_API_KEY") or os.getenv("GPT_API_KEY")
        if _OPENAI_AVAILABLE and api_key:
            self._client = OpenAI(api_key=api_key)

    def embed(self, text: str) -> List[float]:
        """
        Generate embedding for text.

        - Uses OpenAI if available and API key set.
        - Falls back to deterministic hash-based vector (for tests/offline).
        """
        if self._client:
            try:
                resp = self._client.embeddings.create(model=self.model, input=text, dimensions=self.dimensions)
                return resp.data[0].embedding  # type: ignore[attr-defined]
            except Exception as exc:  # pragma: no cover - network errors
                logger.warning("OpenAI embedding failed, using fallback: %s", exc)

        # Deterministic fallback: hash -> seed -> random vector
        h = hashlib.sha256(text.encode("utf-8")).hexdigest()
        seed = int(h[:8], 16)
        rng = np.random.default_rng(seed)
        vec = rng.random(self.dimensions, dtype=np.float32)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec.tolist()

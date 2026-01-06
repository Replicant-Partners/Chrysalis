import difflib
import math
import os
from typing import Dict, List, Optional

try:
    from openai import OpenAI  # optional
except ImportError:  # pragma: no cover
    OpenAI = None


class SemanticMerger:
    """
    Lightweight semantic merge to deduplicate/reduce snippet lists.
    - Default: difflib ratio on lowercased text.
    - Optional: embedding cosine (OpenAI) if MERGE_USE_EMBEDDINGS=1 and key available.
    """

    def __init__(self, similarity_threshold: float = 0.78) -> None:
        self.similarity_threshold = similarity_threshold
        self.use_embeddings = bool(int(os.getenv("MERGE_USE_EMBEDDINGS", "0")))
        self.client: Optional[OpenAI] = None
        if self.use_embeddings and OpenAI and os.getenv("OPENAI_API_KEY"):
            try:
                self.client = OpenAI()
            except Exception:
                self.client = None

    def merge(self, snippets: List[Dict[str, str]], limit: int) -> Dict[str, object]:
        merged: List[Dict[str, str]] = []
        dropped = 0
        for snip in snippets:
            text = (snip.get("snippet") or "").strip()
            if not text:
                continue
            lc = text.lower()
            duplicate = False
            for kept in merged:
                kept_text = (kept.get("snippet") or "").strip().lower()
                if not kept_text:
                    continue
                sim = (
                    self._cosine_embed(kept_text, lc)
                    if self.client
                    else difflib.SequenceMatcher(None, lc, kept_text).ratio()
                )
                if sim >= self.similarity_threshold:
                    duplicate = True
                    dropped += 1
                    break
            if not duplicate:
                merged.append(snip)
            if len(merged) >= limit:
                break
        return {
            "merged": merged,
            "input_count": len(snippets),
            "output_count": len(merged),
            "dropped": dropped,
            "threshold": self.similarity_threshold,
            "use_embeddings": bool(self.client),
        }

    def _cosine_embed(self, a: str, b: str) -> float:
        """
        Simple fallback: if embeddings unavailable, fall back to diff ratio.
        If available, use OpenAI embedding cosine.
        """
        if not self.client:
            return difflib.SequenceMatcher(None, a, b).ratio()
        try:
            vecs = self.client.embeddings.create(
                model=os.getenv("MERGE_EMBED_MODEL", "text-embedding-3-small"),
                input=[a, b],
            ).data
            v1 = vecs[0].embedding
            v2 = vecs[1].embedding
            return self._cosine(v1, v2)
        except Exception:
            return difflib.SequenceMatcher(None, a, b).ratio()

    @staticmethod
    def _cosine(v1, v2) -> float:
        dot = sum(x * y for x, y in zip(v1, v2))
        n1 = math.sqrt(sum(x * x for x in v1))
        n2 = math.sqrt(sum(x * x for x in v2))
        if n1 == 0 or n2 == 0:
            return 0.0
        return dot / (n1 * n2)

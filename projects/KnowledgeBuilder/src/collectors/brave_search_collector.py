import logging
import os
from typing import Dict, List, Optional, Tuple

import requests

logger = logging.getLogger(__name__)


class BraveSearchCollector:
    """
    Minimal Brave Search collector for MVP.

    Note: This is a simplified extractor; for production, augment with LLM-based parsing.
    """

    BASE_URL = "https://api.search.brave.com/res/v1/web/search"

    def __init__(self, api_key: Optional[str] = None, timeout: int = 10) -> None:
        self.api_key = api_key or os.getenv("BRAVE_API_KEY")
        if not self.api_key:
            raise ValueError("BRAVE_API_KEY is required for BraveSearchCollector")
        self.timeout = timeout

    def collect(self, identifier: str, entity_type: Optional[str] = None) -> Dict:
        """Collect basic facts via Brave Search with URL capture."""
        query = self._build_query(identifier, entity_type)
        response = requests.get(
            self.BASE_URL,
            headers={"X-Subscription-Token": self.api_key},
            params={"q": query, "count": 5},
            timeout=self.timeout,
        )
        response.raise_for_status()
        data = response.json()

        attributes, urls = self._extract_attributes(data)
        return {
            "source": "brave_search",
            "attributes": attributes,
            "urls": urls,
            "confidence": 0.7,
            "cost": 0.001,
        }

    def _build_query(self, identifier: str, entity_type: Optional[str]) -> str:
        parts = [identifier]
        if entity_type:
            parts.append(entity_type)
        parts.append("facts biography profile")
        return " ".join(parts)

    def _extract_attributes(self, data: Dict) -> Tuple[Dict, List[str]]:
        """Simple heuristic extraction from search snippets."""
        results: List[Dict] = data.get("web", {}).get("results", [])
        attributes: Dict[str, str] = {}
        urls: List[str] = []
        for result in results:
            snippet = result.get("description", "") or ""
            title = result.get("title", "") or ""
            url = result.get("url", "") or ""
            if url:
                urls.append(url)
            if snippet:
                # Store first snippet as summary if not already set
                attributes.setdefault("summary", snippet)
            if "official" in title.lower():
                attributes.setdefault("official_site", url)
        return attributes, urls

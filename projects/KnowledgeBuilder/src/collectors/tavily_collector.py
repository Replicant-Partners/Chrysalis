import logging
import os
from typing import Dict, List, Optional, Tuple

import requests

logger = logging.getLogger(__name__)


class TavilyCollector:
    """
    Tavily search collector (basic).
    Requires TAVILY_API_KEY in environment.
    """

    BASE_URL = "https://api.tavily.com/search"

    def __init__(self, api_key: Optional[str] = None, timeout: int = 15) -> None:
        self.api_key = api_key or os.getenv("TAVILY_API_KEY")
        if not self.api_key:
            raise ValueError("TAVILY_API_KEY is required for TavilyCollector")
        self.timeout = timeout

    def collect(self, query: str, entity_type: Optional[str] = None, max_results: int = 10) -> Dict:
        payload = {
            "query": query if not entity_type else f"{query} {entity_type}",
            "max_results": max_results,
            "search_depth": "advanced",  # go deeper per user request
        }
        # Tavily docs: use Authorization: Bearer <key> (some versions accept Tavily-Key)
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        resp = requests.post(self.BASE_URL, json=payload, headers=headers, timeout=self.timeout)
        resp.raise_for_status()
        data = resp.json()
        attributes, urls, snippets = self._extract(data)
        return {
            "source": "tavily",
            "attributes": attributes,
            "urls": urls,
            "snippets": snippets,
            "confidence": 0.6,
            "cost": 0.06,
        }

    def _extract(self, data: Dict) -> Tuple[Dict, List[str], List[Dict[str, str]]]:
        attrs: Dict[str, str] = {}
        urls: List[str] = []
        snippets: List[Dict[str, str]] = []
        results: List[Dict] = data.get("results", []) or []
        for res in results:
            url = res.get("url") or ""
            if url:
                urls.append(url)
            snippet = res.get("content") or res.get("snippet") or ""
            title = res.get("title") or ""
            if snippet:
                snippets.append({"title": title, "url": url, "snippet": snippet})
            if snippet and "summary" not in attrs:
                attrs["summary"] = snippet
        return attrs, urls, snippets

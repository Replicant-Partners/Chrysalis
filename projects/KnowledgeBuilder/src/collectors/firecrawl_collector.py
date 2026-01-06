import logging
import os
from typing import Dict, List, Optional, Tuple

import requests

logger = logging.getLogger(__name__)


class FirecrawlCollector:
    """
    Firecrawl collector for targeted URLs.
    Requires FIRECRAWL_API_KEY in environment.
    """

    BASE_URL = "https://api.firecrawl.dev/v1/scrape"

    def __init__(self, api_key: Optional[str] = None, timeout: int = 20) -> None:
        self.api_key = api_key or os.getenv("FIRECRAWL_API_KEY")
        if not self.api_key:
            raise ValueError("FIRECRAWL_API_KEY is required for FirecrawlCollector")
        self.timeout = timeout

    def scrape(self, url: str) -> Dict:
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload = {"url": url, "formats": ["markdown"]}
        resp = requests.post(self.BASE_URL, json=payload, headers=headers, timeout=self.timeout)
        resp.raise_for_status()
        data = resp.json()
        # Firecrawl can return content under 'markdown' or 'text'
        content = data.get("markdown") or data.get("text") or ""
        attrs = {
            "page_text": content,
            "content_type": "text/markdown" if data.get("markdown") else "text/plain",
        }
        return {
            "source": "firecrawl",
            "attributes": attrs,
            "urls": [url],
            "confidence": 0.6,
            "cost": 0.04,
        }

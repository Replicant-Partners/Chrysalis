import logging
from typing import Dict, List, Optional

import os

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover
    OpenAI = None

logger = logging.getLogger(__name__)


class FactExtractor:
    """
    LLM-assisted fact extraction.
    Uses OpenAI by default; if unavailable, returns empty facts.
    """

    def __init__(self, model: str = "gpt-4o-mini", max_tokens: int = 768) -> None:
        self.model = model
        self.max_tokens = max_tokens
        api_key = os.getenv("OPENAI_API_KEY") or os.getenv("GPT_API_KEY")
        self.client = OpenAI(api_key=api_key) if (OpenAI and api_key) else None

    def extract(self, text: str, entity: str, entity_type: Optional[str] = None) -> Dict[str, List[Dict]]:
        if not self.client:
            return {}
        prompt = f"""
You are a structured fact extractor. Extract concise facts about the entity below.
Entity: {entity}
Type: {entity_type or 'Unknown'}

Text:
{text}

Return JSON with keys: papers, affiliations, books, talks, interviews.
Each item should include relevant fields (title/name, date/year, venue/org/url if present).
"""
        try:
            resp = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=self.max_tokens,
                temperature=0.2,
            )
            content = resp.choices[0].message.content
            import json

            cleaned = content.strip()
            # strip code fences if present
            if cleaned.startswith("```"):
                cleaned = cleaned.strip("`")
                if cleaned.startswith("json"):
                    cleaned = cleaned[4:]
            return json.loads(cleaned)
        except Exception as exc:  # pragma: no cover - network/LLM errors
            logger.warning("Fact extraction failed: %s", exc)
            return {}

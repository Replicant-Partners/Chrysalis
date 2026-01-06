import json
import logging
import os
from typing import Dict, Optional

logger = logging.getLogger(__name__)


class ContextEnricher:
    """
    Builds a short, structured context snippet to enrich search queries.
    Core truth: Schema.org-aligned type hints.
    """

    SCHEMA_HINTS = {
        "Person": "occupation affiliation alumni award sameAs officialWebsite publications biography",
        "Scientist": "researcher field affiliation publications citations grants awards",
        "Professor": "university faculty department courses publications cv biography",
        "Psychologist": "social psychology cognitive bias research publications university faculty",
        "CreativeWork": "author publisher datePublished sameAs genre about",
        "Book": "author isbn publisher datePublished awards reviews",
        "Organization": "founder leadership headquarters funding products services subsidiaries sameAs",
        "Corporation": "ticker funding revenue leadership products services subsidiaries",
        "Place": "location country geo climate population tourism conservation",
        "Event": "startDate endDate location organizers participants agenda",
        "MedicalCondition": "symptoms causes treatments prevalence guidelines",
        "Product": "brand model specs sku reviews price availability",
    }

    ALIASES = {
        "Professor": "Person",
        "Psychologist": "Person",
        "Scientist": "Person",
        "Researcher": "Person",
        "University": "Organization",
        "Company": "Organization",
        "City": "Place",
        "Country": "Place",
    }

    def __init__(self, max_chars: int = 220) -> None:
        self.max_chars = max_chars

    def enrich(self, identifier: str, entity_type: Optional[str], fallback_tags: Optional[list] = None) -> Optional[Dict[str, str]]:
        hint = None
        normalized_type = entity_type
        if entity_type in self.ALIASES:
            normalized_type = self.ALIASES[entity_type]

        if normalized_type and normalized_type in self.SCHEMA_HINTS:
            hint = self.SCHEMA_HINTS[normalized_type]
        elif normalized_type:
            # loose match on common roles
            for key, val in self.SCHEMA_HINTS.items():
                if key.lower() in normalized_type.lower():
                    hint = val
                    break

        if (not hint) and fallback_tags:
            hint = " ".join(fallback_tags)
        if not hint:
            return None

        context = f"{normalized_type or ''} {hint}"
        context = context[: self.max_chars]
        query = f"{identifier} {context}"
        return {
            "query": query,
            "schema_type": normalized_type or entity_type,
            "yago_label": None,
            "yago_confidence": 0.0,
            "fallback": True,
        }


def load_domain_rules_from_file(path: str) -> Dict[str, list]:
    if not os.path.exists(path):
        return {"allowlist": [], "blocklist": []}
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return {
            "allowlist": data.get("allowlist", []),
            "blocklist": data.get("blocklist", []),
        }
    except Exception as exc:  # pragma: no cover
        logger.warning("Failed to load domain rules from %s: %s", path, exc)
        return {"allowlist": [], "blocklist": []}

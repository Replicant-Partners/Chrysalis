"""
Calibration functions for skill confidence adjustment.

Uses external metrics (domain authority, citations, books) for non-gameable calibration.
"""

from __future__ import annotations

from typing import Any, Dict, List


def compute_external_calibration(
    exemplar_name: str,
    hits: List[Dict[str, Any]],
    book_data: List[Dict[str, Any]],
) -> Dict[str, float]:
    """
    Compute externally-calibrated metrics that cannot be gamed.
    
    Uses real-world signals:
    - Domain authority: Presence on authoritative domains (edu, gov, established orgs)
    - Citation density: Frequency of references across sources
    - Book impact: Number and diversity of published works
    - Cross-domain reach: Presence across different field domains
    
    Returns normalized scores (0-1) for each metric.
    """
    metrics = {
        "domain_authority": 0.0,
        "citation_density": 0.0,
        "book_impact": 0.0,
        "cross_domain_reach": 0.0,
        "overall_calibration": 0.0,
    }
    
    if not hits and not book_data:
        return metrics
    
    # Domain authority: Count hits from authoritative domains
    authority_domains = {".edu", ".gov", ".org", "wikipedia", "britannica", "scholar.google"}
    authority_hits = sum(
        1 for h in hits
        if any(d in h.get("url", "").lower() for d in authority_domains)
    )
    metrics["domain_authority"] = min(1.0, authority_hits / max(len(hits), 1) * 2)
    
    # Citation density: How often the exemplar name appears in snippets
    name_parts = exemplar_name.lower().split()
    mentions = sum(
        1 for h in hits
        if any(part in h.get("snippet", "").lower() for part in name_parts if len(part) > 2)
    )
    metrics["citation_density"] = min(1.0, mentions / max(len(hits), 1))
    
    # Book impact: Number and diversity of books
    if book_data:
        book_count = len(book_data)
        unique_themes = set()
        for book in book_data:
            themes = book.get("themes", [])
            if isinstance(themes, list):
                unique_themes.update(t.lower() for t in themes[:5] if isinstance(t, str))
        
        metrics["book_impact"] = min(1.0, book_count / 20)  # Normalize to 20 books max
        metrics["cross_domain_reach"] = min(1.0, len(unique_themes) / 10)  # Normalize to 10 themes
    
    # Overall calibration: Weighted average
    weights = {
        "domain_authority": 0.3,
        "citation_density": 0.25,
        "book_impact": 0.25,
        "cross_domain_reach": 0.2,
    }
    metrics["overall_calibration"] = sum(
        metrics[k] * w for k, w in weights.items()
    )
    
    return metrics


def adjust_confidence_with_calibration(
    skill_cards: List[Dict[str, Any]],
    calibration: Dict[str, float],
) -> List[Dict[str, Any]]:
    """
    Adjust skill confidence scores using external calibration.
    
    High calibration = boost confidence for well-evidenced skills.
    Low calibration = reduce confidence to reflect uncertainty.
    """
    overall = calibration.get("overall_calibration", 0.5)
    
    for card in skill_cards:
        base_confidence = card.get("confidence", 0.7)
        # Adjust: if overall calibration is high, boost confidence; if low, reduce
        adjusted = base_confidence * (0.5 + overall * 0.5)
        card["confidence"] = min(0.95, max(0.3, adjusted))
        card["calibration_score"] = overall
    
    return skill_cards

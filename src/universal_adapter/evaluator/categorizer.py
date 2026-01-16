"""
Response Categorizer

Evaluates LLM responses against defined criteria to determine
which category the response falls into, driving flow transitions.

Supports multiple matching strategies:
- Keyword matching (presence of specific terms)
- Pattern matching (regex)
- Semantic classification (LLM-based)
- JSON structure validation
- Custom predicates
"""

from __future__ import annotations
import re
import json
from dataclasses import dataclass, field
from typing import Any, Callable, Mapping, Sequence
from enum import Enum, auto


class MatchStrategy(Enum):
    """Strategy for matching responses to categories."""
    KEYWORD = auto()      # Match if keywords present
    PATTERN = auto()      # Match via regex pattern
    JSON_FIELD = auto()   # Match JSON field value
    NEGATION = auto()     # Match if keywords NOT present
    SEMANTIC = auto()     # LLM-based semantic classification
    PREDICATE = auto()    # Custom predicate function
    ALWAYS = auto()       # Always matches (default/fallback)


@dataclass(frozen=True)
class CategoryCriteria:
    """
    Criteria for matching a response to a category.

    Each category has a name and one or more matching rules.
    The first matching rule determines the category.
    """
    name: str
    strategy: MatchStrategy
    keywords: tuple[str, ...] = ()         # For KEYWORD/NEGATION
    pattern: str | None = None             # For PATTERN
    json_path: str | None = None           # For JSON_FIELD
    expected_value: Any = None             # For JSON_FIELD
    predicate: Callable[[str], bool] | None = None  # For PREDICATE
    case_sensitive: bool = False
    priority: int = 0                      # Higher priority checked first

    def __post_init__(self) -> None:
        if not self.name:
            raise ValueError("Category requires a name")

    def matches(self, response: str) -> bool:
        """Check if response matches this category's criteria."""
        if self.strategy == MatchStrategy.ALWAYS:
            return True

        if self.strategy == MatchStrategy.KEYWORD:
            return self._match_keywords(response)

        if self.strategy == MatchStrategy.NEGATION:
            return not self._match_keywords(response)

        if self.strategy == MatchStrategy.PATTERN:
            return self._match_pattern(response)

        if self.strategy == MatchStrategy.JSON_FIELD:
            return self._match_json_field(response)

        if self.strategy == MatchStrategy.PREDICATE:
            return self._match_predicate(response)

        return False

    def _match_keywords(self, response: str) -> bool:
        """Check if any keyword is present."""
        text = response if self.case_sensitive else response.lower()
        for keyword in self.keywords:
            kw = keyword if self.case_sensitive else keyword.lower()
            if kw in text:
                return True
        return False

    def _match_pattern(self, response: str) -> bool:
        """Check if pattern matches."""
        if not self.pattern:
            return False
        flags = 0 if self.case_sensitive else re.IGNORECASE
        return bool(re.search(self.pattern, response, flags))

    def _match_json_field(self, response: str) -> bool:
        """Check if JSON field has expected value."""
        if not self.json_path:
            return False
        try:
            data = json.loads(response)
            value = self._navigate_json(data, self.json_path)
            return value == self.expected_value
        except (json.JSONDecodeError, KeyError, TypeError):
            return False

    def _match_predicate(self, response: str) -> bool:
        """Check custom predicate function."""
        if not self.predicate:
            return False
        try:
            return self.predicate(response)
        except Exception:
            return False

    def _navigate_json(self, data: Any, path: str) -> Any:
        """Navigate JSON path like 'field.subfield.0'."""
        parts = path.split('.')
        current = data
        for part in parts:
            if isinstance(current, dict):
                current = current[part]
            elif isinstance(current, (list, tuple)):
                current = current[int(part)]
            else:
                raise KeyError(f"Cannot navigate: {part}")
        return current


@dataclass(frozen=True)
class CategoryMatch:
    """Result of a category match."""
    category: str
    confidence: float
    matched_by: MatchStrategy
    details: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class EvaluationResult:
    """
    Complete result of response evaluation.

    Contains the matched category and any additional analysis.
    """
    response: str
    category: str
    confidence: float
    matched_criteria: CategoryCriteria | None
    all_matches: tuple[CategoryMatch, ...]
    metadata: Mapping[str, Any] = field(default_factory=dict)

    @property
    def is_definitive(self) -> bool:
        """Check if the match is high-confidence."""
        return self.confidence >= 0.8


class ResponseCategorizer:
    """
    Categorizes LLM responses based on defined criteria.

    Thread-safe and stateless - criteria are provided per call
    or configured at construction time.
    """

    def __init__(
        self,
        criteria: Sequence[CategoryCriteria] | None = None,
        default_category: str = "unknown"
    ) -> None:
        """
        Initialize categorizer.

        Args:
            criteria: List of category criteria, ordered by priority
            default_category: Category to return if no match
        """
        self.criteria = list(criteria) if criteria else []
        self.default_category = default_category

        # Sort by priority (higher first)
        self.criteria.sort(key=lambda c: c.priority, reverse=True)

    def add_criteria(self, criteria: CategoryCriteria) -> None:
        """Add a category criteria."""
        self.criteria.append(criteria)
        self.criteria.sort(key=lambda c: c.priority, reverse=True)

    def evaluate(
        self,
        response: str,
        extra_criteria: Sequence[CategoryCriteria] | None = None
    ) -> EvaluationResult:
        """
        Evaluate a response against all criteria.

        Args:
            response: The LLM response to categorize
            extra_criteria: Additional criteria for this evaluation only

        Returns:
            EvaluationResult with matched category
        """
        all_criteria = list(self.criteria)
        if extra_criteria:
            all_criteria.extend(extra_criteria)
            all_criteria.sort(key=lambda c: c.priority, reverse=True)

        all_matches: list[CategoryMatch] = []
        matched_criteria: CategoryCriteria | None = None
        matched_category = self.default_category
        confidence = 0.0

        for criterion in all_criteria:
            if criterion.matches(response):
                match = CategoryMatch(
                    category=criterion.name,
                    confidence=self._calculate_confidence(criterion, response),
                    matched_by=criterion.strategy,
                )
                all_matches.append(match)

                # First match (highest priority) wins
                if matched_criteria is None:
                    matched_criteria = criterion
                    matched_category = criterion.name
                    confidence = match.confidence

        return EvaluationResult(
            response=response,
            category=matched_category,
            confidence=confidence,
            matched_criteria=matched_criteria,
            all_matches=tuple(all_matches),
        )

    def _calculate_confidence(
        self,
        criterion: CategoryCriteria,
        response: str
    ) -> float:
        """Calculate confidence score for a match."""
        # Base confidence by strategy
        base_confidence = {
            MatchStrategy.ALWAYS: 0.5,
            MatchStrategy.KEYWORD: 0.7,
            MatchStrategy.NEGATION: 0.7,
            MatchStrategy.PATTERN: 0.8,
            MatchStrategy.JSON_FIELD: 0.9,
            MatchStrategy.PREDICATE: 0.85,
            MatchStrategy.SEMANTIC: 0.75,
        }

        conf = base_confidence.get(criterion.strategy, 0.5)

        # Boost for keyword strategies based on match count
        if criterion.strategy in (MatchStrategy.KEYWORD, MatchStrategy.NEGATION):
            if criterion.keywords:
                text = response if criterion.case_sensitive else response.lower()
                matches = sum(
                    1 for kw in criterion.keywords
                    if (kw if criterion.case_sensitive else kw.lower()) in text
                )
                # More keyword matches = higher confidence
                conf = min(1.0, conf + (matches - 1) * 0.05)

        return conf

    @classmethod
    def from_edge_labels(cls, labels: Sequence[str]) -> ResponseCategorizer:
        """
        Create a simple categorizer from edge labels.

        Converts labels like "success", "failure", "retry" into
        keyword-based criteria.
        """
        criteria: list[CategoryCriteria] = []

        for i, label in enumerate(labels):
            # Create keyword list from label
            keywords = [label]

            # Add common variations
            variations = {
                "success": ["succeeded", "successful", "complete", "done", "finished"],
                "failure": ["failed", "error", "exception", "unable"],
                "retry": ["retry", "again", "repeat"],
                "continue": ["continue", "proceed", "next"],
                "stop": ["stop", "halt", "abort"],
                "true": ["true", "yes", "affirmative"],
                "false": ["false", "no", "negative"],
            }

            keywords.extend(variations.get(label.lower(), []))

            criteria.append(CategoryCriteria(
                name=label,
                strategy=MatchStrategy.KEYWORD,
                keywords=tuple(keywords),
                priority=len(labels) - i  # Earlier labels get higher priority
            ))

        return cls(criteria=criteria, default_category=labels[-1] if labels else "unknown")


# Convenience factory functions
def success_failure_categorizer() -> ResponseCategorizer:
    """Create a categorizer for simple success/failure classification."""
    return ResponseCategorizer(
        criteria=[
            CategoryCriteria(
                name="success",
                strategy=MatchStrategy.KEYWORD,
                keywords=("success", "succeeded", "complete", "done", "finished", "accomplished"),
                priority=2
            ),
            CategoryCriteria(
                name="failure",
                strategy=MatchStrategy.KEYWORD,
                keywords=("failed", "error", "failure", "unable", "cannot", "impossible"),
                priority=2
            ),
            CategoryCriteria(
                name="unknown",
                strategy=MatchStrategy.ALWAYS,
                priority=0
            ),
        ],
        default_category="unknown"
    )


def yes_no_categorizer() -> ResponseCategorizer:
    """Create a categorizer for yes/no responses."""
    return ResponseCategorizer(
        criteria=[
            CategoryCriteria(
                name="yes",
                strategy=MatchStrategy.PATTERN,
                pattern=r'^(yes|yeah|yep|affirmative|correct|true)\b',
                priority=2
            ),
            CategoryCriteria(
                name="no",
                strategy=MatchStrategy.PATTERN,
                pattern=r'^(no|nope|negative|false|incorrect)\b',
                priority=2
            ),
            CategoryCriteria(
                name="unknown",
                strategy=MatchStrategy.ALWAYS,
                priority=0
            ),
        ],
        default_category="unknown"
    )


def json_status_categorizer(status_field: str = "status") -> ResponseCategorizer:
    """Create a categorizer that checks a JSON status field."""
    return ResponseCategorizer(
        criteria=[
            CategoryCriteria(
                name="success",
                strategy=MatchStrategy.JSON_FIELD,
                json_path=status_field,
                expected_value="success",
                priority=2
            ),
            CategoryCriteria(
                name="error",
                strategy=MatchStrategy.JSON_FIELD,
                json_path=status_field,
                expected_value="error",
                priority=2
            ),
            CategoryCriteria(
                name="pending",
                strategy=MatchStrategy.JSON_FIELD,
                json_path=status_field,
                expected_value="pending",
                priority=2
            ),
            CategoryCriteria(
                name="unknown",
                strategy=MatchStrategy.ALWAYS,
                priority=0
            ),
        ],
        default_category="unknown"
    )

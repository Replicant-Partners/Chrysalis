"""
Heuristic-based Decomposition Strategy.

Lightweight keyword-based fallback that requires no external dependencies.
Lowest quality but always available as ultimate fallback.
"""

import re
import logging
from typing import List, Set

from memory_system.semantic.models import SemanticFrame, Triple, Intent
from memory_system.semantic.strategies.base import DecompositionStrategy

logger = logging.getLogger(__name__)


class HeuristicStrategy(DecompositionStrategy):
    """
    Keyword and pattern-based semantic decomposition.
    
    Uses regex patterns and keyword matching for basic extraction.
    Always available as ultimate fallback when other strategies fail.
    """
    
    # Intent keyword mappings
    INTENT_KEYWORDS: dict[Intent, Set[str]] = {
        Intent.DEBUG: {"fix", "bug", "error", "debug", "issue", "broken", "crash", 
                       "fail", "exception", "wrong", "problem", "repair"},
        Intent.REFACTOR: {"refactor", "improve", "optimize", "clean", "restructure",
                          "reorganize", "simplify", "extract", "rename", "move"},
        Intent.CREATE: {"create", "add", "new", "make", "build", "generate", 
                        "implement", "write", "define", "introduce", "setup"},
        Intent.TEST: {"test", "testing", "spec", "verify", "assert", "check",
                      "validate", "unit", "integration", "coverage"},
        Intent.EXPLAIN: {"explain", "what", "how", "why", "describe", "understand",
                         "documentation", "clarify", "overview", "summarize"},
        Intent.QUERY: {"find", "search", "get", "list", "show", "where", "which",
                       "locate", "lookup", "retrieve", "fetch"},
        Intent.TRANSFORM: {"convert", "transform", "change", "migrate", "translate",
                           "port", "adapt", "modify", "update", "upgrade"},
        Intent.ANALYZE: {"analyze", "review", "check", "audit", "inspect", "examine",
                         "assess", "evaluate", "scan", "profile"},
    }
    
    # Common predicate patterns
    PREDICATE_PATTERNS = [
        (r"(\w+)\s+(?:has|have)\s+(\w+)", "has"),
        (r"(\w+)\s+(?:is|are)\s+(?:a|an)\s+(\w+)", "is_a"),
        (r"(\w+)\s+(?:uses?|using)\s+(\w+)", "uses"),
        (r"(\w+)\s+(?:calls?|calling)\s+(\w+)", "calls"),
        (r"(\w+)\s+(?:depends?\s+on|requires?)\s+(\w+)", "depends_on"),
        (r"(\w+)\s+(?:extends?|inherits?\s+from)\s+(\w+)", "extends"),
        (r"(\w+)\s+(?:implements?)\s+(\w+)", "implements"),
        (r"(\w+)\s+(?:contains?|includes?)\s+(\w+)", "contains"),
        (r"(\w+)\s+(?:returns?)\s+(\w+)", "returns"),
        (r"(\w+)\s+(?:throws?|raises?)\s+(\w+)", "throws"),
    ]
    
    def __init__(self):
        """Initialize heuristic strategy."""
        # Compile patterns for efficiency
        self._compiled_patterns = [
            (re.compile(pattern, re.IGNORECASE), predicate)
            for pattern, predicate in self.PREDICATE_PATTERNS
        ]
    
    @property
    def name(self) -> str:
        return "heuristic"
    
    @property
    def priority(self) -> int:
        return 10  # Lowest priority
    
    @property
    def requires_model(self) -> bool:
        return False  # No external dependencies
    
    def is_available(self) -> bool:
        """Always available."""
        return True
    
    async def decompose(self, text: str, **kwargs) -> SemanticFrame:
        """
        Decompose text using keyword heuristics and regex patterns.
        
        Args:
            text: Input text to decompose
            **kwargs: Additional options (unused)
            
        Returns:
            SemanticFrame with extracted semantics (low confidence)
        """
        if not text or not text.strip():
            from memory_system.semantic.exceptions import ValidationError
            raise ValidationError("Input text cannot be empty", "EMPTY_INPUT")
        
        # Detect intent
        intent = self._detect_intent_keywords(text)
        
        # Extract target entity
        target = self._extract_target_entity(text)
        
        # Extract triples using patterns
        triples = self._extract_triples_from_patterns(text)
        
        # Calculate confidence
        confidence = self._calculate_confidence(intent, triples)
        
        frame = SemanticFrame(
            intent=intent,
            target=target,
            triples=triples,
            confidence=confidence,
            raw=text,
            strategy_used=self.name,
            metadata={"heuristic": True},
        )
        
        logger.debug(
            f"Heuristic decomposition: intent={frame.intent.name}, "
            f"confidence={frame.confidence:.3f}, triples={len(frame.triples)}"
        )
        
        return frame
    
    def _detect_intent_keywords(self, text: str) -> Intent:
        """
        Detect intent using keyword matching.
        
        Returns highest-scoring intent based on keyword matches.
        """
        text_lower = text.lower()
        words = set(re.findall(r'\b\w+\b', text_lower))

        scores = {}
        for intent, keywords in self.INTENT_KEYWORDS.items():
            score = len(words & keywords)
            if score > 0:
                scores[intent] = score

        return max(scores, key=scores.get) if scores else Intent.UNKNOWN
    
    def _extract_triples_from_patterns(self, text: str) -> List[Triple]:
        """
        Extract triples using regex patterns.
        """
        triples = []

        for pattern, predicate in self._compiled_patterns:
            matches = pattern.findall(text)
            triples.extend(
                Triple(
                    subject=match[0].replace(" ", "_"),
                    predicate=predicate,
                    object=match[1].replace(" ", "_"),
                )
                for match in matches
                if len(match) >= 2
            )
        # Also try to extract from code-like patterns
        code_triples = self._extract_code_patterns(text)
        triples.extend(code_triples)

        return triples
    
    def _extract_code_patterns(self, text: str) -> List[Triple]:
        """
        Extract triples from code-like patterns.
        """
        # Class definition pattern: class Foo(Bar)
        class_pattern = re.compile(r'class\s+(\w+)\s*\((\w+)\)', re.IGNORECASE)
        triples = [
            Triple(subject=match[0], predicate="extends", object=match[1])
            for match in class_pattern.findall(text)
        ]
        # Function call pattern: foo.bar() or foo(bar)
        call_pattern = re.compile(r'(\w+)\.(\w+)\s*\(', re.IGNORECASE)
        triples.extend(
            Triple(
                subject="caller",
                predicate="calls",
                object=f"{match[0]}.{match[1]}",
            )
            for match in call_pattern.findall(text)
        )
        # Import pattern: import foo, from foo import bar
        import_pattern = re.compile(r'(?:from\s+(\w+)\s+)?import\s+(\w+)', re.IGNORECASE)
        for match in import_pattern.findall(text):
            if match[0]:
                triples.append(Triple(
                    subject="module",
                    predicate="imports_from",
                    object=f"{match[0]}.{match[1]}"
                ))
            else:
                triples.append(Triple(
                    subject="module",
                    predicate="imports",
                    object=match[1]
                ))

        return triples
    
    def _calculate_confidence(self, intent: Intent, triples: List[Triple]) -> float:
        """
        Calculate confidence score for heuristic extraction.
        
        Heuristic scores are capped at 0.3 to indicate low reliability.
        """
        base_confidence = 0.2
        
        # Boost if we found a specific intent (not UNKNOWN)
        if intent != Intent.UNKNOWN:
            base_confidence += 0.05
        
        # Boost for each triple extracted (max +0.1)
        base_confidence += 0.025 * min(len(triples), 4)
        
        return min(0.35, base_confidence)

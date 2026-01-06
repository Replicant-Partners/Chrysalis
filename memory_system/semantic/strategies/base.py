"""
Base Decomposition Strategy.

Abstract base class for all decomposition strategies.
Defines the interface that all strategies must implement.
"""

from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
import logging

from memory_system.semantic.models import SemanticFrame, Intent, Triple

logger = logging.getLogger(__name__)


class DecompositionStrategy(ABC):
    """
    Abstract base class for semantic decomposition strategies.
    
    All decomposition strategies must implement:
    - decompose(): Async method to extract semantic frame from text
    - name: Strategy identifier
    - priority: Selection priority (higher = preferred)
    
    Strategies are selected based on:
    1. Content type hints (code vs natural language)
    2. Priority ordering
    3. Availability (fallback if dependencies missing)
    """
    
    @abstractmethod
    async def decompose(self, text: str, **kwargs) -> SemanticFrame:
        """
        Decompose text into a semantic frame.
        
        Args:
            text: Input text to decompose
            **kwargs: Strategy-specific options
            
        Returns:
            SemanticFrame with extracted intent, target, and triples
            
        Raises:
            DecompositionError: If decomposition fails
            ValidationError: If input is invalid
        """
        pass
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Strategy identifier (e.g., 'ollama', 'spacy', 'heuristic')"""
        pass
    
    @property
    def priority(self) -> int:
        """
        Selection priority for strategy ordering.
        
        Higher values = preferred when multiple strategies available.
        Default priorities:
        - Ollama (LLM): 100
        - TreeSitter (AST): 75  
        - spaCy (NLP): 50
        - Heuristic: 10
        """
        return 0
    
    @property
    def requires_model(self) -> bool:
        """Whether this strategy requires an external model/service"""
        return False
    
    def is_available(self) -> bool:
        """
        Check if strategy is available (dependencies installed, services up).
        
        Override in subclasses to check specific requirements.
        """
        return True
    
    def supports_content_type(self, content_type: str) -> bool:
        """
        Check if strategy supports given content type.
        
        Args:
            content_type: One of 'code', 'natural_language', 'mixed', 'any'
            
        Returns:
            True if strategy can handle this content type
        """
        return True  # Default: support all types
    
    def _create_fallback_frame(
        self, 
        text: str, 
        intent: Intent = Intent.UNKNOWN,
        confidence: float = 0.1
    ) -> SemanticFrame:
        """
        Create minimal fallback frame when decomposition fails.
        
        Args:
            text: Original input text
            intent: Fallback intent (default: UNKNOWN)
            confidence: Confidence score (default: 0.1 - very low)
            
        Returns:
            Minimal SemanticFrame
        """
        return SemanticFrame(
            intent=intent,
            target="implicit",
            triples=[],
            confidence=confidence,
            raw=text,
            strategy_used=self.name,
            metadata={"fallback": True},
        )
    
    def _detect_intent_keywords(self, text: str) -> Intent:
        """
        Simple keyword-based intent detection.
        
        Used as fallback or baseline detection.
        """
        text_lower = text.lower()
        
        # Debug/fix keywords
        if any(w in text_lower for w in ["fix", "bug", "error", "debug", "issue", "broken", "crash"]):
            return Intent.DEBUG
        
        # Refactor keywords
        if any(w in text_lower for w in ["refactor", "improve", "optimize", "clean", "restructure"]):
            return Intent.REFACTOR
        
        # Create keywords
        if any(w in text_lower for w in ["create", "add", "new", "make", "build", "generate", "implement"]):
            return Intent.CREATE
        
        # Test keywords
        if any(w in text_lower for w in ["test", "testing", "spec", "verify", "assert"]):
            return Intent.TEST
        
        # Explain keywords
        if any(w in text_lower for w in ["explain", "what", "how", "why", "describe", "understand"]):
            return Intent.EXPLAIN
        
        # Query keywords
        if any(w in text_lower for w in ["find", "search", "get", "list", "show", "where"]):
            return Intent.QUERY
        
        # Transform keywords
        if any(w in text_lower for w in ["convert", "transform", "change", "migrate", "translate"]):
            return Intent.TRANSFORM
        
        # Analyze keywords
        if any(w in text_lower for w in ["analyze", "review", "check", "audit", "inspect"]):
            return Intent.ANALYZE
        
        # Default
        return Intent.UNKNOWN
    
    def _extract_target_entity(self, text: str) -> str:
        """
        Extract target entity from text.
        
        Simple heuristic: find quoted strings, file paths, or class/function names.
        """
        import re
        
        # Try quoted strings first
        quoted = re.findall(r'["\']([^"\']+)["\']', text)
        if quoted:
            return quoted[0]
        
        # Try file paths
        paths = re.findall(r'\b[\w/\\]+\.\w{2,4}\b', text)
        if paths:
            return paths[0]
        
        # Try CamelCase or snake_case identifiers
        identifiers = re.findall(r'\b([A-Z][a-zA-Z0-9]+|[a-z]+_[a-z_]+)\b', text)
        if identifiers:
            return identifiers[0]
        
        return "implicit"

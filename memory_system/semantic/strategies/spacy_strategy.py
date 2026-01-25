"""
spaCy-based Decomposition Strategy.

Uses NLP dependency parsing to extract semantic triples.
Deterministic and fast but lower quality than LLM approaches.

Ported from MetaSemantic's prompt_decomposer.py with enhancements.
"""

import logging
from typing import List, Dict, Any, Optional

from memory_system.semantic.models import SemanticFrame, Triple, Intent
from memory_system.semantic.strategies.base import DecompositionStrategy

logger = logging.getLogger(__name__)

# Conditional import
try:
    import spacy  # type: ignore
    SPACY_AVAILABLE = True
except ImportError:
    SPACY_AVAILABLE = False
    spacy = None


class SpacyStrategy(DecompositionStrategy):
    """
    NLP-based semantic decomposition using spaCy dependency parsing.
    
    Extracts Subject-Verb-Object triples from natural language.
    Deterministic and fast, good for fallback when LLM unavailable.
    
    Configuration:
        model_name: spaCy model (default: 'en_core_web_sm')
    """
    
    def __init__(self, model_name: str = "en_core_web_sm"):
        """
        Initialize spaCy strategy.
        
        Args:
            model_name: spaCy model to load
        """
        self.model_name = model_name
        self._nlp = None
        self._init_error: Optional[str] = None
        
    def _load_model(self):
        """Lazy-load spaCy model."""
        if self._nlp is not None:
            return
            
        if not SPACY_AVAILABLE:
            self._init_error = "spaCy not installed"
            return
            
        try:
            self._nlp = spacy.load(self.model_name)
            logger.info(f"Loaded spaCy model: {self.model_name}")
        except OSError:
            # Try to download model
            logger.info(f"Downloading spaCy model: {self.model_name}")
            try:
                from spacy.cli import download
                download(self.model_name)
                self._nlp = spacy.load(self.model_name)
            except Exception as e:
                self._init_error = f"Failed to load/download spaCy model: {e}"
                logger.error(self._init_error)
    
    @property
    def name(self) -> str:
        return "spacy"
    
    @property
    def priority(self) -> int:
        return 50  # Medium priority
    
    @property
    def requires_model(self) -> bool:
        return True  # Requires spaCy model
    
    def is_available(self) -> bool:
        """Check if spaCy is available and model can be loaded."""
        if not SPACY_AVAILABLE:
            return False
        self._load_model()
        return self._nlp is not None
    
    def supports_content_type(self, content_type: str) -> bool:
        """spaCy works best with natural language, not code."""
        return content_type in {"natural_language", "mixed", "any"}
    
    async def decompose(self, text: str, **kwargs) -> SemanticFrame:
        """
        Decompose text using spaCy dependency parsing.
        
        Args:
            text: Input text to decompose
            **kwargs: Additional options (unused)
            
        Returns:
            SemanticFrame with extracted semantics
        """
        if not text or not text.strip():
            from memory_system.semantic.exceptions import ValidationError
            raise ValidationError("Input text cannot be empty", "EMPTY_INPUT")
        
        self._load_model()
        
        if self._nlp is None:
            logger.warning("spaCy not available, returning fallback frame")
            return self._create_fallback_frame(text)
        
        # Process text with spaCy
        doc = self._nlp(text)
        
        # Extract triples from dependency parse
        triples = self._extract_triples(doc)
        
        # Detect intent using keyword heuristics
        intent = self._detect_intent_keywords(text)
        
        # Extract target entity
        target = self._extract_target(doc)
        
        # Calculate confidence based on extraction quality
        confidence = self._calculate_confidence(triples, doc)
        
        frame = SemanticFrame(
            intent=intent,
            target=target,
            triples=triples,
            confidence=confidence,
            raw=text,
            strategy_used=self.name,
            metadata={
                "spacy_model": self.model_name,
                "sentence_count": len(list(doc.sents)),
                "token_count": len(doc),
            },
        )
        
        logger.debug(
            f"spaCy decomposition: intent={frame.intent.name}, "
            f"confidence={frame.confidence:.3f}, triples={len(frame.triples)}"
        )
        
        return frame
    
    def _extract_triples(self, doc) -> List[Triple]:
        """
        Extract Subject-Verb-Object triples from spaCy doc.
        
        Uses dependency parsing to find SVO patterns.
        """
        triples = []

        for token in doc:
            # Find nominal subjects
            if token.dep_ in ("nsubj", "nsubjpass") and token.head.pos_ == "VERB":
                subject = self._get_compound_phrase(token)
                predicate = token.head.lemma_

                # Find object
                obj = None

                for child in token.head.children:
                    # Direct objects
                    if child.dep_ in ("dobj", "attr", "oprd"):
                        obj = self._get_compound_phrase(child)
                        break

                    # Clausal complements (e.g., "wants to build")
                    elif child.dep_ == "xcomp":
                        predicate = f"{predicate}_{child.lemma_}"
                        for grandchild in child.children:
                            if grandchild.dep_ in ("dobj", "attr", "oprd"):
                                obj = self._get_compound_phrase(grandchild)
                                break
                        if obj:
                            break

                    # Prepositional objects (e.g., "works on X")
                    elif child.dep_ == "prep":
                        for pobj in child.children:
                            if pobj.dep_ == "pobj":
                                obj = self._get_compound_phrase(pobj)
                                predicate = f"{predicate}_{child.lemma_}"
                                break

                if obj:
                    triples.append(Triple(
                        subject=subject,
                        predicate=predicate.replace(" ", "_"),
                        object=obj
                    ))

        # Also extract noun-prep-noun patterns
        for token in doc:
            if token.dep_ == "prep" and token.head.pos_ in ("NOUN", "PROPN"):
                triples.extend(
                    Triple(
                        subject=self._get_compound_phrase(token.head),
                        predicate=token.lemma_,
                        object=self._get_compound_phrase(pobj),
                    )
                    for pobj in token.children
                    if pobj.dep_ == "pobj"
                )
        return triples
    
    def _get_compound_phrase(self, token) -> str:
        """
        Get full compound phrase for a token.
        
        Includes compound nouns and adjective modifiers.
        """
        compounds = [
            child for child in token.children 
            if child.dep_ in ("compound", "amod", "nummod", "poss")
        ]
        
        # Sort by index to ensure correct order
        parts = sorted(compounds + [token], key=lambda t: t.i)
        return "_".join([t.text for t in parts])
    
    def _extract_target(self, doc) -> str:
        """
        Extract likely target entity from spaCy doc.
        
        Looks for proper nouns, noun phrases, and key entities.
        """
        # Try named entities first
        for ent in doc.ents:
            if ent.label_ in ("PRODUCT", "ORG", "WORK_OF_ART"):
                return ent.text

        return next(
            (
                chunk.text.replace(" ", "_")
                for chunk in doc.noun_chunks
                if chunk.root.dep_ in ("dobj", "pobj")
            ),
            "implicit",
        )
    
    def _calculate_confidence(self, triples: List[Triple], doc) -> float:
        """
        Calculate confidence score based on extraction quality.
        
        Factors:
        - Number of triples extracted
        - Sentence complexity
        - Parse quality
        """
        # Base confidence for spaCy fallback
        base_confidence = 0.4
        
        # Boost for successful triple extraction
        if triples:
            base_confidence += 0.1 * min(len(triples), 3)  # Up to +0.3
        
        # Reduce confidence for very complex sentences
        sentence_count = len(list(doc.sents))
        if sentence_count > 3:
            base_confidence -= 0.1
        
        # Ensure within bounds
        return max(0.1, min(0.7, base_confidence))

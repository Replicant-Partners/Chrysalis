"""
Semantic Data Models for Chrysalis.

Provides unified data structures for semantic decomposition, triple extraction,
and confidence calibration across all decomposition strategies.

Migrated from:
- SkyPrompt/src/models.py (SemanticFrame)
- SkyPrompt/src/confidence_calibrator.py (CalibrationResult)
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any, Tuple
from enum import Enum
import json


class Intent(Enum):
    """
    Semantic intent types for code-related prompts.
    
    Extended from SkyPrompt's 5 intents to include additional semantic actions.
    """
    DEBUG = "DEBUG"           # Fix bugs, errors, issues
    REFACTOR = "REFACTOR"     # Improve code structure/quality
    CREATE = "CREATE"         # Create new code/files/components
    EXPLAIN = "EXPLAIN"       # Explain code/concepts
    TEST = "TEST"             # Testing-related
    QUERY = "QUERY"           # Information retrieval
    TRANSFORM = "TRANSFORM"   # Data transformation
    ANALYZE = "ANALYZE"       # Code/data analysis
    INTEGRATE = "INTEGRATE"   # Integration tasks
    UNKNOWN = "UNKNOWN"       # Fallback for unclassified


@dataclass
class Triple:
    """
    Subject-Predicate-Object triple for knowledge representation.
    
    Core unit of semantic information in knowledge graphs.
    Compatible with SPO format from MetaSemantic and SkyPrompt.
    """
    subject: str
    predicate: str
    object: str
    confidence: float = 1.0
    source: Optional[str] = None
    line_number: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None
    
    def __post_init__(self):
        """Validate triple fields"""
        if not self.subject or not self.subject.strip():
            raise ValueError("Triple subject cannot be empty")
        if not self.predicate or not self.predicate.strip():
            raise ValueError("Triple predicate cannot be empty")
        if not self.object or not self.object.strip():
            raise ValueError("Triple object cannot be empty")
        if not 0.0 <= self.confidence <= 1.0:
            raise ValueError(f"Confidence must be between 0 and 1, got {self.confidence}")
    
    def to_tuple(self) -> Tuple[str, str, str]:
        """Return as (subject, predicate, object) tuple"""
        return (self.subject, self.predicate, self.object)
    
    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dictionary"""
        return {
            "subject": self.subject,
            "predicate": self.predicate,
            "object": self.object,
            "confidence": self.confidence,
            "source": self.source,
            "line_number": self.line_number,
            "metadata": self.metadata,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Triple":
        """Deserialize from dictionary"""
        return cls(
            subject=data["subject"],
            predicate=data["predicate"],
            object=data["object"],
            confidence=data.get("confidence", 1.0),
            source=data.get("source"),
            line_number=data.get("line_number"),
            metadata=data.get("metadata"),
        )
    
    @classmethod
    def from_list(cls, items: List[str], confidence: float = 1.0) -> "Triple":
        """Create from [subject, predicate, object] list"""
        if len(items) != 3:
            raise ValueError(f"Expected 3 items, got {len(items)}")
        return cls(
            subject=items[0],
            predicate=items[1],
            object=items[2],
            confidence=confidence,
        )


@dataclass
class SemanticFrame:
    """
    Unified semantic frame for decomposed content.
    
    Represents the semantic structure of a user prompt or text,
    including intent, target entity, and extracted triples.
    
    Compatible with:
    - SkyPrompt's SemanticFrame (Pydantic model)
    - MetaSemantic's decomposition output
    - Chrysalis KnowledgeBuilder entity extraction
    """
    intent: Intent
    target: str
    triples: List[Triple]
    confidence: float
    raw: str
    strategy_used: str = "unknown"
    metadata: Optional[Dict[str, Any]] = None
    
    def __post_init__(self):
        """Validate frame fields"""
        if not isinstance(self.intent, Intent):
            # Allow string conversion
            if isinstance(self.intent, str):
                self.intent = Intent(self.intent.upper())
            else:
                raise ValueError(f"Intent must be Intent enum, got {type(self.intent)}")
        
        if not 0.0 <= self.confidence <= 1.0:
            raise ValueError(f"Confidence must be between 0 and 1, got {self.confidence}")
        
        # Convert dict triples to Triple objects
        if self.triples:
            converted = []
            for t in self.triples:
                if isinstance(t, Triple):
                    converted.append(t)
                elif isinstance(t, dict):
                    converted.append(Triple.from_dict(t))
                elif isinstance(t, (list, tuple)):
                    converted.append(Triple.from_list(list(t)))
                else:
                    raise ValueError(f"Invalid triple type: {type(t)}")
            self.triples = converted
    
    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dictionary (JSON-compatible)"""
        return {
            "intent": self.intent.value,
            "target": self.target,
            "triples": [t.to_dict() for t in self.triples],
            "confidence": self.confidence,
            "raw": self.raw,
            "strategy_used": self.strategy_used,
            "metadata": self.metadata,
        }
    
    def to_json(self) -> str:
        """Serialize to JSON string"""
        return json.dumps(self.to_dict(), indent=2)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SemanticFrame":
        """Deserialize from dictionary"""
        intent = data.get("intent", "UNKNOWN")
        if isinstance(intent, str):
            try:
                intent = Intent(intent.upper())
            except ValueError:
                intent = Intent.UNKNOWN
        
        triples = []
        for t in data.get("triples", []):
            if isinstance(t, dict):
                triples.append(Triple.from_dict(t))
            elif isinstance(t, (list, tuple)):
                triples.append(Triple.from_list(list(t)))
        
        return cls(
            intent=intent,
            target=data.get("target", "implicit"),
            triples=triples,
            confidence=data.get("confidence", 0.5),
            raw=data.get("raw", ""),
            strategy_used=data.get("strategy_used", "unknown"),
            metadata=data.get("metadata"),
        )
    
    @classmethod
    def from_json(cls, json_str: str) -> "SemanticFrame":
        """Deserialize from JSON string"""
        return cls.from_dict(json.loads(json_str))
    
    @property
    def triple_count(self) -> int:
        """Number of triples in frame"""
        return len(self.triples)
    
    @property
    def avg_triple_confidence(self) -> float:
        """Average confidence across triples"""
        if not self.triples:
            return 0.0
        return sum(t.confidence for t in self.triples) / len(self.triples)
    
    def get_subjects(self) -> List[str]:
        """Get unique subjects from all triples"""
        return list(set(t.subject for t in self.triples))
    
    def get_predicates(self) -> List[str]:
        """Get unique predicates from all triples"""
        return list(set(t.predicate for t in self.triples))
    
    def get_objects(self) -> List[str]:
        """Get unique objects from all triples"""
        return list(set(t.object for t in self.triples))


@dataclass
class CalibrationResult:
    """
    Result of confidence calibration.
    
    Ported from SkyPrompt/src/confidence_calibrator.py.
    Provides calibrated confidence scores with validation.
    """
    original_confidence: float
    calibrated_confidence: float
    method: str
    is_valid: bool
    validation_warnings: List[str] = field(default_factory=list)
    metadata: Optional[Dict[str, Any]] = None
    
    @property
    def confidence_delta(self) -> float:
        """Change from original to calibrated confidence"""
        return self.calibrated_confidence - self.original_confidence
    
    @property
    def was_adjusted(self) -> bool:
        """Whether calibration changed the confidence significantly"""
        return abs(self.confidence_delta) > 0.05


@dataclass 
class DecompositionError(Exception):
    """
    Error during semantic decomposition.
    
    Ported from SkyPrompt/src/exceptions.py.
    """
    message: str
    error_code: str
    details: Optional[Dict[str, Any]] = None
    
    def __str__(self) -> str:
        return f"[{self.error_code}] {self.message}"


@dataclass
class ValidationError(Exception):
    """
    Input validation error.
    
    Ported from SkyPrompt/src/exceptions.py.
    """
    message: str
    error_code: str
    
    def __str__(self) -> str:
        return f"[{self.error_code}] {self.message}"

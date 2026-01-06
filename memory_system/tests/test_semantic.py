"""
Tests for semantic decomposition module.
"""

import asyncio
import pytest
from memory_system.semantic import (
    Triple,
    Intent,
    SemanticFrame,
    HeuristicStrategy,
)
from memory_system.semantic.exceptions import ValidationError


class TestTriple:
    """Tests for Triple dataclass."""
    
    def test_create_triple(self):
        """Test basic triple creation."""
        triple = Triple(
            subject="Python",
            predicate="is",
            object="programming language"
        )
        assert triple.subject == "Python"
        assert triple.predicate == "is"
        assert triple.object == "programming language"
        assert triple.confidence == 1.0
    
    def test_triple_with_confidence(self):
        """Test triple with custom confidence."""
        triple = Triple(
            subject="A",
            predicate="related_to",
            object="B",
            confidence=0.8
        )
        assert triple.confidence == 0.8
    
    def test_triple_with_metadata(self):
        """Test triple with source and metadata."""
        triple = Triple(
            subject="S",
            predicate="P",
            object="O",
            confidence=0.9,
            source="test.py",
            line_number=42,
            metadata={"key": "value"}
        )
        assert triple.source == "test.py"
        assert triple.line_number == 42
        assert triple.metadata["key"] == "value"
    
    def test_triple_to_dict(self):
        """Test triple serialization."""
        triple = Triple("S", "P", "O", confidence=0.9, source="test")
        d = triple.to_dict()
        
        assert d["subject"] == "S"
        assert d["predicate"] == "P"
        assert d["object"] == "O"
        assert d["confidence"] == 0.9
        assert d["source"] == "test"
    
    def test_triple_from_dict(self):
        """Test triple deserialization."""
        data = {
            "subject": "X",
            "predicate": "Y",
            "object": "Z",
            "confidence": 0.75,
        }
        triple = Triple.from_dict(data)
        
        assert triple.subject == "X"
        assert triple.predicate == "Y"
        assert triple.object == "Z"
        assert triple.confidence == 0.75
    
    def test_triple_from_list(self):
        """Test triple creation from list."""
        triple = Triple.from_list(["A", "relates_to", "B"], confidence=0.8)
        
        assert triple.subject == "A"
        assert triple.predicate == "relates_to"
        assert triple.object == "B"
        assert triple.confidence == 0.8
    
    def test_triple_to_tuple(self):
        """Test triple to tuple conversion."""
        triple = Triple("S", "P", "O")
        assert triple.to_tuple() == ("S", "P", "O")
    
    def test_triple_empty_subject_raises(self):
        """Test that empty subject raises ValidationError."""
        with pytest.raises(ValueError, match="subject cannot be empty"):
            Triple("", "predicate", "object")
    
    def test_triple_invalid_confidence_raises(self):
        """Test that invalid confidence raises ValueError."""
        with pytest.raises(ValueError, match="Confidence must be between"):
            Triple("S", "P", "O", confidence=1.5)


class TestIntent:
    """Tests for Intent enum."""
    
    def test_intent_values(self):
        """Test intent enum has expected values."""
        assert Intent.DEBUG.value == "DEBUG"
        assert Intent.REFACTOR.value == "REFACTOR"
        assert Intent.CREATE.value == "CREATE"
        assert Intent.EXPLAIN.value == "EXPLAIN"
        assert Intent.TEST.value == "TEST"
        assert Intent.UNKNOWN.value == "UNKNOWN"
    
    def test_intent_from_string(self):
        """Test intent creation from string."""
        intent = Intent("DEBUG")
        assert intent == Intent.DEBUG


class TestSemanticFrame:
    """Tests for SemanticFrame dataclass."""
    
    def test_create_frame(self):
        """Test frame creation."""
        frame = SemanticFrame(
            intent=Intent.CREATE,
            target="UserController",
            triples=[Triple("User", "has", "name")],
            confidence=0.8,
            raw="create user controller"
        )
        assert frame.intent == Intent.CREATE
        assert frame.target == "UserController"
        assert len(frame.triples) == 1
        assert frame.confidence == 0.8
    
    def test_frame_with_string_intent(self):
        """Test frame creation with string intent (auto-converted)."""
        frame = SemanticFrame(
            intent="debug",
            target="bug",
            triples=[],
            confidence=0.5,
            raw="fix bug"
        )
        assert frame.intent == Intent.DEBUG
    
    def test_frame_to_dict(self):
        """Test frame serialization."""
        frame = SemanticFrame(
            intent=Intent.QUERY,
            target="files",
            triples=[Triple("user", "searches", "files")],
            confidence=0.7,
            raw="find files",
            strategy_used="heuristic"
        )
        d = frame.to_dict()
        
        assert d["intent"] == "QUERY"
        assert d["target"] == "files"
        assert len(d["triples"]) == 1
        assert d["strategy_used"] == "heuristic"
    
    def test_frame_from_dict(self):
        """Test frame deserialization."""
        data = {
            "intent": "CREATE",
            "target": "test",
            "triples": [{"subject": "A", "predicate": "B", "object": "C"}],
            "confidence": 0.6,
            "raw": "test",
        }
        frame = SemanticFrame.from_dict(data)
        
        assert frame.intent == Intent.CREATE
        assert frame.target == "test"
        assert len(frame.triples) == 1
    
    def test_frame_triple_count(self):
        """Test triple count property."""
        frame = SemanticFrame(
            intent=Intent.UNKNOWN,
            target="test",
            triples=[
                Triple("A", "r1", "B"),
                Triple("C", "r2", "D"),
            ],
            confidence=0.5,
            raw="test"
        )
        assert frame.triple_count == 2
    
    def test_frame_get_subjects(self):
        """Test extracting unique subjects."""
        frame = SemanticFrame(
            intent=Intent.UNKNOWN,
            target="test",
            triples=[
                Triple("A", "r1", "B"),
                Triple("A", "r2", "C"),
                Triple("D", "r3", "E"),
            ],
            confidence=0.5,
            raw="test"
        )
        subjects = frame.get_subjects()
        assert set(subjects) == {"A", "D"}


class TestHeuristicStrategy:
    """Tests for heuristic decomposition strategy."""
    
    @pytest.fixture
    def strategy(self):
        """Create strategy instance."""
        return HeuristicStrategy()
    
    def test_strategy_name(self, strategy):
        """Test strategy name property."""
        assert strategy.name == "heuristic"
    
    def test_strategy_priority(self, strategy):
        """Test strategy priority is low."""
        assert strategy.priority == 10
    
    def test_strategy_is_available(self, strategy):
        """Test strategy is always available."""
        assert strategy.is_available() is True
    
    def test_strategy_requires_no_model(self, strategy):
        """Test strategy doesn't require external model."""
        assert strategy.requires_model is False
    
    def test_decompose_debug_intent(self, strategy):
        """Test decomposition detects debug intent."""
        async def run_test():
            frame = await strategy.decompose("fix the login bug in auth.py")
            assert frame.intent == Intent.DEBUG
            assert frame.strategy_used == "heuristic"
            assert frame.confidence <= 0.35  # Heuristic caps confidence
        
        asyncio.run(run_test())
    
    def test_decompose_create_intent(self, strategy):
        """Test decomposition detects create intent."""
        async def run_test():
            frame = await strategy.decompose("create a new UserController class")
            assert frame.intent == Intent.CREATE
        
        asyncio.run(run_test())
    
    def test_decompose_empty_raises(self, strategy):
        """Test empty input raises ValidationError."""
        async def run_test():
            with pytest.raises(ValidationError):
                await strategy.decompose("")
        
        asyncio.run(run_test())
    
    def test_decompose_extracts_triples(self, strategy):
        """Test pattern-based triple extraction."""
        async def run_test():
            frame = await strategy.decompose("class UserController(BaseController)")
            # Should extract extends relationship
            extends_triples = [t for t in frame.triples if t.predicate == "extends"]
            assert len(extends_triples) > 0
        
        asyncio.run(run_test())
    
    def test_decompose_returns_semantic_frame(self, strategy):
        """Test decompose returns proper SemanticFrame."""
        async def run_test():
            frame = await strategy.decompose("analyze the code quality")
            assert isinstance(frame, SemanticFrame)
            assert isinstance(frame.intent, Intent)
            assert isinstance(frame.confidence, float)
            assert frame.raw == "analyze the code quality"
        
        asyncio.run(run_test())

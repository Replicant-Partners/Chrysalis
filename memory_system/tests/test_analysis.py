"""
Tests for analysis module (Shannon analyzer).
"""

import pytest
import math

from memory_system.analysis import ShannonAnalyzer, AnalysisResult


class TestShannonAnalyzer:
    """Tests for Shannon entropy analyzer."""
    
    @pytest.fixture
    def analyzer(self):
        """Create analyzer instance."""
        return ShannonAnalyzer()
    
    def test_uniform_distribution(self, analyzer):
        """Test entropy of uniform distribution."""
        # Uniform distribution should have maximum entropy
        items = ["a", "b", "c", "d"]
        result = analyzer.analyze_distribution(items)
        
        assert result.entropy > 0
        # Normalized entropy should be 1.0 for uniform
        assert result.normalized_entropy == pytest.approx(1.0, abs=0.01)
    
    def test_single_type(self, analyzer):
        """Test entropy of single type (zero entropy)."""
        items = ["a", "a", "a", "a"]
        result = analyzer.analyze_distribution(items)
        
        assert result.entropy == 0.0
        assert result.normalized_entropy == 0.0
    
    def test_skewed_distribution(self, analyzer):
        """Test entropy of skewed distribution."""
        items = ["a", "a", "a", "b"]  # 75% a, 25% b
        result = analyzer.analyze_distribution(items)
        
        assert result.entropy > 0
        assert result.normalized_entropy < 1.0
    
    def test_empty_input(self, analyzer):
        """Test handling of empty input."""
        result = analyzer.analyze_distribution([])
        
        assert result.entropy == 0.0
        assert result.unique_types == 0
        assert result.total_items == 0
    
    def test_entropy_calculation(self, analyzer):
        """Test manual entropy calculation."""
        # Two types with equal probability: H = -2 * (0.5 * log2(0.5)) = 1 bit
        items = ["a", "b"]
        entropy, max_entropy, normalized = analyzer.calculate_entropy(items)
        
        assert entropy == pytest.approx(1.0, abs=0.01)
        assert normalized == pytest.approx(1.0, abs=0.01)
    
    def test_distribution_stats(self, analyzer):
        """Test distribution statistics."""
        items = ["x", "x", "y", "z"]
        result = analyzer.analyze_distribution(items)
        
        assert result.unique_types == 3
        assert result.total_items == 4
        assert result.distribution["x"] == 2
        assert result.distribution["y"] == 1
        assert result.distribution["z"] == 1
    
    def test_most_common(self, analyzer):
        """Test most common items."""
        items = ["a", "a", "a", "b", "b", "c"]
        result = analyzer.analyze_distribution(items)
        
        assert result.most_common[0][0] == "a"
        assert result.most_common[0][1] == 3
    
    def test_redundancy_ratio(self, analyzer):
        """Test redundancy ratio calculation."""
        # All same: 100% redundant
        items = ["a", "a", "a"]
        result = analyzer.analyze_distribution(items)
        assert result.redundancy_ratio > 0.5
        
        # All different: 0% redundant
        items = ["a", "b", "c"]
        result = analyzer.analyze_distribution(items)
        assert result.redundancy_ratio == 0.0
    
    def test_level_classification(self, analyzer):
        """Test entropy level classification."""
        # High entropy
        items = ["a", "b", "c", "d"]
        result = analyzer.analyze_distribution(items)
        assert result.level == "High"
        
        # Low entropy
        items = ["a", "a", "a", "a", "b"]
        result = analyzer.analyze_distribution(items)
        assert result.level in ["Low", "Moderate"]
    
    def test_detect_redundancy(self, analyzer):
        """Test redundancy detection in triples."""
        triples = [
            ("A", "is", "B"),
            ("A", "is", "B"),  # duplicate
            ("A", "is", "B"),  # duplicate
            ("C", "is", "D"),
        ]
        
        result = analyzer.detect_redundancy(triples, threshold=2)
        
        assert result["duplicate_triples"] >= 1
        assert result["total_triples"] == 4
        assert result["unique_triples"] == 2


class TestAnalysisResult:
    """Tests for AnalysisResult dataclass."""
    
    def test_create_result(self):
        """Test result creation."""
        result = AnalysisResult(
            entropy=1.5,
            max_entropy=2.0,
            normalized_entropy=0.75,
            unique_types=4,
            total_items=10,
        )
        
        assert result.entropy == 1.5
        assert result.normalized_entropy == 0.75
    
    def test_to_dict(self):
        """Test serialization."""
        result = AnalysisResult(
            entropy=1.0,
            max_entropy=1.0,
            normalized_entropy=1.0,
            unique_types=2,
            total_items=2,
            level="High",
            summary="Test summary",
        )
        
        d = result.to_dict()
        
        assert d["entropy"] == 1.0
        assert d["level"] == "High"
        assert d["summary"] == "Test summary"

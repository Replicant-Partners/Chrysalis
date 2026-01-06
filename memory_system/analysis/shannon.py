"""
Shannon Analyzer - Information Theory Analysis.

Named after Claude Shannon, provides information-theoretic analysis:
- Entropy calculation
- Redundancy detection
- Information density metrics
- Signal-to-noise analysis

Ported from Ludwig's shannon.py evaluator with enhancements.
"""

import math
import logging
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


@dataclass
class AnalysisResult:
    """Result of Shannon analysis."""
    
    timestamp: datetime = field(default_factory=datetime.now)
    
    # Entropy metrics
    entropy: float = 0.0
    max_entropy: float = 0.0
    normalized_entropy: float = 0.0
    
    # Distribution info
    unique_types: int = 0
    total_items: int = 0
    distribution: Dict[str, int] = field(default_factory=dict)
    most_common: List[tuple] = field(default_factory=list)
    
    # Quality metrics
    redundancy_ratio: float = 0.0
    information_density: float = 0.0
    signal_to_noise: float = 1.0
    
    # Analysis summary
    level: str = "Unknown"  # High/Moderate/Low
    summary: str = ""
    recommendations: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "timestamp": self.timestamp.isoformat(),
            "entropy": self.entropy,
            "max_entropy": self.max_entropy,
            "normalized_entropy": self.normalized_entropy,
            "unique_types": self.unique_types,
            "total_items": self.total_items,
            "distribution": self.distribution,
            "most_common": self.most_common,
            "redundancy_ratio": self.redundancy_ratio,
            "information_density": self.information_density,
            "signal_to_noise": self.signal_to_noise,
            "level": self.level,
            "summary": self.summary,
            "recommendations": self.recommendations,
        }


class ShannonAnalyzer:
    """
    Information-theoretic analyzer for knowledge graphs and text.
    
    Calculates Shannon entropy and related metrics to evaluate:
    - Diversity of relationship types
    - Redundancy in knowledge representation
    - Information density per entity
    - Signal vs noise ratio
    
    Usage:
        analyzer = ShannonAnalyzer()
        
        # Analyze relationship distribution
        result = analyzer.analyze_distribution(["calls", "imports", "calls", "uses"])
        print(f"Entropy: {result.entropy:.2f} bits")
        
        # Analyze graph
        result = analyzer.analyze_graph(graph_store)
    """
    
    def __init__(
        self,
        redundancy_threshold: int = 3,
        min_information_threshold: int = 2,
    ):
        """
        Initialize Shannon analyzer.
        
        Args:
            redundancy_threshold: Number of repeats to flag as redundant
            min_information_threshold: Minimum unique types for high density
        """
        self.redundancy_threshold = redundancy_threshold
        self.min_information_threshold = min_information_threshold
    
    def calculate_entropy(self, items: List[str]) -> tuple:
        """
        Calculate Shannon entropy for a list of items.
        
        Args:
            items: List of categorical items
            
        Returns:
            (entropy, max_entropy, normalized_entropy)
        """
        if not items:
            return 0.0, 0.0, 0.0
        
        # Count frequencies
        counts = Counter(items)
        total = len(items)
        n_types = len(counts)
        
        if n_types <= 1:
            return 0.0, 0.0, 0.0
        
        # Calculate Shannon entropy: H = -Σ p(x) * log2(p(x))
        entropy = 0.0
        for count in counts.values():
            p = count / total
            if p > 0:
                entropy -= p * math.log2(p)
        
        # Maximum entropy (uniform distribution)
        max_entropy = math.log2(n_types)
        
        # Normalized entropy (0-1)
        normalized = entropy / max_entropy if max_entropy > 0 else 0.0
        
        return entropy, max_entropy, normalized
    
    def analyze_distribution(self, items: List[str]) -> AnalysisResult:
        """
        Analyze a distribution of items.
        
        Args:
            items: List of items to analyze
            
        Returns:
            AnalysisResult with entropy metrics
        """
        if not items:
            return AnalysisResult(
                summary="No items to analyze",
                level="Unknown",
            )
        
        # Calculate entropy
        entropy, max_entropy, normalized = self.calculate_entropy(items)
        
        # Get distribution
        counts = Counter(items)
        most_common = counts.most_common(5)
        
        # Calculate redundancy
        total = len(items)
        unique = len(counts)
        redundancy_ratio = 1 - (unique / total) if total > 0 else 0
        
        # Interpret entropy level
        if normalized > 0.8:
            level = "High"
            summary = "High entropy indicates diverse, evenly distributed types."
            recommendations = ["Good diversity - maintain current approach"]
        elif normalized > 0.5:
            level = "Moderate"
            summary = "Moderate entropy with some dominant patterns."
            recommendations = ["Consider adding more diverse relationship types"]
        else:
            level = "Low"
            summary = "Low entropy - types concentrated in few patterns."
            recommendations = [
                "Increase relationship diversity",
                "Review if dominant types can be specialized",
            ]
        
        return AnalysisResult(
            entropy=entropy,
            max_entropy=max_entropy,
            normalized_entropy=normalized,
            unique_types=unique,
            total_items=total,
            distribution=dict(counts),
            most_common=most_common,
            redundancy_ratio=redundancy_ratio,
            level=level,
            summary=summary,
            recommendations=recommendations,
        )
    
    def analyze_graph(
        self, 
        graph_store,
        include_nodes: bool = True,
        include_edges: bool = True,
    ) -> AnalysisResult:
        """
        Analyze a graph store for information-theoretic properties.
        
        Args:
            graph_store: GraphStore instance to analyze
            include_nodes: Analyze node types
            include_edges: Analyze edge types
            
        Returns:
            Combined AnalysisResult
        """
        edge_types = []
        node_types = []
        
        # Collect edge types
        if include_edges:
            for source, target in graph_store.edges():
                edge = graph_store.get_edge(source, target)
                if edge:
                    edge_types.append(edge.get("type", "unknown"))
        
        # Collect node types
        if include_nodes:
            for node_id in graph_store.nodes():
                node = graph_store.get_node(node_id)
                if node:
                    node_types.append(node.get("type", "entity"))
        
        # Analyze edge type distribution (primary focus)
        result = self.analyze_distribution(edge_types)
        
        # Add node analysis if requested
        if include_nodes and node_types:
            node_result = self.analyze_distribution(node_types)
            result.recommendations.append(
                f"Node type entropy: {node_result.normalized_entropy:.2%}"
            )
        
        # Add graph-specific metrics
        node_count = graph_store.node_count()
        edge_count = graph_store.edge_count()
        
        if node_count > 0:
            result.information_density = edge_count / node_count
            result.recommendations.append(
                f"Information density: {result.information_density:.2f} edges/node"
            )
        
        result.summary = (
            f"Graph analysis: {node_count} nodes, {edge_count} edges. "
            + result.summary
        )
        
        return result
    
    def detect_redundancy(
        self, 
        triples: List[tuple],
        threshold: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Detect redundant patterns in a list of triples.
        
        Args:
            triples: List of (subject, predicate, object) tuples
            threshold: Override redundancy threshold
            
        Returns:
            Dict with redundancy analysis
        """
        threshold = threshold or self.redundancy_threshold
        
        # Count duplicate triples
        triple_counts = Counter(triples)
        duplicates = {
            t: c for t, c in triple_counts.items() 
            if c >= threshold
        }
        
        # Find entities with identical patterns
        entity_patterns = {}
        for s, p, o in triples:
            if s not in entity_patterns:
                entity_patterns[s] = []
            entity_patterns[s].append(f"{p}:{o}")
        
        # Group by pattern
        pattern_groups = {}
        for entity, pattern in entity_patterns.items():
            pattern_key = tuple(sorted(pattern))
            if pattern_key not in pattern_groups:
                pattern_groups[pattern_key] = []
            pattern_groups[pattern_key].append(entity)
        
        # Find redundant patterns
        redundant_patterns = {
            str(pattern): entities
            for pattern, entities in pattern_groups.items()
            if len(entities) >= threshold
        }
        
        return {
            "duplicate_triples": len(duplicates),
            "duplicates": list(duplicates.keys())[:10],
            "redundant_pattern_groups": len(redundant_patterns),
            "redundant_patterns": redundant_patterns,
            "total_triples": len(triples),
            "unique_triples": len(triple_counts),
        }
    
    def calculate_information_density(
        self,
        entities: Dict[str, Dict[str, Any]],
    ) -> Dict[str, float]:
        """
        Calculate information density per entity.
        
        Args:
            entities: Dict of entity_id -> {relationships: int, unique_types: int}
            
        Returns:
            Dict of entity_id -> density_score
        """
        densities = {}
        
        for entity_id, data in entities.items():
            relationships = data.get("relationships", 0)
            unique_types = data.get("unique_types", 0)
            
            # Density = unique types / total relationships (0-1)
            if relationships > 0:
                density = unique_types / relationships
            else:
                density = 0.0
            
            densities[entity_id] = density
        
        return densities
    
    def estimate_signal_to_noise(
        self,
        items: List[str],
        noise_patterns: Optional[List[str]] = None,
    ) -> float:
        """
        Estimate signal-to-noise ratio for a list of items.
        
        Args:
            items: List of items to analyze
            noise_patterns: Patterns considered noise (default: short strings, generic terms)
            
        Returns:
            Signal-to-noise ratio (0-1)
        """
        if not items:
            return 1.0
        
        if noise_patterns is None:
            noise_patterns = [
                "it", "this", "that", "thing", "stuff", 
                "item", "object", "unknown", "other",
            ]
        
        noise_count = 0
        for item in items:
            # Short items (likely noise)
            if len(item) <= 2:
                noise_count += 1
            # Generic terms
            elif item.lower() in noise_patterns:
                noise_count += 1
        
        signal_count = len(items) - noise_count
        return signal_count / len(items) if items else 1.0

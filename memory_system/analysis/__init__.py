"""
Memory System Analysis Module.

Information-theoretic analysis and external knowledge integration.

Components:
- ShannonAnalyzer: Entropy, redundancy, information density metrics
- YAGOClient: External knowledge base queries via SPARQL

Usage:
    from memory_system.analysis import ShannonAnalyzer, YAGOClient
    
    # Analyze relationship distribution
    analyzer = ShannonAnalyzer()
    result = analyzer.analyze_distribution(["calls", "imports", "calls"])
    print(f"Entropy: {result.entropy:.2f} bits")
    
    # Query external knowledge
    client = YAGOClient()
    entities = client.resolve_entity("Python programming")
"""

from .shannon import ShannonAnalyzer, AnalysisResult
from .external import YAGOClient, YAGOEntity

__all__ = [
    "ShannonAnalyzer",
    "AnalysisResult",
    "YAGOClient",
    "YAGOEntity",
]

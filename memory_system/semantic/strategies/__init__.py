"""
Decomposition Strategies for Semantic Processing.

Pluggable strategies for extracting semantic frames from text:
- OllamaStrategy: LLM-based semantic parsing (highest quality)
- SpacyStrategy: NLP dependency parsing (deterministic)
- TreeSitterStrategy: AST-based code parsing (for code)
- HeuristicStrategy: Keyword-based fallback (fastest)
"""

from memory_system.semantic.strategies.base import DecompositionStrategy
from memory_system.semantic.strategies.ollama_strategy import OllamaStrategy
from memory_system.semantic.strategies.spacy_strategy import SpacyStrategy
from memory_system.semantic.strategies.heuristic_strategy import HeuristicStrategy

__all__ = [
    "DecompositionStrategy",
    "OllamaStrategy",
    "SpacyStrategy",
    "HeuristicStrategy",
]

# TreeSitterStrategy imported conditionally (requires tree-sitter-languages)
try:
    from memory_system.semantic.strategies.treesitter_strategy import TreeSitterStrategy
    __all__.append("TreeSitterStrategy")
except ImportError:
    TreeSitterStrategy = None

"""
Decomposition Strategies for Semantic Processing.

Pluggable strategies for extracting semantic frames from text:
- AnthropicStrategy: Claude Sonnet 4.5 API (highest quality, recommended)
- OllamaStrategy: Local LLM-based semantic parsing (good quality)
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

# AnthropicStrategy imported conditionally (requires anthropic package)
try:
    from memory_system.semantic.strategies.anthropic_strategy import AnthropicStrategy
    __all__.append("AnthropicStrategy")
except ImportError:
    AnthropicStrategy = None

# TreeSitterStrategy imported conditionally (requires tree-sitter-languages)
try:
    from memory_system.semantic.strategies.treesitter_strategy import TreeSitterStrategy
    __all__.append("TreeSitterStrategy")
except ImportError:
    TreeSitterStrategy = None

"""
Chrysalis Semantic Processing Module.

Unified semantic services consolidated from multiple ecosystem repositories:
- SkyPrompt (Ollama decomposition)
- MetaSemantic (spaCy decomposition)
- Ludwig (Graph storage, YAGO client, Shannon analysis)
- serena (LSP resolution)

This module provides:
- Triple decomposition with strategy pattern
- Graph storage adapters (SQLite, ArangoDB, NetworkX)
- External knowledge integration (YAGO 4.5)
- Information theory analysis (Shannon evaluator)
- LSP-based symbol resolution

Usage:
    from memory_system.semantic import SemanticDecomposer, decompose
    
    # Quick decomposition
    frame = await decompose("fix the login bug")
    print(frame.intent, frame.triples)
    
    # With specific strategy
    decomposer = SemanticDecomposer(preferred_strategy="ollama")
    frame = await decomposer.decompose("refactor UserController")
"""

# Core models
from memory_system.semantic.models import (
    Intent,
    Triple,
    SemanticFrame,
    CalibrationResult,
)

# Exceptions
from memory_system.semantic.exceptions import (
    SemanticError,
    ValidationError,
    DecompositionError,
    GraphStorageError,
    EmbeddingError,
    LSPError,
    ExternalKnowledgeError,
    ConverterError,
    AnalysisError,
)

# Decomposer
from memory_system.semantic.decomposer import (
    SemanticDecomposer,
    decompose,
)

# Strategies (lazy import to avoid dependency issues)
from memory_system.semantic.strategies import (
    DecompositionStrategy,
    HeuristicStrategy,
)

__all__ = [
    # Models
    "Intent",
    "Triple",
    "SemanticFrame",
    "CalibrationResult",
    # Exceptions
    "SemanticError",
    "ValidationError",
    "DecompositionError",
    "GraphStorageError",
    "EmbeddingError",
    "LSPError",
    "ExternalKnowledgeError",
    "ConverterError",
    "AnalysisError",
    # Decomposer
    "SemanticDecomposer",
    "decompose",
    # Strategies
    "DecompositionStrategy",
    "HeuristicStrategy",
]

# Version
__version__ = "0.1.0"

# Optional imports (available if dependencies installed)
try:
    from memory_system.semantic.strategies import OllamaStrategy
    __all__.append("OllamaStrategy")
except ImportError:
    pass

try:
    from memory_system.semantic.strategies import SpacyStrategy
    __all__.append("SpacyStrategy")
except ImportError:
    pass

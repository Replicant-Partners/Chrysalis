"""
Memory System Resolvers.

Symbol resolution and code understanding via LSP and heuristics.

Components:
- LSPResolver: Language Server Protocol integration for symbol resolution
- HeuristicResolver: Pattern-based fallback resolution

Usage:
    from memory_system.resolvers import LSPResolver
    
    resolver = LSPResolver()
    await resolver.initialize("/path/to/project")
    
    # Find definition
    definition = await resolver.find_definition("src/main.py", 10, 5)
    
    # Get references
    refs = await resolver.find_references("src/main.py", 10, 5)
"""

from .lsp import LSPResolver, LSPResult, SymbolInfo

__all__ = [
    "LSPResolver",
    "LSPResult",
    "SymbolInfo",
]

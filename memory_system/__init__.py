"""
Memory System - Unified Semantic Services for Chrysalis.

A consolidated semantic processing framework providing:

- **Semantic Decomposition**: Extract triples from natural language
- **Knowledge Graphs**: Store and query semantic relationships
- **Embeddings**: Multi-provider embedding generation with caching
- **Analysis**: Information-theoretic analysis (Shannon entropy)
- **External Knowledge**: YAGO knowledge base integration
- **Code Understanding**: LSP-based symbol resolution
- **Document Processing**: Convert and chunk documents
- **MCP Server**: Expose services via Model Context Protocol

Architecture:
```
memory_system/
├── semantic/      # Triple decomposition (Ollama→spaCy→Heuristic fallback)
├── graph/         # Knowledge graph storage (SQLite, NetworkX)
├── embedding/     # Embedding service with cache
├── analysis/      # Shannon analyzer, YAGO client
├── resolvers/     # LSP symbol resolution
├── converters/    # Document & code converters
└── mcp/           # MCP server interface
```

Quick Start:
    from memory_system import (
        SemanticDecomposer,
        GraphStore,
        EmbeddingService,
        ShannonAnalyzer,
    )
    
    # Decompose text into triples
    decomposer = SemanticDecomposer()
    result = await decomposer.decompose("Python was created by Guido van Rossum")
    for triple in result.triples:
        print(f"{triple.subject} --{triple.predicate}--> {triple.object}")
    
    # Store in knowledge graph
    store = GraphStore(backend="sqlite")
    for triple in result.triples:
        store.add_triple(triple.subject, triple.predicate, triple.object)
    
    # Generate embeddings
    embeddings = EmbeddingService(provider="ollama")
    vector = await embeddings.embed("Hello world")
    
    # Analyze information
    analyzer = ShannonAnalyzer()
    result = analyzer.analyze_distribution(["a", "b", "a", "c"])
    print(f"Entropy: {result.entropy:.2f} bits")

MCP Server:
    from memory_system.mcp import SemanticServer
    
    server = SemanticServer()
    server.run_stdio()  # For Claude Desktop integration

Version: 1.0.0
"""

__version__ = "1.0.0"
__author__ = "Chrysalis Team"

# Core semantic services
from .semantic import (
    SemanticDecomposer,
    Triple,
    Intent,
    SemanticFrame,
)

# Graph storage
from .graph import (
    GraphStore,
    GraphStoreBase,
)

# Embedding service
from .embedding import (
    EmbeddingService,
    EmbeddingResult,
    EmbeddingCache,
)

# Analysis tools
from .analysis import (
    ShannonAnalyzer,
    AnalysisResult,
    YAGOClient,
    YAGOEntity,
)

# Document converters
from .converters import (
    DocumentConverter,
    ConversionResult,
    CodeConverter,
    CodeChunk,
    ChunkConverter,
    Chunk,
)

# LSP resolver
from .resolvers import (
    LSPResolver,
    LSPResult,
    SymbolInfo,
)

# Core memory classes
from .core import (
    Memory,
    MemoryConfig,
    MemoryEntry,
)

# Beads (short-term/context)
from .beads import BeadsService

# Zep hooks/client
from .hooks import ZepHooks, ZepClient, ZepClientError

# MCP server - commented out until mcp module is implemented
# from .mcp import (
#     SemanticServer,
#     create_server,
# )

__all__ = [
    # Version
    "__version__",
    
    # Core Memory
    "Memory",
    "MemoryConfig",
    "MemoryEntry",
    "BeadsService",
    "ZepHooks",
    "ZepClient",
    "ZepClientError",
    
    # Semantic
    "SemanticDecomposer",
    "Triple",
    "Intent",
    "SemanticFrame",
    
    # Graph
    "GraphStore",
    "GraphStoreBase",
    
    # Embedding
    "EmbeddingService",
    "EmbeddingResult",
    "EmbeddingCache",
    
    # Analysis
    "ShannonAnalyzer",
    "AnalysisResult",
    "YAGOClient",
    "YAGOEntity",
    
    # Converters
    "DocumentConverter",
    "ConversionResult",
    "CodeConverter",
    "CodeChunk",
    "ChunkConverter",
    "Chunk",
    
    # Resolvers
    "LSPResolver",
    "LSPResult",
    "SymbolInfo",
    
    # MCP - commented out until mcp module is implemented
    # "SemanticServer",
    # "create_server",
]


def get_version() -> str:
    """Get the package version."""
    return __version__


def create_decomposer(**kwargs) -> SemanticDecomposer:
    """
    Factory function to create a semantic decomposer.
    
    Args:
        **kwargs: Arguments passed to SemanticDecomposer
        
    Returns:
        Configured SemanticDecomposer instance
    """
    return SemanticDecomposer(**kwargs)


def create_graph_store(backend: str = "sqlite", **kwargs) -> GraphStore:
    """
    Factory function to create a graph store.
    
    Args:
        backend: "sqlite" or "networkx"
        **kwargs: Additional arguments
        
    Returns:
        Configured GraphStore instance
    """
    return GraphStore(backend=backend, **kwargs)


def create_embedding_service(provider: str = "ollama", **kwargs) -> EmbeddingService:
    """
    Factory function to create an embedding service.
    
    Args:
        provider: "ollama", "openai", or "sentence_transformers"
        **kwargs: Additional arguments
        
    Returns:
        Configured EmbeddingService instance
    """
    return EmbeddingService(provider=provider, **kwargs)
